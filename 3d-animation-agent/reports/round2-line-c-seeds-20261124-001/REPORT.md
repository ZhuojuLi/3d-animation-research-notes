# Round 2 阶段 1 · 线 C（2D 动画与 3D 打印冻结种子评测集建设）验收报告

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

- **报告编号**：`round2-line-c-seeds-20261124-001`
- **日期**：2026-11-24
- **工作目录**：`${WORKSPACE}/3d-animation-agent`（只读参考 `${WORKSPACE}/3d-printing-agent`）
- **硬件与执行边界**：**全程零 GPU 使用**（仅本机 CPU、无头 Chromium + SwiftShader 软光栅、`3d-printing-agent/.venv` CadQuery 2.6.1 / trimesh 4.12.2 / lib3mf）。
- **隔离边界核查**：`evals/devtest-v2/`、`evals/first-sft-holdout-v1/`、`evals/visual-agent-v2/` 及线 A/B 目录**零修改**。

---

## 一、工程口径与成熟度声明

严格对齐 `ai-employees/shared/3d-animation-agent/decisions.md` 与 `research/3d-agent-student-centered-react-and-35b-20261124/visual-scope-readiness.md`：

1. **双轨种子集均标记 `maturity: "seed_only"`、`accepted_at_1: "N/A"`**：本轮仅完成确定性题集构建、正例/负例校准、渲染稳定性与几何回读验证，尚未在任何模型上运行配对基线；**严禁据此虚报 `Accepted@1` 或并入三轨等权总分**。
2. **3D 打印范围硬边界**：严格限定于 **CadQuery 参数化建模 + 数字几何与 STL/3MF/GLB 导出回读验收**；**`OpenSCAD = N/A`**；**不作切片（slicer）、实物打印（physical printing）、材料强度（material strength）或实物公差（physical fit tolerance）合格声明**。

---

## 二、核心验收数字总览

| 维度 | `evals/2d-seed-v1`（2D 动画） | `evals/print-seed-v1`（3D 打印） |
|---|---|---|
| 成熟度 / Accepted@1 | `seed_only` / `N/A` | `seed_only` / `N/A` |
| 引擎 / 技术栈 | Canvas 2D + Headless Chromium (CPU SwiftShader) | CadQuery 2.6.1（**OpenSCAD = `N/A`**） |
| 题目总数 | **12 题** | **12 题** |
| 主题 / 参数化族 | **4 族 × 3 题**（`physics_motion` / `fluid_particles` / `geometric_clock` / `parallax_lighting`） | **6 族 × 2 题**（`bracket` / `enclosure` / `gear` / `snap_clip` / `heatsink` / `rail`） |
| 任务类型分布 | `build: 3`, `repair: 3`, `local_edit: 3`, `healthy: 3` | `build: 3`, `parametric_edit: 3`, `defect_repair: 3`, `healthy: 3` |
| `good` 参考实现通过率 | **12 / 12 (100%)** | **12 / 12 (100%)** |
| `bad` 真实故障夹具击杀率 | **12 / 12 (100%)**（精确命中预注册 `required_bad_issue`） | **12 / 12 (100%)**（精确命中预注册 `required_bad_issue`） |
| 额外专项验证 | 上游 `visual-agent-v2/check_browser.mjs` 兼容 **12/12**；`local_edit` starter **3/3** 通过；3 代表样本 × 3 次冷启动 Chromium **9/9 逐字节 PNG sha256 一致** | 三格式回读 **12/12** 通过（STL 水密 12/12 + strict lib3mf 3MF 12/12 + GLB 12/12）；参数变动探针 **12/12** 精确响应；静态 AST 与无网隔离 **100%** 拦截非法样本 |
| `freeze.json` 冻结文件数 | **44 文件**（全量 sha256 通过 `--check`） | **43 文件**（全量 sha256 通过 `--check`） |

---

## 三、交付物 1：2D 动画冻结种子评测集（`evals/2d-seed-v1/`）

