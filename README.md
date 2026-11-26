# 3D Animation Research Notes

围绕 **代码驱动的 3D 场景与动画、2D Web 多文件交互动画、CadQuery 参数化建模与 3D 打印、多模态长程 Agent 数据构造与 SFT 蒸馏**，整理已有论文阅读、工程经验和实验复盘。

最新更新日期：**2026-11-27**。共收录 **118 份文档与分类配置**，索引 **85 条去重 arXiv 引用**，其中 **4 篇有单独精读**。

## 从这里开始

| 想看什么 | 入口 |
| --- | --- |
| 论文列表、分类与对应阅读记录 | [Paper list](PAPERS.md) |
| 从项目中提炼的经验 | [经验导读](LESSONS.md) |
| 全部研究与阅读笔记 | [57 份研究文档](research/README.md) |
| 数据守则、三轨交付规格、分类树与方案 | [27 份工程文档与分类配置](3d-animation-agent/docs/README.md) |
| 训练、评测、失败原因与纠偏实验 | [29 份实验报告](3d-animation-agent/reports/README.md) |
| 早期方案的完整历史原文 | [5 份历史笔记](history/README.md) |

## 推荐阅读路线

1. **三轨多文件长程总纲与全链路对齐（2026-11-26..27 新增）**：[三轨顶级交付产物规格 v2.0](3d-animation-agent/docs/THREE-TRACK-DELIVERABLE-SPEC.md) → [2026 外部 2D/CAD 样本调研与 v2.0 接地气分类树](research/cad-2d-sample-study-and-taxonomy-v2-20261126/README.md) → [三轨数据工厂联合审核总方案](research/three-track-data-factory-strategy-20261126/README.md) → [全链路数据管线对齐与隐患联合审核](research/three-track-pipeline-alignment-audit-20261126/README.md)。
2. **理解动画质量与验收**：[运动、镜头和技术选型综述](research/3d-animation-methods-and-technique-selection-20261121.md) → [评估体系联合调研](research/3d-agent-evaluation-system-20261122/README.md)。
3. **理解数据与训练方法**：[3DCodeVerse 精读](research/arxiv-2610.22341/README.md) → [3DCodeFactory 精读](research/arxiv-2611.28783/README.md) → [单轮 vs 长程多轮对照复盘](3d-animation-agent/reports/oneshot-vs-longhorizon-3dcodefactory-20261126/REPORT.md) → [多轮 Agent SFT 文献与经验](research/agent-sft-lessons-and-data-recipes-20261125/README.md)。
4. **理解实际踩过的坑**：[首版训练失败复盘](research/3d-agent-round1-failure-retrospective-and-round2-audit-20261125/README.md) → [配比与 loss 五本账](research/3d-agent-sft-mix-loss-20261123/README.md) → [训练效率与 Packing](research/3d-agent-training-efficiency-packing-parallelism-20261124/README.md) → [XHS 统一 384K SFT 标准](3d-animation-agent/docs/XHS-UNIFIED-SFT-STANDARD.md)。
5. **探索学生中心训练**：[DAgger 精读](research/arxiv-2605.12913/README.md) → [Finetuning with Sampling 精读](research/arxiv-2610.02140/README.md) → [本地 CoT / NLL 实验](3d-animation-agent/reports/student-cot-projection-exp-20261125-001/REPORT.md)。

## 工程速查

- [造数手册与能力边界](3d-animation-agent/docs/DATA-PLAYBOOK.md)
- [全链路参数与避坑规范](3d-animation-agent/docs/STANDARD-PARAMS.md)
- [Eval v3 评测与历史重评报告](3d-animation-agent/reports/eval-v3-devtest-v2-20261125-001/REPORT.md)
- [3D / CAD 基准与公开数据](research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md)
- [OpenAI / Anthropic 技术分享阅读](research/3d-agent-openai-anthropic-reading-notes-20261121.md)

## 如何理解这些记录

这是按成文时点保留的研究资料集。论文报告的数字、本地实验结果、待验证建议分别看待；旧笔记里的“当前”“下一步”不代表此刻状态。部分文档来自 AI 辅助调研与独立评审，阅读状态和已有疑点保留在原文中。本次发布整理了内容与导航，没有重新复现全部实验或逐篇复核所有文献。

仓库保留原有相对目录，方便从研究结论追到工程方案和实验报告。环境路径已替换为占位符；原始会话、运行日志、凭据、模型、训练数据、论文全文和第三方源码快照未收录。未发布附件已明确标注，上游论文与代码使用公开链接。

详见 [整理与来源说明](PROVENANCE.md)、[文档来源清单](catalog/import-manifest.json) 与 [论文引用索引](catalog/papers.json)。

## 后续积累

新增论文时记录原文链接、版本、核心问题、方法、实验口径、局限和项目启发；明确区分“已精读”“综述引用”“待核验”。新增实验时保留日期、设置、分母、对照与结论边界，再更新相应目录和 paper list。
