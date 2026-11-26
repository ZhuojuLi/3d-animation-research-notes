# 论文精读：Group Sequence Policy Optimization（GSPO，arXiv:2507.18071v2）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*Group Sequence Policy Optimization*
- **作者**：Chujie Zheng, Shixuan Liu, Mingze Li, ..., An Yang, Jingren Zhou, Junyang Lin（Qwen Team, Alibaba Inc.）
- **原文**：`https://arxiv.org/html/2507.18071v2` · 本地原件：[paper.html（上游原文）](https://arxiv.org/abs/2507.18071) · 纯文本：[paper.txt（上游原文）](https://arxiv.org/abs/2507.18071) · 元数据与校验：`sources.json`（本地校验清单未发布）
- **整理日期**：2026-11-27 · 关联总报告：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与动机

作为 Qwen3 系列官方主力强化学习算法，GSPO 直接诊断了为什么标准 **GRPO 在超长序列与大规模 RL 训练中频繁发生不可逆崩溃（Irreversible Model Collapse）**：
1. **重要性采样的粒度错位**：奖励是给整条序列（或整个轮次）打的，但 GRPO 却在**单个 token 级别**计算重要性比率 $w_{i,t}(\theta) = \frac{\pi_\theta(y_{i,t}\mid x,y_{i,<t})}{\pi_{\theta_{\text{old}}}(y_{i,t}\mid x,y_{i,<t})}$。单步只有一个采样点 $y_{i,t}$，根本无法做低方差分布修正，反而引入随序列长度 $|y_i|$ 累积的高方差乘性噪声（在 40K–384K 多轮代码轨迹上尤为致命！）。
2. **训推引擎浮点精度失配（Training–Inference Engine Mismatch）**：在线 RL 用 `vLLM / SGLang` 采样，用 `Megatron-LM / DeepSpeed` 算梯度；两者算子微小的 BF16/FP8 误差在 token 级比值上会被局部极端 token 放大，迫使传统框架在训练侧重算一遍 $\pi_{\theta_{\text{old}}}$。

---

## 2. 核心公式：GSPO 与支持多轮细粒度归因的 GSPO-token

### 2.1 序列级长度归一化重要性比（GSPO，Eq. 5–8）
将重要性比率定义为序列似然比的几何平均（即对数似然比的算术平均指数）：
$$s_i(\theta) = \left(\frac{\pi_\theta(y_i \mid x)}{\pi_{\theta_{\text{old}}}(y_i \mid x)}\right)^{\frac{1}{|y_i|}} = \exp\!\left(\frac{1}{|y_i|}\sum_{t=1}^{|y_i|} \log \frac{\pi_\theta(y_{i,t} \mid x, y_{i,<t})}{\pi_{\theta_{\text{old}}}(y_{i,t} \mid x, y_{i,<t})}\right)$$

目标函数为：
$$\mathcal{J}_{\mathrm{GSPO}}(\theta) = \mathbb{E}_{x,\{y_i\}_{i=1}^G}\left[\frac{1}{G}\sum_{i=1}^G \min\!\left(s_i(\theta)\hat{A}_i,\; \mathrm{clip}\big(s_i(\theta), 1-\varepsilon_{\mathrm{low}}, 1+\varepsilon_{\mathrm{high}}\big)\hat{A}_i\right)\right]$$
- **裁剪量级注意**：由于做了长度平均 $1/|y_i|$，$s_i(\theta)$ 的波动比单 token 比值小两个数量级，GSPO 采用更紧致的非对称裁剪阈值（论文典型量级 `3e-4` 左、`4e-4` 右，而非 GRPO 的 `0.2 / 0.27`）！

### 2.2 支持多轮/步骤独立优势的变体：GSPO-token（Eq. 13–14）
在多轮 Agent 场景（如结合 `GVPM` 前缀掩码、`SRaR` 轮级 Rubric 或 `RECAP` 自蒸馏优势）下，不同轮次/token 需要拥有不同的优势 $\hat{A}_{i,t}$。作者给出巧妙的 stop-gradient 构造 **GSPO-token**：
$$s_{i,t}(\theta) = \mathrm{sg}\big[s_i(\theta)\big] \cdot \frac{\pi_\theta(y_{i,t} \mid x, y_{i,<t})}{\mathrm{sg}\big[\pi_\theta(y_{i,t} \mid x, y_{i,<t})\big]}$$
$$\mathcal{J}_{\mathrm{GSPO\text{-}token}}(\theta) = \mathbb{E}\left[\frac{1}{G}\sum_{i=1}^G \frac{1}{|y_i|}\sum_{t=1}^{|y_i|} \min\!\left(s_{i,t}(\theta)\hat{A}_{i,t},\; \mathrm{clip}\big(s_i(\theta), 1-\varepsilon_{\mathrm{low}}, 1+\varepsilon_{\mathrm{high}}\big)\hat{A}_{i,t}\right)\right]$$
- **前向值**恒等于稳定的序列比 $s_i(\theta)$（整条序列或整个轮次统一判定是否触发 clip），**反向梯度方向**则精确按每个 token 的局部优势 $\hat{A}_{i,t} \nabla_\theta \log \pi_\theta(y_{i,t})$ 加权！

---

## 3. 核心实证结论

1. **训练稳定性与算力效率双赢**：在同算力预算下，GSPO 在 AIME 2024、LiveCodeBench、Codeforces 等基准上持续超越 GRPO（且完全消除了 MoE 模型 без Routing Replay 时的训练崩盘）。
2. **直接容忍 vLLM 推理引擎 Logprobs**：由于序列平均平滑了单步算子浮点抖动，GSPO 可以**直接使用推理引擎（vLLM/SGLang）采样时吐出的 $\log \pi_{\theta_{\text{old}}}$**，省去 Megatron 训练侧重算旧策略前向的开销，显著简化异步多轮沙盒 RL 基建！

---

## 4. 局限性与对三轨 27B Agent 的启发

### 局限性（事实与迁移边界）
- 若整条 20 轮轨迹共用单一 $s_i(\theta)$，某 1 轮极端偏离可能被其余 19 轮平均掉或导致整条轨迹一起被 clip；在超长多轮 Agent 中，**按“压缩段（segment）”或按“单轮 Assistant Turn”计算长度归一化比值 $s_{i,\mathrm{turn}}(\theta)$** 比整集拉通更精细。
- 裁剪超参 $\varepsilon \sim 3\times 10^{-4}$ 与 GRPO 默认的 `0.2` 相差近千倍，在 `ms-swift` / `VeRL` 配置时绝不能沿用 GRPO 默认 `clip_ratio=0.2`，否则裁剪完全失效！

### 对我们项目的直接价值
1. **同源底座（`Qwen3.8-27B`）首选策略梯度底座**：Qwen 官方已在 `ms-swift` 与 `VeRL` 生态原生支持 GSPO（且 [IterCAD](../arxiv-2606.13368/README.md) 已在 `ms-swift` 上实证 `GSPO + GVPM` 对多轮 CAD 有效）。
2. **`GSPO-token` 是拼接多源精细信号的理想粘合剂**：可在同一公式中无缝注入终态 `PhyCAD` HBA 优势 + 轮级 `SRaR` 过程偏置 + `GVPM` 掩码，同时直接复用 `gpu38` vLLM 引擎采样的旧策略 logprobs，省掉一次 27B 超长上下文重算前向。
