# XHS 对齐统一训练数据与上下文标准规范（3D 展示 · CAD 打印 · 2D 动画三轨共用）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> 生效日期：2026-11-27（已按 `decisions.md`（本地附件未发布） `2026-11-27` 最新拍板与 [`HCPF-Lite 256K` 联合审定结论](../../research/xhs-384k-to-200k-data-adaptation-20261127/joint-consolidation.md) 纠偏更新：正式纳入 **Blender 4.2.10 LTS (`bpy`)** 纯代码主线，训练与沙盒上下文统一锁定为基座原生满血 **`256K`（`max_length = 262,144` tokens，原生 `262K` RoPE 关 YaRN + `240K / 90%` 自动压缩）**，小红书 401 全分片坚持原汁原味保留 `compact_task` 与原始 `loss_mask`，放开 `freeze_vit=false, freeze_aligner=false`）  
> 对齐来源：`decisions.md`（本地附件未发布）（`2026-11-27` 条目）· [`HCPF-Lite 256K` 联合定案](../../research/xhs-384k-to-200k-data-adaptation-20261127/joint-consolidation.md) · [3DCodeFactory 论文与源码](../../research/arxiv-2611.28783/README.md) · [三轨顶级交付规格](THREE-TRACK-DELIVERABLE-SPEC.md)  
> 设计目标：**确保 3D（Blender + Three.js）、CAD 打印、2D 动画在多文件工程交付、多轮模板、256K 原生上下文与压缩水位、图片分辨率、预装工具链、工具协议、思考链与轮级掩码上 100% 统一标准，消除训练/评测/合训时的协议断层与跨轨干扰。**

---

## 一、统一核心规格总表（所有赛道强制对齐）

