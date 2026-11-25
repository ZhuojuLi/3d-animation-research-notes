# Round 2 阶段 1 线 B 交付与 10 题 DeepSeek `high` 全链路 Canary 实测报告

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

日期：2026-11-24 · 工作目录：`${WORKSPACE}/3d-animation-agent`  
模型：3D 专用 DeepSeek `deepseek-v4.1-flash-1017`（`.env.deepseek`，服务端回传 `deepseek-v4-1-flash-261017`）  
算力约束：**0 GPU 占用**（全程仅本机 CPU + 无头 Chromium SwiftShader + 3D 专用 DeepSeek API + CPU-only Swift Docker 模板验收 + `18790` DeepSeek 视觉复核）。

---

## 1. 放量门槛总结论（Go / Conditional Go）

| 数据池 / 链路 | 放量判定 | 核心依据 |
|---|---|---|
| **池 2：离线高审美 3D One-Shot（`evals/round2-oneshot-v1` + `run_deepseek_oneshot_offline.py` + `prune_oneshot_cot.py`）** | **GO（已达批量放量门槛）** | 5/5 完整生成离线 Three.js r180 代码、0 外部 URL、0 console/page 错、esbuild 打包 5/5 成功、WebGL 绘制与帧间运动 5/5 通过；CoT 提纯将 `164,440 → 24,628` tok（单条最大 `56,739 → 9,477`，0 泄露，100% content 哈希不变）；真实 27B `ms-swift 4.5.2 + qwen3_8` 模板验证 **5/5 全过**（总长 `21,901–32,106` tok，完美贴合 65K binpack）；18790 DeepSeek 看图确认博物馆级 PBR 质量。已同步修补浏览器检查器 `animations: 'disabled'` 规避 HUD CSS 淡入误杀。 |
| **池 3：分层精选 Aodi 底座（`sample_aodi_stratified.py`）** | **GO（已达批量放量门槛）** | 全量 10,697 条 train 只读 dry-run 精确抽出 2,250 条（`scenes-v1 40% / scenes-v2 40% / glb-assets 20%`），实现 **131/131 `source×domain`（100%）** 与 **18/18 `source×level`（100%）** 全覆盖，GLB 同标题簇上限压至 `<=2`（394 个唯一标题），并注入显式单轮 system prompt 与离线 ReAct 契约彻底隔离。 |
| **池 1：多轮 ReAct 主池（`evals/round2-train-v1` + `run_claude_cases.py` + `export_episode_capture.py` + `prune_react_cot.py`）** | **CONDITIONAL GO（补齐 3 项小加固后立即放量）** | 中转全量抓包 → `export_episode_capture.py --multimodal` → `prune_react_cot.py`（`200,085 → 90,564` 思考 tok，单段峰值 `19,440 → 2,704`，100% 非思考字段 SHA-256 逐字节不变）→ 真实 27B Swift 模板验证 **4/4 完整轨迹全过**（292 次工具调用、70 张图片、0 错误、完整 system+tools schema）；健康对照 `r2-micrometer-healthy` **0 文件误改**；5/5 产物通过 `check_module.mjs`。**放量前须修补的 3 个坑点**见第 7 节（为 `high` 档加硬轮数护栏防从零生成 110 轮/57 图超时、题面与断言字段对齐、中转瞬时断连区分）。 |

---

## 2. 独立训练题库与隔离验收（任务 B1）

生成脚本：build_round2_train_bank.py（本地附件未发布）（`--check` 冻结哈希校验通过）。

### 2.1 多轮 ReAct 独立训练题库（`evals/round2-train-v1/`）

