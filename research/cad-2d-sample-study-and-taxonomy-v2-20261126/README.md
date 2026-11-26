# 2026 外部 2D / CAD 高质样本实测调研、27B 能力缺口与 v2.0 高难分类树报告

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> **成文日期**：2026-11-26  
> **配套规格**：[三轨顶级交付产物规格与高难长程造数指南 v2.0](../../3d-animation-agent/docs/THREE-TRACK-DELIVERABLE-SPEC.md) · [XHS 对齐统一训练数据与上下文标准](../../3d-animation-agent/docs/XHS-UNIFIED-SFT-STANDARD.md)  
> **v2.0 机读分类树**：[anim2d_tree_v2_0.json](../../3d-animation-agent/configs/taxonomies/anim2d_tree_v2_0.json) · [cadquery_tree_v2_0.json](../../3d-animation-agent/configs/taxonomies/cadquery_tree_v2_0.json)  
> **本地抽样存档根目录**：`${WORKSPACE}/datasets/sample-study-20261126/`（共约 `17.2 MB` 精选切片、元信息与真实样本，**不含任何全库下载、未触碰 GPU 训练与教师 API**）

---

## 零、执行结论（3 条核心发现）

1. **实测证实“全网无现成 2D 多文件交互动画 / CAD 多零件装配体长程训练大库”**：我们对 2026 年 9 个最具代表性的公开 2D/CAD 仓库拉取了真实切片、协议卡片与代码/校验结构。结论明确：**外部库可免费提供顶级 OOD 标尺、MIT 确定性时空校验范式、高复杂单件种子与工程图真值，但高审美 2D 多文件长程轨迹与 2–6 件 CAD 机械装配长程轨迹必须由我方围绕 `v2.0` 高难树定向自产。**
2. **用外部真实分布照出旧 `v1.1` 树与 `Qwen3.8-27B Base` 的真实能力盲区**：
   - **2D 轨**：旧 `v1.1` 树约 65% 偏 STEM/物理单文件小组件，严重缺席 2026 主流交付形态——`AnimWeb-Bench`（12 页实测）中位 `192 KB` HTML / `762` 标签 / `24` 静态资产，`clip-path` 占 **75%**、平滑滚动叙事占 **66.7%**；`MotionGraphicsBench`（全 100 题 / 714 条验证函数）高频动效是 **缓动定格（`ease 63% / hold 49%`）、刚体支点铰接（`rotate 49% / rigid 30% / pivot 29%`）与错峰级联**；`Webdev-Bench`（15 题实测）每题链式演进 **4–5 个里程碑**。而本地 27B Base 在 2D 上 `visual_craft` 仅 `3.00/5`、`usability/HUD` 仅 `3.33/5`、超时率 `50%`。
   - **CAD 轨**：本地 27B Base 在简单 6–15 面单件上已达 `9/12`（趋于饱和），真正卡死的是 **3.0× CadQuery/OCCT 报错率**、**非 XY 平面轴向画反（XZ↔XY 翻转）与内止口反转且看完 4 视图仍查不出来**、以及 **2–6 件多模块装配与防干涉协调**。`BenchCAD` 40 条实测样本更直接印证：**72.5%（29/40）真实工业硬件起始基准面在 `YZ`（40.0%）或 `XZ`（32.5%），仅 27.5% 在 `XY`**！
3. **两棵高难长程树已按小红书接地气风格重构落盘至 `v2.0`（各 5 大类 × 4 二级词条 = 20 个直白产品词条）**：保留 `v1_1.json` 兼容现有单测；新树对齐小红书原版 `taxonomy.json` 的极简两层 `domain + label` 产品视角，彻底取消人工正交任务形态矩阵与底层算子黑话——从零搭建、渲染查错、修轴向/修干涉/修遮挡、多轮局部 `Edit` 精修与自然 EOS 收尾全部由 **50–150 轮真实长程轨迹自然承载**，技术与几何硬约束统一收口至 `P07` 出题器与验收器。

---

## 一、2026 外部 9 大数据集 / 基准拉样盘点总表

所有协议均经本地拉取的 HuggingFace `api.json` 与 `README.md` 一手核验（存档于 `${WORKSPACE}/datasets/sample-study-20261126/`）：

