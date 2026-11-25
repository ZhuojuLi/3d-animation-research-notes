# C3：新 dev/test 题集规格（v1 已落地为 evals/devtest-v2）

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

> 2026-11-24 更新：本草案已实施为 `evals/devtest-v2/`（60 题冻结输入、构建/校验/隔离工具与测试）。下文"未决"中题量与族清单已按本稿候选起点落地；盲评阈值仍未冻结。实施说明见该目录 README。

2026-11-24 · C 线（`reports/line-c-devtest-mutation-20261124-001/`）。依据：`research/3d-agent-student-centered-react-and-35b-20261124/execution-readiness.md` P0-4/5 与本线 C1 失败分类实测。

## 定位

- 旧 dev/test（first-sft-holdout-v1，60 题）已揭盲，降级为历史回归、restore 验收、mutation 调试用途，不再作为"全新 unseen"终验。
- 新集是下一版学生 Accepted@1 的主统计对象：运行前冻结，按 parent case/派生分支整体隔离，做文本与参考解近重复检查。
- 本草案的题量与阈值是候选起点，正式运行前按轨预注册，不从本稿直接引用为已确定值。

## C1 实测失败结构（设计依据）

首版 120 trial 行的级联感知根因（`c1-failure-clusters/failure-clusters.json`）：

| 根因 | 行数 | 含义 |
|---|---:|---|
| broken_delivery_missing_workspace_file | 55 | 交付引用 `file:///workspace/...` 缺失文件，页面无法初始化（原 offline_or_page_error 级联的真实主因） |
| no_delivery_html | 35 | 未交付 HTML |
| visual_review_fail | 12 | 技术检查通过后盲评失败 |
| other_timeout | 9 | 预算耗尽 |
| numeric_failure / 其他 | 3 | 数值校验失败等 |

盲评自由文本的启发式主题：freeze_hold 12、control_scrub 8、drag_ghosting 7、mechanism_drift 3、occlusion 1、loop_seam 1。结论是：**交付契约（离线自包含单文件）是最大失败源**，其次是时间/交互一致性类视觉缺陷。新集必须两者都覆盖，且前者应有公开自检让模型在交付前自查。

## 题族与覆盖要求（3D 动画轨）

新题族 12+6 个（test 12 族 × 生成/修复/对照/编辑 4 题 = 48；dev 6 族 × 生成/修复 2 题 = 12，沿用首版结构便于对比），全部为新场景，不与旧集共享 parent。每族必须带：

1. **离线自包含交付**：所有题统一要求单文件离线冷加载；公开预检拒绝任何外部引用（script/img/fetch），隐藏验收独立复核。
2. **修复题从 mutation 谱系取真实缺陷**：从 visual-agent-v2 已验证的故障类型（static、stale_state、visual_state_mismatch、loop_discontinuity、non_target_changed、repeat_mismatch、redraw_ghosting、pause_failed、target_not_visible、offline_or_page_error）注入起点场景，配健康近邻测误改率。
3. **时间/交互一致性**：冻结-保持-重复定位、拖动 scrub、循环接缝，按 C1 高频簇加权。
4. **机构守恒**：杆长/销距/刚体约束的数值 function_checks 与画面一致性对照。
5. **可读性**：关键事件在交付分辨率下可见；遮挡与取景缺陷作为修复题素材。

每题必要验收引用 `evals/visual-agent-v2/check_browser.mjs` 能力清单 + `check_module.mjs` 数值检查；`assertions` 不再为空，逐题预注册。

## 2D 与打印轨种子

- 2D：以 `fixtures/2d-bounce.html` 为种子范式（确定性时钟、__v2 接缝、播放/暂停/拖动），先建 4–6 题种子集，标 seed_only，不报 Accepted@1 而报 N/A 至题集冻结。
- 打印：CadQuery 参数化题 2 族起步，验收沿用 GLB/3MF 回读 + 尺寸/水密/边界；OpenSCAD 记 N/A。

## 冻结与隔离流程

1. `freeze.json` 记录题面、夹具、检查器、参考解的 sha256 与版本；冻结后任何修改升版本号并保留历史。
2. parent case 与派生分支（修复/编辑/对照）整体划入同一 split；跨 split 泄漏检查：题面文本相似度 + 参考解 diff + fixture 哈希比对。
3. 验证器对 Agent 工作区无写权限；公开自检与隐藏验收分开存放。
4. golden 正例每批运行前重复验收（当前基线：3 次运行确定性帧逐字节一致，`c2-golden-stability/stability.json`），假阴性/flaky 超阈值即暂停并先修 fixture/grader。

## 未决（需用户或下一轮确认）

- test/dev 题量（48/12 起点）与族清单最终选定。
- 盲评一致率、尺寸/像素容差等阈值按题面与视口预注册。
- 2D 轨是否沿用 canvas 契约或引入新 runner 形态。
