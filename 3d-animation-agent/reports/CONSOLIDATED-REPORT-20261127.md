# 3D 项目阶段实验与策略整合总报告（2026-11-23 ～ 2026-11-27）

> 公开整理版 · 2026-11-28。保留成文时点的记录；计划、文献结果和本地实测请分别理解。环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> 整理日期：2026-11-27  
> 适用范围：汇总 `reports/` 中近期（11/24–27）分散在 20+ 个子目录的评测闭环、消融实证、CoT 投影、小红书 `3DCodeFactory` 对齐及 CAD/2D 摸底核心结论；保留所有原始目录路径不变，便于逐项回溯。  
> 关联总入口：`decisions.md`（本地附件未发布） · [报告索引 `README.md`](README.md) · `index.html`（本地附件未发布）


> [!NOTE]
> **口径演进提示（2026-11-28）**：本汇总写于 2026-11-27 凌晨（仍记录当时 `Blender 0%` 与 Round 2 阶段结论）。现行全链路训练战略已正式收敛为 **Revision 3 / Option 2**（纳入 Blender + Three.js 完整 `384K Static YaRN 1.5×` 不切分硬训 + `256K` 统一沙盒，详见 [CLEANROOM-4MODEL-VERDICT](../../research/xhs-384k-to-200k-data-adaptation-20261127/CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md) 与 [OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN](../../research/xhs-384k-to-200k-data-adaptation-20261127/OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md)）。下文实测数据保留原件供回溯。

---

## 一、一页总览：当前路线与核心结论

1. **模型与三轨边界（已拍板）**
   - 学生底座固定为 **dense `Qwen3.8-27B`**（BF16），35B-A3B MoE 方向暂停。
   - 业务范围严格收敛为三轨：**3D 场景与动画**、**CAD 与 3D 打印（CadQuery）**、**2D 网页动画（Canvas 2D + SVG）**，各轨分报 `Accepted@1`。
   - **3D 展示/场景类全面对齐小红书 `3DCodeFactory` 运行栈**（`Three.js r180 + local http.server + OrbitControls + Playwright 多视角自检 + 0–3 交互控件`）；**Blender (`bpy`) 保持 `0%`**；原有 `esbuild` 离线单文件 + `window.renderAt(t)` 保留为物理/机械连续动画子能力。
2. **为什么必须走「高难长程视觉闭环 SFT」，而不是灌海量单轮代码**
   - **外部硬证据**（[oneshot-vs-longhorizon-3dcodefactory-20261126/REPORT.md](oneshot-vs-longhorizon-3dcodefactory-20261126/REPORT.md)）：`Qwen3.8-27B` 喂入 203 万条单轮 `3DCodeVerse` 三榜均分仅 `+0.12`（Three.js 反降 `-0.63`）；喂入 5,045 条长程多轮视觉闭环轨迹暴涨 **`+8.12`**（反超 `Qwen3.8-Max`）；同 5,045 题去掉多轮过程直接丢掉 **`11.75` 分**。
   - **本团队实证闭环**（[round2-v3-relaxed-eval-20261126/REPORT.md](round2-v3-relaxed-eval-20261126/REPORT.md) + [round2-v3-full-eval-20261126/REPORT.md](round2-v3-full-eval-20261126/REPORT.md)）：Round 2 `v3_e2` 单轮无截断 **Aodi 30 刷出 `26/30 (86.7%)` 历史最高分**，但因训练池单轮占比达 `65.8%`，导致在 65K 宽松多轮 `devtest-v2` 上陷入“首轮写巨长单文件、均看图仅 `1.1` 次/题”的单轮惯性，可渲染率仅 `29.3%`（vs Base `91.4%`）、全部 58 题超时；同时局部渲染出的 17 题中有 7 题拿到 `72–100` 高分，证实工艺上限已学进权重，缺的是高占比的多轮看图迭代习惯。