| 赛道 | 仓库 ID（最新更新时间） | HF 核验协议 | 仓库真实规模 | 本地实拉与实测样本 | 工程准入裁决 |
| --- | --- | --- | --- | --- | --- |
| **CAD** | `KnowledgeXLab/IterCAD_Data` (`2026-08-24`) | **Apache-2.0** | `5.59 GB`（6 个未压缩 `.tar` 分片） | 全 6 分片头目录 + 完整 **`RL/IterCAD_RL.jsonl`（2,000 条）** + 69 张预览图头 | **高优先复用（单件多图/工程图种子）**：分片 0 为 RL 题库，分片 1–4 为 ~2.5 万多模态 SFT 图文对，分片 5 为 `IterCAD-Draw_1k`（**严禁入训，作 OOD**）；不含多零件装配与 3MF/STEP 多文件工程 |
| **CAD** | `ADSKAILab/Zero-To-CAD-100k` (`2026-05-03`) | **Apache-2.0** | `81,015 train / 9,734 val / 9,767 test` | 完整 README、元信息、24 个 val parquet 索引树 | **免费高复杂单件种子矿**：含 `num_faces`、`cadquery_ops_json`、`step_file`、`stl_file` 与 8 视角图；仅筛选 **15–45+ 面高复杂件** 作视觉锚点与真值 STEP，严禁单轮整库灌入 |
| **CAD** | `kulibinai/cadevolve` (`2026-02-19`) | **Apache-2.0** | `2,004,385` 行 / `4.73 GB`（含 8k 参数化生成器） | README、文件树、元信息（注：`ds_server_rows` 无公开预览行） | **免费参数化复杂单件种子矿**：提供完整 OCCT 算子谱与 `parametric_generators.json`，同样仅筛选高复杂单件作题源，不直灌单轮脚本 |
| **CAD** | `BenchCAD/BenchCAD` (`2026-06-28`) | **CC-BY-4.0**（代码 MIT） | 106 类工业标准件 + CodeGen/QA/CodeEdit | **40 条真实 `code_gen` 样本** + `QA` 切片与元信息 | **纯净 OOD 单件标尺（严禁入训）**：暴露非 XY 基准面核心短板；单题代码偏短（`p50=14` 行），非长程多文件形态 |
| **CAD** | `HuggingAI4Engineering/cadgenbench-data` (`2026-06-08`) | **ODC-BY** | 81 套 Mecado 工业夹具（49 图→STEP + 32 STEP 改型） | README、文件树与 3 份 `description.yaml`（`101–103`） | **纯净 OOD 工业工程图与存量改型标尺（严禁入训）**：直接定义 `CAD_D08L01/02` 的“接口保真增量改型”范式 |
| **2D** | `starry1001/AnimWeb-Bench` (`2026-11-09`) | **CC-BY-4.0** | 124 个真实 Awwwards 动态网页 | **12 个完整网页**（`data/1,5,12,23,35,48,60,74,88,100,112,124` 全部 `ground_truth.html` + `metadata.json` + 资产表） | **顶级 2D 多文件动态网页 OOD 天花板（严禁入训）**：定义叙事长页、视觉密度与多模块前端交付高度 |
| **2D** | `figma-ai/motion-graphics-bench` (`2026-11-26`) | **数据 `CC-BY-NC-SA-4.0`**<br>**代码 `MIT`** | 100 题 Design-First SVG 动效编辑 + 714 条验证函数 | **完整 `test-00000-of-00001.parquet`（1.63 MB，全 100 题）** + `verify_animations.py` | **数据严禁入训（NC-SA）**，仅作 OOD；**强烈吸收其 MIT 确定性 Python 轨迹/姿态/并发事件验证器范式** |
| **2D** | `Roy-DOU/Webdev-Bench` (`2026-10-24`) | **MIT** | 40 套多里程碑复合前端工程任务（`SUBSET40`） | README、`SUBSET40.txt` 与 **15/40 份完整 `task.json`**（`c03–c25`） | **纯净多轮前端演进 OOD 标尺（严禁入训）**：直接吸收其“4–5 里程碑存量工程重构/换肤/接线”算子进入 `A2D2_F11` |
| **2D** | `anim2code/dataset` (`2026-10-09`) | **CC-BY-4.0**（CodePen MIT） | 1,069 个 CodePen 动效视频+单页 HTML | README、目录树、外部依赖统计元信息 | **仅作轻量对照与技术栈情报**：`486/1,069`（45.5%）依赖外部脚本且以 **GSAP** 为主 → 证实离线 2D 沙盒必须预置本地 `vendor/gsap.min.js` |

