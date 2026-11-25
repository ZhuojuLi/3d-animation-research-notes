# 3D Agent 首轮双模型种子采集最终报告

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

## 结论

- 两个模型均覆盖 **12 个唯一 case**，原始轨迹、交付产物和独立浏览器证据均保留。
- Kimi：12 条技术候选，流结构审计 12/12 通过。
- Qwen：9 条技术候选，流结构审计 9/9 通过；其余 3 条保留为失败记录，不进入训练候选。
- 已分别查看 Kimi/Qwen 实际关键帧总览；连续视频、工作区重放和 OpenAI/Swift 数据验证仍是训练前的必要门槛。

汇总数据：`seed-collection-final-summary.json`。Kimi 明细位于 `case-collection-20261121-001/kimi/`，Qwen 明细位于 `case-collection-20261121-002/qwen/`。

## 逐 case 最终选择

| Case | 类型 | Kimi 选用 trial | Qwen 选用 trial | Qwen 最终结果 |
|---|---|---|---|---|
| gen-watermill-loop | generation | 1 | 1 | 正常结束、交付、检查通过；技术候选 |
| gen-rocket-sequence | generation | 1 | 2 | 未入选：timeout_3600s；有交付，但不满足候选门槛 |
| gen-solar-trackers | generation | 2 | 2 | 未入选：timeout_3600s；有交付，但不满足候选门槛 |
| gen-conveyor-sorter | generation | 1 | 1 | 未入选：timeout_3600s |
| repair-ferris-seam | repair | 1 | 1 | 正常结束、交付、检查通过；技术候选 |
| repair-arm-contact | repair | 1 | 1 | 正常结束、交付、检查通过；技术候选 |
| repair-rocket-framing | repair | 1 | 2 | 正常结束、交付、检查通过；技术候选 |
| repair-solar-pause | repair | 1 | 1 | 正常结束、交付、检查通过；技术候选 |
| edit-watermill-camera | local_edit | 2 | 1 | 正常结束、交付、检查通过；技术候选 |
| edit-rocket-ignition | local_edit | 1 | 1 | 正常结束、交付、检查通过；技术候选 |
| edit-solar-material | local_edit | 1 | 1 | 正常结束、交付、检查通过；技术候选 |
| edit-conveyor-arm | local_edit | 1 | 1 | 正常结束、交付、检查通过；技术候选 |

## 配置失败与有界补跑

- Qwen 64K 的 2 条 canary 因上下文限制失败后，改用 256K 服务完成。
- Qwen 的 `gen-rocket-sequence`、`gen-solar-trackers`、`repair-rocket-framing` 遇到 4 图限制后，各在 256K/16 图服务上补跑 1 次；只有火箭构图修复题进入最终候选。
- Kimi 的 `gen-solar-trackers`、`edit-watermill-camera` 保留原始失败，并各有 1 次成功补跑。
- 超时、模型质量和契约失败不做无界重试。

## 训练候选边界

- Kimi 候选清单：`case-collection-20261121-001/kimi/training-candidates.json`；报告：`kimi-candidate-report.md`。
- Qwen 候选清单：`case-collection-20261121-002/qwen/training-candidates.json`；报告：`qwen-candidate-report.md`。
- 这些清单只代表运行、交付、浏览器检查和流结构的初筛通过，不应直接用于 SFT。
- 后续必须保留实际可见轮次的图片与 thinking，按 API message ID 合并响应，并完成 OpenAI/Swift 校验与任务族隔离。