| 规范维度 | 统一标准值（`2026-11-27` 最新对齐口径） | 工程原因与防坑红线 |
|---|---|---|
| **学生基座与模板** | `Qwen3.8-27B` BF16（**原生 `262,144` RoPE 基座，关闭 YaRN `1.5×`**）；`--model_type qwen3_5 --template qwen3_8 --template_backend swift`（**不传 `reasoning_effort`，走原生默认 `xhigh`**） | 经 `chat_template.original.jinja:47`（`default('xhigh')`）与 `token-decode-audit.json` 逐 token 核实：**训练不传参数时 `ms-swift` `qwen3_8` 默认即为 `xhigh`**；推理端同样不传（或用 `chat_template.qwen38-compat.jinja`（本地附件未发布） 默认 `xhigh`）即 100% 逐 token 对齐，切勿在评测端人为改成 `medium` |
| **上下文与位置编码** | **统一对齐原生满血 `256K`（`max_length = 262,144` tokens，`rope_type = "default"`，不开 YaRN）**；单段安全上限 `256,000`；短轨（CAD / 2D）通过 `binpack@262144` 高效拼包 | 不搞奇怪的非标 `200K` 数字，直接吃满 `Qwen3.8-27B` 预训练原生 `262,144` 上限；既免除 `384K YaRN` 的显存溢出与局部位置精度损耗，又使每条 `384K` 段最多只需一刀拆为 **2 个子段** |
| **多模态视觉分辨率** | 统一 `MAX_PIXELS = 401408`（约 `512` 视觉 token/张，≈ `768×512` 等效面积；极细特写可局部裁切而非硬撑 4K 全图） | 配合 `256K` 窗口将单包图片数压在合理水位（避免 `384K` 单包 148 图在 `PP0` OOM），同时让 Blender/Three.js 视口、CAD 四视图与 2D 拼图看清全部几何细节 |
| **System 消息纪律** | **严格仅 `messages[0]` 为 `role="system"`**；严禁中途插入 `<total_tokens>` 或第二条 `role="system"`（必要环境提醒折入 `user/tool` 的 `<system-reminder>`） | 杜绝 `Qwen3.8` 模板中途 `system` 报错与异常分布 |
| **预装工具链与工具协议** | **四合一纯代码离线沙盒**：`Blender 4.2.10 LTS (bpy)` + `Three.js r180` + `CadQuery 2.6.1 (OCCT)` + `Playwright / Chromium (SwiftShader)` + `ffmpeg / xvfb-run`；统一 Claude Code 工具 schema（`Read / Write / Edit / Bash / Glob / Grep`）；**0 重复 `call_id`、0 孤立 `tool_result`、0 中途悬空调用** | 让 Blender / Three.js / CAD / 2D 共享同一套沙盒运行环境与文件读写肌肉记忆，避免跨轨工具断层与非法调用 |
| **思考链 `<think>`** | **100% 保留活跃监督区内教师原生简短第一人称 `reasoning_content`**（`--enable_thinking true --preserve_thinking true`）；严禁改写成 Markdown 方案书腔；`HCPF-Lite` 远端历史轮剥离时必须替换为空块 `<think>\n\n</think>` | 避免离策略 NLL 爆炸，同时保持 `count('<think>') == assistant 轮数` 与 `qwen3_8` 模板逐字节兼容 |
| **轮级异常 Loss Mask** | **小红书外部 401 全分片复刻基线**：100% 沿用 HF 原数据的 `loss_mask`（仅做极性取反 `loss_mask: true → "loss": False`，零二次手改），配全局有效 Token 归一化二值等权 Loss（`--calculate_per_token_loss true --loss_scale default --is_binary_loss_scale true`）；**我方自产轨（CAD / 2D / 3D 连续动画）**：由 `logging_proxy_to_swift.py` 默认开启 5 规则轮级异常掩码（掩坏轮、保纠错轮） | 复刻基线坚持“最小侵入、原汁原味”；全局 Token 归一化确保拆成 `≤256K` 子段后，每条有效可训 token 严格只计 1 次梯度、零段数膨胀偏置 |
| **采样 / 评测沙盒与压缩水位** | **统一 `256K` 沙盒标准**（见 `run_realhard6.py`（本地附件未发布））：`claude --bare --permission-mode dontAsk`，**不硬传 `--effort`**；`AGENT_CONTEXT_WINDOW_TOKENS=262144`；默认 `32K` 输出（`32768`）配 `CLAUDE_CODE_AUTO_COMPACT_WINDOW=220000`、`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=85`（严守 `compact + max_tokens < 262,144`；若放宽 `64K` 输出则压缩水位下调至 `190000`；外部 `claude-opus-5-5` 因官方接口 200K 上限由 Claude Code `Math.min` 自动钳位）；本地 27B vLLM 端 `--max-model-len 262144`（**零代理中段改写以保护 Prefix Caching**）；默认安全护栏 `--max-turns 120`（允许 `--continue` 续段，废除 `≤12–30` 轮紧箍咒） | 实现训练（`≤256K`）与在线推理（`220K / 85%` 自动压缩 + `32K` 输出余量）**1:1 训推同构**，杜绝 `input + max_tokens > 262,144` 溢出，同时在原生 `256K` 窗口内支持 `1M+` 累计 Token 的多轮深度视觉精修 |
| **分段与压缩闭环纪律** | **严禁只筛 `≤256K`、严禁半路硬切无 EOS `prefix` 切片、严禁无重叠硬切窗（旧 `--window-chars`）**；完整保留小红书原生压缩闭环（`main + compact_before + compact_task + compact_recovery`），按 **`HCPF-Lite + ct_diet`** 适配至 `≤256K`（单段安全上限 `256,000`）：① 首轮 `System + USER REQUEST + I_ref` 永久钉死；② 远端历史按 `≤12K` 纯原生截断脊柱折叠（`0` 自造 `[archived]` 等 OOD 字符串，远端旧视口图直接移除）；③ 近端 `max(12 轮, ≤32K)` 逐字完整滑窗（`loss=False`）；④ 干净相位边界切分的活跃监督区（`100%` 原样，每条 384K 段最多拆 2 子段）；⑤ `compact_task` 经 `ct_diet` 瘦身至 `≤256K`（`100%` 存活）后分层混入 `20%–25%` | 100% 保留全部有效监督 Token `U` 与 `compact_before` 从零建仓段，消除孤立状态幻觉与 OOD 占位符，并原生保留撞窗时的 9 节 `<summary>` 压缩交接能力 |
| **训练配置与视觉模块** | **严格 `1 Epoch`**；多模态训练**全放开视觉塔与对齐层（`--freeze_vit false --freeze_aligner false`）**；4 机 `32×80GB` 首发拓扑 **`TP=2, PP=4, CP=2, DP=2`**（`256K = 262,144` 原生 RoPE、`S_local = 131,072`、`lr=1e-5 / GBS=48`、修复 `gdn_v3_plugin.py` 全参分块 LM-Head CE 且保持 FP32 `main_grad`）；面向 ModelForge 上线的产品合训版再按五本账（`U`）混入 `10–15%` 通用多域回放 | 在原生满血 `256K` 窗口下同时兑现 `freeze_vit=false, freeze_aligner=false`、显存安全余量与原生 RoPE 精度，且与产品防遗忘版显式隔离 |
| **交付契约元数据** | 每条入库样本顶层标注 `track`、`task_key`、`segment_type`、`delivery_contract`（`needs_http_server / bundle_mode / allow_network / motion_type` 四字段） | 评测与合训账本可按轨精准追踪，防止跨轨契约混染 |