> **合规红线声明**：`figma-ai/motion-graphics-bench` 数据（`CC-BY-NC-SA-4.0`）、`3dcodeverse-2m`（`CC-BY-NC-SA-4.0`）严禁进入商用 SFT 训练集；`WebUniverse-Mix` 属自定义受限协议，本次未拉取样本且暂不入主训。

---

## 二、实测样本分布深度解析

### 2.1 Track 2（2D Web 多文件交互动画）：真实顶级交付长什么样？

#### （1）`AnimWeb-Bench`（12/124 个真实 Awwwards 页面实测）
对本地 12 个完整 `ground_truth.html` + 资产目录做结构解剖（统计脚本与原始结果见 [sample_study_2026_analysis.json](sample_study_2026_analysis.json)）：
- **工程体量与资产密度**：单页 HTML `p50 = 192.4 KB`（均值 `253.3 KB`，最高 `795.6 KB` 如 `nexola.framer.website`）；HTML 标签 `p50 = 762`（均值 `876`，`p90 = 1,410`，最高 `2,155`）；静态资产 `p50 = 24` 个（均值 `27.8`，最高 `69` 个如 `missioncontrol.co` 含 `37` 个 `.svg`）；内联 `<svg>` 最高 `99` 个、`<canvas>` 最高 `25` 个（`griflan.com/workshop`）、`<script>` 达 `3–42` 个。
- **高频动效技术栈分布（`n = 12`）**：
  - `svg`：**12/12（100%）**
  - `transform`：**12/12（100%）**
  - `transition`：**11/12（91.7%）**
  - **`clip-path` 遮罩揭幕**：**9/12（75.0%）**（如 `pellmell.fr` 单页使用 `44` 次 `clip-path`！）
  - `canvas`：**8/12（66.7%）**
  - **`lenis` 平滑滚动叙事**：**8/12（66.7%）**
  - `@keyframes` / `three`（各 `4/12`）、`framer` / `requestAnimationFrame` / `swiper`（各 `2/12`）、`lottie` / `gsap` / `scrolltrigger`（各 `1/12`，外加 `anim2code` 45.5% 外部库以 GSAP 为绝对主力）。
- **核心启示**：真实高审美 2D Web 动效绝大多数是 **DOM + SVG + Canvas + CSS/GSAP 混合多文件工程**，视觉质感的核心抓手是 **排版层级、`clip-path` 帘幕揭幕、多段滚动/时间轴叙事、视差景深**，而非纯黑底单画布小球碰撞。

#### （2）`MotionGraphicsBench`（全 100/100 题 + 714 条 Python 验证函数实测）
对完整 `test-00000-of-00001.parquet`（100 题，目标运行时为 **JS + GSAP 驱动静态 SVG**，仅 3/100 内联 SVG、其余 97 题按 README 从 IconScout 提取）做全量文本与验证代码解剖：
- **指令与校验复杂度**：单题动效描述 `p50 = 1,099` 字符（`p90 = 1,510`）；配套 Python 验证程序 `p50 = 521` 行代码（最高 `856` 行），平均每题 **`7.1` 条独立 `ver_*(matrix)` 几何/时序断言**（范围 `5–11` 条）。
- **全 100 题真实动效原语分布（实测词频覆盖率）**：
  - **节奏与缓动**：`ease` **63%**、`hold` **49%**、`stagger` **12%**、`pulse` **12%**、`loop` **12%**、`bounce` **12%**、`simultaneous` **8%**、`alternating` **8%**；
  - **刚体与关节运动**：`rotate` **49%**、`rigid` **30%**、`scale` **30%**、`pivot` **29%**、`tilt` **24%**、`slide` **23%**、`hinge` **9%**；
  - **质感与矢量变形**：`squash` **14%**、`stretch` **12%**、`fade` **11%**、`stroke` **10%**、`clip/mask/morph` 合计 **14%**。
