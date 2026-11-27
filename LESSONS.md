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

## 9. SFT 之后的强化学习：严禁多机制叠床架屋，走“单模型三轨等权 Repair-RL（≤64K）→ 全长 384K RFT 回灌”

1. **去杂糅数学红线（同一优势张量只留唯一 `PhyCAD HBA` 骨架）**：将 `GDPO`（多指标白化求和）、`GVPM max(A,0)`（单边截断破坏零均值）、`SRaR`（轮次偏置击穿保序）与 `HBA` 叠加会直接破坏 $\lambda_L > 2\lambda_w$ 严格跨层保序与组内零均值平衡！在线奖励只保留 **确定性四层 $L \in \{0,1,2,3\}$ + $L_3$ 层内居中秩 $\tilde{A}_i \in [-1, 1]$（含相对强参考帧单边退化扣分）**，token 级只做二值 `loss_mask` 绝不乘加篡改优势符号。
2. **`2×8 H800` 物理算力现实：短程 `Repair-RL` 破局，离线 `RFT` 写回 `384K` 长程能力**：在 16 卡集群上直接跑从零 `384K` 多图在线 RL 单步需 ~15 小时（物理不可行）；改为从 SFT 自身 `L1–L3` 中等瑕疵快照起步跑 `≤64K`、`≤12` 轮 `Repair-RL`（单步 `20–30 分钟`，5–6 天跑完 300 步），再用该检查点采全长 `384K` 轨迹经五维门控 + 双序 `Best-of-2` 做 1 epoch `RFT` 回灌，即可在单周周期内兼得精修深度与长程稳定性。
3. **三轨同模按题组归一化 + 轨内 Token 均值 `(1/3, 1/3, 1/3)` 等权合并**：组相对优势本就在同题 $G$ 条候选内部算，三轨绝不跨组混比；只需先在每轨内部按可训输出 token 总数做均值、再按 `(1/3, 1/3, 1/3)` 等权求和（配 `10–15%` 通用 SWE 回放 + `low-var KL` $\beta=0.01$），防止 3D 长轨迹吞没 CAD 短轨迹梯度；仅当某轨连续两次评测倒退 `>2 pp` 时才解锁单轨 LoRA + `OPD` 备选。

来源：[主审 × Claude Opus 5.5 联合去杂糅与终极收敛蓝图](research/3d-agent-rl-opus-review-and-consolidation-20261127/README.md)、[Opus 5.5 独立审查报告](research/3d-agent-rl-opus-review-and-consolidation-20261127/opus-review.md)、[SFT 后强化学习全景调研 v2.0](research/3d-agent-post-sft-rl-survey-20261127/README.md)、[2026 同源 25 大踩坑避坑大全](research/visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)。

## 10. 视觉与几何验证器铁律：先补 4 处脚本硬漏洞，在线异族判秩，本地 27B 仅作影子共谋监控

1. **开 RL 前必须封死现行检查器的 4 处可刷分漏洞**：① `verify_xhs_output.cjs` 须用 `page.clock.install()` 冻结自转时钟并仅截 `<canvas>` 测 `MAD`（防自转或弹 HTML 框骗过交互检查）；② `cad_inspect.py` 中 `BRepAlgoAPI_Common.IsDone()=False` 必须判为干涉失败（防造病态几何绕过零干涉检查），且在线先跑 `--no-render` 秒级短路；③ `check_2d_v2.mjs` 须补普通 HTML 文本重叠与剥离伪装 `overflow: hidden` 检查；④ `threejs_rubric_judge.py` 须对齐 `11-26` 小红书多文件 `http.server` 契约。
2. **防同源自我共谋（Self-Judge Collusion）**：静态相关性高（`r=0.838`）不代表抗得住几百步对抗性 RL，且本地自托管 `27B` 裁判在 `16×H800` 上会占走一半显卡。在线仅对 $L_3$ 幸存样本（约占 30%–50%）调用**异族模型（如 `kimi-k3.1-pro`）**输出带前置 `"reasoning"` 的 Rubric 分并**只取层内秩**；本地 `27B` 仅作离线影子裁判监控 `27B 分 − 异族分` 漂移（`>0.15` 立即熔断回滚），正反双序成对盲评专用于离线 `Best-of-2` 与留出终审。

来源：[LEGO-Anything](research/arxiv-2609.36380/README.md)、[3DCodeEdit](research/arxiv-2610.38231/README.md)、[ManimCode](research/arxiv-2611.08294/README.md)、[AeSlides](research/arxiv-2604.22840/README.md)、[RULER](research/arxiv-2609.25270/README.md)、[InterWebCoder](research/arxiv-2610.28610/README.md)、[Anthropic 生产黑客复盘](research/arxiv-2511.18397/README.md)。