---

## 二、三轨对齐映射表（如何保证 Blender / Three.js / CAD / 2D 无缝融入同一模型）

| 轨道 | 运行与交付契约 | 分类树与工厂流程（统一复刻 XHS） | 典型单条长度 & 打包方式 |
|---|---|---|---|
| **Track 1a · 3D 纯代码主线（Blender `bpy` + Three.js，主力）** | **Blender 4.2.10 LTS**（`bpy` 纯 Python 代码 → `output/{scene.blend, scene.glb, build_scene.py, README.md, final.png}`，Cycles/EEVEE 静帧/视频）+ **XHS Three.js 原生栈**（`Three.js r180 + vendor + importmap + local http.server + OrbitControls + output/final.png`） | 直接吃满 XHS 401 全分片原汁原味数据（Blender + Three.js 全轨 + `main / compact_before / compact_task / compact_recovery` 全段 + 原始 `loss_mask`），经 **`HCPF-Lite + ct_diet`** 无损适配至 `≤256K` | **`≤256K`（`max_length=262,144`，原生 `262K` RoPE，无 YaRN，`MAX_PIXELS=401408`）** |
| **Track 1b · 3D 离线机械动画（轻量保留）** | `esbuild` 单文件内联 + `window.renderAt(t)` | 已有 Pool 1/5b + Astra 联检 `Rubric + P07 + Best-of-2` | `40K–172K`（天然落入 `256K`，同模板、同工具、显式契约隔离） |
| **Track 2 · CAD 建模打印（高难单件 + 多零件装配）** | `CadQuery` 参数化工程（复杂单件 `src/model.py`；2–6 件装配拆 `params.py + parts/*.py + assembly.py + export.py`）→ **`STEP` + `3MF` + `STL/GLB`** + 4 视角/剖视图（详规见 [THREE-TRACK-DELIVERABLE-SPEC.md](THREE-TRACK-DELIVERABLE-SPEC.md)） | [cadquery_tree_v2_0.json](../configs/taxonomies/cadquery_tree_v2_0.json)（高难长程主力：对齐小红书 5 大类 × 4 接地气词条 = 20 词条；兼容 [v1.1](../configs/taxonomies/cadquery_tree_v1_1.json)）+ `P07` + 五层几何/防干涉金字塔 + 阶梯 Best-of-2 + 轮级 mask；高复杂单件锚点见 [2026 样本调研](../../research/cad-2d-sample-study-and-taxonomy-v2-20261126/README.md) | `20K–180K`（天然落入 `256K`，经 `binpack@262144` 与 3D 子段同锅对齐，五本账按 `U` 控比） |
| **Track 3 · 2D Web 多文件交互动画（主）** | **离线多文件 Web 交互动画工程**（`index.html + css/styles.css + src/*.js + assets/*.svg + vendor/gsap.min.js`，Canvas 2D + SVG + GSAP，本地 `http.server`）+ `window.renderAt(t)` + `#play/#pause/#scrub` + **一键 Playwright/FFmpeg 导 MP4**（详规见 [THREE-TRACK-DELIVERABLE-SPEC.md](THREE-TRACK-DELIVERABLE-SPEC.md)；轻量单文件仅保留兼容） | [anim2d_tree_v2_0.json](../configs/taxonomies/anim2d_tree_v2_0.json)（高难长程主力：对齐小红书 5 大类 × 4 接地气词条 = 20 词条；兼容 [v1.1](../configs/taxonomies/anim2d_tree_v1_1.json)）+ `P07` + 对标 `AnimWeb-Bench`/`MotionGraphicsBench` 升级多文件时空确定性硬检 + 阶梯 Best-of-2 + 轮级 mask（**放弃简单单轮堆量，不走 Manim**） | `30K–220K`（天然落入 `256K`，经 `binpack@262144` 同锅对齐，五本账按 `U` 控比） |

