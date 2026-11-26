# WebGen-Agent / Step-GRPO（arXiv:2509.22644v1，ICLR 2026）深度精读：即时工作区状态优势 vs 累积未来奖励崩盘实证

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> - **论文标题**：*WebGen-Agent: Enhancing Interactive Website Generation with Multi-Level Feedback and Step-Level Reinforcement Learning*（2025-09-26，发表于 ICLR 2026）
> - **作者与机构**：Zimu Lu, Houxing Ren, Yunqiao Yang, Ke Wang, Zhuofan Zong, Junting Pan, Mingjie Zhan, Hongsheng Li（香港中文大学 MMLab & Ace Robotics / 商汤）
> - **原文与本地归档**：[arXiv:2509.22644v1](https://arxiv.org/abs/2509.22644v1) · [paper.html（上游原文）](https://arxiv.org/abs/2509.22644) · [paper.txt（上游原文）](https://arxiv.org/abs/2509.22644) · `sources.json`（本地校验清单未发布） · 代码仓：`https://github.com/mnluzimu/WebGen-Agent`
> - **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者亲踩的初始大坑

与单轮整文件输出不同，仓库级（Repository-Level）多文件交互前端 Agent 在每一步都会对持久化代码库执行增量覆写 $\mathcal{C}_{j-1} \xrightarrow{\Delta\mathcal{C}_j} \mathcal{C}_j$。港中文 MMLab 团队在构建多层级视觉/GUI 反馈工作流并设计步级强化学习（`Step-GRPO`）时，用同源对照实验踩出了**多步代码编辑 RL 中最具颠覆性的三大硬核大坑**：

1. **照搬数学推理 PRM 的“累加未来步奖励（Cumulative Advantage）”直接把模型从 `42.5%` 训崩至 `38.7%`（甚至倒退回 SFT 起点 `38.9%` 以下！）**：
   - 在 `DeepSeekMath`（Shao et al., 2024）的步级过程监督 GRPO 中，第 $j$ 步 token 的优势取后续所有步归一化奖励之和 $\sum_{k \ge j}\tilde{r}_k$。
   - 但在 Table 3 严格固定同一奖励函数（$\textit{Score}_{\text{shot}} + \textit{Score}_{\text{gui}}$）的消融中：`Naive Outcome GRPO`（整条轨迹共享最高步分）达 `42.5%`，而 **`Step-GRPO w/ Cumulative Advantage` 暴跌 `-3.8` 个点至 `38.7%`（`Yes` 完全通过率从 `38.0%` 崩至 `32.6%`），连 1-epoch SFT 起点（`38.9%`）都不如；反观不累加未来、仅用当前步即时工作区状态分的 `Step-GRPO (Ours)` 直接冲上 `45.4%`（净胜 `+6.7` 个点！）**。
   - **根本机理**：数学链式推导中前一步是后一步成立的必要前提；而代码库编辑是**可覆盖状态机**——若第 $j$ 步写出破坏全局样式的烂补丁 $\Delta\mathcal{C}_j$，但第 $j+1, j+2$ 步全力抢修拿回高分，累加未来奖励会把高额正优势**错误奖给制造故障的第 $j$ 步烂编辑**！反之第 $j$ 步写出了极佳页面，第 $j+1$ 步尝试高难功能不幸改崩，累加未来又会**错误惩罚第 $j$ 步的好代码**！
2. **SFT 暖机训 `2 Epochs` 对比 `1 Epoch` 零实质增益且拉低完全通过率（§3.2 Table 3）**：
   - 在约 700 条 `DeepSeek-V3` 示范轨迹上训 `2 epochs`（Acc `39.3%` / 外观 `3.4`）相比 `1 epoch`（Acc `38.9%` / 外观 `3.4`），**`Yes` 完全通过率反而从 `33.8%` 跌至 `32.1%`**，启动失败率从 `0.0%` 微升至 `0.2%`，且过度拟合示范轨迹会压窄后续 Step-GRPO 的探索空间。
3. **无回溯与全局择优护航时，接入 GUI-Agent 修功能会“误伤”页面颜值（`3.6 -> 3.4`）**：
   - Table 2 增量消融暴露：加入截图反馈把外观分从 `3.0` 拉高到 `3.6`；但再叠加 GUI-Agent 修交互逻辑时，模型为改通功能常把排好的布局改乱甚至连续报错，导致外观分倒退至 **`3.4`**——必须配齐**连续 5 次报错自动回溯（Backtrack）+ 终局字典序择优（Select-Best）**才能实现功能（`52.6%`）与颜值（`3.8`）双赢。

---

## 2. 方法论、精确数学公式与验证器工程实现（含 Appendix 超参/Prompt/防刷分细节）

### 2.1 WebGen-Agent 两级按需视觉反馈、5 错回溯与字典序择优（§2.1 & Appendix B Algorithms 1–3, C）

从指令 $\mathcal{I}$ 与空仓库 $\mathcal{C}_0$ 出发，最多运行 $T=20$ 步（Appendix H Table 8 验证 `T=2..20` 收敛曲线：14–20 步指标趋稳，20 步超限率从 `100%` 降至 **`7.9%`**）：

1. **连续 5 步执行报错强制回溯与上下文截断（Algorithm 1 Lines 12–23 & Algorithm 3）**：
   - 每步应用编辑 $\mathcal{C}_t \leftarrow \textsc{ApplyEdit}(\mathcal{C}_{t-1}, \Delta\mathcal{C}_t)$ 后装包起服得 stdout/stderr $\mathcal{O}_t$；
   - 若 $\mathcal{O}_t = \textit{error}$，计数 $\textit{consecErr} \mathrel{+}= 1$；一旦 **$\textit{consecErr} = 5$**，立即调 `SelectBestStep(Steps)` 定位历史最优步 $t^\star$，恢复磁盘快照 $\mathcal{C} \leftarrow \mathcal{C}^{\star}$ 并**将对话轨迹 $\mathcal{T}$ 硬截断回第 $t^\star$ 步反馈末尾（`Truncate(T, t*)`）**，彻底清洗报错污染上下文。
2. **先截图审美观、达标再起 GUI-Agent 测交互的两级门控（Appendix C Figs. 4–7）**：
   - **第一级·截图反馈 $\mathcal{F}_{\text{shot}}$**：由开源 `Qwen2.5-VL-32B-Instruct` 检查可见运行错误（`404`、堆栈、丢样式、白屏，`is_error`），输出结构化页面详述、排版配色改进建议及 `0–5` 外观分：

$$
\mathcal{F}_{\text{shot}, t} = \bigl\langle \textit{Description}_t,\; \textit{Score}_{\text{shot}, t}\in[0,5],\; \textit{Suggestions}_{\text{shot}, t} \bigr\rangle
$$

   - 若主控编码 LLM 判断外观仍需打磨，直接跳入下一步修视觉（跳过高开销 GUI 交互）；
   - **第二级·GUI-Agent 动态测试反馈 $\mathcal{F}_{\text{gui}}$**：外观过关后，主控 LLM 按 1-shot 模板把全部需求转为 `<boltAction type="gui_agent_test">` 测试指令（Appendix F Table 6 人工核验四模型共 **98.3% 指令达高覆盖 $\ge 4/5$ 分，`77.2%` 满分 `5/5`，均分 `4.75`**），驱动 `Qwen2.5-VL-32B` GUI Agent 实操测试并由主控 LLM 打 `1–5` 功能分：

$$
\mathcal{F}_{\text{gui}, t} = \bigl\langle \textit{Score}_{\text{gui}, t}\in[1,5],\; \textit{Suggestions}_{\text{gui}, t} \bigr\rangle
$$

   - 若 `test_passed == true` 提前停机；否则将快照压栈 $\textit{Steps} \mathrel{+}= \langle t, \mathcal{C}_t, \textit{Score}_{\text{shot},t}, \textit{Score}_{\text{gui},t} \rangle$。
3. **字典序全局择优 `SelectBestStep`（Algorithm 2）**：功能优先、外观次之、同分取最新：

$$
g_{\max} \leftarrow \max_{s\in\textit{Steps}}\textit{Score}_{\text{gui}}(s),\qquad \mathcal{S}_g \leftarrow \{s\in\textit{Steps}\mid \textit{Score}_{\text{gui}}(s)=g_{\max}\},\qquad \mathcal{C}^\star \leftarrow \arg\max_{s\in\mathcal{S}_g}\textit{Score}_{\text{shot}}(s)
$$

### 2.2 Step-GRPO：即时工作区状态监督与跨轨迹全步池化归一化（§2.2 Eq. 3–4）

对每条指令 $q$ 采样 $G=5$ 条完整多步轨迹 $o^{(i)} = [\Delta\mathcal{C}_1, \mathcal{O}_1, \mathcal{F}_1, \dots, \Delta\mathcal{C}_{K_i}, \mathcal{O}_{K_i}, \mathcal{F}_{K_i}]$：
- **严格局部化梯度掩码 + 零 KL 约束（Eq. 3）**：环境输出 $\mathcal{O}_j$ 与反馈 $\mathcal{F}_j$ 全部屏蔽 loss，**仅对模型输出的代码编辑块 $\{\Delta\mathcal{C}_1, \dots, \Delta\mathcal{C}_{K_i}\}$ 施加 Clipped GRPO 损失，且移除 KL 正则（$\beta_{\text{KL}}=0$）**：

$$
\mathcal{J}_{\text{Step-GRPO}}(\theta) = \mathbb{E}_{q,\{o_i\}_{i=1}^G}\!\left[\frac{1}{G}\sum_{i=1}^{G}\frac{1}{|o_i|}\sum_{t\in\Delta\mathcal{C}}\min\!\left(\frac{\pi_\theta(o_{i,t}\mid q,o_{i,<t})}{\pi_{\theta_{\text{old}}}(o_{i,t}\mid q,o_{i,<t})}\hat{A}_{i,t},\; \operatorname{clip}\!\left(\frac{\pi_\theta(o_{i,t}\mid q,o_{i,<t})}{\pi_{\theta_{\text{old}}}(o_{i,t}\mid q,o_{i,<t})}, 1-\epsilon, 1+\epsilon\right)\hat{A}_{i,t}\right)\right]
$$

- **即时工作区状态奖励与全步池化标准化（Eq. 4，不累加任何未来步！）**：设同题 $G$ 条轨迹所有步骤的即时奖励全集为 $\mathbf{R} = \{\{r_1^{(1)},\dots,r_{K_1}^{(1)}\}, \dots, \{r_1^{(G)},\dots,r_{K_G}^{(G)}\}\}$，第 $i$ 条轨迹第 $j$ 步内所有代码编辑 token 的优势为：

$$
r_j^{(i)} = \textit{Score}_{\text{shot}, j}^{(i)} + \textit{Score}_{\text{gui}, j}^{(i)}, \qquad \hat{A}_j^{(i)} = \frac{r_j^{(i)} - \operatorname{mean}(\mathbf{R})}{\operatorname{std}(\mathbf{R})}
$$

---

## 3. 实验口径、完整超参数表与主消融硬数据（事实）

### 3.1 训练超参与开源 VLM 评分人工核验表（§3.1 & Appendix A, E Table 5）

| 模块 | 配置项 | 论文精确数值与核验事实 |
| --- | --- | --- |
| **Stage 1：轻量 SFT** | 数据源 / 轮数 / 超参 | 约 **`700` 条** `DeepSeek-V3` WebGen-Agent 轨迹，**`1 epoch`**，LR **`4e-5`**，Batch **`32`**（产出 `WebGenAgent-LM-7B/8B-SFT`） |
| **Stage 2：Step-GRPO** | 数据源 / 采样 / 超参 | 从 `WebGen-Instruct` 滤除歧义题后取 **`500` 条指令**，**`1 epoch`**，Batch **`16`**，**$G=5$**，LR **`1e-6`**，KL `= 0`，$T_{\max}=20$，推理 $T=0.5$（16×A800 >24h） |
| **反馈 VLM 人工验真** | `Qwen2.5-VL-32B-Inst.` vs `GPT-4o` | 人工逐帧核查（Table 5）：32B 截图打分准确率 **`93.6%–95.6%`**（标准误 `0.20–0.26` vs GPT-4o `95.5%/0.20`），GUI 打分准确率 **`89.6%–91.4%`**（vs GPT-4o `92.2%`）；但用 32B 替掉 DeepSeek-V3 写代码则崩至 **`5.6%`**（Table 4）！ |

### 3.2 Agent 主榜对比（Table 1）、工作流增量消融（Table 2）与 Step-GRPO 策略消融全表（Table 3）

| 实验组 / 模型与消融变体（`WebGen-Bench` 101 题 / 647 用例） | Yes (%) ↑ | Partial (%) ↑ | No (%) ↓ | Start Failed (%) ↓ | **Accuracy (%) ↑** | **Appearance (0–5) ↑** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| *同配 Claude-3.5-Sonnet 对照*：`OpenHands` / `Aider` / `Bolt.diy` | 18.1/19.9/22.6 | 8.3/5.9/7.6 | 58.6/42.0/64.1 | 15.0/32.1/5.7 | 22.3 / 22.9 / 26.4 | 2.6 / 1.9 / 3.0 |
| **`WebGen-Agent`** + `Claude-3.5-Sonnet` / `Claude-4-Sonnet` / **`Qwen3-Coder-480B-A35B`** | 45.6/48.8/**50.5** | 12.7/15.3/15.3 | 40.6/33.4/34.2 | 1.1/2.5/**0.0** | **51.9 / 56.5 / 58.2** | **3.9 / 4.1 / 4.3** |
| **`WebGen-Agent`** + `DeepSeek-V3` / `Qwen3-Coder-30B-A3B` | 46.1 / 45.7 | 13.1 / 14.1 | 40.6 / 40.2 | 0.2 / **0.0** | **52.6 / 52.8** | **3.8 / 4.0** |
| *工作流消融（DeepSeek-V3）*：`Execution-only` → `+Screenshot` | 39.7 → 41.3 | 12.4 → 10.7 | 43.3 → 45.9 | 4.6 → 2.2 | 45.9 → 46.6 | 3.0 → **3.6 (+0.6)** |
| *工作流消融*：`+GUI-agent` → `+Backtrack` → **`+Select-best (Full)`** | 43.0→45.6→**46.1** | 13.9→11.1→13.1 | 41.3→43.1→40.6 | 1.9→**0.2**→**0.2** | 49.9→51.2→**52.6** | **3.4（回落）**→3.7→**3.8** |
| **7B 训练消融**：`Qwen2.5-Coder-7B-Instruct`（Base） | 10.0 | 4.8 | 60.9 | 24.3 | 12.4 | 1.6 |
| + `SFT for 1 Epoch` vs `SFT for 2 Epochs` | **33.8** vs 32.1 | 10.2 vs 14.2 | 56.0 vs 53.5 | **0.0** vs 0.2 | 38.9 vs 39.3 | 3.4 vs 3.4 |
| + `Naive Outcome GRPO`（终局最高步分广播全轨迹） | 38.0 | 9.0 | 53.0 | 0.0 | 42.5 (+3.6) | 3.5 |
| + **`Step-GRPO w/ Cumulative Advantage`（累加未来步奖励，训崩！）** | **32.6** | 12.2 | 55.2 | 0.0 | **38.7 (−0.2 vs SFT!)** | 3.5 |
| + `Step-GRPO w/ Screenshot Only` / `w/ GUI-agent Only` | 34.9 / 34.8 | 10.5 / 11.3 | 53.9 / 53.6 | 0.6 / 0.3 | 40.2 / 40.4 | 3.5 / 3.4 |
| + **`Step-GRPO w/ Screenshot + GUI-agent`（即时状态分，Ours 7B）** | **40.2 (+6.4)** | 10.5 | **49.3** | **0.0** | **45.4 (+6.5 vs SFT)** | **3.7 (+0.3)** |
| *8B 泛化验证*：`Qwen3-8B` Base → `1-ep SFT` → **`Step-GRPO`** | 29.5→32.8→**37.4** | 9.1→11.6→12.1 | 61.4→55.6→**50.5** | 0.0→0.0→**0.0** | 34.1 → 38.6 → **43.4** | 3.2 → 3.4 → **3.6** |

> 细项与工程规模（Table 7 & Fig. 3）：7B 经 Step-GRPO 后在用户交互（`33.5 -> 41.1`）、数据管理（`33.8 -> 47.8`）、功能测试（`23.5 -> 30.7`）上全线跃升，且平均生成文件数与总代码行数随 `Base -> SFT -> Step-GRPO` 持续两级增长。

---

## 4. 对我们 Qwen3.8-27B 三轨项目（特别是 verify_xhs_output.cjs 与 check_2d_v2.mjs）的直接迁移方案（推论）

1. **多轮文件编辑 RL 的第一数学公理：对每步局部 `Edit` 严格采用“即时工作区状态分”标准化，严禁累加未来步折扣回报！**
   - 我们的三轨长程轨迹（50–150 轮模块化 `Write/Edit`）与 `WebGen-Agent` 完全同属**可覆写文件工作区状态机**。Table 3（`38.7%` vs `45.4%`）用真金白银帮我们排掉了“直接套用数学 PRM 累积未来优势”的天坑！
   - 在对 `Qwen3.8-27B` 实施多步工具交互 Step-GRPO 时，每当模型完成一次 `Edit` 并触发验证，直接取当前 `/tmp` 工作区在 `verify_xhs_output.cjs` / `check_2d_v2.mjs` / `cad_inspect.py` 与视觉裁判上的**即时快照得分 $r_j^{(i)}$**，在同题 $G$ 条轨迹全步集合 $\mathbf{R}$ 上做 $\frac{r_j^{(i)} - \operatorname{mean}(\mathbf{R})}{\operatorname{std}(\mathbf{R})}$ 赋给本轮代码编辑 token（工具返回与截图 token 梯度全置 0）。
2. **在三轨长程采集与推理脚手架中内置“连续报错自动回溯快照 + 字典序 `SelectBestStep`”**：
   - 当 `kimi-k3.1-pro` 或训练后 `Qwen3.8-27B` 在 50–150 轮精修后期为调某个细节（如加粒子特效、改圆角倒角）连续 3–5 步引发 `pageErrors`、非流形报错或把 `check_2d_v2.mjs` 原本通过的 `scrub_exact` 改挂时（正对应 Table 2 `+GUI-agent` 颜值得分从 `3.6` 跌回 `3.4` 的现象），立刻触发快照回滚并 `Truncate` 污染上下文；
   - 轨迹收尾时，严格执行 Algorithm 2 字典序择优：**先挑硬检最高档位（如 `verify_xhs_output.cjs` 的 `L3_plus_ui_control_effect == true` 或 `check_2d_v2.mjs` 的 `report.ok == true`），再在硬检全过快照中挑五维视觉盲评最高分交付**！
3. **SFT 严格锁定 `1 Epoch` + 强编码主模型配轻量开源 VLM 审图解耦**：
   - Table 3 的 1-epoch vs 2-epoch 消融与小红书 `3DCodeFactory`（1 epoch 765 steps）形成双重互证——高质量长程多轮 SFT 跑 **1 epoch** 即达最佳甜点；同时 Table 4 证实视觉挑刺无需昂贵闭源模型，本地 27B/32B 级开源 VLM 评分准确率已达 `94%+`。

### 可直接移植的 5 错回溯字典序择优与 `Step-GRPO` 即时状态优势代码片段

```python
# 对齐 WebGen-Agent Appendix B (Algorithms 1-3) & §2.2 (Eq. 3-4)：严禁累加未来步回报！
from dataclasses import dataclass
import numpy as np

@dataclass
class WorkspaceSnapshot:
    step_id: int
    files_tar_bytes: bytes
    msg_end_idx: int          # 用于 Truncate(T, t*) 截断污染上下文
    func_tier_score: float    # 如 verify_xhs_output L1..L3+ 档位分 或 check_2d_v2 通过率
    visual_aes_score: float   # 五维视觉盲评分

def select_best_step(snapshots: list[WorkspaceSnapshot]) -> WorkspaceSnapshot:
    """Algorithm 2 字典序全局择优：1. 功能/硬检分最高 -> 2. 视觉外观分最高 -> 3. 最新步优先"""
    if not snapshots:
        raise ValueError("No valid workspace snapshots recorded")
    return max(snapshots, key=lambda s: (s.func_tier_score, s.visual_aes_score, s.step_id))

def compute_step_grpo_immediate_advantages(group_trajectories: list[list[dict]], eps: float = 1e-6):
    """
    group_trajectories: 同题 G=5 条多步轨迹，每步含 {'edit_token_ids': [...], 'score_shot': float, 'score_gui': float}
    核心铁律：第 j 步优势仅取决于第 j 步编辑后的即时工作区总分 r_j^(i)，绝不累加未来步奖励 (防 42.5% -> 38.7% 崩盘)！
    """
    all_step_rewards = [
        step["score_shot"] + step["score_gui"]
        for traj in group_trajectories
        for step in traj
    ]
    pool = np.asarray(all_step_rewards, dtype=np.float64)
    r_mean, r_std = float(pool.mean()), float(pool.std()) + eps

    token_advantages_group = []
    for traj in group_trajectories:
        traj_tok_advs = []
        for step in traj:
            r_ij = step["score_shot"] + step["score_gui"]       # Eq. 4 即时双维工作区得分
            a_ij = (r_ij - r_mean) / r_std                      # 跨 G 条轨迹全部步骤池化标准化
            # 仅对模型输出的代码编辑块赋优势 a_ij，环境 stdout/stderr 与 VLM 反馈块严格置 0.0
            traj_tok_advs.append({
                "edit_adv": a_ij,
                "env_and_feedback_adv": 0.0,
            })
        token_advantages_group.append(traj_tok_advs)
    return token_advantages_group
```

