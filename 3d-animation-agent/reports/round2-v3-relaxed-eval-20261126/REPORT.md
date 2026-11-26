# Round 2 收口总报告：宽松新标准（65K / 262K / img32）`Base` vs `v3_e2` 全量配对评测与完整 `Eval v3` 盲评闭环

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

- **归档日期**：2026-11-26
- **报告目录**：`${WORKSPACE}/3d-animation-agent/reports/round2-v3-relaxed-eval-20261126/`
- **被测双臂（100% 同口径对称评测）**：
  - `base`：原生 BF16 `${MODEL_ROOT}/Qwen3.8-27B`（`gpu34` 2×TP4）
  - `v3_e2`：Round 2 `v3-full` Epoch 2 `checkpoint-350`（`${SHARED_DATA}/3d-agent-sft/round2-v3-full-20261125/eval-hf/ckpt-350-serving`，`gpu38` 2×TP4）
- **新标准协议对齐**（[STANDARD-PARAMS.md](../../docs/STANDARD-PARAMS.md)）：
  - `CLAUDE_CODE_MAX_OUTPUT_TOKENS = 65536`、`max-model-len = 262144`、`CLAUDE_CODE_AUTO_COMPACT_WINDOW = 180000`、`--limit-mm-per-prompt '{"image":32,"video":0}'`、`--effort medium`、`TRIAL_TIMEOUT_S = 3600`、`--max-per-replica 8`
  - 统一只读挂载 `chat_template.compat.jinja`（本地附件未发布）（兼容 `low/medium/xhigh/high=xhigh`）
  - 升级版 `compat.py`（本地附件未发布）（内嵌 `system` 归一化 + 上下文防溢出自动 clamp + 15s 官方 Anthropic SSE `event: ping` 帧边界心跳保活，全程 **0 次客户端假超时、0 次 API 错、0 次空答早停**）
- **核心交付凭据**：
  - 16×H800 全清零凭据：`gpu-cleanup.json`（本地附件未发布）（`phase: "released"`，`gpu34` & `gpu38` 全 16 张 H800 均为 `0 MiB / 0 计算进程 / 0 残留容器`，4 份 vLLM 日志已归档至 `service-logs/`（本地附件未发布））
  - 评测产物与 `Eval v3` Layer 1 浏览器证据：`runs/`（本地附件未发布）（`Base 60/60` + `v3_e2 58/60`，最后 2 道排队尾题按用户指示提前 1h 干净收口释放 H800）、`eval-v3/evidence/`（本地附件未发布）（118/118 抓帧 + 纯 WebGL 帧差 + 12 帧 `poster.jpg`）
  - **`Eval v3` Layer 2 严格盲评结果**：`eval-v3-self-results.json`（本地附件未发布）（因 `.env.deepseek` 余额耗尽 `RemainQuota=-34313`，经用户确认采用 **Antigravity 严格双盲自评**：4 个并行独立盲评子代理盲打 71 份匿名 `S01–S71` 单品五维分 + 主代理独立盲评 17 对 50/50 翻转 `P01–P17` 正面对决；全部锁定落盘后才揭盲，且与 `scripts/eval_3d_v3.py` 确定性护栏 100% 一致，单品分与成对胜负方向一致率达 **`15/17 = 88.2%`**）
  - 视觉对比总览图：`top_v3_e2_wins.png`（本地附件未发布） · `top_base_wins.png`（本地附件未发布）

---

## 一、核心结论（Round 2 完整闭环定论）

