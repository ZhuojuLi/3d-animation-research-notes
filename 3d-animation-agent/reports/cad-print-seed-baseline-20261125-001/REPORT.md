# CadQuery 参数化 / 3D 打印建模轨 Phase 0 摸底报告（`evals/print-seed-v1`）

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

> 报告日期：2026-11-25  
> 运行目录：`${WORKSPACE}/3d-animation-agent/reports/cad-print-seed-baseline-20261125-001/`  
> 状态标签：**`maturity: "seed_only"` · `accepted_at_1: "N/A"` · `cad_engine: "CadQuery"` · `openscad: "N/A"`**  
> 范围边界声明：本报告仅覆盖 **CadQuery 数字几何构建、STL/3MF/GLB 三格式独立回读、拓扑水密/2-流形/连通体/探针/参数回归检验及 4 视角 WebGL 渲染复核**；**不构成切片通过、物理打印成功、材料强度或实体装配公差证明**。冻结题集 `evals/print-seed-v1/` 保持零改动（`scripts/build_print_seed_v1.py --check` 验证通过）。

---

## 一、执行摘要与核心判断（Go / No-Go）

| 维度 | DeepSeek `1017` (`effort=high`, 教师) | `Qwen3.8-27B-BF16` (`effort=medium`, 原版学生) | 诊断差异 |
| --- | --- | --- | --- |
| **总通过率（12 题）** | **9 / 12 (75.0%)** | **9 / 12 (75.0%)** | 表面通过率打平，但过程质量与复杂题稳定性差距极大 |
| `healthy`（健康对照） | **3 / 3**（`3/3` 字节零改动） | **3 / 3**（`3/3` 字节零改动） | 原版 27B 仅 4 轮/67–70s 即验通停手，零破坏 |
| `parametric_edit`（参数编辑） | **3 / 3**（7–14 轮，29–72s） | **3 / 3**（5–6 轮，63–95s） | 原版 27B 在单步/轻量参数编辑上已非常稳健 |
| `build`（从零构建） | **2 / 3**（7–16 轮，56–110s） | **2 / 3**（8–25 轮，693–882s） | **27B 从零构建耗时暴涨 8×–14×，轮数逼近 24 轮上限** |
| `defect_repair`（缺陷修复） | **1 / 3**（7–13 轮，35–96s） | **1 / 3**（5–19 轮，217–407s） | 1 例双方同栽题面命名歧义；1 例暴露 27B 3D 轴向空间错位 |
| **总轮数 / 均轮数** | 111 轮（9.25 轮/题） | 113 轮（9.42 轮/题） | 表面均值相近，但 27B 方差极大（简单题 4–6 轮，难 build 题 22–25 轮） |
| **总工具报错（`is_error=true`）** | **7 次** | **21 次（3.0×）** | 集中爆发在 27B 的 `build`（16 次）与重修复（5 次）：CadQuery API 误用 + OCCT 异常 |
| **看 4 视图自检覆盖** | **12 / 12 (100%)** | **10 / 12 (83.3%)** | 27B 有 2 题因试错耗尽 `--max-turns` 未能执行 `Read views_grid.png` |
| **超时（900s）** | **0 / 12** | **0 / 12**（但 `bracket-l-build` 882s 贴近超时线） | 需保持 `--max-turns` 守门 |
| **`repos-logging-proxy` 全量归档** | **12 / 12 (`archived_all_observed=true`)** | **12 / 12 (`archived_all_observed=true`)** | 统一抓包链路零丢包 |

### 关键结论（反盲目扩产、实事求是）