### 3.1 文件清单
- 生成与校验脚本：`scripts/build_2d_seed_v1.py`（支持全量构建验收、`--check`、`--validate-only`）
- 浏览器离线验收器：`evals/2d-seed-v1/check_2d_case.mjs`（对齐 `evals/visual-agent-v2/check_browser.mjs` 契约，并强化真实 `#scrub` 独立检出、`#play` 时间推进检出、`target_not_visible` 前景像素占比检出）
- 冻结目录：`evals/2d-seed-v1/{README.md, cases.json, validation.json, golden-stability.json, freeze.json, prompts/*.txt, fixtures/<case_id>/{good.html,bad.html[,starter.html]}}`

### 3.2 12 道题与 12 类独立故障覆盖明细

| # | Case ID | 主题族 | 任务类型 | Good 状态 | 前景像素比 | Bad 预注册故障 (`required_bad_issue`) | 实测 Bad 击杀 |
|---|---|---|---|---|---:|---|---|
| 1 | `2d-physics-pendulum-build` | `physics_motion` | `build` | PASS | 0.020950 | `static`（定格在 t=0） | KILLED (`stale_state`, `static`, `scrub_mismatch`) |
| 2 | `2d-physics-bounce-repair` | `physics_motion` | `repair` | PASS | 0.016189 | `redraw_ghosting`（不清屏残影） | KILLED (`loop_discontinuity`, `repeat_mismatch`, `scrub_mismatch`, `redraw_ghosting`) |
| 3 | `2d-physics-spring-edit` | `physics_motion` | `local_edit` | PASS (+starter PASS) | 0.048468 | `non_target_changed`（非目标锚点漂移） | KILLED (`non_target_changed`, `loop_discontinuity`) |
| 4 | `2d-fluid-ripples-build` | `fluid_particles` | `build` | PASS | 0.065186 | `loop_discontinuity`（t=2 循环接缝跳变） | KILLED (`loop_discontinuity`) |
| 5 | `2d-fluid-particles-repair` | `fluid_particles` | `repair` | PASS | 0.020236 | `repeat_mismatch`（含 `Math.random()` 抖动） | KILLED (`visual_state_mismatch`, `loop_discontinuity`, `repeat_mismatch`, `scrub_mismatch`, `redraw_ghosting`) |
| 6 | `2d-fluid-wavefield-healthy` | `fluid_particles` | `healthy` | PASS | 0.465843 | `pause_failed`（暂停按钮失效） | KILLED (`pause_failed`) |
| 7 | `2d-clock-gears-build` | `geometric_clock` | `build` | PASS | 0.106386 | `visual_state_mismatch`（画面与状态脱节） | KILLED (`visual_state_mismatch`) |
| 8 | `2d-clock-metronome-edit` | `geometric_clock` | `local_edit` | PASS (+starter PASS) | 0.122139 | `scrub_mismatch`（拖动条偏移失准） | KILLED (`scrub_mismatch`) |
| 9 | `2d-clock-chronograph-healthy` | `geometric_clock` | `healthy` | PASS | 0.229229 | `stale_state`（状态停滞于 t=0） | KILLED (`stale_state`, `visual_state_mismatch`, `scrub_mismatch`, `play_failed`) |
| 10 | `2d-parallax-lighthouse-repair` | `parallax_lighting` | `repair` | PASS | 0.311607 | `play_failed`（播放按钮不推进时钟） | KILLED (`play_failed`) |
| 11 | `2d-parallax-horizon-edit` | `parallax_lighting` | `local_edit` | PASS (+starter PASS) | 0.279864 | `offline_or_page_error`（外链 CDN 缺失） | KILLED (`offline_or_page_error`) |
| 12 | `2d-parallax-lanterns-healthy` | `parallax_lighting` | `healthy` | PASS | 0.298929 | `target_not_visible`（整屏遮挡致目标不可见） | KILLED (`target_not_visible`, `static`) |

### 3.3 3×3 确定性帧 sha256 逐字节一致校准（`golden-stability.json`）
在 3 个独立冷启动的无头 Chromium（SwiftShader CPU，800×500，DPR=1）会话中对 3 个代表 `good` 样本（`2d-physics-pendulum-build`、`2d-fluid-ripples-build`、`2d-parallax-lanterns-healthy`）采集 `t=0 / 0.5 / 1 / 2` 共 36 帧截图，**3/3 样本 × 3 次重复 × 4 关键帧 100% 逐字节 `sha256` 一致**（且 `t0 == t2` 闭环零误差）。

