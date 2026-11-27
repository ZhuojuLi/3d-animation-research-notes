# 三轨顶级交付产物规格与高难长程造数指南（v2.1）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> **生效状态**：工程落盘规格书（`2026-11-27` 按 `decisions.md`（本地附件未发布） 最新拍板更新：**正式纳入 Blender 4.2.10 LTS `bpy` 纯代码主线**，训练与沙盒上下文统一对齐基座**原生 `256K`（`262,144` tokens，关闭 YaRN，不再设非标 `200K` 窗口）**）  
> **目标基座**：Dense `Qwen3.8-27B`（BF16 **原生 `262,144` [256K] RoPE 基座、关闭 YaRN**，4 机 `32×80GB` `ms-swift 4.5.2` 全参 SFT，`max_length=262,144` + `MAX_PIXELS=401408` + `freeze_vit=false, freeze_aligner=false`）  
> **配套规范**：[XHS 对齐统一训练数据与上下文标准](XHS-UNIFIED-SFT-STANDARD.md) · [全链路统一参数与避坑规范](STANDARD-PARAMS.md) · [`HCPF-Lite` 拆段方法参考](../../research/xhs-384k-to-200k-data-adaptation-20261127/joint-consolidation.md) · [2026 样本学习与 v2.0 高难分类树报告](../../research/cad-2d-sample-study-and-taxonomy-v2-20261126/README.md) · [Anim2D-Tree v2.0](../configs/taxonomies/anim2d_tree_v2_0.json) · [CadQuery-Tree v2.0](../configs/taxonomies/cadquery_tree_v2_0.json) · [三轨数据工厂联合审核总方案](../../research/three-track-data-factory-strategy-20261126/README.md) · [小红书长程策略复盘](../reports/oneshot-vs-longhorizon-3dcodefactory-20261126/REPORT.md)

---

## 一、核心原则：放弃单轮玩具，三轨统一面向“顶级长程多文件工程”

经 [3DCodeFactory（2026.11）](../../research/arxiv-2611.28783/README.md)、[3DCodeVerse（2026.10）](../../research/arxiv-2610.22341/README.md) 与我方 Round 2 消融实证，**`Qwen3.8-27B` 基座已具备较强的单轮代码与简单单文件生成能力**；继续堆砌单轮脚本或几十行的简单玩具产物，对真实能力几乎无提升，反而会破坏多轮自检与停机节奏。

本规格确立三条铁律：
1. **三轨共享同一套核心元能力**：**多文件模块化架构拆分 → 沙盒执行与确定性硬检 → 视觉拼图深度反思 → 外科手术式局部 `Edit` 精修 → 达标自然 EOS 收尾**。
2. **以 2026 年主流复杂交付产物倒推训练数据**：彻底打破“只会交付单个大 HTML 文件 / 单个简单 `.py`”的旧惯性——对本地 33 条小红书 Three.js 轨迹的实扫已证实，**90.9%（30/33）为 2–10 模块的多文件前端工程，0% 为单文件内联 HTML**。
3. **宁缺毋滥，只为高难长程产物付费**：2D 与 CAD 均不做低难度堆量，每轨先精打 **150–300 条**真正达到高审美/工业复杂度的长程多轮轨迹（50–150 轮深度视觉精修），把工程能力与审美品位真正蒸馏进 27B 学生权重。

---

## 二、三轨顶级交付产物规格总表

所有任务在 `manifest`、评测集与入训元数据中均以统一契约字段登记（`needs_http_server`、`bundle_mode`、`allow_network`、`motion_type`、`export_formats`）：

