# XHS 对齐统一训练数据与上下文标准规范（3D 展示 · CAD 打印 · 2D 动画三轨共用）

> 公开整理版 · 2026-11-28。保留成文时点的记录；计划、文献结果和本地实测请分别理解。环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> 生效日期：2026-11-27（已按 **Revision 3 / Option 2** 主方案 [CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md](../../research/xhs-384k-to-200k-data-adaptation-20261127/CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md)、[OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md](../../research/xhs-384k-to-200k-data-adaptation-20261127/OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md) 与 `decisions.md`（本地附件未发布） 定版更新：**全链路（Stage 1–4、Canary、`vLLM` 服务）严格锁定同一套 `Static YaRN 1.5×`（`393,216`）**，不切分硬训完整小红书 `384K` 401 分片（Phase-0 零丢弃清洗 `100%` 存活），后续造数/评测/线上沙盒统一 **`256K`（`208000 / 80% / 32768 / MAX_TOOL_RESULT_TOKENS=16384`）**，采用统一 PyArrow Schema（无顶层 `tools` 键）、空 `<think>` 拆分（`0.0 / w_ch`，`validation.jsonl` `loss_scale=1.0`）与 `Blender 4.2.10 LTS (bpy)` 纯代码主线）  
> 对齐来源：[CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md](../../research/xhs-384k-to-200k-data-adaptation-20261127/CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md) · [OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md](../../research/xhs-384k-to-200k-data-adaptation-20261127/OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md) · `decisions.md`（本地附件未发布）（`2026-11-27` Revision 3 / Option 2 定案） · [历史 `HCPF-Lite 256K` 归档](../../research/xhs-384k-to-200k-data-adaptation-20261127/archive/joint-consolidation.md) · [3DCodeFactory 论文与源码](../../research/arxiv-2611.28783/README.md) · [三轨顶级交付规格](THREE-TRACK-DELIVERABLE-SPEC.md)  
> 设计目标：**确保 3D（Blender + Three.js）、CAD 打印、2D 动画在多文件工程交付、多轮模板、全链路 `Static YaRN 1.5×`（不切分 `384K` 训练 + `256K` 沙盒 `208K / 80% / 16384`）、图片分辨率、预装工具链、工具协议、空 `<think>` 拆分与统一 PyArrow Schema 上 100% 一致，彻底消除训推断层与跨轨污染。**

---

## 一、统一核心规格总表（Revision 3 / Option 2 定版口径，所有赛道强制对齐）

