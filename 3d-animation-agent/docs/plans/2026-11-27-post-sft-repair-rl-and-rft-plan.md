# SFT 后阶段强化学习执行方案：Stage 3 Repair-RL（40:25:25:10）与 Stage 4 256K 在策略 RFT（+20% 384K 回放）计划（Revision 3 / Option 2 对齐版）

> 公开整理版 · 2026-11-28。保留成文时点的记录；计划、文献结果和本地实测请分别理解。环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

- **制定日期**：2026-11-27（已按 Revision 3 / Option 2 [OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md](../../../research/xhs-384k-to-200k-data-adaptation-20261127/OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md) §0、§4.3 与 `decisions.md`（本地附件未发布） 对齐更新）
- **适用阶段**：Option 2 Stage 1（`384K` XHS 筑基）+ Stage 2（多轨均衡退火）收口后的后训练阶段（**Stage 3 `Repair-RL` + Stage 4 `256K` 在策略 `RFT`**）
- **目标基座与硬件**：Dense `Qwen3.8-27B`（**全链路锁定同一份 `Static YaRN 1.5×`**，`max_position_embeddings=393216, factor=1.5, original_max_position_embeddings=262144, mrope_interleaved=true, mrope_section=[11,11,10], partial_rotary_factor=0.25, rope_theta=10000000`），`32×H100`（Stage 3：`16` 卡 vLLM + `16` 卡训练 `TP4·PP4·CP1`，`220` 步约 `~3.5 天`，`lr=1e-6, kl=0.01, freeze_vit=true`；Stage 4：`~1.5 天` `50` 步，`256K` 沙盒 `208000 / 80% / 32768 / 16384`）+ 独立 CPU/Headless Chromium/OCCT 沙盒池
- **上游研究依据**：
  - [主审 × Claude Opus 5.5 联合去杂糅审查与终极收敛蓝图](../../../research/3d-agent-rl-opus-review-and-consolidation-20261127/README.md)（含 [Opus 5.5 独立审查报告](../../../research/3d-agent-rl-opus-review-and-consolidation-20261127/opus-review.md) · [主审独立自审](../../../research/3d-agent-rl-opus-review-and-consolidation-20261127/main-consolidation.md)）
  - [SFT 后强化学习全景调研 v3.0](../../../research/3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源 31 大踩坑避坑大全](../../../research/visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md) · [2026 H2 大厂技术博客专题](../../../research/frontier-labs-agentic-rl-blogs-2026h2/README.md)
- **状态说明**：本文件为经独立 `claude-opus-5-5` 审查收敛后的工程实施草案，待 SFT 基线评测与 48h 探针通过后启动，不自动改写 `decisions.md`。

---

## 一、设计原则：为什么砍掉“15 项机制杂糅”与“从零 384K 在线 RL”？

1. **同一优势张量只允许一套保序骨架**：
   - 严禁叠加 `GDPO`（除 $\sigma_L$ 扭曲层差、白化视觉分达 $\pm 2.6$ 直接击穿 `PhyCAD HBA` 的 $\lambda_L > 2\lambda_w$ 保序条件）、`GVPM max(A,0)`（破坏组内零均值，给反复失败的长轨迹注入净正梯度）、`SRaR`（token 级轮次偏置击穿保序且裁判成本 $\times T$）与 `SDFT`（与 KL/回放锚点重复）。
