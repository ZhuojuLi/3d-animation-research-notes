# 真高难四方盲测（`realhard6_20261127`）尸检复盘与从 3D 迈向工业 CAD / 高精 2D 蒸馏总方案档案

> 公开整理版 · 2026-11-28。保留成文时点的记录；计划、文献结果和本地实测请分别理解。环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> **归档日期**：`2026-11-27`（§2 与 §4 已按 **Revision 3 / Option 2** 定版更新；§1 保留 `realhard6_20261127` 历史实测原件）  
> **文档性质**：项目侧权威基线归档与跨轨总方案执行底本（Project-Side Definitive Archive）  
> **Revision 3 / Option 2 唯一权威主方案**：[CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md](../../research/xhs-384k-to-200k-data-adaptation-20261127/CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md) · [OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md](../../research/xhs-384k-to-200k-data-adaptation-20261127/OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md)  
> **关联决策账本**：`decisions.md`（本地附件未发布） · [XHS-UNIFIED-SFT-STANDARD.md](XHS-UNIFIED-SFT-STANDARD.md) · [STANDARD-PARAMS.md](STANDARD-PARAMS.md) · [THREE-TRACK-DELIVERABLE-SPEC.md](THREE-TRACK-DELIVERABLE-SPEC.md)  
> **四方盲测公网可交互展厅（GitHub Pages）**：<https://zhuojuli.github.io/3d-animation-research-notes/realhard6-256k-20261127/>  
> **研究侧四分册蓝图（已对齐/引用 Option 2）**：[00 · 总蓝图](../../research/distill-3d-to-2d-cad-blueprint-20261127/README.md) · [01 · 384K 训练与 256K 沙盒](../../research/distill-3d-to-2d-cad-blueprint-20261127/01-sandbox-context-spec.md) · [02 · 工业 CAD 跃迁](../../research/distill-3d-to-2d-cad-blueprint-20261127/02-cad-capability-plan.md) · [03 · 高精 2D 与三轨配比](../../research/distill-3d-to-2d-cad-blueprint-20261127/03-2d-capability-and-mixing-plan.md)

---

## Section 1 · `realhard6_20261127` 四方真高难盲测全量账本、尸检复盘与历史假阳性勘误

为彻底检验前沿大模型在**真实工业多零件 CAD 装配/逆向（BenchCAD 2.1）**与**小红书 `3DCodeFactory` 超长程 3D 场景构建（`Three.js r180` + `Blender 4.2.10 LTS bpy`）**上的真实天花板与失效机理，我们在完全离线的纯净隔离沙盒中完成了 `6 题 × 4 方`（`Oracle GT / XHS DeepSeek-V4.1-Flash Teacher` vs `Claude-Opus-5-5` vs `Kimi-K3.1-Pro` vs `AGY`）头对头实测。*（历史实测注记：`realhard6_20261127` 当时运行于历史 `220K / 85%` 沙盒水位，现行 Option 2 沙盒水位已统一收紧为 `208000 / 80% / 32768 / MAX_TOOL_RESULT_TOKENS=16384`，下表实测数据原样留档。）*

- **一手原始评测数据**：`summary.json`（本地附件未发布） · `agy_stats.json`（本地附件未发布） · `data.json`（本地附件未发布） · `all_summaries.json`（本地附件未发布） · `run_summary.json`（本地附件未发布）
- **线上实时 3D WebGL / GLB / 工程图四方对比展厅**：<https://zhuojuli.github.io/3d-animation-research-notes/realhard6-256k-20261127/>

### 1.1 Track A · BenchCAD 2.1 工业装配与全视图逆向四方实测全表

| 任务 ID 与工程设定 | 对照方 | 主指标总分 | `avg_part` | `asm_v1` | 体素 `IoU`（对齐 / 原始） | 实例位姿命中 `hit` | `rubric × part_gen` | 交付实体数 / Python LoC | 轮数 / 压缩次数 / 审图数 | 估算轨迹 Tokens / 耗时 |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`bc_t5_shear25`**<br>25 实例气动剪切单元<br>（总装图 + `5` 张非标零件图 + `16` 个去姿态 STEP；主指标 `part_x_asm_v1`） | **Oracle GT** *(BenchCAD 官方真值)* | **`1.0000`** | `1.0000` | `1.0000` | `1.0000` | `25 / 25` (`1.000`) | *(论文基线：Opus `0.6613` · Astra `0.6902`)* | `25` 实体 / — | — | — |
| | **Claude-Opus-5-5** *(上游 `200K` 上限)* | `0.0121` | `0.7547` | `0.0160` | `0.3216` (`raw 0.0470`) | `0 / 25` (`0.000`) | `0.5319 × 0.9151 = 0.4867` | `25` 实体 / `76` LoC | `115` 轮 / `0` 压 / `50` 图 | `157,838` tok / `3,856.5s` |
| | **Kimi-K3.1-Pro** *(受限窗自动压缩)* | `0.0087` | `0.4775` | `0.0182` | `0.3816` (`raw 0.0888`) | `0 / 25` (`0.000`) | `0.4701 × 0.9306 = 0.4374` | `25` 实体 / `242` LoC | `253` 轮 / **`30` 压** / `122` 图 | `609,388` tok / `4,391.0s` |
| | 🏆 **AGY** *(独立沙盒子智能体)* | **`0.9703`** | **`0.9997`** | **`0.9706`** | **`0.9997`** (`raw 0.0765`) | **`25 / 25` (`1.000`)** | **`0.9840 × 0.9719 = 0.9564`** | `25` 实体 / `351` LoC | `53` 轮 / `0` 压 / `44` 图 | `329,792` tok *(峰值同)* |
| **`bc_t4_chuck9`**<br>9 实例三爪自定心卡盘逆向<br>（`0` 个 STEP，`7` 类零件，`3°–8°` 相机微扰四视图，`scale=free`；主指标 `part_x_asm_v1`） | **Oracle GT** *(BenchCAD 官方真值)* | **`1.0000`** | `1.0000` | `1.0000` | `1.0000` | `9 / 9` (`1.000`) | *(论文基线：Opus `0.4402` · Astra `0.5013`)* | `9` 实体 / — | — | — |
| | **Claude-Opus-5-5** *(上游 `200K` 上限)* | `0.0073` | `0.0634` | `0.1147` | `0.0889` (`align 0.0975`, `×1.9608`) | `0 / 9` (`0.000`) | `0.3551 × 0.3085 = 0.1096` | `12` 实体 *(断裂)* / `364` LoC | `173` 轮 / `0` 压 / `53` 图 | `131,833` tok / `4,573.1s` |
| | **Kimi-K3.1-Pro** *(受限窗自动压缩)* | `0.0190` | `0.2133` | `0.0890` | `0.5393` (`×0.9390`; `full 0.4866`) | `0 / 9` (`0.000`) | `0.5686 × 0.6813 = 0.3874` | `9` 实体 *(`topo=0.04`)* / `335` LoC | `280` 轮 / **`30` 压** / `133` 图 | `616,350` tok / `3,971.5s` |
| | 🏆 **AGY** *(独立沙盒子智能体)* | **`0.1597`** | **`0.5044`** | **`0.3165`** | `0.0962` (`×1.9900`; **`full 0.8689`**) | `0 / 9` (`0.000`) | `0.3401 × 0.3297 = 0.1121` | `9` 实体 / `490` LoC | `80` 轮 / `0` 压 / `63` 图 | `393,542` tok *(峰值同)* |
| **`bc_t2_dual36`**<br>36 实例 / 37 实体双皮带总装<br>（`20` 个去姿态 STEP + 含 `part_11` 双实体复合陷阱 + 多剖面总装图；主指标 `asm_v1`） | **Oracle GT** *(BenchCAD 官方真值)* | **`1.0000`** | `1.0000` | `1.0000` | `1.0000` | `36 / 36` (`1.000`) | *(论文基线：Opus `0.6665` · Astra `0.7207`)* | `37` 实体 / — | — | — |
| | **Claude-Opus-5-5** *(上游 `200K` 上限)* | `0.0888` | `1.0000` | `0.0888` | `0.2022` (`raw 0.0215`; Kabsch `0.7672`) | `0 / 36` (`0.000`) | `0.8586 × 1.0000 = 0.8586` | `37` 实体 / `233` LoC | `271` 轮 / **`1` 压** / `94` 图 | `235,595` tok / `4,262.6s` |
| | **Kimi-K3.1-Pro** *(受限窗自动压缩)* | `0.0049` | `1.0000` | `0.0049` | `0.2050` (`raw 0.0105`; `full 0.1470`) | `0 / 36` (`0.000`) | `0.6415 × 1.0000 = 0.6415` | `37` 实体 / `220` LoC | `320` 轮 / **`36` 压** / `145` 图 | `782,443` tok / `4,800.5s` |
| | 🏆 **AGY** *(独立沙盒子智能体)* | **`0.9387`** | **`1.0000`** | **`0.9387`** | **`1.0000`** (`raw 0.0330`; `full 0.9994`) | **`36 / 36` (`1.000`)** | **`0.9941 × 1.0000 = 0.9941`** | `37` 实体 / `150` LoC | `59` 轮 / `0` 压 / `43` 图 | `335,688` tok *(峰值同)* |

