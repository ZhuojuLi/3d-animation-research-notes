# 第三份执行方案落地缺口｜主 Agent 独立核对

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

2026-11-24。依据当前训练、正式配对评测、原始转换、模型文件和固定镜像源码。未启动新训练、采集、模型服务或 RL。

## 一、结论：方向对，但现在不能按 E0–E7 直接顺序扩量

第三份方案的核心方向与首版实测失败一致：应保留完整 episode，主攻学生真实状态上的纠偏，先补快照与独立验收，再谈偏好和 RL。

当前并不是从零开始：已有首版学生、60 题端到端配对评测、249 条可训练 ReAct、基础数值/视觉评分器、完整 35B-A3B BF16 权重，以及注册该模型的 Swift/Megatron 源码。

但**现在直接扩大 correction 采集或上 RL，会再次把协议缺陷和验证缺陷放大。** P0 阻塞是：

1. 缺完整逐次请求与可重建上下文；
2. 缺逐 turn 可恢复快照和共享前缀分支；
3. 真实学生纠偏数据仍为 0，动作级标签和掩码未建立；
4. 新架构的推理档位、SFT 模板、MoE 全参训练与导出未验收；
5. 旧 test 已经使用过，需要新的独立 dev/test；
6. 通用 DPO/GRPO 类存在不等于本项目多轮、多图、分支 episode 管线已实现。

## 二、首版实测说明了什么

正式报告：`3d-animation-agent/reports/first-sft-eval-20261123-001/REPORT.md`。

| 集合 | 原版 Accepted@1 | checkpoint-10946 学生 | 配对区间与解释 |
|---|---:|---:|---|
| dev | 0/12 | 2/12 | +16.7pp，题族 bootstrap 95% [0, +33.3] |
| test | 1/48 | 3/48 | +4.2pp，题族 bootstrap 95% [0, +10.4] |

test 分项：

| 类型 | 原版 | 学生 |
|---|---:|---:|
| generation | 1/24 | 1/24 |
| repair | 0/12 | 1/12 |
| local_edit | 0/12 | 1/12 |

- test 原版总观察 27,466,997 tokens，学生 56,801,489 tokens；部分轨迹用量不完整。学生总 trial 时间略低，但 token 约翻倍，不能把“训练完成”当成效率提升。
- 学生 test 有 24 次 timeout、17 次 missing_html、17 次离线/冷加载相关失败、6 次数值失败。原版有 29 次 timeout、31 次离线相关失败、11 次 missing_html。
- dev 已有 Opus 复盘发现：学生正常结束但未交付、回拖残影、杆长不固定、数值正确但视觉错误；双方都有外置 JS 破坏单文件交付的问题。
- 最终代码验证 loss 为 0.22054657，但 Accepted@1 仍只有 3/48。再次证明 loss 不能替代行为验收。
- 当前只正式评了最终 checkpoint。中后段 checkpoint 的行为选择、同超参纯 Aodi 对照仍未完成，不能把全部变化归因于 ReAct。

这些结果支持“学生中心纠偏”，也提示必须同时补**交付闭环、数值/视觉语义和上下文效率**，不能只增加更多教师成功生成轨迹。

## 三、逐项缺口与验收条件

### P0-1：完整请求和压缩后上下文仍未捕获

**已有。** Claude stream 导出了 assistant thinking、工具结果和真实图片；249 条通过 Swift loader/template/EOS。

**缺口。** 原始 stream 缺完整 system、工具 schemas 和逐次请求；normalize 使用默认 system。无法精确恢复学生在第 t 步实际看到的消息，也无法证明 compaction 后训练/在线一致。

**验收。** 至少一条文本长轨迹和一条多图轨迹保存每次真实请求的 system、tools、messages、图片哈希、输出、finish/usage；覆盖一次真实 compaction。恢复前缀时逐字段对照客户端实际请求，不只对照最终 session。

### P0-2：通用逐 turn 快照与分支不存在

**已有。** 独立工作区、独立离线容器、队列 resume、文件/图片/结果归档。

**缺口。** 现有 resume 是采集队列恢复，不是从任意 assistant turn 恢复完整 episode。没有统一的 parent_snapshot_id、branch_id、介入点、分支请求和代码/证据血缘。

**验收。** 同一 snapshot 在两个全新工作区和全新浏览器中恢复，得到相同文件哈希、依赖/工具版本、初始消息与图片引用、相机/时间轴/场景状态。随后分别执行原动作和纠偏动作，所有请求、版本与结果可关联到同一 parent；assisted 与独立运行从身份上隔离。

文件复制本身不够。优先采用“内容寻址工作区 + 新浏览器 + 确定性初始状态/动作重放”，不要假设可直接序列化 GPU/WebGL 上下文。种子、时钟、依赖、视口、devicePixelRatio、字体和浏览器版本必须固定；像素允许何种非确定性要预先定义。

### P0-3：真实 correction 数据与动作标签为零

**已有。** 249 条教师 ReAct，221 生成、23 健康检查、5 局部编辑，真实 fix 为 0。当前学生已有 120 个 dev/test 运行及失败证据。

