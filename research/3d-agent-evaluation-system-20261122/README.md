# 3D Animation Agent 评估体系：多方联合调研汇总

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

2026-11-22。主调研方先独立完成[主报告](main-report.md)，随后读取 [Astra 独立报告](astra-report.md)形成双方汇总；再纳入用户提供的[第三方独立报告](external-report.md)、[第二份外部独立报告](external-report-2.md)及 [Opus 独立审查](opus-report.md)，形成当前多方版本。研究范围见 research-brief.md（本地附件未发布），其他 AI 可复用独立调研提示词（本地附件未发布）。

> **Opus 审查后的最新修订。** 先做 T0 题目有效性审计，再校准 checker；健康控制和缺输入阻断移出 Accepted 主指标；test 冻结前不跑任何系统；主区间改为题族配对 t 区间或符号翻转区间。详见 §2C 和[证据复核与最终取舍](opus-synthesis.md)。前文的形成过程与分歧仍保留，冲突时以这些最新修订为准。

## 1. 结论速览

**建议建立“题目有效性审计 + 独立测量 + 题族谱系 + 分层验收 + 配对统计”的体系。先证明题目和评估器可信，再让教师轨迹进入训练，最后比较模型。**

应交付的生成、真实缺陷修复和局部编辑任务使用：

```text
Accepted = 正式交付且可独立重建
         ∧ 全部必要动画语义通过
         ∧ 修复/编辑的非目标状态保持
         ∧ 关键画面达到最低可读性
```

- **主指标 `Accepted@1`**：单次自主运行满足以上全部条件的比例。均衡设计下 family 宏平均和 case 微平均数值相等；真正固定的是 family 聚类推断，以及 unknown/infra/适用性造成不均衡时的权重。
- **健康控制与缺输入阻断单列护栏。** 修复敏感性与无误改特异性、正确阻断率与可完成题误阻断率分别配对报告，不能让“原样交付”在修复族中固定送分。
- **先审计题目，再校准评估器。** 题面对象、缺陷、公开 observation schema 和未编辑状态都要成立；good/mutant/alternative/healthy 包还需包含伪造状态变异。
- **需求必须被测量。** 每条 brief 要求对应断言和证据，或显式 `not_measured`；必要项未测时 Functional 不得通过，unknown 不能算成功。
- **dev 与 test 使用一致的验收目标。** `Functional@1` 可作快速诊断，但 dev 选型也要完成最低可视质量 `V_min`。
- **test 冻结前不跑任何系统。** native 在 dev/pilot 上估计难度和方差，冻结后与学生交错执行；难度不能来自最终比较那次运行。
- **小样本只做谨慎的题族配对结论。** 50% 成功率若只有 12 个独立单元，Wilson 95% 区间约为 **25.4%–74.6%**，不能拿 48 case 或 144 trial 当独立题数；最终应给 family 配对区间。
- **全集 R=1 起步，不默认设重复子面板。** dev R=3 分解方差；只有 trial 内方差占主导时才在 test 冻结前统一改为 R=3。不得因 test 临界而追加。
- **系统与资源口径仍须记录。** 首轮只做共享条件的受控比较，Kimi 是同协议参照；记录并发、CPU/RAM/GPU、浏览器与负载，首轮不做资源矩阵和优化系统第二张表。

本报告不修改训练配方、项目代码或项目生效决定。它兼容原生 27B 对单混合学生，以及原生 27B、one-shot、多轮学生与 Kimi 的对照。

## 2. 前两方共识、分歧与最终取舍

### 2.1 一致结论

前两方独立得到以下判断：

1. **先校准题目和检查器。** 好版通过、坏版拒绝、合理替代实现不被误杀；健康控制允许“检查后无需修改”。
2. **端到端必要项联合通过，而非平均分。** 可运行不能抵消动作错误，世界状态正确不能抵消镜头没拍到。
3. **真实执行和独立视觉都需要。** 状态接口可以辅助定位，但作者自报的 `stable/supported/camera_margin` 不能自动充当独立真值。
4. **修复/编辑必须测非目标保持。** 单纯保留“物体存在、正在动”远远不够。
5. **按题族隔离并做配对比较。** 同一模型各次重试、同一原始场景的派生题都不是独立泛化证据。
6. **简单代码、健康控制和正确阻断必须保留。** 困难题提升不能掩盖基础能力回归。
7. **首轮无需复杂评审平台。** 先统一 manifest、计划 trial、run、scorecard、视觉评审与汇总表，复用现有构建、浏览器和 metrics 能力。

### 2.2 差异与最终选择

