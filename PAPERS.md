# Paper list

从全部研究笔记提取并按 arXiv 编号去重，共 **132 条引用**，其中 **42 篇有独立一手精读**（均核验原件 HTML/TXT 与附录超参）。其余条目来自专题综述（含 2026 下半年长轨迹上下文折叠与 `384K → 200K` SFT 适配调研）或背景引用，不代表每篇均已完整精读。

本次更新一并增补了 2026 下半年长程编码与多模态上下文压缩核心文献（`CliffCompaction 2609.26779`、`The Compaction Cliff 2608.22752`、`AutoCompact 2610.02163`、`MemTrace 2610.04838`、`ScaleCUA 2607.11185`、`PAIR 2609.36526`、`ActObs 2609.20715`、`DeNovoSWE 2606.10728` 等），全部引用位置见 [机器可读索引](catalog/papers.json)。

建议阅读顺序：先读 [3DCodeFactory](research/arxiv-2611.28783/README.md) 与 [384K → 200K 超长轨迹适配方案（HCPF-200K）](research/xhs-384k-to-200k-data-adaptation-20261127/README.md) 理解 SFT 底座与窗口改造，再读 [Opus 5.5 联合去杂糅与终极收敛蓝图](research/3d-agent-rl-opus-review-and-consolidation-20261127/README.md)、[SFT 后强化学习全景调研 v3.0](research/3d-agent-post-sft-rl-survey-20261127/README.md) 与 [2026 H2 大厂技术博客专题](research/frontier-labs-agentic-rl-blogs-2026h2/README.md)，最后按需下钻各篇单篇精读。

## 单篇精读（共 42 篇）

### 早期学生中心与基础 3D 精读（4 篇）

