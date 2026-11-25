# Aodi one-shot 与 Kimi ReAct 对照报告

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

日期：2026-11-22。Aodi 三源 192 case、每题 3 次 ReAct 采样均已结束。本文报告候选与验收证据，不是训练集，也不启动正式 SFT。

## 结论

一万级 one-shot 代码底座应继续保留，负责 Three.js 场景、几何、材质、相机和完整代码先验。ReAct 的主要增量是实际观察、工具操作、定向修改和复验。它适合补足沙盒中的长程工作方式，但不能据此宣称每个最终场景都优于原版。

原版与 ReAct 的浏览器协议不同。原始 one-shot 使用原依赖与静态渲染协议，ReAct 使用离线 HTML、`renderAt` 和状态接口。不同协议的可运行率、画面质量和轨迹长度都不能直接当作教师优劣排名。

## 数据与教师边界

| 项目 | 实测结果 | 解释 |
|---|---:|---|
| 原始三源配对样本 | 192 | Scenes-v1、Scenes-v2、GLB-assets 各 64 |
| Scenes-v1 教师 | MiniMax M3.1 Flash | 仅这 64 个配对样本来源明确 |
| Scenes-v2、GLB 教师 | 未知 | 不猜测为 Kimi 或其他模型 |
| ReAct 计划轨迹 | 576/576 有终态 | 192 case × 3，原始流均保留 |
| ReAct 技术候选 | 88 | 71/192 题在三次预算内有技术候选；pass@3 不是 Accepted@1 |
| ReAct 主候选 | 43 | Scenes-v1 16、Scenes-v2 13、GLB 14 |
| 主候选稳定性证据 | 34 通过、9 警告 | 39 个质量排除，排除回流为 0，无缺证据项 |

“one-shot”指一次用户请求后，可选推理文本和完整代码回答，没有沙盒工具循环。原始 reasoning 不等于 ReAct 中的观察→行动→回顾→修改。Kimi 使用 `kimi-k3`、medium；每次采样保留服务返回的 thinking、工具调用、实际图片和产物，不把服务返回内容称为完整隐藏思维链。

全量 Aodi train 有 10,697 条，answer-only 约 127,463,249 token。原始 reasoning 约 145,518,196 token，不混入 answer-only profile。上述 192 个配对样本不是全量一万条教师的代表证明。

## 原版实际验收

- 192 个原始 HTML 中，189 个在既定静态协议下可运行，3 个采集失败在一次独立复验后停止。
- 原始 GLB 有效导出 62/64，含 5,986 个网格、19 个动画片段；12 个要求动画的 case 均满足数据检查。两个剩余问题是按钮位于视口外和渲染/截图阻塞。
- 原始 GLB 的结构与动画检查不等于 Godot 导入验收，后者未完成。
- 原始 one-shot 的场景质量存在明显优势案例，不能仅以 ReAct 的工具调用多、状态字段丰富或耗时更长判定升级。

证据：`reports/aodi-one-shot-static-browser-summary-20261122.json`、`reports/aodi-glb-one-shot-browser-20261122-001/export-final-review.json`。

## ReAct 实际验收与成本

- 480 条 GLB 原始 `file://` 轨迹因模块/CORS 交付失败单列，不能据此判断模型能力，也不能与原版静态可运行率直接比较。
- 对 192 个 GLB ReAct 试次另行完成本地 HTTP 导出与加载，192/192 导出和场景检查通过，并检查了抽样预览。这个补充协议不替代原始交付分类，也不等于 Godot 或完整语义验收。
- 43 条主候选共有约 2,793,359 个可见 assistant token，其中 thinking 1,575,780、正文 43,365、工具参数 1,174,214；工具结果图片 560 张。
- 这些是原始流中可用文本的估计，不含完整 system、工具 schemas、工具结果、角色模板、EOS 和视觉 token，不是最终训练标签数。
- 工具调用、tool response 和图片保留在真实轮次；服务返回 thinking、最终代码和工具操作分别保存。任何缺失图片的视觉评语仍需另行审查。

证据：`reports/aodi-react-comparison-20261122-001/kimi/supervision-token-estimates.json`、`reports/aodi-react-comparison-20261122-001/aodi-stability-review-20261122-001.json`、`reports/aodi-glb-react-export-20261122-001/watch-status.json`。

## 同题画面与交互对照

现有 26 个唯一 case 具备原版与 ReAct 实际画面对照，其中 Scenes-v1 8 个、Scenes-v2 18 个，GLB 配对画面 0 个。不能把 26 个外推成 192 个的全面质量排名。

- 蚂蚁地下通道 `aodi-scenes-v1-004`：原版地表覆盖地下通道，ReAct 经实际看图和多次编辑改善了入口、连通隧道和腔室可见性，支持 ReAct 改善该题的关键语义。
- 机柜内部 `aodi-scenes-v1-008`：原版整体造型较好，ReAct 的电路板、电源和布线更明确。二者各有优势。
- 浮动起重机 `aodi-scenes-v1-060`：原版船体、驾驶室和吊臂更清晰。ReAct 的升降状态可以复验，但默认取景和造型没有全面升级。
- 冰川 `aodi-scenes-v1-053`、巴松管 `aodi-scenes-v1-064`：原版默认画面更清楚，没有因为重跑就判 ReAct 更好。
- 市政地图 `aodi-scenes-v2-001`：以真实鼠标事件验证同服务符号一致、跨服务冲突和恢复默认，不只是阅读模型自述。
- 滨水 `aodi-scenes-v2-010`：实际点击放置活动区、受限布局、共享空间超限和清除均通过独立严格断言，证明部分交互价值。

这些案例共同说明：技术检查、实际画面、任务交互和训练准入是不同维度。原版呈现更好时保留原版，ReAct 的真实观察和复验更有训练价值时也不应丢弃。

证据索引：`reports/aodi-react-comparison-20261122-001/source-baseline-inventory-20261122-001.json`。详细案例与图片位于 `reports/aodi-one-shot-browser-20261122-001/`。

## 对训练数据的启示

1. 通用 one-shot 代码底座与 ReAct 轨迹分层保留，不用重复轨迹强行凑固定比例。
2. ReAct 主样本仍需完整语义、连续视频、重放和 OpenAI/Swift 标签验收；技术候选和画面初审不是完整训练准入。
3. 原始 reasoning 与服务返回 thinking 分层保存，是否训练 thinking 是实验变量，不能默认越长越好。
4. 未知来源教师不补写模型名；不同教师按实际 ID 分组，不能把全量一万条都归因于 Kimi。
5. 192 个配对 case 都是 train，没有由本对照创建独立 dev/test holdout。未来评估应按源场景、模板和故障谱系隔离，不能只改 case ID。
6. 完整 system 和逐次请求历史未由 Claude `stream-json` 全部捕获，现有 token 估计和导出链路不能声称逐请求完全重放。

本报告未启动正式 SFT。原始成功、失败、图片、GLB、工具流、检查器修正历史和质量排除均保留。
