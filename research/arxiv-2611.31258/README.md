# 论文精读：RECAP: Training Long-horizon LLM Agents with Context Compaction（arXiv:2611.31258v1）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*RECAP: Training Long-horizon LLM Agents with Context Compaction*
- **作者**：Yulun Jiang, Maria Brbic, Michael Moor（EPFL & ETH Zurich）· 开源代码：`https://github.com/eth-medical-ai-lab/recap`
- **原文**：`https://arxiv.org/html/2611.31258v1` · 本地原件：[paper.html（上游原文）](https://arxiv.org/abs/2611.31258) · 纯文本：[paper.txt（上游原文）](https://arxiv.org/abs/2611.31258) · 元数据与校验：`sources.json`（本地校验清单未发布）
- **整理日期**：2026-11-27 · 关联总报告：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心痛点与压缩交互形式化（§1–§3）

长程多轮 Agent 在工作上下文达到触发预算 $|h_t| \ge L_{\text{trigger}}$ 时必须执行**上下文压缩（Context Compaction）**：拼接固定指令 $q_{\mathrm{comp}}$ 采样交接摘要 $m_t \sim \pi_\theta(\cdot \mid h_t \oplus q_{\mathrm{comp}})$，并将工作上下文重构为保留任务指令 $I$ 与最近 $k$ 轮交互（实验默认 $k=1$）的压缩状态：
$$\tilde{h}_t = \big(I,\; m_t,\; \underbrace{a_{t-k}, o_{t-k}, \dots, a_{t-1}, o_{t-1}}_{\text{保留最近 } k \text{ 轮原始交互}}\big)$$
若仅靠终态成败奖励 $R(\tilde{\tau}) \in \{0,1\}$ 做端到端 GRPO（如 SUPO），存在两大缺陷：① **跨多段信用分配极度稀疏**，一次摘要遗漏关键路径/报错会跨越数十轮乃至后续多次压缩才显现；② **压缩前后策略行为漂移**。RECAP 提出核心准则：**优质摘要应当使压缩上下文诱导的后续动作分布尽可能逼近压缩前完整工作上下文下的自身策略**。

---

## 2. 数学推导、代理假设与多段扩展（§4 & Appendix A–B）

### 2.1 行为失真目标与精确梯度分解（Eq. 8–14 & Appendix A.1–A.2）
对第 $t$ 次压缩后的延续片段 $\sigma_t^+ = (a_t, o_t, \dots)$（直至下次压缩或轨迹结束），记 $s_{i,j}$ 为动作 token $a_{i,j}$ 在 $\sigma_t^+$ 内的共享前缀，定义单次压缩的行为失真与优化目标：
$$D_t(m_t) = \mathbb{E}_{\sigma_t^+ \sim \pi_\theta(\cdot \mid \tilde{h}_t)} \!\left[ \sum_{i \in \sigma_t^+} \sum_{j=1}^{|a_i|} \underbrace{D_{\mathrm{KL}}\!\left(\pi_\theta(\cdot \mid \tilde{h}_t, s_{i,j}) \,\Big\|\, \mathrm{sg}\big[\pi_\theta(\cdot \mid h_t, s_{i,j})\big]\right)}_{d_{i,j}(\theta)} \right], \quad J_{\mathrm{total}}(\theta) = J_{\mathrm{task}}(\theta) + \lambda \mathbb{E}_{m_t}[-D_t(m_t)]$$
固定压缩前上下文 $h_t$，由乘积法则与对数导数恒等式（Appendix A.1 Eq. 17），$\nabla_\theta J_{\mathrm{comp}}(\theta)$ 严格分解为两项：
$$\nabla_\theta J_{\mathrm{comp}}(\theta) = \underbrace{\mathbb{E}_{m_t}\!\left[-D_t(m_t)\nabla_\theta \log \pi_\theta(m_t \mid h_t \oplus q_{\mathrm{comp}})\right]}_{g_{\mathrm{sum}}\text{（摘要失真策略梯度）}} + \underbrace{\mathbb{E}_{m_t}\!\left[-\nabla_\theta D_t(m_t)\right]}_{g_{\mathrm{post}}\text{（压缩后续写对齐梯度）}}$$

### 2.2 定理成立的四大推导假设与实现近似（Appendix A.2 & B.1–B.2）
1. **延续轨迹状态访问分布截断梯度假设（Eq. 18–19）**：展开 $-\nabla_\theta D_t(m_t)$ 包含“策略改变后续前缀访问分布的得分函数项”与“固定前缀下逐 token KL 导数项”（环境转移 $P$ 与 $\theta$ 无关）。RECAP 采用代理目标 $\overline{D}_t(m_t) = \mathbb{E}_{\sigma_t^+ \sim \mathrm{sg}[\pi_\theta(\cdot \mid \tilde{h}_t)]}[\sum_{i,j} d_{i,j}(\theta)]$ 截断高方差状态访问项（等价于自蒸馏折扣因子 $\gamma_{\mathrm{SD}}=0$）。
2. **单采样 Token 对数比无偏内层估计（Eq. 20–21 & Appendix B.1）**：利用 $\sum_v \nabla_\theta p_\theta(v) = 0$，得 $-\nabla_\theta d_{i,j}(\theta) = \mathbb{E}_{v \sim p_\theta}[\log \frac{q(v)}{p_\theta(v)} \nabla_\theta \log p_\theta(v)]$。Appendix B.1 实测表明，直接用采样 token 处的对数概率差（复用 $\pi_{\mathrm{rollout}}$）与计算词表 Top-$k$ 解析近似相比无性能损失，且省去全词表 logits 传输。
3. **组内留一法基线（RLOO）与延续长度归一化（Appendix B.1 Fig. 5）**：源码实现中，为防止长延续段主导梯度，延续 token 优势按延续可训 token 数 $|\sigma_t^+|$ 归一化，而摘要奖励在同题目、同压缩序号组内采用 **Leave-One-Out（RLOO）** 均值做基线 $b_t$：
   $$A^{\mathrm{comp}} = \begin{cases} -\widehat{D}^{\mathrm{mean}}_t - b_t^{\mathrm{RLOO}}, & \text{摘要 token } \in m_t, \quad \widehat{D}^{\mathrm{mean}}_t = \frac{1}{|\sigma_t^+|}\sum_{i,j} \log\frac{\pi_{\mathrm{old}}(a_{i,j}\mid\tilde{h}_t,s_{i,j})}{\pi_{\mathrm{old}}(a_{i,j}\mid h_t,s_{i,j})} \\ \frac{1}{|\sigma_t^+|} \log\frac{\pi_{\mathrm{old}}(a_{i,j}\mid h_t,s_{i,j})}{\pi_{\mathrm{old}}(a_{i,j}\mid\tilde{h}_t,s_{i,j})}, & \text{压缩后动作 token } a_{i,j} \in \sigma_t^+ \end{cases}$$
4. **多次压缩互不重叠与局部固定历史假设（Appendix B.2）**：当轨迹触发多次压缩 $t_1 < \dots < t_K$ 时，第 $c$ 次压缩的教师上下文 $h_{t_c}$ 固定取**该次压缩前瞬时的工作上下文**（即第 2 次压缩的 $h_{t_2}$ 已包含第 1 次摘要 $m_{t_1}$ 与原始段 $\sigma_1$，而非回溯无限长原始全史），各压缩事件作用的 $(m_{t_c}, \sigma_c^+)$ token 区间严格互斥，后段失真不向前段摘要回传梯度。

---

## 3. Appendix D 原始压缩与恢复 Prompt 拆解

```text
# [压缩触发指令 q_comp]（追加在当前对话末尾，禁止调用任何工具，整段回复直接作为交接摘要）
The current task is paused for context compaction. For this turn, write a handoff summary for another agent that will resume the original task.
Include:
- Current progress and key decisions made
- Important context, constraints, or observations
- What remains to be done (clear next steps)
- Any critical data, examples, or references needed to continue
- Be concise, structured, and focused on helping the next agent seamlessly continue the work.
Do not call any tools in this turn. Return only the handoff summary. The entire response will be used as the summary for the next agent.

# [压缩后恢复上下文模板]（清空旧历史与旧摘要，作为新 user 消息注入，后接最近 k=1 轮原始动作与观察）
{original_task_prompt}
Another agent started to solve this problem and produced a summary of its thinking process. You also have access to the actions and observations that were obtained by that agent. Use this to build on the work that has already been done and avoid duplicating work. Here is the summary produced by the other agent, use the information in this summary to assist with your own analysis:
{summary}
{previous k iterations}
```

---

## 4. Appendix C 超参数全表、主实验与 $\lambda$ 敏感度

### 4.1 异步 `VeRL` 训练超参数全表（Appendix C Table 4）

| 配置项 | BrowseComp-Plus | SWE-bench Verified（训练于 SWE-smith） |
|---|---|---|
| **基座模型与硬件** | `Qwen3.5-4B`（关闭 thinking），NVIDIA GH200，`VeRL` 异步 + `vLLM` | 同左（BrowseComp 语义等价裁判为 `Qwen3.8-27B`） |
| **训练 / 验证 / 测试题量** | `300`（筛混合难度，去极简题）/ `100` / `150` | `300`（SWE-smith）/ `100` / `500`（SWE-bench Verified 全集） |
| **工作窗口与压缩上限** | 工作上限 `32K`，最多 `3` 次压缩（等效 `128K`），保留尾部 $k=1$ | 同左；单轮最大输出 `8,192` tokens |
| **最大交互步数** | `100` 步（每轮限调 1 个工具：`search / get_document / finish`） | `200` 步（`bash` 首尾各留 3K 字符，`str_replace_editor` 限 20K 字符） |
| **采样组与批次** | 每步 `16` 个 task group × 组大小 $G=8$（mini-batch `8` groups），`150` 步 | 训练温度 `1.0`；评测 `temp=1.0, top_p=0.95, top_k=20`（4 次均值） |
| **优化器与裁剪** | `AdamW`，`lr=1e-6`，`wd=0.01`，`warmup=0`，`grad_clip=1.0` | 非对称 PPO clip $(\epsilon_{\mathrm{low}}, \epsilon_{\mathrm{high}}) = (0.20, 0.28)$，`Entropy=0`，`Ref-KL=0` |
| **失真权重 $\lambda$ / 损失聚合** | **$\lambda = 0.1$** | **$\lambda = 0.03$**；`trajectory-mean-token-mean` 聚合 |

### 4.2 主实验、两路信号消融与 $\lambda$ 敏感度（Table 1–3 & Fig. 3–4）

| 方法 / 消融设置 | 峰值窗口 | BrowseComp Acc | 工具数 / 摘要长 | SWE-Verified Acc | 工具数 / 摘要长 |
|---|---|---:|---:|---:|---:|
| Base `Qwen3.5-4B`（无压缩 / 开启压缩） | 128K / 32K | 49.2% / 40.7% | — | 49.8% / 45.8% | — |
| Task-Only GRPO（无压缩全窗口上界） | 128K | 63.8 ± 3.0% | — | 55.5 ± 1.2% | — |
| Task-Only Compaction-GRPO（无 $g_{\mathrm{sum}}, g_{\mathrm{post}}$） | 32K (×4) | 58.2 ± 1.5% | 23.4 / 1,146 | 46.8 ± 1.4% | 158.9 / 966 |
| + 仅 $g_{\mathrm{sum}}$（只训摘要失真奖励） | 32K (×4) | 56.7% | 23.5 / **1,788**（摘要膨胀） | 47.9% | 180.3 / 917 |
| + 仅 $g_{\mathrm{post}}$（只做压缩后自蒸馏） | 32K (×4) | 60.3% | 21.2 / 468 | 47.1% | 142.3 / 557 |
| **+ RECAP（$g_{\mathrm{sum}} + g_{\mathrm{post}}$ 联合）** | **32K (×4)** | **62.8 ± 3.9%**（**+4.6 pp**） | **19.9** / 709 | **51.1 ± 1.0%**（**+4.3 pp**） | **145.6** / 1,003 |

- **$\lambda \in \{0.03, 0.1, 0.3, 1.0\}$ 敏感度（Table 3 & Fig. 4）**：`BrowseComp` 对 $\lambda$ 平稳单调（测试集 `60.0% / 62.8% / 62.3% / 62.3%`）；而交互长达 ~150 轮的 `SWE` 对过大 $\lambda$ 敏感（测试集 **`51.1%` (`0.03`)** vs `46.3%` (`0.1`) / `46.5%` (`0.3`) / `49.8%` (`1.0`)），长程代码任务宜取小权重 $\lambda = 0.03$。
- **跨窗口泛化（Fig. 3）**：固定总预算 `128K`，在极紧 `16K×8` 高频压缩下 RECAP 仍保持 `60%–63%`，并在所有需压缩窗口上全面反超 `128K` 无压缩训练的 GRPO checkpoint。

---

## 5. `VeRL` 不爆显存计算 Teacher-Forcing Logprobs 与我方三轨落地伪代码

### 5.1 为什么拼接 $h_t$ 算教师对数概率不会 OOM？
1. **教师长度天然封顶 $\le 2 L_{\text{work}}$（而非整条轨迹累加）**：由 Appendix B.2，第 $c$ 次压缩的 $h_{t_c}$ 只是压缩触发前那一刻的工作窗口（$\le 32\text{K}$），延续段 $\sigma_c^+$ 也 $\le 32\text{K}$，故单事件拼接序列 $h_{t_c} \oplus \sigma_c^+$ 最长仅 `64K`（绝非 $4\times 32\text{K}$）。
2. **纯 `no_grad` + 仅 Gather 采样 Token 标量**：教师分支复用 rollout 权重做一次 `torch.no_grad()` 前向，无需保存反向激活图，且在词表维原地 `gather` 采样动作 token 的 logprob 后立即释放 `[B, L, V]` logits。
3. **适配我方 `Qwen3.8-27B`（`384K` 多模态）的局部裁剪技巧**：我方在 [xhs-threejs-segment-audit](../../3d-animation-agent/reports/xhs-threejs-segment-audit-20261126/REPORT.md) 中 `1,206 / 1,209`（`99.8%`）自然收尾轨迹触发 `auto-compact`，单段含图总长达 `287K–392K`（[XHS-UNIFIED-SFT-STANDARD.md](../../3d-animation-agent/docs/XHS-UNIFIED-SFT-STANDARD.md)）。若直接把两段 `384K` 含图序列硬拼会达 `768K`；工程上构造教师上下文 $h_t^{\mathrm{local}}$ 时，**保留压缩前完整代码/报错文本 + 仅保留最近 $M_{\mathrm{img}}=4$ 张关键截图（剥离更早历史截图，每张省 ~512 视觉 token），并只截取压缩后前 $M_{\mathrm{turn}}=6$ 个关键恢复轮次算失真 KL**，总长稳控在 `≤384K` YaRN 窗内！

```python
# RECAP 压缩失真优势 + 局部多模态裁剪计算（适配 VeRL / ms-swift 异步管线）
import torch

@torch.no_grad()
def compute_teacher_logprobs_no_oom(actor_engine, h_t_pruned_ids, cont_ids, cont_action_mask):
    # h_t_pruned_ids: 压缩前工作上下文（保留全部代码/终端输出 + 最近 4 张渲染图，总长 <= 220K）
    # cont_ids: 压缩后恢复段前 M_turn=6 轮序列（总拼接长度严格 <= 384K，开启 ulysses SP）
    full_ids = torch.cat([h_t_pruned_ids, cont_ids], dim=-1)
    logits = actor_engine.forward_logits_chunked(full_ids)          # no_grad 下无需存激活图
    cont_logits = logits[:, h_t_pruned_ids.size(1) - 1 : -1, :]
    logp_all = torch.log_softmax(cont_logits, dim=-1)
    teacher_logp = logp_all.gather(-1, cont_ids.unsqueeze(-1)).squeeze(-1)
    del logits, cont_logits, logp_all
    return teacher_logp * cont_action_mask                          # 仅保留可训 assistant 动作位

def build_recap_joint_advantage(batch, lam=0.03, eps=1e-6):
    old_logp = batch.rollout_logprobs                               # [N_traj, L_max]
    comp_adv = torch.zeros_like(old_logp)
    # 1. 逐压缩事件计算采样逆向 KL 与延续段自蒸馏优势（按延续段有效 token 数归一化，对齐源码 Fig.5）
    group_distortions = {}                                          # key: (task_id, comp_idx) -> list[(traj_i, sum_slice, r_sum)]
    for ev in batch.compaction_events:
        idx = ev.cont_action_token_indices                          # 压缩后动作 token 索引（已排除异常 mask 轮）
        sampled_kl = old_logp[ev.traj_i, idx] - ev.teacher_logprobs[idx]
        r_sum = -sampled_kl.mean()                                  # 标量负失真奖励
        comp_adv[ev.traj_i, idx] = -sampled_kl / max(len(idx), 1)   # g_post: log(pi_teacher / pi_student) / |idx|
        group_distortions.setdefault((ev.task_id, ev.comp_idx), []).append((ev.traj_i, ev.summary_token_indices, r_sum))

    # 2. 同题同压缩序号组内 Leave-One-Out (RLOO) 摘要基线
    for _, items in group_distortions.items():
        if len(items) <= 1:
            continue
        vals = torch.stack([x[2] for x in items])
        loo_mean = (vals.sum() - vals) / (len(items) - 1)
        for k, (traj_i, sum_idx, r_sum) in enumerate(items):
            comp_adv[traj_i, sum_idx] = r_sum - loo_mean[k]         # g_sum: 广播给 <summary> 全部可训 token

    # 3. 与终态任务组相对优势叠加，并配合全批次可训 token 级归一化更新（融汇 CompactionRL 铁律）
    task_adv = batch.grpo_task_advantages                           # (R_i - mu_G) / (std_G + eps)
    return (task_adv + lam * comp_adv).detach()
```
