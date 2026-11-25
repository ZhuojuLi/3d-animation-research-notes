# 3D 生成与参数化 CAD 公开基准、开源数据集与 27B 能力边界调研

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> 调研日期：2026-11-25  
> 服务对象：dense `Qwen3.8-27B`（BF16）3D Agent 路线（现有 Three.js 动画轨 + 已有数百条数据的图生 3D 轨 + 刚启动 Phase 0 摸底的 CadQuery 参数化/3D 打印建模轨）  
> 核心纪律：**借验收方法、借干净题源分布、借纯净 OOD 外部尺子；绝不为了追单个公开榜单而摊薄 27B 能力圈或破坏代码可编辑性与多轮闭环。**

---

## 一、为什么要在 Phase 0 同步做这次调研（反“步子迈太大 / 唯榜单论”红线）

结合我们首版 SFT 到 Round 2 的真实教训，公开 Benchmark 和公开 Dataset 必须被明确拆成**“该借的”**与**“坚决不追的”**两半：

1. **该借的**：
   - **行业公认的验收机制**：避免闭门造车（比如只查“脚本能跑不报错”导致假阳性，这正是我们在 Three.js 首版 45.8% 外链假阳性、以及 3DCodeBench 揭示的“可执行 ≠ 物理合理”里反复看到的同一个坑）。
   - **许可证干净、拓扑覆盖广的种子分布**：靠手写 6 个零件族（`bracket / enclosure / gear / snap_clip / heatsink / rail`）只能做 seed 摸底，长期泛化必须吸收更大覆盖面的零件拓扑和特征操作（倒角、圆角、抽壳、放样、扫掠、阵列、多体配合）。
   - **零泄漏的外部 OOD 尺子**：防止只在自家 12 题/60 题模板上“自产自销式过拟合”。
2. **坚决不追的**：
   - **整库倾倒公开静态代码**：首版 10,697 条无思考 Aodi 把 249 条 ReAct 稀释到 2.27% 更新步的教训不可重演；把 10 万条单轮公开 CadQuery 脚本直接灌进 27B，只会把多轮工具自检、局部编辑和视觉纠偏能力冲垮。
   - **跨模态硬卷 27B 非主场榜单**：比如用 CadQuery 代码硬画有机生物/人物去追神经 3D 生成榜，或靠背诵 106 类 ISO 查表参数去刷单个工业 CAD 榜，都会损害真实通用参数化建模能力。

---

## 二、公认 3D Generation & Parametric CAD Benchmark 全景：别人到底怎么验收？

当前 3D / CAD 领域的公认基准已经清晰分化为**三条技术路线**，验收方法截然不同，绝不能混用：

### 路线 A：神经 Text-to-3D / Image-to-3D 资产生成榜（对应“图生 3D / 美观度盲评”）

| 基准 | 年份 / 来源 | 核心测试对象 | 公认验收机制 | 对我们的可借鉴点与边界 |
| --- | --- | --- | --- | --- |
| **T3Bench** | 2023–2024 | 文本→3D（单物体 / 带环境 / 多物体场景） | 多视角渲染 → (1) 文本-图像对齐 + 局部卷积一致性查 **Janus 多面伪影**；(2) 密集多视角 Caption + LLM 核查空间元素是否真实存在 | 适合作为**多视角外观一致性**核查思路；但对参数化尺寸精度与可编辑性无能为力 |
| **GPTEval3D** | 2024 | 文本→3D 视觉与语义质量 | 多视角投影图交由强 VLM 做**成对比较（Pairwise）→ Elo 评分**，分维度打分（语义对齐、几何合理性、纹理一致性） | 已被证明比单纯 Chamfer/CLIP 更贴近人类审美；但其闭源 VLM 偏置不可替代硬几何检查 |
| **3DGen-Bench / 3DGen-Arena** | 2025 | 统一评测 Text-to-3D 与 Image-to-3D | 1,000+ prompt 匿名众包成对对战（`3DGen-Arena` 人类 Elo），并训练代理打分器 **`3DGen-Score`**（CLIP 系）与 **`3DGen-Eval`**（MLLM 系） | 适合指导我们 **Three.js / 图生 3D 轨的独立盲评体系**（与硬性技术通过率严格分账） |

### 路线 B：代码驱动 3D 场景与建模 Agent 榜（与我们 Three.js / 视觉闭环 Agent 最同构）

