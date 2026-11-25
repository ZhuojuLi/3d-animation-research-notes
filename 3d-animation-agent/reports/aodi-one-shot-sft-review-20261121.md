# Aodi 万级 one-shot 27B SFT 效果复核

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

2026-11-21

## 先分清训练版本

用户提到“用一万条数据做过 one-shot”是成立的，但完成训练并导出模型的是 **64K thinking one-shot 全参数 SFT**，不是 32K answer-only 全参版。

| 训练 | 数据与状态 |
|---|---|
| `full-sft-32k-answer-only-001` | 10,697 条 answer-only；运行日志仅记录到 iteration 10/2675，随后中断，不能作为已完成模型评价 |
| `full-sft-64k-thinking-3node-001` | 10,364 条 thinking Ready train / 787 validation；完成 2,591 steps、1 epoch，三机 24 卡；step-900 与 step-2591 均有 HF 导出 |

one-shot 指任务形式为单轮“需求 → 完整代码”，其中可以包含 thinking；它不是多轮 Agent 轨迹。

完成版配置与证据：

- 训练目录：`${REFERENCE_DATA}/code2video/training/runs/full-sft-64k-thinking-3node-001/`
- step-900：`${REFERENCE_DATA}/code2video/models/full-sft-thinking-step900-hf`
- step-2591：`${REFERENCE_DATA}/code2video/models/full-sft-thinking-step2591-hf`
- 两个导出均有 1,184 个 tensor、约 54.7GB，并验证视觉冻结样本与基座一致。
- `eval_loss`：step-900 为 0.42320，step-2591 为 0.41584；loss 小幅下降，但任务通过率不是单调上升。

## 30 道单轮 Three.js 任务结果

评测为相同提示词、采样与浏览器检查，覆盖 basic_geometry、complex_multipart、spatial_scene 各 10 题。最大输出 24,576 tokens，测试为一次性 HTML 生成，不是 Claude Code 多轮工具环境。

| 模型 | 完整 HTML | 技术通过 | 总输出 tokens | 空最终正文 |
|---|---:|---:|---:|---:|
| 原生 BF16 27B | 2/30 | **2/30** | 728,322 | 22 |
| step-900 | 24/30 | **21/30** | 410,774 | 6 |
| step-2591 | 22/30 | **20/30** | 461,037 | 8 |

分类技术通过：

| 类型 | 原生 | step-900 | step-2591 |
|---|---:|---:|---:|
| basic_geometry | 2/10 | 7/10 | 5/10 |
| complex_multipart | 0/10 | 5/10 | 8/10 |
| spatial_scene | 0/10 | 9/10 | 7/10 |

step-2591 相比 step-900：新增通过 4 题，失去原有通过 5 题。复杂多部件题改善，基础几何与空间场景回落。不能因为训练步数更多就默认最终 checkpoint 更好。

证据：

- `${REFERENCE_DATA}/code2video/results/full-sft-2591-eval/eval-20261119-001/comparison.json`
- `${REFERENCE_DATA}/code2video/results/full-sft-900-vs-base/eval-20261119-001/comparison.json`
- `${REFERENCE_DATA}/code2video/results/full-sft-2591-eval/eval-20261119-001/report.html`

## 实际画面复核

本次直接打开 step-2591 的预览图，结论与 Aodi 的人工观察一致：

- `complex_09` 台灯：底座、双连杆、弹簧、灯罩及灯光结构完整，视觉质量较好。
- `spatial_03` 太阳系：主要天体与轨道清楚，外圈主体未被裁切。
- `complex_06` 钢琴：琴键、踏板、琴弦与谱架可辨，但缺少三条琴腿，还有细杆穿过键盘区域。
- `basic_06` 齿轮：主体和中心孔完整，但齿形扭曲并出现自相交片面。

因此万级 one-shot 已证明能显著提高完整可运行 HTML 的产出，并缩短生成；但没有解决全部几何正确性、机械语义或复杂动画问题。

## 通用能力保持检查

Step-2591 的 20 题小检查中，non-thinking 客观通过 11/12，thinking 为 12/12；两种模式各有 8 题仍待人工复核，且没有额外 HTML 输出或 length stop。这个检查规模小，不能据此证明通用能力完全保持。

## 对当前工作的直接意义

1. **不要从零重复训练同一万级 one-shot。** 先把 step-900 和 step-2591 当作已有领域 SFT 参照，评估它们在当前 Agent 沙盒里的表现。
2. **候选起点不只最终 checkpoint。** step-900 总体技术通过更高，step-2591 在复杂多部件题上更强；应让 dev 决定，而不是只选最后一步。
3. **当前 Agent 缺的不是单纯代码先验。** 它还需要工具调用、真实反馈、局部修复、非目标保持和正式交付，所以仍需新 Agent 轨迹。
4. **评测必须分环境。** 上述 2/30、21/30、20/30 是单轮、允许 CDN 依赖映射、24K 输出的诊断，不能与当前 medium/256K/Claude Code 的 9/12 直接比较。
5. **checkpoint 选择要看任务指标。** 后续训练不应只保留最终步或最低 loss，至少同时比较中点与终点。

下一步最有信息量的是：用现有原生、step-900、step-2591 三个模型，在同一批新 Agent dev 题、同一 256K Claude Code 沙盒与 medium 设置下做配对 baseline，再决定 Agent SFT 从哪个 checkpoint 开始。
