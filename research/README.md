# 研究笔记索引

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../PROVENANCE.md)。

整理于 2026-11-27。接续 3D 动画任务先读[当前实验与证据](../3d-animation-agent/reports/README.md)和[Round 2 方案](../3d-animation-agent/docs/plans/2026-11-24-round2-27b-data-and-training-plan.md)。研究报告中的建议与实际运行结果分别判断；旧文的“当前”“下一步”只代表成文时点。

## 当前仍在使用的方法与证据

| 问题 | 阅读入口 | 使用边界 |
| --- | --- | --- |
| **三轨合训全链路数据管线对齐与隐患联合审核（主调研方 + Astra 独立取证）** | [全链路管线联合审核汇总](three-track-pipeline-alignment-audit-20261126/README.md) · [主调研方独立报告](three-track-pipeline-alignment-audit-20261126/main-report.md) · [Astra 独立报告](three-track-pipeline-alignment-audit-20261126/astra-report.md) | 逐行审查小红书复入链、自产 `repos-logging-proxy` 采集转换链、`convert_native_to_xhs_ready`、`ms-swift` 插件与 `eval_xhs_threejs` 推理链；复现图文重排、压缩断链、25 vs 6 工具劈叉、无参坏调用入训等 7 项 P0 断点，给出开工前必改单与四道 Go/No-Go 门禁。 |
| **2026 外部 2D/CAD 高质样本实测调研、27B 能力缺口与 `v2.0` 接地气分类树** | [2026 样本学习与 v2.0 分类树报告](cad-2d-sample-study-and-taxonomy-v2-20261126/README.md) · [样本统计 JSON](cad-2d-sample-study-and-taxonomy-v2-20261126/sample_study_2026_analysis.json) · [Anim2D-Tree v2.0](../3d-animation-agent/configs/taxonomies/anim2d_tree_v2_0.json) · [CadQuery-Tree v2.0](../3d-animation-agent/configs/taxonomies/cadquery_tree_v2_0.json) | 实拉 9 大 2026 外部仓库切片与核验协议，交叉 27B Base 弱点并对齐小红书两层接地气产品风格落盘 `5 大类 × 4 词条 = 20 词条` `v2.0` 分类树；严守 NC-SA / OOD 不入训红线。 |
| **小红书出题与 Rubric 体系拆解及 2D/CAD 双轨并发造数规范** | [小红书出题与 Rubric 拆解及双轨造数规范](../3d-animation-agent/docs/XHS-TASK-AND-RUBRIC-SPEC.md) · [三轨顶级交付产物规格 v2.0](../3d-animation-agent/docs/THREE-TRACK-DELIVERABLE-SPEC.md) | 逐行拆解 `3DCodeFactory` 的 `P01–P11`、`press/hall` 案例与五维门禁，将 `(C,S,F)` 出题、`{0,0.5,1}` 部件级锚点与 `P07` 零隐藏考题自审 1:1 映射至 2D 多文件动效与 CAD 多模块装配并发工厂。 |
| **三轨视觉 Agent 数据工厂与分类树总方案（主方案 + Astra 联合审核 + Aodi 并表复盘）** | [三轨数据工厂与分类树联合审核汇总](three-track-data-factory-strategy-20261126/README.md) · [主提案](three-track-data-factory-strategy-20261126/main-report.md) · [Astra 独立审核](three-track-data-factory-strategy-20261126/astra-report.md) · [Aodi Phase 1/2 并表复盘](three-track-data-factory-strategy-20261126/aodi-phase1-phase2-retrospective-20261126.md) | 划清三轨 vs 小红书边界；217 分片实扫证真 L2=1,128 题（944 图+184 纯文）、L3 窗内=0 条；初版 CAD/2D 双层 36 叶/12 核心族采样树与 Step 1–7 门禁（高难长程已由 `v2.0` 树承接），并增补 Aodi `r=64` LoRA 复盘与 Phase 2 四项避坑预警（尚未写入 `decisions.md`）。 |
| **Round 3 对齐改造总计划（Big Picture）** | [Round 3 全链路对齐改造总计划](../3d-animation-agent/docs/plans/2026-11-25-round3-big-picture-alignment-plan.md) | 现成 `3DCodeFactory` 分级清洗复用 + 提示词解耦放权 + Round 3 五本账配比与 Phase 0–3 落地路线图。 |
| 3D 造数总守则与 27B 能力边界 | [3D Agent 造数手册（DATA-PLAYBOOK）](../3d-animation-agent/docs/DATA-PLAYBOOK.md) · [全链路统一参数规范](../3d-animation-agent/docs/STANDARD-PARAMS.md) | 汇总实测 27B 强弱项边界、造数八大守则与五环节强约束参数。 |
| 怎样借鉴小红书 `3DCodeFactory`（Apache-2.0） | [3DCodeFactory（arXiv:2611.28783v1）一手精读与迁移方案](arxiv-2611.28783/README.md) | 同源 DeepSeek 1017 + Claude Code + Qwen3.8-27B 路线；含 P01–P11、Best-of-2、轮级掩坏轮与 HF `qwen-sft-6414` 分片实查避坑。 |
| 怎样构建和审查 Round 2 数据 | [首版失败与 Round 2 审查](3d-agent-round1-failure-retrospective-and-round2-audit-20261125/README.md) · [实际冻结账本](../3d-animation-agent/reports/round2-phase2-curation-20261125/FREEZE-REPORT.md) | 复盘解释原因；缺口是否已修复要看后续运行证据。 |
| 如何计算数据配比与 loss | [配比与 loss 五本账](3d-agent-sft-mix-loss-20261123/README.md) | 分清记录数、输入 token、监督位置 U、加权和 W 与实际 reduction；旧 90:10/80:20 不是当前默认值。 |
| 如何测完整 Agent 能力 | [评估体系联合调研](3d-agent-evaluation-system-20261122/README.md) · [devtest-v2 实测](../3d-animation-agent/reports/round2-line-a-eval-20261124-001/REPORT.md) | Accepted@1、技术通过、初步看图与正式盲评不能混算。 |
| 怎样选择 Aodi 底座与超参 | [首版参数与 Aodi 筛选复盘](3d-agent-sft-hparams-aodi-selection-20261123/README.md) | 保留覆盖与重复审计；实际入训来源以当前 manifest 为准。 |
| 如何提高 27B 训练效率 | [Packing、并行拓扑与 M7 实测](3d-agent-training-efficiency-packing-parallelism-20261124/README.md) | 适用已验证的 dense 27B、双机 16×H800 与软件环境。 |
| 多轮 SFT 有哪些已知陷阱 | [22 篇论文的经验与数据配方](agent-sft-lessons-and-data-recipes-20261125/README.md) | 公开结果需要按阶段、任务与分母迁移，不能直接当作本项目收益。 |
| 怎样测运动、镜头和技术选型 | [纯代码 3D 动画评测与技术选型](3d-animation-methods-and-technique-selection-20261121.md) | 文献与验证方法仍有价值，不因日期较早移除。 |
| 有哪些公开题源与源码 | [数据与题源盘点](3d-animation-distillation-datasets-20261121.md) · [3DCodeVerse 原始档案](arxiv-2610.22341/README.md) | 来源登记可复用；盘点中的 Kimi 试跑安排属于历史。 |
| 怎样把工作流拆成可验收任务 | [OpenAI / Anthropic 技术分享精读](3d-agent-openai-anthropic-reading-notes-20261121.md) | 保留一手来源及正常样本、装配路径和失败构造方法。 |

