# Kimi ReAct 首版 SFT 转换报告

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

日期：2026-11-23。项目：`${WORKSPACE}/3d-animation-agent`。

**结论：254 条初审主候选已完成离线批量转换，最终形成 249 条通过真实 Swift loader/template 的 ReAct train 候选，5 条明确排除。Astra 封版结论为 `accepted_for_format_loader_template_candidate`。正式 SFT 尚未启动；本目录仍不是完整语义、独立评估和 Megatron 配置意义上的正式训练准入。**

## 1. 最终交付

训练候选目录：`reports/sft-conversion-20261123-001/training-candidate/`。

| 文件 | 内容 |
|---|---|
| `ready.jsonl` | 249 条多模态、保留 thinking 和工具调用的 Swift Ready |
| `provenance.jsonl` | 每行 UUID、原始身份、base 行号/行哈希、图片数、输入长度与监督 token |
| `excluded.jsonl` | 5 条排除及阶段、原因和证据 |
| `manifest.json` | 输入输出哈希、数量、loss 权重和剩余限制 |
| `final-validation.json` | 对最终 249 条文件本身逐条执行真实 loader/template 的结果 |
| `eos-validation.json` | 最终实际 `<|im_end|>` token 索引的专项监督验收 |
| `delivery-integrity.json` | 接受/排除分区、最终文件和 manifest 哈希完整性 |

最终 `ready.jsonl` SHA-256：`6d7bf9c9359e81a38ff2d479bbbb97c77e3b350fb3651baa8b26e6dcd17e6fb2`。

## 2. 数量与排除

| 阶段 | scale | Aodi | 合计 | 说明 |
|---|---:|---:|---:|---|
| 冻结主候选 | 211 | 43 | 254 | OpenAI-shaped、exchange、native 均 254 行，导出拒绝 0 |
| base Ready | — | — | 251 | 3 条单个非空 thinking 段超过 32,768 token，整条拒绝 |
| 最终 train 候选 | 207 | 42 | 249 | 再排除 2 条续跑上下文不完整记录 |

5 条排除：

- `scale/lab-frustum-coupled/trial-1`：单段 thinking 33,884 token。
- `scale/lab-tape-delay-target/trial-3`：34,666 token。
- `aodi/aodi-scenes-v2-018/trial-1`：33,482 token。
- `scale/lab-float-coupled/trial-3`：最终段引用未捕获的先前 Chromium 历史。
- `scale/lab-layer-stack-target/trial-2`：最终段只有交付确认，0 调用、0 图，引用先前验证。

接受与排除构成 254 个 UUID 的不交并，排除回流为 0。原始流、技术候选和中间转换均保留，没有为质量问题追加采样。

## 3. 保真与工具反馈

- 两条多会话 stream 只使用与 summary 的 `result/num_turns/usage` 完全匹配的最后会话，旧前缀共 34,107 个事件未混入训练。
- 同一 API message ID 的并行工具调用与交错结果按原始消息聚合，保留实际返回顺序；支持 PNG/JPEG。
- native 共 12,662 次工具结果，其中 403 次 `is_error=true`；最终候选为 **12,450 次工具结果、396 次错误反馈**。错误标志、结果顺序、内容和图片哈希保存在 `tool-result-lineage.jsonl`，不把失败反馈冒称成功。
- base Ready 的 251 条、12,503 个 Qwen 工具调用块与 native 逐字按序匹配。Astra 另核对 normalized 与 Ready 的 23,637 个 assistant 段，内容差异为 0。
- 非空 thinking、正文、工具调用的 loss 权重分别为 **0.5 / 1.0 / 2.0**；天然空 thinking 不监督。

## 4. 图片、长度与最终实测

| 指标 | 最终候选 |
|---|---:|
| 真实 loader/template 通过 | 249/249 |
| 工具结果图片 | 2,546 |
| 监督 token | 15,722,203 |
| 完整输入最小 / 中位 / 最大 | 17,164 / 75,319 / 171,524 |
| 超过 65,536 token | 167 |
| 超过 131,072 token | 6 |
| 256K 超限 | 0 |
| 最终逐行哈希或 provenance 错配 | 0 |

使用团队固定 Swift 镜像、`qwen3_8` 模板、`max_length=262144`、`truncation_strategy=raise`。逐条检查 input/label/loss_scale 等长及位置一致、最终 EOS 监督、动态图片数、`<image>` 与 vision-start 数、非空有限 pixel_values 和 image grid。更短训练上限不能直接沿用，必须重新按完整模板整条筛选。

早期保守媒体文本检查有 61 条命中；全量 native 实际为 62 条含普通 `data:image` 或 `base64,` 字样。它们属于正常源码或文本，按“完整 data-image URI 且至少 128 个连续 Base64 字符”检查，254 条中真实图片负载为 **0 条**。证据：`supervised-media-payload-audit.json`。

## 5. Astra 监工

会话：`01a2040c-e692-7772-ad0b-b828ab3b2041`，实际模型 `gpt-6.2-astra`，provider `phanthy_local`，全程只读。

- 转换前报告：`${WORKSPACE}/agent-runs/astra-sft-conversion-monitor-20261123-DMO3cB/final.md`。
- 封版复核：同目录 `final-review.md`；最终补充：`final-acceptance-addendum.md`。
- 独立核对身份、排除、全部最终行哈希、工具结果、图片字节、消息级权重与媒体负载；无需仲裁。
- 封版报告生成时最终复验尚未落盘；此后主 Agent 已完成 `final-validation.json` 的 249/249 实测，并补充实际 EOS token 索引专项检查。
- Astra 最终补充确认两项待查均关闭，无新增仲裁，维持 `accepted_for_format_loader_template_candidate`。

## 6. 可复用实现与回归

新增或更新：

- `scripts/export_claude_streams.py`
- `scripts/convert_claude_primary.py`
- `scripts/audit_claude_tool_results.py`
- `scripts/validate_claude_swift_batch.py`
- `scripts/finalize_claude_ready.py`
- 对应项目测试。

复用流程已写入 `${WORKSPACE}/skills/agent-harness/claude-threejs-cases/SKILL.md`，长期入口已写入 `${WORKSPACE}/ai-employees/dev/MEMORY.md`。

最终项目回归：**123 项 Python 测试通过，4 项 Node 测试通过**。最终 Ready 文件另行完成 249/249 真实 loader/template 复验；实际 `<|im_end|>` 索引专项检查 249/249 通过，EOS 权重均为 1.0，后随 1 个换行 token。

## 7. 尚未完成的训练准入

1. 这批只是 **ReAct 249 条 train 候选**；首版实验仍需按冻结配方与 Aodi answer-only 底座组合，不能误称全部首版混合数据已经封版。
2. 当前 split 为 train 249、validation 0、test 0；独立 dev/test 与学生 baseline 仍需单独设计。
3. 原始 stream 缺完整 system、工具 schemas 和逐次请求；normalize 使用默认 system，不能称为教师原文或精确请求重放。
4. 逐位置 label/loss 一致和消息级权重已验收，但没有独立保存每个角色/内容段到 token 区间的完整映射，不能夸大语义级 mask 证明。
5. 连续视频与完整任务语义、目标 Megatron 全参数配置及真实长度训练 smoke 尚未完成。
6. 本轮没有启动正式 SFT，没有占用训练 GPU。