1. **基建与训练链路全面跑通**：新增离线 4 视角 GLB 渲染器（render_glb_multiview.mjs（本地附件未发布））、中立零作弊几何检验器（cad_inspect.py（本地附件未发布））和隔离运行器（run_cad_cases.py（本地附件未发布））已全量通过 3 项单元测试及 24 次端到端实跑；DeepSeek 9 条通过轨迹 100% 经 `logging_proxy_to_swift.py` + CPU 版 `ms-swift 4.5.2` 全量模板与逐 token 审计通过（序列长度仅 **8.6K–27.7K tokens**，0 条超 65K）。
2. **`print-seed-v1` 对 27B Base 已接近饱和，不能直接作为大规模 CadQuery SFT 的开训依据**：
   - 原版 `Qwen3.8-27B-BF16` 在 6–15 面基础单/双件题上（尤其 `healthy` 3/3 和 `parametric_edit` 3/3）已经能做到 9/12（75%），**说明 Phase 1 绝不需要去灌基础草图+拉伸的简单样本**。
   - 27B 的**真实短板非常集中且清晰**：
     1. **CadQuery API 与 OCCT 实体操作不熟（21 次报错，3.0× 教师）**：反复误用 `python3`（无 cadquery）、`len(Workplane)`、`polarArray`、`Location` 拼接循环与 `cad_build_error`，导致 `build` 题耗时飙升到 12–15 分钟、耗光轮数来不及看图。
     2. **3D 坐标平面与结构空间错位（最硬的几何短板）**：在 `print-clip-cable-repair` 里把本应在 **XZ 平面** 的水平卡鞍画成了 **XY 平面** 的竖直烟囱（`Z=20.0`），且**看了 4 视图渲染图仍未识别出轴向画反**；在 `print-enclosure-box-build` 里把本应向下凸伸进底盒的盖板内唇反向挖成了盖板凹槽（体积掉到 38.5K vs `[43K, 48.5K]`）。
3. **Go / No-Go 建议（Conditional Go — 先升题尺，再小规模精造）**：
   - **No-Go 直接大批量蒸馏基础题**：避免在 27B 已经会做的基础题上浪费算力、甚至挤压 Round 2 Three.js 主航道。
   - **Go 立即推进两件高杠杆前置动作**：
     1. 先修复 Phase 0 暴露的 **3 项工具与出题规范缺陷**（见第四节：宿主路径零泄漏、`flatShading + Z_range` 渲染升级、题面显式写死 `Z=0` 底面基准 + 叶子部件名 + 全部决定体积的副尺寸）。
     2. 用 **BenchCAD 20–30 题轻量 OOD 子集（15–35 B-rep 面，严格不入训）+ 升级版 `print-eval-v2`（多部件/倒角/圆角/抽壳/轴向空间约束）** 对 27B Base 做二次标定（按多卡并发规范并起 2–3 张空卡 10 分钟内跑完），精准锁定 27B 真正掉分的能力区间后再启动 300–500 条高纯度 Phase 1 CadQuery ReAct 造数。

---

## 二、12 题逐项配对明细与失败根因剖析

数据来源：deepseek/summary-trial-1.json（本地附件未发布） · qwen/summary-trial-1.json（本地附件未发布） · paired-analysis.json（本地附件未发布）

