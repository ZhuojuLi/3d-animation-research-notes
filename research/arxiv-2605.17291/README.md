# 论文精读：Step-wise Rubric Rewards for LLM Reasoning（SRaR，arXiv:2605.17291v2）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*Step-wise Rubric Rewards for LLM Reasoning*
- **作者**：Weichu Xie, Haozhe Zhao, Wenpu Liu, ..., Baobao Chang, Nan Duan, Jiaqi Wang（PKU, JD Explore Academy, SJTU, Tsinghua, SII）· 代码：`https://github.com/akarinmoe/SRaR`
- **原文**：`https://arxiv.org/html/2605.17291v2` · 本地原件：[paper.html（上游原文）](https://arxiv.org/abs/2605.17291) · 纯文本：[paper.txt（上游原文）](https://arxiv.org/abs/2605.17291) · 元数据与校验：`sources.json`（本地校验清单未发布）
- **整理日期**：2026-11-27 · 关联总报告：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 轨迹级标量 Rubric 的三大结构性顽疾（§1 Fig. 2b & §4.3.2）

将多条 Rubric 打分压成单一轨迹级标量并广播给全序列所有 token（如标准 RaR），作者在 `1,000` 道 `Qwen3-8B` 多步样本与 `960` 条 AIME 2025 rollout 上定量揪出了三大病灶：
1. **正确终态掩盖脏步骤（`18.2%` 错步受奖）**：最终答对的样本中，**`350 / 1,928 = 18.2%`** 的中间步骤本身存在推导错误或冗余试错，却获得了全额正优势！
2. **终态失败连坐好前缀（`49.9%` 对步受罚）**：最终答错的样本中，**`1,622 / 3,252 = 49.9%`** 的早期步骤完全正确，却被一刀切负优势抹杀！
3. **诱发 `48.1%` 无限自我纠错死循环（Self-Correction Looping）**：模型发现只要不断重写、自我怀疑拉长轨迹（平均 `25.4` 次自我修正词，典型坏例达 63 次修正、3.3 万字符截断无答案，Appendix 16），就能在轨迹级汇总中多蹭中几条过程 Rubric！

### 为什么 SRaR 能把死循环从 `48.1%` 砍到 `26.5%`？（三重联锁机制）
- **机制一（步骤边界局部归因）**：某条 `SUGGEST` 一旦在第 $k$ 步满足，奖励仅分配给第 $k$ 步区间 $[a_k, b_k]$，后续步骤反复推翻重写拿不到额外全局红利，使模型学会“写对一步即定案推进”。
- **机制二（解耦优势隔离基线污染）**：过程分被严格锁在零均值局部偏置项 $\tilde{r}_i^{(t)}$ 中，**永不进入终态成败的组基线 $(\mu_{\mathrm{base}}, \sigma_{\mathrm{base}})$**——未收敛报错的死循环轨迹绝不可能靠刷满过程项把全局负优势翻正！
- **机制三（跨 Rollout 同步骤归一化防“单步坍缩”）**：Appendix 20 揭示了一个惊人反例——若只做步骤归因却不做跨 rollout 归一化（`w/o step norm.`），模型会把 4,000+ token 的全部思考硬塞进单一 `### Step 1:` 独吞所有未中心化正分，导致均分从 `72.53%` 崩盘至 **`56.76%`**！跨 rollout 按步标准化彻底归零了无区分度的常驻分。

---

## 2. 精确数学公式、解耦优势与理论性质（§3.3 Eq. 2–6 & Appendix 22）

### 2.1 三类预算封顶增量与跨 Rollout 按步标准化（Eq. 3–5）
每道题配备由正误轨迹对比蒸馏出的 $M$ 条准则 $\mathcal{R}_x = \{(c_j, \tau_j)\}_{j=1}^M$（`16,560` 题统计均值 `7.53` 条/题：`SUGGEST 4.59 [60.9%]`、`PITFALL 1.26 [16.7%]`、`BONUS 0.67 [8.9%]`、`ANSWER 1.00 [13.3%]`，Appendix 23）。裁判返回满足标志 $s_j \in \{0,1\}$ 与归属步骤 $k_j \in \{1,\dots,K\}$。首先按题内该类条目数 $N_\tau$ 做预算封顶映射（防止条目多的题梯度爆炸）：
$$\delta_j = \begin{cases} +R_{\texttt{SUG}} / N_{\texttt{SUG}}, & \tau_j = \texttt{SUGGEST},\; s_j = 1 \quad (R_{\texttt{SUG}} = +0.8) \\ -|R_{\texttt{PIT}}| / N_{\texttt{PIT}}, & \tau_j = \texttt{PITFALL},\; s_j = 1 \quad (R_{\texttt{PIT}} = -1.0) \\ +R_{\texttt{BON}} / N_{\texttt{BON}}, & \tau_j = \texttt{BONUS},\; s_j = 1 \quad (R_{\texttt{BON}} = +1.0) \\ 0, & \text{otherwise} \end{cases}$$
对 rollout $i$ 的第 $k$ 步汇总 $d_{k,i} = \sum_{j: k_j = k} \delta_j$。令同组 $n$ 条 rollout 中在第 $k$ 步存在归因条目的子集为 $\mathcal{G}_k$，执行跨 rollout 标准化并映射至步骤 token 区间 $[a_k^i, b_k^i]$：
$$\bar{d}_{k,i} = \begin{cases} 0, & |\mathcal{G}_k| \le 1 \\ \dfrac{d_{k,i} - \mu_k}{\sigma_k + \epsilon}, & |\mathcal{G}_k| > 1 \end{cases}, \qquad \tilde{r}_i^{(t)} = \begin{cases} \bar{d}_{k,i}, & t \in [a_k^i, b_k^i] \\ 0, & \text{无归因步骤 token} \end{cases}$$

### 2.2 解耦优势估计器与尺度对齐定理（Eq. 6 & Appendix 22 Propositions 22.1–22.5）
记终态基础奖励 $r_{\mathrm{base},i} = (1-\lambda)r_{\mathrm{acc},i} + \lambda r_{\mathrm{fmt},i}$（$\lambda = 0.1$），SRaR 将终态优势与步骤 Rubric 偏置**分别独立标准化后再相加**（工程迁移至多轮硬门禁时可乘阻尼系数 $\eta$，原文因两侧均已单位方差化故原生取 $\eta = 1.0$）：
$$\hat{A}_i^{(t)} = \underbrace{\frac{r_{\mathrm{base},i} - \mu_{\mathrm{base}}}{\sigma_{\mathrm{base}} + \epsilon}}_{\text{终态硬验证优势（二阶矩恒为 } 1\text{）}} + \eta \underbrace{\tilde{r}_i^{(t)}}_{\text{步骤级零均值偏置（二阶矩恒为 } 1\text{）}}$$
- **理论保证（Appendix 22）**：① **梯度正交分解（Prop. 22.1）**：$\hat{g}_{\mathrm{SRaR}} = \hat{g}_{\mathrm{GRPO}} + \hat{g}_{\mathrm{rubric}}$；② **二阶矩严格对齐（Prop. 22.3）**：无论某步挂了 1 条还是 6 条 Rubric，标准化后 $\frac{1}{n}\sum_i A_{\mathrm{base},i}^2 = 1$ 且 $\frac{1}{|\mathcal{G}_k|}\sum_{i\in\mathcal{G}_k} \bar{d}_{k,i}^2 = 1$，彻底免去跨题权重调参；③ **REINFORCE 渐近无偏性（Prop. 22.5）**：留一法基线下严格无偏，标准组均值基线下偏差仅为 $O(1/n)$（$n=8$）。

---

## 3. Appendix 8 & 15 对比蒸馏 Prompt、步骤归因裁判 Prompt 与蒸馏实例

```text
# [Prompt 1: 正负轨迹对比蒸馏 Rubric (Appendix 8.2，由 GPT-5 对比正确与错误 rollout 生成，总行数 <= 8)]
You are designing a grading rubric for math problem solutions.
Original problem: {problem_text} | Given n model solutions with correctness labels: {solutions_block}
True correct answer: <ANSWER>{gold_answer}</ANSWER>
Create a concise, verifiable rubric. Output ONLY structured items using the tags below (one item per line, total <= 8, do NOT pad):
- <SUGGEST>: Mandatory. Key reasoning checkpoint from standard solution path, independently verifiable from text.
- <PITFALL>: Optional (only if confident). Reasoning traps or empirically observed common errors to avoid.
- <BONUS>:   Optional (only if confident). Clever, efficient, or alternative valid reasoning patterns.
- <ANSWER>:  Mandatory. Checks whether final answer matches ground truth.
Do NOT include formatting/tag checks; do NOT reference the given samples explicitly; generalize the rubric.

# [Appendix 15 蒸馏成品示例：已知 x + 1/y = 3, y + 1/x = 4，求 xy + 1/(xy) = 10]
<SUGGEST> Multiplies the two equations to obtain (x + 1/y)(y + 1/x) = 12.
<SUGGEST> Expands the product correctly to xy + 2 + 1/(xy).
<SUGGEST> From xy + 2 + 1/(xy) = 12, isolates and states xy + 1/(xy) = 10.
<PITFALL> Misexpanding (x + 1/y)(y + 1/x), especially omitting the +2 term from x*(1/x) and (1/y)*y.
<BONUS>   Computes xy + 1/(xy) directly via product expansion without solving for x or y individually.
<ANSWER>  Final value reported for xy + 1/(xy) equals 10.

# [Prompt 2: 步骤级归因裁判 (Appendix 8.4，默认用 GPT-OSS-20B，单次调用返回整条回复所有条目的 JSON 数组)]
Problem: {problem} | Rubric Items: {rubric_items} | Student Solution: {response} | Extracted Answer: {extracted_answer}
For every rubric item listed above, evaluate the student's solution. Rules:
- SUGGEST -> satisfied: true if the student correctly performed that reasoning step.
- PITFALL -> satisfied: true if the student MADE that mistake (fell into the pitfall).   # 极性：踩坑记 true，由公式赋负分！
- BONUS   -> satisfied: true if the student used that approach.
For `step`: the 1-indexed step number (### Step N) most closely associated with this item. Use 0 if it spans the whole solution; use -1 if there is no relevant step.
Return ONLY a valid JSON array: [{"id": <int>, "satisfied": <bool>, "step": <int>}, ...]
```

---

## 4. Appendix 9–21 超参全表、组件/标签消融与代码基准泛化

- **训练与审计超参（Appendix 9, 12, 13，`8×H200` DAPO 配方）**：`max_prompt=2048`，`max_response=8192`，`batch_size=128`，组大小 $n=8$，`lr=1e-6`，`temp=1.0`，共 `200` 步；`51,583` 条 Rubric 经 `Gemini-3-Flash` 审计有效率 **`98.0%`**（人机一致率 `92%`）；训练裁判 `GPT-OSS-20B` 人机满足一致率 `89.3%`（$\kappa=0.76$）、步骤归因一致率 `80.7%`、10 次重评自一致率 `98.3% / 99.7%`；数据量从 `1k -> 2k -> 4k -> 8k -> 16k` 单调涨分且 `4k->8k` 斜率最陡（Appendix 17）。

| 模型 / 消融变体（Qwen3-8B 为主，6 大数学集均值） | AIME24 | AIME25 | Olympiad | 6 集 Avg ↑ | 关键现象与诊断（Table 1–3, 9–11） |
|---|---:|---:|---:|---:|---|
| `Qwen3-8B` Base / `+ DAPO` / `+ RaR（轨迹级）` | 26.88 / 52.60 / 57.50 | 23.33 / 41.35 / 43.23 | 56.23 / 67.80 / 67.51 | 53.40 / 67.26 / 68.96 | RaR 死循环率 **`48.1%`**，忠实推理率 `34.5%` |
| **`Qwen3-8B + SRaR（完整版，GPT-OSS-20B 裁判）`** | **61.15** | **49.06** | **73.15** | **72.53**（**+3.57**） | 死循环降至 **`26.5%`**，FRR 升至 **`46.7%`**（`A✓S× = 0`），最难 Q5 档 **+13.4 pp** |
| $\quad -$ **去掉跨 Rollout 步骤归一化（`w/o step norm.`）** | 45.10 | 28.96 | 56.53 | **56.76**（**彻底崩盘**） | 4,000+ tok 挤进单一 `Step 1` 刷常驻分 |
| $\quad -$ 去掉解耦优势（合并成单标量再分步） | 62.60 | 46.67 | 70.47 | 72.06（AIME25 **-2.39**） | 软 Rubric 噪声污染高难题终态成败基线 |
| $\quad -$ 单一标签：`SUGGEST` / **`PITFALL`** / `BONUS` only | 58.65 / 60.63 / 59.38 | 46.98 / **49.06** / 47.08 | 71.36 / **73.45** / 70.33 | 71.39 / **71.97** / 70.89 | 仅靠负向 `PITFALL` 步骤罚分即超全量 RaR **+3.01 pp**！ |
| $\quad -$ 换小裁判：`Qwen3-30B-A3B` / **`Qwen3-4B`** | 57.81 / 61.15 | 46.04 / 47.60 | 70.33 / 71.67 | 70.86 / **71.00** | 跨 rollout 标准化抵消弱裁判噪声，4B 裁判仍稳赢 RaR |
| **`Qwen3-32B`：`+ RaR` $\to$ `+ SRaR`** | 63.65 $\to$ **64.17** | 50.94 $\to$ **51.77** | 69.29 $\to$ **76.71** | 73.06 $\to$ **75.81**（**+2.75**） | 步骤越多提升越大（步数与增益 Pearson $r=0.91$） |

### Appendix 21 代码生成域迁移全表（`12K Code-R1` 单元测试验证 + 对比蒸馏 Rubric）

| 方法（`Qwen3-8B-Non-Thinking`） | LiveCodeBench v6 ↑ | HumanEval+ ↑ | MBPP+ ↑ | TACO ↑ |
|---|---:|---:|---:|---:|
| Base / `+ DAPO（纯单测）` / `+ RaR（轨迹级）` | 22.93 / 40.07 / 40.93 | 80.49 / 87.80 / 87.80 | 68.78 / **77.25** / 75.13 | 12.59 / 30.69 / 29.52 |
| **`+ SRaR（步骤级归因 + 单测解耦）`** | **41.93**（超 RaR `+1.00`） | **87.98** | 76.60（超 RaR `+1.47`） | **30.72**（超 RaR `+1.20`） |

---

## 5. 对接我方 Claude Code 多轮工具轨迹（Turn = Step）的 `GSPO-token` 落地伪代码

在我方 `Qwen3.8-27B` 三轨沙盒中，**每个 Assistant Turn 天然就是一个原子 Step**（免去 `### Step N:` 文本切分！）：① 用 27B SFT 失败轨迹对比 Kimi/XHS 成功轨迹，在 [XHS-TASK-AND-RUBRIC-SPEC.md](../../3d-animation-agent/docs/XHS-TASK-AND-RUBRIC-SPEC.md) 题包中补齐 2–3 条显式 `PITFALL`（如“用静态 HTML 假按钮冒充 3D 交互”“吞异常白屏”“删减孔系保编译”）；② 将每轮「工具动作摘要 + 沙盒返回状态 + 关键帧缩略图」一次打包交裁判归因到 `turn_id`，接入 **`GSPO-token` + SRaR 解耦优势**：

```python
# 多轮 Agent 轮次级 SRaR 解耦优势估计器（对接 GSPO-token / VeRL，天然以 Assistant Turn 为 Step）
import torch

def compute_turn_wise_srar_advantages(
    base_rewards: torch.Tensor,          # [G] 终态硬门禁 + POW3R 五维得分
    judge_items_per_rollout: list[list[dict]],  # 每条 rollout 的 [{"type": "SUGGEST"|"PITFALL"|"BONUS", "satisfied": bool, "turn": int}]
    rubric_type_counts: dict[str, int],  # {"SUGGEST": N_sug, "PITFALL": N_pit, "BONUS": N_bon}
    token_turn_ids: torch.Tensor,        # [G, L] 每个 token 所属 1-indexed assistant turn（非可训位或异常掩码位为 -1）
    eta: float = 0.35, eps: float = 1e-6,
) -> torch.Tensor:
    G, L = token_turn_ids.shape
    budgets = {"SUGGEST": 0.8, "PITFALL": -1.0, "BONUS": 1.0}

    # 1. 终态硬奖励独立标准化（不受任何过程软 Rubric 污染！）
    a_base = (base_rewards - base_rewards.mean()) / (base_rewards.std(unbiased=False) + eps)  # [G]

    # 2. 汇总每条 rollout 在每个 turn k 上的原始预算封顶增量 d_{k,i}
    raw_turn_scores: dict[int, dict[int, float]] = {}                # turn_k -> {rollout_i: d_{k,i}}
    for i, items in enumerate(judge_items_per_rollout):
        for it in items:
            k, r_type, sat = it["turn"], it["type"], it["satisfied"]
            if k <= 0 or not sat or rubric_type_counts.get(r_type, 0) == 0:
                continue                                             # step=0/-1 或未触发项不产生局部轮次偏置
            delta = budgets[r_type] / rubric_type_counts[r_type]     # PITFALL 命中 sat=True 时自动赋予 -1.0 / N_pit
            raw_turn_scores.setdefault(k, {})[i] = raw_turn_scores.get(k, {}).get(i, 0.0) + delta

    # 3. 跨 Rollout 同轮次标准化（|G_k| <= 1 强制归零，杜绝单轮堆砌坍缩！）
    r_tilde = torch.zeros((G, L), dtype=torch.float32, device=base_rewards.device)
    for k, i_to_d in raw_turn_scores.items():
        if len(i_to_d) <= 1:
            continue
        vals = torch.tensor(list(i_to_d.values()), dtype=torch.float32, device=base_rewards.device)
        mu_k, std_k = vals.mean(), vals.std(unbiased=False)
        for i, d_val in i_to_d.items():
            d_bar = (d_val - mu_k) / (std_k + eps)
            r_tilde[i, token_turn_ids[i] == k] = d_bar

    # 4. 解耦叠加（eta=0.35 确保硬门禁成败占主导，轮次偏置精准抑制空转与作弊轮）
    valid_tok = token_turn_ids > 0
    return (a_base.unsqueeze(1) + eta * r_tilde) * valid_tok
```
