# SFT 后阶段强化学习执行方案：单模型三轨等权 Repair-RL 与 384K RFT 回灌计划（Opus 5.5 联合审定版）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

- **制定日期**：2026-11-27
- **适用阶段**：Round 3 / XHS 对齐三轨基础 SFT 收口后的下一阶段后训练（Post-SFT Stage）
- **目标基座与硬件**：Dense `Qwen3.8-27B`（`${SHARED_DATA}/model/Qwen3.8-27B`），`gpu34 + gpu38`（`2×8 NVIDIA H800 80GB`）+ 独立 CPU/Headless Chromium/OCCT 沙盒池
- **上游研究依据**：
  - [主审 × Claude Opus 5.5 联合去杂糅审查与终极收敛蓝图](../../../research/3d-agent-rl-opus-review-and-consolidation-20261127/README.md)（含 [Opus 5.5 独立审查报告](../../../research/3d-agent-rl-opus-review-and-consolidation-20261127/opus-review.md) · [主审独立自审](../../../research/3d-agent-rl-opus-review-and-consolidation-20261127/main-consolidation.md)）
  - [SFT 后强化学习全景调研 v3.0](../../../research/3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源 31 大踩坑避坑大全](../../../research/visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md) · [2026 H2 大厂技术博客专题](../../../research/frontier-labs-agentic-rl-blogs-2026h2/README.md)
- **状态说明**：本文件为经独立 `claude-opus-5-5` 审查收敛后的工程实施草案，待 SFT 基线评测与 48h 探针通过后启动，不自动改写 `decisions.md`。

---

## 一、设计原则：为什么砍掉“15 项机制杂糅”与“从零 384K 在线 RL”？

1. **同一优势张量只允许一套保序骨架**：
   - 严禁叠加 `GDPO`（除 $\sigma_L$ 扭曲层差、白化视觉分达 $\pm 2.6$ 直接击穿 `PhyCAD HBA` 的 $\lambda_L > 2\lambda_w$ 保序条件）、`GVPM max(A,0)`（破坏组内零均值，给反复失败的长轨迹注入净正梯度）、`SRaR`（token 级轮次偏置击穿保序且裁判成本 $\times T$）与 `SDFT`（与 KL/回放锚点重复）。
2. **`2×8 H800` 物理算力铁账**：
   - 在 `384K` 窗口下，`Qwen3.8-27B`（16 层全注意力 + 48 层 GDN）单条 KV Cache 约 `25 GB`，8 卡推理池仅能并发 ~20 条；单条 50–150 轮含渲染耗时 `1–2.5 小时` $\implies$ **单步（192 条）需 ~15 小时，300 步需半年，物理不可行**。
   - **破局切法（`Step 1 Repair-RL -> Step 2 384K RFT`）**：在线 RL 专攻 **`≤64K` 上下文、`≤12` 轮的局部诊断与精修（Repair-RL）**（从 SFT 模型自身的 `L1–L3` 瑕疵工作区快照 + 检查器 `issues` 列表起步），单条 KV 仅 `~4 GB`、并发 `100+`、**单步 `20–30 分钟`（5–6 天跑完 300 步）**；随后用训好的 RL 权重在全长 `384K` 题库上离线采样，经五维木桶 + 正反双序 `Best-of-2` 筛选后做 **1 Epoch SFT 回灌（RFT）**，无需百万上下文在线 RL 基建即可把精修与审美能力写回长程生成。
3. **单模型三轨同训不打架**：
   - 组相对优势本就在**同一道题 $x$ 的 $G=8$ 条 rollout 内部**计算，三轨绝不跨组比大小。唯一需平衡的是 3D 输出 token 数远长于 CAD：**先在每轨内部除以该轨有效可训 token 总数 $|\mathcal{M}_d|$，再按 `(1/3, 1/3, 1/3)` 等权合并三轨损失**，辅以 `10–15%` 通用 SWE SFT 回放与 `low-var KL`（$\beta=0.01$）。

---

## 二、开工前必补的 4 项现行检查脚本加固（Step 0 收口期同步完成）