- **验证器最高频检查维度**：`pose`（39）、`scale`（17）、`bound`（13）、`order`（12）、`stagger`（10）、`pulse`（9）、`loop`（8）、`swing`（7）、`bounce`（7），且几乎全题强检 **`ver_artwork_preserved` / `ver_frame_zero_artwork`**（确保静态原画几何与层级不被破坏）。
- **核心启示**：模型在 2D 动效中最难的不是“让元素随便动起来”，而是 **支点/铰链不脱节（如剪刀双半绕中央螺钉反向开合、刀片滑出切割与纸页卷边同步）、缓动+定格节奏、多轨并发对齐与原画保真**。

#### （3）`Webdev-Bench`（15/40 复合前端工程任务实测）
对 `c03–c25` 共 15 份完整 `task.json` 解剖：
- 每题链式包含 **`4–5` 个递进里程碑**（均值 `4.5`，`p50 = 5.0`），种子形态以存量改造型为主（`brownfield 7`、`prd 5`、`replicate 3`），检查清单共计 `387` 项（`functional 161`、`visual 96`、`interaction 90`、`coverage 39`、`data 1`）。
- **最高频长程工程算子**：`restructure layout`（9）、`restyle`（9）、`make interactive`（8）、`add section`（7）、`wire up data`（7）、`remove section`（6）、`repair`（6）、`generate`（5）、`add state`（4）。
- **核心启示**：真实复杂 2D Web 任务大量发生在 **“已有 4–8 个文件，要求跨文件换肤升级/新增交互章节/接通状态/定点修 Bug”** 的存量演进场景，单轮从零重写无法胜任。

---

### 2.2 Track 3（CAD 参数化建模与 3D 打印）：真实工业分布长什么样？

#### （1）`KnowledgeXLab/IterCAD_Data`（6 分片结构 + 2,000 条 RL 实测）
通过对 6 个未压缩 `.tar` 分片（总计 `5.59 GB`）读取 tar 头与提取完整分片 0 的 `RL/IterCAD_RL.jsonl`：
- **分片结构实查**：
  - `train-00000.tar`：包含完整 `RL/IterCAD_RL.jsonl`（**`2,000` 条**，100% 为 `task_type="view"`，`messages` 仅含 `system + user` 2 轮 prompt + 1 张输入视图 + `gt_stl_path`，引导模型做分步 CadQuery 推演）与 `RL/images/`；
  - `train-00001..00004.tar`：包含 `SFT/images/sample_001405..023200+`（每样本多视角 PNG，对应约 `2.5` 万多模态 SFT 样本）；
  - `train-00005.tar`：包含 `benchmark/IterCAD-Draw_1k/`（1,000 题工程图评估基准，严禁入训）。
- **客观边界**：`IterCAD_Data` 证明了 **“视图/工程图 → CadQuery 代码 → 渲染自检/修反”** 的可行性，且协议为 `Apache-2.0`；但它聚焦 **单零件单脚本**，不覆盖 **2–6 件多模块装配（`params.py + parts/*.py + assembly.py`）**、**`3MF + STEP` 多体配合防干涉** 与深长程局部 `Edit`。

#### （2）`BenchCAD`（40 条 `code_gen` 实测）& `Zero-To-CAD` / `CADEvolve` / `CADGenBench`
- **最关键实测发现（`BenchCAD` 40 条 `code_gen`）**：
  - **起草基准面分布**：**`YZ` 占 16/40（40.0%）**、**`XZ` 占 13/40（32.5%）**、**`XY` 仅占 11/40（27.5%）**——**高达 72.5%（29/40）真实工业标准件不在 `XY` 平面起草**！
  - **代码长度**：`p50 = 14` 行（`mean = 15.1`，`max = 36` 行），集中于 ISO/DIN 单体标准件（`washer 11`、`bolt 11`、`spacer_ring 8`、`hex_nut 7`、`pulley 3`；`easy 14 / medium 16 / hard 10`）。