1. **🚀 宽松新标准直接释放了原生 `Base Qwen3.8-27B` 的多轮能力，并暴露了 Round 3 真正的提分靶心**：
   - 将输出上限从旧 `8192` 放宽至 `65536`（叠加 `image=32` 与并发 8）后，原生 `Base 27B` 在 `devtest-v2` 60 题上：**可渲染率 `54/60 (90.0%)`**（旧 8K `76.7%`）、**全量视觉均分 `64.6 / 100`**（可渲染子集均分 `71.8 / 100`）、**视觉通过 `20/60 (33.3%)`**、**无超时端到端干净全过 `E2E Clean Pass = 15/60 (25.0%)`**（技术全过 `29/60 = 48.3%`，较旧 8K `20.0%` 暴涨 `+28.3pp`）。
   - **原生 27B 自身五维画像（54 份可渲染）**精准锁定了 Round 3 的主攻方向：`task_and_math_fidelity = 3.94`、`motion_and_dynamics = 3.91`、`concept_and_geometry = 3.76` 已很扎实，真正的短板是 **`visual_craft_and_composition = 3.00 / 5`** 与 **`usability_and_interactivity = 3.33 / 5`**（大量 `24/54` 样本因 HUD 压挡主体、取景过暗/偏远、动画节奏太慢卡在 `minor_issue`）以及 `50%` 的超时率。
2. **⚖️ Round 2 `v3_e2 (ckpt-350)` 完整定性：“单轮天花板创历史新高，但多轮 Agent 因缺乏看图自检迭代呈严重两极分化”**：
   - **单轮无截断（[Aodi 30 xhigh](../round2-v3-full-eval-20261126/REPORT.md)）**：**🏆 `26 / 30 (86.7%)`** 创全历史最高分（超原生 27B `22/30` +4 题、Round 1 `24/30` +2 题，0 语法错、0 依赖错、0 死循环）。
   - **多轮 Agent 全量（宽松 65K `devtest-v2`，共同 58 题配对）**：
     - 全量四轨被 `Base` 显著拉开：**可渲染率 `29.3%` vs `91.4%`**、**全量产品视觉均分 `19.66` vs `65.31`**（Family Bootstrap `Δ = -47.33`, `95% CI: [-59.44, -34.50]`）、**`Visual Pass` `12.1%` vs `32.8%`**、**`E2E Clean Pass` `0.0%` vs `24.1%`**（58/58 全超时）；共同 58 题盲评两两胜负：**`Base` 48 胜 · `v3_e2` 5 胜 · 双败 5**。
   - **🔥 仅看“双方均可渲染的 17 题”正面盲评（最关键的质检发现）**：
     - 即使只比画出来的 17 题，**`Base` 仍以 `12 胜 5 负 (70.6%)` 领先**，可渲染均分 **`Base 73.18` vs `v3_e2 67.06`**（`Δ = -10.54`, `95% CI: [-24.92, +2.62]`），五维全部略低于 `Base`。
     - **原因极其清晰——“惊艳上限极高，但几乎不看图修 Bug 导致高比例硬伤翻车”**：
       - `v3_e2` 有 **`7/17 (41.2%)` 拿到高分 `pass`**，而且其中多题工艺惊艳（`v2-hilbert-edit = 100`、`v2-ferris-edit = 96` 完胜 Base 72、`v2-cantor-build = 92`、`v2-restitution-repair = 84` 完胜 Base 48、`v2-domino-compare = 72` 完胜 Base 36），证明 SFT 确实把“高审美工业级 3D 编码上限”学进去了。
       - 但与此同时 `v3_e2` 有 **`6/17 (35.3%)` 惨烈 `fail`**（是 Base `3/17 = 17.6%` 的两倍）：例如曲柄轮绕错轴侧翻穿模（`crankslider-build 36`）、整个 3D 天平漏建且表盘压扁（`egyptian-edit 28`）、右 HUD 遮死 4–16 号旗（`thuemorse-repair 32`）、HUD 打印原始转义符 `\2588` 且文字裁成 `RLIEST`（`looksay-repair 32`）。因为 `v3_e2` 陷入“首轮写 32K–67K 思考 + 一次性写巨型文件”的单轮惯性，均看图仅 **`1.1 次/题`**（Base `4.3 次/题`），画完就撞超时，**完全没机会看一眼截图就把显眼硬伤修掉**。
3. **🎯 对 Round 3 的 100% 实证背书**：数据无可辩驳地证明了 [Round 3 总计划](../../docs/plans/2026-11-25-round3-big-picture-alignment-plan.md) 的方向——**单轮占比从 `65.8%` 压到 `10%`，重仓纯 Three.js 多轮视觉闭环（清洗 `3DCodeFactory` 纯 Three.js + 放权自采动画/修复/健康合计 75–80%），保留简短原生 `<think>` + `1 epoch`**，既保住 `92–100` 分的高工艺上限，又把“看图→发现 HUD 遮挡/穿模/节奏问题→快速修好并干净收尾”的多轮能力训扎实。