2. **算力与长窗解耦铁账（Stage 3 + Stage 4 全程锁定 `Static YaRN 1.5×`）**：
   - 在 `384K` 窗口下从零跑在线长程 RL（50–150 轮含渲染耗时 `1–2.5 小时`），算力与吞吐均不可行。
   - **Option 2 定案切法（`Stage 3 ≤64K Repair-RL -> Stage 4 256K On-Policy RFT`）**：
     - **Stage 3（`~3.5 天`，`220` 步）**：在线 RL 专攻 **`≤64K` 上下文、`≤12` 轮的局部诊断与精修（Repair-RL）**（从 Stage 2 权重自身的 `L1–L3` 瑕疵工作区快照 + 检查器 `issues` 起步），部署在 **`16` 卡 vLLM + `16` 卡训练（`TP4·PP4·CP1`, `GSPO-token`, `lr=1e-6, kl=0.01, freeze_vit=true`）**，保持完全相同的 `Static YaRN 1.5×`；
     - **Stage 4（`~1.5 天`，`50` 步）**：在 **`256K` 沙盒（`208000 / 80% / 32768 / MAX_TOOL_RESULT_TOKENS=16384`，`vLLM --max-model-len 327680` 保持同一 `Static YaRN 1.5×`）** 执行 `N=4` 采样过硬检 + 跨家族 `Best-of-2` 在策略蒸馏（**禁止同家族自评**），同时**混入 `20%` 全新未切分 `384K` XHS 回放 + `15%` SWE**（在 `MAX_LENGTH=393216` 下锁死长程上限不退化），最终收官 **`Qwen3.8-27B-Unified-Option2-Final`**。
3. **单模型四路确定性配比（Option 2 定案 `40:25:25:10`）**：
   - 组相对优势本就在**同一道题 $x$ 的 $G=8$ 条 rollout 内部**计算，三轨绝不跨组比大小。先在每轨内部除以该轨有效可训 token 总数 $|\mathcal{M}_d|$，Stage 3 按 **`40%` XHS + `25%` CAD + `25%` 2D + `10%` SWE** 合并（取代早期 `(1/3, 1/3, 1/3)` 草案），辅以 `low-var KL`（$\beta=0.01$）。

---

## 二、开工前必补的检查脚本加固（已扩展对齐 Option 2 §0 全部 10 项前置修复）

1. **`scripts/cad_inspect.py` 5 处修复与 `verify_frontier_cad.py:243`**：
   - **L221 `!common.IsDone()`**：`_check_pairwise_brep_interference` 禁止 `continue` 放行，凡 `IsDone() == False` 硬判为 $L_2$ 碰撞失败并体素兜底；
   - **连通性与配合间隙**：新增 `BRepExtrema_DistShapeShape` 单连通组件判定（`≤1.0mm`）与装配配合间隙检验（`0.15–0.60mm`）；
   - **拓扑与体积底线**：新增 `BRepCheck_Analyzer.IsValid()`、正向有符号体积、子件最小体积 `≥ max(50mm³, 0.5% 总容积)`；
   - **L576–604 `--probe` 硬拦截**：将 `--probe` 失败与零变化（`max(|Δdims|)<0.05 & |Δvol|<1.0`）写入 `issues` 硬拦截非参数化硬编码脚本；
   - **AST 与渲染**：子进程 AST 硬封禁 `bpy/bmesh/importStep`，升级 6 视角渲染（含底视/后视 + `flatShading`；在线 RL 先传 `--no-render` 秒判 $L_0\sim L_2$，仅 `ok==True` 补渲染）；同步修复 `verify_frontier_cad.py:243` 流道空腔体积公式。
2. **`scripts/eval_xhs_threejs/verify_xhs_output.cjs`（第 268、420–525 行）**：
   - 移除 `index_html_bytes >= 200000` 替代本地 `three.js` 的宽松豁免（防塞注释凑体积）；
   - 探测 `OrbitControls` 与 UI 控件时接入 Playwright `page.clock.install()` 冻结 `rAF` 自转时钟，**仅截取 WebGL `<canvas>` 元素像素计算 `MAD`**，并用 `elementFromPoint` 核验真实点击命中。
3. **`threejs_rubric_judge.py` 门禁对齐**：
   - 将 `GatePolicy` 按四字段契约（`bundle_mode` / `needs_http_server` / `motion_type`）解耦，使小红书多文件 `http.server` 展示场景不再被旧单文件 `file://` + `renderAt` 默认规则误判为 `L0/L1`。