### 1.2 Track B · 小红书 `3DCodeFactory` 超长程 3D 场景与资产四方实测全表

*(注：`XHS Teacher` 列同时记录去重有效轨迹净 Token [`938K / 1,161K / 960K`，见 `showcase data.json`] 与跨 `compact_boundary` 全分段累计输入 Token [`1,992,719 / 2,779,244 / 2,050,241`，见 `summary.json`]。)*

| 任务 ID 与引擎协议 | 对照方 | 工程文件数 / 代码行数（LoC） | 三维网格规模（Objects / Meshes / Verts / Polygons / Mats） | 运行时与交付状态 | 轮数 / 压缩次数 / 审图数 | 轨迹 Tokens / 耗时 |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **`xhs_e30_garage_3js`**<br>经典车修复车间与可升降双柱举升机宝马 E30<br>（`Three.js r180` · `train-00015`） | **XHS Teacher** *(`DeepSeek-V4.1-Flash` · `384K×5` 段)* | `2` 文件 / `1,659` LoC | 实时程序化 WebGL 场景 | ✅ `runtime_clean=true` | `736` 轮 / `4` 压 / `287` 图 | `938,000` 净 tok<br>*(`1,992,719` 分段累计)* |
| | **Claude-Opus-5-5** *(同沙盒对照)* | `15` 文件 / `1,108` LoC | 实时程序化 WebGL 场景 | ⚠️ 网关 `504` 超时中断<br>*(续跑恢复 `runtime_clean=true`, 缺 `final.png`)* | `81` 轮 / `0` 压 / `13` 图 | `98,509` tok / `5,105.3s` |
| | **Kimi-K3.1-Pro** *(受限窗自动压缩)* | `7` 文件 / `718` LoC | 实时程序化 WebGL 场景 | ✅ `runtime_clean=true` · 完整交付 | `365` 轮 / **`25` 压** / `106` 图 | `654,246` tok / `4,799.9s` |
| | **AGY** *(独立沙盒子智能体)* | `7` 文件 / **`4,382` LoC** | 实时程序化 WebGL 场景 | ✅ `runtime_clean=true` · 完整交付 | `56` 轮 / `0` 压 / `26` 图 | **`227,061` tok** *(单段 `<256K`!)* |
| **`xhs_chapel_ruins_3js`**<br>落日逆光山间石砌教堂拱门废墟与烛火枯草交互<br>（`Three.js r180` · `train-00056`） | **XHS Teacher** *(`DeepSeek-V4.1-Flash` · `384K×7` 段)* | `8` Web 文件 (`3,807` LoC)<br>*(含 5 辅助脚本共 `4,608` LoC)* | 实时程序化 WebGL 场景 | ⚠️ 分片重建 `wrapS` 贴图缺失报错 *(原轨迹终帧已落盘)* | `1,005` 轮 / `6` 压 / `359` 图 | `1,161,000` 净 tok<br>*(`2,779,244` 分段累计)* |
| | **Claude-Opus-5-5** *(同沙盒对照)* | `15` 文件 / `955` LoC | 实时程序化 WebGL 场景 | ⚠️ 网关 `504` 超时中断<br>*(续跑恢复 `runtime_clean=true`, 缺 `final.png`)* | `101` 轮 / `0` 压 / `13` 图 | `91,332` tok / `5,105.8s` |
| | **Kimi-K3.1-Pro** *(受限窗自动压缩)* | `7` 文件 / `1,040` LoC | 实时程序化 WebGL 场景 | ✅ `runtime_clean=true` · 完整交付 | `384` 轮 / **`15` 压** / `55` 图 | `502,153` tok / `4,458.4s` |
| | **AGY** *(独立沙盒子智能体)* | `7` 文件 / **`3,595` LoC** | 实时程序化 WebGL 场景 | ✅ `runtime_clean=true` · 完整交付 | `41` 轮 / `0` 压 / `16` 图 | **`214,011` tok** *(单段 `<256K`!)* |
| **`xhs_headland_set_bpy`**<br>海角冷雨剑斗撤场电影片场<br>（`Blender 4.2.10 LTS bpy` + `scene_spec.md` · `train-00009`） | **XHS Teacher** *(`DeepSeek-V4.1-Flash` · `384K×5` 段)* | `6` 文件 / `2,940` LoC<br>*(`2,800` Python LoC)* | 官方终帧已核验 | ✅ 完整 `.py` 重建套件 | `713` 轮 / `4` 压 / `299` 图 | `960,000` 净 tok<br>*(`2,050,241` 分段累计)* |
| | **Claude-Opus-5-5** *(同沙盒对照)* | `9` 文件 / `1,404` LoC | `30` obj / `27` mesh / `989,043` verts / **`999,362` polys** / `22` mats | ✅ `.blend + .glb + final.png` 全齐 | `139` 轮 / `0` 压 / `32` 图 | **`187,404` tok** / `4,830.1s` |
| | **Kimi-K3.1-Pro** *(受限窗自动压缩)* | `4` 文件 / `1,033` LoC | `602` obj / `535` mesh / `221,592` verts / **`234,740` polys** / `28` mats | ✅ `.blend + .glb + final.png` 全齐 | `463` 轮 / **`16` 压** / `68` 图 | `611,225` tok / `4,906.7s` |
| | **AGY** *(独立沙盒子智能体)* | `6` 文件 / **`2,884` LoC** | `30` obj / `26` mesh / `318,355` verts / **`314,904` polys** / `23` mats | ✅ `.blend + .glb + final.png` 全齐 | `53` 轮 / `0` 压 / `29` 图 | `280,161` tok *(峰值同)* |

### 1.3 四方盲测深度尸检：为什么 3D 强模型在工业 CAD 上雪崩，而 `AGY` 实现 `0.9703 / 0.9387` 破局？

