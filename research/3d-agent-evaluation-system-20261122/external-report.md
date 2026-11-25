# 第三方独立报告来源登记

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

本报告正文由用户在 2026-11-22 粘贴提供，第三方 AI 的具体模型、运行环境和会话日志未提供。它自述未读取其他 AI 报告，且无法访问本项目本地目录。这里保存其正文供三方汇总，不将自述等同于本地运行核验。

---

# Three.js 3D Animation Agent 评估体系：独立研究与可执行规范（v1）

研究日期：2026-11-22；研究类型：只读桌面调研、公开一手来源核验、评估协议设计。
目标项目：`${WORKSPACE}/3d-animation-agent`（该目录在本次研究容器不可访问）。
本报告没有读取其他 AI 的研究报告或汇总结论；没有启动训练、付费 API、批量模型试验；没有修改项目代码、配置、决定。
事实状态：`[F]`＝有一手文献/原代码支持；`[I]`＝跨领域迁移推论；`[P]`＝本项目建议、尚未实测；`[U]`＝未知或本地未核验。来源登记在 §12，引用采用 [S#]，列有 URL、定位章节；项目要求由研究委托给出，标为 [B]。

## 0. 核验范围与核心结论

### 0.1 实际核验和局限

[B] 委托给出的项目状态是：交付离线 HTML、可编辑 JS/Three.js 源码、真实浏览器证据；任务类型为从零生成、固定缺陷修复、局部编辑、健康控制、缺输入阻断；`10,697 train / 812 validation` 是 answer-only 代码样本数，不是独立 Agent case/题族数。拟设 Agent dev 为 6 题族 × 2 题 = 12 case；Agent test 为 12 题族 × 4 题 = 48 case。拟比较原生 Qwen3.8-27B、one-shot SFT、多轮 SFT、Kimi；另有“首轮一个混合 SFT”的安排。二者均须兼容，不由本报告选择训练配方。

[U] 本次检查了容器中的 ${WORKSPACE}/3d-animation-agent 和 ${WORKSPACE}/skills/agent-harness/templates/iterate，路径均不存在；在可用文件库中以项目名及指定文件名检索，未找到可确认的对应项目文件。因此以下不是现存 cases.json、`check_case.py`、预检结果的逐行 code review；不能宣称检查器当前必有某漏洞、历史通过率为何、产物目录已有何字段。对这些文件的检查写成待执行的只读审计清单，不能把“未访问”当成“文件不存在”。

[F→I] 三条最稳的迁移依据：(a) OpenAI 2026 年审计指出编码基准可以因过严、过松、模糊任务和污染出现大范围失真，[S1][S2]；(b) WorldCoder-Bench 在 Three.js 场景使用隐藏行为契约、浏览器状态探针和缺陷注入，[S6]；(c) VibePrevisBench 把可执行交付、场景事实、屏幕上能看懂的动作分开，[S7]。它们支持分层评分 + 评估器独立校准，不支持直接复制公开阈值或把其榜单成绩当本项目基线。

研究结论 [P]：将正式主指标设为 Intent-to-treat 的任务级端到端成功率 (E2E Task Success@1)，按任务类型应用不同的强制门槛；语义、视觉、行为、成本作为可解释的正交维度。使用按题族配对的统计设计；48 case 的 test 主要用于发现大幅差异、失效类型和回归，不宜宣称小幅普适提升或可靠 OOD 泛化。所有放行标准先于模型输出冻结。

## 1. 单位、总体、评估目标：先定义分母

| 名词 | 操作定义 | 统计作用 |
|---|---|---|
| source | 原始代码仓库/视频/素材/外部模板及其 revision、许可 | 泄漏溯源单位 |
| family（题族） | 共享同一源资产、母问题、主要动作语义、预期解题路径或变体生成模板的一组题 | 泛化结论、聚类区间的主要抽样单位 |
| case（题） | 独立固定输入、初始状态、要求、可检查 contract；同题族可有多个 case | 完成率的业务单位，不与题族等同 |
| trial（运行） | 同一个 case × model/checkpoint × seed × harness version × budget 的一次从初始沙盒重置执行 | 估计随机性；同一 case 的 trial 不独立地扩充题数 |
| assistant_turn | Agent 的一个回复回合；可能包含多次工具调用 | 行为、预算单位，不是样本数 |
| tool_call | 单次工具请求及其状态（发出、完成、失败等） | 失败、循环、恢复诊断单位 |
| frame | 渲染视频/截图的一个采样时间点；同一 trial 的帧强相关 | 视觉/时间证据，不是独立样本 |
| token | 输入/输出/缓存/视觉等供应商原生计费分类中的 token | 成本单位，不是独立样本 |
| check | 某 case 的某项可执行断言 | 覆盖度、校准单位；check 数量大不代表 case 多 |

[P] 先冻结目标分布和权重：任务类型 × 难度 × 输入形式 × 是否参考既有源码 × 动画行为（平移/旋转/交互/摄像机/关键帧/物理）。主指标推荐按 case 宏平均，若事先定义不同任务重要性，使用冻结的类型权重；同时提供不加权结果。不可根据模型输出后调整比例。

主指标的原始观察单位：`case × trial` 的 success∈{0,1}；统计置信区间按 family 聚类。若一套 test 中有 48 case、每题 3 trial，总共 144 次模型运行，但仍是 48 个 case、12 个题族，绝非 144 个独立题目。

## 2. 分层指标树与强制门槛

建议每题形成一个 scorecard：G0 评价有效性 → G1 合规交付 → G2 动画语义 → G3 可见性/视觉体验 → G4 Agent 任务纪律；G5 成本/效率与 G6 泛化仅作横向分析。门槛按题型适用，而非对所有题一刀切。

| 层级 | 应回答的问题 | 必须通过（示例；[P]） | 非门槛/辅助项 |
|---|---|---|---|
| G0 有效性与重放 | 是不是在可靠、可复现的环境中判分？ | case/contract 版本可定位；独立重放运行；非基础设施故障 | 浏览器/字体/GPU 版本；重放方差；证据校验和 |
| G1 交付 | 用户是否收到离线可运行、可编辑源码与真实浏览器证据？ | 对要求生成/修复的题：源码存在可读、offline 无外网依赖、HTML+资源完整、Playwright/Chromium 开启并有真实 WebGL 帧和可审计证据；不能仅“存在文件” | 载入耗时、JS error/warning、总字节、源码复杂度、资源开销 |
| G2 动画语义 | 所要求的事件、顺序、运动、交互和变更是否正确？ | 每题预注册的 critical checks 全通过；修复题旧缺陷解决；编辑题所需增量完成且原不变量保持 | 事件召回/精确率、时间误差、轨迹误差、状态覆盖、运动抖动 |
| G3 屏幕可见/体验 | 对的动作是否看得见、看得懂、画面是否可接受？ | 关键事件的主体可见，无遮挡/剪裁/黑屏/长静止掩盖；致命视觉缺陷为零；主观精美程度不做自动零分门槛 | 人类盲评：动作可读性、构图、运动流畅、镜头稳定、美术、场景连贯 |
| G4 Agent 纪律 | 是否遵守任务边界、查看证据、停止和修改规则？ | 缺输入题：不生成/不改动错误的交付，明确阻断且说明缺项；健康题：不破坏已健康产物；禁改文件/无权操作次数=0 | 修复过程的有效进展率、循环调用数、虚假声称成功数、诊断质量 |
| G5 效率与费用 | 相同成功率下谁更省？ | 不用于替代正确性 | 总 token、视觉 token、模型费 USD/成功题、wall time 秒/成功题、工具调用、重试、浏览器渲染时间、P50/P90 |
| G6 泛化 | 换题族、代码/资产来源后是否还成立？ | 没有独立来源时不得声称域外泛化 | seen-family / novel-family / external-OOD 分层成功率、区间、失效迁移 |

重要逻辑：[P] 对 generate / repair / edit 的 E2E= G1∧G2∧G3_critical∧G4_critical；`G0` 是判分可信性的前提而非模型能力；对于 healthy_control，主成功是“正确识别健康、保留资产完整、若需提交则原产物仍可用”，不是必须大改代码；对于 missing_input，成功是“按要求阻断、无越权猜测、不产出伪成功且报告缺口”，不要求生成 HTML。禁止把这两类题都当成生成失败。

### 2.1 可验证的语义 contract

[P] 每题最少编写：`critical_facts[]`、`secondary_facts[]`、`preservation_invariants[]`、`negative_requirements[]`、`observable_contract[]`、`time_windows[]`、`interaction_sequence[]`、`acceptable_alternatives[]`。对运动目标写可操作事实，如：`object A 在 t=0..2s 由左到右移动`、`t∈[2,3]s 与 B 接触后 B 开始移动`、`t≥4s 镜头跟随主体`；按持续时间和容差检验，不用某个函数名或 AST 片段充当成功真值。

具体观测三个互补通道：`(1) 执行/状态`：3D position、rotation、velocity、camera、time、controls、事件与物理约束；`(2) 画面`：独立浏览器捕获关键帧/短片、可见性、遮挡、时序；`(3) 行为`：源码 diff、工具日志、边界遵守、实际失败原因。若使用 window.__...STATE__ 暴露状态，它本身也是候选模型可伪造的输出；必须由外部独立检查采样真实 Three.js scene graph / renderer（能取得时）及像素、交互变化做交叉验证，不能单独相信自报变量。[I] [S6]

[P] 用“固定时间轴 + 事件时间附近加密采样 + 随机审计时间点”生成视频证据。Playwright Clock 可控制 requestAnimationFrame 等计时器，但须先针对 setAnimationLoop、真实时间/物理步进、WebGL driver 做已知好版重复校准，未通过不能声称逐帧确定性。对于 N 个采样帧只可说“通过 N 帧/指定事件窗口的检查”，绝不能说“全动画每帧无误”。[S12][S13]

### 2.2 视觉评分原则

[P] 分成 screen_legibility（关键动作在画面中能被辨认，关键硬门槛）与 aesthetic_quality（偏好/审美，辅助指标）。盲评须随机 A/B、隐藏模型名/代码和分数、同尺寸同 FPS 同机位/播放工具；至少两个评审独立判断，分歧仲裁。问卷强制“可见证据的时间段”和“具体可观察缺陷”，允许 not_scorable。由另一个 VLM 做规模化筛查可以，但不能替代独立人工校准，也不能让生成模型自审直接等同外部验收。[S3][S7][S9]

[P] 无真值参考视频时，不强行算 DreamSim/DTW 与 reference 的相似度；仅对有 reference 的视频复现子集计算 appearance 与 temporal 两套指标，独立检验是否符合人类排序。对文生 3D 任务，目标可能存在多种合法外观，主语义以事件合同判断；风格采用人评。相同静态帧可能是静止主体/运动镜头，要用相机与对象的相对运动核对，避免“像素变化=动画正确”的替代指标。[S9]

## 3. 漏洞假设与评估器自身的校准（最先做）

警告：以下是待核验的潜在漏洞，不能声称已在项目检查器中实测发现。

| 风险类别 | 典型误判 | 验证方案 |
|---|---|---|
| 形式替代语义 | 仅验 HTML 存在、标记字符串、动画 API 名、截图存在，假阳性 | 用静止画面但保留动画函数名的 mutant、重复旧画面、伪造 evidence 路径，必须失败 |
| 过严 checker | 依赖对象名字、DOM id、变量名、固定文件布局/某种库写法，假阴性 | 提供语义等价的不同对象命名、层级、坐标系、函数拆分实现，必须通过 |
| 过松 checker | 缺时间顺序/轨迹，只查起止点；瞬间闪现即算成功 | 反转事件顺序、错速度、错 easing、反转路径、长时停帧，必须在对应维度失败 |
| 题目歧义 | 要求中没说的颜色/帧率/场景边界在隐藏 checker 强制执行 | 独立两名领域评审仅看 visible brief，复述所有关键合同；不可推知项修改/剔除 |
| 视觉错判 | 一帧好看但镜头外动作错；VLM 吞掉遮挡/碰撞 | 同步看 video、关键窗口和状态差分；要求时间戳；加人工对抗样本 |
| 健康控制误报 | 健康源码被“修复”导致语义或视觉退化 | gold healthy baseline + noop 变体应通过；乱改版应失败 |
| 缺输入绕过 | 幻觉资源、私自下载替代素材后报成功 | 隐去必要 GLB/参考图，正确拒绝应通过；伪造资源路径应失败 |
| 环境噪声 | 三方 CDN、字体、GPU/Mesa、浏览器升级或 OOM 混入失败 | 固定离线依赖与容器、记录所有版本；预检重复；独立 infra 分类 |
| 评分泄漏 | hidden checks/答案在沙盒、日志、Git history 或可网络检索位置 | 测试命名空间只在评估容器；模型工作区无法读到；阻断网络 |
| reward hacking | state hook 填真值但画面不动；只在采样帧造假 | 未公开随机时间与动作探针、状态/画面一致性验证、源码独立检查 |

### 3.1 四类最小校准集

[P] 对每个核心题族至少构建一个四件套，首轮优先 10–15 个代表性 case，不受 Agent 训练路线影响。

Known-good：经人看过、能在离线浏览器完整执行且满足文档合同的参考实现。必须 G1/G2/G3-critical=pass，必要证据与版本齐全；至少两次环境重放一致。

Single-defect mutant：以好版为基线一次只注入一类可定位错误（停动画、反向位移、相位颠倒、摄像机移走、资源缺失、接触不触发、hover 失效、对象/镜头不同步、局部编辑破坏背景、谎报完成等）。每个 mutant 有 target_check_ids、`mutation_sha`、可确定的预期失败维度；其他维度不应大面积误伤。

Acceptable alternative：不同命名/层级、等价坐标变换、不同插值方法/事件实现、不同但合要求的视觉表达。应通过关键合同，允许非关键外观分数变化；测假阴性/实现绑死。

Healthy control：原版本已满足要求，正确行为是报告健康、保持不变（或仅做允许的无害格式调整）。乱改的版本失败。再加入“必要资产缺失”的负控制，阻断成功、继续伪造失败。

校准评分（分母必须写清）：`mutant_kill_rate = 被指定目标检查捕获的非等价 mutant 数 / 已复核非等价 mutant 总数`；`good_acceptance = 通过的已知好/合法替代数 / 这些实现总数`；`healthy_specificity = 正确通过健康版本数 / 健康版本总数`；`wrong_dimension_rate = 错误定位到非目标维度的 mutant 数 / 被捕获的 mutant 数`；`replay_agreement = 相同产物多次评分一致的对数 / 可比较重放对数`。区分 equivalent mutant（语义没改变的注入）并记录排除原因，不能让其降低 kill rate。

[P] 建议初版质量门：所有 critical 断言至少有一例已知坏版触发；已知好版、合法替代不能被 critical 误拒；针对必杀 mutant 为 100% 检出（是开发放行阈值，不是推断总体 100% 敏感度）；独立重放中 critical pass/fail 不得随机翻转。若无法满足，冻结该类题的排行榜判分，先修评估器。全量 21 项自动检查等文献数字并不是本项目必要指标，依当前真实合同确定。[S2][S6][S7]

### 3.2 盲评/自动评估器的外部标定

[P] 第一批：人工从 good / mutant / alternative / healthy / 难判 五类中平衡分层抽不少于约 40–60 个交付片段（是工作量建议而非精度保证）；2 名互盲评审按任务说明独立标“符合/部分/不符/不可判断”，标明关键时间窗口。对自动二分类判定计算 TP/FP/FN/TN、召回、特异度、各类样本数、Wilson 区间；对于 ordinal 评分报告加权一致率/二次加权 κ 或 Krippendorff α（若适用），并列冲突案例。将“负例中检出比例”与“真实线上误报”分开，因标定集是人为配比。人评意见不一致时，仲裁不是强行平均，而是增补可判定的约束或认定 unknown。

[P] VLM 偏置试验：将同一片随机以 A/B、交换顺序、去掉模型名、不同但相同质量编码、单帧替代 vs 完整短片重复评分；报告顺序效应、同输入重测一致率、与两位人工的 case-level 协议（不能仅报告 across-model leaderboard 相关）。VibePrevisBench 报告的“11 个 agent 平均值排名相关”不等于单个视频评分可靠，原文按 run 的 Spearman 仅约 0.73–0.79，[S7]；这一差别不能隐去。

## 4. 数据边界、泄漏审计与外部 OOD

### 4.1 切分的对象是“溯源图/题族”，不是随机 JSON 行

[P] 建立每个样本的 lineage：`source_repo_url + immutable_revision + license`、`source_file_hash`、`canonical_AST_hash`、`asset_sha256[]`（GLB 还可 mesh/texture perceptual hash）、`render_video_phash`、`prompt_semantic_cluster`、`generation_template_id`、`parent_case_id`、`family_id`、`derived_from_ids[]`、`teacher_trace_ids[]`。将共享代码/资产/原始动画/模板/关键动作组合的节点连边，同连通分量只进一个 train/dev/test/external 分区。

最少泄漏规则：同一个代码工程不同修复版、同一动画不同文字改写、同一个视频不同剪辑、同一资产库同角色多个角度、同一个 trace 的各 agent 重试，都不得跨 train 与封存 test。对于通用第三方资产库（例如常见公共字体和 Three.js 本身），列为 allowed_common_dependencies 白名单并冻结，不必把所有项目误合成一个族，但任务特异的模型/纹理/GLB 应按 lineage 分离。

[P] 至少分四个集合，功能分工不同：

| 集合 | 用途 | 能否看题和误差？ | 不能声称什么 |
|---|---|---|---|
| answer-only 训练 / validation | 训练代码生成、训练期损失/解码 sanity、简单代码能力保持（需再抽独立题） | 可用于开发，非 Agent 泛化证据 | 10,697/812 的行数不是独立 agent 测试样本 |
| Agent dev：6 家族、12 case | 调试 harness、评估器、选预算、选择 checkpoint；失败切片与探索 | 可以，代价是被适配；记录全部试验 | 不用 dev 的最好成绩做最终泛化结论 |
| Agent test：12 家族、48 case | 冻结后一次正式比较；同 case、同外层、配对、盲评 | 冻结到选型结束；审计只看封存产物 | 不能无限重试、修题后沿用旧 test 作为同一独立 confirmatory 结果 |
| External-OOD（另建） | 独立于内部生成模板/代码源的分布压力测试 | 应在终测后运行，最好外部作者新题 | 只凭少量 public benchmark 不可宣称“跨一切 3D 动画泛化” |

[P] 在切分前明确五类任务都被覆盖。题族数量极少，应使用交叉表核对每类至少有可评分题；若某任务类型在 test 完全没有题，只能报告“未评估该能力”。不应为了凑每类数量，把同源 case 强拆成多个题族。

### 4.2 具体审计与封存程序（可只读运行）

对 evals/cases.json、`evals/collection-v1/cases.json` 与所有训练来源生成 canonical manifest；规范化 JS token/AST，计算 exact hash、AST/TLSH/MinHash 近似与同源 asset hash；对疑似跨分区邻居人工验真。

给每题记录 visible_prompt、`hidden_contract` 的独立位置，检查 agent 可见工作区/工具日志/源码 Git history 是否含金标准、判定脚本、参考最终代码；可见 prompt 中引用不存在/错误素材则标损坏题。

dev.lock.json、`test.lock.json` 内冻结 dataset_sha256 / family_assignment / scorer_commit / rubric_version / runner_image_digest / screenshot_schedule / weights / hypotheses / comparison_plan。test 配对模型结果可盲编码成 A/B/C/D，在封存分析完成前不揭盲。

每次新增轨迹记录训练谱系和重叠扫描；不允许先看 test 失败再回填类似训练样本并仍把旧 test 当独立终测。修复评估器须保留旧/新版本成绩与变更原因，必要时另造新 test。

External-OOD 至少两条正交轴：`new source/author/asset provenance` 与 new behavior/task-family；可以再加 new render device/browser 作为环境鲁棒性，但后者不是语义 OOD。公开 WorldCoder core 作为 Three.js 外部行为压力题、3DCodeBench Three.js 子集做独立代码能力对照等须先检查协议和训练重叠，不能简单并入本项目总分。[S6][S10]

[U] 10,697 / 812 的来源、近重复率、生成 teacher、代码权属/许可、是否已包含公开 benchmark、同一 case 在两个 cases.json 的重叠率目前无法核实。训练前必须出具审计表，而不是用一个 embedding 阈值就宣布无污染。[S1][S2][S5]

## 5. 统计协议：小样本正确回答“小到什么程度”

### 5.1 48 case / 12 family / repeated trial 可以支持哪些结论

[P] dev=12 case / 6 family：适合定位 bug、校准评分、挑选明显可行的 harness/checkpoint，不适合稳定排名。`test=48 case / 12 family`：可建立首轮配对、可复查 pilot；有机会发现很大的改进或明显坏化；对 3–8 个百分点 这类小提升以及更细类型分组，证据通常不足。若 family 内 case 强相关，则有效独立单元明显接近 12 而不是 48。试跑 3 次只是估计运行随机性，不能替代扩充新题族。

为直观量化：只有在 48 case 互相独立且观测成功率恰为 50% 时，Wilson 95% 区间约为 [36.4%, 63.6%]，半宽 13.6 百分点；若只有 12 个独立 Bernoulli 单元、50% 成功，约 [25.4%, 74.6%]，半宽 24.6 百分点。这是示意，不是本研究的测量，也不是配对差异区间；题族聚类和分层权重需另算。不要用 48×3=144 代入独立二项区间以声称更窄误差。

### 5.2 预注册对照与估计量

[P] 以 m 为模型，`f` 为题族，`c` 为题，`r` 为 trial，`y_mfcr∈{0,1}`。同一题族的同一组 case，对每个模型均使用一致的外部预算和 seed index；`p̂mf = mean{c∈f,r}(y_mfcr)`；题族配对差 d_f = p̂_Af - p̂_Bf；`Δ̂ = (1/F)Σ_f d_f`（若设计上题族不等重要，预注册加权均值）。三次 trial 用 r=1,2,3 即可组成 pilot 的 reliability 诊断；主表同时报告 first trial pass@1 和 multi-trial 均值，避免把多次重试当一次成功。`pass^3`（每题三次全成功的比例）只作为严苛可靠性副指标，不和 pass@3（三次至少一次成功）混淆。[S3][S11]

区间：以 family 为最外层进行成对 cluster bootstrap：每次重采样 F 个题族，在同一 bootstrap 样本中保留所有模型的配对 case/trial；预算足够时在题族内二级重采 case 并保留每题 trial 分布，报告 95% percentile CI 与只重采 family 的敏感性分析。由于 F=12 很少，bootstrap 结果可能偏乐观/不稳定：并行报告12 个 d_f 的原始向量、每族点估计、基于整族符号翻转的精确随机化 p 值（2^12=4096 种符号翻转，在交换性零假设下）及留一题族敏感性分析；对 cluster sign-flip 假设不成立或 F 太小时明确“探索性”。若 48 case 真正相互独立，可另报配对 McNemar/二项 exact discordance；不得拿这种结果代替题族聚类分析。

连续视觉偏好：人工 A/B 以 case 为配对，模型顺序随机、允许 tie 与 unknown。报告 win / tie / lose / unknown 四格分母、每题族 A 胜率/效应、cluster bootstrap 区间；自动视觉 0–100 分数须先校准且报告分布、不能直接当独立人工真值。

### 5.3 结果判定词（在看 test 之前冻结）

[P] 针对事先指定的主要比较（例如 SFT vs 原生），将可接受最小实际收益 δ_min 写入 protocol.lock，建议 pilot 暂拟 δ_min = +10 个百分点，仅作事前研究决策阈值，非统计事实；依真实业务成本和成功率底数可在冻结前决定。定义简单代码保持的非劣界 ε_simple（建议初版绝对 -5 个百分点，同样需预注册）。

“提升（有统计支持）”：primary Δ̂ ≥ δ_min 且事前指定 95% 题族配对区间下界 >0；同时无关键安全/健康/阻断回归，简单代码保持满足非劣判据。若选择多模型与多指标，必须写清主假设及比较族，使用 Holm 或预注册的 max-T/层级检验控制多重性。小样本检验条件不满足则降级结论。

“未分出差异”：区间包含 0 或证据不足；`p>0.05` 不意味着等效；即使 Δ̂ 为正也只可说观察性改善，不可宣称已证明优于另一模型。

“出现回归”：primary 题族配对 CI 上界 <0 才可称统计可支持的总体回归；另对 critical 安全/健康/拒绝越权等预注册零容忍的单例失败报告“发现关键回归样例”，并触发调查/阻断发布，但不能把单例外推为总体负效应。

“实践上相当/非劣”：需要独立事前定义的等效界/非劣界及相应双单侧检验或区间，当前小样本往往无法证明；不能因为“未分出”就说相当。

[P] 先以同一测试家族比较 original vs mixed-SFT（如果仅训练单个混合模型）；未来增加 one-shot SFT / multi-turn SFT / Kimi 时使用同一已封存的 protocol、case 与 run schema，但仅在 test 尚未用于适配时可以共享同一 confirmatory 家族。若“先测混合 SFT 再根据 test 决定后续训练”，该 test 已被开发使用，后续跨训练路线推断必须换新封存集。不能将 test 无限次利用。

### 5.4 模型选择与盲法

[P] checkpoint/prompt/harness 在 dev 内先按 primary success 最大选（约束为零关键回归与简单能力保留），然后用 quality conditional on success、每成功任务成本做并列的 Pareto 分析；不允许事后在十几个指标中挑最有利者作为主结论。记录所有 dev 尝试次数、切换决策、弃选版本；test 只解盲一次，不按 test 结果再改阈值。若试验格子不足（某任务种类只有 1 题族），仅给 case 例子与误差切片，不做类型普适显著性宣称。

## 6. 公平比较：模型、Harness、预算与输入

### 6.1 两个不同的估计目标，不能混在一个排行榜

Controlled system comparison（主表）[P]：固定同一 tool schema、system instructions、工作目录初始状态、无网运行镜像、观察能力、图像/视频输入分辨率与采样时间、最大 user/assistant 回合、tool call 数、browser render 次数、模型 retry、wall-time 与 token/cost 预算；只变模型及训练 checkpoint。报告的是“此固定系统条件下”的表现，不是模型在任何最优 harness 下的能力上界。[S5]

Native/optimized system comparison（可选第二张表）[P]：允许 Kimi/其他系统使用其原生推荐 context/工具策略，但明确标成“系统对系统”而非模型控制对照。工具接口、时间/费率不同就不能把差异归因为 SFT。

“同预算”必须写成向量，不是只写 max_tokens：`(max_assistant_turns, max_tool_calls, max_render_attempts, max_browser_observations, max_input_tokens, max_output_tokens, wall_clock_s, maximum_model_usd, GPU/CPU/RAM limits)`；不同模型 tokenizers 和 API 视觉计费不同，同时报告“硬预算约束下成功率”与成本归一化的 success per USD，不要单凭相同 token 数宣称算力等价。超预算应明确结束并按未完成记失败，而不是悄悄给模型追加次数。

[P] 视觉访问公平：如果某模型无原生图片输入能力，统一提供事前固定的、对所有模型相同的受控图像描述工具；否则比较对象实际是“模型+视觉前端”。两种条件可分别报告：`visual-native` 与 text-observation-only。所有调用版本、后端 model_id、temperature/effort、seed 支持情况、system/tool 变换细节必须记录。不能把“同为 Qwen”但不同 decoder、precision、quantization/serving config 当同系统。

### 6.2 Retry、基础设施与裁判独立性

[P] 区分：`agent self-repair`（模型在预算内自发重试，应计入行为及费用）、`tool transient retry`（按统一 fixed policy）、`evaluator rerun`（验证环境有故障时，固定模型输出独立重放，不能补给模型更多动作）。例如“工具超时同参数仅准重试 1 次；超出预算/模型自主继续计入失败；基建故障最多独立重放 2 次并上报”，数值必须在预注册确定，不可按模型成败临时变更。锁定 image digest、WebGL 软件/硬件 backend、Chromium、Playwright、Node、Three.js 本地包，记录资源限额及实际峰值。[S4][S12]

[P] 在 model-visible 沙盒之外部署独立 grader，只消费 freeze 后输出与只读输入快照；模型无法读 grader 源码、秘密门槛、参考答案和 visual review 的原始身份映射。所有模型先进行可用性 smoke test：同一已知好 HTML、同一资源/操作下都可在环境完成重放，否则不能开始能力对比。

## 7. 简单代码能力保留、困难 Agent 改善的双轨检查

[P] Simple-Regression 单独建从零生成的小任务：基础几何/材质/纹理、局部 JS 修改、Three.js import、离线打包、普通 HTML/JS 控件、短时简单运动、低难度视觉动效。优先从非训练来源、未见代码、每族新来源抽取 20–40 case 起步，并有少量现有线上冒烟用例；此数字是开发建议，不能为该规模承诺非劣精度。除二值成功率，还报告可编辑性、性能与代码崩溃率。

[P] Hard-Agent 用独立题族刻意覆盖多段时间线、镜头跟随、因果交互、多对象协调、bug 定位/修复、局部编辑保留、已健康不乱改、缺输入主动阻断、浏览器证据自查；要有“多轮确实能帮忙”的真实失败根源，而不是单纯 prompt 更长。若多轮 SFT 只在 Hard-Agent 提升而 Simple-Regression 下降，不能报“总体变强”而隐藏回归；同时给 hard Δ 和 simple Δ + 两者区间。

[P] 训练路线无论是三组 SFT 还是首轮单混合 SFT，都做相同两条诊断切片、相同输出 schema；不按是否存在某训练组改变题包。若未运行 one-shot SFT，标为 not_run，不是得分 0。

## 8. 可实现的数据产物 schema（JSONL；示例字段而非现有仓库事实）

统一约定：时间 UTC ISO8601，持续时间秒，token 数为整数，美元为 USD；所有文件用 content SHA256 与相对路径标记；对每条记录保留 schema_version，避免会用“空字段”冒充通过。

### 8.1 case.jsonl

```json
{
  "schema_version":"eval.case.v1",
  "case_id":"A-001", "family_id":"F-camera-follow-01",
  "split":"test", "task_type":"repair", "difficulty":"hard",
  "provenance":{"source_id":"source-001","repo_rev":"git-sha-or-null","source_hashes":["sha256:..."],"asset_hashes":["sha256:..."],"license":"reviewed-or-unknown","parent_case_ids":[]},
  "inputs":{"prompt_path":"inputs/A-001/brief.md","base_project_path":"inputs/A-001/project","required_assets":["assets/actor.glb"],"available_assets":["assets/actor.glb"]},
  "output_contract":{"offline_html":true,"editable_js":true,"browser_evidence":true,"allowed_edits":["src/animation.js"],"forbidden_edits":["assets/**"]},
  "observable_contract":{"events":[{"id":"ev-follow","when_s":[1.5,4.0],"rule":"camera tracks actor","critical":true}],"state_invariants":[{"id":"inv-static-background","critical":true}],"negative_requirements":[],"acceptable_alternatives":[]},
  "inspection":{"times_s":[0,0.5,1.5,2.0,3.0,4.0,5.0],"events_to_probe":["ev-follow"],"fps":30,"duration_s":5,"viewport_px":[1280,720]},
  "eval_version":"contract-v1", "family_split_audit_sha":"sha256:...", "sealed":true
}
```

关键：`prompt_path` 可见；`observable_contract` 在评测容器隐藏（允许发布公开 criteria 概要，但不泄露测试值/动作脚本）。`missing_input` 必须显式 required_missing_assets[] 与 expected_agent_action="block"，不可混淆数据缺损与故意设计的缺输入题。

### 8.2 run.jsonl

```json
{
  "schema_version":"eval.run.v1","run_id":"R-20261122-A001-qwen-seed1",
  "case_id":"A-001","family_id":"F-camera-follow-01","trial_index":1,"trial_seed":20261122,
  "model":{"vendor":"local","requested_id":"Qwen3.8-27B","resolved_version":"pin","checkpoint_sha":"sha256:...","quantization":"pin","decoding":{"temperature":0.2,"top_p":1}},
  "harness":{"commit":"sha","sandbox_image_digest":"sha256:...","tool_contract_version":"v1","browser_version":"pin","threejs_version":"pin","observation_policy":"same-frames-v1","retry_policy":"transient-only-v1"},
  "budget":{"assistant_turns":30,"tool_calls":100,"render_checks":6,"wall_s":1200,"max_usd":5.0},
  "usage":{"assistant_turns":0,"tool_calls":0,"tool_errors":0,"render_checks":0,"input_tokens":0,"output_tokens":0,"cached_tokens":0,"visual_tokens":null,"model_cost_usd":null,"wall_s":null},
  "outcome":{"status":"not_started","termination_reason":null,"output_hash":null,"artifact_paths":[],"evidence_paths":[],"model_refusal":false},
  "trace":{"events_jsonl":"runs/.../trace.jsonl","tool_log":"runs/.../tools.jsonl","stdout":"runs/.../stdout.log","stderr":"runs/.../stderr.log"}
}
```

budget 数字仅示例，不是决策；`visual_tokens=null` 表示供应商未给出，不得写 0；`cost_usd=null` 表示不可得，不得视为免费；`status` 枚举：`not_started | completed | model_failure | budget_exhausted | model_refusal | infra_error | invalid_case | scorer_unknown`。

### 8.3 scorecard.jsonl

```json
{
  "schema_version":"eval.scorecard.v1","score_id":"S-R-...","run_id":"R-...","case_id":"A-001","family_id":"F-camera-follow-01",
  "grader":{"source_commit":"sha","grader_image_digest":"sha256:...","rubric_version":"v1","calibration_report_sha":"sha256:..."},
  "eligibility":{"valid_case":true,"evaluable":true,"infra_error":false,"reason":null},
  "gates":{"delivery":{"pass":true,"checks":[{"id":"offline","pass":true,"evidence":"network-log"}]},"semantics":{"pass":false,"checks":[{"id":"ev-follow","pass":false,"measured":0.2,"required":"tolerance specified in contract","evidence":"state-trace"}]},"visual_critical":{"pass":true,"checks":[]},"agent_discipline":{"pass":true,"checks":[]}},
  "metrics":{"e2e_success":0,"state_coverage":0.8,"event_recall":0.5,"event_precision":null,"visual_quality":null,"cost_usd":null},
  "status":"scored","unknown_check_ids":[],"review_required":true,"scoring_artifacts":["scores/A-001.json"]
}
```

主分数根据 task-specific gates 自动求，不把示例里的 state_coverage=0.8 当成通过；未知 unknown_check_ids 不得在宏平均时直接忽略。

### 8.4 visual_review.jsonl

```json
{
  "schema_version":"eval.visual_review.v1","review_id":"VR-...","case_id":"A-001","blind_pair_id":"pair-77","candidate_order_seed":1234,
  "artifact_hashes":{"A":"sha256:...","B":"sha256:..."},
  "reviewer_id":"anon-human-02","reviewer_type":"human","judge_model_version":null,
  "evidence":{"video_A":"blinded/pair-77/A.mp4","video_B":"blinded/pair-77/B.mp4","frames_A":[],"frames_B":[],"fps":30,"width":1280,"height":720},
  "rubric":{"action_readability":{"A":"yes","B":"partial","time_spans_s":[[2.0,3.0]],"notes":"..."},"composition":{"A":4,"B":3},"temporal_coherence":{"A":4,"B":2},"aesthetics":{"A":3,"B":3}},
  "pairwise_preference":"A","confidence":"medium","unknown_reason":null,"timestamp_utc":"2026-11-22T00:00:00Z","rubric_version":"v1"
}
```

附加物：`manifest.json`（所有输入/运行/评审 hash、模型配置和封存版本）、`trial-trace.jsonl`（每回合工具调用和状态）、`browser-replay.mp4`（独立评估渲染）、`screenshots/{time_ms}.png`（精确采样时间）、`console.jsonl`、`network.jsonl`、`state.jsonl`、`score_report.md`（含主分母与统计区间）。所有输出应能被第三方只读重放并核实是否来自真实浏览器，不允许用模型自行生成的图片替代捕获证明。

## 9. 分母和异常：不让模型通过“未交付”提高平均成绩

| 状态 | 主 E2E@1 分子 | 主分母（预注册排定、可用 case × trial） | 质量/成本辅助分母 | 必须披露 |
|---|---|---|---|---|
| 模型提交完整且通过所有 critical gate | +1 | +1 | 交付后质量、所有试验成本 | 证据 hash |
| 模型提交，但语义/视觉/纪律不通过 | +0 | +1 | 质量可按 0 或分项实测；必须标记条件 | 失败条目 |
| no_delivery、超 token/工具/时间预算、无理由拒绝 | +0 | +1 | 交付条件质量为 NA；总成本/耗时仍计 | 原因；不能剔除 |
| missing_input 题正确阻断、`healthy_control` 正确保留 | +1 | +1 | 不要求生成/渲染新文件 | 题型合同和阻断证据 |
| unknown：评估器无法判断，而非模型未交付 | 先不定 | 先在原分母挂起，不可当通过 | 人工仲裁；若仍 unresolved，提供上下界：`unknown=0` 与 unknown=1 | unknown 率和逐例原因 |
| infra_error：平台 crash、评估容器超配、与模型无关的浏览器失败 | 不直接记 0 | 按封存 infra-only 重跑同一模型产物/若必须重做模型 trial 则全模型成对重跑；仍无法恢复时不出确定主排名，报 ITT 最坏界、有效例数、错误率 | 环境成本单独列 | 错误证据、受影响模型/题 |
| invalid_case：输入损坏、非唯一可解/违规检查，经盲法裁决确认 | 不计 | 从所有模型相同 case对称排除，出剔除前后两版；事后修题须发布新 benchmark 版本 | NA | 审计记录及剔除时间 |
| not_run：实验组未训练/未安排 | NA | 不作为该模型分母 | NA | 不写成 0% |

[P] 设 N_planned 为协议锁定的 case-trial 总数；`N_valid` 为有效题且所有模型可比的单位数；`N_unknown` 和 N_infra 单独列。报告始终附 N_planned, N_valid, N_scored, N_unknown, N_infra, N_invalid, N_no_delivery，以及 exact case/family denominators。主成功率应保守报告含失败的 ITT 结果；如果 unknown/infra 很多，不用 complete-case 一个数掩盖它，给 worst/best bound 并注明比较受阻。人为剔除 invalid 必须盲于模型身份且对所有模型等同处理。

[P] 建议stop-the-line 阈值：preflight 的 known-good 重放不稳定，或任一 critical mutant/alternative 预期不符，禁止进入正式评分；正式 test 若 infra_error 经政策允许重放后仍 > 2% 或 scorer_unknown > 5%（初版可调整的质量阈值），暂停主排名发布、进行独立复核，不对模型单独补考。这些阈值为工程建议，不是公开研究的通用数字。

## 10. 从采集到首轮 SFT 的最小执行路线（不选择配方）

### Gate C0：采集前 / case 设计前

必须有：①任务类型与完整可见 brief、需阻断/健康的显式金标准；② case/family/source registry 和泄漏边清单；③外部依赖许可登记和离线资产校验；④已知好版 + 故障 mutant + 合理替代 + 健康控制各一组；⑤首轮评分协议 v1；⑥ evaluator 容器、浏览器截图/视频/状态证据的保存目录；⑦题目、评分器分离。

Fail/Stop：case 本身不具备合理可解性、评分要求超出 prompt、资产缺失且不是故意缺输入题、评分器未能拒绝简单伪成功。允许结果：可以继续修题或收集，不允许把失败的校准器用于模型选型。

### Gate C1：训练前 / 数据与评分器冻结

必须有：①10,697/812 的实际来源/计数/去重/题族隔离审计；②12 dev + 48 test 的 manifest、hash、题族与类型分布；③关键断言全部经过 good/mutant/alternative/healthy 测试；④同一好版重复浏览器重放稳定；⑤runner 的所有基础设施 smoke tests 稳定，预注册固定预算、失败/重试政策；⑥训练线路可变但评测 schema 和封存 test 不变；⑦有一个零训练 native-27B 的相同条件基线计划（不强制此时收费 API 运行）。

Fail/Stop：跨 split 同源泄漏无法解释，隐藏金标准暴露，无法独立重放，case 类型缺失而仍准备宣称完整能力，未知样本比例超过阈值。本报告无权启动 SFT。

### Gate C2：dev 选型 / 首轮迭代

必须有：每个候选（原生 / 单混合 SFT / 若存在其他 SFT 组 / Kimi）在固定工具+预算+观察政策跑一套 dev；至少审计每个失败 family 的 trace、browser 独立视频与 checker verdict；验证 SFT 是否出现“可运行但静止”或更简单代码能力回归；记录 checkpoint 选择与所有改动。

Fail/Stop：关键安全/健康/缺输入误操作、过度 reward hacking、评估器对已知好/坏不稳、Simple-Regression 出现超出冻结非劣界的明显退化、预算/工具缺乏公平可比性。小样本“p 没显著”不能作为训练失败的唯一停止依据。

### Gate C3：最终 test / 报告释放

必须有：模型/版本、harness image、rubric、比较假设与样本清单锁定；全模型同 case/seed index、预算、工具、观察，盲法评审；case/family/trial 三种样本量和完整异常分母；题族配对区间与原始 12 个 family 的差异向量；primary、easy regression、hard agent、no-op/block、质量与 cost 六张结果表。

Fail/Stop：结论要用修过或泄漏的 test、事后剔失败 case、改权重、给单一模型更多重试、把 infra crash 当能力；这些情况须标“本轮验证无效”并重建封存套件。测试一次后不得把 test 当 dev 无限优化。

### 最小可交付验收清单（不跑收费模型也能准备）

| 优先级 | 文件/产物 | 完成判据 |
|---|---|---|
| P0 | eval_protocol_v1.md / protocol.lock.json | 主指标、case 类型例外、预算、重试、分类、置信区间、判定词均明确 |
| P0 | cases_manifest.jsonl + lineage_edges.jsonl | 60 个计划 case 的 family/split、来源与资产 hash 可追溯；无已知跨区相连 |
| P0 | calibration_catalog.jsonl + calibration_report.md | good/mutant/alt/healthy 数据足以核对 checker 的假阳性/假阴性和重放稳定 |
| P0 | 独立 browser_evidence 规范 | 离线重放、真实浏览器、采样时间、console/network/state/video/hash 齐全 |
| P0 | run/scorecard/visual_review schema | 带错误状态的样例能通过 schema 校验；缺字段无法伪装 pass |
| P1 | pilot_analysis.py（未来实现，非本研究更改） | 对合成数据演练 family-cluster paired interval、显著性、ITT/bounds、敏感性；不读隐藏 test 解 |
| P1 | simple_regression 题族 | 可检测 answer-only SFT 对基础 Three.js/JS 代码能力的保持情况 |
| P1 | external_ood_plan.md | 来源隔离、域外轴与可用外部 benchmark mapping 明确 |

## 11. 最重要的风险、证据缺口与“仍未知”

| 等级 | 问题 | 已知/推论/未知 | 优先行动 |
|---|---|---|---|
| Critical | 代码能运行但所要求事件、时间顺序、运动机制不正确 | [F] 不同领域有大量类似失败，[S6][S7][S8][S9]；本项目发生率 [U] | G1 与 G2 分开、隐藏事件/状态探针和视频交叉证据 |
| Critical | evaluator 过严/过松导致模型“排名”错误 | [F] OpenAI 审计证实广泛风险，[S1][S2]；本地检查器是否中招 [U] | good/mutant/alternative/healthy 校准；人工核对多模型错判 |
| Critical | 训练资料与封存题族共享源码/资产/模板或早已被老师模型见过 | [F] 公开评测污染确有风险，[S1]；项目 lineage [U] | provenance graph、跨 split hash+近重叠人工审核、隐藏 test |
| High | 12 test families 独立信息量太少，重复 trial 错当新增样本 | [P] 基于聚类统计推论；题族真实相关程度 [U] | 报 12 family paired deltas、cluster CI、使用外部新题族扩大验证 |
| High | 视觉判定受模型家族、帧选择、盲评顺序影响 | [F] VibePrevisBench 样本级评审相关低于模型榜单级，[S7]；本项目误差 [U] | 人类盲评 + VLM 校准；时间窗证据、交换 A/B 顺序 |
| High | 浏览器/容器 OOM、网络请求、浏览器版本污染成功率 | [F] Anthropic 在 Terminal-Bench 2.0 同模型不同资源差 6 个百分点，[S4]；本项目尚未测 | 固定资源、网络关闭、preflight/replay、独立 infra 分母 |
| High | SFT 改善执行率而降低实际动态质量 | [F] Animation2Code 在其 web 动画重建实验观察到此现象，[S9]；Three.js 任务是否类似 [U] | Simple-Regression 与 Hard-Agent 双轨、static-rate、事件时间质量 |
| Medium | 为对齐 Kimi/学生误把不同视觉输入和运行预算视作公平 | [I] harness 可改变能力，[S3][S5]；当前运行接口 [U] | 控制对照 + system-to-system 分表，不混淆 |
| Medium | WorldCoder/Blender 任务的物理与视觉协议迁移过度 | [I] 原任务与本项目不完全一致 | 只迁移机制，不搬分数阈值；逐项建立本项目的 contract |
| Medium | 外部公开基准并非独立 OOD，因为模型可能已预训练或训练集包含同源数据 | [F] 污染风险，[S1]；目标模型训练信息 [U] | 外部作者新作、时间切分、搜相似代码、承认无法证明零污染 |

仍需实测、不可代答的八项：

1. evals/cases.json 与 evals/collection-v1/cases.json 的题族、重复率、交叉任务类型分布；
2. scripts/check_case.py 与 scripts/check_claude_case.mjs 是否只做语法/字符串/静态页面检查，是否校准过语义/时间/视觉；
3. runs/collection-preflight/fixtures-v1/summary.json 的好/坏/替代/健康分母和误判详情；
4. reports/validation-v0.md 与 quality-review/final-review.md 的原始评分依据、盲评人数/题数、失败切片；
5. replay.py、`metrics.py` 的具体计数、异常、重放 seed 和工具 retry 语义；
6. 10,697/812 对应的真实 raw source 与训练 trace 的来源图（以及素材权利）；
7. 模型侧是否可看到真实 video/image、多帧图、浏览器状态，哪些 API token/成本可追踪；
8. 12 个新 test 家族是否真与训练/dev 完全独立、将来的 OOD 轴是否构成业务代表性样本。

针对本地文件的只读检查顺序：先 README.md 与 decisions.md 抽取事实性接口/硬约束（不能照搬其他 AI 的调研结论）；再两份计划确认协议分歧；解析两份 cases 并建 family lineage；逐项查看两个 checker 的 pass 条件；对原始 preflight 的各个 fixture 对照工具日志与渲染证据；最后追溯 validation/quality-review 的原始 run 和原始视频。对于 replay.py/metrics.py 重点审核是否误将 retry 当新增样本、infra error 当失败、帧当 case。无法访问时保留 [U]，不能“合理猜测补完”。

## 12. 一手证据清单（标题、URL、定位、可迁移边界）

| ID | 一手来源 | 核验定位、数字/适用范围 | 迁移边界 |
|---|---|---|---|
| S1 | OpenAI, Why we no longer evaluate SWE-bench Verified (2026-02-23). https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/ | Too narrow and too wide tests, Contamination, Discussion：审计对象是 500 题 Verified 中按 o3 在 64 次试跑里不稳定解决 筛出的 138 题；其中 59.4% 存在实质问题，不可说整体 500 题 59.4% 损坏；公众题及公开 PR 有污染风险。 | SWE/Python 修复题，不是 Three.js；用作评估器可靠性警示。 |
| S2 | OpenAI, Separating signal from noise in coding evaluations (2026-07-08). https://openai.com/index/separating-signal-from-noise-coding-evaluations/ | Methodology, Human-supervised agent review, Human annotation campaign：SWE-bench Pro 的 731 题 public split，自动深入审计得 200/731=27.4% broken，人工标注 249/731=34.1%（不同途径口径）；错误四类：overly strict、underspecified、low coverage、misleading prompt。 | 这是该版本公开 split 的作者审计，不是项目缺陷率。 |
| S3 | Anthropic, Demystifying evals for AI agents (2026-01-09). https://www.anthropic.com/research/demystifying-evals-for-ai-agents | Types of graders, Capability vs. regression evals, How to think about non-determinism, Going from zero to one：代码、模型、人评互补；`pass@k` vs pass^k 不同；20–50 条小 eval 可作为开发起点；参考好版/读轨迹。 | 产品/Agent eval 方法论，不是针对 3D 动画的阈值。 |
| S4 | Anthropic, Quantifying infrastructure noise in agentic coding evals (2026-02-05). https://www.anthropic.com/research/infrastructure-noise | How we got here, How this affects measurement：在其 Terminal-Bench 2.0 内实验，同模型/harness/task 改资源，1x 到 uncapped 成功率相差 6 个百分点（p<0.01），infra error 5.8%→0.5%；非所有基准。 | 资源效应在本项目需自行测定。 |
| S5 | OpenAI, A shared playbook for trustworthy third party evaluations (2026-05-29). https://openai.com/index/trustworthy-third-party-evaluations-foundations/ | Selecting the right harness, Contamination, Broken problems：对照试验共享 harness/预算；强诱发能力测量可用优化系统，须区分 claim；报告 reward hacking、污染、错误题和拒绝。 | 指导结论边界，不声称任何模型 3D 性能。 |
| S6 | Lu et al., WorldCoder-Bench: Benchmarking Physically Grounded 3D World Synthesis (2026). https://arxiv.org/html/2606.01869 ; 原始项目 https://github.com/shuolucs/WorldCoder-Bench | §2–3、§3.2 Mutation-Hardened Contracts、§3.3 Execution Protocol、§3.4、附录 F：论文描述 2,026 题，15 域，公版 205 core 题、74 个 shared GLB（以仓库数据发布说明为准）；浏览器 StateProbe + 隐藏状态契约和 mutant；论文最好 core V-Cov 27.8%，robust 19.9%，分别限原文模型集/口径。GitHub 项目页明确未提供 StateProbe 实现，不能假装已在本地复跑。 | 最直接适配 Three.js 行为检查，但含交互/物理不全是动画，也不是 Agent 多轮轨迹。 |
| S7 | VibePrevisBench: Evaluating Agentic Coding for 4D Scene Generation in Blender (2026-11). https://arxiv.org/html/2611.15789 ; 原始项目 https://vibeprevisbench.github.io/ | §3.2、Table 2、Appendix B.2–B.4：242 任务、11 agents；三个 delivery gates，rule scene + VLM screen；作者报告同运行重复计分一致、故障注入灵敏度；跨 11 模型聚合 score 相关 ≠ 逐视频相关（原文单 run Spearman 约 0.73–0.79）。 | Blender previs，实物/镜头/复杂时序；不能直接复制 .blend 交付要求给 Three.js。 |
| S8 | Shao et al., PhysCodeGym: Benchmarking Coding Agents for Physically Verifiable 4D Reconstruction (2026-10). https://arxiv.org/html/2610.17288 ; code https://github.com/ShaoShuai0605/PhysCodeGym | §3.1、§4.3、Appendix B：156 video→Blender 物理重建 tasks，事件/运动/视觉/物理等互补，按 rubric 进行程序测量、可选 counterfactual intervention；一次视频看对不能证明机制正确。 | 仅对要求物理规律/接触机制的 Three.js 子任务设反事实检查；一般关键帧动画不能强制物理仿真。 |
| S9 | Ji et al., Animation2Code: Evaluating Temporal Visual Reasoning in Video-to-Code Generation (2026-06). https://arxiv.org/html/2606.28593 ; project https://anya-ji.github.io/animation2code-website/ | §2、§3 Appearance/Temporal、§3.1 Validating Metrics、Table 2、§4：1,069 video–HTML/CSS/JS pairs；外观 DreamSim+DTW 与 tracklet-based temporal 分开；作者实验中代码执行接近饱和，某些 SFT 组出现执行改善但运动/视觉退化、静态渲染上升；原文有 human preference 对齐研究。 | 是视频→网页代码，不等于文字→Three.js 的多轮 agent；迁移“动态独立评分”而非直接使用其测试视频作公平任务。 |
| S10 | Gao et al., 3DCodeVerse: Exploring 3D Worlds as Code. 原始项目 https://github.com/gaoypeng/3dcodeverse ; harness https://github.com/gaoypeng/3dcodeverse/blob/main/harness/README.md ; finetune https://github.com/gaoypeng/3dcodeverse/blob/main/finetune/README.md | 项目 Highlights, harness instruments/judge, finetune Train/export/evaluate：多语言（Three.js/Blender/CAD）可执行图形代码与 visual judge/repair，公开作者报告 Qwen3.8-27B 在其 3DCodeBench execution 51.9%→92.9%（该基准 execution，不是本项目动画成功率）。代码开放程度依 README；不能从此得出本项目预期提升。 | 与代码生成/编辑的基础能力接近；测试数据可能与项目训练来源重复，要做污染核查。 |
| S11 | Yao et al., τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains (2024). https://arxiv.org/html/2406.12045 ; original https://github.com/sierra-research/tau-bench | §3、§5、`pass^k`：对话 Agent、工具、可变数据库最终状态和多次 trial 可靠性；原代码仓库当前提示原任务版本已过时、迁往 τ³-bench。 | 迁移任务末态、依赖操作与重复 trial 的统计纪律，不迁移业务任务/数据库评分。 |
| S12 | Microsoft Playwright Clock https://playwright.dev/docs/api/class-clock | API 文档 install / runFor / fastForward 对计时器和 RAF 的可控性；应先对 Three.js 更新循环做本地好版验证。 | 不是充分的物理逐帧证明。 |
| S13 | Playwright Network https://playwright.dev/docs/network ; Three.js WebGLRenderer https://threejs.org/docs/pages/WebGLRenderer | Network: route/`serviceWorkers:'block'` 避免请求被 SW 绕过；WebGLRenderer: render loop/renderer state。 | 有助浏览器证据链；实际 GPU/软件版本仍需记录。 |

来源状态注意：全部已通过网络检索并查看论文 HTML、官方页面或原始 GitHub README；没有执行这些公开仓库的自动测试，也没有在项目本地使用它们的检查器。论文/技术报告中的数字已注明对应任务集和分母/单位，不作为本地实测数据。文献之间的方法可迁移，但本报告的 δ_min、停止阈值、建议样本数和字段设计均属于 [P]。

## 13. 本研究的最终可执行建议（不更改训练决策）

首轮 SFT 之前，最小充分工作不是马上扩大试题数量，而是先让每个 case 有：`不可泄漏的任务合同 + 已知好版 + 指向一个明确错误的坏版 + 合理替代版 + 健康控制 + 可独立重放的浏览器证据 + family/source lineage`。只有这些通过校准，模型输出的成功率才有解释价值。

在 6×2 dev + 12×4 test 的预算不变时，把 dev 当调试和配置试验集，把 test 当一次性的小规模独立确认集：主要对结论是“在这 12 个新题族、这个固定 harness 与预算下，端到端成功率是否有明显改变”，而不是“已证明模型普遍掌握 3D Animation Agent 或模型之间 3%–5% 差异”。是否先训混合 SFT，或以后补 one-shot/multi-turn 的分组，均不影响这个评估底座。

下一步一旦可访问项目目录，应优先对题包、checker、preflight、历史原始 run 做第 §11 条目 1–5 的只读复核，以“已复现证据”替换 [U]；若结论与本建议冲突，以原始实际执行证据优先修订报告，而不是反向改写评估器以迎合模型。
