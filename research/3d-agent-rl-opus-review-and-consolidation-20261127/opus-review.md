> 说明：上一轮的 Write 没有执行，`opus-review.md` 目前**还没有落盘**。下面是报告全文。如需落盘，请允许我再调用一次 Write。

# Claude Opus 5.5 独立架构审查与去杂糅收敛报告

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- 审查对象：`3d-agent-post-sft-rl-survey-20261127`（五阶段 v2.0）、`visual-3d-agent-rl-pitfalls…`（25 坑）、`frontier-labs-agentic-rl-blogs-2026h2`
- 实查代码：`scripts/eval_xhs_threejs/verify_xhs_output.cjs`、`check_2d_v2.mjs`、`cad_inspect.py`、`threejs_rubric_judge.py`、`xhs_v2_produce.py`（`_score_5dim_gate` / `judge_cad_attempt` / `judge_2d_attempt`）
- 约束：dense `Qwen3.8-27B`，`gpu34/gpu38` 两台机器共 2×8 H800，三轨分别报 `Accepted@1`（decisions 11-24 / 11-26）

---

## 0. 一句话裁决

方案的**方向对**：先做确定性硬检，再分层门控，最后看视觉。问题是**机制叠得太多**：15 种机制里约 6 种在同一个优势张量上互相改写，严格保序和零均值都被破坏；路线还设计成 6–8 轮训练流水线，16 卡团队承受不了。我把它收敛为：**1 个分层优势公式 + 1 个单模型多轨 Repair-RL + 1 个可选的回放锚点**。另外，**现行验收器有 4 处硬缺陷，必须先修再开 RL**（见 §4.3）。

---

## 1. 去杂糅审计

### 1.1 核心数学冲突（逐条）

**C1 · HBA × GDPO：保序条件被直接击穿。**
HBA 成立的前提是 $A_i=\lambda_L(L_i-\bar L)+\lambda_w\tilde A_i$，其中 $|\tilde A_i|\le1$ 且层差为整数，于是 $A_i-A_j\ge\lambda_L-2\lambda_w>0$。
GDPO 的做法是对每个分量各自白化：$z^{(k)}=(r^{(k)}-\mu_k)/\sigma_k$。层分量 $L$ 被除以组内 $\sigma_L$ 后，层差变成 $1/\sigma_L$。当组内只有一条掉层（例如 $G=8$，7 条 L3、1 条 L2）时 $\sigma_L\approx0.33$，层差被放大到 3；反过来，当 L 分布很散时 $\sigma_L>1$，层差会小于 1。同时视觉分量白化后不再满足 $|\cdot|\le1$，可以到 $\pm2.6$（$G=8$ 时单点上限 $\sqrt{G-1}$）。
结论：**$\lambda_L>2\lambda_w$ 不再保证任何东西**，L2 样本可能拿到比 L3 更高的优势。GDPO 解决的是"多个连续分量相加时方差被吞"的问题，而 HBA 用秩已经解决了同一个问题。两者只能留一个：**砍掉 GDPO**。

**C2 · HBA × POW3R：管辖层不同，可以共存但没有必要在线跑。**
POW3R 是在 rubric 条目层面按 $\sqrt{p(1-p)}$ 重加权，只会改变 L3 层内的连续分 $q_i$。由于 HBA 在层内只取秩，POW3R 只能影响"秩的次序"，不影响保序性。但它需要每题维护 EMA 状态，且依赖 $\ge0.75G$ 个合法 JSON 裁决。
裁决：**改为离线使用**——在造题和 RFT 阶段剔除饱和或死寂条目（$p\in\{0,1\}$）。不进在线环路。

**C3 · GVPM 的 $\max(\hat A,0)$：破坏零均值。**
这一截断只作用于"有合法前缀但后缀退化"的轨迹，相当于把这部分负优势抹掉，组内优势之和变为正，形成系统性正偏置。被抬起来的恰恰是**失败轨迹**。叠加多轮场景后，长轨迹、反复失败的轨迹会净获正梯度，这正好是 SRaR 想治的"自我纠错死循环"诱因。
IterCAD 能这样做，是因为它有逐轮单调的 CD 误差信号，且 $T\le5$。我们的开放式装配没有 GT CD，退化轮 $f$ 也没有定义。
裁决：只保留它的**后缀 loss mask**（对 $\tau\ge f$ 置 $m=0$，这本身就是零偏置的），**砍掉 $\max(\cdot,0)$**。