1. **纯肉眼看渲染图 vs OCCT 解析内省 + HLR 工程图红线像素叠图（`bc_t5_shear25` & `bc_t2_dual36`）**：
   - 在 3D 赛道，三家前沿模型均能交付视觉自洽、零报错的多模块工程；但在工业 CAD 装配上，`Opus-5.5`（`T5` 单件 `0.7547` $\to$ 装配 **`0.0160`**, `0/25` 命中；`T2` 电机与同步带误按 `-Y` 横放而非 `-Z` 竖放，**`0.0888`**, `0/36` 命中）与 `Kimi-K3.1-Pro`（`T5` **`0.0087`**；`T2` 漏掉 6 个底座 `part_01` 左右交替翻转及轴承 `±1.0 mm` 偏置，**`0.0049`**, `0/36` 命中）双双崩盘。
   - 根因在于工业工程图存在 **① 第一视角（ISO-E）vs 第三视角（ISO-A）沉头孔正反面歧义**（如 `T5` `part_16` 正反双侧异径沉头孔，`Opus` 漏做沉头得 `0.3121`、`Kimi` 同侧错放得 `0.1653`）、**② 去姿态外购 STEP 随机 `90°` 旋转手性陷阱**，以及 **③ 单 STEP 多实体复合陷阱**（`T2` `part_11.step` 含 `2` 独立实体，总计 `37` 实体）。
   - `AGY` 之所以斩获 **`0.9703`（`25/25`）** 与 **`0.9387`（`36/36`）**，是因为它摒弃了肉眼猜着色渲染图，直接调用 `OCP.BRepAdaptor_Surface` 提取孔/轴/锥角精确参数、在 `hires/` 原图建立亚像素标尺（`26.8000 px/mm` / `2.3832 px/mm`）、用 **`OCP.HLRBRep_Algo` 将可见实线与隐藏虚线以红线直接叠绘回 `hires/drawing.png` 逐像素核对**，并执行全配对 `BRepAlgoAPI_Common` 布尔求交验干涉。
2. **`bc_t4_chuck9` 全模型 `< 0.16` 的精确死因拆解**：
   - `Opus`（`0.0073`, 导出 `12` 个断裂实体）与 `Kimi`（`0.0190`, 圆环假齿非流形 `topo = 0.04` 且三爪同相位复制）均未标定 `3°–8°` 相机微扰。
   - `AGY` 虽通过椭圆与对称点标定 4 台微扰相机达 `< 0.1 px` RMS 且总装对齐 `iou_full = 0.8689`（`cover = 0.9934`, `body = 0.8918`, `jaw_1 = 0.8150`），但踩中**两大可根治机制坑**：① **非正交局部系烘焙陷阱**——将 `jaw_2` (`120°`)、`jaw_3` (`240°`)、`pinion` (`60°`) 的装配旋转直接烤进 `submission/parts/*.step` 并提交单位阵 `I4`，而官方 `avg_part` 的 `iou24_aligned` 仅搜索 24 种 `90°` 立方体旋转，数学上无法抵消 `60°/120°` 旋转，导致真值 `>0.82` 的零件得分暴跌至 `0.2000–0.2304`；② **二值外轮廓对内部特征致盲**——仅比对 `rgb < 250` 外轮廓，看不见 `scroll_plate` 内部阿基米德涡卷圈数与背面锥齿（`scroll_plate = 0.2000`）。
3. **`Kimi` `30–36` 次压缩死循环的三重工程病灶**：
   - `Kimi` 在受限窗口下跑通 `502K–782K` tokens 实锤了“单段窗口不封顶总视界”，但在 BenchCAD 耗时 `64.9%–79.1%`（`2,576s–3,523s`）卡在压缩上，源于：① `Claude Code` 对未注册模型名默认回退 `200,000` 上限导致 `141K–174K` 过早触发压缩；② 未限流 `MAX_PIXELS` 连续 `Read` `122–145` 张百万像素原图（6 轮即打爆窗口）；③ 纯散文递归 `/compact` 抹除了 `4×4` `SE(3)` 矩阵与投影制式，引发每 8 轮失忆重量的恶性循环。

### 1.4 历史阶段评测假阳性正式勘误与替代声明（Superseding Notes on `hell6` & `Canary-12`）

> [!WARNING]
> **正式勘误与口径替代（Superseding Notice）**：经今日 `realhard6_20261127` 硬基准对照与人工逐帧/逐源码尸检，早期 `summary-all.json`（本地附件未发布） 与 [CANARY-12-AND-AGY-PROBE-REPORT-20261127.md](CANARY-12-AND-AGY-PROBE-REPORT-20261127.md) 中的以下三类“高分通过”被确认为**合成喂饭或验证器漏筛导致的假阳性（False Positives）**。本文档正式纠偏并取代上述旧报告中的乐观结论：

1. **勘误 1 · `hell6` 自造文本公式 CAD 题失效**（`setup_hell6_workspaces.py`（本地附件未发布） / `summary-all.json`（本地附件未发布））：
   - **假象与病灶**：题干直接把闭式数学方程（如 `Rc(u) = 68 + 28u`、`A(u) = 460 + 1440u`、精确孔位坐标）喂在纯文本里；`Kimi` 中位轨迹仅 `130.7K` tokens（`0` 压缩），`t3_tandem_inducer` 与 `t4_volute_casing` 全程仅看图 `3–4` 次并双双超时（`exit 143`）。此类题目只考 Python 公式翻译，完全不训练工程图读图、视角判别与去姿态装配，**即日起永久废止，全面切换至反喂饭逆向合成工厂（`S1–S4`）**。
2. **勘误 2 · `Canary-12` 玛瑙展柜（`xhs_anchor_agate_2d`）`0.910` 透视分裂刷分假阳性**（`judgement.json`（本地附件未发布））：
   - **假象与病灶**：旧管线打出 `s_vis = 1.00, mean = 0.910`（`113` 轮、`153.8K` tok），但源码实查发现斜拍两点透视参考图被拆成 **5 套互殴局部坐标系**——左侧 `0°` 正立面展柜 + `-0.68` 硬错切地图卡 + 右上斜吊顶下贴 `0°` 正面展板 + 四边不交汇歪四边形台面 + 纯 2D 正侧面胶囊形抛光机；同时 `check_2d_v2.mjs`（本地附件未发布） 漏检全部 Canvas `fillText`（`checked_labels = 0`），VLM 裁判仅按“物件存在清单”打勾给满分。
3. **勘误 3 · `Canary-12` 复古铸铁双螺杆齿轮纸张压机（`xhs_anchor_press_cad`）`0.960` 静态死壳假阳性**（`canary12-detailed-metrics.json`（本地附件未发布））：
   - **假象与病灶**：仅 `26` 轮、`71.6K` tok 即凭静态单态 `0.0 mm³` 零干涉拿到 `0.960`，但对照实拍原图：右侧**上下垂直啮合正齿轮**被画成**左右水平双齿轮**，两侧立柱实心侧墙**完全缺失供压辊升降的垂直导槽**，双螺杆顶丝悬死在横梁上与上压辊毫无真实运动副耦合——证明静态零干涉与单纯帧哈希变化（`uniqueStageFrames >= 3`）完全无法拦截“焊死装饰外壳”。
4. **勘误 4 · `Canary-12` 跨江四线轨交数字孪生调度台（`anim2d_v2_11`）`1.000` 低幼玩具饱和**（`pruned_low_difficulty_2d.jsonl`（本地附件未发布））：
   - **假象与病灶**：仅 `49` 轮、`120.0K` tok 即拿 `1.000` 五维满分。此类节点连线发光跑圆点拓扑图与常规四卡 KPI 折线柱状图缺乏空间透视与连续物理约束，基座早已会写，**已连同 `anim2d_v2_09 / 10 / 12` 永久打入 `0%` 封杀黑名单**。

---

## Section 2 · Option 2 架构规范：全链路 `Static YaRN 1.5×` 不切分硬训 `384K` + `256K` 沙盒（`208K / 80% / 16384`）与结构化状态账本

> **完整技术专册**：[CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md](../../research/xhs-384k-to-200k-data-adaptation-20261127/CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md) · [OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md](../../research/xhs-384k-to-200k-data-adaptation-20261127/OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md) · [01-sandbox-context-spec.md](../../research/distill-3d-to-2d-cad-blueprint-20261127/01-sandbox-context-spec.md) · **历史 Rev 1/2 归档账本**：[archive/joint-consolidation.md](../../research/xhs-384k-to-200k-data-adaptation-20261127/archive/joint-consolidation.md) · [archive/empirical_audit_200k_ledger.json](../../research/xhs-384k-to-200k-data-adaptation-20261127/archive/empirical_audit_200k_ledger.json) · [archive/a100-experiments/exp1_gpu1_verified_results.json](../../research/xhs-384k-to-200k-data-adaptation-20261127/archive/a100-experiments/exp1_gpu1_verified_results.json)