- **高阶特征与工程图改型谱（`Zero-To-CAD-100k` / `CADEvolve` / `CADGenBench`）**：
  - 高复杂单件必须覆盖完整 OCCT 操作谱：`revolve`（回转法兰/阶梯轴）、`loft`（方转圆风道过渡）、`sweep`（有界弯管）、`shell`（抽壳腔体）、`fillet/chamfer` 选边、`cboreHole/cskHole` 沉头孔、线性/极坐标/镜像阵列与多轴相交通孔；
  - `CADGenBench`（81 套工业夹具：49 工程图→`STEP` + 32 存量 `input.step` 增量改型）确立了 **“保真既有配合接口的前提下做局部参数改型”** 的高难工程范式。

---

## 三、`Qwen3.8-27B Base` 能力缺口诊断矩阵（本地实测 × 2026 外部高难样本）

将本地基线实测（`print-seed-v1`、`eval-v3-devtest-v2`、`round2-line-c-seeds`）与上述 2026 外部样本分布逐项交叉，精准锁定两轨最急需蒸馏的能力缺口：

### 3.1 Track 2（2D Web 多文件交互动画）6 大能力缺口

| 缺口编号 | 本地 27B / 旧 `v1.1` 树实测短板 | 2026 外部样本对应的高标准要求 | `Anim2D-Tree v2.0` 针对性补齐 |
| --- | --- | --- | --- |
| **G2D-1** | 27B Base `visual_craft` 仅 **`3.00/5`**；旧 `v1.1` 树约 65% 为 STEM 单画布小工具 | `AnimWeb-Bench`：多章节版式层级、动态排版、**75% `clip-path` 揭幕**、67% 滚动叙事与多资产融合 | 新增 **D01 叙事长页与品牌互动专题**（`A2D2_F01`）与 **D03 产品交互与多态仪表盘**（`A2D2_F04/05`） |
| **G2D-2** | 缺乏精确支点铰接与原画保真动效训练，旋转易偏心漂移、元素易脱节 | `MotionGraphicsBench`：`ease 63% / hold 49% / rotate 49% / rigid 30% / pivot 29% / hinge 9%` + 严格原画保真 | 新增 **D02 商业矢量精准编排**（`A2D2_F02/03`）与 **D08L04 静态 SVG 注入编排** |
| **G2D-3** | 旧产物单文件 `index.html` 一锅炖，缺乏模块解耦与外部动效库编排 | `AnimWeb-Bench` 3–42 `<script>`、`anim2code` 45.5% 依赖 GSAP、`Webdev-Bench` 4–5 里程碑多文件演进 | 契约强制 **`≥3` JS 模块 + 本地预置 `vendor/gsap.min.js`** + **D08 多文件存量演进与换肤**（`A2D2_F11`） |
| **G2D-4** | 27B Base `usability / HUD` 仅 **`3.33/5`**，频繁出现 HUD 遮挡主体、文字裁切重叠 | `Webdev-Bench` 96 条视觉 + 90 条交互检查；多视口无重叠硬要求 | 纳入 `responsive_zero_overlap_reflow`、`anti_hud_and_text_overlap` 专项返修（`A2D2_F12`）与跨视口硬检 |
| **G2D-5** | 27B 在多轮视觉精修中 **`50%` 超时**，缺“看图定位→小步 `Edit`→验证收敛 EOS”闭环 | 长程任务需要 ≥2 轮视觉精修而不陷入死循环重写 | 设定 `min_visual_polish_cycles=2`、30% 存量演进 + 25% 深度时空返修 + 10% 健康零误伤对照 |
| **G2D-6** | 缺乏高表现力分层人物小品、光影视差画卷与精密等轴测/钟表工艺题材 | `MotionGraphicsBench` 人物/动物/弹性动画 + Awwwards 氛围视差页面 | 升级 **D05 分层关节角色与氛围光影**（`A2D2_F07/08`）与 **D07 精密钟表与等轴测剖面**（`A2D2_F10`） |

### 3.2 Track 3（CAD 参数化建模与 3D 打印）6 大能力缺口