**C4 · ATC × GVPM：符号逻辑被打乱。**
ATC 的权重 $\tilde w=[1+\beta\,\mathrm{sgn}(A)c]_+$ 依赖 $A$ 的符号。GVPM 把负 $A$ 截成 0 之后 $\mathrm{sgn}=0$，ATC 的"失败时温和护盘"分支直接失效。
此外，ATC 需要 CDP 调用栈到 UTF-8 字节再到 token 的逐字节对齐。我们的 3D 轨是多文件、经多轮 `Edit` 产生的代码：函数字节区间分散在几十个 tool_call 里，并且会被后续 Edit 覆盖。**同一个函数对应多段 token，归属不唯一**。
裁决：**暂缓到 Phase 2**（只有在 2D 单文件场景、确实出现慢收敛时才考虑）。

**C5 · SRaR 轮次偏置 × HBA：在 token 级别击穿保序。**
SRaR 的 $\eta\tilde r$ 二阶矩为 1，与终态优势同量级。一条 L1 轨迹的某些轮次 token 可以拿到 $+1.5$ 的偏置，而 L3 轨迹的某些轮次 token 可以拿到 $-1.5$。HBA 只在序列级别保序，**token 级别的保序被破坏**。另外，SRaR 的"步"依赖裁判逐步归因，在我们这里意味着每轮都要调一次 VLM，成本 ×T。
裁决：**砍掉**。死循环用 5 规则坏轮 mask 加最大轮数截断处理即可。

**C6 · RECAP 自蒸馏 KL、SDFT、MOPD：三种 KL 拉向三个不同目标。**
它们分别把策略拉向"压缩前的自己"、"带蓝图条件的自己"、"专家教师"，叠加时梯度方向互不一致。这三者与 RL 主损失之间也没有任何权重推导。
裁决：MVP 阶段只保留**一个**锚点项：对 SFT 检查点做 low-var KL（$\beta=0.01$）**或者**混入 10–15% 通用 SWE 的 SFT 回放，二选一。其余**暂缓或砍掉**。

**C7 · Visual Anchor × L3 rubric 视觉分：同一信号计两次。**
WebCatalyst 的 $D_i$ 是"相对参考帧的单边退化"惩罚，我们 rubric 里的 `R_vis` 与 `s_aes` 本身就是对照参考图打分（`judge_*_attempt` 会把 `reference_image` 作为 Image 0 传入）。两者再相加，就是对视觉计了两次分。
裁决：**合并**——锚点只作为 L3 内部 $q$ 的一个单边扣分项，不再另设奖励分量。

**C8 · `s_vis_adj` 几何难度补偿（0–0.06）：在线 RL 中失效。**
组归一化是在同一题内部做的，同一题内所有 rollout 的补偿量相同，减均值后完全抵消。它只对离线跨题的准入阈值有意义。
裁决：**只保留在 RFT 准入门槛中**，不进 RL。

**C9 · Kimi Toggle / 预算课程 × 长度：与 `infra_error` 丢弃一起会产生短偏置。**
超时的长轨迹被丢弃，叠加"熟题奖励短轨迹"，两者方向相同、互相叠加。
裁决：**暂缓**。MVP 只设硬上限：Repair 回合 ≤12 轮。

**C10 · ManimCode 正反双序成对盲评：与组内 $G=8$ 秩排序的成本不兼容。**
对 $G$ 条做全成对比较需要 $G(G-1)$ 次 VLM 调用，即 56 次；而逐条打分只要 8 次。
裁决：**只用于离线 Eval 和 Best-of-2 选优**，不进在线奖励。

### 1.2 四分类裁决表

