# 论文精读：Group-in-Group Policy Optimization for LLM Agent Training（GiGPO，arXiv:2505.10978v3）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*Group-in-Group Policy Optimization for LLM Agent Training*
- **作者**：Lang Feng, Zhenghai Xue, Tingcong Liu, Bo An（NTU & Skywork AI）
- **原文**：`https://arxiv.org/html/2505.10978v3` · 本地原件：[paper.html（上游原文）](https://arxiv.org/abs/2505.10978) · 纯文本：[paper.txt（上游原文）](https://arxiv.org/abs/2505.10978) · 元数据与校验：`sources.json`（本地校验清单未发布）
- **整理日期**：2026-11-27 · 关联总报告：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与动机

单轮数学推理用 GRPO 只需比较 $N$ 条完整回答的终态得分；但在多步环境交互 Agent 中，不同轨迹在中间轮次经常遇到**相同或高度相似的环境状态**（例如：开局同一初始工作区、同一类编译报错、同一阶段自检状态），随后分叉出不同的修复/构建动作。
- 标准 GRPO 忽略了这种中间分叉结构，无法回答“面对同一个报错状态，动作 A（先读日志精准改行）为什么比动作 B（盲目重写整文件）更好”；
- 传统 PPO / Step-PRM 则需要额外训练同尺寸 Critic 或昂贵的在线步骤裁判，显存与采样成本翻倍。

作者提出 **GiGPO（Group-in-Group Policy Optimization）**：**零 Critic、零额外环境 rollout、计算开销 `<0.002%`**，仅靠事后对同组轨迹中的重复/相似中间状态做哈希/相似度归组，即可同时获得轨迹级宏观优势与步骤级微观优势。

---

## 2. 核心算法：双层组内相对优势（Episode + Step Anchor Grouping）

对同一任务采样的 $N$ 条完整多步轨迹 $\{\tau_i\}_{i=1}^N$：

1. **外层：轨迹级宏观优势（Episode-Level Advantage，$A^E$）**：
   与常规组方法一致，利用整条轨迹累计/终态回报 $R(\tau_i)$ 计算组内相对优势：
   $$A^E(\tau_i) = \frac{R(\tau_i) - \mathrm{mean}(\{R(\tau_j)\}_{j=1}^N)}{F_{\mathrm{norm}}(\{R(\tau_j)\}_{j=1}^N)}$$
   - **重要数值稳定性发现**：作者指出当题目极难或极易（如 8 条里只有 1 条过门禁，标准差极小）时，$F_{\mathrm{norm}} = \mathrm{std}$ 会把单条噪声放大成极端梯度尖峰；采用 **$F_{\mathrm{norm}} = 1$（Leave-One-Out / 纯均值中心化，即 Dr.GRPO 口径）** 在稀疏高难任务上更稳健！

2. **内层：锚点状态归组与步骤级微观优势（Step-Level Anchor Grouping，$A^S$）**：
   - 在 $N$ 条已采完的轨迹池中，离线扫描环境观测状态 $s_t^{(i)}$，将完全相同或文本相似度 $>0.9$ 的状态聚类进同一个**锚点状态组（Anchor State Group）** $U(\tilde{s})$（只要组内包含 $\ge 2$ 个来自动作分叉的样本）。
   - 对锚点组内每个动作 $a$，统计其从该步往后的折扣累计回报 $R_{\mathrm{step}}(a) = \sum_{k=t}^T \gamma^{k-t} r_k$，并在**锚点子组内部**做相对中心化得到 $A^S(a_t^{(i)})$。

3. **双层合成优势**：
   $$A(a_t^{(i)}) = A^E(\tau_i) + \omega \, A^S(a_t^{(i)}), \qquad (\text{默认 }\omega = 1.0)$$

---

## 3. 实验设置与核心结果

- **模型**：`Qwen2.5-1.5B / 3B / 7B-Instruct`，组大小 $N=8$。
- **评测集**：多步具身交互 `ALFWorld`、多步网页交互 `WebShop`、多步工具检索问答（Search-R1 设置）。

### 核心实证数字（`Qwen2.5-7B-Instruct`）
- **`ALFWorld` 成功率较 GRPO 提升 `+12.6%`**；
- **`WebShop` 较 GRPO 提升 `+9.1%`**；
- 多步工具检索 QA 达 `47.2%`（3B 达 `42.1%`），全面领先 GRPO 与 RLOO；
- **资源开销**：显存与标准 GRPO **100% 相同**，不增加任何一次 LLM 生成或沙盒步，哈希归组 CPU 耗时仅占训练总时长的 **`< 0.002%`**。

---

## 4. 局限性与对三轨 27B Agent 的启发

### 局限性（事实与迁移边界）
- 在自由编写几百行 Three.js / CadQuery 代码的后期轮次，8 条轨迹的代码内容各不相同，精确状态匹配率会下降（不像 ALFWorld 房间状态那样高频精确重逢）。
- 但**前 1–3 轮（初始工程脚手架规划）**以及**按沙盒诊断签名抽象后的状态（Abstract Diagnostic State）**具有极高重合度！

### 对我们项目的直接价值
1. **用“沙盒结构化诊断签名”定义 3D/2D/CAD 锚点状态**：在我们的工程沙盒里，不必对几千行源码做字面匹配，而是把每轮状态映射为确定性诊断元组 `(phase, build_ok, error_category, hard_gate_level)`（例如 `("post_first_build", False, "WebGLShaderError", L0)` 或 `("post_inspect", True, "BooleanCollision>0", L1)`）。同一题 $G=8$ 条轨迹遇到同类报错时，哪种修复动作能更快跃迁到 $L_3$，直接由 `GiGPO` 锚点子组给出零成本步骤信用！
2. **高难稀疏题优先用 $F_{\mathrm{norm}}=1$（去标准差除数）**：避免 `8 过 1` 时除极小 $\mathrm{std}$ 炸毁 27B 权重。
