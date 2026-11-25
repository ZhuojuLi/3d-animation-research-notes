# Claude Code 轨迹到 Swift 的双样本烟测

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

2026-11-21

## 结论

状态：**pipeline_smoke_passed_with_capture_limits**。

选取 `edit-conveyor-arm` 纯文本轨迹和 `edit-rocket-ignition` 双图轨迹，完成原始 Claude stream 导出、工具链审计、隔离工作区重建、浏览器重放、OpenAI/Swift 转换、真实 loader 回读、loss mask/loss_scale 检查，以及原版 BF16 27B 的短序列前向和反向。

这证明两条数据计算链路可以工作，**不等于现有 12 条候选已经成为正式训练集**。原始 stream 缺少 Claude Code system prompt、工具 schemas 和逐次 HTTP 请求，当前导出不能称为逐请求完全重放。

## 样本与全序列模板验证

| 项 | 文本 | 多模态 |
|---|---:|---:|
| Case | `edit-conveyor-arm` | `edit-rocket-ignition` |
| OpenAI messages | 57 | 58 |
| 合并后的 API assistant messages | 27 | 28 |
| 原始工具调用 | 29 | 29 |
| 图片 | 0 | 2 |
| 实际非空 thinking 回合 | 15 | 18 |
| 天然空 thinking 回合 | 12 | 10 |
| 最长非空 thinking tokens | 2029 | 2694 |
| Swift loader 回读 | 通过 | 通过 |
| 模板输入 tokens | 27625 | 22168 |
| 监督 tokens | 19289 | 16156 |
| loss_scale | 0 / 0.5 / 1 / 2 | 0 / 0.5 / 1 / 2 |
| 合法 `` / EOS 结尾 | 通过 | 通过 |

文本的 29 个工具调用在 Ready 中仍为 29 个，函数名和顺序完全一致，见 `final/text/tool-call-audit.json`。

多模态 Ready 保留两个 `<image>` 占位和顶层两张图片。真实 processor 输出 `pixel_values.shape=[1760,1536]`、`image_grid_thw.shape=[2,3]`，序列中恰有两个 vision-start token。图片没有退化成 base64 文本，见 `final/multimodal/ready-loader-validation.json`。

## 工作区重放

两条轨迹均复制到隔离目录后从可编辑源码重建，并重跑 `check_claude_case.mjs`：

- 两条均通过浏览器检查与题目断言，全部采样帧哈希与原验收一致。
- 多模态 HTML 重建 SHA256 与原交付完全一致。
- 文本 HTML 的原始 SHA256 不同，仅因为 esbuild 注释里的 `node_modules` 相对路径随副本目录深度变化；规范化这些注释后 HTML 完全一致，且所有浏览器帧哈希一致。
- 多模态第一次重建失败是烟测驱动的 shell 引号错误，日志保留；修正后使用 README 等价包装完成，没有修改教师原工作区。

证据：`text/replay/replay.json`、`multimodal/replay/replay.json`。

## 真实 27B 前向与反向

环境为团队固定 Swift 镜像 digest `sha256:f3f59f1164541256b3296b6768992dedb2511658da963d227db2e8ca581d2b5a`，gpu34 GPU0（H800），原版 `${MODEL_ROOT}/Qwen3.8-27B` BF16 权重。

只使用从真实轨迹截出的短序列；冻结模型，仅让 `model.language_model.norm` 的 5120 个参数接收梯度。手工按 Swift `loss_scale` 对 shifted token cross entropy 加权后反向。不运行 optimizer，不保存 checkpoint。

| Profile | 输入 tokens | 监督 tokens | Loss | 梯度范数 | 图片 |
|---|---:|---:|---:|---:|---:|
| 文本 | 742 | 242 | 0.7655266 | 0.0289511 | 0 |
| 多模态 | 1622 | 882 | 1.2648993 | 0.0231128 | 2 |

两次 loss 和梯度均有限，梯度非零；多模态确实传入 `pixel_values`。完成后容器退出，GPU0 约 81080 MiB 空闲，无遗留计算进程或后台任务。