| 机制 | 裁决 | 硬理由 |
|---|---|---|
| GSPO-token（序列似然比 + token mask） | **保留** | 长序列稳定器；ms-swift 已有实现 |
| TITO + `infra_error` 剔除 + 整组提交（防 WAL 短偏置） | **保留** | 不是可选优化，而是训推一致性的前提 |
| PhyCAD HBA（离散层 + 层内秩） | **保留并化简**：三轨统一为 4 层 | 唯一有严格保序证明的骨架 |
| IcePop | **合并**进 GSPO 的比率截断（ratio 越界置零） | 一行代码，不单列为机制 |
| WebCatalyst Visual Anchor | **合并**进 L3 层内 $q$ | 见 C7 |
| POW3R | **合并**到离线 rubric 清洗 | 见 C2 |
| 裁判先写 reasoning、去掉 "such as"、≥25% 负向条款 | **保留**（造题与裁判 prompt 规范） | 零成本，直接防 rubric hacking |
| 空目录冷跑、只读隔离、隐藏随机探针 | **保留** | 防篡改底线 |
| IterCAD GVPM | 只保留**后缀 mask**，**砍掉** $\max(A,0)$ | 见 C3 |
| GDPO | **砍掉** | 见 C1，与 HBA 冲突 |
| SRaR | **砍掉** | 见 C5，并且每轮调 VLM，成本 ×T |
| CDP ATC | **暂缓** | 见 C4，多文件 Edit 对齐不可行 |
| RECAP / CompactionRL | **暂缓**（MVP 不跑跨压缩 RL） | 见 §3，384K 在线 RL 跑不动 |
| AggreVaTe 强师前缀接管 | **暂缓**（仅当全挂题 >40% 时启用） | 需要教师 API 与额外流水线 |
| SDFT | **砍掉** | 与 RL + KL 锚点功能重复 |
| Kimi Toggle / 预算课程 | **暂缓** | 见 C9 |
| ManimCode 双序盲评 | **只用于 Eval / RFT** | 见 C10 |
| 3 个单轨 LoRA 专家 + DeepSeek/Kimi MOPD | **MVP 砍掉，保留为触发式备选** | 见 §3.2 |
| 本地 27B 自评裁判 | **在线砍掉**，只做审计 | 见 §4.1 |

---

## 2. 指标断舍离与唯一优势公式

### 2.1 三层划分

**① 在线 RL 奖励（只保留 3 个信号）**
1. **硬检层级 $L\in\{0,1,2,3\}$**：由确定性检查器直接给出，不调 VLM。
2. **L3 层内质量 $q\in[0,1]$**：由外部异族裁判对 rubric 条目打分取均值，再减去单边锚点退化扣分。
3. **坏轮 / infra mask**：二值，只改 loss mask，不改奖励值。

**三轨层级映射（以现有脚本字段为准）：**

| 层 | 3D（`verify_xhs_output.cjs`） | 2D（`check_2d_v2.mjs` + mp4） | CAD（`cad_inspect.py` + produce） |
|---|---|---|---|
| L0 | 没有 `index.html`，或 `load_error` | `missing_html`、`browser_or_protocol_error`、`renderAt` 缺失 | AST 违规、`cad_build_error`、`step_readback_failed` |
| L1 | `L2_offline_webgl_clean=false`（报错 / 外链 / 白屏） | `offline_or_page_error`、`target_not_visible`、`static_stage_or_hud_only_motion` | 非水密或非流形、零件数低于下限、面数 <40 |
| L2 | `orbit.responds=false`，或指定控件无效 | 确定性问题（seek / ghosting / seam / scrub / play / pause） | 干涉体积超容差、probe 失败或参数为死参数 |
| L3 | 以上全部通过 | 再加上文字重叠为 0、MP4 能导出 | 以上全部通过 |

**② 只留在离线造数 / RFT 过滤的指标**
五维 `s_vis_adj / s_spec / s_func / s_stab / s_aes`、木桶规则（单维 ≥0.50 且均值 ≥0.60）、几何难度补偿、阶梯 Best-of-2、POW3R 条目清洗、双序成对选优、代码膨胀与 `<text>` 字牌审计（只告警）。

