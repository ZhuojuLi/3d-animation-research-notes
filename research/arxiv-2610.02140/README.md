# 论文精读：Finetuning with Sampling: SFT Learns Better Than You Think（arXiv:2610.02140）

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*Finetuning with Sampling: SFT Learns Better Than You Think*
- **作者**：Aayush Karan, Sitan Chen, Yilun Du（Harvard University）
- **发布时间**：2026-10-01
- **原文**：`https://arxiv.org/html/2610.02140` · 本地原件：[paper.html（上游原文）](https://arxiv.org/abs/2610.02140) · 纯文本：[paper.txt（上游原文）](https://arxiv.org/abs/2610.02140)
- **整理日期**：2026-11-25

---

## 1. 一句话核心结论

这篇论文挑战了后训练界的流行共识（“RL 泛化强、不遗忘，SFT 爱死记、易灾难性遗忘”），指出 **SFT 吃亏的根源不是交叉熵目标函数本身，而是专家数据的 off-policy 分布偏移**。作者完全不改 SFT 损失函数，而是提出在训练前用基于 MCMC 的 **Projection Sampling（投影采样）**，把 off-policy 专家轨迹逐步改写成**保持任务等价性、但 KL 距离最贴近学生基座分布 $p$** 的“类 on-policy”样本；再做标准 SFT，就能在化学、数学、开放医疗任务上**追平甚至大幅反超 GRPO / UFT / OPSD，同时几乎不发生灾难性遗忘**。

---

## 2. 动机与理论框架（Section 1 & Section 4.1–4.2）

### 2.1 SFT 与 RL 各自的结构性短板
- **RL（如 GRPO）**：因为是 **on-policy** 采样，更新贴近基座模型 $p$（KL 小，对应 *RL's Razor* Shenfeld et al., 2025），所以泛化好、遗忘少；但致命伤是**遇难题零信号**——当基座模型反复采样都做不对时，组内奖励方差为 0，根本学不到新能力。
- **标准 SFT**：可以直接吃进包含特权信息的 off-policy 专家轨迹 $\tau \sim q$（能教全新能力），但任意专家策略 $q$ 往往远离学生分布 $p$，导致大梯度冲击、过拟合与严重遗忘。
- **主流桥接路线 vs 本文路线**：
  - 既有工作都在**改训练目标**（如 DFT `2508.05629` 做重要性加权、Anchored SFT `2509.23753` 加 KL 惩罚、OPSD `2601.19897` 做在策略自蒸馏、UFT/POPE 把专家解塞进 RL rollout）；
  - **本文反其道而行之：不动 SFT 训练目标，而是在训练前“重塑数据分布”来迁就学生模型**。

### 2.2 信息投影（Information Projection）与单调减 KL 保证
给定问题 $\mathbf{q}$ 与专家轨迹 $\tau$，令 $\mathcal{C}$ 为与 $\tau$ 语义等价/任务正确的全部轨迹集合，$\mathcal{P}_{\mathcal{C}}$ 为支集全落在 $\mathcal{C}$ 上的策略空间。要找到**既保留专家信息、又离学生基座 $p$ 最近**的目标数据分布，即 Csiszár 信息投影：
$$p_{\mathcal{C}} := \arg\min_{\pi \in \mathcal{P}_{\mathcal{C}}} \mathrm{KL}(\pi \| p) \quad \Longrightarrow \quad p_{\mathcal{C}}(\mathbf{x}) = \frac{p(\mathbf{x})\cdot \mathbf{1}(\mathbf{x}\in\mathcal{C})}{\sum_{\mathbf{x}'\in\mathcal{C}} p(\mathbf{x}')}$$

- 若基座自己就能高频采出 $\mathcal{C}$ 中的解，直接拒绝采样就是 $p_{\mathcal{C}}$；但面对难题拒绝采样不可行。
- **核心解法（Proposition 2 & 3）**：以专家轨迹 $\tau$ 为起点，用**保信息提议分布（information-preserving proposal）** $\kappa_{\mathcal{C}}(\mathbf{x}'|\mathbf{x},\tau)$ 跑 Metropolis-Hastings（MH）MCMC，以 $p$ 为目标接受/拒绝，即可等价采样自 $p_{\mathcal{C}}$，且由数据处理不等式严格保证每一步 MCMC 都**单调缩小数据分布与基座的 KL 散度**：
  $$\mathrm{KL}(\pi_{k+1} \| p) \le \mathrm{KL}(\pi_k \| p).$$

---

## 3. 算法实现细节与关键工程近似（Section 4.3 & Appendix C）

### 3.1 Algorithm 1：分块自回归投影采样（Projection Sampling）
为避免整条长序列从头 MCMC 混合过慢，作者沿用 Karan & Du (2025) *Power Sampling* 的分块渐进框架：
1. 将总长 $T$ 按块划分（论文设置最大长度 $T=1856$，实验文字写 `block number B=32`、算法伪码称 `block size B`，每块跑 $N_{\mathrm{MCMC}}=10$ 步）。
2. 第 $k$ 阶段给定前缀 $x_{0:kB}$，先用提议分布 $\kappa_{\mathcal{C}}(\cdot \mid x_{<t}, \tau)$ 向前续写 1 块作为初始化 $\mathbf{x}^0$。
3. **保信息提议 $\kappa_{\mathcal{C}}$ 的极简实现（Appendix C.3）**：直接用**学生基座模型 $p$ 自己**，把 `<PROBLEM>` + `<SOLUTION>`（完整专家轨迹 $\tau$）+ `<RESPONSE>`（当前截断前缀）放进 prompt，要求它*“用自己的话接着写完，且确保最终答案与参考解一致”*。
4. 块内循环 $N_{\mathrm{MCMC}}$ 步：
   - 均匀随机挑一个切分位置 $m \in \{1, \dots, (k+1)B\}$，保留前缀 $x_{0:m-1}$，用 $\kappa_{\mathcal{C}}$ 重采后缀 $m \dots (k+1)B$ 得到候选 $\mathbf{x}'$；
   - **理论接受率（Eq. 5）**：$A(\mathbf{x}', \mathbf{x}) = \min\left\{1,\; \frac{p(\mathbf{x}')}{p(\mathbf{x})} \cdot \frac{\kappa_{\mathcal{C}}(\mathbf{x}\mid \mathbf{x}', \tau)}{\kappa_{\mathcal{C}}(\mathbf{x}'\mid \mathbf{x}, \tau)}\right\}$（注意分子分母的 $p(\mathbf{x}')/p(\mathbf{x})$ 是**去掉参考答案 $\tau$ 之后**纯学生基座的无条件打分！）；
   - **重要工程近似（Appendix C.2）**：严格算反向提议概率 $\kappa_{\mathcal{C}}(\mathbf{x}\mid \mathbf{x}',\tau)$ 需额外一次前向；论文实际直接用**贪心似然替换**——**只要候选在基座下的似然更高（$p(\mathbf{x}') > p(\mathbf{x})$）就直接接受替换**！作者指出这会更激进地推向基座高似然区，而 Figure 5 实测依然能单调拉低 KL 散度。

### 3.2 信息保留率与一次性算力开销（Appendix C.1 & Eq. 9）
- **正确性保留率（Appendix C.1）**：经过 $k=10$ 步投影采样后，改写数据集的正确率依然保持在 **93.94%–95.86%**（Chemistry Qwen `94.33%` / Olmo `93.94%`、Math `95.33%`、Medical `95.86%`）。
- **算力开销公式（Eq. 9）**：属于训练前一次性成本，但随序列长度 $T$ 呈**二次方增长**：
  $$\mathbb{E}_{\mathrm{cost}} \approx |\mathcal{D}| \cdot \frac{N_{\mathrm{MCMC}} \cdot T^2}{4B}$$

---

## 4. 核心实验结果与关键消融（Section 5 & Appendix B）

基座模型：`Qwen2.5-7B-Instruct`、`Olmo-3-7B-Instruct`、`Qwen2.5-3B`；全部 SFT 统一网格搜 `epoch ∈ {1,2}`（Medical 到 6）、`lr ∈ {5e-5, 1e-5, 5e-6}`、`bs ∈ {16,32,64}`、`grad_clip=1.0`。对比基线包括：`Vanilla SFT`、`Rewrite SFT`（即 $k=0$ 零步学生单次改写）、`OPSD`（在策略自蒸馏）、`GRPO`、`UFT`（特权信息引导 RL）。

### 4.1 主结果汇总（Table 1 & Table 2）

| 任务 / 基座模型 | 方法 | 新任务精度 | 原有能力保留均分（Prior Avg） | 关键观察 |
|---|---|---:|---:|---|
| **Chemistry**（SciKnowEval L-3, 1.8K 训, GPT-5 轨迹）<br>`Qwen2.5-7B-Instruct` | Base | 34.3% | 59.7% | MMLU 68.7%, GSM8K 91.8% |
| | Vanilla SFT | 61.8% | 52.0% (**-7.7pp**) | 明显灾难性遗忘（MMLU 跌 10.1pp） |
| | Rewrite SFT ($k=0$) | 61.3% | 55.8% (-3.9pp) | 单次改写就能救回一半遗忘，但新任务略逊 |
| | OPSD (on-policy) | 61.8% | 56.8% (-2.9pp) | 在策略自蒸馏基线 |
| | **Sampling SFT ($k=10$)** | **66.0%** | **58.6%** (**-1.1pp**) | **新任务反超 SFT/OPSD +4.2pp，遗忘最少（MMLU 69.2% 不降反升）** |
| **Math**（MATH L3–5, 8.2K 训）<br>`Qwen2.5-3B` | Base | MATH 31.5% / Avg 31.8% | 42.2% | MATH500 24.5%, GSM8K 57.9% |
| | Vanilla SFT | MATH 24.3% / Avg 24.2% | 38.9% (-3.3pp) | **全面倒退**（弱基座直接吃 off-policy 轨迹崩溃） |
| | OPSD | MATH 26.7% / Avg 30.2% | 40.4% | 弱于 RL |
| | GRPO (on-policy RL) | MATH 45.7% / Avg 45.7% | 41.4% | MATH500 31.3%, GSM8K 80.8% |
| | UFT (特权 RL) | MATH 47.0% / Avg 45.2% | 42.1% | MATH500 29.7%, GSM8K 74.6% |
| | **Sampling SFT ($k=10$)** | MATH **49.5%** / Avg **53.4%** | **42.0%** (-0.2pp) | **MATH500 暴涨至 58.2%（超 RL +26.9pp），几乎零遗忘** |
| | **Sampling SFT + RL (GRPO)** | MATH **54.5%** / Avg **56.7%** | **43.0%** (**+0.8pp**) | **做 RL 冷启动冲到全场最高（MATH500 65.2%, GSM8K 83.0%）** |
| **Medical**（开放问答, HuatuoGPT-o1 19.7K 训）<br>`Qwen2.5-7B-Instruct` | Base | 35.3% | 59.7% | GSM8K 91.8% |
| | Vanilla SFT | 44.8% | 35.3% (**-24.4pp**) | 灾难性遗忘（GSM8K 从 91.8% 血崩至 36.4%） |
| | Rewrite SFT ($k=0$) | 45.7% | 51.2% (-8.5pp) | **仅单次改写即恢复 +15.9pp 保留率，性价比惊人** |
| | OPSD | **46.6%** | 50.1% (-9.6pp) | 新任务略高，保留略弱 |
| | **Sampling SFT ($k=10$)** | 45.8% | **51.6%** (-8.1pp) | 恢复 +16.3pp 保留率，所有方法遗忘最少 |
| **Chemistry**（跨家族验证）<br>`Olmo-3-7B-Instruct` | Base / SFT / Rewrite / OPSD / **Ours** | 32.8% / 56.7% / 56.3% / **59.7%** / 58.3% | 60.1% / 59.0% / 60.4% / 60.0% / **61.7%** | 遗忘控制第一（原有能力反升 +1.6pp），新任务略低于 OPSD |

### 4.2 四项深层诊断结论（Section 5.3 & Appendix B）
1. **必须针对目标学生模型“定制投影”，不可跨模型复用（Appendix B 关键反面实验！）**：
   - 把针对 `Olmo-3-7B` 投影好的 Chemistry 数据拿来训 `Qwen2.5-7B-Instruct`，精度暴跌至 **`57.33%`**，竟然比原始 GPT-5 数据的 `Vanilla SFT`（`61.8%`）还差 **4.5 个百分点**！
   - 把 50% 投影数据 + 50% 原始数据混合，精度落在 `62.14%`（线性插值在 `61.8%` 与 `66.0%` 之间）。
   - **推论**：所谓“好数据”不是绝对的，而是**相对于目标学生模型似然分布的几何距离**。
2. **不是单纯“锐化”原有分布，而是真正学会了新能力（Figure 4, Pass@k）**：
   - 在 `Olmo-3-7B` Chemistry 上，哪怕 $k$ 拉到很大，Sampling SFT 的 Pass@k 曲线依然严格高于 Base 和 OPSD；部分 Base Pass@k 为 **0%** 的难题，训后通过率跃升至 **53.1%–67.2%**。
3. **采样步数是平滑可控的算力缩放轴（Figure 5, $k \in \{0,2,4,6,8,10\}$）**：
   - 随着 $k$ 增大，投影数据集相对基座的 $\mathrm{KL}(\pi_k \| \pi_{\mathrm{base}})$ **单调下降**，下游 SFT 精度同步**单调上升**。
4. **也是极强的 RL 冷启动器**：Table 1 Math 显示 `Sampling SFT → GRPO` 叠加出全场最强结果（Avg `56.7%` vs 纯 RL `45.7%`），说明“先把数据拉成 on-policy 训好 SFT，再接 RL”远胜直接纯 RL 或脏 SFT 冷启动。

---

## 5. 客观局限与对 3D Animation Agent 的落地评估

### 5.1 为什么论文原版 `Algorithm 1` 不能直接照搬到我们的 65K 多轮视觉 ReAct？
1. **长度二次方成本爆炸（Eq. 9：$O(N_{\mathrm{MCMC}} T^2 / 4B)$）**：论文实验仅在 **$T \le 1856$ 的单轮纯文本问答**上验证。我们的离线 One-Shot 为 **22K–32K tok**、多轮 ReAct 为 **59K–102K tok**（长 15–55×），原版逐块 MCMC 的算力开销会放大 **200×–3,000×**，且需 GPU 跑 27B 反复重采。
2. **长代码与多轮工具环境无法承受“随机 token 截断重采”**：自然语言题换个说法仍保持 ~95% 等价；但 30KB Three.js 代码和跨轮工具轨迹里，随机切分 token 重采会破坏语法/变量作用域，且多轮环境返回（浏览器截图、DOM 状态）绑定在真实执行动作上，无法在不重跑沙盒的前提下任意改写中间动作。
3. **单次改写（$k=0$）已吃掉大部分抗遗忘红利**：注意在开放长生成的 Medical 任务上，**零步 `Rewrite SFT`（$k=0$）就已经恢复了 15.9/16.3pp 遗忘且新任务几乎持平（45.7% vs 45.8%）**——这提示在长文本/代码场景，不必迷信昂贵的 $k=10$ token 级 MCMC。

### 5.2 对我们 3D Agent（DeepSeek `1017` → Qwen3.8-27B Dense）的 4 条高价值落地启发

| 落地层次 | 具体做法 | 解决什么痛点 / 成本 | 建议时机 |
|---|---|---|---|
| **① 免费分布诊断（直接复刻 Fig. 3）** | 在 Round 2 训练前，用 **Qwen3.8-27B Base** 对 DeepSeek `1017` 产出的 ReAct / One-Shot 样本（以及 CoT 提纯前后）跑一次前向算均 token NLL / log-likelihood 分布 | 量化“跨家族教师 DeepSeek → 学生 27B”的 off-policy 鸿沟；提前揪出 NLL 极高的“梯度炸弹”样本，也能验证我们的 `prune_*_cot.py` 是在拉近还是拉远 27B 分布（**只需 1 次前向，成本极低**） | **Round 2 开训前即可做** |
| **② 学生原生 CoT 重写 + 似然优选（针对 `<think>` 段的轻量 Projection Sampling）** | 保持 DeepSeek 产出的可执行 Three.js 代码与工具调用 **100% 逐字节不动**（保住沙盒一致性和审美上限），但把 `<think>` 压缩/提纯环节从“请 DeepSeek 压缩”改为：**让 27B Base 自己看着“题目 + 对应动作/代码”用自己的语言重写出 $M=4\sim8$ 条精简 `<think>`，挑 27B 无参考似然 $p(\text{think})$ 最高且无泄露的一条** | 把最占 token、跨家族风格差异最大、最易导致遗忘与 EOS 异常的 `<think>` 段直接投影到 27B 自身分布；**复杂度 $O(T)$ 而非 $O(T^2)$**，零破坏代码/工具合法性 | **Round 2.5 / Round 3 对照消融**（对比当前 DeepSeek 压缩 CoT） |
| **③ One-Shot 可执行版单步 Projection Sampling** | 对池 2 离线 One-Shot（单轮、无多轮状态耦合）：让 27B 参考 DeepSeek 高审美成品/架构摘要，用自己的编码习惯重写 $M$ 份候选 → 过离线 `esbuild` + `check_browser.mjs` 硬检（精确实现 $\mathbf{1}(\mathbf{x}\in\mathcal{C})$）→ 挑通过硬检且 **27B 无参考似然 $p(\mathbf{x})$ 最高** 的那条入训 | 直接把高审美 One-Shot 从 off-policy DeepSeek 代码风格转成 27B 原生可吸收的高似然代码，大幅降低 27B 遗忘并提升单轮泛化 | **Round 2 放量验证若发现跨家族风格拟合吃力时启用** |
| **④ 强化“先干净 SFT 冷启动 → 再接在线纠偏/RL”路线** | 论文 Table 1 Math 证明 `Sampling SFT + RL` 比纯 RL 高 +11pp 且原有能力不降反升 | 与 `DAgger (2605.12913)` 的 $\beta_1=1.0$ 结论完全共振：先把 Round 2 27B SFT 做稳（且尽量贴近 27B 自身分布），Round 3 再接 AggreVaTe / RL 收益最大 | **贯穿 Round 2 → Round 3** |
