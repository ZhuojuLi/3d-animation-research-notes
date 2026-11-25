# Round 2 阶段 2 前置封口任务 2 交付报告

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

日期：2026-11-25 · 工作目录：`${WORKSPACE}/3d-animation-agent`  
硬件与预算约束：**0 GPU 占用**（纯本机 CPU + 无头 Chromium SwiftShader），**0 付费大模型 API 调用**，未修改任何冻结评测集（`devtest-v2`、`first-sft-holdout-v1`、`2d-seed-v1`、`print-seed-v1`）或其他并行线脚本。

---

## 1. 总览账本

| 交付模块 | 路径 | 规模 | 核心验收结论 |
|---|---|---|---|
| **多轮 ReAct 训练题库 v2** | `evals/round2-train-v2/` | **80 独立题族**（72 train + 8 val）；**260 题**（240 train + 20 val）；195 个 Three.js r180 夹具 | 80/80 `good` PASS、80/80 `bad` KILLED（`validate_modules.mjs` + `check_module.mjs`）；49/49 真实无头 Chromium 预检（30/30 健康 PASS、19/19 全 15 类故障 KILLED）；vs 120 评测题零重叠（`max_cross_similarity = 0.1754`），train/val 题族零重叠（`train_val_max_similarity = 0.3625`） |
| **离线高审美 One-Shot 题库 v2** | `evals/round2-oneshot-v2/` | **760 题**（720 train + 40 val），覆盖 **8 大视觉方向**（每方向精确 90 train + 5 val） | 100% 离线单文件 Three.js r180 契约（0 外链/CDN）、90 train + 5 val GLB/STL 可导出资产；vs 120 评测题零重叠（`max_cross_similarity = 0.0632`）；288,420 对库内查重无克隆（`max_self_similarity = 0.4595`，`>0.50` 对数为 **0**）；train/val 跨 split `0.4554` |
| **池 3：分层精选 Aodi（Train + Val）** | `reports/round2-prep-20261125/pool3-aodi-{train,val}/` | **2,250 train + 256 val**（来自 `first-sft-20261123-001/input`） | 均达 **131/131 (100%) `source×domain`** 与 **18/18 (100%) `source×level`** 全覆盖；GLB 标题簇硬帽 `<=2`；100% 显式单轮 system prompt 隔离与 `"images": []`；train/val UUID 重叠 **0**；Qwen3.8-27B 精确 token **27.99M train + 3.10M val** |
| **池 4：SWE 多轮防遗忘回放** | `reports/round2-prep-20261125/pool4-swe-replay-700/` | **700 train**（前缀嵌套 `1..700`） | 保持原版 `qwen3_8` Ready 格式与 `0.5/1.0/2.0` 权重，700/700 行 SHA-256 逐行吻合 provenance；覆盖 **700 个唯一仓库**、**74.43% (521/700)** 报错恢复轨迹；Swift 精确输入 **20.97M** / 监督 **8.72M** / 加权 **9.09M** tok |
| **构建器与单测** | `scripts/build_round2_train_bank_v2.py`、`tests/test_round2_train_bank_v2.py` | `--check` 冻结哈希校验 + 全套自动化测试 | `--check` 通过；全库 `pytest` **204 passed, 0 failed**（含新增 `test_round2_train_bank_v2.py` 6 项全过，既有测试零回归） |

---

## 2. 任务 1：多轮 ReAct 训练题库 v2（`evals/round2-train-v2/`）

生成与校验脚本：build_round2_train_bank_v2.py（本地附件未发布）

### 2.1 题族与 Train / Val 严格配比

- **80 个完全独立 3D 机构/物理/几何数学题族**：继承 `round2-train-v1` 的 24 个已验证题族 + 新增 56 个全新物理/机构/光学/电磁/几何题族（72 个划入 `train`，8 个独立题族划入 `val`，train/val 题族零交集）。
- **精确配比（Train 与 Val 同步命中 45% / 25% / 20% / 10%）**：