| 规范维度 | 统一标准值（`2026-11-27` Revision 3 / Option 2 定版口径） | 工程原因与防坑红线 |
|---|---|---|
| **学生基座与模板** | `Qwen3.8-27B` BF16（**全链路锁定 `Static YaRN 1.5×`**：`max_position_embeddings: 393216`, `rope_scaling: {"rope_type": "yarn", "factor": 1.5, "original_max_position_embeddings": 262144, "mrope_interleaved": true, "mrope_section": [11, 11, 10], "partial_rotary_factor": 0.25, "rope_theta": 10000000}`）；`--model_type qwen3_5 --template qwen3_8 --template_backend swift`（**不传 `reasoning_effort`，走原生默认 `xhigh`**） | **训推同构铁律**：Stage 1–4、8 卡 Canary、`merge_lora_to_hf.py` 与 `vLLM` 必须使用完全一致的 `Static YaRN 1.5×` `config.json`，**严禁剥离 `rope_scaling` 或切换 Dynamic YaRN**；`Qwen3.8-27B` 仅 `6.25%` 注意力头维度用 RoPE（`3.32%` 插值），全参 SFT 后 `<256K` 残余差异 `<0.5%` |
| **训练上下文与拼包长度** | **不切分硬训 `384K`（`MAX_LENGTH = 393,216`、`PACK_LEN = 393,216`，`94%` 填充 = `369.62K`/包）**；**2D 装箱守卫 `(tok <= 393216, img <= 80)`**；短轨（CAD / 2D / `Opus` `200K` 执行段）与 XHS 均按 `PACK_LEN=393216` 高效拼包并严格 `cu_seqlens` 文档隔离 | **彻底废止 `HCPF-Lite` 切分**（避免 `200K–384K` 因果泄漏）；`FlashAttention` + 48 层 `GatedDeltaNet` (`conv1d` + $S_t=0$) + 3D `mRoPE` 按文档边界重置；`start-full-32g-s3-v1` Step 1 已实测验证 `32×H100` 稳跑完整 `384K`（`peak_alloc=61.97 GiB`） |
| **多模态视觉分辨率** | 统一 `MAX_PIXELS = 401408`（约 `512` 视觉 token/张，≈ `768×512` 等效面积；极细特写可局部裁切而非硬撑 4K 全图） | 配合 **`(tok <= 393216, img <= 80)`** 装箱守卫与 `[8, 20, 20, 16]` 非对称切层锁死 `PP0` 显存安全垫（`~68 GiB`），同时让 Blender/Three.js 视口、CAD 6 视角与 2D 5 关键帧拼图看清全部几何细节 |
| **System 消息与工具协议** | **严格仅 `messages[0]` 为 `role="system"`**；严禁中途插入 `<total_tokens>` 或第二条 `role="system"`；**无顶层 `tools` 键**，各轨真实工具列表预渲染进 `messages[0]`，消息使用 `role="tool_call"` / `role="tool"` | 杜绝 `Qwen3.8` 模板中途 `system` 报错与异常分布，确保 7 条轨道在 PyArrow 层面 100% 逐 token 对齐 |
| **预装工具链与安全隔离** | **四合一纯代码离线沙盒**：`Blender 4.2.10 LTS (bpy)` + `Three.js r180` + `CadQuery 2.6.1 (OCCT)` + `Playwright / Chromium (SwiftShader)` + `ffmpeg / xvfb-run`；CAD AST 硬封禁 `bpy/bmesh/importStep`；2D 沙盒仅挂隔离 `web2d_node_modules`（`playwright-core` + 本地 `vendor/gsap/gsap.min.js`，硬封禁 `three/THREE/WebGLRenderer/webgl`）；**0 重复 `call_id`、0 孤立 `tool_result`、0 中途悬空调用** | 保持四轨共享同一 Claude Code 文件/终端读写肌肉记忆，同时在依赖、校验与产物层面实现 **0.0% 跨轨污染** |
| **思考链 `<think>` 与空 `<think>` 拆分** | **100% 保留活跃监督区内教师原生简短第一人称 `reasoning_content`**（`--enable_thinking true --preserve_thinking true`）；严禁改写成 Markdown 方案书腔；**Option 2 §0 #1 硬修法**：所有轨中 `loss=True` 且思考为空的 assistant 拆为两段——空思考 `{"loss": False, "loss_scale": 0.0}` + 正文/工具调用 `{"loss": True, "loss_scale": w_ch}`（并过 10 秒 CPU `Qwen3_8Template` 审计）；仅对 `compact_task` 的 `loss=False` 历史轮做空 `<think>` 瘦身（`384K P90 406K -> 244K`，`256K <= 125K`） | 防止自定义 `"loss_scale": w_ch` 静默绕过 `IgnoreEmptyThinkLossScale`，同时保持 `count('<think>') == assistant 轮数` 与 `qwen3_8` 模板逐字节兼容 |
| **统一 PyArrow Schema 与 Loss Weighting** | 统一 Schema：`{"id", "channel", "images", "messages": [{"role", "content", "loss", "loss_scale"}]}`（`channel ∈ {xhs_blender, xhs_threejs, cad_exec, anim2d_exec, compact_384k, compact_256k, swe_anchor}`，无顶层 `tools` 键）；**训练采用 `--calculate_per_token_loss true --is_binary_loss_scale false`**（有界样本权重 $w_i \in [0.55, 2.55]$，$\mathbb{E}_U[w_i]=1.00$；保留 `--is_binary_loss_scale true` 作 Raw `U%` 回退档）；**`validation.jsonl` 所有监督 token 强制 `loss_scale = 1.0`**；自产轨经 `logging_proxy_to_swift.py` 默认开启 5 规则轮级异常掩码（需加 `--keep-compact-tasks`） | 确保 `val_loss_{channel}` 汇报真实无偏 NLL（nats），并通过 bounded $w_i$ 避免长轨 `384K` 淹没短轨梯度 |
| **采样 / 评测沙盒与 `vLLM` 压缩水位** | **统一 `256K` 沙盒水位**（见 `run_realhard6.py`（本地附件未发布）、`xhs_v2_produce.py`（本地附件未发布））：`claude --bare --permission-mode dontAsk`，**不硬传 `--effort`**；**`AGENT_CONTEXT_WINDOW_TOKENS=262144`**、**`CLAUDE_CODE_AUTO_COMPACT_WINDOW=208000`**、**`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80`**、**`CLAUDE_CODE_MAX_OUTPUT_TOKENS=32768`**、**`MAX_TOOL_RESULT_TOKENS=16384`**（`208K+16.4K+4K+32.8K = 261.2K < 262,144`）；`xhs_v2_produce.py` `max_export_tokens=262144`、裁判 `max_tokens >= 12000`（**禁同家族自评**）；**所有压缩提示词严禁写死 `/384K` 或 `/256K` 绝对分母**；多卡 `vLLM`（`TP >= 2`）保留同一 `Static YaRN 1.5×` `config.json` 并设 **`--max-model-len 327680`**（或 `393216`）+ **`--enable-prefix-caching --mamba-cache-mode align`**；默认 `--max-turns 120` | 实现 **`384K` 不切分硬训 + `256K`（`208K / 80% / 16384`）高信噪比沙盒** 与 `vLLM 327680` 突发防爆垫的完全解耦与零损对齐 |
| **XHS `384K` Phase-0 零丢弃清洗（废止 `HCPF-Lite`）** | **严禁 `HCPF-Lite` 切分、严禁半路硬切无 EOS `prefix`、严禁旧 `--window-chars`**；完整保留小红书原生闭环（`main + compact_before + compact_task + compact_recovery`），执行 **Phase-0 CPU 约 1 小时零丢弃清洗**：① 对 `7` 张 `AR >= 200` 异常图做 letterbox pad（救回 `12` 条段）；② `384K compact_task` 历史空 `<think>` 瘦身（`P90 406K -> 244K`，挽救 `37.8%` 压缩样本）；③ 修正 `"-main-agent-"` -> `"-agent-"` 过滤漏网 `8` 条子代理段并去重 `retry02`；④ 对 `~335` 条（`1.93%`）`393K–402K` 轻微超限段仅裁剪远端 `<10K` 无关 `loss=False` 刷屏日志（**`100%` 不切分存活**） | 100% 消除 `HCPF-Lite` 切分带来的 `200K–384K` 因果泄漏，完整保留 `compact_before` 与 `compact_task` 压缩交接能力 |
| **训练拓扑、优化器与 Stage 1–2 配比** | **严格 `1 Epoch` / 阶段**；`--freeze_vit false --freeze_aligner false`；**`32×H100` 唯一锁定拓扑**：`TP=4, PP=4, CP=2, DP=1, SP=true`，非对称层切分 **`[8, 20, 20, 16]`**，`recompute=full/uniform/1`、`vit_gradient_checkpointing=true`、`AdamW (beta=0.9/0.95, wd=0.1, clip=1.0)`、FP32 `main_grad`、`optimizer_cpu_offload=true`、`LM_HEAD_LOSS_CHUNK_SIZE=16384`、`(tok <= 393216, img <= 80)` 守卫；**禁用**：`FP8 / tp_comm_overlap / VPP=2 / recompute_num_layers=2 / Muon`。<br>• **Stage 1**（`384K` XHS，`GBS=48`，留出 `20% = 1,063` 任务给 Stage 2）：**`64.2%` Blender + `34.8%` Three.js + `1.0%` `compact_384k`**（含 Step 50/100 SWE 哨兵）；<br>• **Stage 2**（`Standard 600+600`，`GBS=32`, `lr=2.45e-6`, `vit_lr=4.90e-7`）：**`21.9%` Blender + `12.2%` Three.js + `22.8%` CAD + `22.7%` 2D + `2.5%` Compact + `17.9%` SWE** | 开训 Stage 2 前必过 `G0` 多文档 `cu_seqlens` 隔离单测（`max_abs_diff < 2e-2`, loss 差 `< 5e-3`），每 `20` 步在 `validation.jsonl` (`loss_scale=1.0`) 监控防过拟合与遗忘熔断 |
| **交付契约元数据** | 每条入库样本顶层标注 `channel` / `track`、`task_key`、`segment_type`、`delivery_contract`（`needs_http_server / bundle_mode / allow_network / motion_type` 四字段） | 评测与合训账本可按轨精准追踪，防止跨轨契约混染 |

