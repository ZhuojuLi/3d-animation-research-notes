# 第二份外部独立报告来源登记

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

本报告由用户在 2026-11-22 粘贴提供，具体模型、运行环境和会话日志未提供。报告自述未读取其他 AI 结论，且无法访问本项目本地目录。这里保存供研读、校对与联合汇总，不将自述等同于本地运行核验。

# Three.js 动画 Agent 评估体系：独立调研与可实施方案

日期：2026-11-22
范围：评估设计、评估器校准、数据隔离、小样本统计、公平对照、产物 schema、阶段放行与停止规则
研究方式：一手论文、官方技术文章与原始仓库只读核验；未启动训练，未运行收费模型批量任务，未修改任何项目文件

## 0. 证据状态与结论边界

### 0.1 标记约定

- **【公开事实】**：可由题面、论文、官方文章或原始仓库直接支持的事实。
- **【迁移推论】**：把其他工作的设计迁移到本项目时作出的判断，不是原论文已经证明的结论。
- **【项目建议】**：为本项目提出的可执行规则、阈值或流程。阈值属于预注册建议，不冒充领域定律。
- **【未知项】**：当前无法核验、必须实测或由项目方补充定义的内容。

### 0.2 本地材料限制

【未知项】题面列出的 `${WORKSPACE}/3d-animation-agent`、`${WORKSPACE}/ai-employees/...` 和 `${WORKSPACE}/skills/...` 在当前环境中均未挂载。当前只能读取用户上传的研究题面，无法实际打开 `README.md`、两份草案、`cases.json`、两个检查器、预检 summary、历史验证或历史盲评。

因此，本报告关于“当前题目、检查器和盲评”的内容分为两类：

1. 可由题面直接确认的项目约束；
2. **待本地核验的高风险审计假设**，不把它们写成当前代码已经存在的缺陷。

本报告没有读取或引用本次研究中其他 AI 的调研报告、汇总结论。检索中发现的二手页面仅用于定位原始材料，不作为报告证据。

### 0.3 题面给定约束

【公开事实】项目要求生成 JavaScript/Three.js 动画，交付离线 HTML、可编辑源码与真实浏览器证据，任务包括从零生成、固定缺陷修复、局部编辑、健康控制和缺输入阻断。现有计划以 10,697 train / 812 validation 的 answer-only 代码数据为基础并新增多轮 Agent 轨迹。正式对照草案包括原生 Qwen3.8-27B、one-shot SFT、多轮 SFT 与 Kimi；另一草案首轮只训练一个混合 SFT。以下评估底座统一描述 system、case、run 和 scorecard，不替项目决定训练配方。

### 0.4 核心结论

1. **主指标应是题簇宏平均的严格验证成功率，而不是“页面能跑”、截图好看或若干分项的加权平均。** 未交付、运行失败、必需语义失败、关键视觉不可读、诚信违规均不能被大量简单分项抵消。
2. **6 个 dev 题簇×2 case 与 12 个 test 题簇×4 case 可以支持故障发现、逐案审查、大效应的预注册比较及较宽的区间估计；不足以稳定支持小差距总排名或细分维度冠军。** 独立外推单位首先是题簇，不是 frame、assistant 回合、token，也不是重复 trial。
3. **评估器自身必须先过校准门。** 已知好版只证明“能通过”，单缺陷坏版只证明“能抓某类错”；还必须加入合理替代实现以测错误拒绝，加入健康控制以测误报、环境故障和跨题串扰。
4. **train/dev/test 必须在变体扩展和 Agent 轨迹生成之前，按源码谱系、资产谱系与任务题族成组隔离。** 改题面、换文件名、改常量、换随机种子、从同一底座生成修复题，都不构成独立新题族。
5. **原生 27B、SFT 学生与 Kimi 的公平比较首先是 agent-system 比较。** 只有在工具、观察序列、预算、retry、评价器和时间窗口一致时，才可进一步讨论模型差异；若 Kimi 使用不可消除的内置 harness 或额外视觉输入，必须保留系统级解释。
6. **首轮 SFT 前最低可行交付不是一张排行榜，而是一套可重放证据链：** 冻结 case/contract、环境锁、run、scorecard、视觉评审、谱系清单、校准报告和分母完整的汇总。

## 1. 研究对象、计数单位与待确认定义

### 1.1 计数单位必须分开

| 单位 | 本报告定义 | 可以回答 | 不能冒充 |
| --- | --- | --- | --- |
| case | 一个输入、任务模式和成功契约的实例 | 某个具体需求是否完成 | 独立题族数量 |
| 题族／cluster | 共享核心机制、参考实现、资产谱系或任务结构的一组 case | 对同类机制的宏平均表现 | case 数量；是首要外推与聚类单位 |
| run／trial | 某 system 在某 case 上的一次完整 Agent 尝试 | 单次成功率、波动、成本 | 新题目或独立需求样本 |
| 渲染帧 | 某 run 在一个动画时间点的一幅图像或原生状态 | 该时间点或窗口的证据 | 独立任务样本；连续逐帧证明 |
| assistant 回合 | Agent 生成消息的一次循环 | 交互深度、低效循环 | 独立样本 |
| tool call | 一次工具调用 | 工具行为与成本 | 任务成功或样本量 |
| token | 模型计费/上下文的离散单位 | 用量与成本 | 跨模型等义的工作量或样本量 |
| assertion／check | 契约中的一个判定项 | 局部语义或质量诊断 | 独立 case；完整任务成功 |

【公开事实】题面计划为 Agent dev 6 个新题簇、每簇 2 题，即 12 case；test 12 个新题簇、每簇 4 题，即 48 case。若每题每系统运行 R 次：

- test 在 R=3 时为每系统 144 trial；四系统共 576 trial，三系统共 432 trial。
- test 在 R=5 时为每系统 240 trial；四系统共 960 trial，三系统共 720 trial。
- dev 在 R=3 时为每系统 36 trial；四系统共 144 trial，三系统共 108 trial。

这些 trial 总数只用于预算与估计同题随机波动，不得写成“独立样本量 576”。

### 1.2 任务模式的适用性

| 模式 | 成功含义 | 特别防止的误判 |
| --- | --- | --- |
| 从零生成 | 交付离线 HTML、可编辑源码与真实浏览器证据；满足必需场景、动画、交互与健康约束 | 只有 DOM/canvas、只有首帧、只有静态模型 |
| 固定缺陷修复 | 原坏版先失败目标检查；修复后目标检查通过，且原有通过项不回归 | 整份重写碰巧相似、只修表面、破坏保留行为 |
| 局部编辑 | 指定目标发生所需变化，非目标代码和运行时行为保持在容差内 | 全量再生成、目标与保留项互相抵消 |
| 健康控制 | 满足题面定义的健康/播放控制要求 | 只出现按钮或文案，实际状态不变 |
| 缺输入阻断 | 明确指出缺失输入并按契约停止或提问，不伪造资产、源码、截图或成功声明 | 把“没有交付 HTML”机械算失败，或把幻觉生成算主动解决 |

【未知项】“健康控制”的精确定义未能从本地 README 核实。本报告暂按动画健康与播放控制需求理解，例如暂停/继续、降低动态效果、频闪限制、资源清理等；若项目实际含义不同，应替换该切片定义，但保留“适用性掩码”和校准方法。

## 2. 一手证据及其可迁移边界

### 2.1 OpenAI：题集质量与污染审计

【公开事实】OpenAI 在 2024 年发布 SWE-bench Verified 时，使用 93 名开发者筛选样本，每题由三人独立标注，最终形成 500 题；原意是排除欠规格题面与会拒绝正确解法的测试。[S1]

【公开事实】OpenAI 后续审计的是 **500 题中 138 题（27.6%）这一“o3 在 64 次独立运行中不能稳定解决”的困难子集**，其中至少 59.4% 被发现存在实质性测试或题面问题；35.5% 为约束过窄，18.8% 为测试范围过宽，5.1% 为其他问题。59.4% 的分母是 138 个受审困难题，不是全部 500 题。该审计还发现受测前沿模型能复现部分 gold patch 或题面细节，说明公开题集及解法的训练污染会同时影响成功率和欠规格测试的可解性。[S2]

【公开事实】OpenAI 对 SWE-bench Pro 731 个 public-split 题的后续审计中，数据点分析流程标记 200 题（27.4%），人工标注活动识别 249 题（34.1%）；问题包括过严测试、欠规格提示、低覆盖测试和误导提示。OpenAI 最终撤回此前对 SWE-bench Pro 的推荐。[S3]

【迁移推论】对 Three.js 项目有三条直接教训：

- 人工评审和“verified”命名不是永久正确性的证明；必须周期性做变异审计、成功轨迹审计和失败轨迹审计。
- 只审计失败会漏掉“低覆盖检查让坏结果通过”；只审计成功会漏掉“过严检查拒绝合理替代”。两类都要抽样。
- 公共外部 OOD 的得分不能自动解释为无污染泛化；公开题面、参考代码、PR、视频与解法都可能已经进入不同模型的训练语料。

### 2.2 Anthropic：Agent eval 工程指南

【公开事实】Anthropic 将 task、trial、grader、transcript、outcome、evaluation harness 与 agent harness 分开，并强调评估的是模型与 harness 的组合。其指南建议：优先确定性 grader，模型 grader 用结构化 rubric 和 `Unknown` 出口并定期由人校准；每次 trial 从干净环境开始；避免把特定工具调用路径当唯一正确路径；分别建设 capability 与 regression suite；用重复 trial 区分 pass@k 与 pass^k。[S4]