| 基准 | 年份 / 来源 | 引擎与任务 | 公认验收机制 | 核心实证结论（特别针对 27B–32B） |
| --- | --- | --- | --- | --- |
| **3DCodeBench** | May 2026 (`arXiv:2606.01057`, Google DeepMind / USC) | **Blender (`bpy`)** 过程化建模，212 类 Infinigen 对象；测单轮、多轮、完整 Coding Agent 循环 | 四层验收栈：① 执行成功率；② 多视角视觉特征对齐（**SigLIP-2 / DINOv3**）；③ 3D 几何距离（**Chamfer / Uni3D**）；④ 人类盲评 Elo（`3DCodeArena`） | ① **“可执行 ≠ 物理合理”** 是头号失败模式——脚本零报错但部件**浮空、断连、自交**；② 27B–32B 开源模型单轮失败率高，但在**终端报错+视觉多轮循环 + 专用 code-to-3D 微调（`3DCodeData`）**后能大幅追近闭源模型 |
| **BlenderGym** | CVPR 2025 | 245 个手工 3D 场景**编辑与重建**（几何、光照、材质、摆位、blend shape） | 闭环 Generator-Verifier + **任务级细粒度二值 Rubric** + 多视角光度损失 / CLIP / Chamfer | 证明了“局部编辑（Edit）+ 闭环验证”比纯从零生成更能检验 Agent 真实工程控制力 |
| **AA-3D** | Late 2026 (Artificial Analysis) | 离线沙盒编写交互式 **Three.js / WebGL** 3D 体验（`Stirrup` harness） | 隔离沙盒构建 + 人类盲评成对 Elo | **与我们现有的 Three.js 离线单文件轨几乎完全同构**；说明离线可执行 + 视觉/交互体验盲评已是行业共识 |
| **IR3D-Bench** | NeurIPS 2025 | Agentic Inverse Rendering（看目标图用代码与渲染器重建多物体场景） | 目标图对比 + 工具调用重建还原度 | 印证“读渲染图 → 发现偏差 → 改代码”多轮视觉闭环是 3D Agent 的核心增益来源 |

### 路线 C：参数化 CAD / CadQuery 专项榜（与我们刚启动的 3D 打印建模轨直接对应）

| 基准 | 年份 / 来源 | 引擎与规模 | 公认验收机制（核心看点） | 对我们 CadQuery 轨的直接启发 |
| --- | --- | --- | --- | --- |
| **BenchCAD** | May 2026 (`arXiv:2605.10865`, `BenchCAD/BenchCAD`, `BenchCAD-org/benchcad-2-main`) | **CadQuery (Python)**；**17,900** 条执行验证程序，106 个工业零件族（齿轮、弹簧、紧固件、转接件等），对应 47 项 ISO/DIN/EN/ASME/IEC 标准 | **完全弃用主观 LLM Judge，100% 确定性 CAD 内核验证**：<br>① `Vision2Code`：生成 STEP 与真值 STEP 算**体素 IoU**；<br>② `CodeEdit`：指令改代码，算相对基线的**归一化 IoU**；<br>③ `Vision-QA` / `Code-QA`：工程数值问答，算**对称比精度** | **极其值得借鉴的两点**：<br>1. `CodeEdit` 的归一化 IoU 指标非常克制且客观；<br>2. 公开了 MIT 代码 + CC-BY-4.0 数据，且有 `benchcad-2.0-core` / OOD 族划分，可抽少量未见零件族作**零泄漏 OOD 尺子**（绝不刷榜背 ISO 表） |
| **CADBench** | May 2026 (`arXiv:2605.10873`) | 18,000 样本跨 DeepCAD/Fusion360/ABC/MCB/Objaverse，5 种输入模态（干净/带噪网格、单/多视角、PBR） | 6 维指标：**几何保真度 + 代码可执行率 + 程序紧凑度**，且**按 B-rep 面数（Face Count）分层**评测复杂度缩放 | **按 B-rep 面数分层**是界定 27B 能力边界的绝佳标尺（例如 6–20 面 vs 21–40 面 vs >40 面） |
| **CADCodeVerify / CADPrompt** | ICLR 2025 (`Kamel773/CAD_Code_Generation`) | 自然语言 + 专家标注 CAD 代码；多轮视觉自检纠偏 | VLM 看渲染多视图回答结构核查问题 → 定位语法与几何偏差 → 迭代修复 | 与我们 `cad_inspect.py` + `render_glb_multiview.mjs` + `Read views_grid.png` 路线完全一致 |
| **CADTestBench** / **CadQueryEval** | 2025–2026 (`dimitrismallis/CADTestBench`, `drwahl/cadqueryeval`) | 面向 CadQuery 的功能测试套与 Inspect AI 评测架 | 执行验证 + Chamfer / Hausdorff 距离 + 功能断言 | 补充尺寸/体积/点探针之外的**全局形状相似度（Voxel IoU / Chamfer）** |
| **CAD-bench / CADEngBench** | 2025–2026 | FreeCAD / Fusion / 参数化功能装配 | 尺寸/姿态门控、螺纹轮廓核查 + **Blender 刚体仿真**（验证齿轮是否真能啮合） | **暂不引入**（刚体物理仿真与工业装配约束超出当前 27B Phase 1 范围，记录作远期参考） |

