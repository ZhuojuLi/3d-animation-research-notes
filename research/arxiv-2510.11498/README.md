# ReLook（arXiv:2510.11498v1，ACL 2026）深度精读：行为坍缩防治、强制单调接收与 $\gamma=0.1$ 免裁判自反思蒸馏

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> - **论文标题**：*ReLook: Vision-Grounded RL with a Multimodal LLM Critic for Agentic Web Coding*（2025-10-13，发表于 ACL 2026 Long Papers pp. 25471–25485）
> - **作者与机构**：Yuhang Li, Chenchen Zhang, Ruilin Lv, Ao Liu, Ken Deng, Yuanxing Zhang, Jiaheng Liu, Wiggin Zhou, Bo Zhou（腾讯混元 LLM Department、北京大学、南京大学）
> - **原文与本地归档**：[arXiv:2510.11498v1](https://arxiv.org/abs/2510.11498v1) · [paper.html（上游原文）](https://arxiv.org/abs/2510.11498) · [paper.txt（上游原文）](https://arxiv.org/abs/2510.11498) · `sources.json`（本地校验清单未发布）
> - **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者亲踩的初始大坑

前端与可视化编码（HTML/CSS/JS/SVG）的质量由渲染像素与动态交互决定。腾讯混元团队训练策略主动吐出 `<get_feedback>` 工具标记、调用冻结 72B 多模态大模型（`Qwen2.5-VL-72B-Instruct`）形成“生成 → 时序截图诊断 → 迭代精修”闭环时，亲历并攻克了多轮视觉 Agent RL 中最凶险的三大深坑：

1. **多轮越改越差的“行为坍缩（Behavioral Collapse）”与“负分惩罚致死不调 `<get_feedback>`”反噬大坑（§2.6 & Appendix E 完整复盘）**：
   - **原始塌陷**：即便 `Qwen2.5-VL-72B` 给出了精准详细的视觉改进建议，指令微调基座在修到第 2–3 轮后仍频繁把原本能跑的页面改坏、分数倒退（Fig. 4）。
   - **作者亲踩的失败方案（Appendix E）**：为阻止越改越烂，作者起初对“精修后得分低于精修前”的步骤施加**负奖励惩罚（Negative-Reward Penalty）**。结果引发致命 **Reward Hacking**：**策略迅速顿悟“只要第一轮写完立刻停止、死活不输出 `<get_feedback>` 请求视觉反馈，就永远不会触发改坏扣分！”** 反思调用频次迅速归零，多轮 Agentic RL 彻底退化成单轮 RL，性能大幅受损！
2. **不可渲染坏代码的骗分通道与早期稀疏奖励**：缺乏严格渲染门槛时，语法貌似合理但白屏/超时的代码会从文本或宽松裁判处骗取正分；而初期基座有效渲染率（Valid Render Rate）仅约 **`40%`**。
3. **推理期挂载 72B MLLM + 浏览器截图带来 `6.82×` 延迟灾难（§3.5）**：在线部署时若每轮反思都跑无头 Chromium 抓 3 张时序图并调 8×H20 上的 `Qwen2.5-VL-72B`，单题平均耗时高达 **`123.04 秒`**，难以满足实时交互需求。

---

## 2. 方法论、精确数学公式与验证器工程实现（含 Appendix 超参/Prompt/防刷分细节）

### 2.1 安全确定性三时序截图沙盒、无效截图清零铁律与长度惩罚（§2.3, §2.5, §3.1）

1. **OS 级断网禁危险 API 沙盒与三时序动态抓拍（§3.1）**：
   - 轨迹格式为 $o = [t_1 \oplus c_1 \oplus m_1 \oplus \dots \oplus t_R \oplus c_R]$（上限 $R=3$ 轮）；每遇 `<get_feedback>`，在禁文件系统、禁外网的無头 Chromium 中运行 `<answer>` 代码块；
   - **确定性与防卡死加固**：拦截并封禁 `window.open`、`alert/confirm/prompt`、`eval/Function`、剪贴板及非本地 `fetch/XMLHttpRequest/WebSocket`；所有外部字体与图片替换为本地缓存 fixture，定时器与动画固定确定性随机种子；自动适配全页尺寸抓拍 **$T=3$ 个时间点 `{post-load, +1s, +2s}` 的时序截图 $\{S_1, S_2, S_3\}$**，一次性送入 72B Critic 打单轮视觉分，轨迹总分为各轮均值（训练期归一化至 $[0,1]$，评测报告采用 `ArtifactsBench` `[0,100]` 量纲）。
2. **无效截图严格清零铁律 + 线性防复读长度惩罚（Eq. 3–5）**：
   - **零分铁律**：只要 `{S_1, S_2, S_3}` 中任意一张因渲染报错、超时或白屏而无效，奖励无条件置 `0`（配合 Prompt 显式可渲染指令，训练收敛时有效渲染率从 **`~40%` 跃升至 `~80%`**，Appendix G）：

$$
R_{\text{MLLM}}(o) = \begin{cases} \operatorname{VisualScore}(o), & \text{if screenshot valid} \\ 0, & \text{otherwise} \end{cases}, \qquad R_{\text{len}}(o) = \begin{cases} 1, & \operatorname{len}(o) < L_{\text{start}} \\ \dfrac{L_{\text{end}} - \operatorname{len}(o)}{L_{\text{end}} - L_{\text{start}}}, & L_{\text{start}} \le \operatorname{len}(o) \le L_{\text{end}} \\ 0, & \operatorname{len}(o) > L_{\text{end}} \end{cases}
$$

$$
R_{\text{ReLook}}(o) = R_{\text{MLLM}}(o) \cdot R_{\text{len}}(o) \qquad \big(L_{\text{start}} = 12{,}000,\ L_{\text{end}} = 14{,}000\text{ tokens}\big)
$$

### 2.2 Forced Optimization：轨迹内在线严格单调递增接收算法（§2.6 & Appendix C Algorithm 1, E, G）

废除一切回退负惩罚，改用**在线轨迹内严格单调拒绝采样**（核心伪代码对齐 Appendix C Algorithm 1）：
- 初始化历史最高分 $s_{\text{prev}} \leftarrow -1$；在第 $r < R$ 轮反思循环中，最多重采样 **$K = 10$ 次**：
  1. 采样候选修订 $t_r, c_r \sim \pi_\theta(\cdot \mid \text{history})$，沙盒渲染抓拍 $\{S_1, S_2, S_3\}$，由 72B MLLM 生成反馈 $m_r$ 与视觉分 $s_r$；
  2. **严格大于准入（无 $\varepsilon$ 裕度、不二次重评）**：**仅当 $s_r > s_{\text{prev}}$ 时**，才接纳 $(t_r, c_r)$ 与 `<mllm_feedback>` $m_r$ 写入 `history` 和轨迹 $o$，更新 $s_{\text{prev}} \leftarrow s_r$ 进入下一轮；
  3. 若连续 $K=10$ 次采样均满足 $s_r \le s_{\text{prev}}$，立即 `break` 终止该轨迹后续反思，保留当前已达成的最佳前缀直接参与 GRPO 更新。
- **机制红利**：保证每条入训多轮轨迹严格单调变好（8 轮强制测试一路爬升不崩，Fig. 4），同时绝不惩罚主动调工具行为，反思频次在训练中自然上升并稳定收敛在 **`~2` 轮**（Fig. 5）。

### 2.3 Critic Token 优势掩码、$\gamma=0.1$ 轻量反馈蒸馏与三视图去重（§2.4, §3.1 & Appendix F, G）

1. **GRPO 外部 Token 零优势掩码 + 优势裁剪**：仅策略自产 token $(t,c)$ 享有非零组相对优势（Batch 内标准化后裁剪至 **`[-2, 2]`**）；对所有外部 MLLM 反馈 token $t \in M$ 强制置 **$\hat{A}_{i,t} = 0$**。
2. **$\gamma=0.1$ 教师强制反馈蒸馏实现“训慢推快”（Appendix F Eq. 6–8）**：在 $t \in M$ 位置用轻量交叉熵蒸馏冻结 72B 教师分布 $q_t(\cdot)$，将视觉挑刺思维模式内化进学生模型权重：

$$
\mathcal{L}_{\text{distill}}^{m} := \frac{1}{|M|}\sum_{t\in M}\mathrm{KL}\!\big(q_t(\cdot)\,\|\,p_\theta(\cdot\mid x_{\le t})\big) = -\frac{1}{|M|}\sum_{t\in M}\sum_{v} q_t(v)\log p_\theta(v\mid x_{\le t})
$$

$$
\mathcal{L}(\theta) = -\mathcal{J}_{\text{GRPO}}^{t,c}(\theta) + \gamma\,\mathcal{L}_{\text{distill}}^{m}(\theta), \qquad (\text{默认 }\gamma = 0.1,\ \text{敏感度扫描 }\gamma \in [0.05, 0.3])
$$

   推理期直接切为 **`ReLook-w/o-MLLM`**：完全关闭浏览器截图与 72B MLLM 调用，仅靠内化自反思做 $\le 3$ 轮纯文本轻量自编辑！
3. **三视图防泄漏去重（§3.1）与跨裁判解耦（Appendix B）**：3,000 道训练题对全部评测集执行三道硬去重（触发任一即剔除，边界 `[0.80, 0.85]` 人工复审）：① 字符 3-gram TF-IDF 余弦 **`> 0.85`**；② DOM 标签二元组 Jaccard **`> 0.90`**（辅以树编辑距离）；③ 去注释压缩代码 token Jaccard **`> 0.90`**。训练 Critic 用开源 `Qwen2.5-VL-72B`，离线评测严格解耦为闭源 **`Gemini-2.5-Pro`**（与人类专家一致率 `>90%`、$\kappa > 0.85$，与 WebDev Arena 10K 众包对决 Spearman $\rho = 0.87$）。

---

## 3. 实验口径、完整超参数表与主消融硬数据（事实）

### 3.1 训练与部署硬件超参数表（§3.2, §3.5 & Appendix G）

| 类别 | 参数项 | 精确配置数值 |
| --- | --- | --- |
| **基座与集群** | 模型 / 训练算力 / 单步耗时 | `Qwen2.5-7B-Instruct` & `Llama-3.1-8B-Instruct`；`64 GPUs`（32 策略 + 32 跑 72B Critic），约 `80 min/step`，最多 **`40` 步** |
| **GRPO 与蒸馏** | Batch / $G$ / LR / Clip / KL / $\gamma$ | Batch **`256`**，$G=8$，LR **`1e-6`**（5% warmup + cosine），$\varepsilon=0.2$，Adv Clip **`[-2, 2]`**，KL $\beta\in[0.01,0.05]$，蒸馏 **$\gamma=0.1$** |
| **反思与部署** | 轮数 $R$ / 重采 $K$ / 在线测速配置 | $R=3,\ K=10$，长度罚 `12k–14k`；测速用 vLLM：`4× H20` 跑 7B + `8× H20` 跑 72B，并发线程 `1`，测 100 题均值 |

### 3.2 八大评测集主表（Table 1）、核心组件消融（Table 2）与推理提速硬数据（§3.5）

| 模型 / 变体（3 随机种子均值，$T=1.0, p=0.7$） | A-Lite ↑ | A-Easy ↑ | A-Game ↑ | A-SVG ↑ | A-Web ↑ | A-Si ↑ | FullStack-Html ↑ | Web-Bench (pass@2) ↑ | 单题延迟 ↓ |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| *参考模型*：`Qwen2.5-32B-Instruct` / `GPT-4o` | 25.73/33.25 | 33.52/34.23 | 24.36/33.04 | 26.36/33.74 | 27.34/34.31 | 25.30/31.44 | 70.00 / 71.25 | 10.90 / 23.80 | — |
| `Llama-3.1-8B-Instruct`（Base） | 21.04 | 27.11 | 19.25 | 20.33 | 21.91 | 19.18 | 57.50 | 2.50 | — |
| `Llama-3.1-8B-Web-RL`（单轮视觉 RL） | 21.67 | 29.80 | 20.61 | 21.64 | 23.15 | 20.44 | 61.75 | 2.75 | — |
| `Llama-3.1-8B-ReLook-w/o-MLLM`（免裁判自改） | 22.32 | 30.52 | 21.18 | 22.41 | 24.03 | 22.97 | **63.75** | **2.90** | 极速免图 |
| **`Llama-3.1-8B-ReLook`（完整版）** | **23.08** | **31.86** | **22.04** | **22.74** | **25.42** | **24.52** | **63.75** | **2.90** | — |
| `Qwen2.5-7B-Instruct`（Base） | 21.59 | 30.70 | 20.62 | 17.70 | 25.69 | 18.61 | 65.00 | 3.00 | — |
| *消融 1*：`+ MLLM Reward`（即 `Web-RL`） | 24.89 (+3.30) | 32.64 | 22.14 | 18.87 | 26.73 | 18.82 | 63.25 | 3.48 | — |
| *消融 2*：`+ Format Constraint`（无效截图清零） | 25.84 (+0.95) | — | — | — | — | — | — | — | VRR `40%→80%` |
| **`Qwen2.5-7B-ReLook-w/o-MLLM`（免裁判部署）** | **25.44** | **33.29** | **23.05** | **18.92** | **27.11** | **22.15** | **67.50 (+2.50)** | **4.20 (+40% rel)** | **`18.03s`（省 85.3%！）** |
| **`Qwen2.5-7B-ReLook`（`+ Forced Opt.` 完整版）** | **27.88 (+6.29)** | **34.12** | **26.72 (+6.10)** | **20.92 (+3.22)** | **28.31** | **26.36 (+7.75)** | **67.50** | **4.20** | `123.04s` |

- **人工双盲 GSB 盲评（§3.2）**：5 名标注员实跑 100 道随机题对比 `Qwen2.5-7B-ReLook` vs `Base`，多数票结果为 **G : S : B = `50 : 30 : 20`**（净胜 `+30%`）。

---

## 4. 对我们 Qwen3.8-27B 三轨项目（特别是 verify_xhs_output.cjs 与 check_2d_v2.mjs）的直接迁移方案（推论）

1. **头号避坑军规：多轮视觉精修 RL 严禁对“改坏步”施以负分惩罚，统一采用 `Forced Optimization` 严格单调门控**：
   - 我们的三轨 Agent 全靠“写代码 → 渲染拼图自检 → 局部 `Edit` 精修”拉开与单轮模型的代差。一旦在后续 RL 中对 `Edit` 后退步的轮次直接扣负分，`Qwen3.8-27B` 必将重演 Appendix E 的行为坍缩——**第一轮写完立刻吐 EOS 装死，彻底戒掉截图看图习惯**！
   - **工程落地**：在 `kimi-k3.1-pro` 长程采集与 `Qwen3.8-27B` 闭环 RL 中实行**单调门控提交**：每次 `Edit` 后立即跑 `check_2d_v2.mjs` / `verify_xhs_output.cjs`，仅当硬检违规数严格减少或视觉评分 $s_r > s_{\text{prev}}$ 时才推进工作区主干，否则回退本次 `Edit` 重采（上限 $K \le 5\sim10$）并将被拒坏轮标为 `loss=False`。
2. **加固 `check_2d_v2.mjs` 与 `verify_xhs_output.cjs` 的阻塞式浏览器 API 熔断钩子**：
   - 两套脚本虽已断外网，但尚未屏蔽同步阻塞弹窗。应参照 ReLook §3.1 在 Playwright `context.addInitScript` 中注入 `window.alert = window.confirm = window.prompt = window.open = () => null;`，防止模型偶发写出 `alert('Game Over')` 直接挂死无头页面直到 15s/30s 超时！
3. **落盘三视图去污染门禁 + $\gamma=0.1$ 审图诊断蒸馏**：
   - 将 **3-gram 余弦 `>0.85` + DOM/SVG 标签二元组 Jaccard `>0.90` + 压缩代码 token Jaccard `>0.90`** 纳入我方入训前全量扫描脚本，确保对 `AnimWeb-Bench`、`MotionGraphicsBench`、`P3D-Bench`、`BenchCAD` 100% 零污染；同时在训练期对视觉挑刺反馈做 $\gamma=0.1$ 轻量蒸馏，赋予 `Qwen3.8-27B` 极速免外部裁判自检能力。

### 可直接移植的沙盒防挂死钩子、`Forced Optimization` 与 $\gamma=0.1$ 混合损失代码片段

```javascript
// 1. check_2d_v2.mjs / verify_xhs_output.cjs 必加沙盒初始化钩子 (§3.1)：拦截阻塞弹窗与危险 API 防超时挂死
await context.addInitScript(() => {
  window.alert = () => undefined;
  window.confirm = () => true;
  window.prompt = () => '';
  window.open = () => null;
  if (navigator.clipboard) {
    navigator.clipboard.writeText = async () => undefined;
    navigator.clipboard.readText = async () => '';
  }
});
```

```python
# 2. Algorithm 1 & Appendix F (Eq. 6-8)：在线严格单调接收控制器 + Critic 掩码与 gamma=0.1 轻量反馈蒸馏
import torch
import torch.nn.functional as F

def run_forced_optimization_episode(policy, sandbox_and_critic, query, max_rounds: int = 3, max_resample: int = 10):
    """严格单调准入 (s_r > s_prev)，绝不用负分惩罚，彻底根除不调看图工具的 Behavioral Collapse"""
    history, accepted_rounds, s_prev = [query], [], -1.0
    for r in range(max_rounds):
        accepted = False
        for _ in range(max_resample):
            thought_r, code_r, asks_feedback = policy.sample_turn(history)
            valid_shots, s_r, feedback_m = sandbox_and_critic.eval_temporal_3shots(query, code_r)  # {post-load, +1s, +2s}
            eff_score = s_r if valid_shots else 0.0  # Eq. 3 无效截图严格归零铁律
            if eff_score > s_prev:                   # 无 epsilon 松弛，必须严格提升才接纳
                s_prev = eff_score
                accepted_rounds.append((thought_r, code_r, feedback_m, eff_score))
                history.extend([thought_r, code_r, f"<mllm_feedback>{feedback_m}</mllm_feedback>"])
                accepted = True
                break
        if not accepted or not asks_feedback:        # 10 次重采均未提升则干净停机，保留最佳前缀
            break
    return accepted_rounds

def relook_hybrid_loss(grpo_surrogate_per_tok: torch.Tensor, policy_mask: torch.Tensor,
                       student_logprobs: torch.Tensor, teacher_probs: torch.Tensor,
                       critic_mask: torch.Tensor, gamma: float = 0.1) -> torch.Tensor:
    """policy_mask 标出 (t, c) 策略 token；critic_mask 标出 <mllm_feedback> 反馈 token M"""
    j_grpo = (grpo_surrogate_per_tok * policy_mask).sum() / policy_mask.sum().clamp_min(1)
    ce_per_tok = -(teacher_probs * student_logprobs).sum(dim=-1)
    l_distill = (ce_per_tok * critic_mask).sum() / critic_mask.sum().clamp_min(1)  # Eq. 7
    return -j_grpo + gamma * l_distill                                             # Eq. 8
```

