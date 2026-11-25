# 第三份方案落地：联合缺口结论与执行顺序

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

2026-11-24 · 主 Agent + Opus 5.5。原文、独立核查和 Opus 原文均保留。本页是最终取舍，不启动新实验。

## 最终判断

第三份方案应作为下一轮方向，但**现在最先做的不是正式微调，更不是 RL，而是三项并行准备工作：**

```text
A. 完整请求捕获 + 快照恢复 + 分支/assisted 账本
B. 35B 推理 canary + MoE 全参数 SFT/导出 smoke
C. 新 dev/test + 完整浏览器 mutation suite + 学生失败分类
```

三者通过后，再做小规模学生中心纠偏；纠偏 SFT 在新 dev 上证明 Accepted@1 增量后，才进入 DPO 和完整 episode RL。

## 已具备与仍缺什么

| 领域 | 已有资产 | 关键缺口 |
|---|---|---|
| 首版结果 | 27B 完成 10,946 步，dev 0→2/12、test 1→3/48 | 提升小且区间宽；学生 token 约翻倍；中间 checkpoint 与纯 Aodi 归因未补齐 |
| 数据 | 10,697 Aodi、249 条可训练完整 ReAct | 真实修复为 0；学生状态纠偏为 0；动作标签和语义 mask 未建立 |
| 评测 | 60 题真实配对、数值/冷加载/多帧/盲评、基础反例 | 旧 test 已揭盲；完整浏览器 mutation 和新 dev/test 未建立 |
| 请求与快照 | 独立工作区、离线容器、原始 stream 和图片 | 缺 system/tools/逐次请求/compaction；没有通用逐 turn restore 和 parent/branch |
| 35B 模型 | 本地 Qwen3.6-35B-A3B BF16 完整候选 | 图文工具与长上下文服务未验收；模板没有 high/max 档位 |
| 35B 训练 | Swift 注册 qwen3_5_moe/qwen3_5，Megatron 有 EP/MoE 参数 | 27B Ready/启动命令不能照搬；全参 MoE、aux loss、恢复、导出未 smoke |
| DPO/RL | 框架有 DPO/GRPO 类 | 分支 collator、共享前缀校验、独立 reward、快照 rollout 和 unknown 剔除未实现 |

首版实测入口：`3d-animation-agent/reports/first-sft-eval-20261123-001/REPORT.md`。学生 test 为 3/48，原版为 1/48；生成无净增，修复和编辑各仅 1/12。学生总观察 token 56.8M、原版 27.5M，说明下一轮必须同时看质量与完整 episode 成本。

## P0：必须先交付的工程与协议

### 1. 全量请求和 per-turn manifest

每轮保存真实 system、工具 schemas、messages、图片字节哈希、采样参数、输出、剩余预算和 compaction 后请求。每轮生成内容寻址 manifest：

```text
workspace_tree_hash
message_prefix_hash
replay_log_hash
image/evidence hashes
validator hash
runtime/container/browser/dependency versions
turn_id = hash(manifest)
```

旧 249 条仍可用于冷启动，但缺完整请求的部分只能标 `legacy_approx`，不能用于声称精确恢复的主分支分析。

### 2. 快照恢复不是复制文件

采用“内容寻址工作区 + 新浏览器 + 固定种子/虚拟时钟 + 事件重放”，不依赖直接保存 GPU/WebGL 内存。固定浏览器、渲染后端、视口、DPR、字体和依赖。

Opus 建议的首轮验收起点：

- 至少 20 个前缀，含生成、修复、编辑及拖动中途/server 运行中状态；每个恢复两次。
- 文件、待发请求、预算计数、数值状态和固定渲染条件下的定帧截图一致。
- 不要求模型续写一致；在两次恢复中注入同一条已记录动作，要求工具结果和截图一致。
- 非白名单差异即 `restore_failed`，禁止从该前缀分支；另做重复恢复测漂移。

20 个前缀和像素零差是首轮工程门槛建议，不是已证明普遍足够的常数。非确定性白名单必须在看结果前定义。

### 3. 分支身份与防泄漏

```text
case_id
└─ root independent run（Accepted@1 的唯一主统计对象）
   └─ branch(parent_turn, actor, intervention)
      ├─ original action
      └─ correction action（assisted=true，不可改）
```

- 同一 case/前缀的分支是相关样本，按 case 聚合或聚类 bootstrap，不能冒充独立 case。
- **错误分析员**可以回看后续失败来定位首个关键错误；介入点和理由冻结后，**纠偏执行者**只能读取错误前 manifest，不能读取后续答案、隐藏断言或最终验收。
- assisted success 由 schema 强制排除出 Accepted@1；学生后续独立重跑才计独立能力。
- 结局至少分 pass/fail/infra_unknown/budget_exhausted。unknown 不惩罚学生，超阈值暂停分析；Opus 提议 5% 作为首轮警戒线，需在协议中预注册。

