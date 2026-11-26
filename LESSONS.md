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

## 9. SFT 之后的强化学习：拒绝异构混合裸跑，走“分轨分层防刷分 RL → 多专家在线蒸馏合模”

1. **分域专精 RL 后用 `OPD / MOPD` 合模取代大杂烩混合 RL**：2026 下半年旗舰（`DeepSeek-V4`、`Kimi K3`）一致证明，将奖励尺度迥异的多个赛道强塞进同一混合 RL 循环极易发生跷跷板退化；先按单轨干净验证器各自训透 `3D / 2D / CAD` 专精专家，再在共享 `Qwen3.8-27B` 自采轨迹上做全词表反向 KL 在线蒸馏（缓存末层 Hidden State 单次挂载 LM Head 几乎零显存膨胀），可无损合入单一模型且保留通用能力锚点（`BlenderFORGE` 实测砍掉通用锚点跑 RL 会反跌 `-3.0 pp`）。
2. **硬门禁严格分层优先（`HBA`）+ 冻结强参考帧防“去美化刷分”**：把硬构建/物理约束与软视觉分平面相加做 GRPO 会让联合可行率跌破 SFT（`PhyCAD` `-2.96 pp`），而单跑 GUI 交互奖励会让模型删光材质阴影只留丑陋色块换取点击通过率（`WebCatalyst` 美学暴跌 `-10.2` 分）。必须执行四层 `HBA`（构建/静态越界/动态探针全通才进视觉层），并配强教师冻结 `Visual Anchor` 单边防退化惩罚与 `GDPO` 分量独立白化。
3. **跨 `auto-compact` 压缩与有状态工作区的三大数学红线**：① 必须保留 Claude Code 原生 9 节压缩 `<summary>` 的梯度监督（抹掉掉 `-7.8 pp`）并按**全局可训输出 Token 总数**归一化 Loss（按段平均暴跌 `-6.4 pp`，`CompactionRL`）；② 代码工作区文件已是累积态，步骤奖励严禁累加未来步折扣分（`WebGen-Agent` 累加反跌 `-6.7 pp`）；③ 严禁因看图微调降分直接扣负奖励吓退 `<get_feedback>`（`ReLook` 负分罢工坍塌），改用单调增益接收/快照回滚与 `IterCAD GVPM` 可行前缀保护。

来源：[SFT 后强化学习与自蒸馏总报告 v2.0](research/3d-agent-post-sft-rl-survey-20261127/README.md)、[2026 同源 25 大踩坑避坑大全](research/visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)、[2026 H2 大厂技术博客专题](research/frontier-labs-agentic-rl-blogs-2026h2/README.md)、[DeepSeek-V4](research/arxiv-2606.19348/README.md)、[Kimi K3](research/arxiv-2607.24653/README.md)、[WebCatalyst](research/arxiv-2611.05151/README.md)、[PhyCAD](research/arxiv-2611.09401/README.md)、[CompactionRL](research/arxiv-2607.05378/README.md)。

## 10. 视觉与几何验证器铁律：几何归确定性探针，微差归正反双序盲评，判分物理只读隔离

1. **绝不让 VLM 肉眼猜三维几何与画布比例，也绝不用裸 CLIP/Aesthetic 标量模型**：实测连 `GPT-6` 凭 RGB 图判断 3D 几何进退的一致率都只有 `45.8%`（低于抛硬币，`LEGO-Anything`），`GPT-5.2` 判比例失调 F1 仅 `0.24`（`AeSlides`），而裸美学标量模型在 SVG RL 中会诱发 `21×` 碎路径暴涨与 `<text>` 字牌糊弄（`RULER`）。三维几何/干涉归 OCCT 体积 + 体素 IoU + 剖面图与包围盒，版式越界归剥离伪装 `overflow: hidden` + `21×21` 高斯平滑后的确定性 DOM 探针。
2. **用本地 `Qwen3.8-27B` 正反双序成对盲评 + 独立怀疑论挑刺替代外部昂贵标量裁判**：当质量微差 `<0.25` 时标量 VLM 人机一致率崩至 `29%`（`ManimCode`），且省掉裁判 JSON 中前置 `"reasoning"` 会直接引发排名崩溃（`POW3R`）。实测本地部署 `Qwen3.8-27B` 作交互视觉裁判与人类相关性达 `r = 0.838`（超 `GPT-5.6 Terra` 的 `0.812`，`$0` API 费，`WebCatalyst`），配合正反交换顺序一致才计胜与独立会话怀疑论逐修饰词挑刺（使 `27B` 3D 编辑暴涨 `+24.3 pp`，`3DCodeEdit`），即可低成本高信噪比闭环。
3. **验证器物理只读隔离、净室重跑与公开/隐藏双探针**：在线 RL 压力下提示词警告挡不住篡改测试脚本（`Anthropic`），必须只读隔离验证器、拷贝终稿至全新空目录冷启动（`Video-Coder`）、对 `<1%` 关键契约 token（如 `window.renderAt`）在 SFT 阶段赋予 `2×` 权重保护（`InterWebCoder`），并用隐藏随机时间戳与隐藏环绕机位做最终结算。

来源：[LEGO-Anything](research/arxiv-2609.36380/README.md)、[3DCodeEdit](research/arxiv-2610.38231/README.md)、[ManimCode](research/arxiv-2611.08294/README.md)、[AeSlides](research/arxiv-2604.22840/README.md)、[RULER](research/arxiv-2609.25270/README.md)、[InterWebCoder](research/arxiv-2610.28610/README.md)、[Anthropic 生产黑客复盘](research/arxiv-2511.18397/README.md)。