---

## 二、三轨对齐映射表（如何保证 Blender / Three.js / CAD / 2D 无缝融入同一模型）

| 轨道 | 运行与交付契约 | 分类树与工厂流程（统一复刻 XHS） | 典型单条长度 & 打包方式 |
|---|---|---|---|
| **Track 1a · 3D 纯代码主线（Blender `bpy` + Three.js，主力）** | **Blender 4.2.10 LTS**（`bpy` 纯 Python 代码 → `output/{scene.blend, scene.glb, build_scene.py, README.md, final.png}`，Cycles/EEVEE 静帧/视频）+ **XHS Three.js 原生栈**（`Three.js r180 + vendor + importmap + local http.server + OrbitControls + output/final.png`） | 直接吃满 XHS 401 全分片原汁原味数据（Blender + Three.js 全轨 + `main / compact_before / compact_task / compact_recovery` 全段 + Phase-0 零丢弃清洗，**严禁 `HCPF-Lite` 切分**） | **`≤384K` 不切分（`MAX_LENGTH=393,216`, `PACK_LEN=393,216`, `Static YaRN 1.5×`, `(tok <= 393216, img <= 80)`, `MAX_PIXELS=401408`）** |
| **Track 1b · 3D 离线机械动画（轻量保留）** | `esbuild` 单文件内联 + `window.renderAt(t)` | 已有 Pool 1/5b + Astra 联检 `Rubric + P07 + Best-of-2` | `40K–172K`（打包入 `PACK_LEN=393,216`，同 `Static YaRN 1.5×`、同工具、显式契约隔离） |
| **Track 2 · CAD 建模打印（高难单件 + 多零件装配）** | `CadQuery` 参数化工程（高难单件 `>=25` 面 / `>=4` OCCT 操作；2–6 件装配拆 `params.py + parts/*.py + assembly.py + export.py`）→ **`STEP` + `3MF` + `STL/GLB`** + 6 视角/剖视图/爆炸图（详规见 [THREE-TRACK-DELIVERABLE-SPEC.md](THREE-TRACK-DELIVERABLE-SPEC.md)） | [cadquery_tree_v2_0.json](../configs/taxonomies/cadquery_tree_v2_0.json)（`XY 35% / XZ 35% / YZ 30%`）+ `P07` + 五层几何/防干涉金字塔（含 `cad_inspect.py` `--probe` 硬拦截与 AST 禁 `bpy`）+ 跨族 `Best-of-2`（`80–85% kimi + 15–20% opus`）；`IterCAD_Data` **仅用 shards `1–4`**（Shard 5 `IterCAD-Draw_1k` OOD 隔离） | `≤256K` 沙盒生成（`208K / 80% / 16384`），训练端打包入 **`PACK_LEN=393,216`**（`--is_binary_loss_scale false` 权重 $w_i$） |
| **Track 3 · 2D Web 多文件交互动画（主）** | **离线多文件 Web 交互动画工程**（`index.html + css/styles.css + src/*.js + assets/*.svg + vendor/gsap/gsap.min.js`，Canvas 2D + SVG + GSAP，本地 `http.server`，隔离 `web2d_node_modules` 无 `three`）+ `window.renderAt(t)` + `window.__SCENE_READY__` + `window.__2D_STATE__` + `#play/#pause/#scrub` + **一键 Playwright/FFmpeg 导 MP4** | [anim2d_tree_v2_0.json](../configs/taxonomies/anim2d_tree_v2_0.json) + `P07` + **`check_2d_v3.mjs`**（删 `data-allow-clip`/`data-allow-overlap`、`MAD>=1.5`、`SSIM<=0.985`、`stageInfo.hasSvg`、`<=10%` 双视口重叠、封禁 `three/WebGL`）+ 5 关键帧拼图 + `D03` 动态数据可视化放行（严禁静态 KPI/移动点地图） | `≤256K` 沙盒生成（`208K / 80% / 16384`），训练端打包入 **`PACK_LEN=393,216`**（`--is_binary_loss_scale false` 权重 $w_i$） |