【公开事实】同一指南称早期可从 20–50 个来自真实失败的简单任务开始，因为早期大变化往往足以由小题集发现；它并没有据此承诺小题集能识别几个百分点的成熟模型差异。[S4]

【迁移推论】本项目应把“最终结果正确”与“Agent 是否合理检查、修复和阻断”分层；工具轨迹用于诊断，除防作弊、必需澄清等明确政策外，不应强制唯一工具序列。

### 2.3 WorldCoder-Bench：状态探针与变异硬化

【公开事实】WorldCoder-Bench 论文提出 2,026 个 Three.js 任务，并以 StateProbe 在沙盒 Chromium 中读取运行时状态、执行动作、检查前后状态差分。契约对模型隐藏，但状态接口 schema 可见；每个契约须能拒绝注入缺陷后才被接纳。指标包括 A-Cov、S-Cov、T-Cov、V-Cov 及成本/时间效用。[S5]

【公开事实】论文 §2.2 的变异包括陈旧状态、错误物理常量、资产加载失败、事件目标交换和 HUD 不一致；§2.3 的鲁棒变体改变物理常量、对象数、初始状态、题面和资产文件名。它把多个有效实现统一交由行为契约而非唯一参考 HTML 判定。[S5]

【公开事实】截至本次只读访问，官方 GitHub README 明确写道：当前公开 Hugging Face release 为 205 个 core tasks，论文描述的是 2,026 题；该 GitHub 页面不提供评估实现。因此，本报告核对了论文与数据发布说明，**没有复核 StateProbe 原始实现，也没有复现其结果**。[S6]

【迁移推论】可迁移的是“可见接口、隐藏契约、动作前后差分、变异准入”的思想。状态探针仍可能被伪造，必须与实际渲染、独立几何/运动测量交叉验证；Robust 变体适合测机制泛化，但同源的参数扰动不能算新题族。

### 2.4 VibePrevisBench：场景事实与可见性双检

【公开事实】VibePrevisBench 包含 242 个 Blender 4D 任务。Rule-based Scene Check 对比重放导出的场景与隐藏事实；VLM-based Screen Check 再问“这些已经由规则判定正确的内容能否在 proxy video 中被看见”。所有交付先过独立运行、完整渲染和 Blender 重开三门；失败留在平均中并记零，评分来自从新沙盒重放，而不是 Agent 自己提供的视频。[S7，§3.2]

【公开事实】附录 B.4 报告：2,786 份被重复评分的交付在规则评分上完全一致；注入延迟、删除人物和相机旋转会按预期降分，但“人物上浮 1 m”只让 physical-validity 降 0.8 分，作者据此暴露了该检查的不足。跨判官比较中，Gemini 4 与 GPT-6.1 Sol 的 Agent 层 Spearman 相关为 0.96，而单 run 层为 0.76（2,628 runs）；三个判官均与 242 对人类偏好形成约 0.90–0.92 的 Agent 层相关，但平均分相差约 14 分。[S7，§B.4、Table 4]

【迁移推论】应分别验收“场景内部正确”与“用户能从画面看懂”。高排名相关不能推出逐 case 判分可靠，也不能把不同判官的原始分直接混用。注入变异发现弱项后，应公开保留未解决覆盖缺口，而非只报告通过项目。

### 2.5 PhysCodeGym：反事实干预与分母纪律

【公开事实】PhysCodeGym 包含 156 个 video-to-Blender 任务和 578 个带时间戳事件。其六项指标把 SSIM、LPIPS、对象、事件、运动区域和物理有效性分开；物理有效性可读源码、原生场景、接触和力，并在选定任务上改变力、接触或初始条件后重模拟。无有效交付的任务在各指标记零并进入分母。[S8，§3.1–§3.2、§4.3]

【公开事实】其协议允许同一任务因审计后的服务基础设施故障做单独 recovery run，保留原 trial；Agent 自己造成的上下文超限或畸形图像请求算 Agent 失败；重复运行不是选最佳，而是取最新产生渲染序列的 run，没有渲染序列则记零。[S8，§4.1] 原始仓库还存在 `experiment/verifier/causal_metrics.py`、`experiment/causal_bench/suite_judge.py` 及逐案反事实 rubric；本次只读抽查了这些文件及分数输出中的 `failed_rules`、`unknown_rules` 字段，未执行完整基准。[S9]

【迁移推论】可迁移反事实测试、失败分母和 infra/agent 错误分离。**不能**迁移其“核心运动必须来自物理求解器”的要求到所有动画：普通关键帧、程序 easing 和艺术化路径在多数 Three.js 动画中是合理实现，只有题目要求物理机制时才应拒绝纯轨迹硬编码。

### 2.6 Animation2Code：外观与时间相似性分离

【公开事实】Animation2Code 提供 1,069 个视频—HTML/CSS/JavaScript 对，分别用 DreamSim 加帧对齐评价外观、用轨迹对应评价时间相似性。其人类校准从 214 个测试动画中形成 600 个成对比较，65 名标注者参与，每个比较由 3–4 人独立评价；overall 与 appearance 的 Krippendorff α 均为 0.81，temporal 为 0.73。[S10，§3.1]

【公开事实】其指标选择实验中，DreamSim 与 temporal fidelity 能分别补充预测人类外观与时间判断；作者没有把代码 AST 相似度当作人类视觉质量的替代。[S10，§3.1、Table 4]

【迁移推论】本项目也应把“看起来像”与“运动路径、速度、先后和持续时间正确”拆开。可是开放文本生成没有唯一正确视频，不能拿一个参考实现的外观或轨迹当唯一语义答案；参考式 DreamSim/LPIPS/SSIM 仅适用于确有参考视频的任务或作为辅助项。

### 2.7 3DCodeVerse：可执行不等于任务正确

【公开事实】3DCodeVerse 把执行检查、空间测量和 rubric 引导的视觉反馈组合进多 Agent DAG，并在数据集中保留源码、资产、环境和验证记录。其数据来源明确包括 CodePen animations（Animation2Code）和多文件 Three.js/React Three Fiber 项目。[S11，§3、§4]

【公开事实】Table 2 的 Three.js 执行率测试只有 40 题、一个 seed；Qwen3.8-27B 经其 SFT+DPO 配方后从 72.5% 到 92.5%，但表中指标定义只是“在运行时执行并产出结果”，不是动画语义或视觉验收。该配方也不同于本题要求比较的 one-shot SFT、多轮 SFT 或混合 SFT，不能搬用其效果量作为本项目预期。[S11，§5.2、Table 2]

【迁移推论】它支持保存环境和验证记录、使用空间工具辅助检查，同时也提示：若本项目训练数据与 Animation2Code、CodePen 或公开 Three.js 项目同源，所谓外部测试可能并不外部，必须做谱系交叉审计。

### 2.8 τ-bench、统计与污染控制

【公开事实】τ-bench 以会话结束后的数据库状态与目标状态比较来评价 Agent，而不是看 Agent 自称完成；pass^k 衡量同一任务 k 次独立尝试全部成功的可靠性，与至少一次成功的 pass@k 方向相反。[S12]

【公开事实】Miller 的统计技术报告建议：相关题目使用聚类标准误；模型比较使用同题配对差；重复回答只能降低条件方差，不能消除题目选择方差；用事前 power analysis 判断评估是否能检测目标差异。[S13，§2.2、§3.1、§4.2、Appendix B/C]

【公开事实】LiveCodeBench 通过题目发布日期窗口降低污染风险，并实证观察到部分模型在训练截止后题目上的表现变化。[S14，§5.1] 时间窗口是降低风险的证据，不是对所有模型、镜像站点和后续训练批次的绝对无污染保证。

【迁移推论】本项目可用 pass^2/pass^3 衡量同题稳定性，用配对题簇差估计提升，用新鲜私有题目增强外部验证；不能把整体平均成功率直接取 k 次方来冒充题级 pass^k，也不能把公共“最新”题集默认成所有模型均未见过。

## 3. 指标树：硬门槛先行，辅助分项诊断

### 3.1 第零层是评估有效性，不是模型分数

在计算任何模型分之前，以下任一失败都应使对应结果**不可用于模型排名**：

- case 可解性、题面—契约一致性或资产许可未通过；
- 必需检查器未完成好版/坏版/替代版/健康控制校准；
- 环境健康控制失败，证明故障来自浏览器、工具或评估基础设施；
- train/test 谱系污染未解决，或 test 已用于训练、调参、提示修订；
- 关键评分数据缺失、模型版本不明、盲评映射泄漏。

这些失败记为 `eval_invalid` 或 `infra_error`，不能悄悄转成模型零分，也不能从报告中消失。

### 3.2 主指标：题簇宏平均严格验证成功率

对 system `m`、题簇 `f`、case `c`、trial `r`，令 `y_mfcr∈{0,1}` 表示该次是否为严格验证成功。定义：

```text
S_mfc = (1 / R_fc) × Σ_r y_mfcr
S_mf  = (1 / C_f) × Σ_c S_mfc
S_m   = (1 / F) × Σ_f S_mf
```

- `C_f`：题簇内 case 数；当前 dev 为 2，test 为 4。
- `R_fc`：该 case 的有效 trial 数；计划时各 case 均为 R，发生 infra 替换或未解决 slot 后允许不同，避免有效 run 较多的 case 获得额外权重。
- `F`：题簇数；当前 dev 为 6，test 为 12。
- `S_m`：**VerifiedSuccess@1，题簇宏平均**。它估计单次 Agent 调用在该冻结题族分布上的严格成功概率。
- case 加权结果作为次要敏感性分析；外部集若簇大小不等，宏平均防止大簇支配总分。