### 4. 完整浏览器验证器

将现有 18 个数值故障扩展到完整链路，至少加入：静止、回拖残影、杆长/机构漂移、错误释放、遮挡、相机错位、外置 JS、未交付、非目标修改和陈旧证据。

- golden 解重复验收，测假阴性和 flaky；mutation 记录杀死率与存活清单。
- 通过预检的硬数值失败直接拒绝；视觉 unknown 单列，不能硬转成功或奖励。
- 数值通过但视觉失败/unknown 时双人盲评仲裁，保留一致率；先排除 fixture/grader 自身冲突。
- 验证器对 Agent 工作区无写权限，公开自检与隐藏验收分开。

### 5. 新评测集与旧集用途

旧 dev/test 可用于历史回归、restore 验收、mutation 和分支工程调试，不能再作为下一版“全新 unseen”终验。新 dev/test 需要新题族和完整场景故障谱系，在运行前冻结，按 parent case/派生分支整体隔离并做文本与参考解近重复检查。

## 模型和训练链路的两个明确修正

### 学生档位不能写成 high/max 已确定

35B 模板只有 `enable_thinking` 和 `preserve_thinking`，没有 27B 的 `xhigh/medium/low`。因此先做真实渲染 prompt、图文工具和长上下文 canary；若服务没有官方档位映射，E1 只能比较实际可实现的思考开关/输出预算，不得伪造 high/max。

教师客户端的 requested high/max 也需单独验证。网关接受无效值，HTTP 200 不代表后端档位生效。

### 35B SFT 必须重新做模板与 MoE 准入

使用 `qwen3_5_moe + qwen3_5 template`，重新生成 Ready，不能复用 27B 的 qwen3_8 编码。全参数 MoE smoke 必须覆盖：

- 文本、工具、多图和最长代表样本；
- TP/PP/EP/DP 与 micro/global batch；
- MoE aux loss、专家负载、梯度与优化器更新；
- checkpoint 恢复、导出和导出后真实图文工具请求。

在这些通过前，不讨论 35B 的正式全参训练。global batch、LR 和 Agent 30%/50% 均保留为后续单变量实验，不设为已确定默认。

## 小规模纠偏试点

P0 通过后，先做少量新诊断 case：

1. K=2 只做工程 canary；稳定后按预定 K=4 做正式失败采集，边界题再考虑 K=8。
2. 第一独立 episode 永远单独保留为 Accepted@1，其余只用于失败挖掘、稳定性和分支研究。
3. 从已验证快照定位首个关键错误，冻结介入理由；纠偏执行者只看前缀并给最小恢复动作。
4. 学生继续，必要时再次介入；最终区分 independent/assisted success，并做后续独立重跑。
5. 给 assistant turn 加 productive/recovery/neutral/invalid/stale/regressive/premature 标签，经过校准后才生成选择性 mask。

试点未证明快照、身份和验收可靠前，不扩大到几百或几千条。

## 后续训练的晋级顺序

```text
35B/27B 基座配对
→ 35B MoE 技术准入
→ 同数据短 SFT 证明质量不降与 episode 吞吐收益
→ 完整教师轨迹冷启动 vs 冷启动+学生纠偏
→ 新 dev 上 correction SFT 证明 Accepted@1 和真实修复增量
→ 同前缀分支 DPO
→ 完整 episode 终局结果 RL
→ 共享前缀短程 RL
→ 独立视觉过程奖励消融
```

如果 correction SFT 不能改善真实修复，或 reward 上升而新 dev Accepted@1 不升，就不进入下一阶段。

## Opus 补充与主 Agent 的取舍

Opus 原文：[基础设施审稿](opus-infrastructure-review.md)。实际 session `c4a9632e-7544-4363-a4e9-296a25488377`，`is_error=false`，`modelUsage=claude-opus-5-5`。

采纳：20 前缀双重恢复、同动作注入、per-turn manifest、assisted schema 拒绝、结局四分、mutation/golden 稳定性、旧 test 降级和分支聚类统计。

修正两点表述：

1. Opus 文中“预算不对等”不准确。首版两臂的**配置预算相同**：3600 秒、单轮 8192、262144 上下文和相同 harness；实际 token 消耗不同是模型行为结果，不是配置不公平。小样本和区间仍意味着不能宣称稳定提升。
2. 硬数值优先仅适用于已通过 fixture/grader 预检的检查；若检查本身与题面冲突，应先修题而不是机械判模型失败。

详细本地证据见[主 Agent 缺口报告](gap-analysis.md)，第三份用户方案原文见[执行方案](executable-four-stage-plan.md)。