### 3.4 本轮发现并修复的真实工程细节
1. **Blink Canvas 2D 首次截屏软光栅切换漂移**：实测中发现 `2d-clock-metronome-edit` 在默认 `getContext('2d')` 下首次截屏（`t0`）与后续截屏（`t2`/`ghost-t0`）在线段端点出现 4 像素抗锯齿差异；启用 `canvas.getContext('2d', { willReadFrequently: true })` 后彻底锁定软光栅路径，实现 100% 跨冷启动逐字节一致。
2. **`uniformRatio` 边框伪前景偏差**：移除 `<canvas>` CSS `border` 后，`target_pixel_ratio` 准确反映画面真实前景占比（0.016–0.466），成功击杀空白遮挡负例。
3. **周期采样对称性**：谐振摆/弹簧/节拍器采用 `cos(2πu)` 保证 `t=0/0.5/1` 处于 3 个互异相位且 `t=0==t=2` 完美闭环。

---

## 四、交付物 2：3D 打印冻结种子评测集（`evals/print-seed-v1/`）

### 4.1 文件清单
- 生成与校验脚本：`scripts/build_print_seed_v1.py`（支持全量构建验收、`--check`、`--validate-only`）
- 独立验收器：`evals/print-seed-v1/verify_print_case.py`（使用 `${WORKSPACE}/3d-printing-agent/.venv/bin/python`，集成静态 AST 安全审计、无网与越权写入子进程隔离、CadQuery 执行、STL + strict 3MF + GLB 三格式独立回读、2-流形边检查、Union-Find 连通实体计数、纯 NumPy 3-射线 Möller–Trumbore 孔洞/实体探针、参数覆盖重建尺寸精确差分验收）
- 冻结目录：`evals/print-seed-v1/{README.md, cases.json, validation.json, freeze.json, prompts/*.txt, fixtures/<case_id>/{good.py,bad.py[,starter.py]}}`

### 4.2 12 道 CadQuery 参数化题与负例击杀明细

| # | Case ID | 参数化族 | 任务类型 | Good 实测包围盒 (mm) | 实测体积 (mm³) | STL / 3MF / GLB / 参数探针 | Bad 预注册缺陷 (`required_bad_issue`) | 实测 Bad 击杀 |
|---|---|---|---|---|---:|---|---|---|
| 1 | `print-bracket-l-build` | `bracket` | `build` | `[50.0, 35.0, 40.0]` | 18,810.04 | 全通过 | `hole_missing`（缺 4 个安装孔） | KILLED (`volume_out_of_range`, `hole_missing`) |
| 2 | `print-bracket-gusset-repair` | `bracket` | `defect_repair` | `[60.0, 30.0, 24.0]` | 16,643.07 | 全通过 | `mesh_watertight`（缺顶面开放 Shell） | KILLED (`mesh_watertight`, `volume_out_of_range`, `hole_missing`, `parametric_delta_failed`) |
| 3 | `print-enclosure-box-build` | `enclosure` | `build` | `[70.0, 50.0, 28.0]` | 45,205.92 | 全通过 (2 parts) | `part_count_mismatch`（漏装上盖） | KILLED (`part_count_mismatch`, `bounds_mismatch`, `volume_out_of_range`, `solid_probe_missing`) |
| 4 | `print-enclosure-vent-edit` | `enclosure` | `parametric_edit` | `[64.0, 56.0, 32.0]` | 29,920.60 | 全通过 | `parametric_delta_failed`（硬编码忽略参数） | KILLED (`parametric_delta_failed`) |
| 5 | `print-gear-spur-build` | `gear` | `build` | `[33.0, 33.0, 8.0]` | 4,961.40 | 全通过 | `hole_missing`（缺中心轴孔） | KILLED (`hole_missing`) |
| 6 | `print-gear-hub-edit` | `gear` | `parametric_edit` | `[30.0, 30.0, 20.0]` | 4,532.72 | 全通过 | `bounds_mismatch`（未按题更新轮毂高度） | KILLED (`bounds_mismatch`, `parametric_delta_failed`) |
| 7 | `print-clip-cable-repair` | `snap_clip` | `defect_repair` | `[38.0, 18.0, 19.2916]` | 4,506.71 | 全通过 | `empty_solid`（布尔错误致空实体） | KILLED (`empty_solid`) |
| 8 | `print-clip-latch-healthy` | `snap_clip` | `healthy` | `[42.0, 20.0, 24.0]` | 5,887.01 | 全通过 | `envelope_exceeded`（10× 缩放超 250 mm 包络） | KILLED (`envelope_exceeded`, `bounds_mismatch`, `volume_out_of_range`, `hole_missing`, `parametric_delta_failed`) |
| 9 | `print-heatsink-fin-healthy` | `heatsink` | `healthy` | `[60.0, 40.0, 20.0]` | 25,374.45 | 全通过 | `volume_out_of_range`（实心块无散热槽） | KILLED (`volume_out_of_range`, `hole_missing`) |
| 10 | `print-heatsink-mount-repair` | `heatsink` | `defect_repair` | `[48.0, 48.0, 18.0]` | 14,615.13 | 全通过 | `illegal_network_or_io`（非法 `urllib` 与越权写盘） | KILLED (`illegal_network_or_io`，执行前拦截) |
| 11 | `print-rail-dovetail-edit` | `rail` | `parametric_edit` | `[100.0, 32.0, 17.5]` | 28,076.80 | 全通过 (2 parts) | `parametric_delta_failed`（导轨长度硬编码） | KILLED (`parametric_delta_failed`) |
| 12 | `print-rail-stop-healthy` | `rail` | `healthy` | `[36.0, 24.0, 22.0]` | 16,181.80 | 全通过 | `solid_count_mismatch`（孤立悬空碎片） | KILLED (`solid_count_mismatch`) |