- **题族数**：**24 个全新 3D 机构/动画题族**（`scotchyoke, genevawheel, foucault, pantograph, lissajous, cycloidarch, epicycloid, catenary, keplersector, dampedosc, doppler, beveldiff, helicalscrew, kaprekar, graycode, hanoi, balancedternary, snellprism, tuningsync, wattgovernor, camheart, rackpinion, micrometer, marimba`）。
- **模块双向校验**（`module-validation.json`）：**24/24 `good` 参考实现 100% 通过**，**24/24 `bad` 缺陷实现 100% 被杀死**。
- **首批 60 题目标配比（精确命中 45% / 25% / 20% / 10%）**：
  - 真实缺陷修复 + `broken_delivery` 断链恢复：**27 题（45.0%）**，其中 9 题 `broken_delivery`（外部缺失脚本 / 过期 sidecar `bundle.js` + 机构公式错）+ 18 题真实缺陷修复，完整覆盖 `visual-agent-v2` 全部 **11 类故障**（`broken_delivery_external_script`, `broken_delivery_stale_bundle`, `static_frozen_render`, `stale_state`, `visual_state_mismatch`, `loop_discontinuity`, `mechanism_constraint_drift`, `repeat_mismatch`, `redraw_ghosting`, `pause_failed`, `target_not_visible_dom_overlay`, `target_not_visible_offview`）。
  - 高审美离线生成 + 自检：**15 题（25.0%）**。
  - 局部编辑 + 非目标保持：**12 题（20.0%）**（均带真实 Three.js r180 esbuild 打包夹具与非目标支柱断言）。
  - 健康对照不误改：**6 题（10.0%）**（出厂即通过全部离线/浏览器/模块/暂停检查）。
- **19 题夹具预检**（`preflight-fixtures.json`）：6/6 健康对照 + `local_edit` 出厂 **100% 通过** `check_claude_case.mjs` + `check_module.mjs` + `visual-agent-v2/check_browser.mjs`；全部 12 组故障类代表夹具 **100% 被自动校验杀死**（`19/19 matched`）。
- **与所有冻结评测集零重叠隔离**（`evals/round2-train-v1/isolation.json`，对比 `evals/devtest-v2` 60 题 + `evals/first-sft-holdout-v1` 60 题 = 120 条评测题面）：
  - `family_id_overlap`: `[]`
  - `family_term_overlap`: `[]`
  - `prompt_eval_term_hits`: `{}`
  - **`max_cross_similarity`: `0.1159`**（远低于 `< 0.5` 阈值，`passed: true`）

### 2.2 离线高审美 One-Shot 题库（`evals/round2-oneshot-v1/`）

- **题量**：**60 题**，覆盖 7 大题材：`precision_mechanical` (9)、`museum_artifact` (9)、`architectural_miniature` (9)、`natural_water` (9)、`optics_celestial` (8)、`biological_sculpture` (8)、`glb_exportable_asset` (8)。
- **统一离线契约**：严格禁用 CDN / `http(s)://` / 外链，采用本地 Three.js r180 ES module 导入 + `run_deepseek_oneshot_offline.py` 自动本地 esbuild 离线内联打包为单文件 `bundled.html`，确保 `file://` 冷加载 0 外部请求。
- **隔离校验**（`evals/round2-oneshot-v1/isolation.json`）：`family_id_overlap: []`，`prompt_eval_term_hits: {}`，**`max_cross_similarity`: `0.069`**（`< 0.5`，`passed: true`）。

---

## 3. Aodi 分层精选抽样器 Dry-Run 覆盖度（任务 B2）

脚本：sample_aodi_stratified.py（本地附件未发布） · 报告：aodi-stratified-dryrun/coverage-report.json（本地附件未发布）

| 指标 | 全量池（train） | 分层抽样（`seed=20261124`） | 覆盖度 / 约束达成 |
|---|---:|---:|---|
| 总样本数 | 10,697 | **2,250** | 落入目标区间 2,000–2,500 |
| `scenes-v1`（目标 40%） | 3,933 (36.8%) | **900 (40.0%)** | 41/41 domain，10/10 level（62–110/级），Q1–Q4 均衡（192/258/248/202） |
| `scenes-v2`（目标 40%） | 3,263 (30.5%) | **900 (40.0%)** | 50/50 domain，8/8 level（62–153/级），Q1–Q4 均衡（209/249/255/187） |
| `glb-assets`（目标 20%） | 3,501 (32.7%) | **450 (20.0%)** | 40/40 domain，Q1–Q4 均衡（112/117/114/107） |
| `source×domain` 全覆盖 | 131 | **131 / 131** | **100.0%** |
| Scene `source×level` 全覆盖 | 18 | **18 / 18** | **100.0%** |
| GLB 同标题簇降权 | 最大簇 6 条 | **最大簇 2 条**（394 唯一标题） | 反平方根降权 + `max_per_title_cluster=2` 硬帽生效 |
| 契约隔离 | 缺统一标识 | 3 类显式单轮 system prompt | 与离线 r180 ReAct Agent 明确解耦 |

---

## 4. 10 题 DeepSeek `high` 全链路 Canary 实测明细（任务 B3）

