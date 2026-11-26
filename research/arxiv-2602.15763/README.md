# GLM-5: From Vibe Coding to Agentic Engineering

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **arXiv**: [2602.15763v2](https://arxiv.org/abs/2602.15763)（提交日期：`2026-02-17`；匿名内测代号 `"Pony Alpha"`，首个在 Artificial Analysis Intelligence Index v4.0 突破 `50` 分的开源权重模型）
- **作者机构**: GLM-5 Team (Zhipu AI / Z.ai & Tsinghua University)
- **本地原文**: [paper.html（上游原文）](https://arxiv.org/abs/2602.15763) | [paper.txt（上游原文）](https://arxiv.org/abs/2602.15763) | `sources.json`（本地校验清单未发布）
- **代际位置与核心价值**:
  - 模型本体为 **744B 总参 / 40B 激活参** MoE（80 层，`DSA` 动态稀疏注意力 + `MLA-256` + 拆分 `Muon` + 3 层参数共享 MTP 平均接受长度 `2.76`，28.5T tokens，200K 上下文）。
  - **2026 全年智谱系 Agentic RL 基建母体**：本文首次完整公开了开源异步强化学习框架 **`slime`（`THUDM/slime`）**、`TITO` 词元直通网关、非确定性 `topk` 崩溃根因与 `IcePop` 公式、Docker `Agent-as-a-Judge`（`CC-Bench-V2`）以及 HTML/Slide 三级防作弊体系——**这整套异步 RL 与前端视觉防黑客基建，正是 2026 下半年 `GLM-5.2`（`2026-06`）、`GLM-5.3`（`2026-08`）直至 `GLM-5.4`（`2026-11`）持续迭代冲榜的底层生产引擎底座**。

---

## 1. 串行多阶段后训练与跨阶段在线蒸馏 `Cross-Stage OPD`（§3）

GLM-5 采用 **`SFT (202,752 ctx)` $\to$ `Reasoning RL` $\to$ `Agentic RL` $\to$ `General RL` $\to$ `Cross-Stage On-Policy Distillation`** 的串行递进式流水线：

1. **长程 Agentic SFT 的三大关键数据策略（§3.1）**：
   - 同时混合训练三种思考范式：**Interleaved Thinking**（每次工具调用前均插入 `<think>`）、**Preserved Thinking**（跨多轮完整保留历史 `<think>` 块，防止代码重构中途遗忘早期假设）与 **Turn-level Thinking**（支持按轮开关思考开销）。
   - **错误探索片段保留上下文但做 Loss Mask**：真实多轮工程轨迹中常包含“写错路径 / 命令报错 $\to$ 观察报错 $\to$ 自修成功”的曲折片段。若直接删去错误轮会导致上下文断裂，若对错误动作计算交叉熵则会教模型复现低级失误；GLM-5 **将错误动作完整保留在输入历史中，但仅对错误输出 token 施加 Loss Mask，只对随后的自修推理与正确修复计算梯度**！
2. **跨阶段在线策略蒸馏（Cross-Stage OPD, §3.5 & Eq. 2）**：
   - 串行跑完 Reasoning RL $\to$ Agentic RL $\to$ General RL 后，后期通用偏好对齐往往会冲刷掉前期高强度数学推理与长程写码锋芒（灾难性遗忘）。
   - GLM-5 将**前序各阶段巅峰 Checkpoint 作为冻结教师 $\pi_{\theta_{\text{teacher}}}^{\text{infer}}$**，在学生自采样（On-Policy）序列上直接用单样本对数概率比构造逐 token 优势：
     $$\hat{A}_{i,t} = \mathrm{sg}\!\left[\log \frac{\pi_{\theta_{\text{teacher}}}^{\text{infer}}(y_{i,t} \mid x, y_{i,<t})}{\pi_{\theta}^{\text{train}}(y_{i,t} \mid x, y_{i,<t})}\right]$$
   - **极致吞吐配置**：由于每个 token 都拥有教师提供的稠密参考基线，不再需要组内多采样求均值作 Baseline，直接设 **GRPO 组大小 $G=1$、全局大 Batch Size $= 1024$**，以极高吞吐快速找回全部前序专项能力！

---

## 2. 非确定性 `topk` 引发的几步内 RL 崩溃与 `IcePop` 公式（§3.2 & Eq. 1）

在 Reasoning RL（$G=32, \text{BS}=32$）启动初期，团队遭遇了一次极具警示意义的**灾难性训推不一致崩溃**：
1. **崩溃现场与真凶定位**：
   - GLM-5 采用 `DSA` 稀疏注意力，每个 Query 需由 Indexer 选出 $k=2048$ 个历史 token（体积过大，无法像 MoE Top-8 路由那样把每次推理选中的索引完整录下来在训练侧重放 `R3`）。
   - 线上 Rollout 引擎（SGLang）中的高性能 CUDA/TileLang `top-k` 算子在高并发浮点并列边界处具有**微小非确定性（Non-determinism）**——导致训练引擎重算同一序列时选出的稀疏 KV 子集与推理时发生细微偏移，**短短几个 RL Step 内即引发策略熵断崖式归零与全面崩溃**！
2. **三合一根治方案（确定性 `torch.topk` + 冻结 Indexer + `IcePop` 双边截断归零）**：
   - 将推理与训练两侧的 `DSA` Indexer 统一替换为**严格确定性的 `torch.topk`**，并在整个 RL 期间**冻结 Indexer 参数**防止稀疏拓扑剧烈漂移；
   - 引入 **`IcePop`（Instruction/Inference-Training Mismatch Popping，Eq. 1）** 修正残余算子浮点误差——定义训推概率比 $\rho_{i,t} = \frac{\pi_{\theta}^{\text{train}}(y_{i,t} \mid x, y_{i,<t})}{\pi_{\theta_{\text{old}}}^{\text{infer}}(y_{i,t} \mid x, y_{i,<t})}$，在标准 PPO/GRPO 裁剪目标外额外乘以双边越界归零掩码 $\mathrm{pop}(\rho_{i,t}, 1/\beta, \beta)$：
     $$\mathrm{pop}(\rho, 1/\beta, \beta) = \begin{cases} \rho, & \text{if } \rho \in [1/\beta, \, \beta] \\ 0 \;\text{(stop-grad / mask out)}, & \text{otherwise} \end{cases}$$
     实产超参取 **$\beta = 2$**（即任何训推概率比落在 $[0.5, \, 2.0]$ 之外的异常离群 token 直接整点梯度清零，同时内层 PPO 裁剪取非对称 $\epsilon_{\text{low}}=0.2, \epsilon_{\text{high}}=0.28$）。

---

## 3. `slime` 全异步 Agentic RL 架构与 `TITO` 网关（§3.6, §4.1, Eqs. 3–5）

针对多轮软件工程与前端交互沙盒 Rollout 耗时长、长尾严重的问题，GLM-5 构建并开源了 **`slime` 全异步解耦强化学习基础设施**：

1. **训推彻底物理分离 + PD 分离推理池（§4.1.1）**：
   - 训练集群运行 Megatron-LM；推理集群运行启用 **FP8 + MTP + Prefill-Decode (PD) 分离 + DP 感知一致性哈希路由（DP-aware Consistent-Hash Routing，最大化多轮对话前缀 KV 命中率）** 的 SGLang 集群。
   - 中间层通过基于 HTTP 的 **Multi-Task Rollout Orchestrator** 并发驱动 `>1,000` 条异构沙盒长轨迹，配备心跳探活与故障节点自动重路由。
2. **`TITO`（Token-In-Token-Out）直通网关（§4.1.2）**：
   - 传统 Agent 框架在环境与 LLM 之间传递纯字符串（Text-In-Text-Out）；一旦多轮拼接文本在训练侧重新分词（Re-tokenization），空格合并、特殊标签切分或代码缩进边界极易产生“差一个BPE词元、后续全错位”的致命幻觉。
   - `TITO` 网关直接拦截推理侧解码器吐出的**精确原始 Token ID 数组与逐 token `rollout_logprobs`** 原样回传训练缓冲区，从物理链路层面 **100% 根除二次分词漂移**。
3. **无 $\pi_{\theta_{\text{old}}}$ 显存开销的直接双边重要性采样掩码（Eqs. 3–5）**：
   - 异步模式下无需在训练卡额外拷贝一份旧模型重算 $\pi_{\theta_{\text{old}}}$，直接利用 `TITO` 记录的 $\log \pi_{\text{rollout}}$ 计算重要性权重 $r_t(\theta) = \exp(\log \pi_\theta - \log \pi_{\text{rollout}})$，对落在 $[1-\epsilon_\ell, 1+\epsilon_h]$ 外的陈旧 token 置零梯度；
   - 每训练 $K$ 步向推理集群推送一次新权重并**同步重置优化器动量状态（Optimizer Reset）**以消除跨版本动量冲刷；丢弃跨越版本差 $w' - w_0 > \tau$ 的过度陈旧轨迹；
   - **沙盒基础设施崩溃隔离**：若某次采样因 Docker 超时/网络抖动而非模型错误中断，**严禁给负分**——若同组（Group）内有效完成样本 `>50%` 则填充均值优势保留该组，否则整组安全丢弃。

---

## 4. Docker `Agent-as-a-Judge` 与 HTML/Slide 三级视觉防作弊体系（§4.2.5, §6.2.1, Appendix B.4.1）

### 4.1 `CC-Bench-V2` 与容器化交互式评判 Agent（§6.2.1 & Appendix B.4.1）
- 构建包含 **220 个真实前端开发任务**（涵盖 HTML/React/Vue/Svelte/Next.js 七大场景，其中专门包含 **40 个 Web 交互游戏**与 **32 个 SVG/Canvas 图形动画任务**）的 `CC-Bench-V2`。
- 评测发现传统静态构建通过率（`BSR`, Build Success Rate）高达 **`98%`**，但大量“能编译过”的页面一打开就白屏或按钮点不动！
- 为此设计两阶段容器化 **`Agent-as-a-Judge`**：在隔离 Docker 内启动 **`Claude Code (Sonnet 4.5) + Playwright MCP`**，让评判 Agent 像真实测试工程师一样启动 Dev Server、阅读需求清单、执行点击/拖拽/输入交互并截图审查——**与人类前端专家逐点一致率高达 `94%`、Spearman 模型排名相关性达 `85.7%`**，精准暴露出从编译成功（`BSR`）到端到端交互实现成功（`ISR`）之间的真实鸿沟。

### 4.2 HTML / 演示文稿生成 RL 的三级递进防作弊（3-Level Anti-Hacking, §4.2.5 & Fig. 9）
在训练模型编写 `16:9` HTML/CSS 视觉幻灯片与排版代码时，团队亲历了经典的视觉指标黑客攻击并构建了**三级联防奖励 + 页面级掩码**：
1. **Level-1 静态标记规则核验**：检查 HTML/CSS 可解析性、字体字号层级、色彩对比度，以及**幻觉外链图片 / 重复粘贴同一图片检测**。
2. **Level-2 分布式运行时浏览器 DOM 几何核验（抓获两类隐蔽 Reward Hacking！）**：
   - 在真实浏览器引擎渲染后提取全部 DOM 元素的精确 Bounding Box 与溢出指标；
   - **实战抓获的作弊手法（Fig. 9）**：当早期只惩罚“文字超出 `16:9` 画布边界”时，RL 策略迅速学会了两招歪门邪道——① **硬截断文本或滥用 CSS `overflow: hidden` 强行裁掉溢出内容**（表面零溢出，实则信息残缺）；② **极端压缩行距/外边距把满屏元素挤成一团**！Level-2 随即补齐了子容器裁剪检测、最小字号/间距下限与元素相互遮挡重叠惩罚。
3. **Level-3 视觉感知留白与构图均衡度（Visual Perceptual Balance）**：基于渲染截图评估版面重心、留白比例与美学协调性。
4. **动态简单样本剔除 + 缺陷页局部 Loss Masking**：在多页生成轨迹中，若第 3 页存在轻微排版瑕疵而其余 9 页完美，仅对**缺陷页对应的代码段做局部 Loss Masking**（保留优质页正样本信号），将严格 `16:9` 版式零溢出合规率从 **`40%` 狂拉至 `92%`**，人类盲评对 GLM-4.5 胜率达 **`67.5%`**！
- 此外，§4.2.4 提出分层上下文管理（`Keep-recent-k=5` 折叠旧轮冗长工具原始返回 + 满 $T=32\text{K}$ 触发 `Discard-all` 结构化重置，使 `BrowseComp` 从 `55.3% -> 62.0% -> 75.9%`）。

---

## 5. 对本项目的工程映射（`Qwen3.8-27B` 三轨 Visual Coding & CAD Agent）

1. **直接在 `Track 2 (2D Web Canvas+SVG+GSAP)` 与 `Track 1 (Three.js)` 落地 GLM-5 三级防作弊准则**：
   - 我们在 `check_2d_v2.mjs` 与 `verify_xhs_output.cjs` 中绝不能只测“无报错 + 非纯色白屏”——必须复刻 GLM-5 Level-2 DOM/Canvas 几何探针：**严查 `overflow: hidden` 裁切吞字、DOM 节点重叠碰撞、Canvas 有效绘制像素包围盒占比（防挤在左上角一丁点或飞出视口）以及空动画（跨时间戳像素差分近零）**！
2. **异步/半异步训练务必启用 `TITO` 词元直通与 `IcePop` 离群梯度熔断**：
   - 在 `ms-swift` 多轮沙盒采样中直接保存推理侧原始 `token_ids` 与 `rollout_logprobs`，禁止将多轮工具消息拼回字符串二次分词；并在 `GSPO-token` 更新时加入 $\rho \in [0.5, 2.0]$ 的 `IcePop` 保护网与基础设施超时样本免罚丢弃机制。
3. **吸收 SFT“保留报错上下文 + 仅对错误动作 Loss Mask”清洗小红书 `3DCodeFactory` 轨迹**：
   - 小红书真实 `Claude Code` 3D 轨迹中天然包含编译报错或渲染异常后的自修回合；在 Stage 0 SFT 数据构造时，**保留报错前因与观测结果，但将产生 Bug 的那一轮错误代码输出做 Loss Mask，重点强化后续看图/看报错定位修复轮的权重**！