| 缺口编号 | 本地 27B / 旧 `v1.1` 树实测短板 | 2026 外部样本对应的高标准要求 | `CadQuery-Tree v2.0` 针对性补齐 |
| --- | --- | --- | --- |
| **GCAD-1** | **6–15 面基础件已饱和**（Base `9/12` 通过），继续刷简单单件无增益 | `Zero-To-CAD` / `CADEvolve` 高面数复合特征 + `AssemblyBench` 多零件装配 | 设硬地板：**禁 6–15 面基础拉伸**；单件目标 **15–45+ B-rep 面**，装配体 **2–6 零件**、`≥5` 类不同 CAD 算子 |
| **GCAD-2** | **XZ↔XY 轴向画反（如管夹鞍座翻转）且看完 4 视图仍无法自查发现** | `BenchCAD` 实测 **72.5% 真实工业件在 `YZ`（40%）/`XZ`（32.5%）起草** | **强制起草基准配额：`XY 40% / XZ 30% / YZ 30%`** + `CAD2_F01/02` 专项多平面支架管夹 + `CAD_D08L03` 4 视图轴向修反 |
| **GCAD-3** | **内止口/凹槽方向反转**（如盒盖止口向上而非向下卡入底盒） | 多件配合件的凸台/止口/密封槽必须按严格间隙咬合 | 新增 **D02 多件抽壳机箱与下伸止口装配**（`CAD2_F03/04`）+ 剖视图 `section_view.png` 必查 |
| **GCAD-4** | **CadQuery/OCCT 工具报错数是优解的 `3.0×`（21 vs 7）**，拖慢耗时 `8×–14×` | 复杂倒角/抽壳/放样/扫掠需稳健选边、有序布尔与异常定位 | 设 `CAD2_F08/09`（回转/放样/扫掠/相交通孔）+ `CAD_D08L04` OCCT 拓扑崩溃与非水密壳深度返修 |
| **GCAD-5** | 旧 `v1.1` 几乎全为单文件单件，缺 **多模块装配体与零干涉布尔协调** | 2026 主流交付为 `STEP + 3MF` 多体工程（齿轮/导轨/铰链/夹具/联轴器） | 新增 **D03 机械传动装配体**（`CAD2_F05/06`）、**D04 导轨夹具装配**（`CAD2_F07`）与 **Tier 4 两两零干涉硬检** |
| **GCAD-6** | 缺 **正交三视图工程图逆向** 与 **保真既有配合接口的存量改型** | `IterCAD-Draw_1k`（工程图→CadQuery）与 `CADGenBench`（`input.step` 改型） | 新增 **D08L01 正交三视图逆向建模** 与 **D08L02 存量复杂装配体接口保真改型**（`CAD2_F11`） |

---

## 四、`v2.0` 两棵接地气分类树定版全貌（对齐小红书两层产品分类）

经人工复审收敛，两棵 `v2.0` 分类树彻底去除了过细的 40 叶具体物件模板与人工正交任务形态轴，对齐小红书 `3DCodeFactory` 原版 `taxonomy.json` 的接地气产品视角（**每轨 5 大类 × 4 二级词条 = 20 个直白词条**；`v1_1.json` 原样保留零回归）。所有多文件工程拆分、查找缺陷、多轮局部修改均在 50–150 轮长程闭环中自然发生；技术与几何硬门槛统一由 `P07` 出题器与沙盒验收器执行：