**缺口。** 没有“学生错误前快照→教师局部纠偏→学生继续→独立验收”的成品，没有 productive/recovery/stale/regressive/premature 等逐 turn 标签，也没有相应 token 区间掩码。旧 test 已用于首版评测，不能同时充当新实验隐藏测试。

**验收。** 先在新诊断池做小规模端到端试点，产出明确 parent/branch、首个关键错误依据、教师介入范围、assisted success、后续独立复验和独立 case 划分。标签指南需有双人或双 AI 校准及争议仲裁，不能由教师自己标自己为正确。

### P0-4：验证器有基础，但独立覆盖还不够

**已有。** 数值机制检查、离线冷加载、多帧、定帧、非目标保持、盲评；正确/静止/错误模块控制；18 个植入故障数值预检；视觉无法查证可单列。

**缺口。** 还没有覆盖回拖残影、杆长变化、错误释放、遮挡、非目标修改、陈旧截图和提前交付的系统 mutation suite。视觉裁判与人工的一致率、unknown 规则和硬/软信号冲突裁决未完整建立。部分冻结题已发现题面与数学契约冲突。

**验收。** 每类计划采集的失败至少有正例、反例、近邻健康和合理替代；验证器先能拒绝注入缺陷，再用于教师纠偏和奖励。盲评不知道模型/分支身份；无法判断为 unknown，不计成功也不伪造负奖励。题面、fixture 和 grader 三者先通过一致性预检。

### P0-5：新旧评测集用途必须重划

**已有。** dev 12、test 48 已完成首版配对，协议冻结并有逐题证据。

**缺口。** 旧 test 已揭盲并已有 Opus 详细复盘，不再是下一版的隐藏终验；在其中反复选题、调参会过拟合。当前 dev/test 主要始于数值机制模块，不能覆盖完整已有场景的故障定位。

**验收。** 冻结新的 dev/test 题族和完整场景故障谱系后再跑 35B 与 correction 实验。旧 dev/test 可用于历史回归和失败诊断，不能作为“全新 unseen”结果。教师纠偏的 parent case、同源 fixture 和派生分支按题族整体隔离。

### P0-6：35B 学生推理协议尚未建立

**已有。** 本地 Qwen3.6-35B-A3B BF16 的 26 个分片名称和大小与官方一致，配置和组件齐全；27B 服务有 256K、图片、工具与 medium 实证。

**缺口。** 35B 的 `chat_template.jinja` 只出现 `enable_thinking` 和 `preserve_thinking`，没有 `reasoning_effort`。27B 模板明确支持 `xhigh/medium/low`，不能把 35B 也写成 `high/max` 并假设生效。当前 vLLM 镜像对 35B MoE 的图文、工具、256K 和并发也未实测。

**验收。** 用本地 35B 原版完成真实文本、图片、工具和长上下文请求；保存实际渲染 prompt，证明历史 thinking 保留。若模板没有档位，E1 改为实际可实现的思考开关/输出预算对照，或先验证官方支持的档位映射；不得伪造 `high/max` 参数。

### P0-7：教师 `high/max` 的实际后端语义仍未知

**已有。** 客户端确实会把 medium/max/xhigh 写入 output_config；网关返回 200。

**缺口。** 网关也接受无效档位，因此 HTTP 200 不能证明后端使用指定预算。此前鸡蛋案例只有单题盲评，不能据此确定常规 high/max 配方。

**验收。** 查当前专用网关的一手接口说明或可用元数据，并以同题多档配对记录实际 usage、轨迹长度、思考行为和验收。客户端请求字段只记为 `requested_effort`，没有服务端证据时不写成实际预算。

### P0-8：35B SFT 不是更换模型路径即可

**已有。** 固定 Swift 4.5.2 源码注册 `Qwen/Qwen3.6-35B-A3B`，使用 `MLLMModelType.qwen3_5_moe` 和 `TemplateType.qwen3_5`；Megatron 参数包含 EP、MoE dispatcher、aux/z loss 和 MoE metrics；镜像有 DPO/GRPO 实现。

**缺口。** 27B 首版使用 `model_type=qwen3_5`、`template=qwen3_8`，35B 应改为 `qwen3_5_moe + qwen3_5`。已有 Ready 的模板和标签不能直接当 35B 已验证输入。Dense TP/PP 配置、checkpoint 导出和视觉冻结不能未经验证照搬。MoE 的 aux loss、专家负载和实际梯度账目也未建立。

**验收。** 重新编码文本、图片、工具和最长代表样本；做全参数 MoE 小步前后向、优化器更新、辅助损失、恢复与导出，再用导出模型跑真实图文工具请求。记录 TP/PP/EP/DP、micro/global batch、aux loss、专家负载和显存。之后才能比较 LR 或增加 batch。

### P1：训练配比和 batch 仍应作为实验变量

第三份方案的 global batch>1、Agent 30%/50%、SFT LR 范围都只是起点。当前 batch=1 的逐样本归一化和持续梯度裁剪已经说明，改 batch 会同时改变优化、长样本权重和 LR 条件。