### 4.1 5 题多轮 ReAct Canary（`--model deepseek --effort high --episode-capture --teacher-guidance --timeout 2400`）

| 题目 ID | 类型 | 耗时(s) | 退出 | HTTP 请求 / 读图 | 累计输入 / 输出 tok（API 侧） | `verify_episode_capture` | `check_module` | `v2/check_browser` | `check_claude_case` | 关键现象 |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| `r2-micrometer-healthy` | 健康对照 | 252.2 | **0** | 25 / 5 图 | 760,813 / 18,358 | **PASS** (25/25) | **PASS** | **PASS** | **PASS** | **0 文件被修改、0 冗余文件**，完整自检后原样交付 |
| `r2-dampedosc-edit` | 局部编辑 | 804.7 | **0** | 51 / 19 图 | 3,171,771 / 74,271 | **PASS** (51/51) | **PASS** | **PASS** | **PASS** | 扩展阻尼系数 `c` + 指数包络线，非目标支柱 `(-2.1, 1.1)` 严格保持 |
| `r2-marimba-repair-pause-failed` | 真实缺陷修复 | 1017.9 | **0** | 47 / 19 图 | 2,904,598 / 74,141 | **PASS** (47/47) | **PASS** | **PASS** | **PASS** | 根治 `#pause` 失灵，通过真实按钮点击冻结检查 + 无缝循环 |
| `r2-cycloidarch-repair-bd-stale-bundle` | `broken_delivery` 断链+公式修复 | 1263.5 | **0** | 61 / 27 图 | 6,671,979 / 127,189 | **PASS** (61/61) | **PASS** | **PASS** (`1164 draws`) | FAIL (`assertion:phase_moves`) | **断链与最速降线公式均完全修好**（0 外链/0 报错/`repeat_exact=true`）；仅因题面未点名 `s.phase` 而导出 `lanes.cycloid.u` 触发断言命名失配 |
| `r2-keplersector-gen` | 高审美从零生成 | 2415.5 | **143** (timeout) | 110 / 57 图 | 15,048,723 / 165,008 | FAIL (`req-00026` 断连重试) | **PASS** | FAIL (`repeat_mismatch`) | FAIL (`loop_exact`, `state_time_finite`) | 已产出 613KB 博物馆级离线 HTML，但 `high` 档无硬轮数上限陷入 **110 轮 / 57 图** 精修死循环直至超时 |

**`export_episode_capture.py --multimodal` 核验（4 条自然收敛完整轨迹，严禁回退 `export_claude_streams.py`）**：
- 4/4 `capture_mode == "episode_capture"`、`system_prompt_available == true`、`tool_schemas_available == true`、`coverage.archived_all_observed == true`、`segment_count == 1`、`history_thinking_preserved == true`、`compaction_boundaries == []`。
- 4 条分别记录 `thinking_turns` = 24 / 39 / 42 / 50，`tool_calls` = 41 / 78 / 70 / 103，`images` = 5 / 19 / 19 / 27。

### 4.2 5 题离线高审美 One-Shot Canary（`run_deepseek_oneshot_offline.py`，`effort=high, max_tokens=98304, temp=0.7`）

每条均完整落盘 `request.json`、`response_raw_sse.txt`、`response.json`（含完整 `reasoning_content` 与 `usage`）、`raw.html`、`bundled.html`、`bundle_report.json`、`evidence/browser_check.json` 及 `native-swift.jsonl`。