单次 `y=1` 必须同时满足所有适用项：

1. **交付与诚信**：要求的 HTML、可编辑源码、资产和证据存在；源码与实际运行产物同源；没有改检查器、读隐藏契约、复用伪截图或访问禁网。
2. **离线运行**：新浏览器 profile、无缓存、禁网条件下加载成功；无致命 JavaScript/WebGL 错误；动画时钟推进；要求的交互可执行。
3. **必需语义**：所有 `required=true` 的对象、资产、事件、时序、状态转换、修复目标和保留行为通过。
4. **关键视觉可读性**：必需主体与动作在实际画面可辨认，不被相机遮挡、离屏、全黑、严重穿模或闪烁等问题掩盖。
5. **特殊行为**：缺输入阻断、健康控制、禁止工具/写入等政策检查通过。

关键视觉硬门只纳入能对所有相关 run 完整执行的确定性检查或固定人工评审协议；若独立视觉评审只覆盖抽样，未评审 run 不得被默认视为通过，抽样结果只能进入辅助质量分析。审美偏好不属于上述硬门。

美观、代码优雅、工具调用数量多、Agent 自称完成均不能补救上述任一硬门槛。

### 3.3 各层指标及角色

| 层 | 指标 | 角色与分母 | 不应如何使用 |
| --- | --- | --- | --- |
| 可交付 | 文件齐备率、离线成功率、可编辑源码率、证据完整率 | 分母为全部有效 Agent attempts；缺输入阻断的预期不交付单列 | 用 HTML 存在推断动画正确 |
| 运行健康 | 致命错误率、网络请求数、渲染循环存活率、帧时间/超时 | 同一 attempts；网络日志和控制台按 run 归档 | 用 `requestAnimationFrame` 存在推断时钟真的推进 |
| 动画语义 | 对象/资产覆盖、事件覆盖、顺序、时间窗、轨迹、速度、循环、交互状态、保留行为 | 每个 assertion 输出 pass/fail/unknown/N/A；连续分为辅助，required 项决定硬门 | 让大量易检查项抵消关键事件失败 |
| 视觉质量 | 主体可辨、构图/相机、动作可读、连续性、技术缺陷、审美偏好 | 人类盲评按 case/trial；成对偏好含 tie；按题簇聚类区间 | 单张首帧代表整段；模型自审当独立验收 |
| Agent 行为 | 实际渲染检查、失败定位、有效修复、重复循环、越权行为、澄清质量 | 每 run 轨迹；除明确政策外只作诊断 | 强迫唯一工具路径；工具越多认定越强 |
| 可靠性 | pass@1、pass@3、pass^2/pass^3、同题方差 | 同 case 的 R 次 trial；先算 case，再按题簇聚合 | 把 best-of-N 当单次能力；把总平均成功率直接取 k 次方 |
| 成本 | 墙钟秒、GPU 秒、输入/输出 token、回合、工具调用、USD、P50/P90 | 全部 scheduled 与 valid attempts 都报告；成本含失败 run | 只报告成功 run 成本；跨 tokenizer 直接等义比较 token |
| 成本效用 | `总成本 / 严格成功数`、质量—成本 Pareto | 成功数为 0 时记不可计算/∞，不取各 case 比率平均 | 用未经证实的人时估值做唯一排名 |
| 泛化 | 新题族、参数/资产扰动、外部 OOD、通用代码保持 | 每个分布单独报告题簇数、case 数、trial 数 | 汇总成一个“通用能力”分数掩盖弱切片 |

### 3.4 pass@k 与 pass^k 的项目实现

设某 case 在 R 次有效 trial 中有 c 次严格成功：

```text
pass@1 = c / R
pass@k = 1 - C(R-c, k) / C(R, k)    （至少一次成功；R≥k）
pass^k = C(c, k) / C(R, k)          （随机 k 次全成功；R≥k）
```

先在 case 内计算，再按题簇宏平均。`C(a,b)=0` 当 `a<b`。R=3 时 pass^2 只能取很粗的值，因此应作为可靠性诊断而非精细排名。pass@3 只代表“允许多次尝试且取最好”的部署方式，不得与 pass@1 混排。

### 3.5 未交付、unknown、N/A 与 infra error 的分母规则

| 状态 | 判定 | 主指标处理 | 必须同时报告 |
| --- | --- | --- | --- |
| `not_delivered` | Agent 有机会完成但未交所需产物，或产物无法解析 | `y=0`，留在全部有效 attempts 分母 | 数量、原因、run 证据 |
| `fail` | 有可信证据表明要求未满足 | `y=0` | 失败 assertion 与时间/状态证据 |
| `unknown` | 评估器在证据充分性和题面无冲突时仍无法判断 | **不算成功**，主指标按未验证（0）处理；不能从总分母悄悄删除 | unknown 率、原因、负责复核的人；同时给诊断上下界 |
| `not_applicable` | 该模式不适用，例如缺输入阻断不要求 HTML | 不进入该 assertion 的适用分母；不影响其他适用门 | 适用性规则和批准记录 |
| `expected_abstention` | 缺输入阻断按契约正确不生成 | 可构成 `y=1`，不是 `not_delivered` | 缺失项说明、停止/提问行为和无伪造证据 |
| `infra_error` | 已证明为浏览器、工具、平台、评估器等非 Agent 故障 | 原 trial 标无效并按预定政策补同槽位 trial；不直接当模型零分 | `N_infra/N_scheduled`、故障类型、替换关系、未解决数 |
| `agent_error` | Agent 自己造成上下文超限、畸形调用、预算耗尽或运行崩溃 | `y=0`，不得借 infra retry 消除 | 错误类型与预算消耗 |

对于连续 assertion 诊断，额外给出：

```text
确定通过率下界 = pass / (pass + fail + unknown)
可判定通过率     = pass / (pass + fail)
理论通过率上界 = (pass + unknown) / (pass + fail + unknown)
```

模型选择只使用预注册的严格主指标；`可判定通过率`及上界仅用于暴露评估器盲区。必需 assertion 出现 unknown 时必须触发人工复核，不能把 unknown 当 pass。

汇总至少保留四个分母：`N_scheduled`、`N_valid_agent_attempts`、`N_scored`、`N_infra`。另做一项保守敏感性分析：将所有未解决 infra slot 视为失败，检验排名是否改变；主分析仍不得用基础设施故障惩罚模型。

## 4. 评估器与盲评的校准

### 4.1 四类控制各自回答不同问题

| 控制 | 最少内容 | 预期 | 主要发现的问题 |
| --- | --- | --- | --- |
| 已知好版 | 专家编写且独立审查的完整实现、离线资产、参考轨迹与证据 | 所有适用必需项通过；重复评分稳定 | 环境不兼容、契约错误、过严容差 |
| 单缺陷坏版 | 每次只引入一个语义明确的缺陷，并保留缺陷标签 | 目标 assertion 失败；非目标项尽量不受影响 | 漏检、阈值过松、检查位置错误、总分掩盖关键缺陷 |
| 合理替代实现 | 不同命名、代码结构、几何近似、轨迹参数、额外允许元素、等价交互路径 | 仍通过，不被参考源码或单一样式绑架 | 错误拒绝、对特定实现/命名/相机过度拟合 |
| 健康控制 | 不含目标缺陷的健康动画、无关但合法动画、空场景、基础播放控制 | 无误报；环境故障可被识别；不会跨题串扰 | 误报、全局正则误伤、共享缓存/状态、infra 与 Agent 故障混淆 |

【项目建议】校准集再分成“设计集”和“冻结验收集”。不能用同一批坏版反复调阈值后又用它们证明检查器有效。每次 checker、rubric、容差或判官提示改变，都生成新版本并对冻结验收集重跑。

### 4.2 单缺陷变异库

至少覆盖以下机制；每种变异记录 `mutation_id`、改动位置、目标 assertion、预期非目标影响和源码/资产 hash：

1. 删除必需主体或 GLB，制造 404；
2. 把运动方向取反；
3. 把两个关键事件顺序交换；
4. 速度放大 2 倍或把持续时间缩短一半；
5. easing 从所需形式改为线性，或超出容差；
6. 暂停后对象仍移动，或继续时状态重置；
7. 循环边界跳变、对象离屏、相机裁掉关键动作；
8. HUD/按钮状态与内部状态不一致；
9. 只显示静态模型或预录图片，没有所需动态；
10. 对修复题只改表面颜色而不修目标缺陷；
11. 对局部编辑同时破坏一个原有通过行为；
12. 缺输入时伪造资产、截图或“已完成”声明；
13. 违反暂停、降低动态效果或其他健康控制；
14. 对要求物理机制的题，以硬编码轨迹冒充碰撞/接触响应；
15. 伪造 `__STATE__` 探针值，使内部报告与实际渲染不一致；
16. 修改 checker、访问隐藏 contract、通过外网获取禁用资源。

【项目建议】准入规则为：每个 critical 缺陷族至少被一个目标检查捕获；所有已知好版和冻结合理替代实现均通过；critical unknown 未清零不得用于正式评分。这里要求的是**本轮校准集全通过**，不是宣称已证明所有可能实现的真阳性率/真阴性率为 100%。

### 4.3 校准指标