---

## 三、最新统一 `256K + Blender` 沙盒速查（`realhard6` / Option 2 实装基准）

参考实现：`build_realhard6_tasks.py`（本地附件未发布）、`run_realhard6.py`（本地附件未发布）、`verify_realhard6.py`（本地附件未发布）。

1. **环境变量与压缩水位（Option 2 唯一锁定）**：
   - `AGENT_CONTEXT_WINDOW_TOKENS=262144`
   - `CLAUDE_CODE_AUTO_COMPACT_WINDOW=208000`
   - `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80`
   - `CLAUDE_CODE_MAX_OUTPUT_TOKENS=32768`、`LLM_MAX_OUTPUT_TOKENS=32768`
   - `MAX_TOOL_RESULT_TOKENS=16384`（`208K + 16.4K + 4K + 32.8K = 261.2K < 262,144`）
   - `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`、清除全部 `*_proxy`
2. **预装二进制与隔离路径**：
   - Blender：`Blender 4.2.10 LTS`（`${WORKSPACE}/tools/blender-4.2.10/blender`，调用 `blender --background --factory-startup --python-exit-code 1 --python <script.py>`）
   - Three.js：`Three.js r180` + addons 本地 `./vendor/three/` + Node v20 + `playwright-core`（SwiftShader 无头 WebGL）
   - 2D Web：隔离 `web2d_node_modules`（仅含 `playwright-core`，无 `three`）+ 本地 `vendor/gsap/gsap.min.js`
   - CAD：CadQuery 2.6.1 / OCCT / `numpy` / `scipy` / `Pillow` / `trimesh`
