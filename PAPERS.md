# Paper list

从已有笔记提取并按 arXiv 编号去重，共 **85 条引用**，其中 **4 篇有单独精读**。其余条目来自专题综述或背景引用，不代表每篇均已完整精读。

名称与研究重点沿用原笔记。本次整理未重新逐篇核验题名、版本和实验数字；已发现的 CAD-Coder 编号歧义在表中保留标注。全部引用位置见 [机器可读索引](catalog/papers.json)。

建议先读 3DCodeVerse / 3DCodeFactory，再读动画评测综述；DAgger 与 Finetuning with Sampling 可作为学生纠偏和分布问题的延伸。

## 单篇精读

| 论文 / 笔记中的简称 | arXiv | 关注点 | 阅读记录 |
| --- | --- | --- | --- |
| Revisiting DAgger in the Era of LLM-Agents | [2605.12913](https://arxiv.org/abs/2605.12913) | 学生访问状态、教师纠偏与黑盒蒸馏 | [单篇精读](research/arxiv-2605.12913/README.md) |
| Finetuning with Sampling: SFT Learns Better Than You Think | [2610.02140](https://arxiv.org/abs/2610.02140) | 分布偏移、投影采样与 SFT | [单篇精读](research/arxiv-2610.02140/README.md) |
| 3DCodeVerse | [2610.22341](https://arxiv.org/abs/2610.22341) | 代码驱动 3D、训练方法与 Agent Harness | [单篇精读](research/arxiv-2610.22341/README.md) |
| 3DCodeFactory | [2611.28783](https://arxiv.org/abs/2611.28783) | 3D 数据构造、验证与训练配方 | [单篇精读](research/arxiv-2611.28783/README.md) |

## 3D 动画、运动与镜头

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
| Video-Coder | [2610.38231](https://arxiv.org/abs/2610.38231) | 执行、渲染、反馈与返修 | [专题 / 引用](history/research/3d-animation-improvement-and-sft-cases-20261121.md) |
| 3DCodeEdit | [2611.09894](https://arxiv.org/abs/2611.09894) | 局部编辑与非目标保持 | [专题 / 引用](history/research/3d-animation-improvement-and-sft-cases-20261121.md) |
| ManimCode | [2611.08294](https://arxiv.org/abs/2611.08294) | 教育动画与视觉自纠错 | [专题 / 引用](research/3d-agent-sft-mix-loss-20261123/README.md) |
| Articraft | [2605.15187](https://arxiv.org/abs/2605.15187) | 可动资产、代码化与结构化反馈 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| MotionGraphicsBench | [2611.10592](https://arxiv.org/abs/2611.10592) | 2D 动态图形确定性时空验证程序与断言范式 | [专题 / 引用](research/cad-2d-sample-study-and-taxonomy-v2-20261126/README.md) |

## 公开题源、3D / CAD 数据与基准

| 论文 / 笔记中的简称 | arXiv | 关注点 | 阅读记录 |
| --- | --- | --- | --- |
| OCTAVE | [2611.17681](https://arxiv.org/abs/2611.17681) | HTML5 / 3D 任务与规格 | [专题 / 引用](research/3d-animation-distillation-datasets-20261121.md) |
| WorldCoder-Bench | [2606.01869](https://arxiv.org/abs/2606.01869) | 3D 场景任务与状态契约 | [专题 / 引用](research/3d-animation-distillation-datasets-20261121.md) |
| Code2Video-Compass | [2610.28416](https://arxiv.org/abs/2610.28416) | 代码视频任务与时序验收 | [专题 / 引用](research/3d-animation-distillation-datasets-20261121.md) |
| VibeVideoBench | [2610.35864](https://arxiv.org/abs/2610.35864) | 视频交付与逐项 rubric | [专题 / 引用](research/3d-animation-distillation-datasets-20261121.md) |
| TKCAM / RealEstate10K-Cap | [2610.11105](https://arxiv.org/abs/2610.11105) | 语言与相机轨迹 | [专题 / 引用](research/3d-animation-distillation-datasets-20261121.md) |
| 3DCodeBench / 3DCodeData | [2606.01057](https://arxiv.org/abs/2606.01057) | 程序化建模任务与数据 | [专题 / 引用](research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md) |
| IterCAD | [2606.13368](https://arxiv.org/abs/2606.13368) | 交互修复与 REVISE / STOP | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| BenchCAD | [2605.10865](https://arxiv.org/abs/2605.10865) | 零件家族与泛化 | [专题 / 引用](research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md) |
| CADBench | [2605.10873](https://arxiv.org/abs/2605.10873) | 多模态 CAD 程序生成评测 | [专题 / 引用](research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md) |
| Text-to-CAD Evaluation with CADTests | [2605.07807](https://arxiv.org/abs/2605.07807) | 几何与拓扑的可执行检查 | [专题 / 引用](history/research/3d-verifiable-tasks-20261120.md) |
| HistCAD | [2602.19171](https://arxiv.org/abs/2602.19171) | 参数编辑与非目标关系保持 | [专题 / 引用](history/research/3d-verifiable-tasks-20261120.md) |
| CAD-Recode | [2412.14042](https://arxiv.org/abs/2412.14042) | 点云到 CAD 代码 | [专题 / 引用](research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md) |
| CAD-Coder（CAD 数据综述中的条目） | [2505.14646](https://arxiv.org/abs/2505.14646) | 沿用该综述登记，题名 / 编号对应待复核 | [专题 / 引用](research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md) |
| CAD-Coder（早期 CAD 笔记中的条目） | [2505.19713](https://arxiv.org/abs/2505.19713) | 沿用该笔记登记，题名 / 编号对应待复核 | [专题 / 引用](history/research/3d-verifiable-tasks-20261120.md) |
| AnimWeb-Bench | [2611.09769](https://arxiv.org/abs/2611.09769) | 多文件 Awwwards 级动态网页基准与多维视觉审美评估 | [专题 / 引用](research/cad-2d-sample-study-and-taxonomy-v2-20261126/README.md) |
| Webdev-Bench / WebCoder-27B | [2610.23104](https://arxiv.org/abs/2610.23104) | 多文件前端工程里程碑演进评测架 | [专题 / 引用](research/cad-2d-sample-study-and-taxonomy-v2-20261126/README.md) |
| WebUniverse | [2610.33149](https://arxiv.org/abs/2610.33149) | 多轮 Web Agent 轨迹与自定义许可边界 | [专题 / 引用](3d-animation-agent/docs/THREE-TRACK-DELIVERABLE-SPEC.md) |

## Agent SFT、数据配比与纠偏

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
| UI-TARS-2 | [2509.02544](https://arxiv.org/abs/2509.02544) | 多模态数据构造与混合 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
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
| OPSD | [2601.19897](https://arxiv.org/abs/2601.19897) | 在策略自蒸馏 | [专题 / 引用](research/arxiv-2610.02140/README.md) |
| Tülu 3 | [2411.15124](https://arxiv.org/abs/2411.15124) | 后训练流程与 SFT 定位 | [专题 / 引用](research/agent-sft-lessons-and-data-recipes-20261125/README.md) |
| AgentTuning | [2310.12823](https://arxiv.org/abs/2310.12823) | Agent 数据与通用能力 | [专题 / 引用](research/3d-agent-sft-mix-loss-20261123/README.md) |
| SFT Data Composition | [2310.05492](https://arxiv.org/abs/2310.05492) | 监督数据组成 | [专题 / 引用](research/3d-agent-data-mix-20261121/kimi-report.md) |
| Data Mixing Optimization for SFT | [2508.11953](https://arxiv.org/abs/2508.11953) | 数据混合优化 | [专题 / 引用](research/3d-agent-data-mix-20261121/kimi-report.md) |
| Hephaestus | [2502.06589](https://arxiv.org/abs/2502.06589) | Agent 工具训练 | [专题 / 引用](research/3d-agent-data-mix-20261121/kimi-report.md) |
| DeepSeek-R1 | [2501.12948](https://arxiv.org/abs/2501.12948) | 推理与后训练 | [专题 / 引用](research/3d-agent-data-mix-20261121/kimi-report.md) |

## 评估方法与背景引用

| 论文 / 笔记中的简称 | arXiv | 关注点 | 阅读记录 |
| --- | --- | --- | --- |
| Evaluating Large Language Models Trained on Code | [2107.03374](https://arxiv.org/abs/2107.03374) | 执行评估与 pass@k | [专题 / 引用](research/3d-agent-evaluation-system-20261122/astra-report.md) |
| τ-bench | [2406.12045](https://arxiv.org/abs/2406.12045) | 工具交互与重复可靠性 | [专题 / 引用](research/3d-agent-evaluation-system-20261122/README.md) |
| Adding Error Bars to Evals | [2411.00640](https://arxiv.org/abs/2411.00640) | 配对、题簇与统计不确定性 | [专题 / 引用](research/3d-agent-evaluation-system-20261122/README.md) |
| LiveCodeBench | [2403.07974](https://arxiv.org/abs/2403.07974) | 代码评测与时间窗口 | [专题 / 引用](research/3d-agent-evaluation-system-20261122/external-report-2.md) |
| Agentic Benchmark Checklist | [2507.02825](https://arxiv.org/abs/2507.02825) | 任务、结果与报告有效性 | [专题 / 引用](research/3d-agent-evaluation-system-20261122/README.md) |
| WorldAuditBench | [2609.40325](https://arxiv.org/abs/2609.40325) | 异常暴露与识别 | [专题 / 引用](research/3d-agent-evaluation-system-20261122/README.md) |
| Breaking the SFT Plateau: Multimodal Structured Reinforcement Learning for Chart-to-Code Generation | [2508.13587](https://arxiv.org/abs/2508.13587) | 图表代码与结构化反馈 | [专题 / 引用](research/3d-agent-data-mix-20261121/astra-report.md) |
| Training Alignment Auditors via RL | [2608.25460](https://arxiv.org/abs/2608.25460) | 审计 Agent 与反馈 | [专题 / 引用](research/3d-agent-openai-anthropic-reading-notes-20261121.md) |
| Language Models are Few-Shot Learners | [2005.14165](https://arxiv.org/abs/2005.14165) | 数据组成背景 | [专题 / 引用](research/3d-agent-data-mix-20261121/astra-report.md) |
| InstructGPT | [2203.02155](https://arxiv.org/abs/2203.02155) | 监督与偏好训练背景 | [专题 / 引用](research/3d-agent-data-mix-20261121/kimi-report.md) |
| GPT-4 Technical Report | [2303.08774](https://arxiv.org/abs/2303.08774) | 模型评估背景 | [专题 / 引用](research/3d-agent-data-mix-20261121/kimi-report.md) |
| LLaMA | [2302.13971](https://arxiv.org/abs/2302.13971) | 来源份额与重复曝光 | [专题 / 引用](research/3d-agent-sft-mix-loss-20261123/README.md) |
| LIMA | [2305.11206](https://arxiv.org/abs/2305.11206) | 监督质量与多样性 | [专题 / 引用](research/3d-agent-sft-hparams-aodi-selection-20261123/main-report.md) |
| D4 | [2308.12284](https://arxiv.org/abs/2308.12284) | 去重、多样化与重复 | [专题 / 引用](research/3d-agent-sft-hparams-aodi-selection-20261123/main-report.md) |
| DataComp-LM | [2406.11794](https://arxiv.org/abs/2406.11794) | 受控数据比较 | [专题 / 引用](research/3d-agent-sft-hparams-aodi-selection-20261123/main-report.md) |
| FineWeb | [2406.17557](https://arxiv.org/abs/2406.17557) | 数据筛选与消融 | [专题 / 引用](research/3d-agent-sft-hparams-aodi-selection-20261123/main-report.md) |

## 非 arXiv 材料

- [OpenAI / Anthropic 技术分享精读](research/3d-agent-openai-anthropic-reading-notes-20261121.md)：原始技术博客、工程实践与评估方法。
- [数据与题源盘点](research/3d-animation-distillation-datasets-20261121.md)：GitHub、Hugging Face、任务规格与数据使用边界。
- [3D / CAD 数据与基准调研](research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md)：公开数据、格式与能力边界。