### 4.1 `Anim2D-Tree v2.0`（[anim2d_tree_v2_0.json](../../3d-animation-agent/configs/taxonomies/anim2d_tree_v2_0.json)）
- **1. 网页与产品展示（`Web & Product Pages`，20%）**：品牌官网主视觉（`A2D_D01L01`）· 新品发布页（`A2D_D01L02`）· 活动专题长页（`A2D_D01L03`）· 互动作品画廊（`A2D_D01L04`）
- **2. 科普教学与原理演示（`Education & Explainers`，20%）**：物理与天文实验（`A2D_D02L01`）· 数学与算法演示（`A2D_D02L02`）· 机械与工程原理（`A2D_D02L03`）· 生物与科学图解（`A2D_D02L04`）
- **3. 数据图表与业务看板（`Data & Dashboards`，20%）**：数据新闻故事（`A2D_D03L01`）· 商业指标看板（`A2D_D03L02`）· 地图与轨迹流转（`A2D_D03L03`）· 系统架构流程图（`A2D_D03L04`）
- **4. 商业动效与界面包装（`Motion & UI Design`，20%）**：品牌片头与标识（`A2D_D04L01`）· 图标与矢量插画动效（`A2D_D04L02`）· 动态海报与字幕（`A2D_D04L03`）· 软件界面交互演示（`A2D_D04L04`）
- **5. 故事短片与互动小品（`Stories & Playgrounds`，20%）**：角色动作短片（`A2D_D05L01`）· 城市与自然画卷（`A2D_D05L02`）· 互动分镜绘本（`A2D_D05L03`）· 音画与益智小应用（`A2D_D05L04`）

### 4.2 `CadQuery-Tree v2.0`（[cadquery_tree_v2_0.json](../../3d-animation-agent/configs/taxonomies/cadquery_tree_v2_0.json)）
- **1. 支架、夹具与结构件（`Brackets, Clamps & Mounts`，20%）**：安装支架与底座（`CAD_D01L01`）· 管夹与桌面夹具（`CAD_D01L02`）· 导轨与滑台组件（`CAD_D01L03`）· 钻孔与定位治具（`CAD_D01L04`）
- **2. 外壳、机箱与收纳盒（`Enclosures & Organizers`，20%）**：电子设备机箱（`CAD_D02L01`）· 上下盖扣合壳体（`CAD_D02L02`）· 仪器斜面控制台（`CAD_D02L03`）· 分格收纳盒与罐体（`CAD_D02L04`）
- **3. 机械传动与活动机构（`Gears & Mechanisms`，20%）**：齿轮与带轮组（`CAD_D03L01`）· 连杆与曲柄机构（`CAD_D03L02`）· 铰链与旋转关节（`CAD_D03L03`）· 联轴器与机械锁扣（`CAD_D03L04`）
- **4. 管路、散热与工业配件（`Pipes, Cooling & Hardware`，20%）**：法兰与管路接头（`CAD_D04L01`）· 风道与风扇导流罩（`CAD_D04L02`）· 散热器与百叶通风件（`CAD_D04L03`）· 手轮旋钮与紧固件（`CAD_D04L04`）
- **5. 桌面实用件与创客装备（`Maker & Everyday Gear`，20%）**：数码支架与理线器（`CAD_D05L01`）· 工具架与洞洞板挂件（`CAD_D05L02`）· 相机与电机云台件（`CAD_D05L03`）· 拼装模型结构件（`CAD_D05L04`）

---

## 五、下一步最小落地动作（紧接本调研）

1. **升级两轨验收与沙盒底座（零 API 费）**：
   - **2D 底座**：在离线沙盒预置本地 `vendor/gsap.min.js`，升级验收器支持本地 HTTP 多文件目录、借鉴 `MotionGraphicsBench`（MIT）补齐确定性时空/关节/裁切/零重叠断言，并提供 1 条命令 `renderAt(t) → Playwright + FFmpeg MP4` 导出脚本；
   - **CAD 底座**：在验收器补齐 **`STEP + 3MF` 四格式独立回读**、**Tier 4 两两零件零干涉布尔交集检验**，以及 **自动剖视图（`section_view.png`）与爆炸图（`exploded_view.png`）渲染**。
2. **用本地 `Qwen3.8-27B Base` 做免费难度过筛（杠杆 1）**：按 `v2.0` 树 12 核心族各合成首批候选高难题，先跑本地 27B 免费筛掉“基座自己已能高分做对”的假难题，确保 100% 教师 API 预算只打在真硬骨头上。
3. **3–5 题 Canary 哨兵校验后再扩产 Phase 1（152 + 156 题）**：每轨先跑 3–5 题全长程（`claude --bare`，单轮 `64K–128K` 上限，不卡轮数紧箍咒），核清真实单价、多轮 `Edit` 视觉精修深度与审美/机械精度天花板后，再批量推进。