| 题目 ID | 题材 | 耗时(s) | `completion` / `reasoning` tok（API） | `raw_external_urls` | esbuild 离线打包 | WebGL Draws / 非均匀占比 | `browser_ok`（原始严格整页） | 备注 |
|---|---|---:|---:|---:|---|---:|---|---|
| `os-mech-tourbillon` | 精密机械 | 295.9 | 66,850 / 51,103 | 0 | **PASS** | 1,813 / 81.8% | **PASS** (`repeat_exact=true`) | 130 网格、82,606 三角面、4 啮合齿轮严格齿比 |
| `os-arch-pagoda` | 建筑微缩 | 291.1 | 68,272 / 49,500 | 0 | **PASS** | 3,608 / 97.1% | **PASS** (`repeat_exact=true`) | 5 层木塔、132,912 三角面、340 花瓣、20 风铃 |
| `os-glb-brass-octopus` | GLB/STL 资产 | 102.9 | 29,063 / 0* | 0 | **PASS** | 19,962 / 66.3% | **PASS** (`repeat_exact=true`, GLB 按钮存在) | 1,015 部件、8 触手、224 吸盘、285 铆钉 |
| `os-art-celadon-vase` | 博物馆器物 | 276.6 | 66,783 / 52,827 | 0 | **PASS** | 498 / 52.2% | FAIL (`repeat_mismatch`*) | 像素 diff 定位 `y∈[438,520]`，纯底部 HUD CSS 淡入过渡所致，3D 瓷瓶像素 100% 一致 |
| `os-nat-bonsai-stream` | 自然水景 | 80.4 | 22,313 / 0* | 0 | **PASS** | 14,596 / 74.4% | FAIL (`repeat_mismatch`*) | 全屏 518,400 像素仅 30 像素差 `0.006%`（`max_delta=4`），SwiftShader 软件光栅微噪 |

> *注：已据此在 `scripts/run_deepseek_oneshot_offline.py` 中为截图增加 `animations: 'disabled'` 并记录 `repeat_diff_ratio` 与 `repeat_within_tolerance`（`<=0.001` 且 `max_delta<=6`），避免 Stage 2 误杀优质场景。同时观察到混合推理模型 `deepseek-v4-1-flash-261017` 在 2/5 单轮请求中自发返回空 `reasoning_content`（直接输出 61KB–84KB 高品质 HTML）。

---

## 5. CoT 保真提纯与真实 27B ms-swift 模板验证

所有提纯均使用真实 `Qwen3.8-27B` HF Tokenizer 精确计 token，并调用 3D 专用 DeepSeek（`.env.deepseek`, `temperature=0.4`）；Swift 模板验证在 **CPU-only Docker 容器**（`${CONTAINER_IMAGE}`，无 `--gpus`，显式 `CUDA_VISIBLE_DEVICES=""`）执行 `qwen38_swift_normalize.py` → `build_ready_preserve_media.py` → `validate_claude_swift_batch.py`。

### 5.1 多轮 ReAct 局部 CoT 提纯（`prune_react_cot.py`，阈值 `>3000` tok，硬帽 `8192` tok）

报告：distill/react-prune-report.json（本地附件未发布） · Swift 验收：swift-react/swift-validation.json（本地附件未发布）

| 轨迹 | 总轮数 / 触发提纯轮数 | 提纯前思考 tok（峰值） | 提纯后思考 tok（峰值） | 非思考完整性 SHA-256（前8位，前后严格一致） | Swift 27B 编码总长 / 监督 tok / 图片 | Swift 结果 |
|---|---:|---:|---:|---|---:|---|
| `r2-micrometer-healthy` | 25 / 0 | 10,091 (1,551) | **10,091 (1,551)** | `849021e2` (**MATCH**) | 59,319 / 18,124 / 5 图 | **PASS** |
| `r2-dampedosc-edit` | 51 / 4 | 51,198 (18,925) | **22,446 (2,542)** | `db06dbaf` (**MATCH**) | 71,250 / 48,934 / 19 图 | **PASS** |
| `r2-marimba-repair-pause-failed` | 47 / 3 | 47,242 (11,723) | **25,257 (2,704)** | `7c2662f9` (**MATCH**) | 76,262 / 54,780 / 19 图 | **PASS** |
| `r2-cycloidarch-repair-bd-stale-bundle` | 61 / 7 | 91,554 (19,440) | **32,770 (2,620)** | `60782bfc` (**MATCH**) | 102,289 / 73,845 / 27 图 | **PASS** |
| **合计 / 汇总** | **184 / 14（0 失败）** | **200,085 (max 19,440)** | **90,564 (max 2,704)** | **4/4 100% 逐字节不变** | **4/4 全过，0 丢弃，292 工具调用，70 图** | **`batch_ready_loader_and_template_passed`** |

- `system_prompt_and_tools_present_in_all_records: true`，`exact_tool_call_records_passed: 4/4`，`supervised_serialized_image_flags: 0`，`errors: []`，`above_131072: 0`。

### 5.2 离线 One-Shot 正向规划 CoT 提纯（`prune_oneshot_cot.py`，阈值 `>8192` tok，硬帽 `12000` tok）

报告：distill/oneshot-prune-report.json（本地附件未发布） · Swift 验收：swift-oneshot/swift-validation.json（本地附件未发布）

