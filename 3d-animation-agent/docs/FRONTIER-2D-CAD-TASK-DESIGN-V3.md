# Frontier v3.0 2D & CAD 高复杂度出题、反作弊验收与超越 Qwen-Max 蒸馏规格

> 公开整理版 · 2026-11-28。保留成文时点的记录；计划、文献结果和本地实测请分别理解。环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> **生效日期**：`2026-11-28`（严格隶属 **Revision 3 / Option 2** 全链路 `Static YaRN 1.5×` 硬训 `384K` + `256K` 统一沙盒框架）  
> **配套分类树与工具链**：[CadQuery-Tree v3.0](../configs/taxonomies/cadquery_tree_v3_0.json) · [Anim2D-Tree v3.0](../configs/taxonomies/anim2d_tree_v3_0.json) · `xhs_v2_synth.py`（本地附件未发布）（`--tier frontier-v3`）· `build_frontier_v3_seeds.py`（本地附件未发布） · `cad_kit.py`（本地附件未发布） · `anchor_2d_perspective.py`（本地附件未发布） · `overlay_diff_2d.mjs`（本地附件未发布）  
> **上游权威基准**：[OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md](../../research/xhs-384k-to-200k-data-adaptation-20261127/OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md) · [REALHARD6-AND-3D-TO-2D-CAD-BLUEPRINT-20261127.md](REALHARD6-AND-3D-TO-2D-CAD-BLUEPRINT-20261127.md)

---

## 一、为什么必须把 2D & CAD 从 `v2.0` 升级到 `Frontier v3.0`？

**核心目标**：蒸馏 `Qwen3.8-27B` 的目的不是做出“能跑就行”的桌面玩具，而是**复制小红书 `3DCodeFactory` 对 3D 能力的 `+8.12` 跃迁（让 27B 反超 `Qwen3.8-Max`）**，在 **工业 CAD** 与 **高精 2D 交互动画** 两个外部空白赛道上同样实现 **27B 稳定超越 `Qwen3.8-Max`**。

实测复盘暴露出前期 `v2.0`（`synth_v2_20261127`）题目**明显过简、存在饱和天花板**：

| 维度 | 旧版 `v2.0` (`synth_v2_20261127`) | 小红书 `3DCodeFactory` & `realhard6 (BenchCAD 2.1)` | **新版 `Frontier v3.0`（对标 XHS / 超越 Qwen-Max）** |
|---|---|---|---|
| **教师挣扎度与轮数** | `Kimi` 首轮 `12/12` 轻松通关（`22–60` 轮，`71K–146K` tok，`0` 压缩，`0.90–1.00`） | XHS 3D：`500–1,005` 轮、`287–359` 审图、`4–6` 压、`938K–1.16M` 净 tok；`realhard6` CAD：`Opus 0.007–0.089`、`Kimi 0.005–0.019` | **防饱和准入**：单次 `<45` 轮或 `Base-27B ≥ 0.70` / `Qwen-Max` 一次过 `≥0.80` 的题目一律淘汰；主力目标 **`60–180+` 轮、`150K–450K+` 净 tok**（含 `15–20%` 真实撞穿 `208K` 自动压缩续写） |
| **CAD 几何与工程规模** | `6–8` 零件、`≥60` B-rep 面、纯文本喂饭全部尺寸、单姿态静态验证 | `9–36` 实例、去姿态 `SO(3)_24` STEP + ISO-E/ISO-A 2D 工程图 + 多实体复合陷阱 + 相机微扰逆向 | **`10–36` 实例 / `≥8` 独立零件型 / `≥200` B-rep 面 / `≥6` 类 OCCT 特征 / `1,200–3,000+` LoC**；**反喂饭**（`C-F1/C-F3` 严禁题干泄露坐标公式）+ **4 相位动态运动学扫掠零干涉 (`build(params, phase)`)** + `≥2` 组耦合 `--probe` |
| **2D 视觉、物理与代码规模** | `≥3–4` JS 模块、`8s` 单幕循环、`2` 个基础滑块；斜拍参考图出现 5 套坐标系透视分裂（`xhs_anchor_agate_2d`） | XHS 3D：`1,600–4,600` LoC、多子系统交互与全局/局部反复视觉精修 | **`≥6` 实质 ES 模块（`1,500–3,500+` LoC）**、**`12–24s` `≥3` 幕连续分镜叙事**、**`3–5` 个深度耦合控件（含画布直拖/点选 + 剖视/X光模式 + `#reset`）**；强制 `projection25d.js` 共享相机锁灭点 + 真实解析物理/齿轮/连杆求解器 |
| **确定性反作弊验收** | 仅查静态零干涉 / 3 帧像素哈希，漏放“焊死假机构”与 Canvas 文字重叠 | OCCT `BRepAdaptor_Surface` + `HLRBRep_Algo` 红线叠图 + 全对布尔求交 | CAD：`cad_inspect.py` 5 修 + `--phases` 扫掠 + `tools/cad_kit.py`；2D：`check_2d_v3.mjs`（删作弊后门、`MAD>=1.5`、`SSIM<=0.985`、双视口 `≤10%` 文本重叠、禁 WebGL）+ `anchor_2d_perspective.py` + `overlay_diff_2d.mjs` |