**③ 只用于留出评测、永不进训练的指标**
三轨 `Accepted@1`（主报）、BenchCAD Voxel IoU、AnimWeb-Bench / MotionGraphicsBench、`xhs-threejs-val`、ModelForge / SWE 通用分、人工或 Opus 的 rubric-free 双序盲评、27B 自评与外部裁判的分歧率（作为共谋监测指标）。

> 注意：所谓"四重防线"里的 Voxel IoU，`cad_inspect.py` 中**根本没有实现**（全文 grep 无命中）。它只能作为 Eval 指标存在，不得写成"已有防线"。

### 2.2 唯一优势合成公式

对同一题 $x$ 的 $G$ 条 rollout（剔除 infra 失败后剩下 $G'$ 条，$G'<\lceil0.75G\rceil$ 则整组丢弃）：

$$q_i=\mathrm{clip}\Big(\tfrac1{|R|}\textstyle\sum_{j\in R}s_{ij}-\kappa\,[a^{\mathrm{ref}}-a_i-\delta]_+,\,0,\,1\Big)\cdot\mathbb 1[L_i=3]$$

$$\tilde A_i=\begin{cases}\dfrac{2\,\mathrm{rank}^{\mathrm{tie}}_{\mathcal I_{L_i}}(q_i)-(|\mathcal I_{L_i}|+1)}{|\mathcal I_{L_i}|-1}\in[-1,1],&|\mathcal I_{L_i}|>1\\[4pt]0,&\text{其他}\end{cases}$$

$$A_i=\frac{(L_i-\bar L)+\lambda_w\tilde A_i}{\sigma_{\mathrm{grp}}(\cdot)+\epsilon},\qquad\lambda_w=0.25,\ \kappa=1,\ \delta=0.1$$

$$\mathcal L=-\frac1{|\mathcal M|}\sum_{i}\sum_{t}m_{i,t}\,\min\!\big(s_i(\theta)A_i,\ \mathrm{clip}(s_i,1\!-\!\epsilon_l,1\!+\!\epsilon_h)A_i\big)+\beta\,\mathrm{KL}_{\mathrm{lowvar}}$$

**自洽性证明：**
- **跨层严格保序**：分子的层差 ≥1，层内项之差 ≥$-2\lambda_w=-0.5$，所以分子之差 ≥0.5。分母是同组共享的正标量，不改变次序。
- **零均值**：$\sum_i(L_i-\bar L)=0$；居中秩在每一层内部和为 0。所以 $\sum_iA_i=0$，不会因为合成方式产生偏置。
- **无方差吞噬**：层内只用秩，与 $q$ 的量纲和方差无关。
- **token 级不变**：token 层面只有 $m\in\{0,1\}$（坏轮、GVPM 后缀、tool 输出、infra），**不对优势做任何乘法或加法修饰**。

工程实现约 45 行：

```python
def group_advantage(L, q, infra, lam_w=0.25, eps=1e-6, tie=1e-3):
    idx = [i for i in range(len(L)) if not infra[i]]
    if len(idx) < math.ceil(0.75 * len(L)):
        return None                                   # 整组丢弃，绝不记 0 分
    Ls = np.array([L[i] for i in idx], float)
    qs = np.array([q[i] if L[i] == 3 else 0.0 for i in idx])
    At = np.zeros(len(idx))
    for lv in set(Ls):
        m = np.where(Ls == lv)[0]
        if len(m) > 1 and lv == 3:                    # 只有 L3 才有连续质量信号
            r = tie_aware_rank(qs[m], tie)            # 1..n，平局取平均秩
            At[m] = (2 * r - (len(m) + 1)) / (len(m) - 1)
    num = (Ls - Ls.mean()) + lam_w * At
    if np.allclose(num, 0):
        return None                                   # 死组：剔除并计数
    A = num / (num.std() + eps)
    return dict(zip(idx, A))

def q_score(rubric_scores, anchor_ref, anchor_cand, kappa=1.0, delta=0.1):
    base = float(np.mean(rubric_scores))
    return float(np.clip(base - kappa * max(0.0, anchor_ref - anchor_cand - delta), 0, 1))

def token_mask(turns):                                # 只改 mask，不改优势
    f = first_degenerate_turn(turns)                  # GVPM：连续 2 轮硬检退化
    return [int(t.is_model and not t.bad_turn and t.idx < f) for t in turns]
```