| Split | 题族数 | 总题数 | 缺陷修复 + `broken_delivery`（45%） | 高审美从零生成（25%） | 局部编辑 + 非目标保持（20%） | 健康对照不误改（10%） | 夹具数 |
|---|---:|---:|---|---:|---:|---:|---:|
| `train` | 72 | **240** | **108（45.0%）**：36 `broken_delivery`（33.3%）+ 72 真实缺陷修复（66.7%） | **60（25.0%）** | **48（20.0%）** | **24（10.0%）** | 180 |
| `val` | 8 | **20** | **9（45.0%）**：3 `broken_delivery`（33.3%）+ 6 真实缺陷修复（66.7%） | **5（25.0%）** | **4（20.0%）** | **2（10.0%）** | 15 |
| **合计** | **80** | **260** | **117（45.0%）** | **65（25.0%）** | **52（20.0%）** | **26（10.0%）** | **195** |

- **全 15 类真实故障分布（Train 108 题）**：
  - `broken_delivery`（36 题，占修复类 33.3%）：`broken_delivery_external_script` (10)、`broken_delivery_missing_relative` (10)、`broken_delivery_stale_bundle` (10，叠加错误数学公式)、`broken_delivery_missing_html` (6，0 字节空 HTML)。
  - 真实缺陷修复（72 题，占修复类 66.7%，完整覆盖 `visual-agent-v2` 全部 11 类故障 + 数学公式漂移）：`static_frozen_render` (8)、`stale_state` (8)、`visual_state_mismatch` (8)、`loop_discontinuity` (8)、`mechanism_constraint_drift` (8)、`repeat_mismatch` (7)、`redraw_ghosting` (7)、`pause_failed` (7)、`non_target_changed` (5)、`target_not_visible_dom_overlay` (3)、`target_not_visible_offview` (3)。

### 2.2 Canary 暴露坑点全面修补

1. **题面显式契约（`Runtime & State Contract:`）**：每道题均在 prompt 明确写死 `duration`（6/8/12s）、`fps=30`、`loop`（`true`/`false` 及 `renderAt(0) === renderAt(duration)` 闭环要求）以及 `check_claude_case.mjs` 断言的精确 `window.__3D_STATE__` 字段名（`time`, `phase`, `scalar`, `carrier_x`, `carrier_y`，按需附加 `visual_phase`、`non_target_post_x=-2.1`、`non_target_post_y=1.1`、编辑目标字段与 `#pause` 冻结要求）。
2. **别名兼容断言表达式**：所有断言均使用 Node 20 原生空值合并兼容合理别名（如 `s.time ?? s.timeSeconds ?? s.t ?? s.seconds`、`s.phase ?? s.angle ?? s.phaseRad ?? s.theta ?? s.cyclePhase`、`s.visual_phase ?? s.visualPhase ?? s.rendered_phase`、`s.non_target_post_x ?? s.nonTargetPostX`），消除假阴性拒收。
3. **离线单文件内联与“验通即停”硬规则（`Offline Single-File & Stop Rule:`）**：每题显式规定将本地 Three.js r180 代码全部内联至单一 `output/index.html`（0 外链/CDN/`<script src>`），并在 `mechanism.mjs` 与无头 Chromium `file://` 全项验通后**立即停止交付**，杜绝 110 轮精修死循环。

### 2.3 数值校验、无头 Chromium 预检与隔离验收

- **数学模块双向校验**（`evals/round2-train-v2/module-validation.json` + Node 20 实跑 `check_module.mjs`）：
  - **80 / 80** 参考 `good` 实现 100% PASS；
  - **80 / 80** 缺陷 `bad` 实现 100% KILLED。
- **无头 Chromium SwiftShader 预检**（`evals/round2-train-v2/preflight-fixtures.json`，串联 `check_claude_case.mjs` + `check_module.mjs` + `visual-agent-v2/check_browser.mjs --kind 3d`）：
  - **49 / 49 matched（100%）**：
  - **30 / 30 健康夹具 100% PASS**（全部 24 train + 2 val `healthy_control` + 4 代表性 `local_edit` starter）；
  - **19 / 19 故障夹具 100% KILLED**（覆盖全部 15 类故障代表 + 4 道 val 故障代表）。
