# 论文精读：Self-Distillation Enables Continual Learning（SDFT，arXiv:2601.19897v2）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*Self-Distillation Enables Continual Learning*
- **作者**：Idan Shenfeld, Mehul Damani, Jonas Hübotter, Pulkit Agrawal（MIT, Improbable AI Lab, ETH Zurich）· 代码：`http://idanshenfeld.com/SDFT`
- **原文**：`https://arxiv.org/html/2601.19897v2` · 本地原件：[paper.html（上游原文）](https://arxiv.org/abs/2601.19897) · 纯文本：[paper.txt（上游原文）](https://arxiv.org/abs/2601.19897) · 元数据与校验：`sources.json`（本地校验清单未发布）
- **整理日期**：2026-11-27 · 关联总报告：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心痛点：如何仅凭离线专家示范获得 On-Policy 学习与零遗忘？（§1–§3）

小红书 `3DCodeFactory` 在论文 §6 将未来演进明确指向 **“self-distillation and reinforcement learning”**。对于我方需要让 `Qwen3.8-27B` 同时精通 `3D Three.js`、`CAD CadQuery`、`2D Web 动画` 三条技术栈且严守通用底座（ModelForge）的场景：
- **离线 SFT 天生 Off-Policy**：强迫模型拟合外部教师轨迹，相对基座的分布漂移极大（KL 达 `1.26` nats），多轮或分轨增量微调极易引发**灾难性遗忘**，且若示范不含匹配的长思考链会直接压垮模型原生推理深度（§4.5 Table 2）。
- **闭源教师无 Logits / 纯在线 RL 太贵**：API 教师（Kimi/DeepSeek）不开放全词表 logits；而 $G=8$ 沙盒渲染 RL 算力是 SFT 的十倍以上。

**SDFT 核心破局点**：利用大模型的上下文学习（ICL）能力，让**同一个模型的 EMA 副本 $\pi_\phi(\cdot \mid x, c)$ 在上下文里偷看专家示范 $c$ 充当教师**，在无示范学生 $\pi_\theta(\cdot \mid x)$ 自采样的 **单条（$G=1$）on-policy 轨迹**上做词表级解析 KL 自蒸馏（总算力仅约 **`2.5×` SFT FLOPs** / `~4×` 墙钟耗时，无需任何外部奖励器！）。

### 原始教师条件化 Prompt 模板（§3）与示范引导词泄露掩码机制（§5）
```text
{Question}
This is an example for a response to the question:
{Demonstration}
Now answer with a response of your own, including the thinking process:
```
- **为什么必须 Mask 回复开头前若干 Token？（§5 Learned Artifacts 关键避坑）**：由于教师上下文中包含 `{Demonstration}`（或参考文档），教师分布 $\pi_\phi(\cdot \mid y_{<t}, x, c)$ 在回复最开头几个位置会对 `"Following the example..."`、`"Based on the text..."` 等上下文指代引导词赋予虚高概率！若全序列无差别蒸馏，测试时根本看不到示范的学生也会在开头凭空吐出这类泄露废话。**工程铁律：训练时将回复起始（或 `<think>` 之后）前 $L_{\mathrm{mask}} \approx 4\text{–}8$ 个引导 token 的蒸馏损失置零掩码，即可零精度损失地根除话术污染！**

---

## 2. 信赖域逆强化学习（IRL）等价性证明与梯度估计器消融（§3.1–§3.2 & Appendix A）

### 2.1 与带 KL 信赖域的最大熵 IRL 严格等价（§3.1 Eq. 3–6）
考虑第 $k$ 步受 KL 信赖域约束的策略更新目标及其闭式倾斜最优解：
$$\pi_{k+1}^* = \arg\max_\pi \mathbb{E}_{y \sim \pi}[r(y, x)] - \beta D_{\mathrm{KL}}\!\big(\pi(\cdot \mid x) \,\|\, \pi_k(\cdot \mid x)\big) \implies \pi_{k+1}^*(y \mid x) \propto \pi_k(y \mid x)\exp\!\left(\frac{1}{\beta} r(y, x)\right)$$
反解隐式轨迹奖励得 $r(y, x) = \beta[\log \pi_{k+1}^*(y \mid x) - \log \pi_k(y \mid x)] + C$。引入 **ICL 最优近似假设** $\pi_{k+1}^*(y \mid x) \approx \pi_\phi(y \mid x, c)$，其成立依赖两条可实测验证的充要条件（§3.2）：
1. **最优性（Optimality）**：$\mathbb{E}_{y \sim \pi(\cdot \mid x,c)}[r(y,x)] \approx \mathbb{E}_{\pi^*}[r]$（`ToolAlpaca` 实测：无示范基座 `42%` $\to$ 加示范教师 **`100%`** 且自动重构出合理思考链；Appendix A.2 Fig. 7 进一步证实同时给“背景文本 + 示范答案”得 `89%` 严苛准确率，远超只给背景文本的 `75%`）；
2. **最小偏离（Minimal Deviation）**：$D_{\mathrm{KL}}(\pi(\cdot \mid x,c) \,\|\, \pi_k) \approx D_{\mathrm{KL}}(\pi^* \,\|\, \pi_k)$（实测教师距基座仅 **`0.68` nats**，比 SFT 的 **`1.26` nats** 降低 `46%`！）。

略去不影响最优策略的正尺度 $\beta$ 与常数 $C$，按自回归分解即得**内生稠密 Token 级 IRL 奖励**：
$$r_t(y_t \mid y_{<t}, x, c) = \log \frac{\pi_\phi(y_t \mid y_{<t}, x, c)}{\pi_k(y_t \mid y_{<t}, x)}, \qquad \sum_{t=1}^T r_t = r(y, x, c)$$
对该隐式奖励求 on-policy 策略梯度，在期望意义下严格等价于最小化反向 KL $D_{\mathrm{KL}}\big(\pi_\theta(\cdot \mid x) \,\|\, \pi_\phi(\cdot \mid x, c)\big)$！任何与新技能无关的通用语法/底座知识在师生分子分母中自动抵消为 `0`。

### 2.2 三类 KL 梯度估计器与 EMA 教师衰减率 $\alpha$ 消融（Appendix A.1 & A.3）
- **解析词表级 KL 完胜采样 Token KL（Appendix A.1）**：沿学生自采前缀 $y_{<t} \sim \mathrm{sg}[\pi_\theta(\cdot \mid x)]$，作者对比了三种估计器：
  1. *采样 Token 偏导估计* $\widehat{g}_{\mathrm{token}} = \sum_t \log\frac{\pi_\theta(y_t)}{\pi_\phi(y_t)}\nabla_\theta\log\pi_\theta(y_t)$：单点蒙特卡洛方差高、KL 约束弱；
  2. **全词表解析逐 Token 估计（默认最优）**：直接对前向已算出的词表概率求和
     $$\widehat{g}_{\mathrm{analytic}} = \sum_{t=L_{\mathrm{mask}}+1}^T \sum_{v \in \mathcal{V}} \pi_\theta(v \mid y_{<t}, x)\log\frac{\pi_\theta(v \mid y_{<t}, x)}{\mathrm{sg}[\pi_\phi(v \mid y_{<t}, x, c)]}\nabla_\theta \log \pi_\theta(v \mid y_{<t}, x)$$
     （注：§3 实践节指出在相同 on-policy 前缀上改取词表级前向 KL $D_{\mathrm{KL}}(\pi_\phi \,\|\, \pi_\theta)$ 同样表现极佳；因解析求期望方差极低，每题采 **$G=1$ 条**与多条采样效果无异，且显著优于脱离学生轨迹的离线教师蒸馏 Fig. 6！）；
  3. *Rao-Blackwell 序列无偏估计* $\widehat{g}_{\mathrm{rb}}$：额外计算前缀得分修正项开销大且无实测收益。
- **EMA 教师更新率 $\alpha \in \{0.01, 0.02, 0.05\}$（Appendix A.3 Fig. 8 & Algorithm 1）**：初始化 $\phi \leftarrow \theta$，每步更新 **$\phi \leftarrow \alpha\theta + (1-\alpha)\phi$**。若用冻结基座（$\alpha=0$）教师无法随学生进步而封顶；若直接用当前学生自身（$\alpha=1$）微小概率波动会在 on-policy 闭环中正反馈自激导致发散！

---

## 3. Appendix B 超参数、无 CoT 推理保护与持续学习零遗忘全表（Table 1–5）

### 3.1 训练超参网格（Table 3–4）与新知识注入 / 无 CoT 推理保护（Table 1–2）

| 实验模块 | 核心设置 / 对比数字（单卡 `H200` BF16 `TRL` 全参微调，3 随机种子均值） |
|---|---|
| **Appendix B 超参表（Table 3–4）** | `Qwen2.5-7B-Instruct`，`AdamW (wd=0, grad_clip=1.0, warmup=10 cosine)`，`lr ∈ {5e-6, 1e-5, 5e-5}`，`batch ∈ {16, 32, 64}`，**`EMA α ∈ {0.01, 0.02, 0.05}`**，技能学习 `2 epochs`（`max_gen=2048`），知识注入 `4 epochs`（`max_gen=1024`）；评测贪婪 `temp=0`，`Pass@k` 用 `temp=1.0, top_p=0.95` |
| **Table 1：2025 新知识注入（Strict / Lenient / OOD）** | Base `0 / 0 / 0%` · CPT `9 / 37 / 7%` · SFT `80 / 95 / 80%` · **SDFT `89 / 100 / 98%`**（逼平 Oracle RAG 上界 `91 / 100 / 100%`，OOD 间接推理超 SFT **`+18 pp`**！） |
| **Table 2：仅给最终答案训推理模型（`Olmo-3-7B-Think`）** | Base：`31.2%`（均长 `4,612` tok）$\to$ SFT：**跌至 `23.5%`**（均长坍缩至 `3,273` tok）$\to$ **SDFT：跃升至 `43.7%`**（均长保持 `4,180` tok，完好保留原生思考链！） |
| **Fig. 5：模型尺寸扩展律与 `Pass@1..128`** | `3B` 因 ICL 太弱落后 SFT，`7B` 超 SFT `+4 pp`，**`14B` 扩大至 `+7 pp`**（`27B` 正处强 ICL 甜点区！）；$k=1\dots 128$ 全线抬高 `Pass@k` 零熵坍缩 |

### 3.2 三大技能学习 × 六大通用基准防遗忘完整对照表（Appendix B Table 5）

| 训练任务与方法 | **新任务准确率 ↑** | HellaSwag | **HumanEval (代码)** | **IFEval (指令)** | MMLU | TruthfulQA | Winogrande | **6 项底座均分 ↑** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `Qwen2.5-7B` **未训 Base 锚点** | 32.1 / 42.9 / 30.1 | 62.0 | **65.8** | **74.3** | 71.7 | 47.9 | 71.1 | **65.5** |
| **Task 1: Science Q&A** · 标准 SFT | 66.2 | 55.0 | 54.8（**-11.0**） | 35.3（**-39.0**） | 64.6 | 36.8 | 73.7 | **53.4**（血崩 `-12.1`） |
| Science Q&A · `SFT + Re-invoke` / `DFT` | 66.0 / 54.8 | 61.6 / 57.6 | 63.4 / 67.0 | 52.9 / 60.4 | 68.7 / 69.4 | 45.2 / 38.8 | 70.0 / 68.2 | 60.2 / 60.2 |
| **Science Q&A · SDFT（Ours）** | **70.2**（**+4.0**） | 60.9 | **68.9** | **66.8** | **70.7** | **46.5** | 73.1 | **64.5**（近乎无损） |
| **Task 2: ToolUse** · 标准 SFT | 63.2 | 57.3 | 50.0（**-15.8**） | 49.8（**-24.5**） | 70.2 | 37.5 | 73.1 | **56.0**（重度遗忘） |
| ToolUse · `SFT + Re-invoke` / `DFT` | 63.1 / 64.2 | 61.7 / 59.7 | 68.9 / 61.4 | 59.1 / 60.2 | 71.5 / 71.6 | 49.1 / 40.2 | 71.6 / 71.5 | 63.7 / 60.8 |
| **ToolUse · SDFT（Ours）** | **70.6**（**+7.4**） | 61.6 | **68.3**（反升） | **71.9** | **71.5** | **47.3** | 71.7 | **65.4**（**仅差 `-0.1`**） |
| **Task 3: Medical** · 标准 SFT | 35.5 | 59.5 | 62.1 | 56.6（**-17.7**） | 70.5 | 39.8 | 72.9 | **60.2** |
| **Medical · SDFT（Ours）** | **40.2**（**+4.7**） | 61.4 | **67.7** | **72.3** | **71.5** | **47.3** | 71.9 | **65.4**（**仅差 `-0.1`**） |

---

## 4. 对接我方 `Qwen3.8-27B` 三轨蓝图自蒸馏的轻量化落地伪代码

我方已有数千条 `3DCodeFactory` 满分工程与 Kimi 自产 CAD/2D 满分代码（[XHS-UNIFIED-SFT-STANDARD.md](../../3d-animation-agent/docs/XHS-UNIFIED-SFT-STANDARD.md)）。完成基础 SFT 后，**无需把教师几十轮 `384K` 试错日志塞进上下文**：只需提取专家最终成交的**精炼多文件架构摘要 + 核心参数化源码（`3K–6K` tokens）作为蓝图 $c$**（直接利用 Table 2“仅给最终产物仍完好保护原生思考链”的奇效，100% 守护 `27B` 原生 `xhigh` `<think>` 分布！）：

```python
# SDFT 蓝图条件化自蒸馏单步更新（适配 Qwen3.8-27B 单轨增量补强与 SFT->RL 低成本热身）
import torch
import torch.nn.functional as F

def sdft_step_with_ema_teacher(
    student_model, ema_teacher_model, batch_items, optimizer,
    ema_alpha: float = 0.02, prefix_mask_tokens: int = 8, topk_vocab: int = 256,
) -> float:
    """
    batch_items: [{"task_prompt": x_i, "expert_blueprint_code": c_i}]
    prefix_mask_tokens: 屏蔽回复开头(或 <think> 后)前 8 个引导 token，根除 'Following the example...' 泄露
    """
    total_loss, total_valid_tok = 0.0, 0
    for item in batch_items:
        s_ctx = format_qwen38_student_prompt(item["task_prompt"])
        t_ctx = format_qwen38_teacher_prompt(item["task_prompt"], item["expert_blueprint_code"])

        # 1. G=1 学生无参考自采样 (On-policy rollout；若用 vLLM 异步推理可按 Algorithm 1 乘 IS 权重修正)
        with torch.no_grad():
            y_ids = student_model.generate_single(s_ctx, temperature=1.0)     # [1, T]
            t_logits = ema_teacher_model.forward_response_logits(t_ctx, y_ids) # [1, T, V] sg[pi_phi]

        # 2. 学生在自身生成轨迹上计算词表 Top-K 联合支撑集解析反向 KL D_KL(pi_theta || sg[pi_phi])
        s_logits = student_model.forward_response_logits(s_ctx, y_ids)        # [1, T, V]
        top_idx = torch.topk(t_logits, k=topk_vocab, dim=-1).indices
        s_logp = F.log_softmax(s_logits.gather(-1, top_idx), dim=-1)
        t_logp = F.log_softmax(t_logits.gather(-1, top_idx), dim=-1).detach()
        s_prob = s_logp.exp()

        per_tok_kl = (s_prob * (s_logp - t_logp)).sum(dim=-1).squeeze(0)      # [T]
        tok_mask = torch.ones_like(per_tok_kl)
        tok_mask[:prefix_mask_tokens] = 0.0                                   # 屏蔽开头引导词防泄露！

        total_loss = total_loss + (per_tok_kl * tok_mask).sum()
        total_valid_tok += int(tok_mask.sum().item())

    loss = total_loss / max(total_valid_tok, 1)
    optimizer.zero_grad()
    loss.backward()
    torch.nn.utils.clip_grad_norm_(student_model.parameters(), 1.0)
    optimizer.step()

    # 3. 指数滑动平均更新自身教师权重 phi <- alpha * theta + (1 - alpha) * phi
    with torch.no_grad():
        for p_s, p_t in zip(student_model.parameters(), ema_teacher_model.parameters()):
            p_t.data.mul_(1.0 - ema_alpha).add_(p_s.data, alpha=ema_alpha)
    return float(loss.detach())
```