L0–L2 内部**不做**进度子分排序：PhyCAD 把 L0 细分成 6 项子分，在我们这里会诱导"修语法但不修几何"的刷分。如果 P1 发现死组率过高，再在 L1/L2 内部加入"issue 计数取负"的秩作为备选。

---

## 3. 战线压缩

### 3.1 原方案为什么跑不下来

原流水线是 S0 → 1A → 1B → 3 个单轨 RL → 跨压缩 RL → MOPD，共 **7 次训练、每次对应一个检查点评测门**。在 16 卡、1–2 人的配置下，每次转换（导出、回载、评测、对齐模板）实测都要 1–2 天，光转换损耗就有约 2 周，而且每一步都会引入新的漂移源。MOPD 还要求为 384K 序列缓存三个专家的 hidden state 或 logits，这本身就是一个独立的工程项目。

### 3.2 拍板：单模型、多轨、按题组归一化的 RL

你的质疑是对的。组相对优势本来就在同一题 $x$ 的 $G$ 条 rollout 内部归一化，**不同轨道永远不会在同一个组里比大小**。上面的公式对每题输出的都是零均值、单位方差的优势，"跨轨奖励尺度打架"在优势层面**不成立**。DeepSeek-V4 和 Kimi K3 选择分域专家，背景是数十个领域、万卡集群、各领域思考预算不同，不能照搬到 3 轨 16 卡的场景。

单模型方案下真正要处理的是以下 4 个问题，以及对应的解法：
1. **梯度份额由 token 数决定，而不是由题数决定。** $|\mathcal M|$ 全局 token 归一化后，3D 长轨迹（数十 K token）会压过 CAD（数 K token）。解法：**先按轨道分别做 token-mean，再用固定权重 $(1/3,1/3,1/3)$ 合并**。这一点与 CompactionRL 的"全局 token 归一化"只在轨道内部适用，并不冲突。
2. **沙盒吞吐异构。** CAD 检查约 30–240 秒、主要吃 CPU；3D/2D 依赖 Chromium，约 60–180 秒加 VLM 调用。解法：异步池按轨道分别限流，**每个 batch 按题数配平后整组提交**，不允许"快轨抢步"。
3. **遗忘。** 解法：混入 10–15% 的 SWE SFT 回放 loss，并对 SFT 检查点加 low-var KL（$\beta=0.01$）。
4. **轨道间负迁移是可测的。** 解法：每 25 步分轨报一次 `Accepted@1`，**任何一轨相对 SFT 下降超过 2pp 且持续 2 个评测点**时，才解锁"该轨单独 LoRA 专家 + 单教师 OPD 回灌"这条备选路线。

### 3.3 收敛后的路线图

**MVP（必做）：**
- **Step 0（已在做）**：S0 SFT 收口。同时修复 §4.3 中的 4 处验收器缺陷，并把三个脚本统一包成 `level()` 接口。
- **Step 1：Repair-RL（单模型三轨）。** 起点是 SFT 模型自己的 L1–L3 中等产物快照，加上检查器的 issue 列表。每回合 ≤12 轮、≤64K 上下文，参数 $G=8$、每步 24 题（每轨 8 题）。用上面的公式，KL 加回放，跑约 150–300 步。
- **Step 2：RFT 回灌。** 用 RL 检查点在全长 384K 题目上采样，经离线五维木桶加 Best-of-2 过滤后，做 1 epoch 的 SFT。长程能力**通过 RFT 获得，而不是通过在线 RL 获得**。

**触发式备选（按瓶颈解锁）：**
- 某轨负迁移 >2pp → 该轨 LoRA 专家 + OPD
- L0 全挂题占比 >40% → AggreVaTe
- 跨压缩段失败成为主要错误类型 → RECAP / CompactionRL
- 2D 收敛慢 → ATC
- 熟题出现冗长轮次 → Toggle

---

## 4. 盲点压力测试

### 4.1 同源裁判共谋

