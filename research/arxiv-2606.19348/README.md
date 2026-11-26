# DeepSeek-V4: Towards Highly Efficient Million-Token Context Intelligence

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **arXiv**: [2606.19348v1](https://arxiv.org/abs/2606.19348)（提交元数据：`2026-04-26`，归档号 `2606.19348`；`DeepSeek-V4-Pro` 于 `2026-08-13` 全量 GA，后续衍生轻量高速版 `DeepSeek-V4.1-Flash` / `1017`）
- **作者机构**: DeepSeek-AI
- **本地原文**: [paper.html（上游原文）](https://arxiv.org/abs/2606.19348) | [paper.txt（上游原文）](https://arxiv.org/abs/2606.19348) | `sources.json`（本地校验清单未发布）
- **模型谱系与定位**:
  - `DeepSeek-V4-Pro`：总参数 **1.6T** / 激活参数 **49B**（61 层，$d=7168$，1 共享专家 + 384 路由专家激活 Top-6，预训练 33T tokens，最大批大小 94.4M tokens，峰值 LR `2.0e-4`）
  - `DeepSeek-V4-Flash`：总参数 **284B** / 激活参数 **13B**（43 层，$d=4096$，1 共享专家 + 256 路由专家激活 Top-6，预训练 32T tokens，最大批大小 75.5M tokens，峰值 LR `2.7e-4`）
  - **1M 上下文极致效率**：相比 `DeepSeek-V3.2`（`671B/37B`），在 1M 上下文处，`V4-Pro` 仅需 **27% 单 token 计算量**与 **10% KV Cache**；`V4-Flash` 仅需 **10% 计算量**与 **7% KV Cache**（约相当于同规模标准 BF16 GQA-8 KV Cache 的 **2%**）。

---

## 1. 核心架构与预训练底座速览（§2–§4, Appendix A）

1. **交错压缩稀疏注意力 `CSA` + 层次压缩注意力 `HCA`（§2.1）**：
   - 主体采用 **Compressed Sparse Attention (`CSA`)**：以步幅 $m=4$、重叠窗口长度 $2m=8$ 对隐藏态做局部 Softmax 加权池化压缩，配合 **FP4 Lightning Indexer**（$n_h^I=64, c^I=128$）按压缩块打分并选取 Top-$k$（`Pro` $k=1024$，`Flash` $k=512$），再结合 **Shared-KV MQA** 与 **Grouped Output Projection**（$g=16/8$）大幅削减显存带宽与参数开销。
   - 每隔固定层插入少量密集长程检索层 **Hierarchical Compressed Attention (`HCA`, $m'=128$)**（`Pro` 5 层、`Flash` 4 层），无需学习型 Indexer 即可以极小 KV 开销全局扫描百万级上下文。
   - 全注意力层统一配备局部滑动窗口分支 **SWA（$n_{\text{win}}=128$）**、可学习 **Attention Sink**，以及 **Partial + Inverse RoPE**：仅对末尾 $d^R=64$ 维施加 RoPE，并在注意力输出聚合后对 $\mathbf{o}_{t,i}$ 乘以逆旋转矩阵 $\mathrm{RoPE}(\cdot, -i)$，消除相对位置耦合噪声。
2. **流形约束超连接 `mHC` 与混合 `Muon` 优化器（§2.2–§2.4, Appendix A）**：
   - **`mHC`（$n_{\text{hc}}=4$ 流残差）**：将跨流混合矩阵 $B_l \in \mathbb{R}^{4\times 4}$ 投影至 **Birkhoff 多胞形（双随机矩阵）**（经 $t_{\max}=20$ 步 Sinkhorn-Knopp 迭代），配合 Sigmoid 读写门 $A_l = \sigma(\tilde{A}_l)$ 与 $C_l = 2\sigma(\tilde{C}_l)$，保证任意深度残差范数严格有界；结合 DualPipe/1F1B 通信重叠（Appendix A），端到端真实训练时间开销仅 **6.7%**。
   - **10 步混合 Newton-Schulz `Muon`**：8 步激进系数 $(3.4445, -4.7750, 2.0315)$ 快速拉升极小奇异值 + 2 步保守系数 $(2, -1.5, 0.5)$ 将有效奇异值收敛精度压缩至 $<0.1\%$（标准 5 步 NS 误差高达 $\sim 30\%$），RMS 对齐缩放因子设为 $0.18\sqrt{\max(n,m)}$；因 Q/KV 具备 RMSNorm，全程**无需 `QK-Clip`**。
   - **万亿 MoE 防崩溃机制**：路由激活函数由 Sigmoid 改为平滑无饱和上界的 $\mathrm{Sqrt}(\mathrm{Softplus}(\cdot))$，前 3 个 MoE 层采用确定性 **Hash Routing**；训练中配备 **SwiGLU Clamping**（线性分支截断至 $[-10,10]$，门控分支截断至 $\le 10$）与 **Anticipatory Routing**（仅在检测到 Loss 尖峰回滚时动态启用 $\theta_{t-\Delta t}$ 历史路由表重训，常规零额外开销）。`MegaMoE` 波流水线 EP 算子在通用场景提速 `1.50×–1.73×`，在 RL Rollout 阶段提速高达 **`1.96×`**。

---

## 2. 批次不变与全链路逐比特确定性算子（§3.3）

> **核心痛点**：在大规模异步/抢占式 RL 与多教师在线蒸馏（OPD）中，同一条样本在不同 Batch 大小或不同并列请求位置下的浮点归约顺序差异，会导致推理引擎（Rollout）与训练引擎（Trainer）产生微小的逐 token 对数概率漂移；在 1M 超长轨迹与稀疏注意力 Top-$k$ 边界处，微小数值扰动会翻转离散索引选择，引发严重的 Off-Policy 梯度爆炸或熵坍缩。

DeepSeek-V4 在**预训练、后训练与线上推理全栈**强制实施 **Batch-Invariant & Deterministic Kernels（批次大小无关且逐比特确定性算子）**：

1. **前向传播：兼顾批次不变性与高吞吐（§3.3.1）**：
   - **Attention 解码（抛弃传统 Split-KV）**：标准 `Split-KV` 会根据当前 Batch 并发度动态改变 KV 分块数与归约树结构，破坏批次不变性。DeepSeek-V4 设计了 **双内核自适应策略（Dual-Kernel Strategy）**：
     - 当活跃线程块数足以跑满全部 SM（Full Waves）时，调度**单 SM 独立内核**，每个请求在单个 SM 内部按固定顺序完成全部 KV 归约；
     - 在尾部波次（Tail Wave，剩余工作量不足以填满 GPU）或极小 Batch 时，切换至基于 **Thread Block Cluster + 分布式共享内存（Distributed Shared Memory）** 的**跨 SM 协同内核**，严格对齐与单 SM 内核**完全一致的分块粒度与累加顺序**，在不牺牲长上下文解码吞吐的前提下实现逐比特批次不变。
   - **矩阵乘（`DeepGEMM` 替代 `cuBLAS`）**：全面使用自研 `DeepGEMM` 替代闭源 `cuBLAS`（后者会根据矩阵批维动态切换内部 Tile 策略），并在全部线性层彻底禁用不满足批次不变性的 **`split-k` 归约**。
2. **反向传播：消除跨线程块原子写竞争（§3.3.2）**：
   - **稀疏注意力反向（KV 梯度原子累加）**：不同 Query 可能命中同一压缩/稀疏 KV 块，传统原子加法顺序非确定。新算子为每个 SM 分配**独立局部累加缓冲区（Per-SM Accumulation Buffer）**，待各 SM 本地确定性累加完毕后，启动专用全局归约内核按固定 SM 编号顺序求和。
   - **MoE 反向传播**：在单卡内部（Intra-rank）预先对输入 token 做确定性重排预处理，并在跨卡 All-to-All 归约（Cross-rank）时分配隔离缓冲区按固定 Rank 顺序合并。
   - **`mHC` 极窄投影层反向（$d_{\text{out}}=24$）**：由于输出维度仅 24，反向梯度必须开启 `split-k` 才能吃满 SM；通过让每个 Split 写入独立切片内存、随后调用确定性归约核汇总，兼顾高利用率与逐比特可复现。

---

## 3. 后训练全栈体系：专家 RL $\to$ 全词表多教师 OPD（§5）

DeepSeek-V4 彻底抛弃了传统“多领域混合多任务 RL（Mixed RL）”的妥协路线，确立了**“垂直领域专家独立 SFT+GRPO $\to$ 全词表多教师在线策略蒸馏（Multi-Teacher OPD）无损合一”**的两阶段工业范式：

### 3.1 三档推理强度模式（Reasoning Effort Modes, §5.1 & Table 2–3）
模型原生支持通过模板/系统提示精确调控测试时计算预算（Test-Time Scaling）：
- **`Non-think`（直出模式，评测上下文 8K）**：在 Prompt 后直接拼接空思考闭合标签 `</think>`，零思维链开销极速响应。
- **`Think High`（标准深度思考，评测上下文 128K）**：模型在 `<think>...</think>` 内完成自适应长程推理与工具交错规划，再输出最终摘要。
- **`Think Max`（极限压测模式，评测上下文 384K）**：注入专用高强度系统提示（要求穷尽式问题拆解、边界条件压力测试、多路径交叉核验与反例自检），在数学竞赛（Putnam 满分 `120/120`）、算法竞赛（Codeforces `3206`）与复杂工程架构任务上释放极限上限。

### 3.2 Actor 原生兼任生成式奖励模型（Actor-as-GRM 共训, §5.1.1）
- 完全弃用易被特定句式欺骗的标量奖励头（Scalar RM）。
- 构建**细粒度评分量表（Rubric-Guided）RL 数据集**，直接在生成式评判任务上运行强化学习，且**由同一个 Actor 策略网络原生兼任 GRM（Generative Reward Model）**——即生成策略与评判策略共享参数并联合进化：模型在学会如何更严密地挑错、核验边界与打分的同时，直接内化了对自身生成质量的审美与自检能力。

### 3.3 `<|DSML|>` XML 工具调用协议与跨全轮 `<think>` 完整保留（§5.1.2, Table 4, Fig. 7）
1. **抗转义崩溃的 `<|DSML|>` XML 工具格式**：
   - 传统 JSON 工具参数在生成大段前端 HTML/JS/Python/Three.js 源码时极易因引号、换行符与反斜杠双重转义出错导致解析失败。
   - DeepSeek-V4 采用专用特殊词元包裹的 XML 结构：
     ```xml
     <|DSML|tool_calls|>
     <|DSML|invoke name="write_file"|>
     <|DSML|parameter name="path" string="true"|>src/scene.js<|/DSML|parameter|>
     <|DSML|parameter name="content" string="true"|>[原始未转义代码正文]<|/DSML|parameter|>
     <|/DSML|invoke|>
     <|/DSML|tool_calls|>
     ```
   - 当 `string="true"` 时，参数正文按原始文本直接流式生成与切片提取，彻底消灭大文件代码写入的 JSON 语法崩溃。
   - **Quick Instruction 快速指令特殊词元**：针对搜索与网页浏览高频微操作，引入 `<|action|>`、`<|title|>`、`<|query|>`、`<|authority|>`、`<|domain|>`、`<|extracted_url|>...<|read_url|>` 等轻量词元，直接在主模型既有 KV Cache 上原位完成 URL 筛选与摘要提取，省去外部小模型二次 Prefill 开销。
2. **工具调用场景下跨 `user` 边界 100% 保留 `<think>`（Fig. 7a vs 7b）**：
   - 在 `DeepSeek-V3.2` 中，一旦出现新的 `user` 消息，历史轮次的 `<think>` 会被全部清空，导致多轮交互式软件工程（用户中途补充需求或反馈修 Bug）出现“推理失忆”。
   - `DeepSeek-V4` 明确区分两类上下文策略：**只要会话处于 Tool-Calling / Agentic 模式（Fig. 7a），横跨全部工具返回与新 `user` 轮次的历史 `<think>` 链条 100% 完整保留**，保障跨数十轮工程迭代的架构意图连续性；仅在纯日常闲聊（General Chat, Fig. 7b）中剥离旧轮 `<think>` 以节省上下文。

### 3.4 全词表多教师在线策略蒸馏（Full-Vocabulary OPD, §5.2.2 & Eq. 29）
为将 **超过 10 个万亿参数规模的领域专家教师**（数学、竞赛编程、SWE 工程、Agentic Search、创意与公文写作、安全对齐等）无损融合进单一统一模型，DeepSeek-V4 最小化加权在线反向 KL 散度：
$$\mathcal{L}_{\text{OPD}}(\theta) = \sum_{i=1}^{N} w_i \, D_{\text{KL}}\!\left(\pi_\theta(\cdot \mid x) \,\|\, \pi_{E_i}(\cdot \mid x)\right)$$
- **为什么抛弃单 Token 对数比近似？** 常见轻量实现将 $\mathrm{sg}\!\left[\log \frac{\pi_{E_i}(y_t \mid y_{<t})}{\pi_\theta(y_t \mid y_{<t})}\right]$ 当作单采样 token 的伪优势函数（Policy Gradient 估计），但在多教师、长序列场景下存在**极高的梯度方差与训练不稳定**，极易在尾部低概率 token 上引发剧烈震荡。
- **核心基建突破——仅缓存最后一层 Hidden State 并在训练侧实时重构全词表 Logits**：
  1. 若直接落盘全词表 Logits（$|V|=128\text{K}$，1M 序列长度），单条轨迹的存储与网络 I/O 高达数百 GB，完全不可行；
  2. DeepSeek-V4 将十余个万亿教师权重切片卸载在中心化存储池（按需以 ZeRO 分片拉起完成前向），在教师前向阶段**仅缓存教师模型最后一层输出隐藏态 $\mathbf{h}_{T}^{\text{teacher}} \in \mathbb{R}^{d}$（体积比全词表 Logits 缩小约 `18×`）**；
  3. 在学生训练侧，按 `teacher_id` 对 Mini-batch 样本排序分组，使得**每个教师的输出投影头（LM Head）在每个 Mini-batch 中仅需加载进 GPU 显存一次（任意时刻显存最多驻留 1 个教师 Head）**，实时矩阵乘重构完整 $128\text{K}$ 词表 Logits，并调用自研 **TileLang 融合 KL 算子**原位计算精确全词表反向 KL 及其梯度，峰值显存几乎零增长！

### 3.5 MXFP4 量化感知后训练（QAT, §5.2.1）
- 在后训练阶段直接对 MoE 专家权重与 `CSA` Indexer QK 路径启用 **MXFP4（E2M1，`1×32` 子块嵌套于 `128×128` FP8 块）+ 直通估计器（STE）**，实现 FP4 到 FP8（E4M3）的硬件无损反量化对齐。
- 将 `CSA` 索引得分矩阵 $I_{:,:}$ 从 FP32 量化至 BF16，使 Top-$k$ 检索提速 **`2×`** 且召回率保持 **`99.7%`**；RL Rollout 直接使用原生 FP4 权重推理，彻底消除量化部署掉点与训推精度鸿沟。

### 3.6 Token 粒度预写日志（`WAL`）防抢占短长度偏置（§5.2.3）
- 生产集群采用高优任务可随时抢占 RL Rollout 节点的弹性调度。
- **严密数学洞见（Survival Bias / Short-Length Bias）**：若请求在生成中途被抢占中断后简单丢弃并“从头重新采样（Regenerate from scratch）”，则**生成长度越短的轨迹在两次抢占间隔内顺利跑完的存活概率越高，而深度长思考/多轮工具调用轨迹被反复腰斩重抽**，在统计上必然引入系统性的**短回复偏置（Short-Length Bias）**，直接破坏 `Think High/Max` 与长程 Agent 的训练分布！
- **解法**：Rollout 引擎每解码出一个 token 立即追加写入请求级 **Write-Ahead Log (`WAL`)**，并在收到抢占信号时异步转储当前 KV Cache；恢复调度后严格从断点 token 续写，保证任意长度轨迹的无偏采样。

### 3.7 `DSec` 四基板统一沙盒与全局有序轨迹快进重放（§5.2.5）
面向数十万并发 Agentic RL 环境实例，DeepSeek 基于自研分布式文件系统 `3FS` 构建了全 Rust 编写的 **`DSec`（`Apiserver` + `Edge` + `Watcher` + Python SDK `libdsec`）**：
1. **统一抽象四大隔离基板（4 Substrates）**：
   - `Function Call`：预热容器池，微秒级无状态工具调用；
   - `Container`：基于 `3FS` 只读 `EROFS` 按需数据块拉取 + 本地元数据层，支撑百万镜像秒级启动；
   - `microVM`：Firecracker + `overlaybd` 链式写时复制（CoW）快照，毫秒级挂起/恢复，提供内核级强隔离；
   - `fullVM`：QEMU 完整操作系统虚拟化（GUI/复杂系统级任务）。
2. **高密宿主优化**：跨虚拟化实例页缓存去重（Page-Cache Deduplication）+ 内存主动回收超卖 + 修复高并发容器运行时内核自旋锁争用（Spinlock Contention）。
3. **全局有序轨迹日志与客户端快进恢复（Client Fast-Forwarding）**：
   - `DSec` 将 Agent 与环境的每一次命令执行与返回记录为**全局严格有序的确定性轨迹日志**。
   - 当长程 Rollout 因集群抢占或节点故障重启时，客户端无需从零重建外部状态或重跑具有非幂等副作用的命令，而是利用 `WAL` + 轨迹日志**自动快进重放（Fast-Forward）已完成的工具调用缓存结果**，无缝衔接至中断点沙盒快照继续探索，同时天然满足数据溯源与确定性离线复现。

---

## 4. 核心评测结果与 Appendix 关键发现（§6, Appendix B）

| 评测维度 / 基准 | DeepSeek-V4-Pro (Max / High) | DeepSeek-V4-Flash (Max) | 关键对比参考 |
| :--- | :---: | :---: | :--- |
| **LiveCodeBench (Pass@1)** | **93.5** | 89.2 | 超越同期闭源旗舰 |
| **Codeforces Rating** | **3206**（人类全球 #23） | 2980+ | Grandmaster 顶尖水平 |
| **Putnam-2025（形式化+非形式化混合）** | **120 / 120（满分）** | — | Lean 4 协同证明全部 12 题 |
| **SWE-bench Verified / Multilingual** | **80.6** / **76.2** | 74.8 / 70.1 | 多语言真实仓修复领先 |
| **Terminal-Bench 2.0** | **67.9**（Verified `~72.0`） | 60.4 | 复杂终端运维与排障 |
| **BrowseComp / MCPAtlas** | **83.4** / **73.6** | 76.5 / 68.9 | 深度搜索与多 MCP 编排 |
| **MRCR (1M Long-Context)** | **83.5** | 79.1 | 百万上下文多针精准检索 |
| **内部研发真实编程（30 题 CUDA/Rust/C++/PyTorch）** | **67%** | — | 胜过 Sonnet 4.5 (`47%`)，逼近 Opus 4.5 (`70%`) |

- **Appendix B 深度实验**：
  - **Agentic Search vs 传统静态 RAG（869 条真实复杂查询盲评）**：端到端 Agentic Search 以 **`61.7% vs 18.3%`** 压倒性击败 RAG；得益于并行工具调用（平均 **16.2 次**调用）与 Quick Instruction 原位剪枝，总 Prefill 仅从 `10,453` 温和增至 `13,649` tokens。
  - **白领办公与长文写作盲评**：对阵 `Opus-4.6-Max` 取得 **63% 不败率（Non-loss rate）**，中文功能性写作对 `Gemini-3.1-Pro` 胜率 **`62.65% vs 34.10%`**（质量偏好 **`77.48%`**）；但作者在局限性中坦诚指出：**生成幻灯片/前端视觉排版的审美细腻度（Visual/Slide Aesthetics）仍弱于顶尖多模态视觉闭源模型**（这也印证了纯文本 DOM/代码验证必须补充渲染态视觉闭环）。

---

## 5. 对本项目的工程映射（`Qwen3.8-27B` 三轨 Visual Coding & CAD Agent）

1. **Stage 4 三轨无损合流首选“缓存末层 Hidden State 的全词表多教师 OPD”**：
   - 我们的 `Track 1 (Three.js 3D)`、`Track 2 (2D Canvas/SVG/GSAP)`、`Track 3 (CadQuery CAD)` 在各自专项 RL 收敛后，若做混合 RL 极易互相抢占梯度并引发通用退化。直接复刻 DeepSeek-V4 §5.2.2：离线用三轨专家对各自域内 On-Policy 学生轨迹前向并**仅落盘 `Qwen3.8-27B` 末层 Hidden State（$d=5120/6144$ BF16，体积远小于 `152K` 全词表 Logits）**，训练时按轨道分组单次挂载教师 LM Head 计算精确全词表反向 KL，在 `2×8 H800` 上即可实现零方差爆炸的三轨无损合流！
2. **多轮工程模式跨 `user` / `auto-compact` 保留 `<think>` + XML/免转义代码工具协议**：
   - 在生成数百行 Three.js Shader 或多组件装配体时，JSON 字符串转义错误是无效负奖励的主要噪音源之一；训练与推理脚手架应保持原生免转义参数通道，且在多轮视觉自检修 Bug 期间**保留历史 `<think>` 推理脉络**（直至触发 `384K` 主动结构化摘要）。
3. **警惕超时重抽导致的“短代码/偷懒场景偏置（Short-Length Bias）”**：
   - 在 `2×8 H800` 跑长程 Three.js 渲染自修 Rollout 时，复杂精细几何与多轮 Playwright 截图轨迹耗时长，若因超时/OOM 直接丢弃重抽，会隐式奖励模型写出“极简几个立方体快速交差”的偷懒代码。必须借鉴 `WAL` 断点续跑思想，区分系统基础设施中断（Mask 掉而非记负分或偏向短样本）与真实模型死循环。