---

## 三、最新统一 `256K + Blender` 沙盒速查（`realhard6` 实装基准）

参考实现：`build_realhard6_tasks.py`（本地附件未发布）、`run_realhard6.py`（本地附件未发布）、`verify_realhard6.py`（本地附件未发布）。

1. **环境变量与压缩水位**：
   - `AGENT_CONTEXT_WINDOW_TOKENS=262144`
   - `CLAUDE_CODE_AUTO_COMPACT_WINDOW=220000`（配 `32K` 输出；若 `64K` 输出则设 `190000`）
   - `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=85`
   - `CLAUDE_CODE_MAX_OUTPUT_TOKENS=32768`、`LLM_MAX_OUTPUT_TOKENS=32768`
   - `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`、清除全部 `*_proxy`
2. **预装二进制与隔离路径**：
   - Blender：`Blender 4.2.10 LTS`（`${WORKSPACE}/tools/blender-4.2.10/blender`，调用 `blender --background --factory-startup --python-exit-code 1 --python <script.py>`）
   - Three.js：`Three.js r180` + addons 本地 `./vendor/three/` + Node v20 + `playwright-core`（SwiftShader 无头 WebGL）
   - CAD：CadQuery 2.6.1 / OCCT / `numpy` / `scipy` / `Pillow` / `trimesh`
3. **Blender 必交四件套与无头验收**：
   - `./output/scene.blend` + `./output/scene.glb` + 可重建 `.py` 脚本与 `README.md` + 重开 `scene.blend` 渲染的 `1536×1024` `./output/final.png`；
   - 确定性验收回读 `scene.blend` 核验 `total_objects / mesh_objects / total_vertices / total_polygons / materials / lights / cameras / collections`。

---

## 四、落盘前必过 4 道硬核验（三轨通用准入闸）

1. **零宿主机路径泄漏**：扫描所有 `messages` 与 `tool_calls`，`0` 处命中 `${WORKSPACE_DISK}`、`${USER_HOME}`、`${SHARED_DATA}`（图像路径仅存在于顶层 `images[]`）；
2. **零任务泄漏划分**：`train / val / test` 严格按 `task_key` / 祖先家族隔离，同任务所有分段绝不跨集；
3. **`<image>` 占位符与 `<think>` 标签精确对齐**：每条记录 `messages` 中 `<image>` 出现次数严格等于 `len(images)`，每张图文件在共享盘存在可读，且 `count('<think>') == assistant 轮数`（远端剥离轮用 `<think>\n\n</think>`）；
4. **`ms-swift` 逐 Token Labels 与长度上限审计**：训练启动前必跑 10 秒 CPU 模板编码抽检，确认所有样本真实分词总长 `≤ 262,144`、`0` 条被 `delete` 静默丢弃、`"loss": False` 轮次 `labels == -100`、紧邻纠错轮与终轮 EOS 均有有效监督 `labels != -100`。