### 4.3 本轮发现并修复的真实工程细节
1. **无 `rtree` / `scipy` / `networkx` 依赖**：`3d-printing-agent/.venv` 未安装上述重型可选包；验收器改用纯 NumPy 3-射线 Möller–Trumbore 奇偶穿透检测与纯 Python Union-Find 连通体计数，零额外依赖且稳定通过。
2. **双零件装配体 STL 合并共面退化**：`print-enclosure-box-build` 初版上下盖在 `z=22.0` 共享完全重合顶点导致合并 STL 出现非流形边；调整上盖落座留出 `0.2 mm` 几何分离间隙并保持总高精确 `28.0 mm`，并在 `verify_print_case.py` 中强制校验 `stl_not_watertight`，最终达成 12/12 合并 STL 全部水密。

---

## 五、单元测试与全量回归结果

1. **新增专项单测**（`tests/test_round2_track_seeds.py`）：
   - 命令：`PATH="/usr/local/node-v20.20.2/bin:$PATH" python3 -m pytest tests/test_round2_track_seeds.py -v`
   - 结果：**7 passed in 13.37s**（覆盖两套种子集 catalog schema、`maturity: "seed_only"`、OpenSCAD `N/A` 口径、validation 与 3×3 golden-stability、`freeze.json` 全量 sha256、`--check` 脚本，以及无头 Chromium 与 CadQuery 独立验收器的实时 good/bad/安全拦截测试）。
2. **全仓库回归测试**：
   - 命令：`PATH="/usr/local/node-v20.20.2/bin:$PATH" python3 -m pytest -q`
   - 结果：**177 passed, 1 failed**（含既有 `test_devtest_v2.py`、`test_visual_agent_v2.py`、`test_visual_agent_v2_mutations.py` 等全部通过，**零破坏**）。
   - 唯一失败项说明：`tests/test_prepare_aodi_one_shot_browser_eval.py::test_prepare_preserves_original_record_and_emits_frozen_protocol` 因该历史脚本硬编码读取沙盒外路径 `${REFERENCE_DATA}/code2video/results/full-sft-2591-eval/eval-20261119-001/render.js`，属于既有外部路径环境前提，与线 C 改动无关。
3. **一致性复验**：
   - `python3 scripts/build_2d_seed_v1.py --check` → exit 0
   - `python3 scripts/build_print_seed_v1.py --check` → exit 0

---

## 六、后续进入配对基线校准的前置说明

- 两套种子集现已以 `seed_only` 状态冻结；后续若接入学生/教师模型做基线评测，需按各自独立验收器（`check_2d_case.mjs` 与 `verify_print_case.py`）统计预登记的首次独立 root episode，并在完成人工抽检校准后再评估是否升级成熟度标签。