原始报告：`${SHARED_DATA}/3d-agent-smoke/claude-pipeline-20261121/forward-backward-report.json`。本地副本：`final/forward-backward-report.json`。

这只是 Transformers 真实权重计算烟测，**不是 Megatron 全参数/LoRA 训练步，也不证明完整 27B 全量训练显存配置**。

## 导出文件

最终有效文件只使用 `final/`：

- 文本严格 answer-only：`final/text/openai.jsonl`、`validation.json`。
- 文本 thinking exchange：`final/text/exchange.jsonl`。
- 文本 Ready：`final/text/ready-with-empty.jsonl`。
- 多模态 OpenAI-shaped answer-only：`final/multimodal/openai.jsonl`。
- 多模态 thinking exchange：`final/multimodal/exchange.jsonl`。
- Swift 原生图片表示：`final/multimodal/native-swift.json`。
- 多模态 Ready：`final/multimodal/ready.jsonl`。
- 图片及哈希：`final/multimodal/images/`、`provenance.json`。

早期 `text/`、`multimodal/` 中的失败驱动输出保留用于排查，不作为最终数据。

## 本次确认并处理的兼容问题

1. 同一 API message ID 的 thinking 与 tool_use 必须合并为一个 assistant 回合。
2. 原始 stream 不含初始 user 事件；任务 prompt 从冻结 task 和输出契约重建，并用 `summary.prompt_sha256` 验证。
3. Qwen3.8 chat template 不允许 assistant-only tool-call 渲染；`qwen38_swift_normalize.py` 使用临时 user 探针，只提取工具调用文本并去掉探针产生的空 thinking。
4. 旧 Ready 包装器把天然空 thinking 当成超长而整条丢弃；本次只允许真实非空超长触发拒绝，空 thinking 保留并 mask。
5. Swift OpenAI 适配器会先把非字符串 tool content 序列化，可能把图片变成 JSON/base64 文本；多模态先转原生 `<image>` + `images`。
6. 任意工具参数直接经过 Arrow loader 可能出现 struct 类型冲突；先渲染工具调用，再由真实 loader 回读 Ready。
7. `mm_token_type_ids` 从 Swift 输出进入 HF 模型时需增加 batch 维。

## 仍须在批量造数前补齐

- 在 Claude Code 完成 system、工具 schema、消息拼装和压缩后的实际请求捕获；保存请求 ID、图片字节哈希和丢弃原因。
- 当前 `exchange.tools=[]`，normalize 使用默认 system，因此这批 smoke 数据只验证计算链路，不满足正式沙盒同轨训练的数据契约。
- 用新增请求捕获重新跑至少一条文本和一条双图 canary，再决定是否批量转换及扩展 cases。
- 正式训练前仍需连续视频人工复核、任务族隔离，以及目标 Megatron 训练配置的独立 smoke。

## 验证

- `python3 -m pytest -q`：**65 passed**。
- 文本严格 OpenAI 校验：1 accepted、0 rejected。
- 原始 stream 独立逐项对照：两条各 29 个工具输入对象、29 个工具结果文本完全匹配；27/28 个 assistant 的 thinking 与正文完全匹配；双图哈希匹配。见 `independent-consistency-audit.json`。
- 两条浏览器重放通过。
- 两条完整 Ready loader/template 验证通过。
- 两条真实权重前向/反向通过。

## 外部复核状态

用户要求同步调用独立 Opus 审查。三次均通过完整专用 `claude-phanthy.sh` 路由且 `modelUsage` 确认 `claude-opus-5-5`，但分别在初始任务、沿用会话的缩小任务和全新 CLI 日志审查会话中被自动规则拦截，`is_error=true`、`stop_reason=refusal`，没有生成 `report.md` 或 `verdict.json`。因此本报告不宣称获得 Opus 审查通过。

调用现场保留在：

- `${WORKSPACE}/agent-runs/opus-training-pipeline-audit-20261121-NwNXKV/`
- `${WORKSPACE}/agent-runs/opus-cli-log-audit-20261121-MjyjV1/`

可用的补充独立证据是本地 `independent-consistency-audit.json`，它直接对照原始 stream 与最终导出，而不是外部模型意见。