### 2.1 为什么全链路定版 Option 2（`Static YaRN 1.5×` 硬训 `384K` + `256K` 沙盒），废除切分与非标 `200K`？

1. **数学证明与 `32×H100` 物理实测彻底推翻 Rev 2 切分顾虑**：
   - 学生底座 `${MODEL_ROOT}/Qwen3.8-27B`（`48` 层 `GatedDeltaNet` + `16` 层全注意力 + `27` 层 `ViT+Aligner`）中仅 **`6.25%`** 注意力头维度使用 RoPE；开启 **`Static YaRN 1.5×`**（`max_position_embeddings=393216, factor=1.5, original_max_position_embeddings=262144, mrope_interleaved=true, mrope_section=[11,11,10], partial_rotary_factor=0.25, rope_theta=10000000`）仅对 `3.32%` 维度做温和 `1.5×` 插值，全参 SFT 后在 `≤256K` 残余误差 `<0.5%`，且**彻底消除 `HCPF-Lite` 切分带来的 `200K–384K` 因果泄漏（Off-Policy Causal Leakage）**。
   - **全链路训推同构铁律**：Stage 1、Stage 2、8 卡 Canary、Stage 3 RL、Stage 4 RFT 与 `vLLM` 推理必须保留完全一致的 **`Static YaRN 1.5×` `config.json`**，**严禁剥离 `rope_scaling` 或改用 Dynamic YaRN**。
   - **`32×H100` `[8, 20, 20, 16]` 实测稳跑 `384K`**：`start-full-32g-s3-v1` Step 1 已物理跑通完整 `384K`（`applied=True, loss=1.0625, grad_norm=1.5135, 17.82M T_in, 11.58M U [65.0%], peak_alloc=61.97 GiB, peak_reserved=73.48 GiB`）。正式拓扑锁定 `TP=4, PP=4, CP=2, DP=1, SP=true` + 非对称切层 **`[8, 20, 20, 16]`**（`PP0 ~68 GiB / PP3 ~50 GiB`）+ `recompute=full/uniform/1` + `vit_gradient_checkpointing=true` + `AdamW (0.9/0.95, wd=0.1, clip=1.0)` + FP32 `main_grad` + `optimizer_cpu_offload=true` + `LM_HEAD_LOSS_CHUNK_SIZE=16384` + 2D 装箱守卫 `(tok <= 393216, img <= 80)`；**严禁 `FP8 / tp_comm_overlap / VPP=2 / recompute_num_layers=2 / Muon`**。
2. **「训练窗口（`384K`）」与「造数/评测/线上沙盒（`256K`）」解耦 + 四项沙盒硬约束**：
   - **代理层显式注册 `262,144` 模型窗口**：在 `logging_proxy` 模型表中将 `kimi-k3.1-pro` 等自定义教师显式声明为 `262,144`，根除 Claude Code 未知模型回退 `200,000` 导致 `141K–174K` 早产压缩的隐藏 Bug。
   - **`208K / 80%` 自动压缩水位与 `16384` 工具截断（+ `vLLM 327680` 防爆垫）**：沙盒统一设定 `AGENT_CONTEXT_WINDOW_TOKENS=262144`、**`CLAUDE_CODE_AUTO_COMPACT_WINDOW=208000`**、**`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80`**、`CLAUDE_CODE_MAX_OUTPUT_TOKENS=32768`、**`MAX_TOOL_RESULT_TOKENS=16384`**（`208K + 16.4K + 4K + 32.8K = 261.2K < 262,144`，零溢出；所有压缩提示词**严禁写死 `/384K` 或 `/256K` 绝对分母**）；多卡 `vLLM`（`TP >= 2`）保留相同 `Static YaRN 1.5×` `config.json` 并设 **`--max-model-len 327680`**（或 `393216`）+ `--enable-prefix-caching --mamba-cache-mode align`。
   - **视觉载荷纪律（`MAX_PIXELS=401408`）**：强制 `~512` 视觉 tokens/图 + 5 关键帧 / `4–6` 宫格拼图（每段 `8–16` 次 `Read`），使单个 `256K` 段稳定容纳 **`60–110` 个实质编码/审图轮**，单道超难题仅需 **`1–3` 次压缩**即可跑完 `500K–900K` 总视界（压缩耗时从 `~3,500s` 降至 `<180s`）。
   - **首轮神圣钉死 + 赛道结构化状态账本（`./work/*_state_ledger.json`）原样钉入 `<summary>` 第 6 节**：`logging_proxy` 永久锁定 `messages[0..1]`（原始需求 + `I_ref`），并在每次压缩前将沙盒脚本生成的确定性 JSON 账本原样嵌入 9 节 `<summary>` 第 6 节代码块：
     - **CAD 账本**（`./work/cad_state_ledger.json`，兼容 `work/cad_state.json`）：ISO-E/ISO-A 投影制式、`px/mm` 标尺、各 `part_id` B-Rep 局部主轴/孔轴表、已锁 `4×4` $T_i \in SE(3)$（$\det(R)=+1$）、配对干涉 `mm³` 与各视图 HLR 叠图残差；
     - **2D 账本**（`./work/anim2d_state_ledger.json`）：`projection_mode`、共享相机 `{eye, target, fovDeg}` 或灭点 `VP1/VP2`、主分区 BBox、齿轮齿数比/导槽上下界拓扑图、`renderAt(t)` 状态哈希与未清零硬检项；
     - **3D 账本**（`./work/scene3d_state_ledger.json`）：Collection 顶点/面片审计表、对齐 `I_ref` 的相机外参、PBR 材质灯光表与交互控件断言结果。

### 2.2 小红书 `384K` Phase-0 零丢弃清洗（废止 `HCPF-Lite`）与 `Opus-5.5` `200K` 混拼法则

- **废止 `HCPF-Lite@256K` 切分，改为 Option 2 Phase-0 CPU 零丢弃清洗（约 1 小时，`100%` 不切分存活）** *（历史 `HCPF-Lite` 归档脚本见 `exp2_build_and_verify_hcpf_lite_256k.py`（本地附件未发布））*：
  - 对 `7` 张 `AR >= 200` 异常图做 letterbox pad（救回 `12` 条段）；
  - `384K compact_task` 历史空 `<think>` 瘦身（`P90 406K -> 244K`，挽救 `37.8%` 压缩样本）；
  - 修正 `"-main-agent-"` -> `"-agent-"` 剔除漏网 `8` 条子代理段并去重 `retry02`；
  - 对 `~335` 条（`1.93%`）`393K–402K` 轻微超限段仅裁剪远端 `<10K` 无关 `loss=False` 刷屏日志（**不切分进 `256K`，实现 `100%` 存活**），再按 `PACK_LEN = 393,216`（`94%` 填充 = `369.62K`/包）+ `(tok <= 393216, img <= 80)` 装箱。
- **`256K compact_task` 瘦身准入**：仅对 `loss=False` 历史轮做空 `<think>` 瘦身（`CAD 256K` 从 `195K` 压至 `120K`，`U=3.5K`；`2D 256K` 压至 `125K`，`U=4.0K`），经 `logging_proxy_to_swift.py --keep-compact-tasks` 保留；
- **双教师 `80–85% kimi + 15–20% Claude-Opus-5-5` 混拼**：`Opus-5-5` 上游硬卡 `200,000` tokens，**100% 保留其执行段（`91K–190K`）** 与新产 CAD/2D 段在 `ms-swift 4.5.2` `PACK_LEN=393,216`（FA2 + GDN `cu_seqlens` + 样本独立 3D `mRoPE`）中同锅混拼，**剔除 `Opus` 在 `~148K` 早触发的 `compact_task` 段**，确保学生压缩水位唯一锁死在 `208K / 80%`。

