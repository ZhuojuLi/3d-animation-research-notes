# 下一轮 27B 训练的数据补充建议

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

2026-11-24。依据：C1 失败分类（`reports/line-c-devtest-mutation-20261124-001/c1-failure-clusters/`）、首版数据复盘、devtest-v2 题集与中转截取验收。学生方向已固定 dense 27B（项目 decisions.md）。

## 首版数据的实测缺口

| 缺口 | 证据 |
|---|---|
| 真实修复轨迹为 0（249 条中 221 生成、23 健康检查、5 局部编辑） | 联合复盘 + C1 |
| 交付契约失败 90/120（55 引用缺失 workspace 文件 + 35 未交付 HTML） | C1 failure-clusters.json |
| 盲评失败集中：freeze_hold 12、control_scrub 8、drag_ghosting 7、mechanism_drift 3 | C1 主题聚类（启发式） |
| 既有轨迹缺完整请求（system/tools/初始 user/compaction） | harness-data-provenance-20261124-001 |

## 下一轮要补的数据（按优先级）

1. **交付契约强化轨迹**（对应最大失败源）：题面已含离线自包含契约（devtest-v2）。采集"交付前自查外部引用并修正"的教师轨迹；把 broken delivery 失败做成纠偏样本（从引用缺失文件的状态恢复到自包含交付）。
2. **真实修复轨迹**：devtest-v2 的 18 个 repair 题（注入数值缺陷的 fixture）+ visual-agent-v2 的 11 类浏览器故障派生修复任务。教师 Kimi 采样，同题 3 次选 1，沿用独立 trial 隔离。
3. **局部编辑与非目标保持**：devtest-v2 的 12 个 edit 题（参数扩展类），配健康近邻测误改。
4. **时间/交互一致性**：freeze/hold、scrub、循环接缝、重绘无残影主题的生成与修复轨迹，验收直接接 check_browser.mjs 的对应检查。
5. **学生中心纠偏（B 线验收完成后启动）**：从学生失败 episode 的首个关键错误同前缀纠偏；assisted 标记不可混入 Accepted@1，也不作独立正样本。

## 采集协议（硬性）

- 全部新轨迹走 `--episode-capture` 中转截取；只用 stream-json 的批次标 `legacy_approx`，不进主分支恢复分析。
- devtest-v2（48 test + 12 dev）冻结为评测集，**不进训练**；训练题另行派生并做谱系隔离与近重复检查。
- 配比按有效监督 token 计算，不按条数；难点/中等/简单/健康沿用 40/30/15/15 起点。
- 每批保留原始流、episode manifest、图片哈希与验收证据；教师模型 ID 按当日 `/models` 实际值登记。