| 维度 | Track 1 · 3D 纯代码建模与交互场景（Blender + Three.js 主力） | Track 2 · 2D Web 多文件交互动画（主力） | Track 3 · CAD 参数化建模与 3D 打印（主力） |
| --- | --- | --- | --- |
| **主交付形态** | ① **Blender `bpy` 纯 Python 工程**（高精度 3D 建模 / Cycles·EEVEE 静帧·视频 / `.blend + .glb` 资产）；<br>② **Three.js 离线多文件 ES6 Web 工程**（浏览器实时交互 3D 场景）<br>*轻量保留：`esbuild` 单文件物理机械动画子能力* | **离线多文件 Web 交互动画工程**<br>+ **一键 Playwright/FFmpeg 导出 MP4/WebM** | **参数化多模块 Python 工程 + 制造交换产物包**<br>（单零件或 2–6 件功能装配体） |
| **标准目录结构** | **Blender**：`output/{scene.blend, scene.glb, build_scene.py, assets/, README.md, final.png}`<br>**Three.js**：`output/{index.html, styles.css, src/*.js, vendor/three/, final.png}` | `output/`<br>`├── index.html`<br>`├── css/styles.css`<br>`├── src/{main,scene,motion,renderer,ui,data}.js`<br>`├── assets/*.svg`（可选）<br>`└── vendor/{gsap,pixi,...}`（按需本地化） | `output/`<br>`├── src/{params.py, parts/*.py, assembly.py, export.py}`<br>*（复杂单件可为 `src/model.py`）*<br>`├── exports/{model.step, model.3mf, model.stl, model.glb}`<br>`└── views/{views_grid.png, section_view.png, exploded_view.png}` |
| **核心引擎与库** | **`Blender 4.2.10 LTS`**（`bpy / bmesh / mathutils / numpy`，无头 CLI `--background --factory-startup --python-exit-code 1`）+ **`Three.js r180`**（`importmap + OrbitControls` + 本地 `http.server` + SwiftShader Playwright） | **HTML5 Canvas 2D + Inline/External SVG + CSS/GSAP**（离线本地库，0 CDN；**不走 Manim**） | **`CadQuery 2.6.1`**（OCCT 内核，强参数化 `DEFAULT_PARAMS`；`OpenSCAD = N/A`） |
| **必含控制 / 导出契约** | **Blender**：自包含 `scene.blend`（有序 Collection / 命名对象 / 打包本地贴图）、`scene.glb`、可复现 `.py` 脚本，且 `1536×1024` `final.png` 必须由**重新打开 `scene.blend`** 渲染；<br>**Three.js**：本地 HTTP 零报错加载、多相机/视角可交互、0–3 清晰控件与 `1536×1024` `final.png`（动画子类另暴露 `window.renderAt(t)` 与 `__3D_STATE__`） | 必须暴露：`window.__SCENE_READY__ = true`、`window.renderAt(seconds)`、`window.__2D_STATE__`、`#play/#pause/#scrub` 与场景/参数交互；**凭 `renderAt(t)` 可 1 条命令无损录出 30/60fps MP4** | 必须暴露参数表 `DEFAULT_PARAMS` 且改参几何联动；同时导出 **`STEP`（工业 CAD 交换）+ `3MF`（2026 3D 打印主流多体格式）+ `STL`（向后兼容）+ `GLB`** |
| **网络与安全红线** | `allow_network = false`；0 外部 CDN / 在线素材下载；0 宿主机路径泄漏 | `allow_network = false`；0 外部 CDN/外链字体；0 宿主机路径泄漏 | `allow_network = false`；AST 禁网络/子进程/越界 IO；0 宿主机路径泄漏 |
| **典型目标复杂度（砍掉简单题）** | 中位 1,600–6,000 行 JS / Python (`bpy`)，多层级建筑/器物/光影/PBR 材质/着色器/复杂曲面与交互场景 | 对标 `AnimWeb-Bench`（2026.11）与 `MotionGraphicsBench`（2026.11）：多图层复合时间轴动效、叙事长页/交互科普/数据可视化/商业 SVG 精准动效，典型 800–3,000+ 行模块化代码 | ① 高复杂单件（**15–45+ B-rep 面**、多平面切换/抽壳/倒角/阵列/工程图复刻/缺陷返修）；<br>② **2–6 件功能装配体**（齿轮/铰链/卡扣壳体/导轨滑块/风道盒，含显式配合间隙） |
| **确定性硬验 + 视觉精修双闸** | **Blender**：无头重开 `scene.blend` 审计对象/网格/顶点数/面数/材质/灯光/相机/Collection + `scene.glb` & `final.png` 回验（见 `verify_realhard6.py`（本地附件未发布））；<br>**Three.js**：零控制台报错 + 零外链请求 + 多视角/特写渲染 + 纯 WebGL 帧差防假动（动画类）+ 五维盲评高分闸 | ① 确定性时空硬检（去 HUD 纯主体帧差、逆序 `renderAt(t)` 逐像素一致、周期接缝位置+速度连续、多分辨率 0 文字重叠/裁切、SVG/Canvas 轨迹与事件断言）；<br>② 多关键帧 + 交互前后 Contact Sheet 视觉精修 + 五维美学盲评高分闸 | **五层几何金字塔**：① AST 沙盒 + 四格式独立回读；② 水密 2-流形 & 连通体数匹配；③ 包络/体积/孔轴探针/参数回归差分/真值 `STEP` Voxel IoU；④ **多体零非法干涉（两两布尔交集体积 ≤ 容差）与配合间隙探针**；⑤ `flatShading + Z_range` 4 视角 + 剖视图/爆炸图审图 |
| **不越界声明** | 静态展示类不冒充连续刚体物理动画；Blender 仅限纯 Python `bpy` 程序化建模渲染，不混入 Tripo/Meshy 等神经网络黑盒网格生成 | 不与像素扩散视频模型拼写实人物拍片；不声称支持在线外链 API | 不做切片机 G-code、实物打印成功率、材料力学强度或工业 GD&T 公差认证；有机雕塑/手办打印单标 `unverified` |