- **隔离查重**（`evals/round2-train-v2/isolation.json`，对比 `devtest-v2` 60 题 + `first-sft-holdout-v1` 60 题 = 120 评测题 + train/val 跨 split）：
  - `family_id_overlap`: `[]`
  - `family_term_overlap`: `[]`
  - `prompt_eval_term_hits`: `{}`
  - `max_cross_similarity`: **`0.1754`**（远低于 `< 0.50`）
  - `train_val_family_overlap`: `[]`
  - `train_val_max_similarity`: **`0.3625`**（`< 0.50`）
  - `passed`: **`true`**

---

## 3. 任务 2：离线高审美 3D One-Shot 题库 v2（`evals/round2-oneshot-v2/`）

- **总规模**：**760 道完全独立题材**（**720 `train` + 40 `val`**），覆盖 **8 大视觉方向**（每方向精确 **90 train + 5 val**）：
  1. `precision_mechanical`（精密机械与钟表机构）：90 train + 5 val
  2. `museum_artifact`（博物馆工艺器物与文物微缩）：90 train + 5 val
  3. `architectural_miniature`（建筑微缩与电影级场景沙盘）：90 train + 5 val
  4. `natural_water`（自然水景、生态微景观与天气氛围）：90 train + 5 val
  5. `optics_celestial`（光学、天体与科学仪器陈列）：90 train + 5 val
  6. `biological_sculpture`（生物与植物精密雕塑）：90 train + 5 val
  7. `kinetic_instruments`（动力学装置、乐器与自动机）：90 train + 5 val
  8. `glb_exportable_asset`（可导出 GLB/STL 收藏级主体资产）：90 train + 5 val
- **高多样性与离线契约**：760 个唯一 `slug` 与唯一 `title`，配合 24 套差异化策展叙述语态，全部严格声明本地 Three.js r180 ES module 导入（0 `http(s)://` / 0 CDN / 0 远程资源）、程序化 `CanvasTexture` PBR 材质、无悬空实心接点、电影级三点布光、确定性动效与禁低模积木风（第 8 类附 `GLTFExporter` / `STLExporter` 与导出按钮）。
- **隔离与库内去重**（`evals/round2-oneshot-v2/isolation.json`）：
  - 对比全部 120 评测题：`family_id_overlap: []`、`prompt_eval_term_hits: {}`、**`max_cross_similarity = 0.0632`**（`< 0.50`）；
  - 全库 760×759/2 = **288,420 对**逐对查重：**`max_self_similarity = 0.4595`**，**`self_pairs_above_0.50_count = 0`**（零克隆题面）；
  - Train/Val 跨 split：`train_val_family_overlap: []`、**`train_val_max_similarity = 0.4554`**（`< 0.50`）；
  - `passed`: **`true`**。

---

## 4. 任务 3：池 3（分层 Aodi）与池 4（SWE 回放）正式物化账本

### 4.1 池 3：分层精选 Aodi（只读调用 `scripts/sample_aodi_stratified.py`，`seed=20261124`）

输入源：`${SHARED_DATA}/3d-agent-sft/first-sft-20261123-001/input/{train,validation}.jsonl`（实测 0 条 ReAct 混入，完整保留 `"images": []` 与 `"tools": []` 便于多模态 Arrow 混排）。

| 指标 | Pool 3 Train（`pool3-aodi-train/`） | Pool 3 Val（`pool3-aodi-val/`） |
|---|---:|---:|
| 物化条数 | **2,250**（池总量 10,697） | **256**（池总量 812） |
| 来源配比（`scenes-v1 / scenes-v2 / glb-assets`） | **900 (40.0%) / 900 (40.0%) / 450 (20.0%)** | **102 (39.84%) / 102 (39.84%) / 52 (20.31%)** |
| `source × domain` 全覆盖 | **131 / 131（100.0%）** | **131 / 131（100.0%）** |
| Scene `source × level` 全覆盖 | **18 / 18（100.0%）** | **18 / 18（100.0%）** |
| GLB 标题簇最大大小 / 唯一标题数 | **2** / 394（硬帽 `<=2`） | **2** / 50（硬帽 `<=2`） |
| 显式单轮 System Prompt 隔离 | 2,250 / 2,250（100%） | 256 / 256（100%） |
| Train/Val UUID 交集 | **0** | **0** |
| Qwen3.8-27B 总 Token（sys+user+asst） | **27,987,420** | **3,098,939** |
| Qwen3.8-27B 单条 Token（min / p50 / mean / p95 / max） | 4,184 / 12,227 / 12,438.9 / 18,519 / 27,743 | 3,308 / 11,516 / 12,105.2 / 19,867 / 26,128 |
| 文件体积（字节） | 88,159,341（84.1 MB） | 9,732,244（9.3 MB） |
| JSONL SHA-256 | `8674cb39f08149d1209aafcf7fdc277a98b0d43a3e22fb9fb01158ef1654505d` | `631c49ba7646e39fbc330ff23c8749c06ff152a4b560ce276e40ec71fe10b10a` |