---

## Section 3 · 从 3D 跃迁至工业 CAD 与高天花板 2D 的确定性工具链与造数规范

> **完整技术专册**：[02-cad-capability-plan.md](../../research/distill-3d-to-2d-cad-blueprint-20261127/02-cad-capability-plan.md)（工业 CAD） · [03-2d-capability-and-mixing-plan.md](../../research/distill-3d-to-2d-cad-blueprint-20261127/03-2d-capability-and-mixing-plan.md)（高精 2D/2.5D）

### 3.1 Track 2 · 3D $\longrightarrow$ 工业参数化 CAD 与精密装配跃迁方案（`CadQuery 2.6.1 / OCCT B-Rep`）

1. **前置必修补丁（`cad_inspect.py`（本地附件未发布） 等 Option 2 §0 #8 5 处修复 + `verify_frontier_cad.py:243`）**：
   - 现行 `_check_pairwise_brep_interference` 中 `if not common.IsDone(): continue` 会把自交/退化流形导致的 OCCT 布尔求交失败静默当成 `0.0 mm³` 零干涉放行。**Day 1 立即修补为硬抛出 `brep_boolean_failed` + 体素兜底（直判 `L2` 碰撞淘汰）**，并将在线检查默认切至 `--no-render`（`<0.8s` 极速路径）；同步补齐 `BRepExtrema_DistShapeShape` 单连通组件（`≤1.0mm`）与 `0.15–0.60mm` 配合间隙、`BRepCheck_Analyzer.IsValid()` + 正向有符号体积 + 子件最小体积 `≥ max(50mm³, 0.5%)`、**L576–604 `--probe` 失败与零变化（`max(|Δdims|)<0.05 & |Δvol|<1.0`）写入 `issues` 硬拦截**、子进程 AST 封禁 `bpy/bmesh/importStep`、升级 6 视角渲染（含底视/后视 + `flatShading`），以及修复 `verify_frontier_cad.py:243` 流道空腔体积公式。
2. **沙盒内置确定性计量工具箱 `tools/cad_kit.py`（固化 `AGY` `0.9703 / 0.9387` 制胜闭环）**：
   - `inspect_steps`：基于 `OCP.BRepAdaptor_Surface` + `TopAbs_REVERSED` 自动输出 `n_solids = len(shape.Solids())`（秒抓 `part_11` 双实体陷阱）、内孔 `BORE` vs 外轴 `SHAFT` 直径/轴线/轴向区间、圆锥半角（区分 `45°` 倒角、`90°` 沉头锥与 `59°/118°` 盲孔钻尖）及有向平面法向表；
   - `calibrate_sheet`：在 `2x` `hires/` 母图上通过 1D 深色像素游程聚类标定亚像素比例尺 `px_per_mm`（精度 `1e-4`）与基准原点，精确量取盲孔虚线肩深与键槽相位角；
   - **`hlr_overlay`（工程图红线像素叠图核心利器）**：调用 `OCP.HLRBRep_Algo` + `GCPnts_QuasiUniformDeflection(0.05)` 提取精确可见轮廓线（`VCompound / OutLineVCompound`）与虚线隐藏线（`HCompound`），以 `#ee1133` 矢量红线直接叠绘在 `55%` 灰阶半透明 `hires/drawing.png` 参考图上，同步返回双向边缘距离场残差 `hlr_chamfer_mm`，任何第一/第三视角沉头反置或 `90°/180°` 手性翻转在数值和肉眼下瞬间暴露；
   - `verify_submission`：**100% 对齐官方评分器，强制从 `submission/parts/<part_id>.step × submission/assembly/instances.json` 冷重建**（绝不轻信辅助 `assembly.step`），核验 BOM 实例配对、`det(R) = +1` 刚体变换、**正交局部系偏角告警（拦截 `15°–75°` 非正交烘焙）**、全配对 `BRepAlgoAPI_Common` 干涉体积（含 `!IsDone()` 拦截）、同轴孔轴偏心表与主配合面 `BRepAlgoAPI_Section` 剖切图，并自动同步更新 `./work/cad_state_ledger.json`。
3. **攻克 `T4` 零 STEP 微扰多视图逆向的四阶管线（将 `bc_t4_chuck9` 从 `0.1597` 拉升至 `0.72–0.85+`）**：
   - **Stage 1 · `cad_kit.fit_cameras` 椭圆与对称色块 PnP 联合标定**：利用轴对称件外圆投影椭圆长短轴比 $|\sin\phi_q| = b_q/a_q$ 与倾角 $\psi_q$，结合 `_in_assembly.png` 红色高亮实例 N 重对称质心 `least_squares` 束平差，将 `3°–8°` 微扰相机标定至 `<0.1 px` RMS / `<0.05°`；
   - **Stage 2 · 三通道边缘距离场逆向目标**：将单一二值外轮廓升级为 $\mathcal{L}_{\text{MV}} = (1 - \mathrm{IoU}_{\text{sil}}) + \lambda_{\text{edge}}\,\mathrm{CD}_{2\text{D}}(\mathcal{E}_{\text{HLR}}, \mathcal{E}_{\text{ref}}) + \lambda_{\text{red}}(1 - \mathrm{IoU}_{\text{red\_in\_assy}})$，用内部可见 HLR 折痕边缘距离场锁死涡卷圈数、沉槽深度与锥齿数；
   - **Stage 3 · `tools/mech_primitives.py` 水密单实体标准机构库**：内置精确渐开线直/斜/内齿轮、圆锥/冠齿轮（根部 `0.15 mm` 嵌入融合零碎面）与带精确 `1/3` 螺距径向相位差 $\Delta r_k = \frac{k-1}{3}p$ 的阿基米德涡卷卡爪单实体模板（`topo = 1.0`）；
   - **Stage 4 · 强制 `iou24` 正交局部系导出守卫**：硬契约规定 `submission/parts/<part_id>.step` 必须在对齐 `_alone.png` 的 `{±X, ±Y, ±Z}` 标准正交局部系下导出，所有 `60° / 120° / 240°` 非正交装配旋转**只准写入 `submission/assembly/instances.json`**（仅修正此一条即可将 `AGY` 现有 `T4` 几何从 `0.1597` 直接恢复至 `0.72+`）。
4. **Option 2 CAD 规模档位（`MVP 300 / Standard 600 [推荐] / Scale 1,200`，Tier A `20%` / Tier B `45%` / Tier C `20%` / Tier D `15%`，反喂饭逆向合成工厂 `S1–S4` $\to$ `C1–C5`，零牌照污染 / 零 OOD 泄漏）**：
   - 彻底剥离生成源码与文本公式，单件复杂度地板 `≥25` B-rep 面、`≥4` 类 OCCT 特征操作，强制非 XY 起草基准 **`XY 35% / XZ 35% / YZ 30%`**（[MASTER-PLAN](../../research/xhs-384k-to-200k-data-adaptation-20261127/OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md) §1.1）；从真实水密多零件 B-Rep 总成逆向出发，打乱外购件至 AABB 中心并施加随机 $R \in \mathrm{SO}(3)_{24}$（混入 `20%` 左右手性对、`15%` 单文件双实体陷阱、`25%` 非 `90°` 键槽/皮带相位角），用 `OCCT HLR + BRepAlgoAPI_Section` 自动渲染带公差/沉头标注的 **`50%` 第一视角（ISO-E）/ `50%` 第三视角（ISO-A）** `4200px` `hires/` 工程图与 `10%` 重叠切片；
   - 四大合规种源（严锁 `BenchCAD`、`CADGenBench`、**`IterCAD` 仅用 shards `1–4`——Shard 5 `IterCAD-Draw_1k` 永久隔离作 OOD**，禁用 NC 条款库）：`80%` 全新沙盒合成（`S1` 程序化机构逆向 + `S2` 开源 STEP 总成 + `S3` `Zero-To-CAD / CADEvolve` 种子经我方 `256K` 教师重跑 + `S4` `U(3°,8°)` 微扰 `T4` 包）；
   - 经本地 `Qwen3.8-27B Base` 免费筛除 `≥0.85` 简单题后，经双教师阶梯 `Best-of-2`（`80–85% kimi + 15–20% opus`，跨家族 VLM `≥0.88`）与 Canary NLL 带通滤波，按 **Option 2 `MVP 300 / Standard 600 [推荐主力] / Scale 1,200`** 档位采集全检通过轨迹（历史扩展上限为 `1,200` 题 `C1–C5` 切片；准入门槛：`avg_part_iou24 >= 0.90`、`asm_v1 >= 0.90`、`hit == 1.0`、`0.0 mm³` 零干涉）。