| 论文 / 笔记中的简称 | arXiv | 关注点 | 阅读记录 |
| --- | --- | --- | --- |
| Revisiting DAgger in the Era of LLM-Agents | [2605.12913](https://arxiv.org/abs/2605.12913) | 学生访问状态、教师纠偏与黑盒蒸馏 | [单篇精读](research/arxiv-2605.12913/README.md) |
| Finetuning with Sampling: SFT Learns Better Than You Think | [2610.02140](https://arxiv.org/abs/2610.02140) | 分布偏移、投影采样与 SFT | [单篇精读](research/arxiv-2610.02140/README.md) |
| 3DCodeVerse | [2610.22341](https://arxiv.org/abs/2610.22341) | 代码驱动 3D、训练方法与 Agent Harness | [单篇精读](research/arxiv-2610.22341/README.md) |
| 3DCodeFactory | [2611.28783](https://arxiv.org/abs/2611.28783) | 小红书 3D 数据构造、五维 Rubric 验证与训练配方 | [单篇精读](research/arxiv-2611.28783/README.md) |

### 3D 与动画 RL 精读（7 篇）

| 论文 / 笔记中的简称 | arXiv | 关注点 | 阅读记录 |
| --- | --- | --- | --- |
| BlenderFORGE | [2611.10768](https://arxiv.org/abs/2611.10768) | 反应式 3D 编辑自蒸馏 SFT + 36:1 通用锚点 + GSPO AgentLoop-RL | [单篇精读](research/arxiv-2611.10768/README.md) |
| Video-Coder | [2611.09894](https://arxiv.org/abs/2611.09894) | 代码驱动视频生成空目录防残留重跑与执行奖励指数退火 | [单篇精读](research/arxiv-2611.09894/README.md) |
| ManimCode | [2611.08294](https://arxiv.org/abs/2611.08294) | 含 Qwen3.8-27B 实测与正反双序成对盲评的教育动画视觉自纠错 | [单篇精读](research/arxiv-2611.08294/README.md) |
| 3DCodeEdit | [2610.38231](https://arxiv.org/abs/2610.38231) | Qwen3.8-27B / Kimi K3 / Opus 5.5 3D 编辑几何瓶颈与独立挑刺 Reviewer | [单篇精读](research/arxiv-2610.38231/README.md) |
| LEGO-Anything | [2609.36380](https://arxiv.org/abs/2609.36380) | GPT-6 3D 场景重建 29.6% 编辑倒退、自评 45.8% 与残差回滚插件 | [单篇精读](research/arxiv-2609.36380/README.md) |
| FuncRoom-Agent / ScenePRM | [2608.29519](https://arxiv.org/abs/2608.29519) | Qwen3.6-35B-A3B 分层 3D 功能房间可执行阶段过程奖励 | [单篇精读](research/arxiv-2608.29519/README.md) |
| WorldCraft | [2502.15601](https://arxiv.org/abs/2502.15601) | 程序化 3D 世界受控单参差分自检与分层防穿模空间优化 | [单篇精读](research/arxiv-2502.15601/README.md) |

### 交互网页与 2D 闭环 RL 精读（7 篇）

| 论文 / 笔记中的简称 | arXiv | 关注点 | 阅读记录 |
| --- | --- | --- | --- |
| WebCatalyst | [2611.05151](https://arxiv.org/abs/2611.05151) | 冻结 Visual Anchor 防审美退化、CDP 调用栈信用与本地 27B 零成本裁判 | [单篇精读](research/arxiv-2611.05151/README.md) |
| InterWebCoder | [2610.28610](https://arxiv.org/abs/2610.28610) | ms-swift 契约钩子 2× 加权 SFT、故障归因测试合成与确定性 TDRL | [单篇精读](research/arxiv-2610.28610/README.md) |
| WebLoop | [2610.11543](https://arxiv.org/abs/2610.11543) | Qwen3.5-27B 同模型三角色 GRPO 与两阶段 Critic 净跃迁课程 | [单篇精读](research/arxiv-2610.11543/README.md) |
| AeSlides | [2604.22840](https://arxiv.org/abs/2604.22840) | 剥离 CSS overflow:hidden、高斯平滑防噪点作弊与 GDPO 解耦归一化 | [单篇精读](research/arxiv-2604.22840/README.md) |
| WebGen-R1 | [2604.20398](https://arxiv.org/abs/2604.20398) | Playwright 动态状态迁移功能奖与多视口等级美学双目标 RL | [单篇精读](research/arxiv-2604.20398/README.md) |
| ReLook | [2510.11498](https://arxiv.org/abs/2510.11498) | 多轮看图负分罢工坍塌复盘、单调增益接收与零 Critic 部署自内化 | [单篇精读](research/arxiv-2510.11498/README.md) |
| WebGen-Agent / Step-GRPO | [2509.22644](https://arxiv.org/abs/2509.22644) | 有状态代码工作区即时状态分（禁累加未来步）与 1-Epoch SFT 停点 | [单篇精读](research/arxiv-2509.22644/README.md) |

### SVG 与参数化/物理 CAD RL 精读（8 篇）

| 论文 / 笔记中的简称 | arXiv | 关注点 | 阅读记录 |
| --- | --- | --- | --- |
| IR4RL | [2609.34587](https://arxiv.org/abs/2609.34587) | 图形程序可执行前缀闭合渲染与边际过程奖励防遮挡废代码 | [单篇精读](research/arxiv-2609.34587/README.md) |
| RULER | [2609.25270](https://arxiv.org/abs/2609.25270) | 根治 SVG 标量美学 21× 代码暴涨与 <text> 字牌刷分的六维正交 Rubric | [单篇精读](research/arxiv-2609.25270/README.md) |
| RefineSVG | [2607.27699](https://arxiv.org/abs/2607.27699) | 带通过滤防全盘重写、YCbCr 显式残差热力图与余弦代码效率奖 | [单篇精读](research/arxiv-2607.27699/README.md) |
| MSRL | [2508.13587](https://arxiv.org/abs/2508.13587) | 打破 2M 数据 SFT 平台期的结构化代码+视觉双粒度两阶段 RL | [单篇精读](research/arxiv-2508.13587/README.md) |
| PhyCAD | [2611.09401](https://arxiv.org/abs/2611.09401) | CadQuery + CAE 物理硬约束严格保序分层平衡优势（HBA） | [单篇精读](research/arxiv-2611.09401/README.md) |
| IterCAD | [2606.13368](https://arxiv.org/abs/2606.13368) | ms-swift 多轮视觉 CAD 渐进纠错 SFT + GSPO + GVPM 可行前缀保护 | [单篇精读](research/arxiv-2606.13368/README.md) |
| cadrille | [2505.22914](https://arxiv.org/abs/2505.22914) | 异构 CAD 混训掉分复盘、无源码真值 Dr.CPPO 在线 RL 与难例挖掘 | [单篇精读](research/arxiv-2505.22914/README.md) |
| CAD-Coder (Beihang/HKU) | [2505.19713](https://arxiv.org/abs/2505.19713) | 8K 极净胜 70K 噪数据、无格式护栏 200 步语法崩溃与薄壁 CD 盲区 | [单篇精读](research/arxiv-2505.19713/README.md) |

### 2026 大厂旗舰与生产 RL 基建精读（8 篇）

| 论文 / 笔记中的简称 | arXiv | 关注点 | 阅读记录 |
| --- | --- | --- | --- |
| DeepSeek-V4 | [2606.19348](https://arxiv.org/abs/2606.19348) | 分域 RL → 缓存末层状态全词表 OPD 合模、全轮保 think 与 WAL 防短偏置 | [单篇精读](research/arxiv-2606.19348/README.md) |
| Kimi K3 | [2607.24653](https://arxiv.org/abs/2607.24653) | 9 专家截断 MOPD、3D/WebGL 盲评净胜 +59.1%、200K-300K 压缩反超 1M | [单篇精读](research/arxiv-2607.24653/README.md) |
| Qwen3.8-Next | [2608.30320](https://arxiv.org/abs/2608.30320) | 含 Qwen3.8-27B 262K 原生 RoPE 基线、GDN+QSA+GR 与预/后训练背离 | [单篇精读](research/arxiv-2608.30320/README.md) |
| GLM-5 / slime | [2602.15763](https://arxiv.org/abs/2602.15763) | TITO 零重分词网关、确定性 topk + IcePop、三级防作弊与跨阶段 OPD | [单篇精读](research/arxiv-2602.15763/README.md) |
| Kimi K2.5 | [2602.02276](https://arxiv.org/abs/2602.02276) | 视觉看图自修闭环起源与 Toggle 熟题条件交替预算控制算法 | [单篇精读](research/arxiv-2602.02276/README.md) |
| Anthropic Production RL Hacking | [2511.18397](https://arxiv.org/abs/2511.18397) | 生产代码 RL 篡改 pytest/exit 黑客跨域失调与物理只读隔离铁律 | [单篇精读](research/arxiv-2511.18397/README.md) |
| UI-TARS-2 | [2509.02544](https://arxiv.org/abs/2509.02544) | 保留全历史 think + 最近 5 张截图滑窗、虚拟时钟劫持与沙盒飞轮 | [单篇精读](research/arxiv-2509.02544/README.md) |
| Qwen3-VL | [2511.21631](https://arxiv.org/abs/2511.21631) | 动态高分辨率空间接地、遮图必要性过滤与 SAPO 软门控 RL | [单篇精读](research/arxiv-2511.21631/README.md) |

### 跨压缩长程、自蒸馏与 Rubric 优化器精读（8 篇）

| 论文 / 笔记中的简称 | arXiv | 关注点 | 阅读记录 |
| --- | --- | --- | --- |
| RECAP | [2611.31258](https://arxiv.org/abs/2611.31258) | 单窗口有界上下文压缩行为失真奖励与压缩后在线自蒸馏 | [单篇精读](research/arxiv-2611.31258/README.md) |
| CompactionRL | [2607.05378](https://arxiv.org/abs/2607.05378) | 与 Claude Code 9 节摘要同源、全局可训 Token 归一化与跨段 GAE | [单篇精读](research/arxiv-2607.05378/README.md) |
| POW3R | [2605.20164](https://arxiv.org/abs/2605.20164) | 类内方差感知动态 Rubric 加权（快 2.5–4×）与裁判 reasoning 防崩铁律 | [单篇精读](research/arxiv-2605.20164/README.md) |
| SRaR | [2605.17291](https://arxiv.org/abs/2605.17291) | 步骤级正负对比 Rubric 与跨轨迹中心化解耦优势（死循环砍半） | [单篇精读](research/arxiv-2605.17291/README.md) |
| Reward Hacking in Rubric RL | [2605.12474](https://arxiv.org/abs/2605.12474) | 弱裁判三大盲区、负向洁净度条款与自内化间隔零成本早停 | [单篇精读](research/arxiv-2605.12474/README.md) |
| SDFT | [2601.19897](https://arxiv.org/abs/2601.19897) | 同模型蓝图条件化 G=1 全词表解析 KL 在线自蒸馏与持续学习零遗忘 | [单篇精读](research/arxiv-2601.19897/README.md) |
| GSPO | [2507.18071](https://arxiv.org/abs/2507.18071) | 序列级长度归一化似然比根治长序列崩塌与多轮局部归因 GSPO-token | [单篇精读](research/arxiv-2507.18071/README.md) |
| GiGPO | [2505.10978](https://arxiv.org/abs/2505.10978) | 零 Critic 零额外采样锚点状态归组双层优势与稀疏题去标准差稳健化 | [单篇精读](research/arxiv-2505.10978/README.md) |

## 3D 动画、运动与镜头（12 条）

| 论文 / 笔记中的简称 | arXiv | 关注点 | 阅读记录 |
| --- | --- | --- | --- |
| 4DCodeBench | [2610.03715](https://arxiv.org/abs/2610.03715) | 动态场景、轨迹与时序评估 | [专题 / 引用](research/3d-animation-methods-and-technique-selection-20261121.md) |
| PhysCodeGym | [2610.17288](https://arxiv.org/abs/2610.17288) | 接触、支撑与因果干预检查 | [专题 / 引用](research/3d-animation-methods-and-technique-selection-20261121.md) |
| DyCraft | [2610.40754](https://arxiv.org/abs/2610.40754) | 长动作、关键姿态与几何验证 | [专题 / 引用](research/3d-animation-methods-and-technique-selection-20261121.md) |
| VibePrevisBench | [2611.15789](https://arxiv.org/abs/2611.15789) | 预演交付、镜头与画面可读性 | [专题 / 引用](research/3d-animation-methods-and-technique-selection-20261121.md) |
| CinemaTraj | [2607.26910](https://arxiv.org/abs/2607.26910) | 参数化运镜、避障与遮挡 | [专题 / 引用](research/3d-animation-methods-and-technique-selection-20261121.md) |
| CineU | [2610.38468](https://arxiv.org/abs/2610.38468) | 模板选型与定向修改 | [专题 / 引用](research/3d-animation-methods-and-technique-selection-20261121.md) |
| PhysCodeBench | [2604.23580](https://arxiv.org/abs/2604.23580) | 物理代码生成与诊断修复 | [专题 / 引用](research/3d-animation-methods-and-technique-selection-20261121.md) |
| Animation2Code | [2606.28593](https://arxiv.org/abs/2606.28593) | 外观与运动分开评测、视觉反馈 | [专题 / 引用](research/3d-animation-methods-and-technique-selection-20261121.md) |
| aDSL | [2608.17975](https://arxiv.org/abs/2608.17975) | 对象关系与动作约束 | [专题 / 引用](history/research/3d-animation-improvement-and-sft-cases-20261121.md) |
| CineRecon | [2610.16577](https://arxiv.org/abs/2610.16577) | 镜头与动态重建 | [专题 / 引用](history/research/3d-animation-improvement-and-sft-cases-20261121.md) |
| Articraft | [2605.15187](https://arxiv.org/abs/2605.15187) | 可动资产、代码化与结构化反馈 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| MotionGraphicsBench | [2611.10592](https://arxiv.org/abs/2611.10592) | 2D 动态图形确定性时空验证程序与断言范式 | [专题 / 引用](research/cad-2d-sample-study-and-taxonomy-v2-20261126/README.md) |

## 公开题源、3D / CAD 数据与基准（15 条）

| 论文 / 笔记中的简称 | arXiv | 关注点 | 阅读记录 |
| --- | --- | --- | --- |
| OCTAVE | [2611.17681](https://arxiv.org/abs/2611.17681) | HTML5 / 3D 任务与规格 | [专题 / 引用](research/3d-animation-distillation-datasets-20261121.md) |
| WorldCoder-Bench | [2606.01869](https://arxiv.org/abs/2606.01869) | 3D 场景任务与状态契约 | [专题 / 引用](research/3d-animation-distillation-datasets-20261121.md) |
| Code2Video-Compass | [2610.28416](https://arxiv.org/abs/2610.28416) | 代码视频任务与时序验收 | [专题 / 引用](research/3d-animation-distillation-datasets-20261121.md) |
| VibeVideoBench | [2610.35864](https://arxiv.org/abs/2610.35864) | 视频交付与逐项 rubric | [专题 / 引用](research/3d-animation-distillation-datasets-20261121.md) |
| TKCAM / RealEstate10K-Cap | [2610.11105](https://arxiv.org/abs/2610.11105) | 语言与相机轨迹 | [专题 / 引用](research/3d-animation-distillation-datasets-20261121.md) |
| 3DCodeBench / 3DCodeData | [2606.01057](https://arxiv.org/abs/2606.01057) | 程序化建模任务与数据 | [专题 / 引用](research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md) |
| BenchCAD | [2605.10865](https://arxiv.org/abs/2605.10865) | 零件家族与泛化 | [专题 / 引用](research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md) |
| CADBench | [2605.10873](https://arxiv.org/abs/2605.10873) | 多模态 CAD 程序生成评测 | [专题 / 引用](research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md) |
| Text-to-CAD Evaluation with CADTests | [2605.07807](https://arxiv.org/abs/2605.07807) | 几何与拓扑的可执行检查 | [专题 / 引用](history/research/3d-verifiable-tasks-20261120.md) |
| HistCAD | [2602.19171](https://arxiv.org/abs/2602.19171) | 参数编辑与非目标关系保持 | [专题 / 引用](history/research/3d-verifiable-tasks-20261120.md) |
| CAD-Recode | [2412.14042](https://arxiv.org/abs/2412.14042) | 点云到 CAD 代码 | [专题 / 引用](research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md) |
| CAD-Coder (MIT Image-to-CAD) | [2505.14646](https://arxiv.org/abs/2505.14646) | MIT 图像转 CadQuery VLM（已与北航 2505.19713 Text-to-CAD 消歧） | [专题 / 引用](research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md) |
| AnimWeb-Bench | [2611.09769](https://arxiv.org/abs/2611.09769) | 多文件 Awwwards 级动态网页基准与多维视觉审美评估 | [专题 / 引用](research/cad-2d-sample-study-and-taxonomy-v2-20261126/README.md) |
| Webdev-Bench / WebCoder-27B | [2610.23104](https://arxiv.org/abs/2610.23104) | 多文件前端工程里程碑演进评测架 | [专题 / 引用](research/cad-2d-sample-study-and-taxonomy-v2-20261126/README.md) |
| WebUniverse | [2610.33149](https://arxiv.org/abs/2610.33149) | 多轮 Web Agent 轨迹与自定义许可边界 | [专题 / 引用](3d-animation-agent/docs/THREE-TRACK-DELIVERABLE-SPEC.md) |

## Agent SFT、数据配比与纠偏（47 条）

| 论文 / 笔记中的简称 | arXiv | 关注点 | 阅读记录 |
| --- | --- | --- | --- |
| SWE-Lego | [2601.01426](https://arxiv.org/abs/2601.01426) | 混合数据、步级掩码与课程 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| Step Rejection Fine-Tuning / SRFT | [2605.10674](https://arxiv.org/abs/2605.10674) | 轨迹内的步级质量处理 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| Dependency-Aware Trajectory Refinement | [2609.18417](https://arxiv.org/abs/2609.18417) | 轨迹依赖与冗余裁剪 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| OpenThoughts3 | [2506.04178](https://arxiv.org/abs/2506.04178) | 数据来源、难度与蒸馏消融 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| Kimi-Dev | [2509.23045](https://arxiv.org/abs/2509.23045) | 单轮技能先验与多轮迁移 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| SWE-smith | [2504.21798](https://arxiv.org/abs/2504.21798) | 合成修复题与多样性 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| R2E-Gym | [2504.07164](https://arxiv.org/abs/2504.07164) | 执行环境与验证器 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| SWE-Gym | [2412.21139](https://arxiv.org/abs/2412.21139) | 可执行环境与 Agent 训练 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| SWE-Master | [2602.03411](https://arxiv.org/abs/2602.03411) | 格式、难度与轨迹筛选 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| SWE-rebench | [2505.20411](https://arxiv.org/abs/2505.20411) | 题库采集与污染控制 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| SWE-rebench V2 | [2602.23866](https://arxiv.org/abs/2602.23866) | 题库与验证改进 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| UI-TARS | [2501.12326](https://arxiv.org/abs/2501.12326) | 原生多模态 Agent | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| DeepSeek-V3.2 | [2512.02556](https://arxiv.org/abs/2512.02556) | 工具使用中的历史思考 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| Qwen3 Technical Report | [2505.09388](https://arxiv.org/abs/2505.09388) | 思考模式与模板 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| Agent Data Protocol | [2510.24702](https://arxiv.org/abs/2510.24702) | 异构 Agent 数据协议 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| Agent-R | [2501.11425](https://arxiv.org/abs/2501.11425) | 错误定位与纠偏 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| LS-Mixture | [2505.03469](https://arxiv.org/abs/2505.03469) | 长短思考混合 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| SBT | [2505.14604](https://arxiv.org/abs/2505.14604) | 思考预算与停止行为 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| JET | [2509.23392](https://arxiv.org/abs/2509.23392) | 高效思考 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| ThinkDial | [2508.18773](https://arxiv.org/abs/2508.18773) | 可控思考模式 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| AgentDiet | [2509.23586](https://arxiv.org/abs/2509.23586) | 历史轨迹压缩 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| Semantic Early-Stopping | [2606.27009](https://arxiv.org/abs/2606.27009) | 语义收敛与停止 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| SFT-then-RL Outperforms Mixed-Policy Methods | [2604.23747](https://arxiv.org/abs/2604.23747) | 训练阶段与 loss 聚合 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| DFT | [2508.05629](https://arxiv.org/abs/2508.05629) | off-policy token 与微调目标 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| Anchored SFT | [2509.23753](https://arxiv.org/abs/2509.23753) | 分布约束 | [专题 / 引用](research/arxiv-2610.02140/README.md) |
| Tülu 3 | [2411.15124](https://arxiv.org/abs/2411.15124) | 后训练流程与 SFT 定位 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| AgentTuning | [2310.12823](https://arxiv.org/abs/2310.12823) | Agent 数据与通用能力 | [专题 / 引用](research/3d-agent-sft-mix-loss-20261123/README.md) |
| SFT Data Composition | [2310.05492](https://arxiv.org/abs/2310.05492) | 监督数据组成 | [专题 / 引用](research/3d-agent-data-mix-20261121/kimi-report.md) |
| Data Mixing Optimization for SFT | [2508.11953](https://arxiv.org/abs/2508.11953) | 数据混合优化 | [专题 / 引用](research/3d-agent-data-mix-20261121/kimi-report.md) |
| Hephaestus | [2502.06589](https://arxiv.org/abs/2502.06589) | Agent 工具训练 | [专题 / 引用](research/3d-agent-data-mix-20261121/kimi-report.md) |
| DeepSeek-R1 | [2501.12948](https://arxiv.org/abs/2501.12948) | 推理与后训练 | [专题 / 引用](research/3d-agent-data-mix-20261121/kimi-report.md) |
| OpenCUA | [2508.09123](https://arxiv.org/abs/2508.09123) | 多模态计算机操作 Agent 近期 K 帧截图滑窗 SFT 基线 | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/2026h2-compaction-literature-deep-dive.md) |
| The Complexity Trap | [2508.21433](https://arxiv.org/abs/2508.21433) | JetBrains 实测确定性工具输出掩码胜过 LLM 滚动摘要且防死循环 | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/2026h2-compaction-literature-deep-dive.md) |
| FoldGRPO | [2510.11967](https://arxiv.org/abs/2510.11967) | 早期动态上下文折叠强化学习基线 | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/2026h2-compaction-literature-deep-dive.md) |
| FoldAct | [2512.22733](https://arxiv.org/abs/2512.22733) | 上下文折叠动作梯度稀释分离与全上下文自洽约束 | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/2026h2-compaction-literature-deep-dive.md) |
| DeNovoSWE | [2606.10728](https://arxiv.org/abs/2606.10728) | 128K SFT 窗口训练 256K/500 轮从零建仓轨迹与坏轮掩码（5.8%→47.2%） | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/README.md) |
| SelfCompact | [2606.23525](https://arxiv.org/abs/2606.23525) | 元认知阶段收敛自压缩（排错中途抑制硬切，+5~9 pp） | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/README.md) |
| ScaleCUA | [2607.11185](https://arxiv.org/abs/2607.11185) | Visual Context Segmentation 分段视觉滑窗消除单序列失明监督（快 2.83×） | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/README.md) |
| PRO-LONG | [2607.20064](https://arxiv.org/abs/2607.20064) | 程序化交互状态日志支撑超长程探索 | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/README.md) |
| Context Compaction Theory | [2608.01326](https://arxiv.org/abs/2608.01326) | 通信复杂度下界证明结构化账本优于自由散文摘要 | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/README.md) |
| Scroll | [2608.21690](https://arxiv.org/abs/2608.21690) | 将长上下文视为可执行文件系统环境按需检阅 | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/README.md) |
| The Compaction Cliff | [2608.22752](https://arxiv.org/abs/2608.22752) | 20 套 Agent 5 轮递归摘要硬约束暴跌至 10% 与首轮硬钉死 Triage | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/README.md) |
| ActObs | [2609.20715](https://arxiv.org/abs/2609.20715) | 环境观测 Token SFT 掩码（λ=0 保直出 pass@1 vs λ=1 助 RL 探索） | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/README.md) |
| CliffCompaction | [2609.26779](https://arxiv.org/abs/2609.26779) | 确定性截断禁改写与禁递归摘要（省 50% 成本，KernelBench 3.58×） | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/README.md) |
| PAIR | [2609.36526](https://arxiv.org/abs/2609.36526) | 197 切点反事实同态续写诊断压缩边界风险稀疏性 | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/README.md) |
| AutoCompact | [2610.02163](https://arxiv.org/abs/2610.02163) | 子阶段完成边界主动压缩与单调段切分（SWE +9.2 pp） | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/README.md) |
| MemTrace | [2610.04838](https://arxiv.org/abs/2610.04838) | 状态一致溯源记忆锚点折叠过期源码（DeepSWE +21.2 pp） | [专题 / 引用](research/xhs-384k-to-200k-data-adaptation-20261127/README.md) |

## 评估方法与背景引用（16 条）

| 论文 / 笔记中的简称 | arXiv | 关注点 | 阅读记录 |
| --- | --- | --- | --- |
| Evaluating Large Language Models Trained on Code | [2107.03374](https://arxiv.org/abs/2107.03374) | 执行评估与 pass@k | [专题 / 引用](research/3d-agent-evaluation-system-20261122/astra-report.md) |
| τ-bench | [2406.12045](https://arxiv.org/abs/2406.12045) | 工具交互与重复可靠性 | [专题 / 引用](research/3d-agent-evaluation-system-20261122/README.md) |
| Adding Error Bars to Evals | [2411.00640](https://arxiv.org/abs/2411.00640) | 配对、题簇与统计不确定性 | [专题 / 引用](research/3d-agent-evaluation-system-20261122/README.md) |
| LiveCodeBench | [2403.07974](https://arxiv.org/abs/2403.07974) | 代码评测与时间窗口 | [专题 / 引用](research/3d-agent-evaluation-system-20261122/external-report-2.md) |
| Agentic Benchmark Checklist | [2507.02825](https://arxiv.org/abs/2507.02825) | 任务、结果与报告有效性 | [专题 / 引用](research/3d-agent-evaluation-system-20261122/README.md) |
| WorldAuditBench | [2609.40325](https://arxiv.org/abs/2609.40325) | 异常暴露与识别 | [专题 / 引用](research/3d-agent-evaluation-system-20261122/README.md) |
| Training Alignment Auditors via RL | [2608.25460](https://arxiv.org/abs/2608.25460) | 审计 Agent 与反馈 | [专题 / 引用](research/3d-agent-openai-anthropic-reading-notes-20261121.md) |
| Language Models are Few-Shot Learners | [2005.14165](https://arxiv.org/abs/2005.14165) | 数据组成背景 | [专题 / 引用](research/3d-agent-data-mix-20261121/astra-report.md) |
| InstructGPT | [2203.02155](https://arxiv.org/abs/2203.02155) | 监督与偏好训练背景 | [专题 / 引用](research/3d-agent-data-mix-20261121/kimi-report.md) |
| GPT-4 Technical Report | [2303.08774](https://arxiv.org/abs/2303.08774) | 模型评估背景 | [专题 / 引用](research/3d-agent-data-mix-20261121/kimi-report.md) |
| LLaMA | [2302.13971](https://arxiv.org/abs/2302.13971) | 来源份额与重复曝光 | [专题 / 引用](research/3d-agent-sft-mix-loss-20261123/README.md) |
| LIMA | [2305.11206](https://arxiv.org/abs/2305.11206) | 监督质量与多样性 | [专题 / 引用](research/3d-agent-sft-hparams-aodi-selection-20261123/main-report.md) |
| D4 | [2308.12284](https://arxiv.org/abs/2308.12284) | 去重、多样化与重复 | [专题 / 引用](research/3d-agent-sft-hparams-aodi-selection-20261123/main-report.md) |
| DataComp-LM | [2406.11794](https://arxiv.org/abs/2406.11794) | 受控数据比较 | [专题 / 引用](research/3d-agent-sft-hparams-aodi-selection-20261123/main-report.md) |
| FineWeb | [2406.17557](https://arxiv.org/abs/2406.17557) | 数据筛选与消融 | [专题 / 引用](research/3d-agent-sft-hparams-aodi-selection-20261123/main-report.md) |
| arXiv:2505.08686 | [2505.08686](https://arxiv.org/abs/2505.08686) | 新精读笔记与大厂技术报告中的方法/基准背景引用 | [专题 / 引用](research/arxiv-2505.19713/README.md) |

## 非 arXiv 材料与大厂工程博客

- [小红书 `3DCodeFactory`（384K YaRN）适配 `≤200K` 训练窗口调研与 `HCPF-200K` 改造方案](research/xhs-384k-to-200k-data-adaptation-20261127/README.md)（含 [2026 H2 文献与大厂精读专题](research/xhs-384k-to-200k-data-adaptation-20261127/2026h2-compaction-literature-deep-dive.md) · [实测分词与模拟账本 JSON](research/xhs-384k-to-200k-data-adaptation-20261127/empirical_audit_200k_ledger.json)）：对落盘 `v1-dense` / `v1` 真实分词解剖、2026 H2 压缩悬崖与非递归折叠共识、原生 `262K` RoPE 免插值红利与 4 机全参分块 CE 补丁实证。
- [主审 × Claude Opus 5.5 联合去杂糅审查与终极收敛蓝图](research/3d-agent-rl-opus-review-and-consolidation-20261127/README.md)（含 [Opus 5.5 独立报告](research/3d-agent-rl-opus-review-and-consolidation-20261127/opus-review.md) · [主审独立自审](research/3d-agent-rl-opus-review-and-consolidation-20261127/main-consolidation.md)）：对 19 项候选机制冲突消解、三轨指标断舍离、检查器 4 处硬漏洞与 `2×8 H800` `Repair-RL → 384K RFT` 极简闭环拍板。
- [2026 下半年八大前沿实验室 Agentic RL & 视觉代码技术博客专题](research/frontier-labs-agentic-rl-blogs-2026h2/README.md)：涵盖 Qwen4-Max / Qwen3.8-27B、Kimi K3.1 Pro、GLM-5.2/5.3/5.4 与 `slime`、DeepSeek-V4.1-Flash-1017、Seed 2.1、MiniMax-M3 / MaxProof、Anthropic Opus 5.5 / Fable 5.2、OpenAI GPT-6 / 6.2 Astra 官方博客时间线与工程深水区复盘。
- [2026 图文 / 2D / 3D / CAD 同源 RL 31 大踩坑避坑大全](research/visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)：汇总同源项目负向消融、防刷分补丁与本仓库脚本级迁移清单。
- [OpenAI / Anthropic 早期技术分享精读](research/3d-agent-openai-anthropic-reading-notes-20261121.md)：早期技术博客、工程实践与评估方法。
- [数据与题源盘点](research/3d-animation-distillation-datasets-20261121.md)：GitHub、Hugging Face、任务规格与数据使用边界。
- [3D / CAD 数据与基准调研](research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md)：公开数据、格式与能力边界。