| 题号 (`case_id`) | 类型 | DeepSeek `1017` (高思考) | `Qwen3.8-27B` Base (中思考) | 关键对比 / 失败根因 |
| --- | --- | --- | --- | --- |
| `print-bracket-l-build` | `build` | ✅ PASS（7t, 55.7s, 0 err, img=1） | ✅ PASS（25t, 882.2s, **11 err**, **img=0**） | 27B 狂踩 11 次 CadQuery/Python 报错，踩满 `max_turns=24` 才惊险修通、没来得及看图 |
| `print-enclosure-box-build` | `build` | ✅ PASS（12t, 97.3s, 0 err, img=1） | ❌ FAIL（8t, 794.6s, 1 err, img=1） | **27B 真实结构误解**：将下伸内唇反向挖成盖底凹槽（`volume=38512` < `43000`）；中途曾触 `stl_not_watertight` 后靠工具修回水密 |
| `print-gear-spur-build` | `build` | ❌ FAIL（16t, 110.1s, 2 err, img=1） | ✅ PASS（22t, 692.6s, **4 err**, img=1） | **题面 Z 基准未声明**：DeepSeek 写出真渐开线齿轮但居中在 `Z∈[-4,+4]` 导致 `solid_probe` 落顶面边界失败；27B 写梯形齿保 `Z∈[0,8]` 通过但报 4 次 Workplane API 错 |
| `print-bracket-gusset-repair` | `defect_repair` | ✅ PASS（7t, 34.5s, 0 err, img=1） | ✅ PASS（6t, 217.0s, 0 err, img=1） | 双方均一次修通开口非水密壳（`cq.Shell` → 闭合实体） |
| `print-clip-cable-repair` | `defect_repair` | ❌ FAIL（13t, 95.7s, 2 err, img=1） | ❌ FAIL（5t, 381.5s, 0 err, img=1） | **DeepSeek**：轴向长度题面未指定，自设 `clip_len=12`（真值=18）致 `volume=3883` 偏低（外形误差仅 `0.0001mm`）；<br>**27B（硬伤）**：把 XZ 水平卡鞍画成 **XY 竖直圆管**（`Z=20.0` vs `19.2915`），看 4 视图也没察觉 |
| `print-heatsink-mount-repair` | `defect_repair` | ❌ FAIL（7t, 42.2s, 0 err, img=1） | ❌ FAIL（19t, 407.5s, **5 err**, **img=0**） | **双方同栽 `part_name_mismatch`**：均将叶子件命名为 `pin_fin_spreader` 而非 `pin_heatsink`（题面写 `"spreader script ('pin_heatsink')"` 歧义，27B 把 `pin_heatsink` 放到了根 Assembly 名）；且 27B 额外报 5 次 `cad_build_error`/Edit 错 |
| `print-enclosure-vent-edit` | `parametric_edit` | ✅ PASS（14t, 71.6s, 2 err, img=1） | ✅ PASS（6t, 94.8s, 0 err, img=1） | 双方均完美通过参数化修改与回归探针 |
| `print-gear-hub-edit` | `parametric_edit` | ✅ PASS（7t, 28.7s, 0 err, img=1） | ✅ PASS（5t, 62.8s, 0 err, img=1） | 双方均高效通过 |
| `print-rail-dovetail-edit` | `parametric_edit` | ✅ PASS（9t, 43.0s, 0 err, img=2） | ✅ PASS（5t, 69.4s, 0 err, img=1） | 双方均准确完成两件式燕尾导轨+滑块编辑 |
| `print-clip-latch-healthy` | `healthy` | ✅ PASS（6t, 23.6s, 零改动, img=1） | ✅ PASS（4t, 67.2s, 零改动, img=1） | 100% 遵守健康对照零改动停手纪律 |
| `print-heatsink-fin-healthy` | `healthy` | ✅ PASS（8t, 28.5s, 1 err, 零改动, img=1） | ✅ PASS（4t, 69.6s, 零改动, img=1） | 100% 遵守零改动停手纪律 |
| `print-rail-stop-healthy` | `healthy` | ✅ PASS（5t, 19.0s, 零改动, img=1） | ✅ PASS（4t, 68.0s, 零改动, img=1） | 100% 遵守零改动停手纪律 |

---

## 三、端到端 Swift 4.5.2 训练兼容性验证与多视角渲染视觉复核

### 1. DeepSeek 9 条通过轨迹 CPU-only `ms-swift 4.5.2` 全链路验证
通过统一脚本 `logging_proxy_to_swift.py` → `convert_and_validate_swift_ready.py`（pinned 镜像 `${CONTAINER_IMAGE}`，`--network=none`，`CUDA_VISIBLE_DEVICES=""`）实测：
- **导出结果**（export-summary.json（本地附件未发布））：**9/9 accepted，0 rejected**；100% 含真实 `system` prompt、100% 含 6 工具 schema、100% 剥离 `x-anthropic-billing-header`、共保留 10 张多模态 4 视图 PNG、52 轮思考、66 次工具调用。
- **Swift 模板与逐 token 审计**（validation-report.json（本地附件未发布） · token-decode-audit.json（本地附件未发布））：
  - `status: "batch_ready_loader_and_template_passed"`，`passed: true`（9/9 全量审计）
  - `misplaced_im_end_total: 0`，`assistant_turns_valid_structure: 63 / 63`，`all_tools_present_in_system: true`，`all_generation_boundaries_match: true`，`all_labels_and_loss_scales_aligned: true`
  - **序列长度极轻**：`min = 8,644`、`median = 18,163`、`max = 27,717`、**`above_65536 = 0`**、`max_nonempty_thinking_tokens = 8,419`；分段 token 分布：`0.0`（上下文）105,730、`0.5`（思考）37,805、`1.0`（正文）4,793、`2.0`（工具调用）9,180。