### 4.2 池 4：SWE 多轮防遗忘回放（前 700 条前缀嵌套切片）

输入源：`${SHARED_DATA}/3d-agent-sft/swe-replay-27b-v1/ready.jsonl`（与本地镜像逐字节一致，SHA-256：`3a0826b2769f4a2296eb03620bb98de977135a7d9fba11311a028b7e9cd6a822`）。  
物化路径：`reports/round2-prep-20261125/pool4-swe-replay-700/swe-replay-train-700.ready.jsonl`（**80,945,414 字节**，SHA-256：`5f5e6603167d4c18b0ced1ef16ffd9471d1014428a43f7e629fdc33969972b43`）。

- **格式与权重保真**：原样保留 `qwen3_8` Ready 格式与 `0.5 / 1.0 / 2.0` 损失权重，**700 / 700** 行 `ready_line_sha256` 逐行核对通过，100% EOS 监督且 label/loss_scale 对齐。
  - Assistant 消息块权重计数：`0.5`（thinking）= **17,591**、`1.0`（content）= **9,598**、`2.0`（tool_calls）= **17,591**。
- **多样性与质量**：
  - 覆盖 **700 个独立开源仓库**（0 重复仓），含 **521 条（74.43%）** 真实报错恢复轨迹；
  - 语言分布：`python` 358、`ts` 126、`js` 119、`go` 70、`php` 18、`rust` 5、`java` 3、`c` 1；
  - 来源分布：`swe-rebench-v2` 487、`scale-swe` 213；任务类别：`bug-fix` 304、`feature-request` 195、`other` 109、`enhancement` 92。
- **精确 Swift `qwen3_8` Token 与轮数统计**：
  - 输入 Token `I`：**20,968,104**（min 6,816 / p50 29,526 / mean 29,954.4 / p95 45,147 / max 47,475，100% `<= 49,152`）；
  - 监督 Token `U`：**8,717,360**（min 2,186 / p50 11,853 / mean 12,453.4 / p95 21,771 / max 27,201）；
  - 加权 Token `W`：**9,092,438.0**（其中 `0.5`: 5,290,790、`1.0`: 372,315 + EOS/ctrl 33,782、`2.0`: 3,020,473）；
  - 单段最长思考 Token：min 170 / p50 1,444 / mean 1,814.1 / p95 4,563 / **max 7,918**（100% `<= 8,192`）；
  - 工具调用轮数（`tool_call_turns`）：总计 **17,591**（min 10 / p50 24 / mean 25.13 / p95 39 / max 50）；总工具调用次数 **23,509**（mean 33.58/条）；总消息数 **41,804**（mean 59.72/条）。
- **多模态混排提醒**：与含图片的 ReAct 数据合并进单一 Swift Arrow 数据集时，请为纯文本 SWE 行补 `"images": []`（沿用 `swe-replay-27b-v1/mix-compat-smoke.json` 已验证做法）。

---

## 5. 文件清单

- `scripts/build_round2_train_bank_v2.py`
- `evals/round2-train-v2/{families.json,cases.json,validate_modules.mjs,check_module.mjs,module-validation.json,preflight-fixtures.json,isolation.json,freeze.json,prompts/,fixtures/}`
- `evals/round2-oneshot-v2/{cases.json,isolation.json,freeze.json,prompts/}`
- `reports/round2-prep-20261125/{REPORT.md,manifest.json,pool3-aodi-train/,pool3-aodi-val/,pool4-swe-replay-700/}`
- `tests/test_round2_train_bank_v2.py`