3. **近期三大工程与数据进展**
   - **评测体系升级（Eval v3）**：彻底解耦打包/超时与作品画面质量，完成 `devtest-v2`（60 题）与 `holdout-v1`（48 题）全量重评与 65K 宽松新标准收口；当前正在运行 XHS 运行栈 `core20` 评测（`xhs-threejs-eval-core20-20261126/`）。
   - **CoT 学生原生投影**：ReAct 13/13 触发轮 `think_nll` 降 **`-38.6%`**、极度 off-policy 尾巴（`>5`）降 **`-62.0%`**。
   - **CAD / 2D 种子与摸底**：`2d-seed-v1`（12 题）与 `print-seed-v1`（12 题）双双 `12/12 good + 12/12 bad` 冻结验收；CadQuery Phase 0 双臂摸底锁定 27B 真实短板（报错 3×、建图耗时 8×–14×、3D 轴向错位看图未检出）。

---

## 二、3D 动画评测闭环（Round 1 → Round 2 → 9B 消融）

### 2.1 单轮无截断基准：官方 Aodi 30（`xhigh`）

| 模型与版本 | 总通过（`runnable`） | 基础几何 | 多部件 | 空间场景 | 262K 死循环 | 原始报告 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 旧 Aodi `step-900` | 21 / 30 (70.0%) | 5/10 | 7/10 | 9/10 | — | [oneshot30-xhigh](oneshot30-checkpoint10946-20261124-002-xhigh/REPORT.md) |
| 原生 `Base 27B` | 22 / 30 (73.3%) | 7/10 | 8/10 | 7/10 | — | [oneshot30-xhigh](oneshot30-checkpoint10946-20261124-002-xhigh/REPORT.md) |
| Round 1 `ckpt-10946` | 24 / 30 (80.0%) | 6/10 | 8/10 | 10/10 | 3 题 | [oneshot30-xhigh](oneshot30-checkpoint10946-20261124-002-xhigh/REPORT.md) |
| Round 2 `v3_e3 (ckpt-525)` | 24 / 30 (80.0%) | 7/10 | 7/10 | 10/10 | **0 题** | [round2-v3-full-eval](round2-v3-full-eval-20261126/REPORT.md) |
| **Round 2 `v3_e2 (ckpt-350)`** | **26 / 30 (86.7%)** | **7/10** | **9/10** | **10/10** | **0 题** | [round2-v3-full-eval](round2-v3-full-eval-20261126/REPORT.md) |

### 2.2 多轮 Agent 基准：`evals/devtest-v2`（60 题）跨版本对比

| 评测协议与模型 | 可渲染率 | 全量视觉均分 | 可渲染均分 | 视觉通过 (`Visual Pass`) | 端到端干净通过 (`E2E Clean`) | 超时率 | 原始报告 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 旧 8K · `Base 27B`（Eval v3 重评） | 46/60 (76.7%) | 53.07 | 69.22 | 18/60 (30.0%) | 8/60 (13.3%) | 41/60 | [eval-v3-devtest-v2](eval-v3-devtest-v2-20261125-001/REPORT.md) |
| 旧 8K · `Round 1 ckpt-10946`（Eval v3） | 39/60 (65.0%) | 42.93 | 66.05 | 11/60 (18.3%) | 4/60 (6.7%) | 36/60 | [eval-v3-devtest-v2](eval-v3-devtest-v2-20261125-001/REPORT.md) |
| 旧 8K · `Round 2 v3_e2`（8192 截断雪崩） | 28/60 HTML | — | — | `1/60 tech_pass` | — | 52/60 | [round2-v3-full-eval](round2-v3-full-eval-20261126/REPORT.md) |
| **新 65K/262K · `Base 27B`（全量 n=60）** | **54/60 (90.0%)** | **64.60** | **71.78** | **20/60 (33.3%)** | **15/60 (25.0%)** | 30/60 (50%) | [round2-v3-relaxed-eval](round2-v3-relaxed-eval-20261126/REPORT.md) |
| **新 65K/262K · `Round 2 v3_e2`（n=58）** | 17/58 (29.3%) | 19.66 | 67.06 | 7/58 (12.1%) | 0/58 (0.0%) | 58/58 (100%) | [round2-v3-relaxed-eval](round2-v3-relaxed-eval-20261126/REPORT.md) |