$r=0.838$ 是在**静态分布**上测出的相关性。在线 RL 是对抗性优化：几百步之后，策略会专门搜索裁判的错误方向。当 Actor 与裁判共享视觉编码器和预训练分布时，二者的盲区**高度相关**，Goodhart 来得最快（WebCatalyst 的 Self-Anchor 在 40–70 步后失稳就是同类现象）。

低成本防法：
1. 在线 L3 裁判使用**异族模型**（已有 `kimi-k3.1-pro` 通道），并且**只对 L3 样本调用**，硬检短路后实际调用量约为全部 rollout 的 30–50%。
2. 裁判输入强制附带确定性 telemetry（现有 judge prompt 已经这样做），并且**只用秩、不用绝对分**，降低对裁判绝对校准的依赖。
3. 本地 27B 仅作为影子裁判：监测"27B 分 − 外部分"的差值。**该差值单调上升就是共谋或刷分信号**；超过 0.15 时冻结并回滚。
4. 每 50 步抽 30 个产物做人工或 Opus 的双序盲评，作为最终仲裁。
5. 每题准备 2 个以上 rubric 改写版本，并随机轮换。

### 4.2 384K 在线 RL 的算力账

以下为估算，带 ★ 的前提**必须用 `config.json` 核实**。

- **权重**：27B BF16 约 54GB。训练侧 8 卡 FSDP/TP，权重、梯度、优化器状态合计约 430GB，均摊到每卡约 54GB，余量很小，长序列只能靠 CP 加重计算。
- **KV cache ★**：
  - 若是混合架构（每 4 层只有 1 层全注意力，约 16 层，4 个 KV head，head dim 256）：约 64KB/token，384K 序列约 **25GB/条**。
  - 若是标准 dense（64 层，8 个 KV head，head dim 128）：约 256KB/token，384K 序列约 **100GB/条，单卡放不下**。
  - 推理侧 8 卡扣除权重后约剩 500GB，前者能并发约 20 条，后者只能 4–5 条。
- **单条长程 rollout**：50–150 轮 ×（每轮生成 1–3K token 约 20–60 秒 + prefill 增量 + 工具执行 5–30 秒 + 渲染截图）≈ **1–2.5 小时**。
- **单步耗时**：一步需要 $24\times8=192$ 条。在并发 20 的条件下，约 10 批 × 1.5 小时 ≈ **15 小时/步**，再加上 384K 反向传播。**一天走不到 2 步，300 步要半年**，这条路必然卡死。
- **Repair-RL 的账**：≤64K、≤12 轮，单条约 6–12 分钟；KV 每条约 4GB，可并发 100 条以上。单步 192 条约 20–30 分钟。300 步约 5–6 天，**可行**。
- **沙盒 CPU**：192 条 × 每条 3–5 次检查（`cad_inspect` 上限 240 秒、2D check 加 mp4 约 240 秒、3D capture 180 秒）。需要约 64–96 个 CPU 核的 Chromium/OCC 池，并且**与 GPU 机器分离部署**。
- **裁判**：如果在本机自托管 27B 裁判，要占走 4–8 卡，训练侧被腰斩。用外部 API，按约 100 次 L3 调用/步 × 约 8K token 估算，成本可控。

### 4.3 现行验收器的硬缺陷（开 RL 前必须修，否则会被直接利用）

1. **3D 双标准互相冲突。** `threejs_rubric_judge.GatePolicy` 默认 `require_standalone_inline / require_deterministic_render_at / require_working_slider=True`，并且走 `file://` 采集。但 11-26 决策要求 3D 展示类使用 XHS 多文件、`http.server`、不强制 `renderAt`。直接用它做奖励，**所有合规的 XHS 产物都会被判成 L0/L1**。另外它默认读取 `.env.deepseek`，按规格文档该 key 已经返回 401。
2. **`verify_xhs_output.cjs` 可被刷分。**
   - `orbit.responds` 只看 64×48 下采样后 MAD≥3：场景自转就能骗过；
   - 控件只探测前 2 个按钮且没有冻结时钟，`rAF` 动画会让"控件有效"产生假阳性；
   - `L1` 允许 `index.html≥200KB` 替代本地 three.js，可以用填充内容凑体积。
   - 修法：冻结时钟（`page.clock.install`）、用 `elementFromPoint` 确认命中、采用"关自转后对比"的差分。