1. **`scripts/cad_inspect.py`（第 219–223 行 & CLI 参数）**：
   - 修复 `_check_pairwise_brep_interference` 中 `if not common.IsDone(): continue` 静默跳过漏洞：**凡 `IsDone() == False` 一律记入 `issues` 判为 $L_2$ 干涉失败**，堵死构造病态自交几何让布尔崩溃白拿“零干涉”的刷分口子；
   - 在线 RL 阶段先以 `--no-render`（`<0.8s` 纯 OCCT）秒判 $L_0\sim L_2$，**仅对 `ok == True`（$L_3$）样本补跑 `views_grid.png / section_view.png / exploded_view.png` 渲染**。
2. **`scripts/eval_xhs_threejs/verify_xhs_output.cjs`（第 268、420–525 行）**：
   - 移除 `index_html_bytes >= 200000` 替代本地 `three.js` 的宽松豁免（防塞注释凑体积）；
   - 探测 `OrbitControls` 与 UI 控件时接入 Playwright `page.clock.install()` 冻结 `rAF` 自转时钟，**仅截取 WebGL `<canvas>` 元素像素计算 `MAD`**（防场景微弱自转或点击弹出纯 HTML 浮层骗过交互分），并用 `elementFromPoint` 核验真实点击命中。
3. **`threejs_rubric_judge.py` 门禁对齐**：
   - 将 `GatePolicy` 按四字段契约（`bundle_mode` / `needs_http_server` / `motion_type`）解耦，使 `11-26` 拍板的小红书多文件 `http.server` 展示场景不再被旧单文件 `file://` + `renderAt` 默认规则误判为 `L0/L1`。
4. **`scripts/check_2d_v2.mjs`（第 488–552 行 `viewport_audit`）**：
   - 碰撞检查扩展覆盖普通 HTML 正文文本节点；测量前临时剥离非画布裁剪容器的伪装 `overflow: hidden` / `min-height`；固定统一容器字体环境运行确定性 `sha256` 校验。

---

## 三、指标三层归位与唯一优势合成规范

### 3.1 指标三层边界
- **进在线 RL 奖励（仅 3 个输入）**：① 确定性四层 $L_i \in \{0,1,2,3\}$（0 次 VLM 调用）；② **仅对 $L_i=3$ 幸存样本**调用异族模型（`kimi-k3.1-pro`）计算的 Rubric 均分减单边视觉锚点退化 $q_i \in [0,1]$；③ 二值 `token_mask` $m_{i,t} \in \{0,1\}$（5 类坏轮 + GVPM 连续 2 轮硬检退化后缀 + 非模型轮）。
- **仅留离线造数 / Step 2 RFT 过滤**：五维木桶（单维 $\ge 0.50$、均分 $\ge 0.60$）、$\Delta(d_{\mathrm{geo}})$ 几何难度补偿（在线同题恒等抵消）、正反双序 `Best-of-2`（在线全成对需 56 次调用过贵）、`POW3R` 死条目清洗、Ideal 样本自洽度 $\ge 0.9$ 校验。
- **仅留 Eval-Only（永不进训练）**：**三轨独立 `Accepted@1`（主报）**、`BenchCAD`（含外部 `Voxel IoU`）、`AnimWeb-Bench`、`MotionGraphicsBench`、`xhs-threejs-val`、`ModelForge / SWE` 通用基准、Rubric-Free 双序盲评、**`本地 27B 影子分 − 异族裁判分` 共谋漂移差（`>0.15` 触发熔断回滚）**。

### 3.2 唯一优势与损失公式

对单题 $G=8$ 条采样（剔除 `infra_error` 后剩 $G'$ 条，若 $G' < 6$ 整组丢弃重采）：

$$q_i = \mathrm{clip}\!\left(\frac{1}{|R|}\sum_{j\in R} s_{ij} - \kappa\big[a^{\mathrm{ref}} - a_i - \delta\big]_+,\; 0,\; 1\right)\cdot \mathbb{1}[L_i = 3], \qquad (\kappa=1.0,\; \delta=0.10)$$

$$\tilde{A}_i = \begin{cases} \dfrac{2\,\mathrm{rank}^{\mathrm{tie}}_{\mathcal{I}_3}(q_i) - (|\mathcal{I}_3| + 1)}{|\mathcal{I}_3| - 1} \in [-1, 1], & L_i = 3 \land |\mathcal{I}_3| > 1 \\[6pt] 0, & \text{otherwise} \end{cases}$$