4. **`scripts/check_2d_v2.mjs → check_2d_v3.mjs` 6 处修复（含 2D 沙盒物理隔离）**：
   - **删除 `data-allow-clip` (L297) 与 `data-allow-overlap` (L505)** 两处作弊后门；
   - L378 SHA-256 改为非 HUD 区域真实运动门禁（`MAD ≥ 1.5`、变化像素面积 `≥ 1.5%`、6 帧两两最小 `SSIM ≤ 0.985`）；
   - L383 `renderer === 'svg'` 改为 `stageInfo.hasSvg`（堵住 `hybrid` 跳过 SVG 审计漏洞）；
   - 主渲染升至 `1280×720` 并双视口（`1280×720` + `1440×900`）全时间点检查文本/SVG 重叠率 **`≤10%`** 与 `overflow:hidden` / `scrollWidth` 截断；
   - 校验 `window.__SCENE_READY__`、`window.__2D_STATE__` / `__getSceneState()` 及 `ffprobe` 解码 MP4；
   - **硬封禁 `three`/`THREE`/`OrbitControls`/`WebGLRenderer`/`getContext('webgl'|'webgl2')`**（2D 沙盒仅挂 `playwright-core` 隔离 `web2d_node_modules` 与本地 `vendor/gsap/gsap.min.js`）。

---

## 三、指标三层归位与唯一优势合成规范

### 3.1 指标三层边界
- **进在线 RL 奖励（仅 3 个输入）**：① 确定性四层 $L_i \in \{0,1,2,3\}$（0 次 VLM 调用）；② **仅对 $L_i=3$ 幸存样本**调用异族模型（`kimi-k3.1-pro`）计算的 Rubric 均分减单边视觉锚点退化 $q_i \in [0,1]$；③ 二值 `token_mask` $m_{i,t} \in \{0,1\}$（5 类坏轮 + GVPM 连续 2 轮硬检退化后缀 + 非模型轮）。
- **仅留离线造数 / Stage 4 RFT 过滤**：五维木桶（单维 $\ge 0.50$、均分 $\ge 0.60$）、$\Delta(d_{\mathrm{geo}})$ 几何难度补偿（在线同题恒等抵消）、正反双序 `Best-of-2`（在线全成对需 56 次调用过贵）、`POW3R` 死条目清洗、Ideal 样本自洽度 $\ge 0.9$ 校验。
- **仅留 Eval-Only（永不进训练）**：**三轨独立 `Accepted@1`（主报）**、`BenchCAD`（含外部 `Voxel IoU`）、`AnimWeb-Bench`、`MotionGraphicsBench`、`xhs-threejs-val`、`ModelForge / SWE` 通用基准、Rubric-Free 双序盲评、**`本地 27B 影子分 − 异族裁判分` 共谋漂移差（`>0.15` 触发熔断回滚）**。

### 3.2 唯一优势与损失公式

对单题 $G=8$ 条采样（剔除 `infra_error` 后剩 $G'$ 条，若 $G' < 6$ 整组丢弃重采）：

$$q_i = \mathrm{clip}\!\left(\frac{1}{|R|}\sum_{j\in R} s_{ij} - \kappa\big[a^{\mathrm{ref}} - a_i - \delta\big]_+,\; 0,\; 1\right)\cdot \mathbb{1}[L_i = 3], \qquad (\kappa=1.0,\; \delta=0.10)$$

$$\tilde{A}_i = \begin{cases} \dfrac{2\,\mathrm{rank}^{\mathrm{tie}}_{\mathcal{I}_3}(q_i) - (|\mathcal{I}_3| + 1)}{|\mathcal{I}_3| - 1} \in [-1, 1], & L_i = 3 \land |\mathcal{I}_3| > 1 \\[6pt] 0, & \text{otherwise} \end{cases}$$

$$A_i = \frac{(L_i - \bar{L}) + 0.25\,\tilde{A}_i}{\max(\sigma_{\mathrm{grp}},\, 0.50)}, \qquad (\text{若分子全 } 0 \text{ 判为死组直接剔除})$$

$$\mathcal{L}_{\mathrm{total}}(\theta) = \sum_{d \in \{\text{XHS},\text{CAD},\text{2D}\}} w_d \left[-\frac{1}{|\mathcal{M}_d|}\sum_{(i,t)\in\mathcal{M}_d} \min\!\big(s_i(\theta)A_i,\; \mathrm{clip}(s_i(\theta), 1-\epsilon_l, 1+\epsilon_h)A_i\big)\right] + 0.01\,\mathrm{KL}_{\mathrm{lowvar}}(\pi_\theta \parallel \pi_{\mathrm{SFT}}) + w_{\mathrm{SWE}}\mathcal{L}_{\mathrm{SFT}}^{\mathrm{SWE}}$$