---

## 二、完整 `Eval v3` 四轨成绩总表（自盲评，宽松 65K）

> 评审来源声明：Layer 1 为离线 Chromium 实跑纯 WebGL 帧差（118/118 完整）；Layer 2 因 `.env.deepseek` 额度耗尽采用 **Antigravity 双盲自评**（71 单品匿名乱序由 4 个并行独立子代理打分 + 17 对 50/50 翻转由主代理独立盲评，全部落盘后再揭盲，确定性防膨胀护栏与 `scripts/eval_3d_v3.py` 100% 同源）。

| 轨道 / 指标（`evals/devtest-v2`） | `Base 27B`（全量 n=60） | `Base 27B`（共同 n=58） | `v3_e2`（全量=共同 n=58） | 双方均可渲染子集（n=17：`Base` vs `v3_e2`） |
|---|---:|---:|---:|---:|
| **Track 1 · 交付 HTML / `Eval v3` 可渲染** | 56/60 · **54/60 (90.0%)** | **53/58 (91.4%)** | 22/58 · **17/58 (29.3%)** | 17/17 vs 17/17 |
| — 单文件内联通过 / 同目录补救 | 53 / +1 | 52 / +1 | 16 / +1 | 17/0 vs 16/+1 |
| — 真实纯 3D 运动 / HUD 假动拦截 | 53/60 (88.3%) · 0 | 52/58 (89.7%) · 0 | 17/58 (29.3%) · 0 | 17 vs 17（0 假动） |
| **Track 2 · 全量平均产品分 (0–100)** | **64.60** | **65.31** | **19.66** | **73.18 vs 67.06** |
| — 可渲染子集均分 / 中位数 (0–100) | 71.78 / 76.0 | 71.47 / 76.0 | 67.06 / 72.0 | **73.18 (76.0) vs 67.06 (72.0)** |
| — **视觉通过 `Visual Pass` (≥70 & pass)** | **20/60 (33.3%)** | **19/58 (32.8%)** | **7/58 (12.1%)** | **8/17 (47.1%) vs 7/17 (41.2%)** |
| — Verdict 分布 (`pass / minor / fail / unrend`) | `20 / 24 / 10 / 6` | `19 / 24 / 10 / 5` | `7 / 4 / 6 / 41` | `8/6/3` vs `7/4/6` |
| **Track 3 · 盲评两两胜负（共同 58 题）** | — | **🏆 Base 48 胜** | **v3_e2 5 胜**（双败 5） | **17 场正面盲评：Base 12 胜 (6 完胜) vs v3_e2 5 胜 (4 完胜)** |
| **Track 4 · 数值验收 (`numeric_ok`)** | **57/60 (95.0%)** | **55/58 (94.8%)** | 52/58 (89.7%) | 17/17 vs 16/17 |
| — 无超时正常收敛 (`process_converged`) | **30/60 (50.0%)** | **29/58 (50.0%)** | **0/58 (0.0%)** | 10/17 vs 0/17 |
| — 端到端技术全过 (`e2e_tech_ok`) | **29/60 (48.3%)** | **28/58 (48.3%)** | **0/58 (0.0%)** | 10/17 vs 0/17 |
| — **端到端干净全过 (`E2E Clean Pass`)** | **🏆 15/60 (25.0%)** | **14/58 (24.1%)** | **0/58 (0.0%)** | **7/17 (41.2%) vs 0/17 (0.0%)** |
| **Family Bootstrap `Δ(v3_e2 - base)` & 95% CI** | — | 18 families | `score = -47.33 [-59.44, -34.50]`<br>`visual_pass = -20.8pp [-34.7, -8.3]`<br>`e2e_clean = -23.6pp [-33.3, -13.9]` | 13 families:<br>`score = -10.54 [-24.92, +2.62]`<br>`visual_pass = -11.5pp [-42.3, +19.2]` |