---

## 三、三轨长程采集油门与训练数据一致性约束

严格衔接 [XHS-UNIFIED-SFT-STANDARD.md](XHS-UNIFIED-SFT-STANDARD.md) 与小红书 vs 我方 DeepSeek 实测复盘，所有自产高难长程轨迹必须遵守以下 6 条采集规范：

1. **统一原生 `256K` 窗口、自动压缩与轮数护栏（默认教师 `kimi-k3.1-pro` / 对照 `claude-opus-5-5`）**：使用 `claude --bare`（不传 `--tools` / `--effort`）+ 隔离工作区；沙盒统一设定 `AGENT_CONTEXT_WINDOW_TOKENS=262144`（默认 `32K` 输出配 `CLAUDE_CODE_MAX_OUTPUT_TOKENS=32768`、`CLAUDE_CODE_AUTO_COMPACT_WINDOW=220000`、`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=85`；若放宽 `64K` 输出则压缩水位下调至 `190000` 保证 `< 262,144 - 65,536`），**废除 `≤12–30` 轮紧箍咒**，仅设防死循环安全护栏（如 `--max-turns 120` 并支持自动 `--continue`），允许教师在原生 `256K` 物理窗口内通过自动压缩无缝完成“搭建 → 渲染看图 → 局部 `Edit` 精修”长程闭环。
2. **原生思考链 0 改写**：完整保留教师模型（`kimi-k3.1-pro` 或同级原生推理教师）第一人称 `<think>`，严禁二次改写为 Markdown 报告腔；仅通过 5 规则轮级异常掩码（`tool_execution_error`、`protocol_leakage`、`repetitive_reasoning_loop`、`duplicate_tool_target`、`abnormal_ending`）在 `ms-swift` 中对坏轮置 `"loss": False`，完整保留紧邻的纠错轮与终轮 EOS。
3. **强制多文件模块化 + 小步 `Edit` 习惯**：提示词与验收明确鼓励按职责拆分模块文件（前端 `src/*.js` / Blender 模块脚本 / CAD `parts/*.py`），在首轮搭建后通过小步局部 `Edit` 做多轮视觉微调，避免把 3,000 行代码反复整块 `Write` 重写。
4. **多模态载荷有界（Contact Sheet 拼图纪律）**：每轮视觉自检必须将 4–6 个视角/关键帧/交互态拼成单张 Contact Sheet，统一以 `MAX_PIXELS = 401408`（约 512 视觉 token/张）入模，控制单段看图次数在 **8–16 次**（兼顾视觉细节与上下文效率，确保每段流畅落入原生 `≤256K` 窗口并在压缩水位前自然收敛或干净交接）。
5. **高门槛准入（只收顶尖产物）**：硬检未全过者直接淘汰（0 VLM 评审费）；通过硬检后走匿名五维视觉与工程盲评 + 境界阈值过滤（平庸“勉强能跑”的产物一律不入训练集），复杂题走 **阶梯式 Best-of-2** 优中选优。
6. **零宿主机污染与零泄漏**：独立 `/tmp` 沙盒执行，全量扫描确保 0 宿主机路径、0 跨 trial 抄袭、按任务祖先家族严格隔离 `train / val / test` 与外部 OOD 尺子。

---

## 四、2026 外部高质量资产客观盘点：哪些能用、哪些是坑？

现实判断：**除 3D 轨已有小红书 `3DCodeFactory` 这一现成天花板外，2D Web 多文件交互动画与 CAD 多零件复杂装配体在全网目前均没有“开箱即用的规整高难长程数据库”。** 因此必须精确界定每份 2026 最新外部资产的角色，严禁混用或侵权：

### 1. Track 1（3D 场景/动画）