3. **Blender 必交四件套与无头验收**：
   - `./output/scene.blend` + `./output/scene.glb` + 可重建 `.py` 脚本与 `README.md` + 重开 `scene.blend` 渲染的 `1536×1024` `./output/final.png`；
   - 确定性验收回读 `scene.blend` 核验 `total_objects / mesh_objects / total_vertices / total_polygons / materials / lights / cameras / collections`。

---

## 四、落盘前必过 4 道硬核验（三轨通用准入闸）

1. **零宿主机路径泄漏**：扫描所有 `messages` 与 `tool_calls`，`0` 处命中 `/mnt/disk1`、`${USER_HOME}`、`${REFERENCE_DATA}`、`/tmp/xhsv2-ws`（图像路径仅存在于顶层 `images[]`）；
2. **零任务泄漏划分**：`train / val / test` 严格按 `task_key` / 祖先家族隔离，同任务所有分段绝不跨集；
3. **`<image>` 占位符、`<think>` 拆分与 PyArrow Schema 精确对齐**：无顶层 `tools` 键（`channel ∈ {xhs_blender, xhs_threejs, cad_exec, anim2d_exec, compact_384k, compact_256k, swe_anchor}`）；每条记录 `messages` 中 `<image>` 出现次数严格等于 `len(images)`，每张图文件存在可读；`count('<think>') == assistant 轮数`，且空 `<think>` 已拆为 `{"loss": False, "loss_scale": 0.0}` + 正文 `{"loss": True, "loss_scale": w_ch}`（`validation.jsonl` 强制 `loss_scale=1.0`）；
4. **`ms-swift` 逐 Token Labels 与长度/图片数上限审计**：训练启动前必跑 10 秒 CPU `Qwen3_8Template` 编码抽检，确认训练打包样本满足 `(tok <= 393216, img <= 80)`（`256K` 造数/评测单段 `≤ 262,144`）、`0` 条被 `delete` 静默丢弃、`"loss": False`（含空 `<think>`）轮次 `labels == -100`、紧邻纠错轮与终轮 EOS 均有有效监督 `labels != -100`。
