# 3D Agent 的通用代码与困难任务怎样配比

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

独立调研 · 2026-11-21 · Qwen3.8-27B / Three.js / Web 动画

## 结论速览

**首批建议把增量 SFT 的有效监督 token 预算分为通用代码 80%、Agent 20%。** Agent 内部按独立、合格的训练 case 留出约 40% 困难、30% 中等、15% 简单、15% 健康控制。这两层比例的分母不同。150 条轨迹逐条与 10,697 条通用数据拼接，Agent 仅占记录数的 1.38%；如果轨迹较长，其监督占比可能已接近目标。先从实际训练模板读出 labels，再决定是否需要重采样。

**在核对的 OpenAI、Anthropic 一手材料里，两家均未公开产品模型的“通用代码／领域代码／高难 Agent”三路训练配比。** 两家确实公开过更窄的实验配方。OpenAI 的 PPO-ptx 每个 RL episode 配 8 个预训练样本；Anthropic 的一项审计 Agent 实验把半个 RL 批次给了没有预埋问题的目标。最接近项目的动画实证来自 ManimCode 的同题质量对照，以及 3DCodeVerse 同型号 27B 上的代码混合实验。下文的 80/20 和 40/30/15/15 均为拟验证的项目起点。[InstructGPT 附录 C.4](https://arxiv.org/pdf/2203.02155) · [审计论文 §3.4](https://arxiv.org/html/2608.25460#S3.SS4) · [ManimCode 图 4](https://arxiv.org/html/2611.08294v1) · [3DCodeVerse 表 6、11](https://arxiv.org/html/2610.22341v1)

## OpenAI / Anthropic 披露边界

| 对象 | 原文披露范围 | 能回答到哪一层 |
|---|---|---|
| OpenAI，GPT-3 与 InstructGPT | 前者表 2.2 列出预训练来源与采样权重；后者表 6 按阶段和 prompt 来源计数，附录 C.4 报告 PPO-ptx 的混合与梯度系数。 | 能核验历史实验的分母。通用预训练、领域后训练、Agent 困难簇属于不同切面，没有共同的三路百分表。[GPT-3 §2.2](https://arxiv.org/pdf/2005.14165) · [InstructGPT](https://arxiv.org/pdf/2203.02155) |
| OpenAI，Ironclad 与 GPT-6.2 发布文 | 专家选工作流，围绕代表性流程构造合成题，在托管环境做 RL。Ironclad 的 11 道研究评测题各有 8–50 项标准。GPT-6.2 发布文展示交互 Web 和 3D 能力。 | 未公开合成训练题总数、其占全部 RL 的比例，或与通用代码的混合权重。11 和 8–50 分别度量评测广度与评分粒度。[Ironclad，Turning contracting workflows into training tasks](https://openai.com/index/advancing-computer-use-with-ironclad/) · [GPT-6.2，Computer use and interactive web design](https://openai.com/index/introducing-gpt-6-2-astra-sol/) |
| Anthropic，Claude Fable 5.2 / Mythos 5.2 系统卡 | §1.1.1 列出互联网、公开与私有数据集、符合条件的用户数据及合成数据，描述去重、分类与后训练。 | 这些是来源和工艺说明。该节未给各来源权重、领域代码量或 Agent 难题份额。[官方系统卡入口](https://www.anthropic.com/claude-fable-and-mythos-5-2) |
| Anthropic，Training Alignment Auditors via Reinforcement Learning | 对同一审计任务研究多种奖励和健康目标比例，披露 0、1/8、2/8、4/8 等实验臂。 | 这是特定 Haiku 审计策略的 RL 实验，可直接参考其控制组设计。没有给 Claude 产品模型通用后训练的对应比例。[论文 §3.4、表 7](https://arxiv.org/html/2608.25460) · [官方研究博客](https://alignment.anthropic.com/2026/training-alignment-auditors/) |

## 可核验公开配方表

下表均为作者报告的数字。每行在自己的阶段和单位内解读；同一条轨迹可以派生多个监督目标。

| 来源及阶段 | 数字及分母 | 解读 |
|---|---|---|
| GPT-3，**从头预训练** | 表 2.2 的训练样本抽取份额分别为过滤 Common Crawl 60%、WebText2 22%、Books1 8%、Books2 8%、Wikipedia 3%。原表取整合计 101%。训练总预算 300B token。 | 同表的语料库存单位是 token，例如 Common Crawl 410B。训练样本抽取权重与库存份额不同。此行为初始预训练，无继续预训练或 Agent SFT。[表 2.2](https://arxiv.org/pdf/2005.14165) |
| InstructGPT，**SFT／奖励模型／PPO** | 表 6 的 train prompt：SFT 为 11,295 个标注员来源 + 1,430 个客户来源；RM 为 6,623 + 26,584；PPO 为 31,144 个客户来源。RM 对同一 prompt 的多个输出排序，可展开多个偏好对。 | SFT 一些 prompt 由同一模板变换 few-shot 示例得到。三个阶段依次有各自的数据，不能把三列相加当作同次混合采样。[附录 A，表 6 及表下注](https://arxiv.org/pdf/2203.02155) |
| InstructGPT，**PPO-ptx** | 每 1 个 RL episode 配 8 个预训练 example。分别计算梯度，预训练梯度乘 γ=27.8 再累积。 | 8 是两类抽取单位的数量比，27.8 是目标函数系数。分母都不同于监督 token。[式 2、附录 C.4、图 33–34](https://arxiv.org/pdf/2203.02155) |
| Alignment Auditors，**多轮 Agent RL** | 指定训练批次中的 rollout 做校准，4/8 即 50%；目标无隐藏行为，成对裁判奖励正确判断无异常。比较多档校准占比。 | 这里计 rollout，不能换算成独立问题比例、拒答率或 SFT token 份额。[§3.4、图 4、表 7](https://arxiv.org/html/2608.25460) |
| 3DCodeVerse，**27B LoRA SFT** | 表 6 的 75,910 个指令–程序对、56M token 方案里，CadQuery + GLSL 占 token 的 74%；103,770 对、75M token 方案恢复全部 execution-verified bootstrap。两者每程序至多取两个 caption 视图。 | 是完整程序答案监督。表 6 的 Mtok 是论文给出的 token 量，未标作有效 loss token。附录 C.2 另有按表示展开的 1,992,816 行训练臂和单一规范表示的 292,690 行训练臂，不能用展开行数代替不同程序数。[附录 C.1 表 6、C.2](https://arxiv.org/html/2610.22341v1) |
| ManimCode，**角色条件 SFT** | 24,034 条渲染验收记录展开为 305,452 个监督样本：写最终程序 24,034，执行修复 14,587，质量修改 32,683，评审 46,965，检索查询 187,183。表 9 为 1 epoch。 | 检索占展开样本约 61.3%，一个检索答案可能只含几个查询。无法据此说它占 61.3% 的 loss。生成教师为 27B，受训学生为 4B。[§3.3、§4.1、表 8–9](https://arxiv.org/html/2611.08294v1) |
| Chart-to-Code MSRL，**SFT 后接 GRPO** | 附录 B 给出 SFT 使用 2.8M 图表–代码对；RL 使用筛出的 33k 对，先 22k 对、再用剩余 11k 对，每个输入生成 8 个 rollout。 | RL 第二阶段加入视觉奖励。22k/11k 是分阶段的数据对数，8 是每个输入的采样数，2.8M 与 33k 没有在同一个 SFT 池混采。[§3.3、表 5、附录 B](https://arxiv.org/html/2508.13587v2) |

## 理论与实验依据

| 决策 | 作者实证 | 对 Three.js 的迁移推论 |
|---|---|---|
| 从前沿失败建立任务簇 | Ironclad 从专业工作流及分支条件合成训练题，未给“失败变体 vs 随机题”的配对消融。更直接的动画证据是 ManimCode 把学生自己的崩溃或视觉缺陷转成修订状态；同一推理循环下，轨迹 SFT 后再做修订 RL，ManimData-test 渲染率从 88.6% 到 96.6%。这一差值包含 RL、奖励与额外采样的共同作用。[Ironclad](https://openai.com/index/advancing-computer-use-with-ironclad/) · [ManimCode §4.2、表 2](https://arxiv.org/html/2611.08294v1) | 保留失败前状态、操作和可复现的反例。从一次“暂停”失败派生时，让变体改变正确动作：暂停仍在绘制、恢复后时间跳零、原本正常应直接交付。换文案或颜色的副本只算同族覆盖。没有证据确定每个失败应派生几题。 |
| 质量筛选 | ManimCode 用完全相同的 8,416 个社区输入分别训练两个 Writer，改变监督程序版本。精修后 ManimData-test 渲染率 57.2% → 63.2%，视觉质量 2.65 → 2.86；ManimBench 渲染率 69.0% → 76.0%。这是精修并筛选整个流程的证据，单独阈值的贡献未识别。[§3.2、§5.3、图 4](https://arxiv.org/html/2611.08294v1) | 教师最终产物同时过运行、交互/时序断言、必要的盲看图像；再看中间动作有没有正确利用观察。失败步骤可作为待修上下文，明显错误的 assistant 动作按策略 mask。分别记全体采集和入选的分母，暴露困难题幸存偏差。 |
| 保持通用能力 | InstructGPT 的 PPO 回归涉及 DROP、SQuAD；混入预训练梯度可缓解，单调高 KL 系数未能同样恢复。3DCodeVerse 的 27B 两种 SFT 混合在表 11 的 Three.js 执行率为 87.5% 和 92.5%（40 道评测题），CadQuery 执行率则从 99.5% 到 99.0%。数据总量、方言构成、bootstrap 同时变化。[InstructGPT 图 33–34](https://arxiv.org/pdf/2203.02155) · [3DCodeVerse 表 6、11](https://arxiv.org/html/2610.22341v1) | 混入原有优质答案，并保留通用验证集作回归监测。原有数据只能锚定其覆盖的代码能力；PPO 回放实验没有测得本项目 SFT 的保留比例。 |
| 保护正确停止行为 | 审计 RL 中，同为三轮 epoch、组内成对奖励，未加校准臂的误报校准分为 2.8，加 4/8 校准后为 90.4（满分 100，越高越好）；作者选择的参考成对奖励 + 4/8 配置达到 99.6。奖励方式本身也影响结果。[§3.4、表 7](https://arxiv.org/html/2608.25460) | 配正常 fixture，要求实际检查后允许原样交付。统计无谓改动、虚报错误，也测有错时漏修。健康题对应有证据地结束任务，不能拿安全拒答样本直接替代。 |
| 是否按难度排课 | MSRL 表 5 的两阶段文本→文本+视觉奖励用 912 GPU 小时，ChartMimic 执行率 97.50%；单段视觉奖励用 1,344 小时，97.37%，高层分反而略高（84.01 对 83.81）。它验证了特定奖励课程的成本取舍，未固定数据量比较简单→困难的 SFT 顺序。[§4.3、表 5](https://arxiv.org/html/2508.13587v2) | 首批固定混合，保留简单与中等作动作基础。若想验证课程，固定各桶累计曝光，仅将“先简后难”与“全程打散”比较。按训练步排课时还要核对每段实际监督量。 |

## 对本项目的量化建议

### 先把采样率、监督量与实际损失分开记

定义 G 为已有 answer-only 代码，A 为新增工具轨迹。先定训练 split，再统计。对被采样的记录 i，记抽取次数 eᵢ，模板渲染、截断及 packing 后实际非 padding 输入长度 Tᵢ；每个目标位置 t 的权重 wᵢₜ 含 label mask 和 loss_scale，忽略位置取零，mᵢ = Σₜ wᵢₜ。按实际 token 加权均值训练时可用下式：

| 量 | Agent 份额及用途 |
|---|---|
| 库存与曝光 | 库存记录占比 N_A/(N_A+N_G)；独立 case 另按 case_id 去重，独立父失败另按 family_id 去重。曝光占比 Σ_A eᵢ / Σ_all eᵢ。同题多条成功轨迹都应归到原题。 |
| 输入／计算预算 | Σ_A eᵢTᵢ / Σ_all eᵢTᵢ。日志、图像和工具返回会增大上下文；多模态另外记录视觉 token、分辨率与实耗。 |
| 有效监督预算 q | Σ_A eᵢmᵢ / Σ_all eᵢmᵢ。未加权的有效 label 数也单列。工具观察通常只作条件；实际被监督的工具调用、代码、最终答复、reasoning、EOS 分段计数。 |
| 实际 loss 数值份额 | 对同一有效 batch，L_A/(L_A+L_G)，其中 L_s = Σ_{i∈s,t} wᵢₜ·CEᵢₜ。若 trainer 按序列、微批或设备先求均值，应沿真实 reduction、梯度累积与跨卡归一化分来源记录每步的分子贡献，然后汇总。有效监督 20% 时，若 A 的加权均值 CE 恰为 G 的 2 倍，A 占该步 CE 的 1/3。梯度还有方向和抵消，loss 标量份额仍不能代表参数更新份额。 |

令 r = 平均每条 A 的 m / 平均每条 G 的 m，平均值取实际桶内抽样分布。要达成 q，应令 **A 记录抽样概率 p = q / [r(1−q)+q]**。若每条 G 平均看一次，A 对 G 的每条重复倍率为 **(N_G/N_A) × q / [(1−q)r]**。重复倍率若过高，可缩小本次 G 的抽样窗口、轮换通用子集或扩大独立 A 池；改变抽样窗口时同步调整对照臂总预算。

**算例，r=4 仅作敏感性假设。** 150 条 A 与 10,697 条 G 各看一次，A 的监督份额为 600/(10,697+600)=5.31%。若目标 q=20%，p=5.88%，约每 16 条 G 抽 1 条 A。遍历全部 G 一次对应每条 A 平均约 4.46 次；若 r=16，同样的一次自然拼接已给 A 约 18.3% 监督量。第一轮也可以让 150 条 A 各出现两次，在 r=4 时配约 4,800 条 G，达到相同 80/20。两种预算的训练结果应分别报告。

**最小记录。** 每份清单按 source / family_id / case_id / trajectory_id / split / 难度 / 是否健康 / 教师版本记候选数、验收结果与拒收原因。每个训练臂再记唯一题数、每题曝光分布、assistant 回合、实际输入及各段有效 label/加权 token、截断与重复前缀、每步各源 CE 分子和真实归一化分母。把长轨迹拆成逐回合样本时只监督本次目标，或明确计入重复监督。按训练步输出目标 q 与实现 q，尤其检查长代码写入是否淹没诊断、工具调用和停止动作。

### 采集、分桶与预算

以下均为**项目建议**。200 和后续累计 500 指拟采集的 case；150 指首批预计合格轨迹。只有在“一题一条合格轨迹、且均归 train”时，150 才等于 150 个训练 case。先按失败根因及共享 fixture、资产、生成模板分组划分 train/dev/test，多个 split 的题不能互作变体来源。已有 812 条通用 validation 全部留作验证，另留有工具环境的 Agent 家族；若 150 含留出或同题重采，则按实际唯一 train 数缩放下表。

| 首选桶（每题只计一次） | 占合格独立 Agent 训练 case | 约 150 个唯一 train case 的整数示例 | 500 个采集名额的规划 | 学什么 |
|---|---:|---:|---:|---|
| 困难 | 40% | 60 | 200 | 可重放的基线失败；跨步骤定位原因并验证修复，如暂停、拖动、恢复共用状态。保存失败模型、工具预算与反例，区分前沿模型实败与只在学生上失败。 |
| 中等 | 30% | 45 | 150 | 练一段可迁移的观察→修改→复验，如只修恢复时间跳变，保留正常播放。 |
| 简单 | 15% | 23 | 75 | 在正常脚手架上完成明确的小功能，学交付契约、最低充分工具调用、低成本成功路径。 |
| 健康控制 | 15% | 22 | 75 | 与故障题匹配相同外观、指令和工具条件，实际检查后确认正常，避免乱修。健康优先归此桶，可另标诊断难度。 |

200 题采集时对应 80/60/30/30；每桶单记合格率。若后续 500 个累计 case 仍有 75% 达标且每题仅取一条，预计 375 条合格轨迹（拆分前），自然拼接记录占 3.39%；若全部合格则为 4.47%。75% 是由 150/200 外推的情景，难题通常要单独估计。**500 阶段先复用 80/20 作锚，再试 70/30**；仅在新增独立家族确有覆盖且留出集获益时提升 Agent 份额。以 r=4、375 条均可训练为例，G 一轮、q=20% 对应每条 A 约 1.78 次，q=30% 约 3.06 次。难题的 40% 始终按 case 算；另外报告该桶实际消耗的 A 监督份额。

### 小型消融与选型

从同一个模型检查点出发。先评估该检查点，再做下表。所有臂固定训练模板、掩码、优化器、学习率日程、全局更新数、总有效监督预算、推理工具和评测预算；用分桶采样/累积接近预算，记录真实 token、GPU 时间与偏差。等监督量不保证等计算量。

| 臂 | G/A 有效监督 token | Agent 内部与目的 |
|---|---|---|
| G | 100/0 | 同预算的通用 SFT，对照继续训练本身。 |
| L | 90/10 | 首批低剂量，40/30/15/15；检验少量轨迹是否已经足够。 |
| M | 80/20 | 首批主方案，同一分桶、同一合格池。 |
| H | 70/30 | 同一分桶；首批若预算紧可留到 500 题再与 M 同批比较。观察复用和通用退化。 |
| D | 80/20 | 在同一池内将 case 抽样份额改为 60/10/15/15，与 M 相比只把中等曝光移给困难。同步记录各桶 token 份额与独立覆盖。 |

先做 G/L/M，预算允许加 H/D。若目标是识别多轮动作本身的收益，另从 M 的**同一批 case**抽取最终答案做配对对照，分别报告等题曝光和等监督预算的结果，短答案可能需要更多曝光才能填满预算。若要识别排课效应，在优选比例内重排同一批抽样记录，保持各桶总量。各探索用家族隔离的 dev；选定后在冻结 test 上一次性比较。

主指标取**留出家族、固定工具预算、单次运行的独立验收通过率**，同时报困难子集、家族宏平均及通过数/总数。动画需通过可执行、关键时刻/交互状态断言和必要的盲评。并列看健康题误改/误报、故障题漏修、通用 812 上的 answer-only loss 及可执行子集通过率、工具步数和成本。按相同题配对，按父家族 bootstrap 给差值区间；关键臂换随机种子。先用基线重复测量确定可容忍的通用与健康指标下降幅度，再看困难增益；小样本区间重叠、额外收益不清晰时，保留监督剂量较低的臂。

## 风险与未知

1. **“开源”“通用”“困难”描述不同属性。** 开源 Three.js 代码可以非常专门；现有 10,697 条仅按用户给的用途归 G。未核验其许可证构成、去重程度、模板后的长度、训练起点已见次数，也未实测 r。若基础检查点从未学过 G，80/20 实验同时包含学习代码底座的效应；若已经学过，G 主要提供回放。两者分别解释。
2. **难题不足与假独立。** 同一根因、相同初始工程或相同教师补丁可以产生许多近邻轨迹；单条留出容易高估迁移。若验收后只剩少数困难家族，先补家族并保留失败样本统计；反复抽同一家族不能弥补覆盖缺口。
3. **稀有行为和视觉质量可能被平均指标掩盖。** 打包后被截断的收尾、被模板 mask 的工具动作、视频首帧正常但恢复失败，都会让账面比例失去含义。控制题过多也可能产生少改、漏修。需同时看有错与无错两类上的行为。
4. **证据覆盖。** 本次通过本地缓存的作者原文、官方页面和系统卡核对，没有实时全网检索。公开配方中找到了梯度回放、健康校准、同题质量对照、学生失败再训练及分阶段奖励的实证；仍缺同一 Three.js 多轮设置下对困难占比、失败变体数量、SFT 排课顺序的受控最优值。

## 来源清单

- Brown 等，*Language Models are Few-Shot Learners*，§2.2 表 2.2。[论文](https://arxiv.org/pdf/2005.14165)
- Ouyang 等，*Training language models to follow instructions with human feedback*，表 6、式 2、附录 C.4、图 33–34。[论文](https://arxiv.org/pdf/2203.02155)
- OpenAI，*Advancing computer use with Ironclad*，训练任务、结果与脚注；*Introducing GPT-6.2 Astra and Sol*，Computer use and interactive web design。[Ironclad](https://openai.com/index/advancing-computer-use-with-ironclad/) · [GPT-6.2](https://openai.com/index/introducing-gpt-6-2-astra-sol/)
- Anthropic，Claude Fable 5.2 / Mythos 5.2 系统卡，§1.1.1 Training data and process。[官方入口](https://www.anthropic.com/claude-fable-and-mythos-5-2)
- Rosu、Wang，*Training Alignment Auditors via Reinforcement Learning*，§3.3–3.5、图 4、附录表 7。[论文](https://arxiv.org/html/2608.25460) · [官方博客](https://alignment.anthropic.com/2026/training-alignment-auditors/)
- Gao 等，*3DCodeVerse: Exploring 3D Worlds as Code*，§5.2、附录 B.1、C.1–C.2、表 6、11。[论文](https://arxiv.org/html/2610.22341v1) · [作者训练目录](https://github.com/gaoypeng/3dcodeverse/tree/69c1cb98035cf947fabf5e14c69cf6fa5f367242/finetune)
- Liang、Liao，*ManimCode: Learning Visual Self-Correction for Educational Animation*，§3–5、图 4、表 2、8–9。[论文](https://arxiv.org/html/2611.08294v1)
- *Breaking the SFT Plateau: Multimodal Structured Reinforcement Learning for Chart-to-Code Generation*，§3.3、§4.3、表 5、附录 B。[论文](https://arxiv.org/html/2508.13587v2)