### 归纳：行业公认的“4 层 CadQuery / 3D 验收金字塔”

综合 BenchCAD、CADBench、3DCodeBench 与我们 `print-seed-v1` 的实测经验，最扎实且不过度工程化的验收栈应当是**确定性硬检为主、多视角视觉为辅、复杂物理留作远期**：

1. **Layer 1 — 沙盒安全与可执行性**：AST 禁用网络/文件/子进程 + CadQuery 无报错构建 + 三格式（STL/3MF/GLB）独立回读。
2. **Layer 2 — 拓扑健康与反浮空**：水密（watertight）、2-流形（2-manifold）、开放边=0、非流形边=0、期望部件名与连通体数量精确匹配（堵死 3DCodeBench 的“能跑但浮空/断连”漏洞）。
3. **Layer 3 — 几何保真与参数化意图**：外形包络尺寸（mm）、体积区间、空腔/实体点探针（或对标真值 STEP 的 **Voxel IoU / Chamfer Distance**）、**参数覆盖回归探针**（改 `DEFAULT_PARAMS` 后尺寸增量与体积变化方向正确，堵死硬编码作弊）。
4. **Layer 4 — 多视角视觉复核（4-View Contact Sheet）**：正交三视图 + 等轴测 + 边缘线轮廓 + 坐标范围标注（且不得自动把 Z 中心平移藏掉），用于 Agent 自检与最终抽检；**绝不越界声称切片通过、打印成功或物理强度/公差合格**。

---

## 三、开源数据集盘点与商业合规红绿灯（用于拓宽覆盖面）

选开源数据集必须同时过**三道闸**：① **许可证是否允许后续商用/内部模型迭代**（剔除隐蔽 NC/SA 雷区）；② **代码格式是否为原生高质量 CadQuery（含圆角/倒角/布尔/壳/阵列等，而非退化的单调草图拉伸）**；③ **是否与评测集严格隔离（零泄漏）**。

### 🟢 Tier 1：宽松商用协议（Apache-2.0 / MIT / CC-BY）+ 高直接价值（优先考察）

