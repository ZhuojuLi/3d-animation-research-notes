# 论文精读：CompactionRL: Reinforcement Learning with Context Compaction for Long-Horizon Agents（arXiv:2607.05378v2）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*CompactionRL: Reinforcement Learning with Context Compaction for Long-Horizon Agents*
- **作者**：Yujiang Li, Zhenyu Hou, Yi Jing, Jie Tang, Yuxiao Dong（Tsinghua University & Z.AI）
- **原文**：`https://arxiv.org/html/2607.05378v2` · 本地原件：[paper.html（上游原文）](https://arxiv.org/abs/2607.05378) · 纯文本：[paper.txt（上游原文）](https://arxiv.org/abs/2607.05378) · 元数据与校验：`sources.json`（本地校验清单未发布）
- **整理日期**：2026-11-27 · 关联总报告：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心动机与前置诊断实验（§1 & §3.1）

工业级长程 Coding Agent（包括开源旗舰 **`GLM-5.2` (`750B-A40B`)** 的生产 RL 管线，以及我方 `99.8%` 触发 `auto-compact` 的三轨沙盒工程）普遍在上下文剩余预算不足时触发摘要压缩。作者用两组前置对照实验证明压缩绝非“仅推理期启发式插件”：
1. **摘要质量直接卡死任务上限（Table 1）**：固定执行 Agent 为 `GLM-4.7-Flash`（`30B-A3B`），仅替换写摘要的模型，`SWE-bench Verified` Pass@1 从 `Qwen3-30B-A3B` 的 `49.0%`（均触发 `1.126` 次）跃升至 `Qwen3.5-27B` 的 **`55.5%`（`+6.5 pp`，触发降至 `1.010` 次）**。
2. **无压缩 RL 迁移至压缩推理时严重退化（Table 2）**：`GLM-4.7-Flash` 经标准无压缩 PPO 后单窗达 `52.5%`，但评测一旦开启推理压缩直接掉回 **`48.2%`（`-4.3 pp`）**，`Terminal-Bench 2.0` 从 `16.9%` 跌至 `12.4%`（`-4.5 pp`）。

---

## 2. 核心算法机制与梯度方差/偏置解析（§3.1–§3.2）

### 2.1 原子步切分与压缩触发机制（Eq. 1–4）
将每轮 `(assistant_response, tool_observation)` 绑定为不可拆分的原子步 $z_i = (a_i, o_i)$（杜绝工具调用与返回结果被压缩劈开）。设峰值工作上下文为 $C$，当剩余预算满足：
$$C - |h_t| < T_{\mathrm{comp}} \quad (\text{默认 } T_{\mathrm{comp}} = 10,240\text{ tokens，等于单轮最大输出上限})$$
追加摘要指令 $q_{\mathrm{sum}}$ 由当前策略生成摘要段 $S_t$，随后重构上下文 $\bar{h}_t = s \oplus u_{\mathrm{resume}}(S_t) \oplus (z_{t-k+1}, \dots, z_t)$（默认保留最近 **$k=2$** 个原子步；超预算时自适应递减 $k$），单条 rollout 最多压缩 **3 次**（最多拆为 `4` 个执行段 + `3` 个摘要段 = `7` 个可训 segment，等效窗口扩展至 $4\times C$）。

### 2.2 为什么“段均值归一化”会暴跌 `-6.4 pp`？——双重权重偏置与梯度方差解释
令全局批次内所有执行段与摘要段的可训 assistant token 集合为 $\mathcal{M}$，`CompactionRL` 强制采用**全局可训 Token 级损失归一化（Eq. 5）**：
$$\mathcal{L}_\pi(\theta) = -\frac{1}{|\mathcal{M}|}\sum_{(s,i)\in\mathcal{M}} \min\!\Big(\rho_{s,i}(\theta)\widehat{A}_{s,i},\; \mathrm{clip}\big(\rho_{s,i}(\theta), 1-\epsilon, 1+\epsilon\big)\widehat{A}_{s,i}\Big)$$
若退回传统的“先段内对长度 $n_s$ 求平均、再跨段求平均” $\mathcal{L}_{\mathrm{seg}} = -\frac{1}{|\mathcal{B}_{\mathrm{seg}}|}\sum_s \frac{1}{n_s}\sum_{i=1}^{n_s} \ell_{s,i}$，会同时引爆两重梯度灾难（Table 3 实测 `SWE` 从 `66.4%` 暴跌至 `60.0%`，`Terminal-Bench` 从 `26.2%` 跌至 `21.3%`）：
1. **段数膨胀偏置（Segment-Count Bias）**：一次成功的紧凑轨迹仅有 $K=1$ 个执行段；而反复报错打转触发 3 次压缩的烂尾轨迹会裂变为 **$K=7$ 个训练段**，在相同终态奖励幅值下对批次梯度的总推力是单段轨迹的 **$7\times$**！
2. **短摘要段梯度方差放大（`10–30×` Per-Token Weight Inflation）**：摘要段长度 $n_{\mathrm{sum}} \approx 500\text{–}1,500$ tokens，远短于执行段 $n_{\mathrm{exec}} \approx 10\text{K–}30\text{K}$ tokens。按 $\frac{1}{n_s}$ 段内平均时，每个摘要 token 被赋予了比执行 token 高 **`10–30 倍`的逐 token 梯度乘子**，将终态稀疏奖励方差剧烈放大并灌入 `<summary>`，导致策略熵失控。

### 2.3 跨段广义优势估计（Cross-Segment GAE）与自适应 $(\gamma, \lambda)$（Eq. 6–10）
由于压缩前后上下文状态突变且各段在批次中并行独立计算 TD 残差，若直接在每段末尾放置终态奖励 $R(\tau)$ 算局部 GAE，第 1 段的行动与摘要会被当成“距离终点仅一步之遥”而过度归因。设第 $s$ 段含 $n_s$ 个可训 token，其后同轨迹所有段的可训 token 总数为 $N_{>s} = \sum_{j>s} n_j$，定义跨段位置修正优势：
$$A^{\mathrm{loc}}_{s,i} = \sum_{\ell=0}^{n_s - i} (\gamma\lambda)^\ell \delta_{s, i+\ell}, \qquad \widehat{A}_{s,i} = (\gamma\lambda)^{N_{>s}} A^{\mathrm{loc}}_{s,i}$$
从而使终态奖励回传至 $(s,i)$ 的总折扣恰为 $(\gamma\lambda)^{N_{>s} + n_s - i}$，严格还原其在拼接完整轨迹中的真实时间步距离，同时无需跨段串行回传 TD 残差！其中超参取 **$\gamma = 1.0$** 及 VAPO **长度自适应 GAE**：
$$\lambda(l) = 1 - \frac{1}{\alpha l}, \qquad \alpha = 1.5 \quad \big(\text{使段首折扣 } (\gamma\lambda)^l \approx e^{-1/1.5} \approx 0.513 \text{，避免万字长段指数归零}\big)$$

### 2.4 单样本异步 PPO（`slime`）与 `GLM-5.2` 生产部署细节
- **消除组等待与策略滞后**：压缩使同题不同 rollout 的生成耗时相差数倍；组方法（SUPO，$G=8$）必须苦等组内最慢压缩轨迹跑完，既拉高 GPU 空转（`1,600` vs `1,472` GPU-hrs，Table 7）又加剧异步 off-policy 滞后（SWE 低 `4.6 pp`）。`CompactionRL` 遵循 SAO 采用 **$G=1$ 单样本异步 PPO + 同源初始化 Critic**（RL 前先做 `50` 步 Value 预训练，RL 期每批做 **2 次 Critic 更新 + 1 次 Actor 更新**），并直接落地于开源旗舰 **`GLM-5.2`（`750B-A40B`）** 的长程 Agent RL 生产线。

---

## 3. Appendix A.3 原始摘要与恢复 Prompt 拆解（与 Claude Code 100% 同构！）

> **惊人发现**：`CompactionRL` 附录 A.3 的 $q_{\mathrm{sum}}$ 与我方小红书 `claude --bare` 原生触发的 `<analysis> + <summary>` 9 节结构逐字同源！这直接印证了我方在 SFT 与 RL 中保留 `compact_before` 摘要轮监督的正确性。

```text
# [摘要生成指令 q_sum]（禁止假设可读外部文件或调工具，强制先 <analysis> 后 9 节 <summary>，禁输出 JSON）
Your job is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and the work already completed.
Original task: {ORIGINAL_INSTRUCTION}
You are summarizing the earlier portion of the conversation only. {RECENT_MESSAGE_NOTE} will remain in the conversation verbatim, so do not repeat them in detail unless they are required for continuity.
Do not assume you can read external files or use tools. Work only from the conversation provided in this context.
Before providing the summary, think through what matters most to preserve. Write the response using exactly these tags:
<analysis>Brief internal reasoning about what to preserve.</analysis>
<summary>Your summary here.</summary>
Inside <summary>, organize the content so the next model can continue without reading any external files. Include:
1. Primary Request and Intent   2. Key Technical Concepts   3. Files and Code Sections examined or changed
4. Errors encountered and how they were addressed   5. Problem Solving and important decisions
6. All user messages and explicit asks from the summarized portion   7. Pending Tasks   8. Current Work   9. Optional Next Step
Be concrete. Preserve exact commands, outputs, code behavior, and error text when those details matter for the work to continue. Do not output JSON.

# [压缩后恢复提示 u_resume(S_t)]（拼接系统提示 s + 本模板 + 最近 k=2 轮逐字交互）
This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.
{SUMMARY_TEXT}
Recent messages are preserved verbatim below and should be treated as the source of truth for the latest state.
Continue the conversation from where it left off without asking any further questions. Resume directly from this summary and the preserved recent messages.
```

---

## 4. Appendix A–C 训练超参、消融与五维摘要质量审计

### 4.1 `slime` 异步训练配置与算力账本（Appendix A.2 Table 6–7）

| 配置项 | `GLM-4.7-Flash`（`30B-A3B`, 64 experts top-4） | `GLM-4.5-Air-SFT`（`106B-A12B`, 128 experts top-8） |
|---|---|---|
| **窗口与压缩规则** | 峰值 $C=64\text{K}$，$T_{\mathrm{comp}}=10,240$，单轮限 `10,240`，最多 `3` 次压缩，尾留 $k=2$ | 峰值 $C=80\text{K}$（等效 `320K`），其余完全一致 |
| **Actor / Critic 优化** | Actor `lr=2e-6`（Adam $\beta=(0.9,0.98)$, `wd=0.1`）；Critic `lr=3e-6`（50 步预热，2:1 更新比），`KL=0` | 全局 Batch = `128` segments，$G=1$，训练集 `SWE-Dev`（`1,405` prompts） |
| **硬件与训练耗时** | `64×H800`（32 卡训 Actor+Critic，32 卡异步采样），`180` 步 / `15h`（`960` GPU-hrs） | `100` 步 / `23h`（`1,472` GPU-hrs，共 `11,092` rollouts / `442M` 生成 tokens） |

### 4.2 主表、消融与推理超参鲁棒性（Table 2–4 & Appendix B–C Table 8–9）

| 模型与方法（SWE 为固定 200 题子集 3 次均值） | SWE-bench Verified | Terminal-Bench 2.0 | 关键诊断结论 |
|---|---:|---:|---|
| `GLM-4.7-Flash`（64K 推理压缩 Base / 无压缩 RL 开压缩） | 50.5 ± 1.2% / 48.2 ± 0.5% | 13.5 ± 0.9% / 12.4 ± 0.9% | 无压缩 RL 开推理压缩反掉点 |
| + CompactionRL（mask 摘要 loss / **全量联合训练**） | 54.5 ± 1.2% / **56.0 ± 0.4%** | 12.4 ± 0.0% / **20.2 ± 0.9%** | 不训摘要在终端长任务零收益（**`-7.8 pp`**） |
| `GLM-4.5-Air`（80K 推理压缩 Base / 160K 长窗无压缩 RL） | 59.8 ± 1.9% / 62.8 ± 2.8% | 21.3 ± 1.6% / 23.2 ± 2.8% | 80K×4 可训压缩反超 160K 长窗 RL **`+3.6 pp`** |
| + SUPO（组采样 GRPO 压缩基线，1,600 GPU-hrs） | 61.8 ± 1.8% | 21.3 ± 0.9% | 组等待滞后 + 无跨段逐 token 归因 |
| **+ CompactionRL（80K×4 完整版）** | **66.4 ± 0.7%** | **26.2 ± 2.1%** | 摘要长度与每轮推理 token 随训练稳步增长 |
| $\quad -$ 去掉全局 Token 级归一化（改用段平均） | **60.0 ± 1.2%**（**-6.4 pp**） | **21.3 ± 2.4%**（**-4.9 pp**） | 多段烂尾与短摘要偏置抹平全部 RL 增益 |
| $\quad -$ 去掉跨段 GAE 位置修正 | 63.0 ± 1.4%（-3.4 pp） | 22.5 ± 2.4%（-3.7 pp） | 早期段承受未折扣终态噪声 |

- **推理超参敏感度（Table 8）**：`80K` 训完模型在 `32K / 64K / 80K` 下分别达 `63.0% / 65.5% / 66.4%`；甚至裁掉保留尾部（$k=0$ vs $k=2$）仍保持 `66.0%` vs `66.4%`，证明学出的 `<summary>` 已完整承载核心状态。
- **五维摘要审计与三大败因（Appendix C Table 9，`claude-opus-5` 评判）**：总分从 `3.30` 升至 `3.52`（`0–2` 低分烂摘要占比从 **`22.2%` 腰斩至 `11.9%`**，双压缩子集解决率 `28.57% -> 38.10%`），显著消除了未训摘要的三大顽疾：① 漏记/误诊历史报错根因；② 把临时调试改动误记为终态代码；③ 局部测试跑通即虚报全部需求已完成。

---

## 5. 对接我方 `ms-swift` / `VeRL` 三轨 27B 训练的直接落地伪代码

我方在 [XHS-UNIFIED-SFT-STANDARD.md](../../3d-animation-agent/docs/XHS-UNIFIED-SFT-STANDARD.md) 中已将长轨迹按 `compact_before`（含末尾摘要生成）与 `compact_recovery`（恢复精修段）切分。进入后 SFT 的 RL 阶段时（无论采用 Critic-PPO 还是无 Critic 的 `GSPO-token`），必须直接搬入 **`CompactionRL` 的两大无参铁律**：① `compact_before` 摘要轮纳入梯度；② **全批次按有效可训 token 总数 $|\mathcal{M}|$ 归一化 + 跨段 $(\gamma\lambda)^{N_{>s}}$ 衰减**！

```python
# 跨压缩段优势折扣 + 全局可训 Token 归一化损失（无缝兼容 PPO 与无 Critic 组方法）
import torch

def compute_compacted_segment_loss(segments_batch, clip_low=0.20, clip_high=0.28, alpha_gae=1.5):
    """
    segments_batch: 同一全局 step 内拆出的全部可训段（含 compact_before 执行+摘要段、compact_recovery 段）
    每个 seg 包含: rollout_id, seg_idx, logp_new, logp_old, loss_mask (已置 0 屏蔽环境返回与 5 类坏轮), local_adv
    """
    # 1. 统计每条完整轨迹各段的可训 token 数 n_s，计算后续段剩余可训 token 总数 N_{>s}
    traj_to_segs = {}
    for seg in segments_batch:
        traj_to_segs.setdefault(seg.rollout_id, []).append(seg)

    total_trainable_tokens = 0
    surrogate_sum = 0.0

    for _, segs in traj_to_segs.items():
        segs.sort(key=lambda x: x.seg_idx)                          # 按压缩时序 s = 1 .. K 排列
        seg_token_counts = [int(s.loss_mask.sum().item()) for s in segs]
        total_traj_tokens = max(sum(seg_token_counts), 1)
        # VAPO 长度自适应 trace 参数: gamma = 1.0, lam = 1 - 1 / (alpha * L_traj)
        lam_trace = max(1.0 - 1.0 / (alpha_gae * total_traj_tokens), 0.99)

        suffix_tokens = total_traj_tokens
        for s_idx, seg in enumerate(segs):
            n_s = seg_token_counts[s_idx]
            suffix_tokens -= n_s                                    # N_{>s} = sum_{j > s} n_j
            if n_s == 0:
                continue
            cross_seg_discount = (lam_trace ** suffix_tokens)       # (gamma * lambda)^{N_{>s}} 跨压缩边界折扣
            adv = (cross_seg_discount * seg.local_adv).detach()

            ratio = torch.exp(seg.logp_new - seg.logp_old)
            clipped = torch.clamp(ratio, 1.0 - clip_low, 1.0 + clip_high)
            tok_loss = -torch.minimum(ratio * adv, clipped * adv) * seg.loss_mask

            surrogate_sum = surrogate_sum + tok_loss.sum()
            total_trainable_tokens += n_s

    # 2. 铁律：除以全局可训 token 总数 |M|（严禁先除 n_s 再跨段求均值，防止多压缩烂尾轨迹 7x 放大！）
    return surrogate_sum / max(total_trainable_tokens, 1)
```