- **`Base 27B` 自身五维短板画像（65K 宽松，54 份可渲染）**：`task_and_math_fidelity = 3.94`、`motion_and_dynamics = 3.91`、`concept_and_geometry = 3.76` 已在线；核心短板在 **`visual_craft_and_composition = 3.00`**、**`usability_and_interactivity = 3.33`**（大量 HUD/取景/节奏问题）以及 **50% 超时率**。
- **`holdout-v1` test 48 历史重评**（`eval-v3-holdout-v1-test48-20261125-001`（本地附件未发布））：解耦同目录 `./bundle.js` 补救 42 份历史动画后，真实视觉通过为 `Base 13/48 (27.1%)` vs `Round 1 11/48 (22.9%)`，双方均出图 22 对正面盲评 `Student 14 : 8 Base`。

### 2.3 `Qwen3.5-9B` 零单轮对照消融（`runs-strat30`, n=30）

| Arm | 交付 HTML | 单文件内联 (`≥200KB`) | WebGL 有绘制 | 浏览器验收通过 (`check_ok`) | 超时 | 来源目录 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `base_9b`（原生 9B） | 30/30 | 0/30 (0.0%) | 0/30 (0.0%) | 0/30 (0.0%) | 0/30 | `exp-9b-devtest-v2-20261126`（本地附件未发布） |
| **`ctrl_9b`（0% 单轮，纯 ReAct + SWE）** | 27/30 | **20/30 (66.7%)** | **7/30 (23.3%)** | **5/30 (16.7%)** | 7/30 | `exp-9b-devtest-v2-20261126`（本地附件未发布） |
| `mix_9b`（混入未过滤 XHS 异栈数据） | 23/30 | 7/30 (23.3%) | 1/30 (3.3%) | 0/30 (0.0%) | 11/30 | `exp-9b-devtest-v2-20261126`（本地附件未发布） |

- 可视化总汇报（含 9B 消融 + Rubric 成品演示）：`index.html`（本地附件未发布）。

---

## 三、数据工厂、CoT 投影与小红书 `3DCodeFactory` 对齐

| 专题 | 核心实测数据与结论 | 入口 |
| --- | --- | --- |
| **Round 2 冻结数据集 `round2-sft-27b-v3`** | 共 `4,278` 条 / `4,324` 图 / `95.16M` 输入 tok / `73.75M` 监督 `U`（`v2-full`）及 `324` 条联合验证集；全量成品与 `4,536` 张图片已冻结在共享盘 `${SHARED_DATA}/3d-animation-reports/round2-sft-27b-v3/`。 | [FREEZE-REPORT.md](round2-phase2-curation-20261125/FREEZE-REPORT.md) · `frozen-manifest.json`（本地附件未发布） |
| **27B 学生原生 CoT 投影（`arXiv:2610.02140`）** | 发现旧版 CoT 压缩脚本将 DeepSeek 方案书硬塞 `<think>` 导致 off-policy 飙升 2.4×；改用 27B 原生 `<think>` 投影（工具调用与回复逐字节不变）后，ReAct 13/13 触发轮 `think_nll` **`1.4488 → 0.8901 (-38.6%)`**、`>5` 尾巴 **`6.90% → 2.62% (-62.0%)`**、长度再降 `16.2%`。 | [student-cot-projection-exp/REPORT.md](student-cot-projection-exp-20261125-001/REPORT.md) |
| **XHS `3DCodeFactory` 策略与长度审计** | 231/401 完整分片含 `6,001` 条非子会话 Three.js 段（`1,217` 独立任务）；原生合规自然 EOS 全集 **`1,209` 段**，真实含图总长度 P50=`287K` / P90=`383K`，**`≤384K` 覆盖 `1,138 / 1,209 (94.1%)`**；严禁半路无 EOS 硬切，且入 `ms-swift` 前需剥离中途 `<total_tokens>` `system` 并反转 `loss_mask` 极性。 | [oneshot-vs-longhorizon](oneshot-vs-longhorizon-3dcodefactory-20261126/REPORT.md) · [xhs-threejs-segment-audit](xhs-threejs-segment-audit-20261126/REPORT.md) |
| **放权采集 Pilot & Best-of-2 Rubric 烟测** | 放权试点（`n=4`）Visual Pass `50% vs 25%`、正面盲评 `2:1`；DeepSeek `Best-of-2 + Rubric` 烟测成功产出**黄铜锚式擒纵机构**（81 轮、17 分钟、27 次看图、17 次修改）与**苔溪古桥**（121 轮、31 分钟），验证了“全景→局部裁剪→自评→定点修”闭环。 | `pilot-gen-unhandcuffed-20261126-001`（本地附件未发布） · `smoke-threejs-rubric-20261126`（本地附件未发布） |
| **XHS 运行栈实跑评测（进行中）** | `xhs-threejs-val-v1 / core20` 沙盒长程评测正在运行（`base` 与 `ckpt10` 对照），完成后更新最终成绩表。 | [xhs-threejs-eval-core20-20261126](xhs-threejs-eval-core20-20261126/REPORT.md) |

