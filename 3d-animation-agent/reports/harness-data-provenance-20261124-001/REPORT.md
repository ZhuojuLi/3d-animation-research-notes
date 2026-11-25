# React 采集数据溯源排查：是否存在"缺信息的本地历史"问题

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

2026-11-24 · 起因：领导怀疑 React 轨迹是 agent 直接从 `~/.claude` 本地对话历史提取的（会缺大量请求级信息），建议改用 logging-proxy（harness → proxy:port/v1/messages → phanrouter/v1/messages）从日志恢复完整对话。本报告逐条核查。

## 结论

**没有从 `~/.claude` 拿本地对话历史**——但领导担心的"请求级信息缺失"**确实存在**，形式不同：我们采集的是 Claude Code CLI 的 `stream-json` stdout，它同样缺 system prompt、工具 schemas、逐次完整请求和 compaction 后请求。领导建议的 logging-proxy 与 B 线已实现的 `episode_capture.py` 方案一致，mock 已验证，真实客户端捕获尚未验收。

## 证据

### 1. 采集机制（不是 ~/.claude 历史）

- `scripts/run_claude_cases.py:98,125-127,147`：每个 trial 直接 `Popen` 调 `claude -p <题面> --output-format stream-json --verbose`，**stdout 逐行写入 trial 目录的 `stream.jsonl`**，是采集时的实时流，不是事后翻本地历史。
- 同文件 `:112`：运行使用隔离的 `CLAUDE_CONFIG_DIR=<run_root>/<model>/.claude-config`，连配置都不用 `~/.claude`。
- `scripts/run_claude_collection.py:14`：规模化队列复用同一 `run_one`，机制相同。
- 全项目 grep：没有任何代码读取 `~/.claude/projects`、会话 jsonl 或本地历史文件。

### 2. 但 stream-json 的确缺请求级信息

对真实轨迹（`reports/scale-collection-20261122-001/concurrency-transition-20261122-001/interrupted-runs/lab-needle-meter-memory/trial-2/stream.jsonl`，26716 行）逐类型统计：

| 有 | 缺 |
|---|---|
| init：工具**名**列表、模型 ID、CLI 版本 | **system prompt 全文** |
| 71 条 assistant（含 usage、19 个 thinking 块、42 个 tool_use） | **工具 JSON schemas** |
| 42 条 user（tool_result）、6 个图片块、result 汇总 | **初始 user 题面**（首条 user 已是 tool_result，`-p` 的题面不在流里，需从冻结任务重建） |
| thinking_tokens 流式计数 | **每次 API 调用的完整 messages 载荷**（流里只有增量） |
| | **采样参数实际生效值、compaction 边界与压缩后请求** |

影响面：全部既有 ReAct 轨迹（scale-collection 1008 trial、react-teacher、首版 249 条可训练样本）。`ai-employees/dev/MEMORY.md` 早已记录此约束："初始 user 需从冻结任务重建……不能声称逐请求完全重放，正式批量造数前必须在客户端消息拼装/压缩后补捕获并重跑 canary"；`execution-readiness.md` 列为 P0-1。

### 3. 修复资产已在 B 线，缺真实验收

- `scripts/episode_capture.py`：就是领导建议的 logging-proxy——本地 HTTP relay 监听 `/v1/messages`（含 count_tokens），转发上游（phanrouter/vLLM），**逐 turn 落盘原始请求/响应全文、图片字节哈希、usage/finish**，配 per-turn CAS manifest（`episode_snapshot.py`）。
- 已验证：mock-http fixture 2 条完整请求（`reports/snapshot-restore-20261124-001/mock-http-final/result.json`）。
- 未验证（Astra 审查 `agent-runs/astra-ab-review-20261124-001/ab-review.md`）：**真实客户端 loopback 捕获与实际 compaction**；Chromium 恢复 0/20（沙箱 loopback EPERM 环境原因）；B 线会话被截断，缺 REPORT.md/STATUS.json。

## 建议（按优先级）

1. **续跑 B 线真实捕获验收**（thread `01a209e6-3250-7883-bee6-474df76f0c80`，不需要训练机）：在非沙箱环境完成 loopback proxy + 真实 claude 客户端的逐请求捕获，补 REPORT.md/STATUS.json。
2. 验收通过后，用 devtest-v2 的 1 题 canary 走 proxy 重采，与 stream-json 证据对比完整性，再决定是否重采受影响的正式数据。
3. 旧 249 条维持 `legacy_approx` 标记，不用于声称精确恢复的主分支分析；正式批量造数切换到 proxy 捕获后另行登记新批次。

## 2026-11-24 后续：建议 1-2 已完成

- 真实 canary（kimi-k3，`reports/proxy-capture-20261124-001/run1`）：relay 捕获 11/11 请求响应，system prompt 全文、工具 input_schema、初始 user 题面、图片字节哈希全部落盘，`scripts/verify_episode_capture.py` 通过。
- 领导的 logging_proxy 已加图像日志与 Anthropic 解析并上传 `${INTERNAL_REPOSITORY}`，经 phanrouter 真实链路验证。
- 剩余：B 线浏览器侧 20×2 恢复验收（沙箱 EPERM 问题）、正式批量采集切换到 `--episode-capture` 并在 Skill 中预登记。