$$A_i = \frac{(L_i - \bar{L}) + 0.25\,\tilde{A}_i}{\max(\sigma_{\mathrm{grp}},\, 0.50)}, \qquad (\text{若分子全 } 0 \text{ 判为死组直接剔除})$$

$$\mathcal{L}_{\mathrm{total}}(\theta) = \frac{1}{3}\sum_{d \in \{\text{3D},\text{2D},\text{CAD}\}} \left[-\frac{1}{|\mathcal{M}_d|}\sum_{(i,t)\in\mathcal{M}_d} \min\!\big(s_i(\theta)A_i,\; \mathrm{clip}(s_i(\theta), 1-\epsilon_l, 1+\epsilon_h)A_i\big)\right] + 0.01\,\mathrm{KL}_{\mathrm{lowvar}}(\pi_\theta \parallel \pi_{\mathrm{SFT}}) + \alpha_{\mathrm{replay}}\mathcal{L}_{\mathrm{SFT}}^{\mathrm{SWE}}$$

> **数学性质保证**：① 任意 $L_3$ 与 $L_2$ 分子之差 $\ge 1.0 - 2\times 0.25 = +0.50 > 0$（严格跨层保序）；② 每层内部居中秩之和恒为 $0$，故 $\sum_i A_i \equiv 0$（严格零均值无偏）；③ $\max(\sigma_{\mathrm{grp}}, 0.50)$ 防止 `7:1` 极端稀疏组除极小方差炸穿权重；④ `GSPO` 序列似然比配 `TITO` 词元直通与 `IcePop` $\rho \notin [0.5, 2.0]$ 置零。

---

## 四、48 小时三道准入探针（P1–P3）与正式训练排期

| 阶段 | 预算与配置 | 通过门禁（Go） | 止损回退条件（No-Go） |
|---|---|---|---|
| **Probe P1：信号密度探针**<br>（~10h，纯推理零训练） | SFT 检查点 × 三轨各 20 道 Repair 题 × $G=8$（`T=1.0`） | 非死组率 `>= 60%`；每轨 $L_3 \in [15\%, 85\%]$；`infra_error < 5%` | 有效组 `< 35%` $\to$ 重筛题池难度；死组率 `> 40%` 时才开启 $L_1/L_2$ `-issue_count` 备选秩 |
| **Probe P2：裁判抗共谋探针**<br>（~12h，离线评测） | 200 个真实 $L_3$ 产物 × 3 类退化扰动（去材质留色块 / 塞字牌 / 微改） | `kimi-k3.1-pro` 识别原件胜率 `>= 85%`、与 Opus 双序一致率 `>= 70%` | 异族裁判 `< 60%` $\to$ $L_3$ 暂只用确定性指标 + 锚点结构差；本地 `27B` 自偏好 `> 0.10` 则永禁进在线奖励 |
| **Probe P3：30 步微型稳定性**<br>（~20h，先跑 CAD + 2D） | `16 题 × G=8`，`≤32K` Repair 模式跑 30 步 | 单步 `<= 25 min`；训推 `\|Δlogp\| p99 < 0.1`；熵降 `< 30%`；$L$ 均值上升；SWE 掉点 `< 1 pp` | `\|Δlogp\|` 异常先修 `TITO`；熵崩且调 $\beta=0.04$ 无效 $\to$ **立即止损退回纯 `RFT` 迭代路线** |
| **Step 1：正式 Repair-RL**<br>（5–6 天，`2×8 H800`） | 三轨各 8 题/步（共 24 题 × $G=8 = 192$ 条/步），`≤64K` 窗、`≤12` 轮，150–300 步 | 每 25 步分轨测留出 `Accepted@1` 与 `27B` 影子共谋差 | 任一轨相对 SFT 连续两次掉 `> 2 pp` $\to$ 解锁该轨独立 LoRA + 单师 OPD；影子差 `> 0.15` 回滚 |
| **Step 2：全长 `384K` RFT 回灌**<br>（1–2 天，`ms-swift`） | 用 Step 1 最优权重采全长 `384K` 多轮轨迹，过五维木桶 + 双序 `Best-of-2` 筛优做 1 Epoch SFT | 三轨独立留出集 `Accepted@1` 与盲评胜率净提升，`ModelForge` 守住门线 | — |