| 外部资产（时间） | 协议 | 实际定位与用法 |
| --- | --- | --- |
| **`3DCodeFactory/3DCodeFactory`**（2026.11，小红书） | **Apache-2.0** | **唯一主力直接入训源**：复用完整 `401 / 401` 分片全轨（**Blender `bpy` + Three.js 全轨** + `main / compact_before / compact_task / compact_recovery` 全段，超 `256K` 段按 `HCPF-Lite + ct_diet` 无损适配至原生 `≤256K` 窗口），零 API 成本直接吸收顶级多文件工程与审美 |
| **`3dcodeverse/3dcodeverse-2m`**（2026.10） | `CC-BY-NC-SA-4.0` | 单轮脚本 + NC-SA 协议，**严禁直灌商用训练**；仅借鉴其验证器/载荷有界工程经验 |

### 2. Track 2（2D Web 多文件交互动画）

| 外部资产（时间） | 协议 | 实际定位与用法 |
| --- | --- | --- |
| **`starry1001/AnimWeb-Bench`**（2026.11，`arXiv:2611.09769`） | **CC-BY-4.0**（已核 HF 卡片） | **2D 多文件顶级审美 OOD 标尺**（124 个 Awwwards 级多文件动态网页，实测 12 页中位 192 KB / 762 标签 / 24 资产、`clip-path` 75%）；**永不入训**，用于定义交付高度与评测 |
| **`figma-ai/motion-graphics-bench`**（2026.11，`arXiv:2611.10592`） | 代码 **MIT**<br>数据 **`CC-BY-NC-SA-4.0`** | **数据严禁入训（NC-SA）**，仅作 OOD 评估；**强烈复用其 MIT 确定性时空验证程序范式**（全 100 题 / 714 条 `ver_*` 断言，93.3% 人类一致率）升级我方 2D 硬检器 |
| **`Roy-DOU/Webdev-Bench`**（2026.10，`arXiv:2610.23104`） | **MIT**（已核 HF 卡片） | 与 `WebCoder-27B`（Qwen 27B）配套的多文件前端开发种子工程与 4–5 里程碑演进评测架；吸收其多文件重构/换肤/接线算子进 `A2D2_F11`，不作 2D 动画训练主盘 |
| **`WebUniverse-NSL/WebUniverse-Mix`**（2026.10，`arXiv:2610.33149`） | **自定义 `WebUniverse-Env License`** | 15K Web Agent 轨迹但协议受限且偏通用前端+混有单文件；须先法务/协议核查与抽样过滤多文件高难段，**未核清前暂不入主训** |
| **`anim2code/dataset`**（2026.06，`arXiv:2606.28593`） | **CC-BY-4.0 / MIT** | 1,069 条 CodePen 单页动画（`mp4 + full.html`）；仅可作轻量动效题源/对照，**不作多文件复杂工程主盘** |

### 3. Track 3（CAD 参数化建模与 3D 打印）

| 外部资产（时间） | 协议 | 实际定位与用法 |
| --- | --- | --- |
| **`KnowledgeXLab/IterCAD_Data`**（2026.06–08，EMNLP 2026，`arXiv:2606.13368`） | **Apache-2.0** | **唯一值得立刻下载验货的 2026 多轮视觉闭环 CadQuery 库**（约 5.59 GB，含 22K `IterCAD-RS` Revise-or-Stop 轨迹 + 三视图工程图）；需抽样核查其复杂度上限与轮数深度，优先筛选高难单件与工程图纠偏段，或借高难题源用我方教师重跑更深长程 |
| **`ADSKAILab/Zero-To-CAD-100k`**（2026.04）& **`kulibinai/cadevolve`**（2026） | **Apache-2.0** | **免费高复杂单件种子矿**（覆盖倒角/圆角/抽壳/扫掠/放样/阵列/布尔）；**严禁单轮整库灌入**，仅筛选 **20–45 面高复杂件** 渲染 4 视图作为我方多轮视觉精修/缺陷返修的题源与真值 `STEP` 锚点 |
| **`gnucleus-ai/cad-gen-freecad`**（2026） | **Apache-2.0** | 原生参数化特征树与设计规格参考，辅助设计结构化工程尺寸题干 |
| **`BenchCAD`**（2026.05，`MIT/CC-BY-4.0`）· **`CADGenBench`**（`ODC-By/Apache-2.0`）· **`AssemblyBench`**（CVPR 2026） | 宽松 / 学术 | **纯净 OOD 评测尺子与高阶多体装配标尺**（严禁入训）：`BenchCAD` 25 题测单件 Voxel IoU / CodeEdit，`CADGenBench` 与 `AssemblyBench` 指导多零件 `STEP` 配合/防干涉验收 |