- `mutation_detection = 被目标检查捕获的有效变异数 / 有效变异总数`，按缺陷族分层。
- `alternative_false_reject = 被错误拒绝的合理替代数 / 合理替代总数`。
- `healthy_false_alarm = 健康控制中被误报的检查数 / 健康控制检查总数`。
- `replay_flake = 同一归档产物重复评分结果变化数 / 重复评分总数`，区分规则、VLM 与基础设施。
- 对人工金标准分别列 TP、FP、FN、TN 与 unknown，不能只报相关系数。
- 检查定位性：目标 assertion 失败时，多少非目标 assertion 也异常，防止“一处坏、全部分数崩”或互相重复计分。
- 覆盖缺口：记录无法检查的需求，不用“其他都通过”掩盖未测项。

### 4.4 待本地核验的高风险审计假设

以下不是对当前代码的事实指控，而是取得本地文件后应优先执行的审计：

| 审计假设 | 核验方法 |
| --- | --- |
| DOM/canvas/WebGL 存在被当作任务完成 | 用一个静止球或空动画跑现有 checker |
| 只取首帧或随机少量帧，却声称时序正确 | 交换事件顺序、改变速度，观察是否仍通过 |
| 检查特定函数名、变量名、对象名或代码片段 | 跑语义等价的替代实现 |
| 未捕获 `pageerror`、失败资源请求或 WebGL context loss | 注入运行中异常和资产 404 |
| `unknown`、缺探针或评分异常被当 pass/skip | 逐项追踪分母与最终状态映射 |
| Agent 失败被误标为 infra，或共享浏览器故障被算给模型 | 同步跑健康控制并审查日志分类 |
| 修复题没有先证明坏版失败，或没有 pass-to-pass | 跑原始坏版、已知好版和保留项变异 |
| 加权平均允许关键必需项被其他分项抵消 | 构造仅关键项失败的坏版 |
| 视觉判官看到模型名、文件路径、token、轨迹或左右固定 | 检查评审清单、日志与随机化映射 |
| 生成模型自审被当独立视觉验收 | 检查 judge 与 generator 的身份、输入和校准 |
| 同一 base HTML 的生成/修复/编辑跨 split | 按 base artifact 谱系重新分组 |
| retry 后选最好被当 pass@1 | 对照 scheduled、valid、selected run 的选择逻辑 |
| Kimi 与本地模型观察输入、工具输出或预算不同 | 对比冻结的 prompt、工具 schema、观察包与用量 |

### 4.5 真实浏览器视觉验收协议

1. **证据来自独立重放。** 从归档源码在新沙盒重新运行，不能只收 Agent 自己挑选的截图或视频。
2. **时间采样与事件采样结合。** 保留完整视频；检查图包含均匀帧、语义关键帧、交互前后帧和异常窗口。报告实际动画时间与采样帧率。
3. **有限采样只支持有限结论。** 若仅检查 N 帧，就写“这 N 帧及对应状态窗口”；只有确实逐帧读取原生状态或视频全部帧时才使用“逐帧”，仍不据此证明连续时间数学性质。
4. **统一显示条件。** 成对视频使用同分辨率、帧率、播放速度、时间窗口和可比相机；若比较不同相机是任务本身，另设自由相机分项。
5. **盲化与随机化。** 隐去模型、trial、成本、文件名和轨迹；A/B 左右随机且均衡；部分 pair 做左右交换以测位置偏差。
6. **分项评审。** 先独立判断语义可见性和技术缺陷，再评美观；避免漂亮画面先入为主地补足不存在的动作。
7. **允许 tie 与 unknown。** 不强迫评审在证据不足时选择；unknown 进入复核，不在胜率分母中暗中删除。
8. **至少两名独立评审。** 分歧由第三人或 adjudicator 处理；报告原始票数、一致率及适合数据类型的 Krippendorff α/κ，但不把高一致性当高正确性。
9. **判官校准。** VLM judge 固定版本和提示，先用四类控制与人类标签验证；模型自审只能作为 Agent 行为证据，不能替代独立视觉验收。
10. **保存反证。** 每个关键结论都链接到视频时间点、状态快照或 console/network 记录，便于第三方复查。

## 5. 数据隔离、封存与外部 OOD

### 5.1 先分谱系，再生成变体与轨迹

【项目建议】在任何 prompt 扩写、参数扰动、缺陷注入、教师生成和 Agent 轨迹采集之前，执行以下顺序：

1. 建立源码、资产、base artifact 和任务机制谱系；
2. 将谱系组分配到 train、dev、test 或 external；
3. 冻结分组 manifest 与 hash；
4. 只在各自 split 内扩展 case；
5. 只用 train 组生成训练答案和 Agent 轨迹；
6. 每次新增数据重新跑全量跨 split 查重，而不是只查新增行之间的重复。

同一 base HTML 衍生的从零生成、缺陷修复、局部编辑必须同组。同一任务的文本改写、常量变化、相机变化、资产改名和格式转换默认仍属同族。

### 5.2 三类隔离键

| 隔离键 | 记录字段 | 检测方法 | 分组规则 |
| --- | --- | --- | --- |
| 源码谱系 | 上游 URL、repo、commit、路径、许可、下载时间、SHA-256、规范化 AST/文本指纹、转换父ID | 精确 hash；去注释/空白/标识符后的规范化；token n-gram/MinHash；AST 相似；人工复核候选 | 高风险公共 repo 可按 repo 级隔开；任何近重复簇同 split |
| 资产谱系 | 原始 GLB/纹理/网格/动画 hash、来源、作者、许可、转换父ID、感知/几何指纹 | 二进制与解码后 hash；网格/纹理提取；缩放归一化比较；感知 hash；人工检查 | 重命名、重导出、缩放、格式转换不创建新资产；同谱系同 split |
| 任务题族 | 机制、目标拓扑、事件序列、base artifact、交互路径、模板作者、变体父ID | 规则标签加人工审查；题面 embedding 只作候选召回，不作无罪证明 | 同核心机制/模板/参考实现同 split；参数扰动不升级为新族 |

另设 `trajectory_lineage`：凡在 dev/test 上产生的成功或失败轨迹、人工修订、隐藏 contract、判官输出，均不得进入训练。若 dev 被用于训练，它随即失去 dev 身份，必须补新的开发集。

### 5.3 dev/test 封存

- public case 与 private contract 分目录、分权限；模型只拿 public 输入和必须公开的接口 schema。
- manifest 记录内容 hash、创建者、冻结时间、访问日志和版本；test 采用只读评估服务账号，训练账号无读权限。
- canary string 可用于后续污染排查，但不能阻止抓取，也不是加密替代品。
- test 在模型选型前冻结；最终 unblind 原则上只一次。任何 test 结果用于改训练、提示、工具或阈值后，该 test 已变成 dev，需换新 test。
- checker 修复后必须对**所有系统的归档产物**重评分，不得只重跑当前表现差的系统；新版本与原版本结果并列保留。
- test 运行前冻结分析脚本、主指标、对比、区间方法、排除规则、视觉 rubric 与 multiplicity 规则。

### 5.4 外部 OOD 的角色

外部 OOD 用于回答“离开本项目题族后是否仍有信号”，不用于弥补内部 test 的题簇数量，也不用于事后挑选最有利切片。建议预注册三类：

1. **新机制 OOD**：未出现在训练中的动画机制或组合；
2. **新资产/新来源 OOD**：许可清晰、谱系独立、最好私有新 authored；
3. **扰动 OOD**：同一机制的参数、对象数、初始状态和资产替换，仅作为机制鲁棒性，不计作新题族。

公开 WorldCoder、Animation2Code、3DCodeVerse 或其他基准可作为公开对照与 smoke test，但必须先查训练谱系与各基础模型潜在污染。WorldCoder 当前公开的是 205 core 而非论文全部任务，且官方未公开评估实现；这些限制必须随结果一起出现。Blender/OpenCV 工作的指标可迁移思想，但不能直接当 Three.js 项目的同分布测试。

## 6. 样本量、重复 trial、区间与模型选择

### 6.1 这套规模能支持什么

【公开事实】题面规模为 dev 12 case/6 簇、test 48 case/12 簇。【项目建议】按下表限定结论强度：

| 结论类型 | 当前规模可否支持 | 合理表述 |
| --- | --- | --- |
| 某类系统性故障存在 | 可以，少量反例即可 | “在题簇 X 的 case Y 观察到，证据见 run Z” |
| 检查器明显漏检/误拒 | 可以，依靠定向控制 | “该 checker 未捕获变异 M” |
| 大且稳定的系统差异 | 可能，需看配对题簇方差 | 报告效应、区间和预注册判定 |
| 单系统在大致冻结分布上的成功率 | 可给宽区间与描述统计 | 必须给题簇数、case 数、trial 数 |
| 几个百分点的可靠总排名 | 通常不适合 | 默认“未分出”，而非“打平” |
| 每种任务模式/难度/视觉维度的细分冠军 | 不适合 | 只做探索性描述 |
| 对所有 Three.js 动画的普遍结论 | 不支持 | 外推仅限预注册题族生成过程与外部证据 |

【项目建议】新增题簇优先于把同一 case 从 R=3 增至 R=20。重复 trial 主要降低模型与工具的同题随机波动；题目机制覆盖不足不会因此消失。

### 6.2 直观精度界限

若错误地把 case 当独立 Bernoulli 样本，在观察到 50% 成功率时，Wilson 95% 区间约为：

