# 3D Animation Research Notes

围绕 **代码驱动的 3D 场景与动画（Blender `bpy` + Three.js）、2D Web 多文件交互动画、CadQuery 参数化建模与工业装配、多模态长程 Agent 数据构造、Option 2 全链路 `Static YaRN 1.5×` 不切分硬训 `384K` + `256K` 统一沙盒，以及 SFT 后确定性 Repair-RL 与 256K RFT 收敛方案**，整理已有论文精读、大厂技术复盘、工程经验和实验记录。

最新更新日期：**2026-11-28**。共收录 **186 份文档、分类配置与实测统计清单**，索引 **132 条去重 arXiv 引用**，其中 **42 篇有单独一手精读**。

## 从这里开始

| 想看什么 | 入口 |
| --- | --- |
| 论文列表、分类与 42 篇单篇精读 | [Paper list](PAPERS.md) |
| 从项目与同源文献提炼的实战避坑经验 | [经验导读](LESSONS.md) |
| **Revision 3 / Option 2 终局定案：全链路 `Static YaRN 1.5×` 硬训 `384K` + `256K` 统一沙盒与 CAD/2D 配比总案（2026-11-28 唯一真值）** | [**4 模型无尘室独立裁决（Option 2）**](research/xhs-384k-to-200k-data-adaptation-20261127/CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md) · [**Option 2 CAD/2D 数据、独立评估与混训配比总蓝图**](research/xhs-384k-to-200k-data-adaptation-20261127/OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md) · [**全工作区版本差异与改动对照清单**](3d-animation-agent/docs/OPTION2-VERSION-DIFF-AND-CHANGE-CHECKLIST.md) · [XHS Option 2 统一训练标准](3d-animation-agent/docs/XHS-UNIFIED-SFT-STANDARD.md) · [Rev 1/2 历史归档索引](research/xhs-384k-to-200k-data-adaptation-20261127/archive/README.md) |
| **`realhard6` 四方真高难盲测尸检与 3D $\to$ 工业 CAD / 高精 2D 跃迁四分册蓝图（2026-11-28 新增）** | [**`realhard6` 尸检与跨轨总方案档案**](3d-animation-agent/docs/REALHARD6-AND-3D-TO-2D-CAD-BLUEPRINT-20261127.md) · [蓝图总纲](research/distill-3d-to-2d-cad-blueprint-20261127/README.md) · [01 · 384K 训练与 256K 沙盒](research/distill-3d-to-2d-cad-blueprint-20261127/01-sandbox-context-spec.md) · [02 · 工业 CAD 跃迁](research/distill-3d-to-2d-cad-blueprint-20261127/02-cad-capability-plan.md) · [03 · 高精 2D 与四阶段配比](research/distill-3d-to-2d-cad-blueprint-20261127/03-2d-capability-and-mixing-plan.md) |
| **SFT 后强化学习、Opus 5.5 去杂糅收敛与同源防刷分总览** | [**Opus 5.5 联合去杂糅与终极收敛蓝图**](research/3d-agent-rl-opus-review-and-consolidation-20261127/README.md) · [**可执行工程计划书（Option 2 对齐）**](3d-animation-agent/docs/plans/2026-11-27-post-sft-repair-rl-and-rft-plan.md) · [RL 全景调研 v3.0](research/3d-agent-post-sft-rl-survey-20261127/README.md) · [31 大踩坑避坑手册](research/visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md) · [2026 H2 大厂技术博客专题](research/frontier-labs-agentic-rl-blogs-2026h2/README.md) |
| 全部研究与阅读笔记 | [117 份研究文档与统计附件](research/README.md) |
| 数据守则、三轨交付规格、版本对照清单、`realhard6`、Canary-12、RL 计划与分类树 | [32 份工程文档与分类配置](3d-animation-agent/docs/README.md) |
| 训练、评测、失败原因与阶段整合实验报告 | [32 份实验报告](3d-animation-agent/reports/README.md) |
| 早期方案的完整历史原文 | [5 份历史笔记](history/README.md) |

## 推荐阅读路线

1. **Revision 3 / Option 2 唯一权威战略（2026-11-28 定版）**：[**4 模型无尘室独立裁决**](research/xhs-384k-to-200k-data-adaptation-20261127/CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md) → [**Option 2 CAD/2D 数据、独立评估与混训配比总蓝图**](research/xhs-384k-to-200k-data-adaptation-20261127/OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md) → [**全工作区版本差异与改动对照清单**](3d-animation-agent/docs/OPTION2-VERSION-DIFF-AND-CHANGE-CHECKLIST.md) → [XHS Option 2 统一标准规范](3d-animation-agent/docs/XHS-UNIFIED-SFT-STANDARD.md) → [Rev 1/2 历史方案归档](research/xhs-384k-to-200k-data-adaptation-20261127/archive/README.md)。
2. **`realhard6` 四方真高难盲测尸检与 3D $\to$ 工业 CAD / 高精 2D 跃迁**：[**`realhard6` 尸检与跨轨总方案档案**](3d-animation-agent/docs/REALHARD6-AND-3D-TO-2D-CAD-BLUEPRINT-20261127.md) → [02 · 工业 CAD 跃迁蓝图](research/distill-3d-to-2d-cad-blueprint-20261127/02-cad-capability-plan.md) → [03 · 高精 2D 与四阶段配比](research/distill-3d-to-2d-cad-blueprint-20261127/03-2d-capability-and-mixing-plan.md) → [三轨顶级交付产物规格 v2.1](3d-animation-agent/docs/THREE-TRACK-DELIVERABLE-SPEC.md) → [2D/CAD Canary-12 与 AGY 盲测复盘（含勘误）](3d-animation-agent/docs/CANARY-12-AND-AGY-PROBE-REPORT-20261127.md)。
3. **SFT 之后的强化学习、Opus 5.5 去杂糅收敛与视觉防刷分避坑（2026-11-27 重磅新增）**：[3DCodeFactory 精读（§6 留白起点）](research/arxiv-2611.28783/README.md) → [**主审 × Claude Opus 5.5 联合去杂糅与终极收敛蓝图（工程落地首选）**](research/3d-agent-rl-opus-review-and-consolidation-20261127/README.md) → [**单模型三轨 Repair-RL 与 384K RFT 计划书**](3d-animation-agent/docs/plans/2026-11-27-post-sft-repair-rl-and-rft-plan.md) → [SFT 后强化学习全景调研 v3.0](research/3d-agent-post-sft-rl-survey-20261127/README.md) → [2026 同源 31 大踩坑避坑大全](research/visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md) → [2026 H2 八大前沿实验室技术博客专题](research/frontier-labs-agentic-rl-blogs-2026h2/README.md)。
4. **理解动画质量与验收**：[运动、镜头和技术选型综述](research/3d-animation-methods-and-technique-selection-20261121.md) → [评估体系联合调研](research/3d-agent-evaluation-system-20261122/README.md)。
5. **理解数据与早期 SFT 训练复盘**：[3DCodeVerse 精读](research/arxiv-2610.22341/README.md) → [单轮 vs 长程多轮对照复盘](3d-animation-agent/reports/oneshot-vs-longhorizon-3dcodefactory-20261126/REPORT.md) → [多轮 Agent SFT 文献与经验](research/agent-sft-lessons-and-data-recipes-20261125/README.md) → [首版训练失败复盘](research/3d-agent-round1-failure-retrospective-and-round2-audit-20261125/README.md)。
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