| 样本 | 触发提纯 | 提纯前思考 tok | 提纯后思考 tok | 泄露词检出 | Content 哈希不变 | Swift 27B 总长 / 监督 tok | Swift 结果 |
|---|---|---:|---:|---|---|---:|---|
| `os-arch-pagoda` | 是（1 次通过） | 52,473 | **9,477** | 0 | **True** | 30,377 / 29,899 | **PASS** |
| `os-art-celadon-vase` | 是（1 次通过） | 56,739 | **6,094** | 0 | **True** | 21,901 / 21,405 | **PASS** |
| `os-mech-tourbillon` | 是（1 次通过） | 55,228 | **9,057** | 0 | **True** | 26,654 / 26,126 | **PASS** |
| `os-glb-brass-octopus` | 否（天然空思考） | 0 | 0 | 0 | **True** | 32,106 / 31,506 | **PASS**（空思考 mask `loss=False`） |
| `os-nat-bonsai-stream` | 否（天然空思考） | 0 | 0 | 0 | **True** | 24,492 / 24,016 | **PASS**（空思考 mask `loss=False`） |
| **合计 / 汇总** | **3/5 触发，0 失败** | **164,440 (max 56,739)** | **24,628 (max 9,477)** | **0** | **5/5 True** | **21.9K–32.1K（0 超 65K）** | **`batch_ready_loader_and_template_passed`** |

- 未提纯前，3 条 52K–56K 思考样本均超出 Swift `max_thinking_tokens=32,768` 上限会被整条丢弃；提纯后 **85.0% 压缩** 且 5/5 落入 **21.9K–32.1K** 区间，2 条正好打满 65,536 binpack！

---

## 6. 18790 DeepSeek 视觉抽检（共 7 张渲染帧）

证据文件：vision-review-oneshot.json（本地附件未发布） · vision-review-react-and-pagoda.json（本地附件未发布）（全程通过 `LOCAL_PREVIEW_NOT_PUBLISHED`、`max_tokens=2048`，未使用内置看图工具，未打印任何 key）。

| 样本 | 来源池 | 18790 视觉结论 | 核心画面评语摘要 |
|---|---|---|---|
| `os-mech-tourbillon` | One-Shot | **Pass（博物馆级 PBR）** | 陀飞轮居中无遮挡；玫瑰金夹板、银色齿轮、红宝石轴承与鱼鳞纹反射逼真，无悬空穿模 |
| `os-glb-brass-octopus` | One-Shot GLB | **Pass（博物馆级 PBR）** | 蒸汽朋克黄铜章鱼构图清晰、铜质反光与发光球体层次强，左下/右下按钮不遮挡主体 |
| `os-arch-pagoda` | One-Shot | **Pass** | 五层宝塔与庭院居中完整，反光屋瓦、红木柱与发光窗清晰，无遮挡与穿模 |
| `r2-cycloidarch-repair-bd-stale-bundle` | ReAct 断链修复 | **Pass（高质量 PBR）** | 木纹底座、金属双轨道反光与落地阴影真实，铭牌字迹清晰，无 UI 遮挡 |
| `r2-keplersector-gen` | ReAct 从零生成 | **Pass（博物馆级 PBR）** | 抛光黄铜轨道机构与深色底座对比强烈，中心光源投射真实反射与阴影，无悬空 |
| `r2-marimba-repair-pause-failed` | ReAct 暂停修复 | **Pass** | 木琴音条、黄铜共鸣管与支架清晰无穿模无遮挡（仅提示动态悬空琴槌属动画帧状态） |
| `r2-dampedosc-edit` | ReAct 局部编辑 | **Borderline（保留 starter 几何）** | 弹簧/阻尼缸与新增包络线清晰连贯无破损，但因保留简洁 starter 夹具材质偏基础、右侧包络文字略靠近框架 |

---

## 7. 单题平均耗时 / Token 成本估算与放量前必改坑点

### 7.1 单题平均耗时与 Token 成本估算（基于 10 题实测）