- n=12：[25.4%，74.6%]；
- n=48：[36.4%，63.6%]；
- n=144：[41.9%，58.1%]。

这些数字只是说明数量级，**不是本项目应直接采用的区间**：48 case 还聚在 12 个题簇，144 trial 又聚在 48 case 内，实际有效信息量通常更少。重复 trial 不能让区间机械缩到第三行。

对配对题簇差 `d_f = S_Af - S_Bf`，若规划阶段假设题簇差标准差为 `σΔ`，双侧 α=0.05、80% power 的近似最小可检测效应为：

```text
MDE ≈ (1.96 + 0.84) × σΔ / √F
```

| 题簇数 F | σΔ=0.10 | σΔ=0.20 | σΔ=0.30 |
| --- | ---: | ---: | ---: |
| 6（dev） | 11.4 个百分点 | 22.9 个百分点 | 34.3 个百分点 |
| 12（test） | 8.1 个百分点 | 16.2 个百分点 | 24.3 个百分点 |

这是规划用的正态近似，不是实测功效保证。它说明：除非配对差非常集中，否则当前 test 更适合讨论约十几到二十多个百分点的大差异，而不是 2–5 个百分点的细微排名。正式报告必须用 pilot 得到的 `σΔ`、ICC 和同题方差重新计算。

另一个直观限制是符号检验：无并列时，6 个 dev 题簇必须 6/6 同向，双侧精确 p 才为 0.03125；5/6 同向已为 0.21875。12 个 test 题簇至少需 10/12 同向，p 才约为 0.0386。符号检验忽略效应大小，只用于说明小簇数下的分辨极限，不能替代配对效应区间。

### 6.3 推荐重复策略

【项目建议】

- **pilot/dev**：R=3 起步，目的为估计同题方差、infra 率和题簇差方差。
- **最终 test**：R=3 为最低配置；若 pilot 显示同题波动明显、API 不稳定或结论靠近决策边界，对全部系统统一增至 R=5，而不是只给候选模型加跑。
- **稳定性估计**：同 case、同 trial index 跨系统形成 block；模型执行顺序在 block 内随机，避免按系统分批造成时间漂移。
- **增加 R 的停止规则**：若从 R=3 增至 R=5 的预估区间缩窄不足项目预设的最小收益，或预算达到上限，停止加跑并报告“未分出”，不得一直跑到显著。

最终 test 若加 R，必须对所有对比系统同时执行并冻结新 manifest；不能只补候选系统。

### 6.4 配对区间与检验

【项目建议】主分析按以下步骤：

1. 每个 system 先计算 case 内 R 次 trial 的均值，再计算题簇均值。
2. 对两个 system 在同一题簇形成 `d_f`；同 case/trial block 的随机化只用于执行，不把 trial 当独立外推单位。
3. **配对 cluster bootstrap**：每次从 F 个题簇有放回抽取 F 个，连同其中全部 case 和全部 trial 一起抽取；在同一批题簇上计算两系统宏平均差。做 10,000 次，报告 2.5% 与 97.5% 分位数。
4. 同时报告题簇差散点、中位数、符号计数和一个小样本敏感性区间，例如基于 `t(F-1)` 的均值差区间。F=12 时任何渐近区间都可能粗糙，不能把 BCa 或 bootstrap 的名义 95% 当精确覆盖保证。
5. 需要 p 值时，对题簇差做精确 sign-flip 随机化检验；F=12 可枚举 `2^12=4096` 种符号分配。符号检验可作补充，不应为了简化丢弃效应大小。
6. 不对 48 case 直接做普通 McNemar，也不对 144 trial 做独立二项检验；这些会忽略簇内相关。

【项目建议】若后续题簇数明显增加，可把层级模型/GEE 作为敏感性分析；首轮不以其复杂模型输出替代直观的题簇配对结果。

### 6.5 “提升、未分出、出现回归”的判定规则

在 test 运行前冻结以下量：

- 主比较及方向；
- 最小实用提升 `δ_M`，若只关心统计正差异则设 0；
- 可接受回归界限 `δ_R≥0`；
- 通用代码保持的非劣界限 `δ_NI≥0`；
- 所有硬门槛和 guardrail。

设配对差 `Δ = candidate - baseline` 的区间为 `[L,U]`。单一主比较使用 95% 区间；多重主比较使用与 §6.6 错误率控制相一致的区间，或以校正后的 p 值作最终统计判定。普通未校正 95% CI 仅用于展示效应，不得用来绕过 Holm 校正：

| 判定 | 规则 |
| --- | --- |
| **提升** | 所有预注册的系统级 guardrail 通过，且 `L > δ_M`。若 δ_M=0，只能称“检测到正差异”；若主张实用提升，δ_M 应预先大于 0 |
| **出现回归** | 任一不可接受的系统级硬 guardrail 失败，或 `U < -δ_R` |
| **未分出** | 其余情况，包括区间跨过 0、提升小于 δ_M 但证据不足、样本或 unknown 使结论不可靠 |

“未分出”不等于“相同”或“没有提升/回归”。通用代码保持另报：只有 `L > -δ_NI` 才能写“在该界限内保持”；`U < -δ_NI` 为超过界限的回归，其余为“未证明保持”。不要把 p>0.05 写成能力保持。

【未知项】`δ_M`、`δ_R`、`δ_NI` 是需要项目方根据发布代价确定的实用阈值，文献无法替项目决定。若暂时没有依据，应先报告 0 差异的区间和逐案故障，不宣称“实用不劣”。

### 6.6 多系统对比与多重性

为了兼容两种安排，统一使用 `native27B`、`student_arm`、`Kimi_reference` 的逻辑角色；实际 system manifest 再记录 `one_shot_sft`、`multi_turn_sft` 或 `mixed_sft`，评估代码不依赖训练配方。

【项目建议】

- 四臂正式实验的两个 SFT-vs-native 主比较采用 Holm 校正，控制这一族两项检验的 family-wise error；multi-turn vs one-shot 作为次要配方比较。Kimi 对比作为外部参照，报告效应与区间，不混入“SFT 是否有效”的因果问题。
- 单混合 SFT 首轮只有一个预注册 student-vs-native 主比较，无需为两个学生臂校正；仍保留 Kimi 外部参照和相同 guardrail。
- 若项目坚持全部两两比较作确认性结论，应预先对全部比较做 Holm 或类似校正，并接受更小功效；不得运行后只挑最大差异的一对。

模型选型只用 dev：先看硬门槛，再看主成功率，再看通用代码保持、关键视觉缺陷与成本 Pareto。不要按一个自由加权总分选择“最高者”。最终 test 只验证冻结选择，不根据 test 再换配方。

## 7. 原生 27B、SFT 学生与 Kimi 的公平对照

### 7.1 对照的最小共同协议

| 维度 | 冻结规则 | 需要保留的证据 |
| --- | --- | --- |
| system 身份 | 模型快照/端点版本、harness、系统提示、chat template、工具适配器、解码配置 | `system_manifest.json` 与 hash |
| 初始观察 | 相同 public case、资产、初始文件、提示文字与可用上下文 | 输入包 hash；不得一臂多给参考实现 |
| 工具 | 相同工具名、schema、超时、错误格式、文件权限和网络权限 | 工具 manifest、完整调用日志 |
| 后续观察 | 相同截图/帧数/分辨率、工具输出截断、stderr/stdout、状态接口 | 每次观察的序列化内容与 hash |
| 预算 | 相同 assistant 回合、工具调用、浏览器运行时间、总墙钟和 Agent 可写资源 | 预算配置与逐项实际消耗 |
| token | 记录各自输入/输出/缓存 token；同数值上限只作工程约束，不宣称跨 tokenizer 语义等价 | API usage 与本地 tokenizer 版本 |
| retry | Agent 失败不补跑；只有经审计的 infra error 按同槽位替换；禁止 best-of-N 当 pass@1 | 原 run、替换 run、原因、审批 |
| 时间窗口 | 各系统在相同时间窗交错执行；外部模型升级时整批重跑或按时间分层 | 开始/结束时间、端点响应头 |
| 评分 | 同一归档产物、同一 checker/判官版本、同一盲评 pool | artifact hash、scorecard 版本 |
| 并发环境 | 干净容器/profile，无历史 git、缓存、Cookie、其他 trial 文件 | 环境锁、健康控制和资源监控 |

【迁移推论】Kimi 若不能通过同一 adapter 调用，或其 CLI 强制额外工具、系统提示、内置视觉反馈，则结论必须写“在各自必需 harness 下的系统比较”。不要为了表格整齐而声称是纯粹的模型对照。

### 7.2 公平不等于所有配置数值相同

- 原生 27B 与各 SFT 学生应共享 chat template、解码策略和本地推理设置，隔离训练配方之外的差异。
- 外部模型的 temperature、reasoning effort 等含义未必与本地一致。应在 dev 冻结每个 system 的可复现配置并完整报告，不能为了“相同”而强行使用不受支持参数，也不能在 test 上逐模型调优。
- 若只有部分系统能接收图像观察，应设置两个明确轨道：共同文本/状态观察轨道，以及完整多模态系统轨道。缺少视觉输入的轨道不能与完整轨道混作同一公平比较。
- 本地 GPU 成本用硬件型号、GPU 秒、显存、功耗或明确小时单价敏感性报告；API 成本用实际 USD。没有统一价格假设时，质量—资源分别展示，不强造统一“性价比”。

### 7.3 困难任务提升如何测