### 3.2 Track 3 · 3D $\longrightarrow$ 高天花板 2D/2.5D 交互动画跃迁方案（`Canvas2D + SVG + GSAP`）

1. **3D 相机先验降维赋能：2D 透视与比例硬锚定三件套（根治 `xhs_anchor_agate_2d` 正侧面杂糅）**：
   - `tools/anchor_2d_perspective.py`：长直线段 LSD/RANSAC 三正交簇灭点聚类，自动判定 `orthographic_2d` / `axonometric_25d` / `perspective_25d`，输出归一化视平线 $y_h/H$、灭点 `VP1/VP2` 与 `4×4` 核心主体分区 BBox 至 `work/perspective_anchor.json`；
   - `output/src/projection25d.js`：40 行零依赖右手系 3D$\to$2D 共享相机投影内核（`createSharedCamera` 提供 `project / projectLoop / projectDisk`），强制透视/轴测题在同一房间三维坐标 $(X,Y,Z)$ 下投射全部墙柜、展板、台面与机器圆盘椭圆，**数学上 100% 锁死全局唯一灭点与椭圆正交压缩比**；
   - `tools/overlay_diff_2d.mjs`：在 `t = 0` 纯舞台区域生成适配 `MAX_PIXELS = 401408` 的 `2×2` 审计单图 `work/overlay_audit.png`（左上 `50% Alpha Blend`、右上 `青-品红 Sobel 边缘差分`、左下 `分区占据率 IoU`、右下 `8 桶灭点边缘方向直方图余弦相似度`），不仅供 Agent 多轮 `Read` 纠偏，而且作为 `Image 1` **强制直喂多模态裁判 `judge_2d_attempt_v3`**（配 `25%–30%` 负向一票否决条款与 `<0.08` 分差正反双序盲评）。
2. **`scripts/check_2d_v3.mjs`（含 Option 2 §0 #9 六处漏洞封堵与 `web2d_node_modules` 物理隔离，`<6s` 只读净室冷跑，失败耗 `0` VLM Token）**：
   - **硬闸 1 · `page.addInitScript` 底层渲染矩阵反作弊核验**：透明挂载 SVG `el.getCTM() / getBBox()` 与 `CanvasRenderingContext2D.prototype.{translate, rotate, transform, setTransform, arc, fillText}` 底层探针，逐帧交叉比对 `window.__getKinematicState()` / `window.__SCENE_READY__` / `window.__2D_STATE__` 申报值（误差 `>1.5px` 或 `>1.5°` 或无同步像素光流立判 `kinematic_telemetry_spoofed` / `canvas_fake_kinematics`）；删除 `data-allow-clip` (L297) 与 `data-allow-overlap` (L505) 两处作弊后门，L383 `renderer === 'svg'` 改为 `stageInfo.hasSvg`，并硬封禁 `three`/`THREE`/`OrbitControls`/`WebGLRenderer`/`getContext('webgl'|'webgl2')`（沙盒仅挂 `playwright-core` 隔离 `web2d_node_modules` 与本地 `vendor/gsap/gsap.min.js`）；
   - **硬闸 2 · 非 HUD 真实运动与公开 + 无理数时间戳物理守恒断言**：L378 改为非 HUD 区域真实运动门禁（`MAD ≥ 1.5`、变化像素面积 `≥ 1.5%`、6 帧两两最小 `SSIM ≤ 0.985`），在 $t_{r1}=(\phi-1)T \approx 0.61803T$ 与 $t_{r2}=(\sqrt{2}-1)T \approx 0.41421T$ 下硬断言齿轮副角位移比 $|\Delta\theta_B/\Delta\theta_A - (-N_A/N_B)| \le 0.015$、导槽实体包络包含、铰接销钉闭合 $\le 0.5\text{px}$、接地机架无悬空废件（`detached_floating_part`）与 `ffprobe` 解码 MP4；
   - **硬闸 3 · `page.clock.install()` 冻结时钟主动输入扰动因果探针**：冻结自动时间轴于 $t_{\text{hold}}$，扫描控件 $\{u_{\min}, u_{\text{mid}}, u_{\max}\}$ 重调 `renderAt(t_hold)`，硬验纯舞台 $\mathrm{MAD} \ge 1.8$ 且末端从动件发生非零单调物理响应（否则判 `dead_transmission_chain`），并核验 `#reset` 100% 像素/状态可逆复位；
   - **硬闸 4 · 透视灭点一致性门禁**：对 `perspective_25d` 参考图任务，若主结构区检出面积 `>20%` 的 `0°` 水平巨型框与斜向多边形混拼，直接抛出 `contradictory_front_oblique_perspective_mashup` 短路淘汰；
   - **硬闸 5 · 双视口 `≤10%` 全量文本/SVG 重叠与 `overflow:hidden`/`scrollWidth` 溢出审计**：主渲染升至 `1280×720`，合并 DOM/SVG/Canvas `fillText` 在 `1280×720` 与 `1440×900` 全时间点检查全部文本/SVG 重叠率 `≤10%`（原 45% 过松）与 `overflow:hidden` / `scrollWidth` 截断。
3. **`0%` 静态 KPI / 拓扑黑名单与 Option 2 2D 规模配比（`MVP 300 / Standard 600 [推荐] / Scale 1,200`；`D03` 多幕联动动态数据可视化放行）**：
   - **永久封杀（`0%` 配额）**：静态 KPI 四卡看板、移动点地图、轨交/网关节点连线发光脉冲拓扑图（如 `anim2d_v2_09/10/11/12`）；**依据 Option 2 §0 #7（`xhs_v2_synth.py:303`），重新放行高复杂多幕联动 `D03` 动态数据可视化（占 `12%`）**；
   - **Option 2 五大子类别与高难采样族（`35%` Tier A + `45%` Tier B + `20%` Tier C `256K` 压缩三联段）**：`25%` 原理讲解/UI 交互（`D02 + D04L04`）· `25%` SVG 骨骼绑定/叙事网页（`D01 + D04L01–03`）· `18%` Canvas 2D 物理/粒子/视差（`D05`）· `12%` 联动动态数据可视化（`D03`）· `20%` `256K` 压缩续写（`3` 段/题），覆盖 `H1–H5` 高难场景；`MotionGraphicsBench`、`AnimWeb-Bench`、`Webdev-Bench` `0%` 入训。

---

## Section 4 · Option 2 `U` 账本四步渐进训练课程、有界权重混训与门禁总表

### 4.1 为什么全流程采用「有效监督输出 Token `U` + 有界样本权重 $w_i$ + `PACK_LEN=393,216`」？