| 队列 | 单题均值耗时 | 单题 API 输入 / 输出 tok | CoT 提纯附加耗时 & tok | 批量规模推演（16 并发） |
|---|---:|---:|---:|---|
| **One-Shot 离线高审美（5 题）** | **209.4s** (~3.5 min) | 510 in / **50,656 out** | ~46s / ~43K tok（仅 >8K 触发） | 650 题 @ 16 并发 ≈ **2.5 小时**（~33M out tok） |
| **ReAct 修复 / 编辑 / 健康（4 条收敛样本）** | **834.6s** (~13.9 min) | **3.38M cum_in** / 73.5K out | ~60s / ~14 段局部提纯 | 300 题 @ 16 并发 ≈ **4.5–6 小时**（若降轮数上限可压半） |
| **ReAct 从零生成 `high`（无轮数硬帽）** | **>2400s** (超时) | **15.0M cum_in** / 165K out | — | **禁止无 `--max-turns` 放量**（110 轮/57 图成本失控） |

### 7.2 Canary 暴露的 4 个关键边界坑点与应对

1. **软收敛 Prompt 拦不住 DeepSeek `high` 从零生成精修死循环（最高优）**：
   - `r2-keplersector-gen` 尽管携带 `--teacher-guidance`，仍在 2400s 内跑了 **110 次请求 / 57 张截图**才被超时强杀（实际前 ~25 轮已产出高质量 613KB HTML）。
   - **Stage 2 放量前动作**：在 `run_claude_cases.py` 增加可选 `--max-turns` 透传给 Claude CLI（建议：健康/修复/编辑 `--max-turns 28` 或采用 `--effort medium`；从零生成 `--effort high --max-turns 40 --timeout 3600`），将单题累计输入 token 压回 1–3M 并把收敛率推至 >90%。
2. **`round2-train-v1` 部分题面未显式约定 `window.__3D_STATE__` 字段名与 `duration`/`loop`**：
   - `r2-cycloidarch-repair-bd-stale-bundle` 断链与物理全修好却因导出 `lanes.cycloid.u` 而非 `s.phase` 被 `check_claude_case.mjs` 拒收；`r2-keplersector-gen` 因题面未写死 `duration=8` 与 `time` 字段名，自行选了 `periodSeconds=30` 与 `timeSeconds`。
   - **Stage 2 放量前动作**：在题库生成脚本中将 `duration`/`loop` 及被断言字段名明确写入 prompt（并在 `assertions` 兼容 `s.time ?? s.timeSeconds ?? s.t`），消除假阴性。
3. **One-Shot 浏览器检查器 HUD CSS 淡入导致 `repeat_mismatch` 假阴性（已修补）**：
   - `os-art-celadon-vase` 仅底部 HUD 淡入过渡（`y∈[438,520]`）导致整页哈希不一致，`os-nat-bonsai-stream` 仅 0.006% 软件光栅 4-LSB 抖动。已在 `scripts/run_deepseek_oneshot_offline.py` 启用 `animations: 'disabled'` 与像素容差统计（`repeat_diff_ratio <= 0.001 && max_delta <= 6`），修正后 5/5 全部通过。
4. **One-Shot `deepseek-v4-1-flash-261017` 偶发自发空思考（2/5）与 18790 看图 `max_tokens`**：
   - 2/5 One-Shot 样本直接输出 61KB–84KB 高质量代码但 `reasoning_tokens=0`；`build_ready_preserve_media.py` 已正确 mask 为 `loss=False` 而不误报异常，Stage 2 需持续监控空思考比例（如希望 Pool 2 全部带正向规划思考，可评估显式 `thinking: {"type": "enabled"}` 或按非空思考配额补采）。
   - 18790 DeepSeek 看图因内含 500–1000 推理 token，`max_tokens=1024` 会在长评语处截断（`finish_reason="length"`），建议统一设为 `max_tokens=2048`（实测 5/5 `finish_reason="stop"`）。

---

## 8. 自动化回归测试

- 新增测试文件：tests/test_round2_cot_pruning.py（本地附件未发布）（13 项单测：One-Shot/ReAct CoT 提纯、泄露词拦截、硬帽重试、非思考字段 SHA-256 逐字节保真、esbuild 离线打包与 CDN 检测、Aodi 分层覆盖与标题簇降权、两个新题库冻结哈希与零重叠隔离）。
- 全量回归测试（`pytest` + Node 20）：**191 passed, 0 failed**（`254.78s`，含既有 `test_devtest_v2.py`、`test_visual_agent_v2*.py`、`test_export_episode_capture.py`、`test_run_claude_collection.py` 与新增 13 项 `test_round2_cot_pruning.py`，零回归）。