| 数据集 / 仓库 | 规模与内容 | 许可证 | 特征覆盖度 | 在我们路线里的正确用法 |
| --- | --- | --- | --- | --- |
| **`ADSKAILab/Zero-To-CAD-100k`**（全量 `Zero-To-CAD-1m`） | Autodesk AI Lab；100K（DINOv3 + K-means 多样性精选）/ 1M 可执行 **CadQuery Python** + 元数据/面数/多视角渲染/STEP/STL | **Apache-2.0**（纯 LLM 搜索合成，无 Onshape/Autodesk 用户版权纠纷） | **极高**：覆盖 boolean、fillet、chamfer、shell、loft、sweep、pattern，不局限于草图+拉伸 | **CadQuery 扩面头号候选**！绝不整库灌入，而是按 **B-rep 面数（6–35 面）与操作多样性**抽样，用于：① 提取高质量任务分布/题干种子；② 构造“带视觉自检的缺陷修复 / 参数化编辑 / 从零构建”多轮 ReAct 轨迹；③ 极少量干净带思考 One-Shot 锚点 |
| **`BenchCAD/BenchCAD`** (`arXiv:2605.10865`) | 17,900 条执行验证 **CadQuery**，106 工业零件族，含多视角图、代码编辑指令、QA | 代码 **MIT** / 数据 **CC-BY-4.0** | **极高**（工业标准件：齿轮、弹簧、紧固件、转接件、支架等） | **首选作纯净外部 OOD 评测尺子**（抽 `benchcad-2.0-core` 或固定留出 20–30 题不参与任何训练）；若借其零件分类学扩题，**必须按家族级严格隔离**，防止任何数据泄漏 |
| **`YipengGao/3DCodeBench`** (`3DCodeData/`) | Google DeepMind/USC；212 类程序化对象（Blender `bpy` + 渲染图 + Caption + GLB） | 渲染/标注/评测 **MIT**，工厂脚本 **BSD-3-Clause** | 日常家居/器物/自然物体过程化结构 | 引擎是 Blender 而非 CadQuery，**不直接混入 CadQuery 代码训**；可借其多视角图与结构化描述拓宽**图生 3D / Three.js 场景题库覆盖面** |
| **`Thingi10K`（仅筛 CC0 / CC-BY 子集）** | 10,000 个真实 3D 打印网格（其中 ~6,600+ 为 CC-BY/CC-BY-SA，需用 `thingi10k` 包按单件协议过滤出 **CC0/CC-BY**） | 单物体协议混合（**必须程序过滤掉 NC/SA**） | 真实 DIY/3D 打印社区功能件拓扑分布 | 无 CadQuery 源码，适合做**真实用户 3D 打印需求分布调研与缺陷类型参考**（薄壁、悬空、开口壳、非流形修复题源） |
| **`Objaverse`（仅筛 CC-BY / CC0 子集）** | 800K+ 3D 资产（~721K 为 CC-BY 4.0，数据集整体 ODC-By 1.0） | **ODC-By 1.0** + 单资产按字段过滤 CC-BY/CC0 | 通用有机与硬表面 3D 网格 | 仅服务于已有的**图生 3D** 方向，**不用于 CadQuery 参数化轨** |

### 🟡 Tier 2：学术研究 / NC / 非 CadQuery 格式（仅作方法参考或受限研究，不直接入商训）

| 数据集 / 项目 | 规模与特点 | 许可证 / 限制 | 为何暂不直接入训 |
| --- | --- | --- | --- |
| **`filapro/cad-recode`** (ICCV 2025) | 1M 合成点云 → CadQuery 程序 | **CC-BY-NC-4.0** | 非商用限制，且偏向点云逆向而非文本+工具交互设计 |
| **`CADCODER/GenCAD-Code`** (NeurIPS 2025) | 163K 图 → CadQuery（含 CoT + GRPO 思路） | 学术研究/继承限制 | 许可受限；但其 **SFT→GRPO（几何奖励+格式奖励）** 与 CoT 规划范式很有参考价值 |
| **`SadilKhan/Text2CAD`** & **`Text-to-CadQuery`** | 170K 模型 / 660K 多粒度文本（新手→专家） | 衍生 CadQuery 版多为 **CC-BY-NC-SA-4.0** | 许可含 NC+SA，且底层源自 DeepCAD 以简单草图+拉伸为主；可借鉴其**多粒度 Prompt（抽象意图 vs 精确参数）**写法 |
| **`DeepCAD` / `ABC` / `Fusion 360 Gallery (JoinABLe)` / `FabWave` / `Omni-CAD`** | 178K–1M 级 B-rep / 命令序列 / 装配关节 | Onshape / Autodesk 用户版权或纯教育科研条款 | 商用合规风险高，且大多为非 CadQuery 低层命令流；仅作零件复杂度分布与装配关节类型研究 |
| **社区 OpenSCAD 抓取集**（如 `OpenSCAD-Code-to-3D-50K-HF`） | Thingiverse OpenSCAD 片段 | OpenSCAD 引擎 **GPL-2.0+**，抓取集多含 **CC-BY-NC-SA** | 与我们 `CadQuery` 引擎路线正交（`OpenSCAD = N/A`）且版权混杂 |

---

## 四、认清 `Qwen3.8-27B` 的能力边界：什么该深耕、什么坚决不做

综合 3DCodeBench（27B–32B 开源模型分析）、BenchCAD、FutureCAD / Pointer-CAD 的实证，以及我们在 27B 上从 Round 1 到 Round 2 的真实工程经验，dense 27B 在 3D/CAD Agent 上的**能力边界非常清晰**：