实盘分词审计显示：单条小红书 3D 执行段可训 `<think> + tool_call` 远大于 CAD/2D，且单阶段一锅烩会让 XHS 独占 `88.4%` 梯度并把 CAD 淹没到 `1.8% U`。因此 Option 2 统一采用：
- **统一 PyArrow Schema 与空 `<think>` 拆分**：`{"id", "channel", "images", "messages": [{"role", "content", "loss", "loss_scale"}]}`（无顶层 `tools` 键，7 条通道）；`loss=True` 且思考为空的 assistant 拆为 `{"loss": False, "loss_scale": 0.0}` + 正文 `{"loss": True, "loss_scale": w_ch}`；**`validation.jsonl` 强制 `loss_scale = 1.0`** 以保无偏 `val_loss_{channel}`（nats）；
- **有界样本权重与 `PACK_LEN=393,216`**：训练开启 `--calculate_per_token_loss true --is_binary_loss_scale false`（有界样本梯度权重 $w_i = \text{clip}(\alpha_{\text{track}} \cdot (65\text{K}/\max(U_i, 2048))^{0.25},\ 0.55,\ 2.55)$，归一化至 $\mathbb{E}_U[w_i]=1.00$；保留 `--is_binary_loss_scale true` 作为 Raw `U%` 回退档），在 `PACK_LEN=393,216`（`94%` 填充 = `369.62K`/包）与 `(tok <= 393216, img <= 80)` 守卫下实现两阶段 `Static YaRN 1.5×` 退火与 RL/RFT 闭环。

### 4.2 四步渐进训练课程总表（Option 2 定案：`Stage 1 -> Canary -> Stage 2 -> Stage 3 -> Stage 4`）

| 阶段与产出权重 | 硬件拓扑与窗口超参 | **有效梯度 / `U` 精确混合比** | 样本规模与核心训练目标 |
| :--- | :--- | :--- | :--- |
| **Stage 1 · `384K` 完整小红书 3D 筑基 SFT**<br>(`Qwen3.8-27B` $\to$ `ckpt-S1-clean / M2`) | `32×H100` (`TP4·PP4·CP2·DP1·SP`, **`[8, 20, 20, 16]`**)<br>**`Static YaRN 1.5×` (`393,216`)**, `PACK_LEN=393216`, `lr=1e-5→1e-6`, `GBS=48`, `1 Epoch`, `freeze_vit=false, freeze_aligner=false, vit_gradient_checkpointing=true`, FP32 `main_grad`, `optimizer_cpu_offload=true`, `LM_HEAD_LOSS_CHUNK_SIZE=16384` | **`64.2%` XHS Blender (`384K`)** + **`34.8%` XHS Three.js (`384K`)** + **`1.0%` `compact_384k` (瘦身 `205K`)**<br>*(Step 50/100 跑 `LiveCodeBench + SWE-50` 哨兵：若较 Base 跌 `>2.0 pp`，即刻分叉补入 `3,000` 条 SWE)* | • **全池划分**：`5,316` 任务（`3,222` Blender + `2,094` Three.js，`17,376` 清洗段）；**留出 `20% = 1,063` 任务（`~3,475` 段）供 Stage 2 新鲜回放**；<br>• **`80%` 完整版 / `50%` 快速里程碑**：`13,284` / `8,309` 包 · `276` / `173` 步 · `14.2 天` / `8.9 天`（`0` 等待时间，Phase-0 零丢弃清洗 `100%` 不切分存活）。 |
| **`1×8×H100` 5 臂因果 Canary 探针**<br>*(动用 `32×H100` Stage 2 前必跑！)* | `1×8×H100` (`TP=4, PP=1, CP=2`)<br>**`MAX_LENGTH=393,216`, `Static YaRN 1.5×`**, BF16 LoRA `r=64/α=128`, `freeze_vit=true, freeze_aligner=false`, `GBS=16` | `M0`, `M1_cad_{100,300,[600]}`, `M1_2d_{100,300,[600]}` (+`10%` SWE), `M2`, `M3_lora` (`M2`+CAD+2D+`30%` `384K` XHS+SWE) | • 耗时 `~42–48h`（`1.8–2.0` 单机天），`4 × TP=2` vLLM `--max-model-len 327680` 评测 `CAD-72 + 2D-72 + OOD-54 + XHS-48 + SWE-50`；<br>• 客观闸口：`M1_600 - M1_300` 仍有 `>= +4 pp` (CAD) / `>= +2–5 pp` (2D) 才扩至 `Scale (1,200)`，否则止步 `Standard (600)`。 |
| **Stage 2 · 多轨均衡退火 SFT**<br>(`ckpt-S1-clean` $\to$ `Ckpt-S2-Unified`)<br>*(开跑前必过 `G0` 多文档 `cu_seqlens` 隔离单测)* | `32×H100` 同构 **`Static YaRN 1.5×` (`393,216`)**, `--no_load_optim true`<br>**推荐主力 `Standard 600+600`**：`GBS=32` (`lr=2.45e-6`, `vit_lr=4.90e-7`, `2,381` 包 / `74` 步 / `2.17 天`)；`MVP 300+300` (`46` 步 / `1.35 天`)；`Scale 1200+1200` (`GBS=48`, `72` 步 / `3.08 天`) | **Standard 主力有效梯度**：**`21.9%` Blender (`384K`) + `12.2%` Three.js (`384K`) + `22.8%` CAD (`≤256K`) + `22.7%` 2D (`≤256K`) + `2.5%` Compact (`384K+256K`) + `17.9%` SWE (`≤48K`)** | • 小数据集重复倍率锁死 `≤ 3.0×`；每 `20` 步在 `loss_scale=1.0` 的 `validation.jsonl` 监控 7 条 `val_loss_{channel}`（连升 2 次或漂移 `> +0.03 nats` 熔断）；<br>• 步步融合新鲜未见 `384K` XHS 3D 与 `256K` 沙盒 CAD/2D 能力。 |
| **Stage 3 · `<=64K` 确定性验证 `Repair-RL`**<br>(`Ckpt-S2-Unified` $\to$ `Ckpt-S3-RL`) | `32×H100`（`16` 卡 vLLM + `16` 卡训练 `TP4·PP4·CP1`），**保持 `Static YaRN 1.5×`**<br>**`≤64K` 返修窗、`220` 步（`~3.5 天`）**, `GSPO-token` + `TITO` + `IcePop` + `PhyCAD HBA`, `lr=1e-6, kl=0.01, freeze_vit=true` | **`40%` XHS + `25%` CAD + `25%` 2D + `10%` SWE** | • 从 `Ckpt-S2` 自产 `L1–L3` 真实瑕疵快照起步，根治 CAD 手性翻转/干涉与 2D 透视偏角/齿数比错。 |
| **Stage 4 · `256K` 在策略 `RFT` + `20%` `384K` 回放**<br>(`Ckpt-S3-RL` $\to$ `Qwen3.8-27B-Unified-Option2-Final`) | `32×H100`，**保持 `Static YaRN 1.5×`**, `50` 步（`~1.5 天`）<br>`vLLM --max-model-len 327680` + **`256K` 沙盒 (`208000 / 80% / 32768 / 16384`)** | **`256K` 沙盒 `N=4` 过硬检 + 跨家族 `Best-of-2` 采样 + `20%` 全新未切分 `384K` XHS 回放 + `15%` SWE** | • 把修复与审美闭环写回长程生成，同时用 `20%` 未切分 `384K` XHS 回放永久锁死 `384K` 上限能力不退化。 |

- **Stage 3 唯一四层保序奖励与防负迁移安全阀（`PhyCAD HBA`，[RL Consolidation](../../research/3d-agent-rl-opus-review-and-consolidation-20261127/README.md)）**：
  - 组内优势 $A_i = \frac{(L_i - \bar{L}) + 0.25\,A_t(q_i)}{\max(\sigma_{\text{raw}},\, 0.50)}$（层间步长 $\lambda_L = 1.0 > 2\lambda_w = 0.50$ 严格保序，绝不发生视觉印象分倒挂越过物理/几何硬错误）；
  - CAD 层内连续分 $q_i = R_{\text{CAD}}(y_i) = \mathbb{I}_{\text{valid\_brep}} \cdot (\mathrm{part\_chamfer\_iou}_{24})^{0.35} \cdot (\mathrm{asm\_pose\_hit})^{0.65} \cdot \mathrm{zero\_interference}$（**100% OCCT 纯几何计算，在线 `0` VLM 调用**）；3D/2D 仅对全过 `L0–L2` 硬检的 $L_i=3$ 幸存者调用异族裁判（**禁止同家族自评**）并施加冻结视觉锚点扣分项防“删美感凑功能”；
  - **50 步独立监控与 3-LoRA `OPD` 熔断阀**：每 `50` 步分轨独立评测三轨留出集 `Accepted@1`；若任一轨连续两次较 Stage 2 掉点 `> 2.0 pp`，立即冻结共享主干切为三轨独立 LoRA 专家，最终经全词表反向 KL 在线自蒸馏（`OPD`）无损合回单一 `Qwen3.8-27B`。