【项目建议】“困难”必须在独立 pilot 或 dev 上定义并冻结，例如：已知好版可稳定通过，而 native27B 在同预算下达到预设低成功率；同时记录所需交互链、对象数、时间约束和编辑保留复杂度。不得根据 test 上哪个学生赢来事后划分困难集。

困难切片至少保留：

- 多对象、多阶段时序与状态同步；
- 需要观察—运行—定位—修复链的任务；
- 局部编辑且保留行为多的任务；
- 新资产或多资产整合；
- 缺输入识别与健康控制，防止只用生成复杂度定义能力。

最终分别报告 native 与 student 在该切片的配对差、逐案修复证据和失败类型。若冻结困难切片只剩很少题簇，应明确写“探索性”，不另做一次显著性狩猎。

### 7.4 简单代码能力保持如何测

通用代码保持是独立 suite，不从 48 个 Three.js test case 中抽几题充数。建议：

- 新建一组不含 Three.js 的简短 JavaScript 算法、字符串/数组处理、异步控制和小型缺陷修复题；每题有确定性单元测试与多个合理答案。
- 保留答案直写与固定缺陷修复两种模式；禁用动画专用工具，避免专用 harness 给训练后模型额外优势。
- 可补充时间窗明确的公开代码任务作外部敏感性分析，但不能仅凭发布日期声称无污染。
- native 与 student 使用相同输入、推理预算和测试；报告配对差、非劣区间和新增失败，而不只报“下降不显著”。
- 样本量若也只有几十题，不能可靠证明 ±5 个百分点级保持；应扩题、降低保持结论的精度要求，或明确“未证明保持”。

【项目建议】通用代码保持和困难动画提升应构成双向结论：**“困难切片得到提升，同时通用代码没有超过预设界限的回归”**。只满足前半句不能推出整体训练更健康。

## 8. 可实现的产物 schema

### 8.1 文件组织与可见性

```text
eval_manifest.json
environment.lock.json
cases/public/<case_id>.json
contracts/private/<case_id>.contract.json
lineage/records.jsonl
calibration/<checker_version>/report.json
runs/<run_id>/run.json
runs/<run_id>/transcript.jsonl
runs/<run_id>/artifacts/...
runs/<run_id>/evidence/...
scores/<run_id>.scorecard.json
reviews/<review_id>.json
summaries/<experiment_id>.json
access.log
```

模型只读取 `cases/public` 和任务所需资产；`contracts/private`、变异库、合理替代实现、人工标签及 test 访问日志不进入其上下文。以下 JSON 是字段骨架，不是要求把秘密预期值放进 public case。

### 8.2 case schema

```json
{
  "schema_version": "1.0",
  "case_id": "fam07_case03",
  "family_id": "fam07",
  "split": "test",
  "task_mode": "local_edit",
  "title": "只改变第二个球的轨迹",
  "instruction": "...",
  "applicability": {
    "requires_html": true,
    "requires_source": true,
    "requires_browser_evidence": true,
    "expected_abstention": false,
    "health_control": true
  },
  "inputs": [
    {
      "path": "assets/scene.glb",
      "sha256": "...",
      "asset_lineage_id": "assetline_19",
      "license": "..."
    }
  ],
  "base_artifacts": [
    {"path": "base/index.html", "sha256": "...", "code_lineage_id": "codeline_88"}
  ],
  "environment_ref": "env_threejs_v1",
  "observation_spec": {
    "tool_pack": "browser_v2",
    "max_frames_per_observation": 6,
    "image_width": 960,
    "image_height": 540,
    "state_interface": "window.__ANIMATION_STATE__"
  },
  "deliverables": ["index.html", "src/**/*.js", "evidence/run_video.mp4"],
  "contract_ref": "private/fam07_case03.contract.json",
  "difficulty": {
    "label": "hard",
    "defined_on": "pilot_v0",
    "rationale": "多对象时序与保留行为",
    "native_baseline_ref": "pilot_summary_hash"
  },
  "provenance": {
    "source_urls": [],
    "source_commit": null,
    "code_lineage_id": "codeline_88",
    "task_lineage_id": "taskline_07",
    "parent_case_ids": [],
    "created_by": "human_author_id",
    "created_at": "..."
  },
  "contamination_screen": {
    "exact_hash_checked": true,
    "near_duplicate_checked": true,
    "asset_lineage_checked": true,
    "manual_review_status": "pending"
  },
  "freeze": {"frozen_at": "...", "content_sha256": "..."}
}
```

private contract 至少包含：

```json
{
  "case_id": "fam07_case03",
  "contract_version": "1.0",
  "assertions": [
    {
      "assertion_id": "target_second_ball_path",
      "required": true,
      "kind": "trajectory",
      "severity": "critical",
      "precondition": {"animation_time_s": [0.0, 4.0]},
      "action_sequence_ref": "actions/start.json",
      "expected": {"object_role": "ball_2", "rule_ref": "hidden_rule_2"},
      "tolerance": {"position_scene_units": 0.05, "time_s": 0.1},
      "evidence_required": ["native_state", "rendered_video"],
      "unknown_policy": "not_verified"
    },
    {
      "assertion_id": "preserve_other_objects",
      "required": true,
      "kind": "pass_to_pass",
      "expected": {"unchanged_roles": ["ball_1", "camera", "lights"]},
      "evidence_required": ["code_diff", "native_state"]
    }
  ],
  "visual_rubric_ref": "rubrics/local_edit_v2.json",
  "calibration": {
    "known_good_refs": ["good_a", "good_b"],
    "single_defect_mutant_refs": ["mut_reverse", "mut_preserve"],
    "reasonable_alternative_refs": ["alt_easing", "alt_structure"],
    "healthy_control_refs": ["healthy_basic"]
  },
  "known_limitations": ["只检查指定时间窗，不证明所有连续时刻"]
}
```

### 8.3 run schema

```json
{
  "schema_version": "1.0",
  "run_id": "run_01J...",
  "experiment_id": "exp_v1",
  "case_id": "fam07_case03",
  "case_sha256": "...",
  "family_id": "fam07",
  "trial_index": 2,
  "block_id": "fam07_case03_trial2",
  "system": {
    "logical_arm": "student_arm",
    "recipe_label": "mixed_sft",
    "model_id": "...",
    "model_snapshot": "...",
    "harness_version": "...",
    "system_prompt_sha256": "...",
    "decoding": {"temperature": 0.7, "other": "..."}
  },
  "tool_manifest_sha256": "...",
  "environment_sha256": "...",
  "seed": {"value": 20261122, "supported_by_endpoint": true},
  "budget": {
    "max_assistant_turns": 12,
    "max_tool_calls": 40,
    "max_browser_seconds": 180,
    "max_wall_seconds": 900,
    "max_output_tokens": 16000
  },
  "usage": {
    "assistant_turns": 0,
    "tool_calls": 0,
    "input_tokens": 0,
    "output_tokens": 0,
    "cached_tokens": 0,
    "gpu_seconds": null,
    "wall_seconds": 0,
    "cost_usd": null
  },
  "status": "scheduled",
  "failure_class": null,
  "retry": {
    "is_replacement": false,
    "original_run_id": null,
    "reason_class": null,
    "approved_by": null
  },
  "started_at": "...",
  "ended_at": "...",
  "artifacts": [
    {"role": "html", "path": "artifacts/index.html", "sha256": "..."},
    {"role": "source", "path": "artifacts/src/", "manifest_sha256": "..."}
  ],
  "evidence": {
    "transcript": "transcript.jsonl",
    "console": "evidence/console.jsonl",
    "network": "evidence/network.jsonl",
    "video": "evidence/replay.mp4",
    "states": "evidence/states.jsonl",
    "replay_run_id": null
  },
  "agent_self_review": {"present": false, "content_ref": null},
  "infra_incident": {"code": null, "healthy_control_failed": false, "detail_ref": null}
}
```

`status` 的受控词表建议为：`scheduled`、`running`、`completed`、`not_delivered`、`agent_error`、`budget_exceeded`、`infra_error`、`cancelled`。最终是否成功只能由 scorecard 给出，不能由 Agent 或 run 状态直接推断。

### 8.4 scorecard schema

```json
{
  "schema_version": "1.0",
  "run_id": "run_01J...",
  "case_id": "fam07_case03",
  "checker_version": "checker_1.3",
  "contract_version": "1.0",
  "scored_at": "...",
  "run_disposition": "valid_agent_attempt",
  "hard_gates": {
    "delivery_integrity": "pass",
    "offline_runtime": "pass",
    "required_semantics": "unknown",
    "critical_visual_readability": "not_scored",
    "special_behavior": "not_applicable"
  },
  "assertions": [
    {
      "assertion_id": "target_second_ball_path",
      "required": true,
      "outcome": "unknown",
      "score": null,
      "evidence_refs": ["evidence/states.jsonl#s120", "evidence/replay.mp4#t=4.0"],
      "reason": "状态接口缺失，待独立轨迹测量",
      "grader": "state_probe_v3"
    }
  ],
  "diagnostics": {
    "semantic_components": {"events": 0.75, "timing": 0.5, "preservation": 1.0},
    "agent_behavior": {"viewed_own_render": true, "repair_cycles": 2, "prohibited_actions": 0},
    "technical_visual_defects": []
  },
  "verified_success": false,
  "unknown_requires_review": true,
  "review_status": "pending",
  "visual_review_refs": [],
  "scoring_errors": [],
  "notes": "unknown 不计为成功；禁止仅报告可判定通过率作为主分"
}
```