---

## 二、CAD Frontier v3.0 四大高难原型（`CadQuery-Tree v3.0`）

彻底淘汰“纯文本喂尺寸的 6 零件桌面小件”，全量切换至 **对标 BenchCAD 2.1 + CADEngBench + 真实工业研发** 的四大原型（仍100%遵循 Option 2 `256K` 沙盒水位 `208000 / 80% / 32768 / 16384` 与 `XY 35% / XZ 35% / YZ 30%` 非 XY 基准配额）：

| 原型代号 | 占比 | 难度规格与反喂饭契约 | 核心攻克的 `Qwen-Max` 盲区 |
|---|---:|---|---|
| **`C-F1` · 非喂饭混合工程图 + 去姿态 STEP 工业总成** | **40%** | **`12–36` 放置实例**（`4–6` 个缺失非标件仅给 **ISO-E 50% / ISO-A 50%** 2D 工程图与剖面图 + `8–30` 个经随机 $R \in \mathrm{SO}(3)_{24}$ 去姿态标准 STEP + `bom.json`，含 `20%` 左右手性件、`15%` 单 STEP 多实体陷阱、`25%` 非 `90°` 相位角）；**题干零坐标公式喂饭** | 倒逼模型掌握 `cad_kit.inspect_steps`（`BRepAdaptor_Surface`）、亚像素 `px/mm` 标尺标定与 `HLRBRep_Algo` 红线叠图，根治第一/第三视角沉头反置与手性翻转 |
| **`C-F2` · 多相位动态机构与变截面功能总成** | **25%** | **`10–22` 独立零件、`≥200` B-rep 面、`≥6` 类 OCCT 特征**（渐开线齿轮/蜗轮蜗杆/阿基米德涡卷/变截面阿基米德蜗壳放样/3D 扫掠叶轮/凸轮从动件/多级减速器）；强制 `build(params=None, phase=0.0)` 在 **`phase ∈ {0.0, 0.33, 0.67, 1.0}` 全部 4 相位** 通过 `0.0 mm³` 零干涉与真实位移响应检验，叠加 `≥2` 组耦合 `--probe` | 彻底绞杀 `xhs_anchor_press_cad` 式“焊死装饰壳”，训练真实运动副约束、导槽包络与复杂曲面壁厚/空腔容积控制 |
| **`C-F3` · 微扰多视图 0-STEP 逆向装配** | **15%** | **`6–14` 同轴/径向互锁零件**（三爪卡盘、行星差速器、棘轮分度头、谐波/摆线减速机等），`0` 个 STEP 输入，仅提供 4 视角总装图（`TR` 标准等轴测 + `TL/BL/BR` 施加 `U(3°, 8°)` 未知相机微扰）+ `*_alone.png` / `*_in_assembly.png`；强制正交局部系 `{±X,±Y,±Z}` 导出零件 + `instances.json` 存放非正交旋转 | 直击全前沿模型 `<0.16` 的 `bc_t4_chuck9` 无人区，训练多相机椭圆/对称点 PnP 标定与正交局部系分离纪律 |
| **`C-F4` · 长程工业 ECO 变更与多故障外科手术（`208K` 压缩三联段）** | **20%** | 继承一套含 `8–18` 零件的既有工业装配体，完成 ① **多故障诊断修复**（沉头反置 + 手性错配 + 布尔穿模 + 间隙失配 + 3% 健康零改对照组）或 ② **二阶段工程变更（ECO）**（如跨距/行程/负载等级升级，要求联动改型 `≥4` 个耦合件并保持既有接口孔阵不变），真实撞穿 `208K` 自动压缩并依托 `work/cad_state_ledger.json` 无损续写 | 训练长程状态账本维护、增量 `Edit` 外科手术与 `256K` 压缩零失忆恢复能力 |