### 1. ✅ 27B 的高 ROI 甜蜜区（值得投入并做到极稳）

1. **中小复杂度硬表面参数化零件（6–35 个 B-rep 面，1–3 个命名装配体）**：
   - 支架/安装座、两件式外壳（底盒+盖板）、滑动导轨+滑块、直齿轮/带毂齿轮、散热片/针翅块、卡扣/线夹、法兰/转接头、轴承座、夹具、旋钮等。
   - 覆盖真实工程/桌面 3D 打印中 **80%+ 的参数化刚需**，且代码量仅 40–160 行 Python。
2. **四类闭环工程工作流（最容易与 27B 强代码能力形成共振）**：
   - `build`（规范清晰的从零建模，含明确 `Z=0` 基准面与完整关键尺寸）
   - `defect_repair`（修开放壳/非流形、修布尔空壳、补漏孔、删非法网络/IO、修部件断连）
   - `parametric_edit`（保参数化结构改动尺寸/特征、加倒角/开槽/加强筋，禁硬编码）
   - `healthy`（健康对照：先运行检验与看 4 视图，确认无误即零改动停手）
3. **短步多轮执行 + 4 视角视觉自检（6–18 轮，总序列仅 9K–28K tokens）**：
   - 我们在 Phase 0 对 DeepSeek 9 条通过轨迹做真实 `Qwen3.8-27B` Swift 4.5.2 tokenizer 实测：全量序列长度 **min 8,644 / median 18,163 / max 27,717 tokens（0 条超 65K）**，比 Three.js 轨迹轻 **2×–3×**！
   - 3DCodeBench 与 CADCodeVerify 均验证：在 **终端报错 + 多视角渲染图** 反馈循环下，27B–32B 模型能修复大量单轮必然失败的 API 误用、尺寸漂移与部件错位。

### 2. ⚠️ 27B 的谨慎探索区（先小规模验证，不作主承诺）

- **轻量 `Vision2Code`（单/多视角参考图 → 简单 CadQuery 功能件，≤20 面）**：27B 原生具备视觉编码能力，但多视图 3D 尺度反推远难于文本精确尺寸建模，宜在纯文本+自检闭环跑稳后再小比例试水。
- **高阶曲面操作（复杂 Loft / Sweep / 真实螺旋螺纹牙型 / 大量链式 Fillet）**：OCCT/CadQuery 内核在复杂边选择（`.edges(...)`）和自交处极易抛拓扑异常；FutureCAD / Pointer-CAD 证明通用 LLM 在复杂 B-rep 边面定位上存在结构性瓶颈，需要严格控制边选择复杂度并通过工具报错回收。

### 3. ❌ 27B 坚决不碰的“追榜陷阱”

1. **用 CadQuery / 纯代码去硬画有机雕塑、人物、动物或复杂写实大场景**：那是神经 3D 生成（图生 3D / TRELLIS / Hunyuan3D 等）的主场；我们图生 3D 轨已有数百条数据，应让**两条轨各司其职**（有机/外观→图生 3D，尺寸/功能/可编辑机械件→CadQuery，交互动画→Three.js）。
2. **10+ 零件的工业复杂装配体 / >50 面超复杂 B-rep / 物理级 GD&T 公差与切片认证**：超出 27B 空间注意力容量，强塞只会制造超长死循环、高 NLL 离策略思考和无效脏数据。
3. **刷榜导向的数据偏置**：
   - 不为了 BenchCAD 刷高分去背诵 106 类 ISO/DIN 标准尺寸表；
   - 不为了 Chamfer/IoU 刷高分容忍硬编码非参数化代码；
   - 不把 `Zero-To-CAD-1m` 这类大规模单轮合成脚本整库倾倒进 SFT（必须严格受五本账配比约束，避免重演首版“87.9% 单轮无思考数据淹没多轮 Agent 能力”的事故）。

---

## 五、对当前项目的可执行建议（三步走、稳节奏）

1. **Step 1（正在完成）— 用 `print-seed-v1` 双臂摸底锁定 27B 真实短板**：
   - 以眼前正在跑的 **DeepSeek vs 原版 Qwen3.8-27B** 12 题实测为准，先看清 27B 裸跑在哪些具体维度掉分（CadQuery API 报错？布尔/坐标基准？多部件命名？参数化硬编码？还是不会停手/不看图？）。