汇总 `summary.json` 另含：`N_families`、`N_cases`、`N_scheduled`、`N_valid_agent_attempts`、`N_scored`、`N_infra`、`N_not_delivered`、`N_unknown`、`N_expected_abstention`、`R_planned`、宏平均、case 加权敏感性、infra 敏感性、配对差、bootstrap seed、区间方法和多重性校正。

### 8.5 视觉评审 schema

```json
{
  "schema_version": "1.0",
  "review_id": "review_01J...",
  "blind_session_id": "blind_07",
  "reviewer_alias": "rater_03",
  "reviewer_role": "independent_human",
  "pair_id": "pair_fam07_case03_trial2",
  "randomization": {"seed": 42, "left_system_alias": "A", "right_system_alias": "B"},
  "display": {"fps": 30, "width": 960, "height": 540, "playback_speed": 1.0},
  "criteria": {
    "required_motion_visible": {"outcome": "pass", "evidence_time_s": [1.8, 3.9]},
    "object_identity": {"outcome": "pass"},
    "temporal_continuity": {"outcome": "unknown", "reason": "关键转场被裁切"},
    "technical_defects": {"outcome": "fail", "tags": ["camera_clipping"]},
    "aesthetic_preference": {"choice": "left", "scale": "pairwise"}
  },
  "overall_choice": "unknown",
  "confidence_0_to_3": 1,
  "freeform_defect": "第二个球在约 4 秒处离开画面，无法判断后续轨迹",
  "seconds_spent": 38,
  "conflict_of_interest": false,
  "adjudication": {"required": true, "status": "pending", "final_choice": null},
  "unblinded_at": null,
  "rubric_version": "visual_v2"
}
```

左右映射在评审完成前只由盲评服务保存；导出给分析人员的 `A/B` 与真实 system 的映射应分开封存。VLM 评审也使用相同字段，另加 `judge_model_snapshot`、`prompt_sha256`、`raw_response_ref` 和 `judge_trial_index`。

## 9. 从现在到首轮 SFT 的最小可执行体系与阶段门

### 9.1 最小工作包

【项目建议】首轮前只需先完成以下六个工作包，不必先追求庞大自动化平台：

1. **评估宪章**：主估计量、题簇宏平均、硬门槛、分母、retry、主比较、区间和停止规则，一页到数页即可。
2. **冻结环境与证据链**：离线 Three.js 包、固定浏览器、干净容器、独立重放、console/network/state/video 全留档。
3. **dev 题包与校准包**：6 簇×2 case；每类关键断言至少一个好版、定向坏版、合理替代版和健康控制。
4. **谱系与封存**：train/dev/test 分组 manifest、源码/资产/任务/轨迹 lineage、public/private 分离、test 访问控制。
5. **统一 schema 与基线 pilot**：native27B 在 dev R=3，通用代码保持基线；记录波动、ICC、infra 率、成本和困难切片依据。
6. **盲评最小流程**：成对随机、tie/unknown、双评审、adjudication、评审版本和原始时间点证据。

不要求在首轮 SFT 前运行完整 Kimi 收费测试；但 Kimi adapter 的输入、工具和预算差异必须先由小规模技术 smoke 明确，不能在正式实验时才发现不可比。

### 9.2 阶段 A：采集 Agent 轨迹前

| 项目 | 放行条件 | 立即停止条件 |
| --- | --- | --- |
| 题面与契约 | 每题可解；所需输入明确；required 与辅助项分开；缺输入和健康控制有适用性定义 | 已知好版无法通过；隐藏要求无法从题面合理推断；契约与题面冲突 |
| 检查器 | critical 变异族均被目标检查捕获；冻结替代实现不误拒；健康控制无误报；critical unknown=0 | 任一关键漏检、替代误拒、unknown 被当 pass、重复评分不稳定且原因未解 |
| 环境 | 离线新 profile 可重放；console/network/state/video 完整；健康控制连续通过 | 外网依赖、共享缓存串题、WebGL/浏览器健康控制失败 |
| 数据谱系 | train/dev/test 在扩展前分组；新增轨迹只使用 train 组；许可记录齐全 | dev/test 或其输出进入训练；未解决近重复；资产来源或许可不明且无法替换 |
| 产物 | case/run/scorecard/visual review schema 通过实例校验；public 不含隐藏答案 | 任何 test contract、标签或评审映射可从 Agent 工作区读取 |

采集被停止后，只修复题包、检查器或环境，不用“先收一些轨迹再说”绕过。恢复时必须重跑全部冻结校准，而非只跑刚修好的那个检查。

### 9.3 阶段 B：首轮 SFT 前

| 项目 | 放行条件 | 立即停止条件 |
| --- | --- | --- |
| 基线 | native27B dev R=3 与通用代码基线完成；每 run 有完整证据；记录题簇差与同题方差 | 基线无法区分执行失败与语义失败；大量 run 缺证据；困难切片由 test 事后定义 |
| 数据卫生 | 10,697 train/812 validation 的谱系审计完成，且与新 dev/test 无未解决重叠 | validation/test 实际来自同一源码、资产或 base artifact 谱系且未重新分组 |
| 基础设施 | 建议未解决 infra slot 低于 scheduled 的 5%，且无集中打击特定题簇的系统性故障 | infra 超过预设上限、同一健康控制也失败、retry 选择逻辑不透明 |
| 对照协议 | 两种训练安排共用 system 角色和 schema；主比较、预算、观察、retry、Holm 规则冻结 | Kimi 与本地臂的观察或工具不等价却计划写成纯模型比较 |
| test 封存 | test manifest、private contract、分析计划和访问权限冻结 | test 已用于提示/阈值/配方调整，或训练账号可读取 private contract |

【项目建议】dev 基线若接近全成功，应扩充 capability 难度；若接近全失败，应区分题目不可解、接口不适配与真实能力地板。不要为了让分数好看而随意删难题；capability suite 与 regression suite 分开维护。

### 9.4 阶段 C：dev 选型

放行进入最终 test 的最低条件：

- 候选 system、训练产物、解码、harness、工具和观察配置全部冻结；
- dev 上所有候选均按同一 R 和预算运行，没有只给某个候选补跑；
- 主指标、通用代码保持、关键视觉缺陷和成本均达到项目预设门槛；
- 选择规则在看结果前已经记录；若区间显示未分出，可以按预注册的更简单/更便宜规则作**临时选型**，但不得写成统计优胜；
- test 仍未被用于任何选择。

停止或返回补题的信号：

- critical unknown 未清零；
- 候选差异主要发生在少数已知污染题簇；
- 通用代码出现不可接受回归；
- 最高分依赖单个 case、单次幸运 trial、未解决 infra 或 blind 泄漏；
- dev 经多轮反复适配后饱和，继续选型只会过拟合，应换新的 dev，而非转向 test 挑模型。

### 9.5 阶段 D：最终 test

放行条件：

1. 所有系统在相同时间窗、相同 R、相同预算和观察下运行；R=3 或按 pilot 全体统一增至 R=5。
2. 分析脚本、配对 cluster bootstrap、随机种子、Holm 规则、分母和 unknown 政策在 unblind 前冻结。
3. 规则评分后，所有模型归档产物按同一版本做盲视评审；需要重评分时全体重评。
4. 最终报告同时含主结果、区间、逐题证据、infra/unknown 分母、通用代码保持、成本、外部 OOD 和未解决限制。

最终停止规则：

- 评估器校准失败：停止解释模型分，修复后全体重评。
- test 污染或 private contract 泄漏：该 test 对训练声明失效，换新 test；不能只删除一个显眼 case 后照常宣称独立。
- 系统性 infra 故障：暂停整批；健康控制恢复后按预注册槽位补跑。
- 硬 guardrail 回归：不进入“推荐候选”名单，即使主均值更高。
- 区间未分出：按预注册规则保留当前基线或临时选择，不继续反复查看 test 直到出现想要的结果。

## 10. 最重要的风险、证据缺口与待实测未知项

| 优先级 | 风险或未知项 | 当前能说什么 | 下一步实测/核验 |
| --- | --- | --- | --- |
| P0 | 本地项目不可访问 | 无法判断当前 checker 和盲评是否已有某缺陷 | 挂载后按 §4.4 逐条形成带文件行号的缺陷单 |
| P0 | train/dev/test 谱系重叠 | 10,697/812 的数字本身不证明独立 | 全量精确与近重复、资产、base artifact、轨迹查重 |
| P0 | 评估器错误拒绝合理实现 | 参考源码相等不是语义正确 | 至少两个独立合理实现/关键题族，记录 false reject |
| P0 | 评估器错误接受坏实现 | 能运行和首帧正常都可能掩盖动态错误 | 单缺陷变异、成功轨迹抽样审计、反事实干预（适用时） |
| P0 | test 泄漏到训练或调参 | 公开“未见 case ID”不等于未暴露 | 权限、访问日志、canary、训练数据 manifest 交叉审计 |
| P1 | 状态探针被伪造 | 内部 state 与像素可能不一致 | 探针—渲染交叉验证、独立运动跟踪、反伪造变异 |
| P1 | VLM/人类盲评只在排名层一致 | 绝对分和逐 case 判定可能仍不稳定 | 分别报告 Agent/case 层一致率、原始分偏移、位置偏差和 unknown |
| P1 | 题簇数不足 | 12 簇不能支撑所有细分结论 | pilot 估计 σΔ/ICC，按目标 MDE 计算需增加的独立题簇数 |
| P1 | Kimi 与本地臂观察/工具不等价 | 同沙盒不必然同观察或同 Agent 能力 | 序列化输入 diff、图像可接受性矩阵、共同轨道与完整系统轨道 |
| P1 | 同题波动与外部端点漂移 | R=1 无法估计稳定性；同数值 seed 也未必跨端点等价 | R=3 pilot、交错执行、版本记录、必要时 R=5 |
| P1 | “健康控制”定义不一致 | 当前只能给通用设计 | 从 decisions/README 核实术语，再冻结专用断言 |
| P2 | 外部 OOD 实际不外部 | 公共 Three.js/CodePen/Animation2Code 可能与训练同源 | 优先私有新 authored OOD；公开集只作有污染说明的辅助 |
| P2 | 成本比较失真 | token、USD、GPU 秒和延迟不是同一资源 | 分资源报告并做本地 GPU 小时价敏感性，不强造单一成本分 |
| P2 | 评分覆盖率不足 | 未测需求不能默认通过 | 每题维护 `known_limitations` 和未覆盖需求清单，抽查成功 run |