### CAD Frontier v3.0 硬准入门槛（`xhs_v2_synth.py --tier frontier-v3`）
- `min_distinct_parts >= 8`（`C-F3` 允许 `>= 6` 互锁复杂件），`min_placed_instances >= 10`（`C-F1` 为 `12–36`）；
- `min_brep_faces >= 200`（旧版仅 `60`），`required_occt_ops >= 6`；
- `C-F2` 强制声明 `kinematic_phases: [0.0, 0.33, 0.67, 1.0]` 与 `min_moving_parts >= 3`；
- `functions_F` 强制 `>= 2` 个耦合参数探针（修改主参必须联动至少 3 个子零件尺寸/位姿且全相位 `0.0 mm³` 零干涉）；
- **强制 6 视角（含底视/后视）+ 90° 四分之一象限剖视图 `section_view.png` + 同轴爆炸图 `exploded_view.png`**，且通过 `cad_inspect.py` 全部 §0 #8 硬检（`!common.IsDone()` 硬判失败 + 体素兜底 + `BRepExtrema` 单连通与 `0.15–0.60 mm` 配合间隙 + AST 禁 `bpy/bmesh/importStep`）。

---

## 三、2D Frontier v3.0 五大高天花板原型（`Anim2D-Tree v3.0`）

彻底告别“4 个文件、8 秒单幕、2 个滑块、卡片仪表盘”的初级形态，全面对标 **Bartosz Ciechanowski (`ciechanow.ski`) · Kurzgesagt · NYT Graphics / The Pudding · 3Blue1Brown · Awwwards 年度互动体验**，用 **真实数学求解 + 共享 2.5D 透视相机 + 多幕电影级分镜** 逼出教师模型 `1,500–3,500+` LoC、`60–160+` 轮的工艺天花板：

| 原型代号 | 占比 | 难度与架构契约（全离线 Zero-CDN / Zero-WebGL） | 核心攻克的 `Qwen-Max` 盲区 |
|---|---:|---|---|
| **`2D-F1` · 统一相机 2.5D 透视 / 轴测交互展厅与建筑剖面** | **25%** | **强制引入 `output/src/projection25d.js` 共享 3D$\to$2D 投影内核**，以同一世界坐标系投射全部墙体、展柜、曲面/圆柱设备、光照锥与接地投影（`120+` 独立矢量/程序化元素）；提供至少 **3 幕相机/剖切视角切换**（全局纵深 $\to$ 核心机台特写 $\to$ 内部 X 光剖视）+ 画布热点直击互动；沙盒必跑 `anchor_2d_perspective.py` + `overlay_diff_2d.mjs` | 彻底根治 `xhs_anchor_agate_2d` 式多套局部坐标系打架，把 3D 预训习得的相机灭点与光照先验降维变现为顶级 2.5D 视觉表现力 |
| **`2D-F2` · `Ciechanow.ski` 级真实物理/机械/光学/流体剖面实验台** | **25%** | **禁止手写假旋转动画！** 必须由独立数学求解模块 `src/solver.js` 驱动 **$\ge 8$ 个真实物理耦合节点**：精确渐开线齿轮啮合比（$\Delta\theta_B/\Delta\theta_A = -N_A/N_B$）、闭环四连杆/擒纵/凸轮解析或迭代求解（销钉闭合误差 $\le 0.5\text{px}$）、实画导槽滑块包络、斯涅尔色散多透镜光路追迹、或 Navier-Stokes/伯努利阀门压力-流速联动，并同步渲染实时相图/矢量场/示波图副视图 | 直击 `Qwen-Max` “画得像样但一动就穿帮、控件和机构脱节”的硬伤，经 `check_2d_v3.mjs` 无理数时刻断言与冻结时钟因果探针 100% 实证 |
| **`2D-F3` · `Kurzgesagt / Awwwards` 级多层视差叙事短片与骨骼偶剧场** | **18%** | **`6–8` 层深度排序大气视差** + 层次化 FK/IK 多关节角色/自动人偶骨骼绑定 + 次级动力学（水波/烟尘/布料/光柱/体积雾）+ **`12–24s` `3–4` 幕连续镜头语言**（推拉摇移、遮罩转场、昼夜/气候/光影连续演算）+ 实时导演台交互（直接拖拽关键道具/切换幕次/调节环境参数） | 训练电影级色彩光影构图、连续镜头节奏与复杂多模块渲染管线组织能力 |
| **`2D-F4` · `NYT / 3Blue1Brown` 级多幕联动数据叙事与算法模拟长卷（高难 `D03`）** | **12%** | **`4–5` 幕连续形变（Object Constancy）视觉长文**：同一组底层视觉实体随滚动/时间轴在不同空间尺度、投影坐标系与统计视图间平滑变形，由真实后端算法/经济/生态/物理模拟实时驱动多图刷选联动（Brushing & Linking）与力导向无重叠动态标注；**永久 `0%` 封杀静态 4 卡 KPI 看板与移动脉冲点拓扑图** | 区分真正的高复杂动态数据叙事与低幼模板大屏，训练跨视图状态同步与高精度双视口零重叠排版 |
| **`2D-F5` · `256K` 两阶段大工程构建与坏场景外科手术（`208K` 压缩三联段）** | **20%** | ① **二阶段里程碑扩展**（Phase 1 交付全功能主舞台 $\to$ Phase 2 追加剖切透视模式 + 物理联动副视图 + 全局视觉精修，真实撞穿 `208K` 压缩并靠 `work/anim2d_state_ledger.json` 续写）；或 ② **破损场景外科修复**（修正透视分裂、失步齿轮比、悬空件、Canvas `fillText` 碰撞、不可寻址 `@keyframes`；含 `5%` 健康零改对照） | 训练多轮视觉挑刺、局部精准 `Edit`、抗过修与 `256K` 自动压缩无损接力 |