### 2. 4 视角渲染质量抽检（经 `127.0.0.1:18790` 视觉模型复核，未用内置看图工具）
抽检 DeepSeek 4 张成品渲染图（`print-bracket-l-build`、`print-enclosure-box-build`、`print-rail-dovetail-edit`、`print-gear-spur-build`）：
- 四视图（Isometric / Front / Top / Side）构图清晰、24° 边缘轮廓锐利，L 支架加强筋与通孔、双件外壳盒+盖、燕尾导轨+滑块、16 齿直齿轮+键槽均清晰可辨，无开口壳或浮空件。
- 同时揪出 **2 项可立刻优化的渲染细节**：
  1. 平面圆孔周围光滑着色产生“星芒条纹（starburst shading）”→ Phase 1 渲染器改为 `flatShading: true`（硬表面 CAD 标准着法）即可彻底消除；
  2. `render_glb_multiview.mjs` 自动将 `min.y` 贴齐地面线，掩盖了 `print-gear-spur-build` 处于 `Z∈[-4,+4]` 而非 `Z∈[0,8]` 的偏移 → 后续须在页眉同时打印真实 `Z=[zmin, zmax]` 坐标范围。

---

## 四、Phase 0 提前揪出的 4 项 Phase 1 放量前 P0 封口项

1. **宿主机路径零泄漏封口（高危，已在 Swift 审计中实测抓到）**：
   - 当前 9 条通过轨迹中有 5 条在 tool/assistant 中出现了 `${WORKSPACE}/3d-printing-agent` 或 `${USER_HOME}/local/node20/bin` 字符串，根因是 `tools/cad_inspect.py` 源码硬编码了宿主机路径且异常回溯打印了 `.venv` 绝对路径。
   - **修复方案**：Phase 1 前通过环境变量（如 `CAD_VENV_PYTHON`）或中立路径（`/opt/cad3d-venv/bin/python`）注入环境，从工作区 `tools/cad_inspect.py` 彻底删光 `/mnt/disk1`、`${USER_HOME}` 字符串，并在回溯输出中屏蔽宿主机路径前缀；同时在 `run_cad_cases.py` 末尾加自动零泄漏断言。
2. **题面契约零歧义封口（复现 Round 1 `__3D_STATE__` 教训）**：
   - Phase 1 全部自建/派生题面必须显式写清三件事：① **底面坐标基准**（统一 `bottom sits on Z=0, Z in [0, H]`）；② **精确叶子部件名**（`asm.add(..., name="<exact_part_name>")`，不与根 Assembly 名混淆）；③ **全部决定体积/几何探针的关键特征尺寸**（如卡鞍轴向长度、盖板内唇下伸方向与深度）。
3. **4 视图渲染器升级**：`render_glb_multiview.mjs` 开启硬表面 `flatShading: true`，并在图面标题栏打印 `bounds_xyz_mm`（含精确 `Z=[zmin, zmax]`）。
4. **先测 OOD 难度阶梯，再定 Phase 1 数据量**：利用已调研的 `BenchCAD`（CC-BY-4.0 / MIT，抽 20–30 题 ≤35 面作纯净 OOD 尺子，绝不入训）与 `ADSKAILab/Zero-To-CAD-100k`（Apache-2.0，按 15–35 B-rep 面筛选多样性种子）对齐真实 27B 能力圈。

---

## 五、GPU6 及时释放与环境留痕凭据

- **服务实例**：`qwen38-cad-base-gpu6`（镜像 `${CONTAINER_IMAGE}`，权重 `${MODEL_ROOT}/Qwen3.8-27B`，GPU6，端口 `18161`，`max_model_len=131072`，`max_images=8`，`effort=medium`）。
- **释放时间**：`2026-11-25 17:07:11 CST`（第 12 题完成后立即执行 `docker stop && docker rm`，未等待离线分析与写报告）。
- **释放核验**：
  - `docker ps -a --filter name=qwen38-cad-base-gpu6`：空（容器已彻底删除）
  - `nvidia-smi -i 6 --query-gpu=index,name,memory.used,memory.total,utilization.gpu --format=csv`：`6, NVIDIA A100-SXM4-80GB, 4 MiB, 81920 MiB, 0 %`
  - `nvidia-smi -i 6 --query-compute-apps=...`：0 条残留计算进程
- **冻结题集校验**：`python3 scripts/build_print_seed_v1.py --check` → `print-seed-v1 generated files and freeze.json hashes are up to date`。
