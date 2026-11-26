# 3D Animation Research Notes

围绕 **代码驱动的 3D 场景与动画、2D Web 多文件交互动画、CadQuery 参数化建模与 3D 打印、多模态长程 Agent 数据构造、SFT 蒸馏以及 SFT 后强化学习与多专家在线蒸馏（MOPD）**，整理已有论文精读、大厂技术复盘、工程经验和实验记录。

最新更新日期：**2026-11-27**。共收录 **161 份文档、分类配置与实测统计清单**，索引 **116 条去重 arXiv 引用**，其中 **42 篇有单独一手精读**。

## 从这里开始

| 想看什么 | 入口 |
| --- | --- |
| 论文列表、分类与 42 篇单篇精读 | [Paper list](PAPERS.md) |
| 从项目与同源文献提炼的实战避坑经验 | [经验导读](LESSONS.md) |
| **SFT 后强化学习、多专家在线蒸馏与同源防刷分总览（2026-11-27 新增）** | [RL 与自蒸馏五阶段总报告 v2.0](research/3d-agent-post-sft-rl-survey-20261127/README.md) · [25 大同源踩坑避坑手册](research/visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md) · [2026 H2 大厂技术博客专题](research/frontier-labs-agentic-rl-blogs-2026h2/README.md) |
| 全部研究与阅读笔记 | [99 份研究文档与统计附件](research/README.md) |
| 数据守则、三轨交付规格、出题 Rubric 规范、分类树与方案 | [28 份工程文档与分类配置](3d-animation-agent/docs/README.md) |
| 训练、评测、失败原因与纠偏实验 | [29 份实验报告](3d-animation-agent/reports/README.md) |
| 早期方案的完整历史原文 | [5 份历史笔记](history/README.md) |

## 推荐阅读路线

1. **三轨多文件长程总纲与全链路对齐（2026-11-26..27）**：[三轨顶级交付产物规格 v2.0](3d-animation-agent/docs/THREE-TRACK-DELIVERABLE-SPEC.md) → [2026 外部 2D/CAD 样本调研与 v2.0 接地气分类树](research/cad-2d-sample-study-and-taxonomy-v2-20261126/README.md) → [小红书出题与 Rubric 拆解及双轨造数规范](3d-animation-agent/docs/XHS-TASK-AND-RUBRIC-SPEC.md) → [三轨数据工厂联合审核总方案](research/three-track-data-factory-strategy-20261126/README.md) → [全链路数据管线对齐与隐患联合审核](research/three-track-pipeline-alignment-audit-20261126/README.md)。
2. **SFT 之后的强化学习、多专家合模与视觉防刷分避坑（2026-11-27 重磅新增）**：[3DCodeFactory 精读（§6 留白起点）](research/arxiv-2611.28783/README.md) → [SFT 后强化学习与自蒸馏总报告 v2.0](research/3d-agent-post-sft-rl-survey-20261127/README.md) → [2026 同源 25 大踩坑避坑大全](research/visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md) → [2026 H2 八大前沿实验室技术博客专题](research/frontier-labs-agentic-rl-blogs-2026h2/README.md) → 代表单篇（[DeepSeek-V4 OPD](research/arxiv-2606.19348/README.md) · [Kimi K3 MOPD & AgentENV](research/arxiv-2607.24653/README.md) · [WebCatalyst](research/arxiv-2611.05151/README.md) · [BlenderFORGE](research/arxiv-2611.10768/README.md) · [PhyCAD HBA](research/arxiv-2611.09401/README.md) · [CompactionRL](research/arxiv-2607.05378/README.md)）。
3. **理解动画质量与验收**：[运动、镜头和技术选型综述](research/3d-animation-methods-and-technique-selection-20261121.md) → [评估体系联合调研](research/3d-agent-evaluation-system-20261122/README.md)。
4. **理解数据与 SFT 训练方法**：[3DCodeVerse 精读](research/arxiv-2610.22341/README.md) → [单轮 vs 长程多轮对照复盘](3d-animation-agent/reports/oneshot-vs-longhorizon-3dcodefactory-20261126/REPORT.md) → [多轮 Agent SFT 文献与经验](research/agent-sft-lessons-and-data-recipes-20261125/README.md)。
5. **理解实际踩过的 SFT 工程坑**：[首版训练失败复盘](research/3d-agent-round1-failure-retrospective-and-round2-audit-20261125/README.md) → [配比与 loss 五本账](research/3d-agent-sft-mix-loss-20261123/README.md) → [训练效率与 Packing](research/3d-agent-training-efficiency-packing-parallelism-20261124/README.md) → [XHS 统一 384K SFT 标准](3d-animation-agent/docs/XHS-UNIFIED-SFT-STANDARD.md)。
6. **探索学生中心纠偏与自蒸馏桥接**：[DAgger 精读](research/arxiv-2605.12913/README.md) → [Finetuning with Sampling 精读](research/arxiv-2610.02140/README.md) → [SDFT 在线自蒸馏精读](research/arxiv-2601.19897/README.md) → [本地 CoT / NLL 实验](3d-animation-agent/reports/student-cot-projection-exp-20261125-001/REPORT.md)。

## 工程速查

- [造数手册与能力边界](3d-animation-agent/docs/DATA-PLAYBOOK.md)
- [全链路参数与避坑规范](3d-animation-agent/docs/STANDARD-PARAMS.md)
- [Eval v3 评测与历史重评报告](3d-animation-agent/reports/eval-v3-devtest-v2-20261125-001/REPORT.md)
- [3D / CAD 基准与公开数据](research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md)
- [OpenAI / Anthropic 技术分享阅读](research/3d-agent-openai-anthropic-reading-notes-20261121.md)

## 如何理解这些记录

这是按成文时点保留的研究资料集。论文报告的数字、本地实验结果、待验证建议分别看待；旧笔记里的“当前”“下一步”不代表此刻状态。部分文档来自 AI 辅助调研与并发子智能体全文+附录精读，阅读状态和已有边界保留在原文中。

仓库保留原有相对目录，方便从研究结论追到工程方案和实验报告。环境路径已替换为占位符；原始会话、运行日志、凭据、模型、训练数据、论文全文 HTML/PDF 和第三方源码快照未收录。未发布附件已明确标注，上游论文与代码使用公开链接。

详见 [整理与来源说明](PROVENANCE.md)、[文档来源清单](catalog/import-manifest.json) 与 [论文引用索引](catalog/papers.json)。

## 后续积累

新增论文时记录原文链接、版本、核心问题、方法、实验口径、局限和项目启发；明确区分“已精读”“综述引用”“待核验”。新增实验时保留日期、设置、分母、对照与结论边界，再更新相应目录和 paper list。