### 10.1 首轮 pilot 必须回答的五个数字

1. 同 case 的 trial 内方差与 pass^2，决定 R=3 是否足够；
2. 题簇内相关/ICC 与配对题簇差 `σΔ`，决定 12 簇的实际 MDE；
3. `N_infra/N_scheduled` 及其题簇集中程度，决定环境是否可信；
4. assertion 的 unknown、变异漏检和替代误拒比例，决定评估器是否可上线；
5. train/dev/test 近重复候选数及人工确认数，决定当前 split 是否可用。

这五个数字比首轮排行榜上的第一名更有决策价值。

## 11. 建议的最终报告口径

【项目建议】最终实验首页只放以下信息，避免“一个大总分”遮蔽证据：

1. 冻结分布：F 个题簇、C 个 case、每 case R 次 trial、系统版本与时间窗；
2. 主指标：各系统题簇宏平均 VerifiedSuccess@1、配对差和 95% 区间；
3. 判定：提升／未分出／出现回归，以及通用代码保持是否越过预设界限；
4. 可靠性：pass^2/pass^3 与 infra、unknown、未交付分母；
5. 关键失败：按语义、视觉、Agent 行为和成本分解的逐案证据；
6. 外部 OOD：只作预注册的辅助验证，附污染与覆盖限制；
7. 结论边界：不能区分的对比、未测需求、评估器已知盲区和不得外推的范围。

一句话实施原则：**先证明题目和评估器可信，再用同题族配对证据比较系统；先保证每次交付真正满足需求，再讨论美学、成本和排行榜。**

## 12. 来源与定位

以下来源均在 2026-11-22 访问。论文版本以链接所示为准；预印本结果不视为独立复现结论。

### [S1] OpenAI：SWE-bench Verified 初始构建

- 标题：*Introducing SWE-bench Verified*
- URL：https://openai.com/index/introducing-swe-bench-verified/
- 定位：`Our Approach`、`Dataset construction`、`Performance on SWE-bench Verified`。
- 用途：人工筛选、三人标注、500 题、fail-to-pass/pass-to-pass 的初始设计及其历史背景。

### [S2] OpenAI：Verified 后续质量与污染审计

- 标题：*Why we no longer evaluate SWE-bench Verified*
- URL：https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/
- 定位：`Too narrow and too wide tests`、`Contamination`、`Discussion`。
- 用途：138 个困难受审题的分母、过窄/过宽测试、污染诱发与公共题集风险。

### [S3] OpenAI：SWE-bench Pro 数据点审计

- 标题：*Separating signal from noise in coding evaluations*
- URL：https://openai.com/index/separating-signal-from-noise-coding-evaluations/
- 定位：`Methodology`、`Human-supervised agent review`、`Human annotation campaign`、`Discussion`。
- 用途：过严、欠规格、低覆盖和误导四类问题；成功与失败轨迹都需审计；后续推荐也可被新证据撤回。

### [S4] Anthropic：Agent eval 指南

- 标题：*Demystifying evals for AI agents*
- URL：https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- 定位：`The structure of an evaluation`、`Types of graders for agents`、`Capability vs. regression evals`、`How to think about non-determinism`、`Going from zero to one` 的 Step 4–5。
- 用途：task/trial/outcome/harness 定义、干净隔离、判官校准、pass@k/pass^k、结果优先于固定工具路径。

### [S5] WorldCoder-Bench 论文

- 标题：*WorldCoder-Bench: Benchmarking Physically Grounded 3D World Synthesis*
- URL：https://arxiv.org/html/2606.01869v2
- 定位：§2.2 `Data Curation`、§2.3 `Dataset Composition and Splits`、§3.2 `Mutation-Hardened Contracts`、§3.3 `Execution Protocol`、§3.4 `Metrics`、Table 2。
- 用途：StateProbe、隐藏行为契约、变异准入、鲁棒扰动、行为覆盖与成本效用。

### [S6] WorldCoder-Bench 官方仓库 README

- 标题：*shuolucs/WorldCoder-Bench — README*
- URL：https://github.com/shuolucs/WorldCoder-Bench
- 定位：`Data availability`、`Release scope`。
- 用途：当前公开 205 core tasks，以及“该 GitHub 页面不提供评估实现”的证据边界；不是证明其他渠道绝不存在实现。

### [S7] VibePrevisBench 论文与原始评分代码

- 标题：*VibePrevisBench: Evaluating Agentic Coding for 4D Scene Generation in Blender*
- 论文 URL：https://arxiv.org/html/2611.15789v1
- 仓库 URL：https://github.com/vibeprevisbench/vibeprevisbench
- 代码定位：`scorer/score.py`，尤其是未评分/失败行保留、失败原因汇总和 engineering error 非零退出。
- 论文定位：§3.2 `Rule-based Scene Check and VLM-based Screen Check`、§B.4 `Is the evaluation trustworthy?`、Table 4。
- 用途：交付重放、场景事实/可见性双检、变异校准、排名相关与单 run/绝对分的区别。

### [S8] PhysCodeGym 论文

- 标题：*PhysCodeGym: Benchmarking Coding Agents for Physically Verifiable 4D Reconstruction*
- URL：https://arxiv.org/html/2610.17288v1
- 定位：§3.1 `Dataset`、§3.2 `Task Definition`、§4.1 `Setup`、§4.3 `Evaluation`、Appendix B。
- 用途：六分量、无有效交付记零、Agent/infra 错误、反事实物理干预及其适用边界。

### [S9] PhysCodeGym 原始仓库

- 标题：*ShaoShuai0605/PhysCodeGym*
- URL：https://github.com/ShaoShuai0605/PhysCodeGym
- 代码定位：`docs/evaluation.md`、`experiment/verifier/causal_metrics.py`、`experiment/causal_bench/suite_judge.py`、`physcodegym/metrics.py`、`rubrics/counterfactual/`。
- 用途：确认反事实探针、逐案协议、失败/unknown 输出与运动/视觉指标的实际文件存在；本次未执行完整评分链。

### [S10] Animation2Code 论文与项目页

- 标题：*Animation2Code: Evaluating Temporal Visual Reasoning in Video-to-Code Generation*
- 论文 URL：https://arxiv.org/html/2606.28593v1
- 项目 URL：https://anya-ji.github.io/animation2code-website/
- 定位：§3 `Evaluating De-Rendering`、§3.1 `Validating Metrics`、Table 4、Appendix H `Human Annotation Design`。
- 用途：外观/时间分离、轨迹指标、600 个成对比较、65 名标注者、3–4 人重复标注和标注者一致性。

### [S11] 3DCodeVerse 论文与原始仓库

- 标题：*3DCodeVerse: Exploring 3D Worlds as Code*
- 论文 URL：https://arxiv.org/html/2610.22341v1
- 仓库 URL：https://github.com/gaoypeng/3dcodeverse
- 论文定位：§3 `3DCodeVerse-2M`、§4 `Harness`、§5.1、§5.2 `Table 2`。
- 代码定位：`eval/llm/executors/threejs.py`、`eval/llm/docs/metrics.md`、`harness/codeverse3d/spatial/`。
- 用途：执行/空间/视觉反馈的组合、数据来源交叉污染风险，以及“执行率不是语义成功率”的直接例证。

### [S12] τ-bench 论文与原始仓库

- 标题：*τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains*
- 论文 URL：https://arxiv.org/abs/2406.12045
- 仓库 URL：https://github.com/sierra-research/tau-bench
- 定位：摘要及 `pass^k` 相关定义与实验。
- 用途：最终环境状态优于自我报告，重复 trial 的可靠性定义。

### [S13] Miller：语言模型评估统计

- 标题：*Adding Error Bars to Evals: A Statistical Approach to Language Model Evaluations*
- URL：https://arxiv.org/html/2411.00640
- 定位：§2.2 `Clustered questions`、§3.1 `Resampling`、§4.2 `Paired analysis`、Appendix B/C 的 sample-size 与 cluster-adjusted 公式。
- 用途：题簇聚类、同题配对、重复采样只能降低条件方差、事前 MDE/power。

### [S14] LiveCodeBench 论文

- 标题：*LiveCodeBench: Holistic and Contamination Free Evaluation of Large Language Models for Code*
- URL：https://arxiv.org/html/2403.07974
- 定位：§5.1 `Avoiding Contamination`、§6.3 `Contamination`。
- 用途：时间窗降低污染风险的做法及其证据边界；不把“contamination free”标题当作所有新模型上的绝对保证。
