# 经验导读

以下要点从已有笔记中提炼，每条链接回原始研究或实验报告。它们适用于项目已记录的设置，具体参数与数字以对应文档为准。

## 1. 交付验收要在干净环境重跑

原目录能打开页面，不足以证明交付物完整。HTML 可能仍依赖留在工作区的 bundle、资源或服务。验收离线单文件时，复制到空目录冷加载，检查外部请求，再核对画面与状态。

来源：[旧 dev 交付失败诊断](3d-animation-agent/reports/round2-line-a-eval-20261124-001/old-dev-failure-diagnosis.md)、[首版失败复盘](research/3d-agent-round1-failure-retrospective-and-round2-audit-20261125/README.md)。

## 2. 可运行、机制正确和画面可读分别验证

程序执行成功不能代替动画质量。运动轨迹、接触与支撑、事件时序、主体可见性、镜头意图和美观度需要不同证据。技术规则与视觉判断分别报告，并保留失败样本和各自分母。

来源：[动画方法综述](research/3d-animation-methods-and-technique-selection-20261121.md)、[评估体系](research/3d-agent-evaluation-system-20261122/README.md)、[Eval v3](3d-animation-agent/reports/eval-v3-devtest-v2-20261125-001/REPORT.md)。

## 3. 修复数据必须真的包含缺陷

标成 repair 的任务可能只是健康场景检查。造数要覆盖真实缺陷、局部编辑、健康对照和从零生成，记录修复前后的证据；健康对照同时教会模型什么时候应该停止修改。

来源：[数据构造复盘](research/3d-agent-data-construction-retrospective-20261123/README.md)、[造数手册](3d-animation-agent/docs/DATA-PLAYBOOK.md)。

## 4. 训练轨迹需要保留真实请求上下文

仅从终端输出重建轨迹会遗漏 system、工具 schema、图片、历史思考或压缩边界。采集、转写、训练模板和推理协议需要对齐；转换后还要检查实际 tokenizer 渲染与监督位置。

来源：[采集来源审计](3d-animation-agent/reports/harness-data-provenance-20261124-001/REPORT.md)、[数据转换报告](3d-animation-agent/reports/sft-conversion-20261123-001/REPORT.md)、[参数规范](3d-animation-agent/docs/STANDARD-PARAMS.md)。

## 5. 配比要看监督与更新，不能只数记录

短单轮和长多轮混合时，记录数、输入 token、有效监督位置、权重和 loss reduction 会给出不同的“占比”。先把这几本账算清，再看批量、裁剪、重复曝光和分轨验证，才能解释某类行为为什么没学到。

来源：[配比与监督权重](research/3d-agent-sft-mix-loss-20261123/README.md)、[Packing 与并行效率](research/3d-agent-training-efficiency-packing-parallelism-20261124/README.md)。

## 6. 把及时收尾纳入能力定义

有些失败发生在已经通过检查之后：模型继续截图、微调和重验，最后超时。采集需要明确完成条件、轮数预算与自然结束标记；训练数据也应包含验通后交付、健康场景不乱改的行为。

来源：[首版失败与 Round 2 审查](research/3d-agent-round1-failure-retrospective-and-round2-audit-20261125/README.md)、[多轮 SFT 文献经验](research/agent-sft-lessons-and-data-recipes-20261125/README.md)。

## 7. 教师写得更精炼，不一定更适合学生

跨模型改写思考链可能改变文体与 token 分布。NLL 可以辅助诊断这种变化，但 NLL 下降本身不能证明任务能力改善或没有遗忘。最终仍需训练后在留出任务与通用能力上做对照。

来源：[CoT 压缩问题](3d-animation-agent/reports/student-cot-projection-exp-20261125-001/COT-PRUNE-OFFPOLICY-ISSUE.md)、[NLL / 投影实验](3d-animation-agent/reports/student-cot-projection-exp-20261125-001/REPORT.md)、[Finetuning with Sampling](research/arxiv-2610.02140/README.md)。

## 8. 越过单轮简单脚本天花板：面向多文件复杂工程与原生参数同构

强基座（如 `Qwen3.8-27B`）已具备可观的单轮短代码生成基线，继续堆砌单文件玩具题几乎不提升复杂工程与审美上限，甚至会干扰长程多轮工具习惯。高收益蒸馏应聚焦：多模块工程组织（前端 ES6 多文件 + 本地静态服务、CAD 参数+零件+装配分模块与 `STEP` 零干涉验证）、保留原生 `auto-compact` 分段与第一人称 `<think>`、对坏轮仅置二值 `"loss": False` 保留纠错闭环，并遵循“不传多余定制参数、训推工具面与默认档位原生同构”原则。

来源：[三轨顶级交付规格 v2.0](3d-animation-agent/docs/THREE-TRACK-DELIVERABLE-SPEC.md)、[2026 样本学习与 v2.0 分类树](research/cad-2d-sample-study-and-taxonomy-v2-20261126/README.md)、[全链路管线对齐联合审核](research/three-track-pipeline-alignment-audit-20261126/README.md)、[单轮 vs 长程多轮证据](3d-animation-agent/reports/oneshot-vs-longhorizon-3dcodefactory-20261126/REPORT.md)。