---

## 五、没有现成大库时，如何把高难长程造数预算花在刀刃上？（4 大控本杠杆）

既然**省钱绝不能靠拿单轮低质数据凑数**，真正的降本路径是在**不牺牲单条难度和长程深度的前提下，消除一切无效采样开销**：

| 控本杠杆 | 具体工程做法 | 预期降本与质量收益 |
| --- | --- | --- |
| **杠杆 1 · 零 API 前置过筛（本地 27B 难度闸）** | 所有新合成的 2D / CAD 高难题，先用本地空闲 GPU 免费跑一遍 `Qwen3.8-27B Base`：**27B 自己就能拿高分过关的题直接剔除，1 分钱教师 API 不花**；只把教师额度砸在“27B 做不好但高难可解”的真硬骨头上 | 砍掉 30%–50% 对学生无增益的“伪难题”采样费，把每 1 块钱都变成有效梯度 |
| **杠杆 2 · 3D 吃现成 + 2D/CAD 少而精长程** | 3D 展示类 100% 吃小红书 401 分片合法段（0 API 费）；2D 与 CAD 放弃“千条中低难铺量”，首批聚焦 **每轨 150–300 条真正高难长程样本**（按 12 核心族 × 高复杂/多体变体覆盖） | 小红书消融曲线证实高密长程数据数百条即可拉出显著拐点，总预算直降一个量级 |
| **杠杆 3 · 拼图载荷有界 + 免费开源视觉锚点** | ① 视觉自检统一用 4–6 帧/视角 Contact Sheet（`MAX_PIXELS=401408`），把单条看图从 40+ 次压到 8–12 次；<br>② CAD 借 `Zero-To-CAD`/`CADEvolve` 渲染图、2D 借开源高质量静态 SVG / 关键帧做视觉锚点 | 实测（`stonebridge-v3` & `3DCodeVerse` Table 17）可压降 **40%–65%** 上下文 token 成本；且有明确视觉锚点时教师盲走轮数大减、看图挑刺深度翻倍 |
| **杠杆 4 · 阶梯式 Best-of-2 + 硬检前置秒杀** | 确定性硬检（零 API 费）先拦掉所有报错/静态假动/非流形/干涉失败轨迹；仅对硬检全过样本启动 VLM 盲评；**第 1 次 rollout 盲评 ≥ 0.90 直接录取，仅对 0.70–0.90 边界题补跑第 2 次 rollout** | 将传统固定 Best-of-2 的 `2.0×` 采样开销压降至 `~1.3×`，同时维持顶尖准入标准不降 |

---

## 六、落盘后的最小可行推进顺序

1. **零 API 验货与 v2.0 树落盘（优先级 1，✅ 已完成）**：已完成 9 大 2026 外部仓库抽样验货（存档 `${WORKSPACE}/datasets/sample-study-20261126/`）并落盘 [2026 样本学习报告](../../research/cad-2d-sample-study-and-taxonomy-v2-20261126/README.md)、[anim2d_tree_v2_0.json](../configs/taxonomies/anim2d_tree_v2_0.json) 与 [cadquery_tree_v2_0.json](../configs/taxonomies/cadquery_tree_v2_0.json)。
2. **升级两轨基建以匹配本规格（优先级 2，✅ 已完成 2026-11-27）**：
   - 2D 验收器（`scripts/check_2d_v2.mjs` + `scripts/local_static_server.cjs`）已升级支持 **本地只读 HTTP 多文件目录** + 双视口文字/HUD 重叠检测 + 一键 `renderAt(t) → MP4` 导出脚本（`scripts/export_2d_mp4.mjs`）；
   - CAD 验收器（`scripts/cad_inspect.py`）已补齐 **多模块包（`params.py + parts/*.py + assembly.py`）支持 + `STEP` 导出与 OCCT 独立回读 + 多零件零干涉布尔交集检验 + 剖视图 `section_view.png` / 爆炸图 `exploded_view.png` 渲染**。
3. **本地 27B 免费难度过筛 + 首题单价哨兵（优先级 3）**：先用本地 GPU 筛出 27B 真实做不好的高难 2D 多文件交互题与 CAD 多零件装配题，再各跑 **3–5 题全长程 Canary** 核清真实单价与产物审美天花板，确认达到“顶尖产物”水准后再批量扩产。