### 4.3 门禁驱动执行时间表（Option 2 Pre-Registered Go / No-Go Gates）

| 阶段窗口 | 核心工程动作 | 预注册硬性 Go / No-Go 准入门禁（未达标严禁烧下一阶段算力与 API） |
| :--- | :--- | :--- |
| **Day 1 · 零 API 沙盒、§0 十项修复与 Phase-0 清洗** | 1. 跑完 XHS 401 分片 **Phase-0 CPU 约 1 小时零丢弃清洗**（`AR>=200` pad、`384K compact_task` 瘦身 `P90 406K->244K`、`"-agent-"` 过滤、`retry02` 去重、`<10K` 远端日志裁剪至 `100%` 不切分存活）并过空 `<think>` 拆分 + `validation.jsonl` `loss_scale=1.0` + `Qwen3_8Template` 10s 审计；<br>2. 落地 §0 #4–10 修复（`logging_proxy_to_swift.py --keep-compact-tasks`、`xhs_v2_produce.py` `262144/208000/80%/16384`、`cad_inspect.py` 5 处修复 + `verify_frontier_cad.py:243`、`check_2d_v3.mjs` 6 处修复、`gdn_v3_plugin.py` `(tok<=393216, img<=80)`）。 | • **历史翻车反例猎杀率 `100%`**：`xhs_anchor_agate_2d` 旧产物必报 `contradictory_front_oblique_perspective_mashup`；水平假齿轮无滑槽压机必报 `gear_axis_orientation_mismatch` + `missing_or_violated_guide_slot`；<br>• **CAD 逆向破局验证**：带 `cad_kit.py` + 正交局部系守卫重测 `bc_t4_chuck9` 得分从 `0.1597` 跃升至 **`> 0.70`**。 |
| **Days 2–4 · 反喂饭题厂、`27B` 免费筛难与 `256K` Canary** | 1. 逆向合成高难非喂饭 CAD（`S1–S4`）与 2D 候选包（`D03` 放行，静态 KPI/拓扑 `0%` 黑名单）；<br>2. 本地 GPU 跑 `Qwen3.8-27B Base` **免费剔除 `≥0.85` (CAD) / `≥0.80` (2D) 简单题**，在 **`256K` (`208000 / 80% / 32768 / 16384`)** 沙盒以 `80–85% kimi + 15–20% opus` 采样并过跨族 VLM 筛选（先产 `MVP 300` / `Standard 600` 档）。 | • Canary 合格录取率 **`≥ 70%`**，单题自动压缩收敛在 **`1–3` 次**（`0` 例 `30+` 次压缩死循环），`0` 宿主机路径泄漏（含 `/tmp/xhsv2-ws`）；<br>• 人工逐帧/逐剖面复核：`0` 正侧面透视混拼、`0` 假传动死壳、`0` 跨轨污染、`100%` 零布尔干涉。 |
| **Stage 1 + `1×8×H100` 5 臂 Canary + `G0` 隔离单测** | 1. `32×H100`（`[8,20,20,16]`、`Static YaRN 1.5×`、`393,216`）跑通 Stage 1 产 `ckpt-S1-clean / M2`（Step 50/100 SWE 哨兵护航）；<br>2. 在 `1×8×H100`（`MAX_LENGTH=393,216`）跑通 5 臂 Canary 并于 Stage 2 前过 **`G0` 4 轨同包 `cu_seqlens` 隔离单测**（`max_abs_diff < 2e-2`, loss 差 `< 5e-3`）。 | • `M1_300` vs `M0`：CAD `Pass@1 >= +12 pp`、2D `Pass@1 >= +15 pp`（`McNemar p < 0.05`）；<br>• `M3` vs `M2`：CAD `>= +10 pp`、2D `>= +12 pp`、跨轨污染 `0.0%`、SWE `>= -1.5 pp`；据此决定 `Standard (600)` 或扩至 `Scale (1,200)`。 |
| **Stage 2 退火 + Stage 3 `Repair-RL` + Stage 4 `256K RFT`** | 1. 跑完 Stage 2 多轨均衡退火（`Standard` `74` 步 / `2.17 天`，每 `20` 步监控 `loss_scale=1.0` `val_loss`）；<br>2. 在 `32×H100`（`16` vLLM + `16` 训练）跑完 Stage 3 `220` 步 `≤64K` `Repair-RL`（`40:25:25:10`）；<br>3. 执行 Stage 4 `50` 步 `256K` 在策略 `RFT` + `20%` 未切分 `384K` XHS 回放 + `15%` SWE，产 **`Qwen3.8-27B-Unified-Option2-Final`**。 | • 三轨主指标 **`Accepted@1（3D 动画）`、`Accepted@1（3D 打印 CAD）`、`Accepted@1（2D 动画）`** 独立全面超越 Stage 1/2；<br>• OOD 标尺（`BenchCAD 2.1`、`CADGenBench`、`IterCAD-Draw_1k`、`AnimWeb-Bench`、`MotionGraphicsBench`）刷新 SOTA，`ModelForge` 通用编码零回退且请求失败率 **`< 1%`（目标 `0%`）**。 |

---

### 附：研究侧四份完整蓝图原件与实证数据源核验清单

| 编号 | 相对路径链接（仓库内导航） | 绝对路径链接（IDE `file://` 直达） | 核心内容边界 |
| :---: | :--- | :--- | :--- |
| **00** | [README.md](../../research/distill-3d-to-2d-cad-blueprint-20261127/README.md) | [README.md](../../research/distill-3d-to-2d-cad-blueprint-20261127/README.md) | 跨轨终审总蓝图、全局架构图、参数锁死表与 16 天路线图 |
| **01** | [01-sandbox-context-spec.md](../../research/distill-3d-to-2d-cad-blueprint-20261127/01-sandbox-context-spec.md) | [01-sandbox-context-spec.md](../../research/distill-3d-to-2d-cad-blueprint-20261127/01-sandbox-context-spec.md) | `384K` 不切分硬训（`Static YaRN 1.5×`）+ `256K` 沙盒（`208K / 80% / 16384`）与状态账本（已对齐 Option 2，原 Rev 2 `HCPF-Lite@256K` 已归档） |
| **02** | [02-cad-capability-plan.md](../../research/distill-3d-to-2d-cad-blueprint-20261127/02-cad-capability-plan.md) | [02-cad-capability-plan.md](../../research/distill-3d-to-2d-cad-blueprint-20261127/02-cad-capability-plan.md) | `realhard6` CAD 尸检、`tools/cad_kit.py`（HLR 红线叠图 + `!IsDone()` 修复）、`T4` PnP 逆向与 `1,200` 题反喂饭工厂 |
| **03** | [03-2d-capability-and-mixing-plan.md](../../research/distill-3d-to-2d-cad-blueprint-20261127/03-2d-capability-and-mixing-plan.md) | [03-2d-capability-and-mixing-plan.md](../../research/distill-3d-to-2d-cad-blueprint-20261127/03-2d-capability-and-mixing-plan.md) | 2D 三大假阳性源码尸检、`projection25d.js` + `overlay_diff_2d.mjs`、`check_2d_v3.mjs` 运动学硬检、`H1–H5` 与三轨 `U` 配比 |
