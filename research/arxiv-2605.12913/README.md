# 论文精读：Revisiting DAgger in the Era of LLM-Agents（arXiv:2605.12913v1）

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*Revisiting DAgger in the Era of LLM-Agents*
- **作者**：Changhao Li, Rushi Qiang, Jiawei Huang, Chenxiao Gao, Chao Zhang, Niao He, Bo Dai（Georgia Tech & ETH Zurich）
- **原文**：`https://arxiv.org/html/2605.12913v1` · 本地原件：[paper.html（上游原文）](https://arxiv.org/abs/2605.12913) · 纯文本：[paper.txt（上游原文）](https://arxiv.org/abs/2605.12913)
- **整理日期**：2026-11-24

---

## 1. 核心问题与动机

长程多轮 LLM Agent（如 SWE-bench 修 Bug、多步工具调用）后训练面临两难：
- **SFT / Behavior Cloning**：有稠密的 token 级教师监督，但只在**教师诱导的状态分布** $d_{\pi_e}$ 上训练；部署时学生一步走偏就会触发**协变量偏移（covariate shift）**，误差最坏随步数 $T$ 呈二次方放大 $O(T^2)$。
- **RLVR（如 GRPO）**：在学生自采的 on-policy 轨迹上训练、避免分布偏移，但只有终态稀疏奖励（pass/fail），长程信用分配困难、组采样开销高，且早期全错时 advantage 坍缩。
- **On-Policy Distillation（OPD）**：在学生自采轨迹上用教师 logits 做反向 KL 蒸馏，但面临两大硬伤：① **冷启动瓶颈**（弱学生早期自采轨迹很快跑偏/早死，教师被迫在垃圾前缀上给监督）；② **必须获取教师 token 级 logits**，无法对接闭源/黑盒 API 教师。

作者提出把经典模仿学习算法 **DAgger（Dataset Aggregation）** 与 **AggreVaTe** 适配到多轮 LLM Agent，实现：**On-policy 状态覆盖 + 稠密监督 + 低采样成本 + 冷启动稳健 + 兼容黑盒 API 教师**。

---

## 2. 方法设计

### 2.1 两种随机混合采样协议（Algorithm 1）

每轮决策 $t$ 引入二值指示器 $b_t \in \{0, 1\}$ 决定由谁执行动作（$b_t=1$ 用教师 $\pi_e$，$b_t=0$ 用学生 $\pi_\theta$）：

1. **DAgger-style（轮级随机插值 / Turn-level interpolation）**：
   - 第 $i$ 轮迭代按独立伯努利分布每轮以概率 $\beta_i$ 让教师执行、$1-\beta_i$ 让学生执行。
   - 论文实际衰减计划为线性衰减并**保留 0.6 下限**：
     $$\beta_i = \max(0.6,\; 1.0 - 0.2(i - 1))$$
     即 5 轮迭代的教师执行比例依次为 `1.0 → 0.8 → 0.6 → 0.6 → 0.6`（并未降到 0，保留足够教师纠偏把轨迹拉回有效区域）。
2. **AggreVaTe-style（轨迹级前缀接管 / Trajectory-level mixture）**：
   - 先采样学生前缀长度 $\kappa \sim \rho_i$（初始 $\mathrm{Unif}\{0,\dots,40\}$，随迭代把概率质量向更长前缀偏移）。
   - 前 $\kappa$ 轮全部由学生执行，第 $\kappa+1$ 轮起由教师接管跑完剩余轨迹。

### 2.2 全访问状态教师打标与训练目标

- **关键动作**：无论第 $t$ 轮实际执行的是学生动作 $a_t \sim \pi_\theta(\cdot|s_t)$ 还是教师动作，Algorithm 1 **在每个访问状态 $s_t$ 都向教师查询标签** $\tilde{a}_t \sim \pi_e(\cdot|s_t)$，构成数据集 $\mathcal{B}(\tau) = \{(s_t, \tilde{a}_t)\}_{t=1}^T$。
- **损失函数**：标准交叉熵损失 $\ell_{\mathrm{CE}}(\theta; s_t, \tilde{a}_t)$（无 KL/advantage 复杂度）。工程上把共享前缀的 transition pack 到同一序列并通过 loss mask 保持梯度等价。
- **过滤口径（Table 5 / Appendix F.2）**：与 SFT 需要单测通过（Passing patches，仅留 684 条）不同，DAgger / AggreVaTe / OPD **只过滤未产出合法 patch 提交的轨迹（Valid submissions）**，不要求单测通过。

### 2.3 后训练方法统一视角（Section 3.3 & Appendix A）

作者将主流方法统一写成加权最大似然框架：
$$\theta_{i+1} = \arg\max_{\theta}\; \mathbb{E}_{s \sim \mathrm{sg}(p_s),\, a \sim \mathrm{sg}(p_a)} \left[\mathrm{sg}(w(s,a))\log \pi_\theta(a\mid s)\right] - \lambda \Omega_i(\theta)$$

| 方法 | 上下文来源 $p_s$ | 标签来源 $p_a$ | 权重 $w(s,a)$ |
|---|---|---|---|
| SFT / BC | $d^{\pi_e}$（纯教师） | $\pi_e$ | $1$ |
| RL / GRPO | $d^{\pi_\theta}$（纯学生） | $\pi_\theta$ | $A(s,a)$（稀疏优势） |
| OPD | $d^{\pi_\theta}$（纯学生） | $\pi_\theta$ | $-\log\frac{\pi_\theta(a\mid s)}{\pi_e(a\mid s)}$（需教师 logits） |
| **DAgger-style** | $d_i^{\mathrm{turn}}$（轮级混合） | $\pi_e$ | $1$（黑盒 API 即可） |
| **AggreVaTe-style** | $d_i^{\mathrm{traj}}$（前缀接管） | $\pi_e$ | $1$（黑盒 API 即可） |

---

## 3. 实验设置与核心结果

- **模型**：学生 `Qwen3-4B-Instruct-2507`、`Qwen3-8B`；固定教师 `Qwen3-Coder-30B-A3B-Instruct`。
- **数据与脚手架**：OpenHands 脚手架，训练于 `SWE-Gym`（2,338 题），域内评测 `SWE-Gym Holdout`（100 题），域外评测 `SWE-Bench Verified`（466/500 题，剔除 34 个 Docker 构建失败的 Matplotlib 题）。最大上下文 64K，最多 100 轮，4×A100 训练；每轮在线采 512 题、恒定 `lr=3e-6`、batch size 16、每批训 3 epoch，共 5 轮在线迭代。

### 主表结果（Table 3，任务解决率）

| Backbone / 方法 | SWE-Gym Holdout | SWE-Bench Verified (466) |
|---|---:|---:|
| Qwen3-4B Base | 5.0% | 11.2% |
| + GRPO（SkyRL-v0 293 题） | 8.0% | 11.6% |
| + SFT（684 条通过单测轨迹） | 15.0% | 22.9% |
| + OPD | 16.0% | 23.4% |
| + Ours (AggreVaTe-style) | 16.0% | 24.5% |
| **+ Ours (DAgger-style)** | **17.0%** | **27.3%**（超 OPD **+3.9**） |
| Qwen3-8B Base | 2.0% | 7.7% |
| + GRPO | 4.0% | 8.2% |
| + SFT | 12.0% | 23.4% |
| + OPD | 16.0% | 26.2% |
| + Ours (AggreVaTe-style) | 17.0% | 27.3% |
| **+ Ours (DAgger-style)** | **19.0%** | **29.8%**（超 OPD **+3.6**，超 SWE-Gym-32B 的 20.6%） |

### 三个诊断结论（Sections 4.3–4.5）

1. **样本扩展与冷启动（§4.3）**：3K 有效样本时 DAgger 已达 `12% / 20%`，大幅领先 OPD（`9% / 13%`）；大样本下 SFT 在 Verified-100 于 20% 见顶并回落至 19%，DAgger 持续升至 `26%`。
2. **部署态协变量偏移实测（§4.4）**：在学生自采上下文上测反向 KL $D_{\mathrm{KL}}(\pi_\theta \| \pi_e)$，SFT 先降到 `0.10` 后反弹回 `0.126`；DAgger 与 AggreVaTe 稳定保持在 `~0.10`（比 SFT 低约 20%），且在 3K 样本处就比 OPD（`0.126`）更早收敛。
3. **失败模式迁移（§4.5，Claude Opus 4.7 评判）**：
   - SFT 语法/运行错误率最高（`20.3%`）；OPD 在未提交失败中死循环占比高达 `44.3%`；
   - DAgger 将语法/运行错误压至 `15.9%`、工具调用错误压至 `0.0%`、死循环降至 `22.7%`；
   - 剩余未提交失败中 **`57.5%` 为 Context Overflow**（64K 瓶颈），说明长上下文管理成为主要残余短板。

---

## 4. 局限性与对 3D Animation Agent 的直接启发

### 论文自身局限与注意事项
- 仅在纯文本 SWE（OpenHands + 64K）验证，未测多模态视觉 Agent。
- 轮级 DAgger 在 $b_t=0$（学生执行轮）仍需额外调一次教师生成反事实标签 $\tilde{a}_t$，API 费用约增加 $(1-\beta_i)$ 倍，且学生轮的 $(s_t, \tilde{a}_t)$ 与后续主轨迹分支不同，训练实现需正确做分支/mask。
- GRPO 基线只在 293 题 SkyRL-v0 子集训练（与全量 2,338 题不完全同口径）。

### 与我们 3D Animation Agent（27B Dense + 中转截取）的结合点
1. **黑盒 API 教师零门槛适配**：我们的主力教师 DeepSeek（`deepseek-v4.1-flash-1017`）与 Kimi（`kimi-k3`）均是 PhanRouter 闭源 API，拿不到 logits（OPD 不可用），而 DAgger / AggreVaTe 只需标准 `/v1/messages` 调用。
2. **不依赖完美 0/1 奖励函数**：3D 动画视觉质量难以用单一布尔值打分（纯 RLVR 极难），论文证明仅按“合法交付”过滤、靠教师在学生状态下演示即可带来大幅提升。
3. **与现有 `--episode-capture` 设施天然契合**：我们刚收口的 `episode_capture.py` + `export_episode_capture.py` 已精确保存每轮真实请求状态 $s_t$（含 `system`、`tools` 与截图）：
   - **短期最省成本落地（AggreVaTe 变体）**：即 [2026-11-24-next-sft-data-plan.md](../../3d-animation-agent/docs/plans/2026-11-24-next-sft-data-plan.md) 第 5 项“学生中心纠偏”——先让 27B 学生跑前 $\kappa$ 轮（或跑到首个关键错误/坏交付），再由 DeepSeek/Kimi 从同一工作区与上下文前缀接管修复；若只对教师接管段算 loss、学生前缀 mask 掉，无需额外反事实打标即可直接进现有 `export_episode_capture.py` → Swift Ready 链路。
   - **中期进阶实验（Turn-level DAgger）**：在本地 loopback relay 层把学生 27B（vLLM `18152`）与教师 DeepSeek/Kimi（PhanRouter）按 $\beta \in \{0.8, 0.6\}$ 轮级混合调度（论文证明下限 `0.6` 即可有效压低协变量偏移，且比 AggreVaTe 再高 +2.5~2.8 分）。