**验收。** 先固定数据流做 batch/LR 小对照，按实际更新窗口记录来源 U、W、CE 和梯度；不能仅为了流水线吞吐把 global batch 改大并沿用全部结论。Agent 30%/50% 应在 correction 数据形成后再比较，不能用重复教师轨迹凑比例。

### P1：分支 DPO 与多轮 RL 只有框架零件，没有项目管线

**已有。** Swift 中有 DPO、GRPO、rollout 和 MoE 相关实现。

**缺口。** 通用 trainer 不会自动理解“共享前缀的 chosen/rejected 动作、后续验证、assisted success、环境观察 mask、多图工具轮次和 180K episode”。没有本项目分支 collator、前缀身份校验、在线快照调度、独立 reward 服务和未知基础设施剔除。

**验收。** DPO 前先离线验证同 parent、同前缀、chosen/rejected 动作和各自后续结果，做少量模板/标签/参考模型 smoke。RL 前另做完整 episode rollout→独立 reward→unknown 剔除→参数更新的小闭环。框架类存在不能替代这些验收。

### P1：成本与失败预算需要成为实验账本

首版学生 token 约翻倍，K=4/8 和 32 并发会放大采集成本与网关压力。K 用于失败挖掘和分支研究，不是把 pass@K 当 Accepted@1。

**验收。** 每题第一独立 episode 单独作为 Accepted@1；其余预定试次只用于稳定性、失败挖掘和偏好。记录所有教师/学生/无效基础设施尝试的 token、墙钟和 GPU 小时。基础设施调试可先用少量 K=2 canary，正式 K=4 只有在快照和账本跑通后扩大。

## 四、建议的实际推进顺序

### 阶段 0：不训练，先补可验证基础设施

1. 新 dev/test 与诊断池冻结，旧 test 降为历史回归。
2. 捕获完整逐次请求和 compaction；实现内容寻址 snapshot/restore、parent/branch 和 assisted 身份。
3. 补 mutation suite 和视觉 unknown/冲突裁决；先修有冲突的 fixture。
4. 35B 原版推理 canary，明确模板实际支持的思考配置。
5. 对已有首版中后段 checkpoint 做行为选择；保留 27B 作为质量对照。

### 阶段 1：小规模学生纠偏试点

- 用新诊断题先跑 K=2 工程 canary，再按预定 K=4 采集。
- 产出第一批真实“学生前缀→教师局部纠偏→学生继续→独立验收”及动作标签。
- 成功必须区分 independent success 与 assisted success；后续学生独立重跑才证明恢复能力。
- 试点未通过快照、身份和 grader 验收前，不扩大成几百/几千条。

### 阶段 2：35B MoE SFT 技术准入和短对照

- 重新生成 qwen3_5 模板数据，完成全参 MoE、长序列、多图、aux loss、导出和服务 smoke。
- 在同数据下比较 27B 与 35B 短 SFT；先证明质量不降和 episode 吞吐收益。
- batch、LR、Agent 比例一次只改一类；保留首版混合和必要纯 Aodi 对照。

### 阶段 3：证明 correction SFT 的增量

主比较不是“新模型是否不同”，而是同一基座、同预算下：

```text
完整教师轨迹冷启动
vs
冷启动 + 学生真实状态教师纠偏
```

在新 dev 上看 Accepted@1、真实修复、视觉修复、非目标保持、健康误改、陈旧证据、提前交付和总成本。胜出后才进入分支偏好。

### 阶段 4：DPO → 完整 episode RL → 短程 RL

- DPO 先证明同前缀偏好改善关键动作，且长代码风格和非目标保持不退化。
- RL 只在 correction 有效、验证器能抓注入缺陷、奖励有方差、快照稳定后启动。
- 先完整终局 reward，再共享前缀短程 RL；视觉过程奖励单独消融，不与首次 RL 同时引入。

## 五、最简 P0 交付清单

| 交付 | 通过条件 | 未通过前不要做 |
|---|---|---|
| 请求捕获 canary | system/tools/messages/图片/compaction 全保存并可重放 | 学生中心正式采集 |
| snapshot/restore | 两个独立环境从同前缀恢复，文件/状态/消息/证据一致 | 教师接管和分支偏好 |
| branch 账本 | parent/branch/assisted/独立身份完整，case 级隔离 | 统计 correction 和偏好收益 |
| mutation suite | 已知执行、机构、时间、视觉和非目标缺陷均可被抓 | 自动正例筛选和奖励 |
| 35B 推理 canary | 图文工具、长上下文、历史 thinking 实测；档位如实记录 | E0/E1 配对 |
| 35B SFT smoke | qwen3_5_moe/qwen3_5、MoE 更新、恢复、导出、服务全通 | 全参数正式训练 |
| 新 dev/test | 新题族和完整场景故障谱系冻结 | 下一轮配置选择和终验 |
| correction 试点 | 少量真实纠偏全链路通过并有独立复验 | 扩大 K 和采集规模 |

Opus 的独立基础设施补充见 `opus-infrastructure-review.md`，最终联合取舍见 `execution-readiness.md`。