| 问题 | 主报告原建议 | Astra 补充/差异 | 汇总取舍 |
|---|---|---|---|
| 聚合权重 | case 等权为主，family 宏平均另报 | family 等权为主，case/trial 分层 | **采纳 family 宏平均为主、case 微平均并列**，更贴合“对新题族泛化”的目标 |
| unknown | 不算通过；最终评审未完成则 pending | 报 `S/N` 及 `[S/N,(S+U)/N]` 的可识别范围 | **采纳区间与全计划 trial 台账**；未知足以翻转选择时结论为“未决”，不得放行成功 |
| trial 成本 | 预算允许时每题 3 次；48×3×4=576 次 | 全集首次通过为主，固定子面板重复 | **经 Opus 审查后改为全集 R=1、不默认重复子面板**；仅 dev 显示 trial 内方差占主导时，在 test 冻结前统一改为 R=3 |
| 提前跑 test | 冻结后统一揭盲 | 若提前跑原生，逐题结果由评测侧封存 | **经 Opus 审查后改为冻结前不跑任何系统**；已有运行只作诊断，最终 native 在冻结后与学生交错重跑 |
| 家族识别 | 统一 `family_id` 与来源 | 同源关系应做连通分量，不能信标签名 | **采纳连通分量与人工复核**；例如 `watermill-v1` 与 `watermill-edit-v1` 可能同源 |
| 代码保持 | 原 812 validation 做独立执行/语义回归 | 另列 teacher-forced loss 与监督 token 分母 | **补为训练诊断，不当作任务成功**；执行和语义证据优先 |
| 视觉协议 | 匿名、随机左右、连续片、最低可读性 | 增加 A/A 同片校准、位置交换、无法判断 | **全部采纳**；历史 Neon Street 不是匿名盲评，不能当模型胜率 |

这些取舍没有回改任何一方的独立报告。

## 2A. 第三方独立报告带来的补充与三方取舍

用户随后提供了[第三方独立报告](external-report.md)。该报告明确无法访问本地项目，因此其本地漏洞均为 `[U]` 待核验项，不能覆盖前两方已经完成的源码和原始预检复核。三方在分层门槛、评估器校准、题族隔离、paired family 区间、简单/困难双轨和全计划分母上方向一致。

### 2A.1 采纳的新增设计