### 2D Frontier v3.0 硬准入门槛（`xhs_v2_synth.py --tier frontier-v3`）
- **`min_js_modules >= 6`**（职责分离：`solver.js / projection25d.js or camera.js / geometry*.js / timeline.js / ui.js / state.js`，目标 `1,500–3,500+` LoC）；
- **`duration_seconds ∈ [12.0, 24.0]`** 且 **`min_acts >= 3`**（`acts` 列表显式定义每幕起止时间、相机/构图变化与核心物理/叙事事件）；
- **`functions_F` 为 `3–5` 项深度耦合业务控件**（不含 `#play/#pause/#scrub`），至少包含 **1 项画布直接点选/拖拽交互** 与 **1 项剖切/X光/视角或物理参数耦合调节**，且支持 `#reset` 100% 精确复位；
- 强制接入 `vendor/gsap/gsap.min.js`（离线预置）、隔离 `web2d_node_modules`（物理移除 `three`）、`check_2d_v3.mjs`（零作弊后门、双视口 `1280×720` + `1440×900` `≤10%` 文本重叠、`MAD >= 1.5`、`SSIM <= 0.985`、硬禁 WebGL、`ffprobe` MP4 解码），且 `2D-F2` 强制暴露 `window.__getKinematicState()`、`2D-F1` 强制 `projection25d.js` + `overlay_diff_2d.mjs`。

---

## 四、超越 `Qwen3.8-Max` 的难度校准漏斗与闭环评测标准

为了确保每条入训样本都真正拉高 `Qwen3.8-27B` 的能力上限、而非重复灌入基座或 `Qwen3.8-Max` 已经饱和的简单题，开工生产前严格执行四道闸门：

1. **Gate 0 · 反饱和双基线探针（Zero-Waste Anti-Saturation Filter）**：
   - 新题包合成后先用本地 `Qwen3.8-27B Base` 与对照强模 `Qwen3.8-Max`（或同级基准采样）抽检：
     - 若 `Base-27B` 一次性通过硬检且综合分 **`≥ 0.70`** $\to$ **立即淘汰（过简）**；
     - 若教师 `kimi-k3.1-pro` 首轮在 **`< 45` 轮 / `< 120K` tokens** 内无返修即拿 `≥ 0.92` $\to$ **自动触发复杂度升级**（增加子机构耦合数、引入微扰视角或追加 Phase-2 ECO 变更），禁止把“30 轮秒杀题”当高难数据入池。
2. **Gate 1 · 零成本确定性硬检短路（`0` VLM Token on Failure）**：
   - CAD：`cad_inspect.py --phases 0,0.33,0.67,1.0 --probe ...` + `cad_kit.py verify-submission`；
   - 2D：`check_2d_v3.mjs` + `overlay_diff_2d.mjs` + `ffprobe`。
3. **Gate 2 · 跨家族怀疑论 VLM 盲评 + `overlay` 呈堂证供**：
   - 严禁同族自评（`kimi` 不评 `kimi`）；裁判 `max_tokens >= 12000`；强制将 `overlay_audit.png` / 6 视角 + 90° 四分之一剖视 + 同轴爆炸图直喂裁判，内置 `25–30%` 负向一票否决项（透视分裂、焊死假机构、乱码假字）。
4. **Gate 3 · 超越 `Qwen3.8-Max` 终局验收矩阵**：
   - 在完全隔离的盲测集（`CAD-Eval-72` + `BenchCAD/IterCAD-Draw_1k` OOD、`Anim2D-Eval-72` + `MotionGraphicsBench/AnimWeb-Bench` OOD、`XHS-3D-48` 哨兵、`SWE-50`）上头对头评测 `Base-27B` vs `Qwen3.8-Max` vs `27B-Stage1` vs `27B-Stage2/3/4-Option2-Final`；
   - 终局放行标准：**27B 在 CAD-Eval-72 与 Anim2D-Eval-72 确定性通过率与双序盲评胜率双双超过 `Qwen3.8-Max`**，同时保持 XHS 3D 无退化（`≥ -2.0 pp`）与四项跨轨污染严格 **`0.0%`**。