3. **`cad_inspect._check_pairwise_brep_interference` 会漏报。** 当 `BRepAlgoAPI_Common` 的 `IsDone()=False` 时直接 `continue`，**布尔运算失败被当成零干涉**。策略可以学会造病态几何让布尔失败。修法：失败时计为干涉，或者把该样本判 L1。
4. **`check_2d_v2.mjs` 的覆盖缺口。**
   - 文字重叠只检查 `svg text`、`.callout` 等特定选择器，HTML 正文和 Canvas `fillText` 都绕过了；
   - 没有剥离 `overflow:hidden`（坑 03 声称已"合入"，实际代码中没有）；
   - 确定性检查用 SHA 精确相等，对字体抗锯齿差异很脆，容易误杀，需要在固定容器镜像内运行。

---

## 5. 48 小时 Go/No-Go 探针

### P1 · 信号密度探针（约 10 小时，只做推理，零训练）

- **输入**：SFT 检查点；每轨 20 道 Repair 题，共 60 题；$G=8$；温度 1.0。
- **对照臂**：A 用本报告公式；B 用原 `_score_5dim_gate` 均值做 GRPO 白化；C 用 HBA+GDPO 叠加。
- **测量**：
  - 有效（非死）组比例；
  - L 分布；
  - C 臂中"低层优势 > 高层优势"的逆序对比例；
  - 每条 rollout 的检查器耗时和 infra 失败率。
- **通过条件**：A 臂有效组 ≥60%；每轨 L3 比例落在 15–85%；infra 失败 <5%；C 臂逆序 >0（用实测确认 C1 冲突）。
- **止损**：有效组 <35%，说明题目太难或太易，先重新分层题池，**不开 RL**；infra >10%，先修沙盒。

### P2 · 裁判抗共谋探针（约 12 小时）

- **输入**：200 个 L3 产物（三轨均衡），以及每个产物的 3 种对抗扰动：去材质/阴影/装饰、加 `<text>` 或 HUD 字牌、简化为色块但功能保留。共 800 个样本。
- **对照臂**：本地 27B、kimi-k3.1-pro、Opus 双序（作为金标准）。
- **测量**：
  - 原件对扰动件的胜率；
  - 与金标准的成对一致率；
  - 27B 对 27B 自产样本的偏好差（自产与教师产物在金标准评分相同时的分差）。
- **通过条件**：外部裁判识别退化 ≥85%、与金标准一致 ≥70%。
- **止损**：外部裁判也 <60%，则 L3 只用确定性指标加锚点像素/结构差，暂不用 VLM；27B 自偏好 >0.1，则**永久禁止其进入在线奖励**。

### P3 · 微型 RL 稳定性与吞吐探针（约 20 小时）

- **输入**：先只用 CAD 和 2D（检查器最硬、最快）；每步 16 题 × $G=8$；Repair 模式 ≤32K 上下文；跑 30 步。
- **对照臂**：本报告公式加 KL 加回放，对照"同配置去掉回放和 KL"。
- **测量**：
  - 单步墙钟时间；
  - 训推 logprob 差的 p99（检验 TITO）；
  - 熵曲线；
  - L 均值曲线；
  - 留出 30 题的 `Accepted@1`；
  - SWE 小集合分数。
- **通过条件**：单步 ≤25 分钟；`|Δlogp|` p99 < 0.1；熵下降 <30%；L 均值单调上升；留出集不退化，SWE 下降 <1pp。
- **止损**：训推不一致说明 TITO 或模板有问题，停下修基建；熵崩塌，把 $\beta$ 提到 0.04 或 lr 减半后重测，仍失败就**退回 RFT-only 路线**（只做 RFT 迭代，不开在线 RL）。

**总判据**：P1、P2、P3 全部通过，才启动 §3.3 的 Step 1 正式 RL。任一止损触发，就执行对应的回退路线。RL 不作为"既然搭好了就要跑"的默认选项。