*(Option 2 定案比例：$w_{\text{XHS}}=0.40,\; w_{\text{CAD}}=0.25,\; w_{\text{2D}}=0.25,\; w_{\text{SWE}}=0.10$)*

> **数学性质保证**：① 任意 $L_3$ 与 $L_2$ 分子之差 $\ge 1.0 - 2\times 0.25 = +0.50 > 0$（严格跨层保序）；② 每层内部居中秩之和恒为 $0$，故 $\sum_i A_i \equiv 0$（严格零均值无偏）；③ $\max(\sigma_{\mathrm{grp}}, 0.50)$ 防止 `7:1` 极端稀疏组除极小方差炸穿权重；④ `GSPO` 序列似然比配 `TITO` 词元直通与 `IcePop` $\rho \notin [0.5, 2.0]$ 置零。

---

## 四、48 小时三道准入探针（P1–P3）与正式训练排期

| 阶段 | 预算与配置 | 通过门禁（Go） | 止损回退条件（No-Go） |
|---|---|---|---|
| **Probe P1：信号密度探针**<br>（~10h，纯推理零训练） | SFT 检查点 × 三轨各 20 道 Repair 题 × $G=8$（`T=1.0`） | 非死组率 `>= 60%`；每轨 $L_3 \in [15\%, 85\%]$；`infra_error < 5%` | 有效组 `< 35%` $\to$ 重筛题池难度；死组率 `> 40%` 时才开启 $L_1/L_2$ `-issue_count` 备选秩 |
| **Probe P2：裁判抗共谋探针**<br>（~12h，离线评测） | 200 个真实 $L_3$ 产物 × 3 类退化扰动（去材质留色块 / 塞字牌 / 微改） | `kimi-k3.1-pro` 识别原件胜率 `>= 85%`、与 Opus 双序一致率 `>= 70%` | 异族裁判 `< 60%` $\to$ $L_3$ 暂只用确定性指标 + 锚点结构差；本地 `27B` 自偏好 `> 0.10` 则永禁进在线奖励 |
| **Probe P3：30 步微型稳定性**<br>（~20h，先跑 CAD + 2D） | `16 题 × G=8`，`≤32K` Repair 模式跑 30 步 | 单步 `<= 25 min`；训推 `\|Δlogp\| p99 < 0.1`；熵降 `< 30%`；$L$ 均值上升；SWE 掉点 `< 1 pp` | `\|Δlogp\|` 异常先修 `TITO`；熵崩且调 $\beta=0.04$ 无效 $\to$ **立即止损退回纯 `RFT` 迭代路线** |
| **Stage 3 · 正式 `Repair-RL`**<br>（`~3.5 天`，`32×H100`：`16` vLLM + `16` train `TP4·PP4·CP1`） | `Static YaRN 1.5×`，**`40%` XHS + `25%` CAD + `25%` 2D + `10%` SWE**，`≤64K` 窗、`≤12` 轮，`220` 步，`GSPO-token`, `lr=1e-6, kl=0.01, freeze_vit=true` | 每 25 步分轨测留出 `Accepted@1` 与 `27B` 影子共谋差 | 任一轨相对 SFT 连续两次掉 `> 2 pp` $\to$ 解锁该轨独立 LoRA + 单师 OPD；影子差 `> 0.15` 回滚 |
| **Stage 4 · `256K` 在策略 `RFT` + `20%` `384K` 回放**<br>（`~1.5 天`，`50` 步，`Static YaRN 1.5×`） | 在 **`256K`（`208000 / 80% / 32768 / 16384`）沙盒**采 `N=4` 过硬检 + 跨家族 `Best-of-2`（禁止同族自评），混入 **`20%` 全新未切分 `384K` XHS 回放 + `15%` SWE** $\to$ **`Qwen3.8-27B-Unified-Option2-Final`** | 三轨独立留出集 `Accepted@1` 与盲评胜率净提升，`ModelForge` 守住门线，长程 `384K` 上限零退化 | — |
