# 3DCodeFactory（arXiv:2611.28783v1）一手精读与工程迁移方案

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> 调研日期：2026-11-25  
> 论文标题：*3DCodeFactory: Scaling Training Data for 3D Code Agents*（Dots Studio, Xiaohongshu Inc.；Zhaoyu Wang, Xueru Wen, XingYu Li, Jie Lou）  
> 协议与开源资产（**全部 Apache-2.0**）：
> - 论文原文：[paper.html（上游原文）](https://arxiv.org/abs/2611.28783) · [paper.txt（上游原文）](https://arxiv.org/abs/2611.28783)（`https://arxiv.org/html/2611.28783v1`，含正文 + Appendix A–F 全量 11 个 Prompt 模板与 8 张附表）
> - 官方代码仓：`https://github.com/3DCodeFactory/3DCodeFactory`（**完整源码与资产已克隆至 `3DCodeFactory-repo`（本地附件未发布）**，含 [P01–P11 全部 12 份官方提示词（上游仓库）](https://github.com/3DCodeFactory/3DCodeFactory)、[56 叶节点 taxonomy.json（上游仓库）](https://github.com/3DCodeFactory/3DCodeFactory)、[Three.js few-shot hall/case.json（上游仓库）](https://github.com/3DCodeFactory/3DCodeFactory)、[Blender few-shot press/case.json（上游仓库）](https://github.com/3DCodeFactory/3DCodeFactory)、[schema.json（上游仓库）](https://github.com/3DCodeFactory/3DCodeFactory) 与核心源码 `src/code3dfactory/*`）
> - 项目主页：`https://3dcodefactory.github.io/`（已存档 `homepage.html`（本地附件未发布）、`data.js`（本地附件未发布）、Three.js 实时案例源码 `chateau.js`（本地附件未发布））
> - Hugging Face 数据集：`3DCodeFactory/3DCodeFactory`（别名 `wangzhaoyu/3DCodeFactory`；元数据与真实分片样本实查：`hf-README.md`（本地附件未发布） · `hf-api.json`（本地附件未发布） · `hf-shards.json`（本地附件未发布） · `sample-shard-prefix.jsonl.zst`；全量 401 分片直连下载进行中：`${WORKSPACE}/datasets/3dcodefactory/`）

---

## 一、核心结论：为什么这篇工作对我们是“降维级参考”？

**`3DCodeFactory` 使用的技术栈与我们的 3D Agent 项目几乎 1:1 重合**：
- **教师模型**：`DeepSeek-V4.1-Flash-1017`（与我们完全同源）
- **采样脚手架**：`Claude Code v2.1.251` + 隔离 Docker 沙盒（Blender 4.2.10 / Three.js r180 + Playwright 1.64.1 + headless Chromium SwiftShader）
- **训练基座**：**`Qwen3.8-27B`**（与我们完全同型号！）及 `Qwen3.5-9B`

并且它直接用硬实验验证了我们这周复盘的每一条核心判断：
1. **彻底钉死“大批量单轮静态数据救不了 27B”的结论**：在 **`Qwen3.8-27B`** 上，喂入 **203 万条**单轮开源数据 `3DCodeVerse`（4.66B tokens）三榜均分几乎纹丝不动（`58.66 → 58.78`, `+0.12`），甚至在 Three.js `P3D-Bench` 上**倒退 `-0.63`**；而喂入 `3DCodeFactory` 仅 **5,045 条**经多维 Rubric 严格过滤的多轮视觉闭环轨迹，三榜均分直接暴涨 **`+8.12`（`58.66 → 66.78`）**，**全面反超同系 2.4T 旗舰 `Qwen3.8-Max`（`62.75`）**，且零样本迁移到 BlenderGym 场景编辑误差直降 **`-37.9%`（PL）/ `-28.8%`（N-CLIP）**。
2. **同一批 5,045 题严格对照证明“多轮视觉迭代过程”本身值 `+11.75` 分**：只用这 5,045 题的“输入 → 最终代码”单轮对训练 27B，BlenderWorld 仅涨 `+5.36`（`53.02 → 58.38`）；保留完整多轮写代码→渲染→看图→自纠错轨迹后直接拉到 **`70.13`（`+17.11`）**。
3. **Rubric 严格过滤 + Best-of-2 + 轮级异常 Loss Masking 带来质变**：去掉 Rubric 过滤后，27B 在 BlenderWorld 少拿 **`-6.27` 分**（精细度 `Dimension` 暴跌 `-8.38`），工具报错率高出 **81%（`7.8% vs 4.3%`）**，连续重复无效编辑暴增 **2.7×（`18.6% vs 6.8%`）**。
4. **Apache-2.0 公开了完整 `6,414` 条 Qwen SFT 轨迹（302.58 GB 压缩 JSONL）与全部 P01–P11 提示词及校验代码**——既可直接复用其工程代码思想，也具备合规筛选引入其 Three.js / 图生 3D 多轮数据的可行性（但实查分片发现 4 个必须清洗的格式坑，见第四节）。

---

## 二、方法论与 P01–P11 多智能体生产管线深拆

### 2.1 任务形式化与“视觉锚定 → 隐去参考图”双模态巧思

每个任务包定义为 $(x, \mathcal{R})$，其中输入 $x = (I, C, S, F)$、**对编码 Agent 严格隐藏（held-out）的评估细则** $\mathcal{R} = (R_{\text{vis}}, R_{\text{spec}}, R_{\text{func}})$：
- **$I$（Visual Reference）**：由文生图模型生成的 3D 参考图，作为空间布局、比例和外观的视觉锚点，根治纯文本扩题导致的模板坍塌与 2D→3D 空间歧义。
- **$C$（Context）**：应用场景、人设风格（`professional` 专业工程师 vs `ordinary` 普通用户）、参考图使用模式（`faithful_reconstruction` / `local_modification` / `grounded_extension`）、目标引擎与交付物契约。
- **$S$（Specification）**：核心 3D 主体与零件层级、精确尺度比例与遮挡面保守补全、**强制真实可编辑 3D 网格实例化约束（严禁 2D 贴图/广告牌糊弄）**、以及显式排除无关背景杂物（`scope_exclusions`）。
- **$F = \{F_1, \dots, F_K\}$（$0 \le K \le 3$）**：可触发交互功能，必须写明**触发控件 + 目标 3D 部件 + 预期 3D 状态与画面变化**（基础 OrbitControls 不算）。论文默认配置 `synthesis.blender_static_only = true`，因此 Blender 2,920 题为纯静态高精建模（$F=\varnothing$），Three.js 2,125 题含 0–3 个可触发交互功能。

> **一手分片实查发现的隐藏神设计**：实拆 HF 公开样本 `train-00319.jsonl.zst` 第 1 条记录（见第四节）发现，即便在任务合成阶段用参考图 $I$ 锚定了精确的 3D 布局、道具位置、材质和视角，在采样与训练阶段仍会构造 **纯文本任务（`This is a text-only task; there is no reference image.`）** 且覆盖 **中英双语（`en` + `zh`）与普通用户口语 / 专业工程师双人设**。这直接解释了为什么训练后的 27B 不仅在带图任务（`T+I` `+16.51`）上暴涨，在纯文本（`T` **`+17.73`**）甚至未见过的视频参考（`T+V` **`+21.73`**）上也全面大幅跃升！

### 2.2 10 大域 56 叶节点 3D Taxonomy 与防污染体系

- **原料池**：混合 `DiffusionDB` 提示词 + `Wikipedia` 物理实体词条 + `Amazon` 商品目录，避开单一文本源偏科。
- **分类树 $\mathcal{T}$**（Table S1）：整合 Sketchfab / TurboSquid / CGTrader / Evermotion / Poly Haven / BlenderKit，归并成 **10 主域、56 细粒度叶节点**；高频叶节点语义去重+配额下采样，长尾稀缺叶节点（工业机械、医疗/科学仪器等）关键词回捞+LLM 验真补足最低配额 $n_{\min}$。
- **分布实况**：最终 5,045 题（Blender 2,920 / Three.js 2,125）共命中 **19,125 个域标签**（平均 **3.79 个域/题**），**87.7% 是跨领域复合场景**（日常物品 61.2%、建筑 57.1%、自然 54.5%、设备仪器 52.3%、室内 47.8%、室外 39.0%、文娱 31.9%、载具 14.9%、角色 11.5%、食物 9.0%）。
- **防污染护栏（[vector_guard.py（上游仓库）](https://github.com/3DCodeFactory/3DCodeFactory)）**：用冻结的文本+图像双通道 Embedding，对四大下游榜单（`BlenderWorld`、`P3D-Bench`、`3DCodeBench`、`BlenderGym`）及自有 few-shot 做最近邻余弦相似度拦截，超阈值直接拒收。

### 2.3 P01–P11 完整多智能体流水线（核对自 `workflow.py` 与 `paper.toml`）

| 阶段 | 模块 | 模型（`paper.toml`） | 核心职责与关键防坑设计 |
| --- | --- | --- | --- |
| **分类对齐** | `P01` | `GPT-5.6-Terra` | 单轮完成 3D 主体筛选、去 2D 渲染噪声词（`8k/octane/artstation`）、扁平多选映射 56 叶节点、预标注现实/奇幻、专业/普通人设、适用组件与 Blender/Three.js 适配度 |
| **参考图生成** | `P02` | `GPT-5.6-Terra` + `GPT Image 2.5 Sunburst` (`1536x1024`, `max`) | 区分两种视觉范式：**`model_replication_style`**（单体/紧凑组件，微俯 3/4 视角+干净底座+清晰轮廓）与 **`realistic_photography_style`**（人眼尺度真实室内外场景，禁微缩玩具/漂浮岛）；输出 160–240 词单视图清晰提示词，严禁拼图/多视图/文字标注 |
| **参考图质检** | `P03` | 亮度直方图 + 前景分割 + `GPT-5.6-Terra` | 剔除严重裁边/缺件、异常融合畸形、透视扭曲/多图拼贴、前景模糊与“需数百栋独立复杂建筑”的超纲极端规模（最多重试 3 次） |
| **需求合成** | `P04` | `GPT-5.6-Terra`（1-shot） | 锚定 $I$ 顺序生成 $(C,S,F)$ 并组装为自包含 `task_prompt`；**$I$ 与种子文本冲突时以 $I$ 为准**；引入**视觉复杂度 vs 扩展度权衡**（画面已极复杂则压低 $K\in\{0,1,2\}$ 防过载） |
| **Rubric 编写** | `P05` | `GPT-5.6-Terra`（1-shot） | 弹性配额生成 $R_{\text{vis}}$（3–6 项）、$R_{\text{spec}}$（2–5 项）、$R_{\text{func}}$（0–3 项），总计 8–13 项；**严禁写“未实现/部分实现/完全实现”空话**，必须围绕具体零件名、方向、公差与状态变化写透 `{0, 0.5, 1}` 三档可观测锚点 |
| **出题审计** | **`P07`** | `GPT-5.6-Terra`（最多修 2 轮） | **出题放量前的硬守门**：核查 $I$ 与 $(S, R_{\text{vis}})$ 跨模态一致、确保 **$\mathcal{R}$ 中每一条考点在 `task_prompt` 里都明文交代（零隐藏考纲！）**、确保 Rubric 互斥不重复计分 |
| **先验难度** | `P06` | `GPT-5.6-Terra` | 仅凭 $x$ 提前打 1–5 整数分：`content_complexity`（$d_{\text{cont}}$，物体数与布局协调）与 `geometry_complexity`（$d_{\text{geo}}$，曲面/不规则几何复杂度，用于后续视觉分校准） |
| **多轮采样** | `P08-A/B` | `DeepSeek-V4.1-Flash-1017` + `Claude Code 2.1.251` | 隔离 Docker 沙盒（离线、预装 Blender 4.2.10 + `bw-blender-mcp` 或 Three.js r180 + Playwright 1.64.1 + Chromium）；`384K` 压缩窗口、`128K` max output、`T=1.0, top_p=1.0`，`N_max=6` 独立采样 |
| **证据采集** | **`P09`** | `GPT-5.6-Terra`（只读挂载 `/artifact`） | 实跑产物并主动旋转/缩放相机采集 **4 组互补视图**：1 张参考对齐（`reference_*`）+ 3 张多角度全局（`overall_*`）+ 3 张局部特写（`local_*`）+ 按需任务补拍（`task_*`），并评 **显示稳定性 $s_{\text{stab}}\in\{0.2..1.0\}$**（查穿模、Z-fighting 闪烁、裁切、黑屏）；强制校验产物文件 SHA-256 零篡改 |
| **视觉评审** | **`P10`** | `GPT-5.6-Terra` | 对照 $I$ 与 4 组视图逐项按 `{0, 0.5, 1}` 打分算 $s_{\text{vis}}$，严格区分“拍清但缺件（打 0/0.5）”与“被遮挡未拍到（标 `insufficient_evidence` 触发重拍）”；另从空间合理性、细节完整度、材质光影、整体呈现 4 子项评 **美学分 $s_{\text{aes}}\in\{0.2..1.0\}$** |
| **规格与功能验证** | **`P11`** | `GPT-5.6-Terra`（只读挂载 `/artifact`） | **只信实跑场景图，绝不凭源码变量名/注释给分**：执行 `bpy` 或 DOM/Three.js 脚本实测包围盒/零件数/独立网格层级算 $s_{\text{spec}}$；用 Playwright 逐一点击/拖拽控件并比对 `func_init.png` 与 `func_F01_after.png` 算 $s_{\text{func}}$ |

### 2.4 五维过滤漏斗、Best-of-2 与几何难度校准（Table S4 & Table S5）

1. **三阶段数据漏斗（5,283 候选任务 → 13,312 条已完成 rollout → 5,045 条入库，留存率 `37.9%`）**：

| 过滤阶段 | 轨迹数 $N$ | 占比 | $s_{\text{vis}}$ | $s_{\text{spec}}$ | $s_{\text{func}}$ | $s_{\text{stab}}$ | $s_{\text{aes}}$ | 综合均分 $\bar{s}$ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0. 全部已完成 Rollout（5,283 题） | 13,312 | 100.0% | 0.667 | 0.689 | 0.613 | 0.717 | 0.664 | **0.670** |
| ⊖ Stage 1 淘汰：任一适用维 $<0.50$ | −2,389 | 17.9% | 0.391 | 0.412 | **0.281** | 0.454 | 0.381 | 0.384 |
| 1a. 通过单维硬底线 | 10,923 | 82.1% | 0.727 | 0.750 | 0.686 | 0.775 | 0.726 | 0.733 (+0.063) |
| ⊖ Stage 2 淘汰：均分 $<0.60$ 或未凑齐 2 条（238 题弃用） | −833 | 6.3% | 0.554 | 0.547 | 0.508 | 0.612 | 0.604 | 0.565 |
| 1b. 配对达标池（5,045 题 × 2 条） | 10,090 | 75.8% | 0.741 | 0.767 | 0.701 | 0.788 | 0.736 | 0.747 (+0.077) |
| ⊖ Stage 3 淘汰：Best-of-2 亚军 | −5,045 | 37.9% | 0.698 | 0.723 | 0.649 | 0.749 | 0.693 | 0.702 |
| **2. 最终入库 `3DCodeFactory-Data`** | **5,045** | **37.9%** | **0.784** | **0.811** | **0.753** | **0.827** | **0.779** | **0.791 (+0.121)** |

2. **几何难度校准（极有价值的评测洞察）**：
   - 在独立校准集上对照人工双盲评分发现：物体数量多（$d_{\text{cont}}$ 高）**不会**导致 VLM 裁判系统性压分，但**复杂曲面/不规则几何（$d_{\text{geo}} \ge 3$）**在程序化建模下更易暴露局部曲率偏差，导致 VLM 裁判相对人类专家系统性偏严。
   - 因此引入先验几何偏移校准：$\tilde{s}_{\text{vis}} = \min(1.0,\; s_{\text{vis}} + \Delta(d_{\text{geo}}))$，其中 $\Delta = \{0.000,\; 0.006,\; 0.022,\; 0.052,\; 0.060\}_{d_{\text{geo}}=1}^{5}$。
   - **150 题（300 条产物）三名 3D 专家双盲人评验证（Table S5）**：
     - 无校准：缺陷拦截 Precision `74.1%` / Recall `92.2%` / 同题 GSB 人类一致率 `77.3%`（116/150）；
     - 加内容校准 $+\Delta(d_{\text{cont}})$：Precision 仅 `74.8%`（几乎无效）；
     - **加几何校准 $+\Delta(d_{\text{geo}})$**：Precision 直接飙升 **`+13.1 pp` 至 `87.2%`**，同时保住 **`91.1%` Recall** 与 `77.3%` GSB 一致率。

---

## 三、核心实验结果与五大消融硬证据

### 3.1 四大公开基准主成绩单（Table 2 & Table 4）

| 模型 / 训练数据 | BlenderWorld (Text / MM / **Score**) | P3D-Bench Three.js (Geo / Judge / **Score**) | 3DCodeBench (CD↓ / Uni3D / **Score**) | **三榜均分** | BlenderGym 零样本编辑 (PL↓ / N-CLIP↓) |
| --- | :---: | :---: | :---: | :---: | :---: |
| *GPT-6 Astra* | 78.60 / 80.70 / **79.97** | 63.43 / 62.10 / **62.77** | 6.79 / 59.76 / **76.49** | **73.08** | — |
| *Claude Opus 5* | 74.80 / 72.10 / **73.04** | 69.09 / 57.52 / **63.31** | 6.37 / 54.60 / **74.12** | **70.16** | — |
| *DeepSeek-V4.1-Flash*（教师） | 79.10 / 74.46 / **76.08** | 64.10 / 56.86 / **60.48** | 6.08 / 53.68 / **73.80** | **70.12** | 0.361 / 1.569 |
| *Qwen3.8-Max (2.4T)* | 59.60 / 61.10 / **60.58** | 61.06 / 50.51 / **55.79** | 6.71 / 50.49 / **71.89** | **62.75** | — |
| **`Qwen3.5-9B` (Base)** | 6.94 / 7.28 / **7.16** | 38.88 / 24.97 / **31.93** | 25.95 / 18.74 / **46.40** | **28.50** | — |
| + `BlendNet` (12K 单轮) | 16.80 / 13.80 / 14.85 (+7.69) | 35.42 / 21.88 / 28.65 (−3.28) | 14.20 / 29.40 / 57.60 (+11.20) | 33.70 (+5.20) | — |
| + `Bioinspired3D` (4.6K 单轮) | 21.40 / 16.82 / 18.42 (+11.26) | 34.60 / 21.08 / 27.84 (−4.09) | 10.85 / 34.80 / 61.98 (+15.58) | 36.08 (+7.58) | — |
| + `3DCodeVerse` (2.03M 单轮) | 17.25 / 12.78 / 14.34 (+7.18) | 43.10 / 30.98 / 37.04 (+5.11) | 19.66 / 23.80 / 52.07 (+5.67) | 34.48 (+5.98) | — |
| + `3DCodeFactory` (w/o Rubric) | 55.40 / 43.78 / 47.84 (+40.68) | 43.35 / 31.49 / 37.42 (+5.49) | 11.45 / 36.15 / 62.35 (+15.95) | 49.20 (+20.70) | — |
| **+ `3DCodeFactory` (Ours)** | **66.04 / 53.54 / 57.91 (+50.75)** | **48.00 / 38.44 / 43.22 (+11.29)** | **6.91 / 42.50 / 67.80 (+21.40)** | **56.31 (+27.81)** | — |
| **`Qwen3.8-27B` (Base)** | 53.78 / 52.61 / **53.02** | 53.77 / 49.49 / **51.63** | 7.31 / 49.95 / **71.32** | **58.66** | 3.544 / 10.617 |
| + `BlendNet` (12K 单轮) | 57.99 / 52.27 / 54.27 (+1.25) | 52.65 / 46.72 / 49.69 (−1.94) | 7.20 / 49.38 / 71.09 (−0.23) | 58.35 (−0.31) | — |
| + `Bioinspired3D` (4.6K 单轮) | 60.50 / 53.82 / 56.16 (+3.14) | 51.54 / 45.97 / 48.76 (−2.87) | 6.22 / 50.23 / 72.01 (+0.69) | 58.98 (+0.32) | — |
| + `3DCodeVerse` (2.03M 单轮) | 57.70 / 51.36 / 53.58 (+0.56) | 53.12 / 48.88 / 51.00 (**−0.63**) | 6.45 / 49.97 / 71.76 (+0.44) | 58.78 (+0.12) | — |
| + `3DCodeFactory` (w/o Rubric) | 64.70 / 63.41 / 63.86 (+10.84) | 57.68 / 52.94 / 55.31 (+3.68) | 6.83 / 50.44 / 71.81 (+0.49) | 63.66 (+5.00) | — |
| **+ `3DCodeFactory` (Ours)** | **71.91 / 69.18 / 70.13 (+17.11)** | **59.79 / 55.33 / 57.56 (+5.93)** | **6.66 / 51.96 / 72.65 (+1.33)** | **66.78 (+8.12)** | **2.202 (−37.9%) / 7.555 (−28.8%)** |

### 3.2 五大关键消融与行为洞察

1. **跨模态全线普涨（Table 3，BlenderWorld 5 种输入）**：
   - `T`（纯文本）`55.95 → 73.68 (+17.73)`；`T+S`（文本+规格文件）`48.25 → 67.40 (+19.15)`；`T+I`（文本+图）`54.58 → 71.09 (+16.51)`；`T+I+S` `56.60 → 71.21 (+14.61)`；**`T+V`（零样本视频参考）`30.60 → 52.33 (+21.73)`**。
2. **零样本场景编辑迁移（Table 4，BlenderGym）**：
   - 训练集并未专门构造“局部编辑旧 `.blend` 工程”任务，但多轮“看图找茬 → 改代码再渲染”轨迹天然教会了模型精准修改局部光照（PL **`−82.4%`**）、Blend-shape（**`−89.2%`**）、摆放（**`−94.5%`**）、几何（`−29.3%`）和材质（`−13.1%`）。
3. **单轮终态代码 vs 多轮交互轨迹（Table S8，同 5,045 题严格对照）**：
   - `Base` `53.02`（Rubric 完整度 `57.70` / Dimension 精细度 `48.34`）
   - `Single-Turn Pairs` `58.38`（`62.46` / `54.30`，仅 `+5.36`）
   - **`Full Multi-Turn` `70.13`**（`78.43` / `61.83`，**`+17.11`，多轮交互过程独占 `+11.75` 分**）
4. **Rubric 过滤决定“高质量迭代”还是“瞎重试堆轮数”（Table S7 & Fig. 6）**：
   - 未过滤组（`w/o Rubric`）虽然轮数更长（中位 `178` 轮 / `412.5K` tok），但精细度仅 `53.45`、工具报错率高达 **`7.8%`**、连续重复编辑高达 **`18.6%`**，且训练中后期明显后劲不足；
   - 过滤组（`Ours`）轮数更精干（中位 `160` 轮 / `374.1K` tok），精细度暴涨至 **`61.83`（`+8.38`）**、工具报错率腰斩至 **`4.3%`**、连续重复编辑骤降至 **`6.8%`**，且 5 个训练节点（20%/40%/60%/80%/100%）一路稳定攀升。
   - 在 100 题独立 Held-out 合成题上，训练后 27B 对 Base 的自动化 GSB 胜率达 **`87 : 10 : 3`**（Table S6）。
5. **多轮 Agent 行为发生本质跃迁（Sec 5.4 & Fig. 7）**：
   - `Qwen3.8-27B` 原版在复杂场景上习惯“画个粗壳就草草收工”（中位 85 轮、首次看图迟至整条轨迹的 `30.5%` 处）；
   - SFT 后中位轮数增至 `160` 轮、总输出 `127.8K → 374.1K`、**单题看图次数提升 `3.07×`、首次看图大幅提前到 `12.8%` 处**；在等量工具调用下，**文件检查（`18.0% → 26.9%`）、编辑（`12.0% → 21.6%`）、看图（`12.0% → 15.0%`）占比全面上升**，盲目执行代码（`32.6% → 23.1%`）和杂项管理（`18.2% → 7.2%`）显著下降。

---

## 四、SFT 训练配方、`trajectory.py` 源码机制与 HF 公开数据集实查

### 4.1 `Qwen3.8-27B` SFT 超参（Appendix B.2, Table S3）

| 超参项 | 论文配置 |
| --- | --- |
| 训练方式 | Full-Parameter Multimodal Interleaved SFT（图文交错多轮全参微调） |
| 上下文窗口 | **`384K` tokens**（通过 **YaRN `scale_factor = 1.5`** 从 256K 扩展） |
| 优化器 & Weight Decay | AdamW（$\beta_1=0.9,\; \beta_2=0.95,\; \text{wd}=0.1$） |
| 学习率与调度 | Peak LR **`1.0e-5`**，Cosine Decay，**`3%` linear warmup** |
| Batch & Epochs | Global Batch Size **`48`**，**`1` epoch**（`765` steps on `3DCodeFactory-Data`） |
| 精度与梯度裁剪 | BF16 混合精度，max grad norm `1.0` |

### 4.2 [trajectory.py（上游仓库）](https://github.com/3DCodeFactory/3DCodeFactory) 两大高杠杆导出机制（Apache-2.0 可直接借鉴）

1. **Compaction 边界切分（`segment_at_compaction`）**：
   - 当一条长轨迹触及 Claude Code `compact_boundary` 或超过 `393,216`（384K）窗口时，自动切分为多段，并在下一段以 `[system_0, user(compacted_summary, loss_mask=True)]` 续接。因此 `5,045` 条完整轨迹导出为 HF 上的 **`6,414` 条训练记录**（均 `1.27` 段/轨迹）。
2. **轮级异常 Loss Masking（`apply_turn_loss_masks`）——“掩坏轮、保纠错轮”**：
   - 非 `assistant` 轮次一律 `loss_mask = True`（不计 loss）；
   - `assistant` 轮次默认 `loss_mask = False`（参与训练），但触发以下 **5 类异常规则** 之一时将**该单轮**标为 `loss_mask = True`（屏蔽梯度），**同时保留紧随其后的报错诊断与自纠错轮次参与训练**：
     1. `tool_execution_error`：对应 `tool` 返回 `is_error=true`、非零 `exit_code`，或匹配 `Traceback / SyntaxError / ReferenceError / TypeError / NameError / IndentationError / InputValidationError / unknown tool`；
     2. `protocol_leakage`：输出中泄漏 `<invoke>`、`<tool_call>`、`｜DSML｜`、`<|im_end|>`、`</think>` 错位或无 `tool_calls` 时的伪 JSON 工具调用块；
     3. `repetitive_reasoning_loop`：文本 $\ge 4\text{KB}$ 且 `zlib` 压缩率 `< 0.10`，或同一非空行重复 $\ge 8$ 次且累计 $\ge 120$ 字符，或连续 8 句窗口中 $\ge 6$ 句是 $\le 40$ 字符的 `"Let me / I will / Now / Wait"` 短意图复读；
     4. `duplicate_tool_target`：跨段重复已训练过的同一 `tool_call_id`；
     5. `abnormal_ending`：`finish_reason == "length"` / `stop_reason == "max_tokens"` 或正文、思考、工具调用三者全空。

### 4.3 Hugging Face `wangzhaoyu/3DCodeFactory`（`data/qwen-sft-6414`）一手抽样实查

直接拉取最小分片 `data/qwen-sft-6414/train-00319.jsonl.zst` 的前 2 MB 压缩前缀并流式解压，完整解析出第 1 条记录的前 **145 条消息**（ID：`cc-ddb2m_ebf0fbfd77a48d441a55-main-main-compact_before-0`），确认以下真实数据细节与 **4 项接入红线**：

- **体量与结构**：共 **401 个 `.jsonl.zst` 分片**，总压缩体积 **`302.58 GB`**（单分片 `438 MB–1,175 MB`，均 `754 MB`；单条记录压缩后约 **`47 MB`**，主因是 `role="tool"` 中直接以 `data:image/jpeg;base64,...` / `data:image/png;base64,...` 内嵌了全分辨率渲染截图，单张 base64 达 `134KB–449KB`）。
- **思考链未做任何二次摘要改写**：前 46 个 `assistant` 轮次保留了 **100% 原始 DeepSeek-V4.1-Flash-1017 `reasoning_content`**（简短电报式第一人称独白，例如 `"Need inspect vendor list and output existing."`；字符数中位数 `631`、最大规划轮 `72,216`、总计 `433K` 字符），工具分布为 `Bash 33 / Read 7（含 6 次看图）/ Edit 5 / Write 3 / TaskCreate 3 / TaskUpdate 1`。
- **⚠️ 接入我们 `ms-swift 4.5.2` + `Qwen3.8-27B` 流水线前的 4 个必避大坑**：
  1. **中途 `role="system"` 污染模板**：几乎每轮工具返回后都插了一条 `{"role": "system", "content": "<total_tokens>14982057 tokens left</total_tokens>", "loss_mask": true}`（以及 `[02]` 另一条 `role="system"` 的 Agent 列表）。我们已在 `modelforge-checkpoint10946-trial-003`（797557 case #287）吃过非首条 `system` 报错的亏——**入 `ms-swift` 前必须把中途 `system` 剥离或合并进首条 `system` / `user` 环境块**！
  2. **`loss_mask` 极性相反**：HF 数据里 `loss_mask: true` 表示 **MASK OUT（不计算 loss）**、`loss_mask: false` 表示 **参与训练**；转换到 `ms-swift` 的 `loss` / `loss_scale` 字段时务必取反并跑逐 token 审计，切勿写反！
  3. **超长序列与多文件交付契约差异**：该数据集面向 `384K` YaRN 窗口（中位 4,270 LoC、413.6 工具调用）且输出 `/workspace/output/index.html` + 相对路径 `vendor` 多文件结构，而我们的 `devtest-v2` 考题要求“单文件内联 HTML”。不可整库硬灌，必须按长度（如 `≤131K` 或扩 YaRN）筛选并保持明确契约提示，避免把单文件内联能力带偏。
  4. **论文未公开抗遗忘通用混合比**：论文 1 epoch 纯域内 3D 训练未测通用能力（MMLU / 通用编码 / 数学 / ModelForge 综合门控）；我们落地时必须坚守[五本账配比纪律](../3d-agent-sft-mix-loss-20261123/README.md)，严禁裸训纯 3D 毁掉通用底座。

---

## 五、全链路横向对标：`3DCodeFactory` vs 我们当前 3D Agent 体系

| 维度 | `3DCodeFactory`（小红书 Dots Studio） | 我们当前体系（`3d-animation-agent`） | 差距与各自优势判断 |
| --- | --- | --- | --- |
| **核心赛道** | Blender 静态高精场景（2,920）+ Three.js 交互场景（2,125，静态美感+1–3 控件） | Three.js **物理/数学连续动画** + 图生 3D + **CadQuery 参数化/3D 打印** + 2D 动画 | **高度互补**：对方强在“复杂场景美感、跨领域多样性与交互场景”；我们强在“动态物理仿真、显式缺陷修复/健康对照、精密 B-rep CAD” |
| **题源与多样性** | 3 大文本源 + 10 域 56 叶节点分布对齐（87.7% 跨领域复合场景）+ 视觉参考图 $I$ 锚定 | 手工/半自动专题题族 + 开源题源筛选 | **对方显著领先**：视觉锚定 + 56 叶配额彻底解决了“纯文本扩题坍塌成套话模板” |
| **出题防坑审计** | **`P07` 出题前跨模态+零隐藏考纲审计** + 冻结双模态去污染守卫 | 曾因隐含契约（`__3D_STATE__`、`Z=0` 底面、`clip_len`）多次踩坑 | **立刻照搬 `P07`**：出题阶段就挡死“考纲隐藏在评测器里没写进题面”的废题 |
| **采样环境** | `DeepSeek-V4.1-Flash-1017` + `Claude Code 2.1.251` + 干净 Docker（0 宿主路径） | 同教师 + Claude Code + `repos-logging-proxy`（已清净宿主机路径） | 基本对齐；对方在 `TOOLS.md` 里预置 `screenshot.py` 与 `preflight.py` 更利于稳定看图 |
| **CoT 策略** | **100% 保留原始简短电报式 `reasoning_content`** + 轮级异常 `loss_mask` | Round 2 曾用 DeepSeek 摘要改写引发 Markdown 报告腔 NLL 恶化，现已切向 `student_project_cot` + NLL 审计 | **对方印证了我们的 NLL 发现**：原始简短 ReAct 思考直接可训超 2.4T Max，不需重写成方案书；但超长 One-Shot（50K+ 代码预演）仍需控长 |
| **验收体系** | `P09` 主动 4 组视角采集 + `P10` 逐条 `{0,0.5,1}` 视觉 Rubric + 几何难度校准 + `P11` 场景图与 Playwright 实触测试 | **`Eval v3`**：纯 WebGL 帧差防 HUD 假动 + 12 帧时序拼图 + 100% 匿名五维评 + **50/50 翻转头对头盲评** + CadQuery 拓扑/探针硬检 | **各有独门绝技**：我们在**动态动画时序防假动 & 匿名 A/B 盲评 & B-rep 几何硬检**上更强；对方在**主动 4 视角特写采集 + UI 控件实触验证 + 几何难度校准**上更强，合并即是顶配！ |
| **数据筛选** | 三阶段漏斗 + **Best-of-2**（13,312 → 5,045，均值 `0.670 → 0.791`） | 视觉抽检去 `FAIL` + 手工复核 | **高收益可抄**：高价值题上跑 `N_max=4` 取 Best-of-2，能把 27B 精细度与工具稳健性再抬一档 |
| **SFT 训练** | Full-Param、`384K` YaRN、`1e-5`、1 epoch、**轮级掩坏轮保纠错轮** | `ms-swift 4.5.2`、分段 `loss_scale`（`0.5/1.0/2.0`）、五本账通用防遗忘配比 | **融合最优**：保留我们的分段权重与防遗忘五本账，吸收对方的轮级掩坏轮机制与长窗口能力 |

---

## 六、分优先级落地路线图（立刻抄 / 适配用 / 切勿盲抄）

### P0：零算力、低成本，本周直接落地到现有管线

1. **把 `trajectory.py` 的 5 条轮级异常 Loss Masking 合入 `scripts/logging_proxy_to_swift.py`**  
   - 对触发 `tool_execution_error`、`protocol_leakage`、`repetitive_reasoning_loop`（`zlib<0.10` / 重复行 / 短意图复读）、`abnormal_ending` 的**单条故障 `assistant` 轮次**置 `loss=False`（`loss_scale=0.0`），同时保留紧随其后的报错诊断与修复轮次参与训练。
   - **直接收益**：不浪费整条好轨迹，同时把 CadQuery（原版报错 3×）与 Three.js 里的工具误用和重复空转彻底隔离在梯度之外。
2. **把 `P07`（出题前跨模态 & 零隐藏考纲审计）接入 CadQuery `print-eval-v2` 与图生 3D 扩产**  
   - 在任何新题进入教师批量 rollout 前，先过一道 `P07` 审计：核查“评测器/Rubric 里考核的每一项基准面、命名、尺寸、交互效果是否已 100% 明文写进 `task_prompt`”，从源头根绝 `print-gear-spur-build` / `print-clip-cable-repair` 类隐含契约误杀。
3. **停止对 ReAct 轨迹做 Markdown 腔 CoT 改写**  
   - `3DCodeFactory` 实测与我们的 27B NLL 审计达成双重闭环：ReAct 多轮轨迹优先保留自然简短的第一人称原生 `<think>`（配合轮级重复循环 mask）；仅对超长 50K+ One-Shot 逐行代码预演做去冗余或使用 `scripts/student_project_cot.py` 27B 原生投影，放量前跑 `audit_student_nll.py`。
4. **给 `Eval v3` 补齐 `P09` / `P11` 的两块拼图（升至 `Eval v3.5`）**  
   - 对 Three.js 交互与图生 3D 题：在 `capture_3d_evidence.mjs` 增加**多角度/局部视角抓拍**（查 3D 侧面/背面穿模与稳定性 `s_stab`）以及**自动发现并触发 UI 滑块/按钮后的前后帧对比**（补足只测 `rAF` 连续动画之外的交互验证）。

### P1：Round 2 训完出 `Eval v3` 四轨成绩单后的高杠杆动作

5. **合规抽检并按需融合 `wangzhaoyu/3DCodeFactory`（Apache-2.0）的 Three.js 多轮子集**  
   - **存储与代理纪律**：使用 Kaze 下载代理（`network.py download`，`127.0.0.1:7891`）落盘至 `${WORKSPACE}/datasets/3dcodefactory/`（**严禁走 `7890` 或落 `/`！**）；
   - 先拉取 3–5 个分片（~2.5 GB）写清洗与体检脚本：① 剥离中途 `<total_tokens>` `system` 消息；② 反转 `loss_mask` 极性适配 `ms-swift 4.5.2`；③ 统计单条 token 长度与图片数，筛出适合我们上下文窗口（`≤131K` / `≤262K`）且高美感的 Three.js（含中文+英文、纯文本+带图）优质子集，作为 Round 3 攻坚 27B `visual_craft=3.02` 最低分项的强力弹药！
6. **引入“视觉锚定出题 → 隐去参考图构造纯文本题” + Best-of-2 筛选**  
   - 针对我们自产的 Three.js 场景与图生 3D 扩产：用文生图先出高质量参考图 $I$ 锚定丰富空间与材质细节，再按比例构造“带图版（图生 3D）”和“隐去 $I$ 的纯文本精详版（文生 3D）”，并用 `P05` 具体 `{0, 0.5, 1}` Rubric 对关键题执行 **Best-of-2**（`N_max=4` 收 2 条达标择优）。

### P2：明确不要盲抄的 4 条红线

- **不要无视通用抗遗忘**：绝不照搬论文纯 3D 无通用混比的 1 epoch 配方直接上线 ModelForge，必须按五本账保留通用/推理配比并跑全量回归。
- **不要无脑把 302 GB / 384K 多文件轨迹全量灌入当前 `131K` 单文件内联训池**：超长截断会制造大量残缺尾段，多文件相对路径也可能干扰单文件内联交付率，必须长度筛选 + 明确交付契约分桶。
- **不要丢弃我们独有的 `repair`（从故障态修复）与 `healthy`（健康零改动止损）三元配比**：`3DCodeFactory` 靠海量从零构建的多轮轨迹带来零样本编辑收益，但无法替代显式 `healthy` 防过度修改纪律与定向故障修复能力。
- **不要丢弃连续物理/数学 3D 动画与 CadQuery B-rep 精密建模主线**：这两条赛道恰恰是 `3DCodeFactory`（偏静态展示+轻量 UI 触发、无 CAD 工程公差与物理仿真）未覆盖的差异化高地。