### 五维均分对比（可渲染产物上，0–5 分制）

| 视觉维度 | `Base` 全 54 份可渲染 | `Base` 共同 17 份 | `v3_e2` 共同 17 份 | 共同 17 份差值 (`v3_e2 - Base`) |
|---|---:|---:|---:|---:|
| `concept_and_geometry`（3D 建模与几何） | 3.76 | 3.88 | 3.53 | -0.35 |
| `motion_and_dynamics`（3D 运动与物理） | 3.91 | 3.82 | 3.41 | **-0.41** |
| `visual_craft_and_composition`（审美与构图） | **3.00** | 3.12 | 2.88 | -0.24 |
| `task_and_math_fidelity`（任务与数学忠实度） | 3.94 | 4.06 | 3.65 | **-0.41** |
| `usability_and_interactivity`（UI/可读性/交互） | 3.33 | 3.41 | 3.29 | -0.12 |

### 按子题型拆解（全量：`Base n=60` / `v3_e2 n=58`）

| 子题型 | `Base` 可渲染 | `Base` Visual Pass | `Base` E2E Clean | `Base` 全量均分（可渲染均分） | `v3_e2` 可渲染 | `v3_e2` Visual Pass | `v3_e2` 全量均分（可渲染均分） |
|---|---:|---:|---:|---:|---:|---:|---:|
| `build` (18) | 15/18 | 6/18 | 5/18 | 64.9 (77.9) | 6/18 | 3/18 | 24.2 (72.7) |
| `compare` (12) | 11/12 | 3/12 | 2/12 | 60.3 (65.8) | **1/12** | 0/12 | 6.0 (72.0) |
| `repair` (18/17) | 16/18 | 6/18 | 4/18 | 63.6 (71.5) | 6/17 | 2/17 | 22.4 (63.3) |
| `edit` (12/11) | **12/12** | 5/12 | 4/12 | 70.0 (70.0) | 4/11 | 2/11 | 22.9 (63.0) |

---

## 三、17 场双方均可渲染正面盲评逐题明细

- **视觉速览对比图**：
  - `v3_e2` 最佳胜场（展示其高审美上限）：`top_v3_e2_wins.png`（本地附件未发布）
  - `Base` 最佳胜场（展示 `v3_e2` 缺乏看图迭代的典型硬伤）：`top_base_wins.png`（本地附件未发布）