2. **Step 2（低成本校验层升级）— 吸收公开基准的 3 项硬核验收能力，同时守住范围**：
   - 从 **BenchCAD** 抽 20–30 题轻量零件（≤30 面，固定冻结、永不入训）作为**纯净外部 OOD 尺子**（测 Voxel IoU + CodeEdit 归一化 IoU）；
   - 给自建评估集升级 `print-eval-v2` 时，吸收 **CADBench 的按 B-rep 面数分层**（Easy 6–15 面 / Medium 16–30 面 / Hard 31–45 面）与 **3DCodeBench 的浮空/断连硬检**，并修复 Phase 0 暴露的两项规范细节（Prompt 显式声明 `Z=0` 底面基准 + 全量关键特征尺寸；`cad_inspect.py` 彻底剥离宿主机路径、渲染改为 `flatShading` 消除三角扇条纹并在图上标出真实 `Z_range`）。
3. **Step 3（Phase 1 精简高质量造数，等 Round 2 训练出结果后再决定合训节奏）**：
   - 从 **`ADSKAILab/Zero-To-CAD-100k` (Apache-2.0)** 中按面数与操作类型精选种子，结合手工工程族模板，构造 **300–500 条高纯度多轮 CadQuery ReAct 轨迹**（40% 缺陷修复 + 30% 参数化编辑 + 20% 从零构建 + 10% 健康对照）+ **150–250 条带思考的干净 One-Shot 参数化锚点**；
   - 继续沿用已验证通过的 **`repos-logging-proxy` → `logging_proxy_to_swift.py` → CPU Swift 4.5.2 逐 token 审计** 全链路，确保 CadQuery 轨零脏前缀、零路径泄漏、且在总配比里与 Three.js / 图生 3D / Aodi / SWE 平衡协同，**绝不抢占或破坏已经跑顺的主轨**。

---

## 参考来源登记

1. **BenchCAD** — *BenchCAD: A Comprehensive, Industry-Standard Benchmark for Programmatic CAD*, `arXiv:2605.10865` (May 2026); HF: `BenchCAD/BenchCAD`, `BenchCAD/benchcad-2.0-core`; GitHub: `BenchCAD-org/benchcad-2-main` (MIT / CC-BY-4.0).
2. **CADBench** — *CADBench: A Multimodal Benchmark for AI-Assisted CAD Program Generation*, `arXiv:2605.10873` (May 2026).
3. **Zero-to-CAD** — Autodesk AI Lab, HF: `ADSKAILab/Zero-To-CAD-1m`, `ADSKAILab/Zero-To-CAD-100k` (Apache-2.0).
4. **3DCodeBench & 3DCodeData** — Gao et al. (Google DeepMind / USC), *3DCodeBench: Benchmarking Agentic Procedural 3D Modeling Via Code*, `arXiv:2606.01057` (2026); HF: `YipengGao/3DCodeBench`; GitHub: `gaoypeng/3dcodebench` (MIT / BSD-3-Clause).
5. **CAD-Coder** — *CAD-Coder: An Open-Source Vision-Language Model for Computer-Aided Design Code Generation*, `arXiv:2505.14646` (NeurIPS 2025); `GenCAD-Code`.
6. **CAD-Recode** — *CAD-Recode: Reverse Engineering CAD Code from Point Clouds*, `arXiv:2412.14042` (ICCV 2025); HF: `filapro/cad-recode` (CC-BY-NC-4.0).
7. **CADCodeVerify / CADPrompt** — ICLR 2025; GitHub: `Kamel773/CAD_Code_Generation`.
8. **Text2CAD** — NeurIPS Spotlight; HF: `SadilKhan/Text2CAD`; **DeepCAD** / **Fusion 360 Gallery (JoinABLe)** / **ABC Dataset** / **FabWave** / **Thingi10K**.
9. **BlenderGym** (CVPR 2025), **IR3D-Bench** (NeurIPS 2025), **AA-3D** (Artificial Analysis, 2026), **3DGen-Bench / 3DGen-Arena** (2025), **GPTEval3D** (2024), **T3Bench** (2023–2024).
10. **FutureCAD** (ICML/arXiv 2026) & **Pointer-CAD** (CVPR 2026) — B-rep grounding limits of standalone LLMs.
