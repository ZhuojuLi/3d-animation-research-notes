# 论文精读：Not Every Rubric Teaches Equally: Policy-Aware Rubric Rewards for RLVR（POW3R，arXiv:2605.20164v1）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*Not Every Rubric Teaches Equally: Policy-Aware Rubric Rewards for RLVR*
- **作者**：Utkarsh Tyagi, Xingang Guo, MohammadHossein Rezaei, Daniel George, Anas Mahmoud, ..., Bing Liu, Yunzhong He（Scale AI & Persona）
- **原文**：`https://arxiv.org/html/2605.20164v1` · 本地原件：[paper.html（上游原文）](https://arxiv.org/abs/2605.20164) · 纯文本：[paper.txt（上游原文）](https://arxiv.org/abs/2605.20164) · 元数据与校验：`sources.json`（本地校验清单未发布）
- **整理日期**：2026-11-27 · 关联总报告：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心诊断：静态 Rubric 加权为何在 GRPO 中浪费一半信号？（§1 Fig. 1–2）

在开放式视觉/长文/代码生成中，每道题通常配备带类别 $\kappa_j \in \{1,\dots,K\}$ 与人类重要性权重 $w_j \in \{1,\dots,5\}$ 的多条评分准则（如我方 [XHS-TASK-AND-RUBRIC-SPEC.md](../../3d-animation-agent/docs/XHS-TASK-AND-RUBRIC-SPEC.md) 的 `R_vis / R_spec / R_func`）。作者对 `1,300` 道多模态与医学题做组采样诊断发现：
- **人类评估重要性 $\neq$ 当前策略可教学性（Learnability）**：对任一当前策略，约 **`45%–51%` 的类内静态权重压力落在零方差条目（$v_j = p_j(1-p_j) = 0$）上**——其中 **`17%–26%` 已完全饱和（全组通过 $p_j=1$）**，**`20%–33%` 完全死寂（全组 0 分 $p_j=0$）**；哪怕在最高权重档 $w_j \ge 5$ 中也有约一半条目 $v_j = 0$！
- **平局坍缩（Tie Collapse）**：零方差条目给同组 $G$ 条回复加上相同常数，在组均值中心化时完全抵消，却挤占总分权重、压扁真正有分化的混合条目（$0 < p_j < 1$），导致组标准差 $\mathrm{std}(\mathbf{R}) \to 0$（整组梯度置零浪费算力）。

**POW3R 核心思想**：**评测目标（大类均衡预算与人类权重先验 $w_j$）丝毫不变，仅在训练期按组内判别标准差动态放大类内有对比度的条目权重**，使零信号压力下降 `8–12 pp`，组内奖励区分度 $\mathrm{std}(\mathbf{R})$ 扩大 **`25%–37%`**。

---

## 2. 精确数学公式与全零/全满退化边界处理（§4 Eq. 3–8 & Appendix A.4）

设题目 $q$ 在非空大类集合 $\{k : \mathcal{C}_k(q) \neq \emptyset\}$（共 $K_q$ 类）下含准则 $(c_j, w_j, \kappa_j)$，裁判对 rollout $o_i$ 给出得分 $s_j(o_i, q) \in [0, 1]$。

### 2.1 类内标准差动态乘子与 EMA 更新（Eq. 4–8）
1. **有效裁决过滤与组内方差（Eq. 4）**：记 $\mathcal{V}_j$ 为成功返回合法 JSON 裁决的 rollout 集合，$n_j = |\mathcal{V}_j|$。**若 $n_j < \lceil 0.75 G \rceil$（如 Judge 超时/解析失败过多），该条目直接冻结保留上轮因子 $\alpha_j^{(t)}$ 不更新**；否则计算：
   $$p_j^{(t)} = \frac{1}{n_j}\sum_{i \in \mathcal{V}_j} s_j(o_i, q), \qquad v_j^{(t)} = \frac{1}{n_j}\sum_{i \in \mathcal{V}_j}\!\big(s_j(o_i, q) - p_j^{(t)}\big)^2$$
2. **以人类权重为先验的类内对比度归一化与线性混合截断（Eq. 5–6）**：
   $$g_j^{(t)} = \sqrt{v_j^{(t)} + \epsilon}, \qquad \bar{g}_k^{(t)} = \frac{\sum_{j' \in \mathcal{C}_k^{\mathrm{valid}}(q)} w_{j'} g_{j'}^{(t)}}{\sum_{j' \in \mathcal{C}_k^{\mathrm{valid}}(q)} w_{j'}}, \qquad \rho_j^{(t)} = \frac{g_j^{(t)}}{\bar{g}_{\kappa_j}^{(t)}}$$
   $$\hat{\alpha}_j^{(t)} = \mathrm{clip}\!\Big((1 - \lambda) + \lambda \rho_j^{(t)},\; \alpha_{\min},\; \alpha_{\max}\Big)$$
3. **跨轮 EMA 平滑与大类质量守恒聚合（Eq. 7–8）**：初始化 $\alpha_j^{(0)} = 1$，更新 $\alpha_j^{(t+1)} = \mathrm{clip}\big((1-\beta_{\mathrm{ema}})\alpha_j^{(t)} + \beta_{\mathrm{ema}}\hat{\alpha}_j^{(t)}, \alpha_{\min}, \alpha_{\max}\big)$，令 $\tilde{w}_j^{(t)} = w_j \alpha_j^{(t)}$，则：
   $$R_{\mathrm{dyn}}^{(t)}(o; q) = \frac{1}{K_q} \sum_{k:\, \mathcal{C}_k(q) \neq \emptyset} \frac{1}{\sum_{m \in \mathcal{C}_k(q)} \tilde{w}_m^{(t)}} \sum_{j \in \mathcal{C}_k(q)} \tilde{w}_j^{(t)} s_j(o, q)$$

### 2.2 四类关键边界条件处理（写训练代码必看！）
1. **单条目全零/全满（而同类有其他分化条目）**：此时 $v_j^{(t)} = 0 \implies g_j^{(t)} = \sqrt{\epsilon} = 10^{-2}$，因 $\lambda = 0.5$，$(1-\lambda) + \lambda\rho_j^{(t)} \approx 0.50 + 0.005/\bar{g}_k < 0.67$，被平滑托底在 **下界 $\alpha_{\min} = 0.67$**（保留非零保底权重，防止已学会的饱和项回退遗忘！）。
2. **整个大类 $\mathcal{C}_k(q)$ 全部全零或全部全满**：类中所有 $v_{j'}^{(t)} = 0 \implies g_{j'}^{(t)} \equiv \sqrt{\epsilon} \implies \rho_j^{(t)} \equiv 1 \implies \hat{\alpha}_j^{(t)} = 1.0$（若整类有效裁决数不足，代码亦显式置 $\hat{\alpha}_j^{(t)} = 1.0$），自动无损退化为静态人类加权 $R_{\mathrm{cat}}$！
3. **整道题所有大类在 $G$ 条 rollout 上总分全平局（$\mathrm{std}(\mathbf{R}) = 0$）**：GRPO 层显式令 $\hat{A}_{i,t} = 0$（§3.1），跳过该组无效梯度。
4. **负向扣分项的“正向规避转换”（Appendix A.4 Good-Behavior Conversion）**：若题库含负权惩罚项 $w_j < 0$（直接代入会导致类分母 $\sum w_j \le 0$ 爆炸），训练期执行等价非负变换：**令 $w_j' = |w_j| > 0$ 且翻转裁决 $s_j' = 1 - s_j$**（即“未触发禁忌行为得 `+1`”），评测时仍用原脚本计分。

---

## 3. Appendix C 原始单条目裁判 Prompt 与校准避坑实验（Appendix B Table 5）

```text
# [单条目独立打分裁判 Prompt (Appendix C，训练用 GPT-5.4-nano，评测用 GPT-5.4-mini，temp=1.0, max_tokens=2048)]
Does the response satisfy this rubric criterion? Evaluate ONLY this criterion.
Rules:
- "Explicit" criteria must be directly addressed. "Implicit" may be inferred.
- "Objective" = factual pass/fail. "Subjective" = quality judgment.
- Weight is context only --- does not affect your pass/fail decision.
- Minor phrasing/formatting differences are OK if substance is correct.
- OCR/text recognition criteria require exact text --- "EXIST" != "EXIT".
Rubric:
- Title: {rubric_title} | Category: {rubric_category}
- {explicit_implicit} | {objective_subjective} | Weight: {rubric_weight}
- Criteria: {rubric_rationale}
Response: {response}
Return ONLY valid JSON. "reasoning" BEFORE "criteria_met":
{"reasoning": "<one sentence>", "criteria_met": true/false}
```

- **Appendix B Table 5 两条血泪校准结论（1,000 条分层标定集对照 `GPT-5.4 high` 金标裁判 `95.4%` 人机一致率）**：
  1. **严禁省掉一句话 `"reasoning"`**：在 `GPT-5.4-nano (medium)` 上关掉 `"reasoning"`（Verdict-only 变体）虽表面一致率同为 `91.4%` 且单千次成本从 `$0.12` 降至 `$0.08`，但**直接破坏不同模型间的优劣排序相关性（Rank Break）**！
  2. **严禁按类打包单次输出 `[0,1]` 总分**：Per-category 合并调用虽便宜 $C$ 倍，但裁判会自动跳项或混同独立条目，排名相关性显著下跌。

---

## 4. Appendix D–E 超参全表、六类多模态 Rubric 与 `Qwen3-VL-8B` 基准表现

### 4.1 训练与 POW3R 超参数总表（Appendix D Table 6）

| 模块 | 参数与精确取值 |
|---|---|
| **GRPO 与优化器** | $G = 16$，`temp = 1.0`，最大生成 `3,584` tok；`AdamW`（恒定 `lr = 3e-7`, `wd = 0`, `grad_clip = 0.5`），Schulman `k3` KL $\beta = 0.1$，clip $\varepsilon = 0.2$；`8×H100` ZeRO-3 BF16，共 `664` 步（每 `83` 步验证选优） |
| **POW3R 动态乘子** | **上下界 $[\alpha_{\min}, \alpha_{\max}] = [0.67,\; 1.50]$**，混合比 $\lambda = 0.5$，跨轮 $\beta_{\mathrm{ema}} = 0.2$，平滑常数 $\epsilon = 10^{-4}$，最低有效裁决率 `0.75` |
| **MM 六大视觉维度** | `Visual perception (32.4%, 均权 3.40)`、`Visual reasoning (26.0%, 3.74)`、`Content completeness (16.9%, 3.10)`、`Instruction following (11.4%, 3.77)`、`Truthfulness (10.5%, 3.58)`、`Style (2.8%, 2.30)`（Appendix E） |

### 4.2 多模态 `MM`（Table 2）、纯文本 `HealthBench`（Table 3）与收敛加速比（Table 4）

| 基座与奖励构造（30 项对比赢下 **24 / 30** 项） | MM Rubric ↑ | **MM Strict Comp. ↑** | Hallusion | POPE | MM-IFE | MMVetV2 | MathVista | RealWorldQA |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `Qwen3-VL-4B` Base / Static Scalar / Cat-Bal | 42.6 / 47.1 / 47.9 | 14.7 / 17.9 / 18.7 | 62.1 / 62.2 / 62.5 | 88.8 / 89.2 / 89.0 | 11.5 / 12.5 / 13.0 | 49.9 / 51.0 / 51.8 | 71.0 / 72.2 / 72.8 | 71.9 / 72.4 / 72.8 |
| **`Qwen3-VL-4B` + POW3R**（达 `46%` 仅 **`83` 步 vs `332` 步 = `4.0×` 提速**） | **48.8** | **20.2** | 62.4 | 89.1 | **13.5** | **52.2** | **73.2** | **73.1** |
| `Qwen3-VL-8B` Base / Binary | 46.8 / 47.0 | 18.4 / 18.3 | 62.4 / 62.5 | 88.4 / 88.2 | 12.5 / 12.3 | 49.7 / 49.5 | 73.6 / 73.8 | 68.6 / 69.0 |
| `Qwen3-VL-8B` + Static Scalar / Cat-Bal ($R_{\mathrm{cat}}$) | 49.5 / 50.4 | 20.7 / 21.6 | 62.2 / 62.6 | 88.6 / 88.7 | 13.5 / 14.2 | 51.0 / 51.8 | 74.1 / **74.8** | 69.4 / 69.7 |
| **`Qwen3-VL-8B` + POW3R ($R_{\mathrm{dyn}}$)** | **51.6** | **22.6** | **62.9** | **88.9** | **14.8** | **52.6** | 74.6 | **70.2** |

- **纯文本 `HealthBench Hard`（Table 3）**：`Qwen3-4B`（Base `28.0%` $\to$ Static `29.6%` $\to$ **POW3R `32.7%`**, Strict `5.4%`）、`Qwen3-8B`（`27.8%` $\to$ `29.9%` $\to$ **`31.5%`**）、`Gemma3-4B`（`24.3%` $\to$ `25.4%` $\to$ **`28.1%`**）全线夺冠。

---

## 5. 无缝嵌入我方三轨 `(R_vis, R_spec, R_func)` 五维体系的 Python 实现

```python
# POW3R 策略感知动态 Rubric 聚合器（直接支持我方 {0, 0.5, 1} 部件级锚点与负向 Pitfall 翻转）
import math
import torch

def compute_pow3r_group_rewards(
    verdicts: torch.Tensor,          # [G, M] 组内 G 条 rollout 在 M 条准则上的得分 in [0, 1]（缺失记为 nan）
    weights: torch.Tensor,           # [M] 带符号人工权重（正项 >0，负向陷阱项 <0）
    cat_ids: list[str],              # 长度 M，如 ["R_vis", "R_spec", "R_func", "R_clean"]
    prev_alpha: torch.Tensor | None = None,
    alpha_min: float = 0.67, alpha_max: float = 1.50, lam: float = 0.5, beta_ema: float = 0.2, eps: float = 1e-4,
) -> tuple[torch.Tensor, torch.Tensor]:
    G, M = verdicts.shape
    alpha_old = torch.ones(M, device=verdicts.device) if prev_alpha is None else prev_alpha.clone()

    # 1. Appendix A.4 正向规避转换：负权重陷阱项翻转为 s' = 1 - s, w' = |w| > 0
    neg_mask = weights < 0
    s_mat = torch.where(neg_mask.unsqueeze(0), 1.0 - verdicts, verdicts)
    w_pos = weights.abs()

    # 2. 有效裁决数校验（>= ceil(0.75 * G) 才更新组方差 v_j）
    valid_mask = ~torch.isnan(s_mat)
    n_valid = valid_mask.sum(dim=0)                                  # [M]
    enough_valid = n_valid >= math.ceil(0.75 * G)

    s_zeroed = torch.where(valid_mask, s_mat, torch.zeros_like(s_mat))
    p_j = s_zeroed.sum(dim=0) / n_valid.clamp(min=1)
    var_j = (torch.where(valid_mask, (s_mat - p_j) ** 2, 0.0).sum(dim=0)) / n_valid.clamp(min=1)
    g_j = torch.sqrt(var_j + eps)                                    # [M]

    # 3. 按大类计算人类权重加权均值 g_bar_k，并求有界对比乘子 alpha_hat -> alpha_new
    alpha_hat = alpha_old.clone()
    unique_cats = sorted(set(cat_ids))
    for k in unique_cats:
        idx_k = [j for j, c in enumerate(cat_ids) if c == k and enough_valid[j]]
        if not idx_k:
            continue                                                 # 全类无有效信号时保持 alpha = 1.0 / prev
        idx_t = torch.tensor(idx_k, device=verdicts.device)
        g_bar_k = (w_pos[idx_t] * g_j[idx_t]).sum() / w_pos[idx_t].sum().clamp(min=1e-8)
        rho_k = g_j[idx_t] / g_bar_k.clamp(min=1e-8)                 # 若全类全0或全1，rho_k === 1.0 -> alpha_hat = 1.0
        alpha_hat[idx_t] = torch.clamp((1.0 - lam) + lam * rho_k, alpha_min, alpha_max)

    alpha_new = torch.where(
        enough_valid,
        torch.clamp((1.0 - beta_ema) * alpha_old + beta_ema * alpha_hat, alpha_min, alpha_max),
        alpha_old,
    )

    # 4. 类内动态归一化 + 跨类等权聚合（严格保持 R_vis / R_spec / R_func 宏观配比不变）
    w_tilde = w_pos * alpha_new                                      # [M]
    s_filled = torch.where(valid_mask, s_mat, p_j.unsqueeze(0))
    cat_scores = []
    for k in unique_cats:
        idx_t = torch.tensor([j for j, c in enumerate(cat_ids) if c == k], device=verdicts.device)
        cat_scores.append((s_filled[:, idx_t] @ w_tilde[idx_t]) / w_tilde[idx_t].sum().clamp(min=1e-8))

    rewards = torch.stack(cat_scores, dim=-1).mean(dim=-1)           # [G] in [0, 1]
    return rewards, alpha_new
```