| 对决 | 题目 | 题型 | `Base` 单品盲评分 | `v3_e2` 单品盲评分 | 盲评胜者 | 核心观察摘要 |
|---|---|---|---:|---:|---|---|
| `P01` | `v2-bresenham-repair` | repair | 88 (`pass`) | 88 (`pass`) | **`v3_e2` (小胜)** | 双优；`v3_e2` 8×4 网格更清爽完全无 HUD 遮挡 |
| `P02` | `v2-cantor-build` | build | 84 (`pass`) | **92 (`pass`)** | `base` (小胜) | 双优；`Base` 横向铺满更易读，`v3_e2` 质感极佳但略偏斜角 |
| `P03` | `v2-collatz-build` | build | 72 (`minor`) | **80 (`minor`)** | **`v3_e2` (完胜)** | `v3_e2` 照明对比度与推进节奏显著更佳（43 步 vs 13 步） |
| `P04` | `v2-crankslider-build` | build | 64 (`minor`) | **36 (`fail`)** | `base` (小胜) | `v3_e2` 曲柄轮绕错轴侧翻穿模 + 顶部标题乱码重叠 |
| `P05` | `v2-domino-build` | build | 88 (`pass`) | 88 (`pass`) | `base` (完胜) | 双优；`Base` 明亮木桌 + 实体 3D 表盘胜过 `v3_e2` 2D 侧边表盘 |
| `P06` | `v2-domino-compare` | compare | 36 (`fail`) | **72 (`minor`)** | **`v3_e2` (完胜)** | `v3_e2` 双 D4/D9 表盘清晰；`Base` 左上 HUD 遮死蓝色表盘 |
| `P07` | `v2-domino-edit` | edit | 44 (`fail`) | 28 (`fail`) | `base` (完胜) | `v3_e2` 机位偏斜把两排骨牌裁出画外且顶部表盘截断 |
| `P08` | `v2-domino-repair` | repair | 72 (`minor`) | 72 (`minor`) | `base` (小胜) | `v3_e2` 宣称全倒但末两块仍斜立；`Base` 10 块完整倒平 |
| `P09` | `v2-egyptian-edit` | edit | **80 (`pass`)** | **28 (`fail`)** | `base` (完胜) | `v3_e2` 漏建核心 3D 天平且双表盘严重压扁裁切 |
| `P10` | `v2-ferris-edit` | edit | 72 (`minor`) | **96 (`pass`)** | **`v3_e2` (完胜)** | `v3_e2` 双 3D 摩天轮构图极佳无遮挡；`Base` 3D 视口被压扁且标签重叠 |
| `P11` | `v2-fibonacci-build` | build | 68 (`minor`) | 56 (`fail`) | `base` (小胜) | `Base` 8s 内拼完 F(15)；`v3_e2` 仅演到 6/15 且方块穿插叠压 |
| `P12` | `v2-geartrain-repair` | repair | **84 (`pass`)** | 72 (`minor`) | `base` (完胜) | `v3_e2` 右上角半透明面板直接遮挡大半个 36 齿大齿轮 |
| `P13` | `v2-hilbert-edit` | edit | **96 (`pass`)** | **100 (`pass`)** | `base` (小胜) | 巅峰对决；`Base` 蓝/橙动态生长双线区分度极高，`v3_e2` 工艺满分 |
| `P14` | `v2-looksay-repair` | repair | 76 (`minor`) | **32 (`fail`)** | `base` (完胜) | `v3_e2` 出现 `\2588` 乱码与 `RLIEST` 裁切且 3D 几近静止 |
| `P15` | `v2-restitution-build` | build | 84 (`pass`) | 84 (`pass`) | `base` (小胜) | `Base` 完整 4 跳到 `0.200`；`v3_e2` 仅跳 3 次停在 `0.356` |
| `P16` | `v2-restitution-repair` | repair | 48 (`fail`) | **84 (`pass`)** | **`v3_e2` (完胜)** | `v3_e2` 工业桁架塔+双标尺极为精致；`Base` 简陋且计时卡 `0.000s` |
| `P17` | `v2-thuemorse-repair` | repair | **88 (`pass`)** | **32 (`fail`)** | `base` (完胜) | `v3_e2` 右侧巨型 HUD 遮死 4–16 号旗且几乎无翻转动画 |

> 补充说明：后续若 `.env.deepseek` 充值恢复，仍可随时零 GPU 重跑 `scripts/eval_3d_v3.py`（自动复用全部 `eval-v3/evidence/` Layer 1 缓存）作为外部模型交叉校验。

---

## 四、资源状态与沙盒临时服务记录

1. **16×H800 集群（`gpu34` + `gpu38`）**：已 100% 清理释放并核验归零（`gpu-cleanup.json`（本地附件未发布）：`phase: "released"`，`0 MiB / 0 进程 / 0 容器`）。
2. **本机临时沙盒演示服务（已完成领导测试并彻底清理）**：
   - 节点/卡：`ucloud-wlcb-gpu-016`（`<internal-ip>`）A100-80GB GPU 1、2（TP2），容器 `qwen38-round2-v3-e2-sandbox` 已于 `2026-11-26 20:14` 停删归零（GPU 1/2 均为 `8–10 MiB / 0 进程`，端口 `18158` 已释放），服务日志归档至 `final-20261126.log`（本地附件未发布）
   - 期间同步沉淀了两项全项目长期收益：统一模板 `chat_template.qwen38-compat.jinja`（本地附件未发布）（对齐 Aodi `servingfix`）与 [STANDARD-PARAMS.md](../../docs/STANDARD-PARAMS.md) 禁用 `--enforce-eager`（实测稳态提速 `12.6 → 48.2 tok/s`，约 3.8×）