---

## 四、三轨扩展：CAD（3D 打印）与 2D 动画基建及摸底

1. **双轨冻结种子评测集**（[round2-line-c-seeds-20261124-001/REPORT.md](round2-line-c-seeds-20261124-001/REPORT.md)，状态 `seed_only` / `Accepted@1 = N/A`）：
   - `evals/2d-seed-v1`（12 题 / 4 族，Canvas 2D）：`12/12 good` 通过、`12/12 bad` 精准击杀、3 次冷启动 Chromium 像素 SHA-256 100% 复现。
   - `evals/print-seed-v1`（12 题 / 6 族，CadQuery 2.6.1，`OpenSCAD = N/A`）：`12/12 good`（STL 水密 + strict 3MF + GLB 三格式回读全过）、`12/12 bad` 精准击杀。
2. **CadQuery Phase 0 双臂摸底**（[cad-print-seed-baseline-20261125-001/REPORT.md](cad-print-seed-baseline-20261125-001/REPORT.md)）：
   - 表面总通过率打平（DeepSeek `9/12` vs 27B Base `9/12`），但复杂题暴露三大实质差距：
     - **工具报错 3×**：`7 次` vs `21 次`（27B 集中卡在 CadQuery/OCCT API 误用）；
     - **从零构建耗时 8×–14×**：DeepSeek `56–110s` vs 27B `693–882s`（贴近 900s 超时线）；
     - **3D 空间轴向错位看图未查出**：`print-clip-cable-repair` 把水平卡鞍画成竖直烟囱（DeepSeek 外形误差 `0.0001 mm`）、`print-enclosure-box-build` 盖板内唇反向挖槽；四视图自检覆盖 `12/12 vs 10/12`。
   - DeepSeek 9 条通过轨迹已 100% 通过 CPU 版 `ms-swift 4.5.2` 全量模板与逐 token 审计（长度仅 `8.6K–27.7K` tok）；Phase 1 放量前需封口 4 项 P0（宿主机路径零泄漏、题面 Z=0 与叶子名零歧义、四视图 `flatShading + Z_range`、BenchCAD 20–30 题 OOD 二次标定）。

---

## 五、对外汇报与关键工程底座

- **2026-11-27 交互式周汇报**（面向评审，已剥离内部失败明细，全部 3D/CAD 产物可实时交互）：`index.html`（本地附件未发布）（公网 ``[internal-preview-url]``，内网 `:[internal-port]`）。
- **27B 双机训练速度与吞吐基准**：`bench-27b-speed-20261124`（本地附件未发布） + Round 2 `M2+` 16×H800 `5,118 tok/s` / 0 OOM 525 步完训记录（见 `round2-v3-full-eval-20261126/REPORT.md` §2）。
- **统一推理模板与抓包溯源**：`chat_template.compat.jinja`（本地附件未发布）（被 `docs/STANDARD-PARAMS.md` 直接引用）、[harness-data-provenance-20261124-001/REPORT.md](harness-data-provenance-20261124-001/REPORT.md)。