1. **把受控比较与优化系统比较分成两张表。** 主表固定同一 harness、工具、观察和预算，回答“相同系统条件下谁更好”；可选第二张表允许 Kimi 或其他系统采用各自优化的 harness，回答“各自合理优化后的系统表现”。后者不能将差异全归因于模型权重或 SFT。这与 [OpenAI 第三方可信评估指南](https://openai.com/index/trustworthy-third-party-evaluations-foundations/)对 controlled comparison 与 strong elicitation 的区分一致。
2. **把资源配置写进预算向量。** 除 token/时间/工具上限外，还记录 assistant 回合、渲染/图片观察次数、CPU、RAM、GPU、浏览器资源保障值与硬终止上限，以及实际超限原因。不能认为相同 token 就代表相同算力或等价视觉输入。
3. **资源下限与硬上限需要校准。** [Anthropic 的基础设施噪声实验](https://www.anthropic.com/research/infrastructure-noise)在 Terminal-Bench 2.0 上固定模型、harness 和题目，严格 1x 到 uncapped 的总成功率相差 **6 个百分点（p<0.01）**，infra error 从 **5.8% 降至 0.5%**。在其设置里，约 3x headroom 将 infra error 降至 2.1%，而 1x–3x 的成绩变化处于噪声范围。迁移到本项目应测量渲染和浏览器在哪段资源区间稳定，**不能照搬 3x 或把 uncapped 当公平基线**。
4. **外部 OOD 至少分两条轴。** 新源码/作者/资产来源与新行为/任务族分开；浏览器/GPU 变化是环境鲁棒性第三条轴，不等同语义泛化。外部结果仍按原生协议单列。
5. **补齐异常与封存字段。** `planned_trial_id`、`required_missing_assets`、`expected_agent_action`、`not_run`、`negative_requirements`、`acceptable_alternatives` 值得加入 manifest。故意缺输入与 fixture 损坏必须可区分；未训练的实验臂标 `not_run`，不能记为 0 分。
6. **重放不等于模型再试一次。** 评估器对同一冻结产物重放，不会给模型新增动作；模型 trial 因 infra 失败需要替换时，沿用预登记的相同配置和 retry 政策，保留所有原始记录，不能给某个模型额外择优机会。
7. **多重比较需要预注册层级。** 原生 vs 选定学生是主要比较，one-shot vs 多轮按实际实验问题另列；类型/难度切片主要用于诊断。若把多个比较都作为正式主假设，应在协议中预先采用 Holm 或层级检验，而不是跑完所有格子后挑最显著的结果。

### 2A.2 校准与统计补充

- **按 family 做符号翻转只作敏感性分析。** 在明确的交换性零假设下，12 个 family 有 `2^12=4096` 种符号翻转；它与 paired cluster bootstrap、留一 family、原始差异向量互补。小样本且假设存疑时标为探索性，不把它包装成普遍泛化证明。
- **视觉/自动裁判需要 case-level 混淆矩阵。** 在 good、mutant、alternative、healthy、难判样本上分别记录 TP/FP/FN/TN、各类分母、Wilson 区间和冲突实例。人为平衡或富集的校准集可以测故障检出，**其误报率不能直接当作真实任务分布上的误报率**；线上误报还需按真实 prevalence 估计。
- **首轮 4 个代表题族只是最小启动，不是覆盖充分。** 可将 10–15 个不同失效机制作为后续校准扩展目标；第三方提出的 40–60 个视觉标定片段也只是工作量建议，不是精度保证。优先级仍由当前模型真实失败和 checker 风险决定。
- **单例关键失败与总体回归分开。** 对健康控制、正确阻断或禁止修改的预注册关键条件，一个失败足以触发调查和停止放行，但不能据单例宣称整体负效应；总体提升/回归仍看配对分布与区间。

### 2A.3 不直接采纳为既定规则的建议

| 第三方建议 | 三方汇总取舍 |
|---|---|
| 主指标按 case 宏平均 | 保留 **family 宏平均为主、case 微平均并列**。研究目标是新题族泛化，置信区间也按 family 聚类；不因第三方建议改变主口径 |
| Agent 纪律作为统一硬层 | 只把**题面公开要求、证据诚信、禁止修改、正确阻断**等必要行为设为门槛；固定工具次数、看图次数或规定路径不成为普遍门槛，其余过程指标用于诊断 |
| `δ_min=+10pp`、简单能力非劣界 `-5pp` | 是第三方 `[P]` 项目建议，不是公开研究结论。可作为协议讨论候选，但必须在查看最终 test 前根据 dev 波动和业务容忍度冻结；本报告不替用户定阈值 |
| infra >2% 或 scorer unknown >5% 停止排名 | 同样不是通用阈值。采用更直接的规则：**unknown 的上下界若足以翻转选择，或同一 infra 问题破坏可比性，就停止主排名**；百分比若使用需事先登记 |
| 首轮固定更多校准/回归样本数 | 数量随失效机制与实测方差扩展，不能为了凑数重复同源 case。最小启动保持 4 个代表题族，随后按覆盖缺口增加 |

### 2A.4 新证据核验与一处数字差异

- 第三方引用的 VibePrevisBench 单 run Spearman 为 **0.73–0.79**。本次回查[v1](https://arxiv.org/html/2611.15789v1)和[当前 v2](https://arxiv.org/html/2611.15789)的附录 B.4，原文均为 **0.73–0.76**，agent 平均层级为 0.94–0.96。汇总采用 **0.73–0.76**；它支持的结论不变：**跨模型均值相关较高，不代表单个视频评分足够可靠**。
- WorldCoder 的[官方项目仓库](https://github.com/shuolucs/WorldCoder-Bench)明确：当前公开数据是 **205 个 core tasks 和 74 个 shared GLB**，不是完整 2,026 题；仓库是数据入口，**没有提供论文 StateProbe 的实现**。因此可借用公开任务和论文方法，但不能宣称已复现其隐藏评分协议。
- 第三方对 3DCodeVerse 的 **51.9%→92.9%** 指的是 27B 在 **3DCodeBench 212 题**上的执行率，与三方汇总中的 **Three.js 40 题 29/40→37/40** 是不同分母，不冲突。
- 第三方无法访问本地项目的限制保持为其报告事实；前两方对本地 checker、12 个 train 题、8 个 fixture 预检和历史验证的核验，才是本汇总中项目现状的依据。

## 2B. 第二份外部报告的补充与校对

用户另提供了[第二份外部独立报告](external-report-2.md)，完整研读与校对见[专题记录](external-report-2-review.md)。它同样无法访问本地项目，但其设计与前述主方向一致，并带来四项实质补充：

1. **校准集拆成设计集与冻结验收集**，避免用反复调参的同一批 mutant 证明 checker 有效。
2. **引入事前 MDE/power 估算**。依据 [Miller 的统计报告](https://arxiv.org/html/2411.00640)，若配对题簇差标准差为 `σΔ`，近似 `MDE=(z0.975+z0.80)σΔ/√F`。F=12 时，σΔ=.10/.20/.30 分别约为 **8.1/16.2/24.3 个百分点**；这是规划近似，必须用 dev 实测方差，不能当成项目提升阈值。
3. **通用代码保持增加非 Three.js 套件**。原 812 validation 测领域代码保持，另用无动画专用工具的简短 JavaScript 生成/修复测通用能力遗忘。
4. **明确两个学生臂的主比较族**。one-shot vs native 与 multi-turn vs native 预注册 Holm；one-shot vs multi-turn 是次要配方比较，Kimi 仅作系统参照。

同时作两项重要澄清：

- **Agent 行为健康控制**按项目现有计划是“初始 fixture 合格，检查后保持并交付，不能误改”；它与**评估器健康控制**（健康产物不误报）是两个有效但不同的概念。暂停/频闪/降低动态效果另属交互、可访问性或资源健康任务。
- 最终 R 必须在 dev 后、test 揭盲前冻结。**看到 test 接近决策边界后不能追加到 R=5 继续找显著性**，应报未分出或另做封存确认实验。第二份报告把 R=3 作为最终最低配置的建议未被直接采纳。

我校对时另发现[主报告](main-report.md)曾把 dev 误写为 24 case/72 trial，已明确修正为 **12 case/36 trial**。

## 2C. Opus 独立审查带来的实质修订

[Opus 完整审查](opus-report.md)已验收：`is_error=false`、`modelUsage=claude-opus-5-5`，本次未触发上游风控。[主调研方复核与最终取舍](opus-synthesis.md)进一步核对了本地证据和统计，主要修订如下：

1. **题目有效性先于 checker。** 8 个起始 fixture 中，摩天轮存在真实漏检；机械臂、火箭和传送带存在题面/fixture 结构问题；水车容差不清；太阳能缺少题面已公开的 `panel_count` 且材质目标未测。不能将 5/8 起始通过简单解释为 5 个假阳性。
2. **当前 320 个新 train case 的 1,312 条断言全部引用自报 `s.*`。** 64 个 case 的 128 条断言在采样时刻不匹配时直接 `return true`；公开 prompt 还包含采样表达式。它们可作训练反馈，但不能当独立隐藏验收。960 是计划运行量，不是合格轨迹数。
3. **健康控制和缺输入阻断移出主指标。** 避免无操作策略在修复族中固定获得 1/4 分数；健康 fixture 仍需独立验收。
4. **需求覆盖矩阵成为必要条件。** 未测不能默认为通过；伪造状态变异必须让 checker 拒绝。
5. **谱系区分泄漏边与分类标签。** 全部 lineage 标签直接连通确实会得到 1 个分量，但机制/协议标签不应把所有题合并。还要检查一个 fixture 是否是另一题的答案。
6. **test 在冻结前不跑任何系统。** 提前运行不能作为最终 native 对照；难度和最终 trial 政策只能来自 dev/pilot。
7. **统计收紧。** family 配对 t 区间或符号翻转为主，bootstrap/留一族为敏感性；48 case 普通 McNemar 不再作推断。MDE 使用 t/非中心 t 和 dev 实测方差，不用正态近似的小数精度掩盖模型假设。
8. **首轮进一步简化。** 全集 R=1、不默认重复子面板；dev 上 native 与现有 Aodi one-shot 各 R=3 估计方差；开放审美、LLM 裁判、优化系统表、资源矩阵和外部 OOD 后延。

Opus 对公开论文的在线访问受限，但其关键本地判断已由主调研方复核。320 题和 960 trials 的结构问题不能直接换算成坏题率或错误正例数，具体产物仍需重新验收。

## 3. 为什么现在不能只用现有 `check_ok`

当前 12 个 collection 题（本地附件未发布）全部标为 `split: train`，应服务采集，不是隐藏 test。对其中 8 个修复/编辑起始 fixture 的原始预检（本地附件未发布）为：

- 5/8 在目标尚未被有效验证时通过：摩天轮接缝、机械臂接触、火箭取景、水车镜头、传送带臂方向。
- 3/8 被拒：暂停、点火、太阳能材质。不能据此宣称这些目标缺陷均被正确检出；点火只读 `ignition_time`，材质检查的是 `panel_count`，而 fixture 缺该字段。

这里的 5/8 是**原始起始 fixture 的 `check_ok` 计数，不是 5 个已证实的检查器假阳性**。例如火箭题面称已裁切，但既有实测发现初始投影未出画，说明负例本身不成立；其他题也要先确认缺陷确实存在。这是**这批题包的评估器与 fixture 校准证据，不是全数据集的缺陷率，也不是模型失败率**。

具体改造：

| 题 | 现有信号容易漏什么 | 必需新证据 |
|---|---|---|
| 摩天轮接缝 | 首末像素一致、角度非零，仍可能在接缝前停顿 | 实际轮轴姿态在接缝两侧的位移和单侧速度；座舱/周期保持；可见轮缘或吊舱交叉检查 |
| 机械臂接触 | 臂在动但抓取时穿透、包裹不随动 | 接触窗口实际世界坐标、距离、随动起点和释放；像素可见接触；允许不同关节解 |
| 火箭取景 | 火箭确实上升，但末段出画 | 实际相机投影、安全边距、遮挡和连续关键窗口；原运动轨迹保持 |
| 点火局部编辑 | 只把字段 4 改成 3，实际火焰/运动未正确变化 | `3−ε,3,3+ε` 的可见火焰和相对点火时序；先澄清绝对时刻还是相对轨迹保持 |
| 材质局部编辑 | 数量或字段正确，目标颜色没变 | 实际材质/目标区域颜色及非目标状态；不强求整图逐像素一致。`panel_count` 已由题面公开要求，缺失说明 fixture 契约不完整，不是隐藏测试误杀 |
| 暂停/恢复 | 只修 `renderAt`，真实播放仍绘制或恢复从头开始 | 真实点击后的时间、像素、draw（题面要求时）及恢复连续性；操作前后模式与镜头绑定 |

现有 check_claude_case.mjs（本地附件未发布） 的采样与状态表达式可保留为辅助，但必要测量应来自真实对象/矩阵/材质/时钟/像素/交互。公开的 observation schema 可以保留；隐藏测试不能要求题面未公开的内部变量名。

## 4. 评估体系：六层证据、三类轨道

### 4.1 六层证据

| 层 | 主输出 | 关键分母/边界 |
|---|---|---|
| 0 评估器校准 | 好版误拒、坏版漏过、替代版误拒、证据版本一致性 | 按已测断言和控制版本给分子/分母；只证明覆盖过的缺陷 |
| 1 交付 | `Delivered@1` | 全部应交付 trial；源码/HTML/证据哈希、离线重建、真实运行；作者自审另列 |
| 2 语义与保持 | `Functional@1`、定向修复率、non-target preservation | 全部该类 trial；必要项联合，部分断言覆盖仅用于诊断 |
| 3 可视质量 | 最低可读性、连续视频/交互配对偏好 | 最低项进入 Accepted；开放偏好同时报全分配对与双方可评的条件偏好 |
| 4 Agent 过程 | 证据暴露→识别→修复、无依据结论、首个合格版本、盲重试 | 以实际发生机会的 case 为分母；不按工具越多越好 |
| 5 成本与可靠性 | 每次 Accepted 的 token/时间、超时、`pass^3` | 成本包括失败 trial；缺 usage 标 unknown，零成功给总成本和零分母 |

跨场景泛化由独立题族、外部 OOD、真实新任务和环境复测提供，不把“新题族”当单题附加分。

### 4.2 三类运行轨道

| 轨道 | 回答的问题 | 不可混入什么 |
|---|---|---|
| answer-only 代码回归 | 基础代码生成/运行是否保持？812 条原 validation 上有多少可执行覆盖？ | 不与多轮 Agent 通过率、teacher-forced loss 或训练监督 token 合成一个分数；记录数不等于独立题族数 |
| 完整 Agent 主测试 | 学生能否在新场景 family 中生成、修复、编辑并正式交付？ | 原生与学生必须同沙盒、工具、观察、预算、retry 和 grader；Kimi 是参照而非唯一正确解 |
| 外部 OOD | 能否迁移到不同输入、交互、运行时或设备？ | WorldCoder/GameASG、Animation2Code、3DCodeVerse 各按原生口径单列；公开 dev 不称无污染隐藏测试 |

对 answer-only 经 Kimi 运行转换为 Agent 数据的题目，原始记录永久归档，血缘仍属同一 family；同一训练配方默认只选一个主版本。转换轨迹只有在独立验收通过后才替代原训练版本，未转换或失败的题目可按既定配方保留 answer-only，不能因“Kimi 跑过”就自动算正样本。同源的两个版本不得跨 train/dev/test。

### 4.3 `pass / fail / unknown / infra` 的明确规则

所有计划 trial 先登记，避免进程未启动就从分母消失。

- 无正式交付、模型超预算、主动交付坏版：失败；保留 diagnostic candidate 但不计 Accepted。
- 缺少已公开的必要观测接口：候选不满足契约；若接口本身不合理则先修题。
- 人未审片、录像损坏、裁判服务未返回：`unknown`，不能算通过。若有效计划 trial 为 `N`、确认成功 `S`、未知 `U`，报告确认率 `S/N` 与可识别范围 `[S/N,(S+U)/N]`，按相同 family 权重聚合。
- 已确认基础设施故障：原 run 与成本保留，单列 infra 率；仅允许预登记的原配置一次替代运行，禁止反复挑选好结果。
- 题目或 checker 缺陷：标 `invalid_case`，不记模型失败。归档产物可按统一修正版重评分；若已用结果调过模型，再用新封存 family 确认，不能反复在同一 test 上优化。
- 缺输入题单列正确阻断率与可完成题的误阻断率，不把 `D=0` 的应阻断任务硬塞进 Accepted 公式。

## 5. 题集、统计与公平对照

### 5.1 最小题集地图

| 套件 | 用途 | 是否可用于最终能力结论 |
|---|---|---|
| calibration | 好版、单缺陷版、替代实现、健康控制、探针测试 | 否 |
| public regression | 旧六题、历史 Kimi 案例、已反复看过的失败 | 只作开发回归 |
| Agent dev | 6 个新 family × 2 case = 12；选配置和 checkpoint | 可用于开发选型，反复查看后轮换新 family |
| Agent test | 12 个新 family × 4 case = 48；冻结后最终比较 | 只作一次最终选型；看过再调则转 dev |
| answer-only regression | 原 812 validation + 有动态语义的新独立代码题族 | 代码保持单列 |
| external OOD | 外部 benchmark、真实新 brief、跨沙盒/设备 | 外测单列，不与主分合并 |

现有草案的题包条款写 `6×2`、`12×4`，执行顺序又写“6 个 Agent dev、12 个 Agent test”。**开跑前必须冻结逐 case manifest，消除“题簇数”和“case 数”的歧义。**

建议 test 的生成、真实缺陷修复、局部编辑保持均衡，并将健康控制和缺输入阻断作为独立护栏套件，不混入 Accepted 主指标。具体比例不是公开研究给出的最佳配方，须在 test 冻结前根据覆盖缺口确定。

### 5.2 统计口径

经 Opus 审查后，主区间改为**题族配对差的 t 区间**，或在交换性假设成立时的符号翻转区间；paired cluster bootstrap 与逐一删族作为敏感性分析。必须展示每族原始分子/分母和 `d_f` 向量。

- 普通 48-case McNemar 忽略簇内相关，不再作为推断方法；此前的 15:5 与 8:2 仅保留为算术示例。
- 50% 成功率的直观 Wilson 区间若按 12 个独立单元计算约为 **25.4%–74.6%**，不能用 48 case 或 144 trial 冒充独立题数。最终给 family 层配对区间。
- MDE 使用 t/非中心 t 和 dev 实测 `σΔ`。目标 80% power 时，F=12 在 σΔ=.10/.30 下分别约为 **8.887pp/26.660pp**；这是规划计算，不是实测功效。
- 在 Opus 的情景假设 `σΔ=.30` 下，真实提升 10pp/20pp 的非中心 t 检出概率约为 **18.4%/55.8%**。因此首轮更可能只能判断大幅变化或关键回归。
- 只有 native 时可在 `ρ≥0` 下估计 `σΔ²≤σA²+σB²` 的上界；项目已有 Aodi one-shot，应在 dev 上与 native 配对实测，而非依赖该假设。
- dev 可先做 R=3；最终全集先 R=1，不默认重复子面板。只有 trial 内方差占主导时才在 test 冻结前统一改为 R=3。若全量 R=3，48 case × 4 系统是 576 次运行，必须提前计入预算。

详细计算和边界见[Opus 证据复核](opus-synthesis.md)。

### 5.3 模型与训练对照

- 固定 case、初始工作区、工具 schema、系统/Skill、真实图像输入、浏览器、推理档、上下文与压缩、步数/token/墙钟、收尾预算、trial 和 retry。
- 记录实际模型 ID、checkpoint、模板、解码种子、serving、并发和 grader 版本；case/trial 交错运行以减少时间偏差。
- 原生 vs 单混合学生回答“整套 SFT 是否改善端到端交付”，不能分离代码底座和 Agent 数据各自贡献。
- one-shot vs 多轮学生回答“同批教师任务增加过程监督的收益”；两者评测时都使用完整工具与相同迭代预算，并记录实际训练任务、监督 token 和优化步数。
- Kimi 在相同协议下作参照。若教师实际用了学生不可见的图片、子 Agent 或额外预算，单列差异，不将其当学生理论上限。
- 所有原始失败均留档；重试只允许已确认的 infra 条件。`pass@k` 只在部署允许多候选且能独立选版时另报，不能美化单次主结果。

## 6. 视觉评估的最低协议

1. 从冻结的最终 HTML 独立生成完整周期的连续视频；多模式分别录制，交互题执行同一操作脚本。记录逻辑时间、帧数、模式、镜头、视口和哈希。
2. 先均匀覆盖关键时段，再在接缝、接触、切镜、遮挡风险附近加密；有限采样不声称逐帧无错。
3. `V_min` 逐项判断关键主体与事件“没看到/部分看到/清楚看到”，记录时间码；这是最低可用性，不是审美高低。
4. 开放质量采用匿名、随机左右的 A/B/平/无法判断，独立两人起步，冲突复核；同一视频 A/A、显著缺陷对和左右交换用于校准。
5. 同时报全分配对与双方均可评的条件偏好。单方有效交付胜无交付，双方无交付单列；缺票与无法判断不隐藏。
6. LLM 可辅助预筛，但必须先在按题族隔离的人工集上测一致、误报、故障检出和位置偏差；教师或同族模型不能未经校准成为唯一裁判。
7. 不在 SwiftShader 上宣称真实 GPU 帧率，不用静帧推断连续运动，也不把静态页面 FPS 字段当实际性能。

## 7. 最小落地包

沿用现有源码/哈希/浏览器能力，增加以下逻辑产物；详细 JSON 字段见[主报告 §6](main-report.md)：

| 产物 | 最小字段 |
|---|---|
| `case manifest` | `case_id/version, family_id, lineage_ids, split, task_type, difficulty, prompt/fixture/asset hashes, public observation schema, required assertions, invariants, allowed variants, grader_version, controls` |
| `planned_trials` | `planned_trial_id, case_version, arm, trial, seed, budget_version`；所有预期运行先登记 |
| `run record` | `run_id, planned_trial_id, actual model/checkpoint, sandbox/tool/environment hashes, actual observations, candidate/delivery hashes, status/stop_reason, retry_of, usage, wall_seconds` |
| `scorecard` | 每断言 `verdict, measured, expected, tolerance, evidence`；联合 `delivered, functional, preservation, visual_min, accepted, unknown_reason, failure_owner` |
| `visual review` | 匿名对、展示顺序、clip/html hashes、操作脚本、rubric/reviewer、维度票、总体偏好、缺陷时间码、仲裁 |
| `summary` | 按 family/type/difficulty 的分子分母、paired delta、区间、unknown/infra、每次 Accepted 成本、失败案例链接 |

### 分阶段放行与停止

| 阶段 | 放行条件 | 何时停止或标未决 |
|---|---|---|
| 采集前 | 代表题的好/坏/替代/健康包有效；题面、必要 schema、观察和 grader 已冻结 | 坏版全绿、好版/合理替代误拒、缺陷本身不成立、证据版本不符 |
| 训练前 | 只从 train 采教师；最终 `Functional + V_min` 通过；轨迹和真实可见输入可回放；split 无同源冲突 | 跨 split 未解、图片错轮、失败轨迹当正样本、教师靠自审放行；共性问题阻断整批 |
| dev 选型 | 有限候选、主指标、代码/健康非劣界值、预算、trial 和统计均预登记；实测方差后冻结最终规模 | 未知足以翻转排序、一族贡献全部收益、越过保持界值、反复针对题集调参 |
| 最终 test | 冻结唯一候选和全部协议；交付完整主/辅指标、连续片、paired family 区间及失败证据 | 区间跨实用门槛则未分出；污染或共性 checker 错误使相关结果失效，不能用同 test 继续调参 |
| 扩展 | 困难题族、真实用户、外部 OOD、跨环境分别建表，稳定能力转 regression | 外测与主分混合、公开 dev 冒充隐藏、只追容易总分 |

非劣界值和“实际有意义的最小提升”必须在看最终 test 前，根据 dev 波动和业务容忍度确定。本调研不擅自给出通用 5pp/10pp 阈值。

## 8. 一手证据

| 证据 | 对最终方案的贡献 | 适用边界 |
|---|---|---|
| [Anthropic Agent eval 指南](https://www.anthropic.com/research/demystifying-evals-for-ai-agents) | task/trial/grader/transcript/outcome；代码、模型、人类 grader；capability 与 regression；`pass@k/pass^k` | 跨领域方法，无本项目阈值或题量配方 |
| [OpenAI SWE-Bench Pro 审计](https://openai.com/index/separating-signal-from-noise-coding-evaluations/) | 731 题中 agent 路径标 200、人类标 249；过窄、欠指定、低覆盖、误导题面；五人独立审查 | 不能把该约 30% 当成本项目坏题率；说明评估器需持续审计 |
| [OpenAI SWE-bench Verified 初版](https://openai.com/index/introducing-swe-bench-verified/)与[后续停用说明](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/) | FAIL_TO_PASS 与 PASS_TO_PASS；人工筛题；后续对 138 个困难子集发现 59.4% 材料问题并讨论污染 | 500 是筛后规模，138 是特定子集；审计版本和分母不可混用 |
| [Agentic Benchmark Checklist §4](https://arxiv.org/html/2507.02825v3) | task/outcome/reporting 有效性，冻结环境、隔离真值、oracle、非目标状态与统计报告 | 通用检查表，不直接证明动画指标 |
| [WorldCoder-Bench](https://arxiv.org/html/2606.01869v1) | Three.js 运行时契约、mutation 校准、真实交互、参数扰动 | 其 one-shot 覆盖率不能直接代替本项目多轮 Accepted |
| [VibePrevisBench §B.3–B.4](https://arxiv.org/html/2611.15789v1) | 场景事实与屏幕可读性；盲复述；12 个交付故障注入，4 秒延迟降 9.8 而抬高 1 米仅降 0.8；paired bootstrap | Blender 和 GT 不同；注入暴露漏洞，不是本项目容差 |
| [PhysCodeGym](https://arxiv.org/html/2610.17288v1) | 改变接触/支撑/初态检验机制，区分服务和 checker 故障 | 只在任务要求物理机制或输入响应时加干预 |
| [Animation2Code](https://arxiv.org/html/2606.28593) | 外观与运动分开，人评校准；LoRA 后静止输出 4.4%→9.0% | 视频重建不是开放 3D；其公开 test 不宜直接作本项目 Three.js 主测 |
| [3DCodeVerse v1 §5.2 与附录](https://arxiv.org/html/2610.22341v1) | 执行与质量分开；27B 的 40 道 Three.js 从 29/40 到 37/40；匿名配对、交换顺序、执行/条件偏好双分母 | 该行为 SFT+DPO，40 单对象一次 seed 不证明多轮动画收益。Astra 另发现表 2 的 9B SFT 74.5% 与“40 题、单 seed”整数步长不相容，本次已核原表，保留为论文数字清晰度问题而不反推成功数 |
| [τ-bench](https://arxiv.org/html/2406.12045) | 最终环境状态、至少一次与连续可靠性的组合估计 | 用户模拟和数据库任务与本项目不同；`n=3` 只能给粗稳定性 |
| [WorldAuditBench](https://arxiv.org/html/2609.40325v1) | 将异常证据暴露与看见后的识别拆开 | 审计任务不是生成任务，过程指标需从本项目真实轨迹定义 |
| [SWE-bench-Live](https://swe-bench-live.github.io/) | 持续引入新任务，近期提交要求轨迹以检查信息暴露 | 时间更新不自动排除本项目内部同源泄漏 |

前两方证据覆盖不同：主调研方在线核对了上述 OpenAI、Anthropic、Agentic Checklist、WorldCoder、VibePrevis、PhysCodeGym、Animation2Code、3DCodeVerse、τ-bench、WorldAuditBench 等原文；Astra 因网络限制未在线复核其中一部分，独立核验了本地 3DCodeVerse 论文、Animation2Code 作者代码/test、项目原始 JSON 与检查器。Astra 明确保留了证据缺口，汇总没有把它的未核实条目当作独立二次确认。两份外部报告由其各自自述完成公开来源检索；主调研方另核验了其新增 OpenAI/Anthropic 官方证据、WorldCoder 官方仓库、VibePrevis v1/v2、Miller 统计报告、LiveCodeBench 和 Animation2Code 人评协议的关键内容。各方的证据范围均保留，不相互背书未完成的检查。

## 9. 未知项与下一步

仍需实测，不能由本报告代替：

1. answer-only 数据的独立题族数、近重复、动态语义覆盖及与新 dev/test 的重叠。
2. 新 dev/test 的真实 case ID、类型/难度分布、可用预算、跨族独立性和污染检查。
3. 真实对象的测量容差、最低视觉门槛的一致性、合理替代实现覆盖及 LLM 裁判的本项目人机一致性。
4. 原生和学生的 run-to-run 方差、infra 比例、每次 Accepted 成本，及合理的业务非劣界值。
5. 通用 harness 与 Claude Code 轨迹的一条真实适配 canary；本研究没有假定 schema 已实现。
6. 浏览器渲染的 CPU/RAM 资源保障值、硬上限和稳定区间，不能用 Terminal-Bench 的资源倍数代替 Three.js 实测。

建议下一项工程工作只先做 **4 个校准题族 + 统一台账 + 小规模 dev 基线**，用实际结果决定后续评测矩阵；不是立即实现庞大评审系统，也不是先跑全部 200 个训练 case 后再补验收。

## 10. 独立报告与运行记录

- [主调研方独立报告](main-report.md)：先于读取 Astra 结论完成，保留原始建议供对照。
- [Astra 独立报告](astra-report.md)、Astra 最终回复（本地附件未发布）：完整内容一致。Astra 会话因实际 `read-only` 沙盒无法直接创建报告文件，主调研方从最终回复原样保存报告，未续跑或改写其研究结论。
- [第三方独立报告](external-report.md)：报告正文由用户粘贴提供并归档；具体模型、运行环境和会话日志未提供。它明确无法访问本地项目，相关 `[U]` 项没有被当作本地事实。主调研方对该报告引用的关键新增来源与数字进行了独立在线复核。
- [第二份外部独立报告](external-report-2.md)：同样由用户提供，模型与日志未知，无法访问本地项目；[研读与校对记录](external-report-2-review.md)保存了 MDE、校准集冻结、通用代码保持、健康控制语义和 R 决策时点的最终取舍。
- [Opus 独立审查](opus-report.md)、最终回复（本地附件未发布）、[证据复核与最终取舍](opus-synthesis.md)：会话 `228d9c6a-a626-4095-a555-80133a3ef5a9`，退出码 0、`is_error=false`、`modelUsage=claude-opus-5-5`，本次未触发上游风控。任务书（本地附件未发布）、事件日志（本地附件未发布）、错误日志（本地附件未发布）均保留。Opus 未在线核验公开论文的限制已在报告中单列，不影响主调研方此前已核的一手来源。
- Astra `thread_id`: `01a1ff0e-09de-78e2-a406-dacfab007d51`；首轮事件（本地附件未发布）末态为 `turn.completed`，错误日志（本地附件未发布）为空。
- 本地会话已核对 `model_provider=phanthy_local`、`model=gpt-6.2-astra`、medium；完整会话记录保存在专用 Astra 会话目录。
- 共享研究任务书（本地附件未发布） · Astra 任务书（本地附件未发布） · 供其他 AI 使用的独立提示词（本地附件未发布）。

本研究未启动训练、收费模型批量任务或新浏览器批测，未修改项目代码、训练数据、项目 `decisions.md` 或现行训练配置。统计示例是公式复算，不是本项目模型实测结果。