## 正在探索或留待后续验证

| 方向 | 入口 | 当前定位 |
| --- | --- | --- |
| **小红书 SFT 之后的强化学习、多专家在线蒸馏（MOPD）与 2026 同源视觉/3D 避坑全景调研（38 篇新下论文一手深读 + 2026 H2 大厂博客）** | **三大总入口**：[SFT 后强化学习与自蒸馏总报告 v2.0](3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源 25 大踩坑避坑大全与实战手册](visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md) · [2026 下半年八大前沿实验室官方博客专题](frontier-labs-agentic-rl-blogs-2026h2/README.md)<br>• **2026 H2 大厂旗舰报告**：[DeepSeek-V4](arxiv-2606.19348/README.md) · [Kimi K3](arxiv-2607.24653/README.md) · [Qwen3.8-Next](arxiv-2608.30320/README.md) · [GLM-5 / slime](arxiv-2602.15763/README.md) · [Kimi K2.5 Toggle](arxiv-2602.02276/README.md) · [Anthropic 生产黑客](arxiv-2511.18397/README.md) · [UI-TARS-2](arxiv-2509.02544/README.md) · [Qwen3-VL](arxiv-2511.21631/README.md)<br>• **2026 H2 3D / 动画同源 RL**：[BlenderFORGE](arxiv-2611.10768/README.md) · [Video-Coder](arxiv-2611.09894/README.md) · [ManimCode](arxiv-2611.08294/README.md) · [3DCodeEdit](arxiv-2610.38231/README.md) · [LEGO-Anything](arxiv-2609.36380/README.md) · [ScenePRM](arxiv-2608.29519/README.md) · [WorldCraft](arxiv-2502.15601/README.md)<br>• **2026 H2 交互 Web / 2D / SVG 同源 RL**：[WebCatalyst](arxiv-2611.05151/README.md) · [InterWebCoder](arxiv-2610.28610/README.md) · [WebLoop](arxiv-2610.11543/README.md) · [IR4RL](arxiv-2609.34587/README.md) · [RULER](arxiv-2609.25270/README.md) · [RefineSVG](arxiv-2607.27699/README.md) · [AeSlides](arxiv-2604.22840/README.md) · [WebGen-R1](arxiv-2604.20398/README.md) · [ReLook](arxiv-2510.11498/README.md) · [WebGen-Agent](arxiv-2509.22644/README.md) · [MSRL](arxiv-2508.13587/README.md)<br>• **CAD 参数化与物理 RL**：[PhyCAD](arxiv-2611.09401/README.md) · [IterCAD](arxiv-2606.13368/README.md) · [cadrille](arxiv-2505.22914/README.md) · [CAD-Coder](arxiv-2505.19713/README.md)<br>• **压缩感知 RL、优化器与自蒸馏**：[RECAP](arxiv-2611.31258/README.md) · [CompactionRL](arxiv-2607.05378/README.md) · [GSPO](arxiv-2507.18071/README.md) · [GiGPO](arxiv-2505.10978/README.md) · [POW3R](arxiv-2605.20164/README.md) · [SRaR](arxiv-2605.17291/README.md) · [Rubric Hacking](arxiv-2605.12474/README.md) · [SDFT](arxiv-2601.19897/README.md) | 承接 `3DCodeFactory` §6 留白，对齐 2026 下半年最新格局：提炼 20 个同源真实踩坑（删美感保功能 `-10.2`、CSS `overflow: hidden` 截断、`21×` 碎笔画膨胀、自评几何 `<50%`、抢占重采短偏置等），确立 **Stage 0（SFT）$\to$ Stage 1（AggreVaTe + SDFT）$\to$ Stage 2（分轨专精 RL：GSPO-token + HBA + Visual Anchor + CDP ATC）$\to$ Stage 3（RECAP/CompactionRL 跨压缩）$\to$ Stage 4（DeepSeek-V4 / Kimi K3 多教师在线蒸馏 MOPD 无损合模）** 五阶段蓝图。 |
| 3D / CAD 基准、开源数据与 27B 边界 | [3D/CAD 基准与数据集调研](3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md) | 吸收 BenchCAD/CADBench/3DCodeBench 验收方法与 Apache-2.0 `Zero-To-CAD-100k` 扩面分布，严守 27B 能力圈、拒绝追榜式整库倾倒。 |
| CoT 与学生分布、投影采样 | [Finetuning with Sampling](arxiv-2610.02140/README.md) · [本地 NLL 与压缩问题](../3d-animation-agent/reports/student-cot-projection-exp-20261125-001/COT-PRUNE-OFFPOLICY-ISSUE.md) | 实验仍在更新；未由 NLL 单独证明 SFT 效果。 |
| 学生访问状态上的教师纠偏 | [DAgger 论文](arxiv-2605.12913/README.md) · [完整 episode 与纠偏研究](3d-agent-student-centered-react-and-35b-20261124/README.md) | Round 2 以纯教师数据为主，学生中心纠偏留作后续；35B MoE 方向已暂停。 |

## 历史复盘与已替代建议

- [首版数据构造联合复盘](3d-agent-data-construction-retrospective-20261123/README.md)：保留真实修复空缺、环境污染、选优偏差与归因边界的证据。
- [早期配比提案](3d-agent-data-mix-20261121/README.md)：原文已归档；当前使用五本账与冻结数据清单。独立报告和会话凭据继续保留。
- [首轮数据组成草案](3d-agent-training-data-composition-20261122.md)、[沙盒蒸馏试点](3d-agent-sandbox-distillation-20261120.md)、[首批 Kimi 筛选笔记](3d-animation-improvement-and-sft-cases-20261121.md)：压缩归档，旧路径保留简短的替代入口。
- [早期 CAD / 装配 RL 构想](3d-verifiable-tasks-20261120.md)：备选方向归档，不作为本轮待办。
- `清理清单与恢复方法`（本地附件未发布）：完整原文和校验和可恢复，用户原始材料、论文快照和正式实验来源保留。

## 其他项目

- `AI 员工早期试点笔记`（本地附件未发布）；现行岗位和技能见 `AI 员工项目`（本地附件未发布）。
- `PPT 布局资产核查证据包`（本地附件未发布）。
