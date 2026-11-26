# Kimi K3: Open Frontier Intelligence

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **arXiv**: [2607.24653v2](https://arxiv.org/abs/2607.24653)（v1 提交：`2026-07-27`，v2 更新：`2026-08-07`；产品首发 `2026-07-16`，后续强化后训练迭代版 `Kimi K3.1 Pro` 于 `2026-10-23` 发布、`2026-11-04` 开源）
- **作者机构**: Kimi Team (Moonshot AI)
- **本地原文**: [paper.html（上游原文）](https://arxiv.org/abs/2607.24653) | [paper.txt（上游原文）](https://arxiv.org/abs/2607.24653) | `sources.json`（本地校验清单未发布）
- **模型规模与代际位置**:
  - 总参数 **2.78T（2.8T）** / 激活参数 **104.2B（104B）** 原生多模态 MoE，93 层（**69 层 `KDA` 线性注意力 + 24 层 `NoPE Gated MLA` 全局注意力**，按 `3:1` 交错并以全局 MLA 收尾），词表 `160K`，原生 **1M 上下文**，Scaling 效率达 `Kimi K2` 的 **`2.5×`**。
  - 承接 `Kimi K2.5`（视觉看图自修闭环、`Toggle` 预算控制、局部 token 正则）并全面升级为 **9 专家 RL + 截断 `MOPD` 合流 + 5,121 万微虚拟机 `AgentENV` + Web/3D/WebGL/Shader 专项 RL（盲评对 `Claude Opus 4.8 max` 净胜 `+59.1%`）**。

---

## 1. 预训练架构与原生多模态核心创新（§2–§3, Appendix A–E）

1. **数值有界 `KDA` + `Block AttnRes` 深度注意力残差（§2.1–§2.2）**：
   - **`Kimi Delta Attention (KDA)`**：通过下界对数衰减参数化 $g_t^h = g_{\min}\,\mathrm{Sigmoid}(e^{A_h} z_t^h)$（取 $g_{\min}=-5$），严格保证对角分块内倒数累积衰减因子 $< e^{80}$，完美落入 **BF16 Tensor Core 动态范围**而不溢出，并配备全秩 Sigmoid 输出门控。
   - **`Block AttnRes`（$N=8$ 块，每 12 层一块 + Embedding 共 9 个深度节点）**：每层输入不再是固定等权残差和，而是跨深度块做 Softmax 注意力聚合，显式打通深层网络的信息捷径。
2. **`Stable LatentMoE` 与精确分位数负载均衡 `QB`（§2.3, Appendix B–D）**：
   - 在 $0.5\times$ 潜空间维度（`3584`）部署 **896 个路由专家（激活 Top-16）+ 2 个全宽共享专家**。
   - **三重防爆稳定化**：Up-projection 前置 RMSNorm + 有界光滑激活函数 **`SiTU-GLU`**（$\beta_1=4, \beta_2=25$，Appendix B 严格证明全局无穷范数上界 $\|f\|_\infty \le 100$，彻底根治超大 MoE 专家激活值爆炸）+ **Quantile Balancing (`QB`, Appendix C–D)**：利用全局 All-Reduce 的 $B=1000$ 桶直方图（通信开销 `<1%`）直接追踪 Top-$(k+1)$ 截断边际的 $(1-k/n)$ 分位数，实现精确二部图 $b$-匹配的坐标下降对偶最优解，无需启发式步长调参。
3. **从零 NTP 训练的 `MoonViT-V2`（§2.4）**：
   - 抛弃 `K2.5` 沿用的 SigLIP 对比学习预训练初始化，改为 **401M（27 层）从零随语言主干联合做 Next-Token Prediction (NTP) 预训练**（最高原生分辨率 $3584 \times 3584$ px，$2\times 2$ Pixel-Shuffle），**彻底消除了早期多模态融合时由异构视觉塔引发的梯度范数尖峰（Gradient Norm Spikes）**！配合 **Per-Head Muon** 与独立搜参验证优于 WSD 的 **Cosine 学习率调度**，全程零尖峰收敛。

---

## 2. 后训练全章深度拆解：9 专家 RL $\to$ 截断 `MOPD`（§4, Appendix F）

### 2.1 三大领域 $\times$ 三档推理预算 = 9 路专家 RL（§4.1.1–§4.1.2）
在多阶段长上下文 SFT 冷启动后，Kimi K3 独立训练 **9 个 RL 专家模型**——横跨 **3 大任务域**：
1. **General Tasks**（多模态视觉推理、STEM、事实忠实度、搜索、知识办公）
2. **General Agents**（长程通用助手、Deep Research、深度调研写作）
3. **Coding Agents**（真实仓 SWE、交互式编码体验、GPU 高性能算子、**Web / 3D / 游戏开发**）
且每个领域分别训练 **`{low, high, max}` 三档推理预算专家**。

### 2.2 Partial Rollout 局部正则 + $\tau \cdot b_0(x)$ 预算退火课程（§4.1.2）
1. **Partial Rollout 截断长尾空转 + 局部逐 Token 正则**：
   - 每轮采样 $N \times K$ 条轨迹，**一旦有比例 $\lambda \in (0,1)$（即 $\lambda N K$ 条）完成，立即暂停当前轮 Rollout 进入参数更新**；未完成的暂停轨迹赋予高优先级排入下一轮继续生成。
   - 跨多轮续写带来的策略陈旧性（Multi-iteration Staleness）通过继承自 `K2.5` 的**局部逐 token 对数比裁剪与二次惩罚正则**平滑消化，兼顾硬件吞吐与收敛稳定性。
2. **推理预算退火课程（$\tau \cdot b_0(x)$ Annealing Curriculum）**：
   - 用冷启动模型在每道题 $x$ 上预估题目级基准 token 预算 $b_0(x)$；定义轨迹消耗 $T(y)$（通用推理题计 `<think>` token 数；Agent 任务计**累计模型输出 + 全部工具调用参数 token 总和**）。
   - **硬预算覆写规则**：一旦 $T(y) > \tau \cdot b_0(x)$，无论任务最终做对与否，**强制将该轨迹奖励覆写为 `-1`**！
   - **三阶段退火路径**：先用大松弛系数 $\tau$ 训出充分探索上限的 `max` 专家，再逐步退火收紧 $\tau$ 依次训出高性价比的 `high` 与 `low` 专家，避免直接硬压长度引发能力坍缩。

### 2.3 锦标赛制 `Agentic GRM` 与冗长自动判负（Verbosity Loss Rule, §4.1.2）
针对主观设计、前端交互与复杂研究任务，构建具备环境交互工具的 **Agentic Generative Reward Model**：
- **强制四步评判协议（4-Step Protocol）**：① 亲自读取/交互检查候选产物（Artifact） $\to$ ② 动态生成针对当前任务的细粒度评分准则（Rubric） $\to$ ③ 逐项核验每个候选解 $\to$ ④ 在结构化记分板（Scorepad）落盘证据与结论。
- **锦标赛两两对决 + 冗长自动判负（Verbosity Loss Rule）**：对同一 Prompt 的多个采样解组织两两二元比较（Tournament Binary Comparisons）汇总胜率作为奖励；为根治 LLM Judge 天生的“越长越给高分（Length Bias）”，设定参考长度基准 $\ell_0$——**任何超过阈值 $\sigma \cdot \ell_0$ 的候选回复在对决中直接自动判负（Auto-Loss）**！

### 2.4 截断逐 Token 多教师在线蒸馏 `MOPD`（§4.1.3 & Eq. 15）
将 9 个专家（域 $d$、预算档 $e$）同步蒸馏进单一统一学生模型 $\pi_\theta$，把每个 token 的截断对数概率比作为即时密集奖励信号送入 RL 管道优化：
$$r_{\text{opd}}^{d}(y_t \mid e, x, y_{<t}) = \mathrm{clip}\!\left(\mathrm{sg}\!\left(\log \frac{\pi_{\text{teacher}}^{(d,e)}(y_t \mid x, y_{<t})}{\pi_\theta(y_t \mid e, x, y_{<t})}\right), \; -R_{\max}, \; R_{\max}\right)$$
- **工程实证对比（对比 DeepSeek-V4 全词表 OPD）**：Kimi 团队明确测试了 Top-$k$ Logit 蒸馏，发现在其 Partial Rollout 架构下并未显著优于上述**双边截断 $[-R_{\max}, R_{\max}]$ 逐 token OPD（Eq. 15）**；而 Eq. 15 只需教师与学生在已采样序列上计算标量 token logprob，天然兼容 **Partial Rollout 跨轮续写**与现有 RL 基建，通信与存储开销极低！

### 2.5 训推同构 `MXFP4` QAT 与 `LK` 接受率损失 MTP（§4.1.4 & Eq. 16）
- **全流程 MXFP4/MXFP8 QAT**：在 SFT 与全部 RL 阶段（含 Rollout 与训练前反向）统一采用 **MXFP4 权重 + MXFP8 激活量化感知训练**，做到**训推算子量化表示 100% 同构**，既省去训推精度对齐难题，又使 2.8T 巨型 MoE 直接以原生 MXFP4 高吞吐上线。
- **EAGLE-3 7 步展开 MTP 投机解码微调**：融合第 1、第 4 与最末 `Block AttnRes` 块特征，直接优化投机采样真实期望接受率的 **LK Loss（Eq. 16）**：
  $$\mathcal{L}_{\text{LK}} = -\log \sum_{x \in V} \min\!\big(p_{\text{target}}(x), \, q_{\text{draft}}(x)\big)$$
  相比常规交叉熵蒸馏显著提升了线上多步投机接受长度。

### 2.6 白盒多脚手架泛化、双验证器 `AET` 与 Web/3D/WebGL RL（§4.2 & Table 4）
1. **统一白盒模块化多脚手架环境（§4.2.1）**：
   - 若仅在单一 Agent Harness（如固定自家 CLI）上做 RL，模型会严重过拟合特定工具命名与提示模板。Kimi K3 在训练期按任务组动态拼装切换 **`Kimi Code`、`Claude Code`、`Codex`、`OpenClaw`、`Hermes` 以及随机自定义工具组合**，迫使模型习得跨脚手架通用的底层工程能力。
2. **自主执行任务 `AET`：公开诊断验证器 + 隐藏保留验证器（§4.2.6）**：
   - 在复杂黑盒系统复现（文中点名举例：**复现一个 3D 相机标定/修复 Web 应用系统**）中，环境同时配备两套验证器：
     - **Public Diagnostic Verifier**：允许 Agent 在沙盒内有限次主动调用以获取报错反馈并自修（超出提交次数即扣分，防止暴力枚举探测）；
     - **Hidden Held-out Verifier**：仅在轨迹结束结算最终 RL 奖励时运行，彻底封死针对公开测试用例硬编码过拟合（Test-Case Overfitting / Hacking）的后门！
3. **§4.2.7 Web / 3D / WebGL / Shader / SVG 专项 RL 与 `Table 4` 压倒性盲评数据**：
   - **训练覆盖与双重防作弊奖励**：覆盖现代响应式网站、交互游戏、**3D / WebGL / Shader 复杂场景**、数据可视化、SVG 与全栈应用。奖励由两部分严格门控组合：
     - **确定性程序核验**：检查构建状态、控制台运行异常、DOM/布局结构与像素级相似度；**铁律：只要构建失败（Build Failure）、运行时抛出错误（Runtime Error），或检测到用静态假数据/空壳 Mock 伪装代替真实功能实现（Fakes rather than implements），整条轨迹奖励立即归零（`Reward = 0`）！**
     - **交互式代码+渲染产物联合 Judge**：内部评判模型同时审查源代码实现质量，并在真实浏览器中与渲染出的 3D/Web 产物交互打分。
   - **`Table 4`（`Kimi Webdev Bench`，在完全相同的 `Claude Code` 脚手架下对阵 `Claude Opus 4.8 max` 人类专家双盲评测）**：

| 细分赛道（均在 `Claude Code` 下盲评） | Kimi K3 胜率 (Win) | 平局 (Tie) | 负率 (Lose) | **净胜率 (Net Win)** |
| :--- | :---: | :---: | :---: | :---: |
| **Overall（全赛道总计）** | **58.6%** | 13.8% | 27.6% | **`+31.0%`** |
| **`3D / WebGL / Shader`（三维与着色器）** | **72.7%** | 13.7% | 13.6% | **`+59.1%`** |
| **Website / UI Clone（网页与 UI 复刻）** | **52.6%** | 21.1% | 26.3% | **`+26.3%`** |
| **Interactive Games（交互式游戏）** | **55.6%** | 3.7% | 40.7% | **`+14.9%`** |

   - 同时在公开权威盲测榜 **LMArena WebDev Arena 登顶全球 #1 / 99（Elo `1,678`）**，超越 `Claude Fable 5`（`1,634`）与 `GPT-5.6 Sol`（`1,630`）！

---

## 3. 5,121 万沙盒生产级基建 `AgentENV`、1M 共置 RL 与 `XTML`（§5.2–§5.3, Appendix E–F）

### 3.1 `MoonEP` 静态形状无同步通信（§5.2.1 & Appendix E）
- Appendix E 给出严格数学证明（Theorem 1 & 2）：在 $E$ 个专家分布于 $R$ 个 EP Rank 时，**每个 Rank 最多只需预留 $E/R$ 个冗余专家槽位**，即可在任意不均衡路由分布下 **100% 保证所有 EP Rank 精确接收完全相等的 $S \times K$ 个 token**！由此实现全静态张量 Shape、免 CPU-GPU 同步启动与零拷贝 Permute（已开源：`https://github.com/MoonshotAI/MoonEP`）。

### 3.2 1M 上下文训推共置显存榨取三件套（§5.3.1）
1. **CPU DRAM 写回式外部 KV Cache 池（External KV Cache Pool）**：统一按块对齐管理 `KDA` 循环状态与 `MLA` 稀疏/淘汰 KV 块并卸载至主机内存，Rollout 期间将训练权重与优化器状态彻底卸载至 NVMe SSD；
2. **Rollout 自适应节流调度器（Auto-Throttling Scheduler）**：根据实时 KV 池水位动态准入新并发请求，杜绝百万上下文尾部长轨迹挤爆显存；
3. **VPP FP32 梯度缓冲区零开销复用（Gradient-Buffer Reuse）**：在计算 Reference Model 对数概率时，此时尚未产生反向梯度——系统直接将驻留 CPU 的参考模型权重分块流式拉入 **Virtual Pipeline Parallelism 的 2 个空闲 FP32 梯度缓冲槽**完成前向，实现 **Reference Model 零额外 GPU 显存占用**！

### 3.3 `AgentENV`：为什么必须从容器转向 Firecracker microVM？（§5.3.2）
在累计创建 **51,219,741 个沙盒实例、横跨 1,505,678 个环境镜像**（开源地址：`https://github.com/kvcache-ai/AgentENV`）的超大规模生产实战中，Kimi 披露了关键血泪教训与三大原语：
- **容器崩溃惨案**：早期基于共享宿主机内核的 Docker 容器沙盒，在大规模 RL 策略激进探索（极端系统调用、挂载操作、进程炸弹、内核模块边界触发）下**频繁引发宿主机 Kernel Panic 与内核死锁**，且无法安全允许 Agent 在沙盒内自行挂载磁盘或嵌套运行 Docker/VM。切换至 **Firecracker microVM** 后彻底实现硬件虚拟化隔离。
- **亚秒级启动与高密超卖**：结合 `OverlayBD` 按需块加载 + 自研 `ublk` 用户态块驱动 + 集群 P2P 镜像分发实现亚秒级冷启动；基于增量脏页追踪实现 **`133 ms` Checkpoint / `49 ms` Resume** 与 **`6.5×` 内存超卖比**。
- **三大 RL 生命周期核心原语**：
  1. **`Pause / Resume`（消灭 `98%` 空等浪费）**：统计发现，在长程多轮 Agentic RL（尤其是百万上下文大模型推理）中，**沙盒高达 `98%` 的生命周期都在空等远端 LLM 生成下一步动作**！`AgentENV` 在每次环境返回 Observation 后立即 `Pause` 挂起 microVM（占 **0 CPU、0 活跃内存**），收到下一步 Tool Call 时在 `49 ms` 内无缝 `Resume`，使单台物理机有效并发密度暴涨数十倍！
  2. **`Fork`（零副作用判分）**：在轨迹中间步或终点触发测试/视觉验证脚本时，直接 `Fork` 克隆出一份完全一致的运行态副本去跑判分脚本（即使判分脚本修改文件系统、污染数据库或杀进程，也**对原主干沙盒零副作用**），直接赋能过程奖励与树搜索！
  3. **`Snapshot`**：支持跨轮 Partial Rollout 持久化与任意状态回溯重放。

### 3.4 Appendix F：`XTML` 结构化对话与工具模板细节
- 彻底弃用易与 HTML/XML 代码正文冲突的 `< >` 尖括号，改用专用词元 `[open]`、`[sep]`、`[close]`、`[end_of_msg]` 构造树形协议。
- **KV Cache 友好的三类系统选项布局**：
  - `global option messages`（含 `tool-declare` 与自然语言描述的 `thinking-effort` 约束）置于对话最前；
  - `one-shot option messages`（单轮临时 `tool_choice` 或 `response_format`）**置于全部历史消息之后、当前轮生成之前**，从而避免单轮格式切换使整段长历史 KV Cache 失效！
  - `input option messages` 支持在会话中途动态按需挂载新 MCP 工具而不重刷前缀。
- **原生免转义代码参数与全程保留思考**：工具参数声明 `type="string"` 时直接承载原始未转义多行源码（纯 JSON 兜底回退分支在训练时做 Loss Mask，防止模型学歪）；在思考模式下**仅采用 Preserved Thinking（跨全部轮次保留 `think` 通道，即使某轮为空也保留结构槽位）**。

---

## 4. 对本项目的工程映射（`Qwen3.8-27B` 三轨 Visual Coding & CAD Agent）

1. **`Kimi K3` §4.2.7 与 `Table 4`（3D/WebGL `+59.1%` 净胜 Opus 4.8）直接验证了我们三轨技术路线的巨大弹性**：
   - 只要严格落实 **“编译/控制台报错/假实现直接 `Reward=0` 硬门控 + 源码结构审查 + 真实无头浏览器渲染交互视觉 Judge”**，开源权重模型在 `3D / WebGL / Shader` 赛道不仅能追平闭源模型，反而是胜率拉开最悬殊（`72.7% vs 13.6%`）的高杠杆突破口！
2. **在三轨验证器中立即引入 `AET`“公开诊断验证 + 隐藏保留验证”双层架构**：
   - `Track 1 (Three.js)` / `Track 2 (2D)` / `Track 3 (CadQuery)` 若把全部评分规则（固定采样时间戳 `t=0, 0.5, 1.0`、固定相机视角、固定 CAD 探针坐标）完全暴露给训练期自检工具，RL 必然学会只在采样帧/采样视角画图。应将自检工具作为 **Public Diagnostic Verifier**（带调用次数软上限），而在 RL 结算端使用**随机扰动时间戳 `renderAt(t + δ)`、隐藏环绕机位截图与未公开几何截面/干涉断言**作为 **Hidden Verifier**。
3. **沙盒资源瓶颈解法（`Pause/Resume` + `Fork` 思想）与 `Claude Code` 跨脚手架泛化**：
   - 在 `2×8 H800` 跑 Headless Chromium + WebGL/SwiftShader 与 CadQuery OCC 内核时，切忌为每条活跃轨迹常驻持有浏览器上下文空等 LLM 解码；应在工具调用间隙释放/池化浏览器页面上下文（对应 `98%` 空等回收），并在判分时用临时只读副本目录执行测试（对应无副作用 `Fork`）。
   - 同时保留对 `Claude Code` 标准工具链与简化轻量 Harness 的混合适配，防止过拟合单一系统提示。
