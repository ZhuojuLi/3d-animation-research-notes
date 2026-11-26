# 三轨合训全链路独立工程审计

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

2026-11-26 · Astra · 本地工作树与已落盘 JSONL 快照

## 1　放行意见

**大规模 CAD/2D 采集与三轨正式合训均为 No-Go。** 首先修正交付与验收入口，再做小批采集。外部 XHS 可以继续做离线预处理。当前训练集已经能表达二值轮级监督，但“导出成功”离“合训保留了指定任务、图像和有效梯度比例”还有三个可复现的断点。

1. **采集器会教错交付契约。** CAD 入口只收单个模型文件，独立复验也只交入一个源文件。2D 验收拦截页面自身之外的本地脚本和样式。合规的多文件工程会被错拒，旧单文件作品仍可能过关。旧 CAD 九题原样转换只通过四题。
2. **自产长会话缺少与压缩事件绑定的段身份。** 抓包后按请求重建、按消息前缀保留最长链。比较器忽略调用参数，实测两条不同调用能被判为同一前缀；改写历史又会分裂成多条链。桥接器拒绝终端挂起的调用，Best-of-2 还要求恰好导出一行。这三步都可能使有价值的长程过程消失。
3. **统一转换器会把损坏输入写成可训练动作。** 纯函数复现了非法 Write 参数变为无参数调用、孤立结果通过、被掩末轮通过，以及非空数学思考被清空。混入旧 Ready 会凭空插入工具结果。现有 XHS 文件重算成功和这些缺陷同时成立。
4. **600 条 SWE 全部以提交命令结束。** 这是源任务的终止动作；同样的 XML 末轮在编码任务中也可能表示等待工具结果或一次压缩边界。按“最后是 assistant”无法区分。XHS 训练前 16 段还真实监督了评测不提供的 Task 系列、WebFetch 和 Skill。
5. **训推预算与度量分母不同。** XHS 前四段的可训练正文近似 token 数已达 982,645，SWE 前十二行合计 166,788。按行数混 600 条无法证明 SWE 获得标准要求的 10–15% 有效监督。评测默认 262,144 上下文、64 图、xhigh，训练入口默认 393,216；前 16 段中已有超过评测图数上限的样本。

## 2　数据取证与范围

路径简写均相对于 `${WORKSPACE}/`。下文脚本短名默认位于 `3d-animation-agent/scripts/`；`T/` 为其 `train_xhs_27b_lora/`，`E/` 为 `eval_xhs_threejs/`，`P/` 为 `repos-logging-proxy/`，`U/` 为 `research/3DCodeFactory-repo/src/code3dfactory/`。规范指 `3d-animation-agent/docs/`。数据目录 D 为 `${SHARED_DATA}/3d-animation-reports/xhs-threejs-sft-20261126/`，R 为 `3d-animation-agent/reports/`。下述“实测”均为本次只读抽样或内存复现；“产线计数”专指生产脚本自己的落盘统计。“推论”描述可能造成的后果，“门禁”是建议验收值。

|样本及选择方式|实测消息、媒体与末轮|工具及系统|
|---|---|---|
|D/train-xhs-threejs.jsonl 行 1–16；与 D/train-xhs-threejs-plus-swe.ready.jsonl 行 1–16 配对|6 个 task，6 before + 10 recovery，2,086 assistant，10 个原生 loss=False（恰为 10 个 recovery 首助理轮）；723 占位/723 图片引用，690 个不同路径。调用结尾 10/16（before 6/6、recovery 4/10）。其余六段正文均非左花括号开头，五段含代码围栏。按 convert_record 重算逐对象完全相等 16/16，产生 374 个空思考屏蔽。|16/16 初始 system 含 Claude Code 等实际环境文本，其长度范围 6,035–13,095 字符；25 工具、两种完整 schema 指纹；16/16 消息含 /output、/workspace、/task 和 system-reminder，0/16 含 total_tokens 标签。路径是全文子串统计，不能据此倒推出真实 cwd。|
|D/val-xhs-threejs.jsonl 行 1–4|2 task，before/recovery 各 2；499 assistant，2 个原生屏蔽，3/4 调用结尾，170 占位/170 引用|25 工具，system 长度亦为 6,035–13,095|
|D/train-xhs-threejs-plus-swe.jsonl 尾部追加区，从纯 XHS 文件字节长度定位；读前 12 行做细查，单独统计 600 行末轮|细查 310 assistant，无图、无显式屏蔽，转换通过 12/12。600/600 末条是带调用的 assistant，参数均包含 COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT，未以普通答复收尾。该命令标志不等于独立执行成功。|12/12 单工具小写 bash，system 95 字符，native 顶层只有 uuid/model/tools/messages，无 task_key、交付契约。|
|R/cad-print-seed-baseline-20261125-001/swift-smoke-masked/print-*/native-swift.jsonl，按目录名排序，九文件各第一行|63 assistant、4 个原生屏蔽；10 占位/10 引用。9/9 均无末轮调用，末轮正文均非左花括号开头；9/9 消息含 /tmp/cad3d-ws。5/9 被 convert_record 拒收；九题中含确切宿主前缀 ${WORKSPACE} 的消息共 7 个 tool、4 个 assistant。|9/9 初始 system 长 5,215，6 工具同一指纹；有 uuid/model/capture_mode，无 track/task_key/segment_type。|
|R/round2-canary-20261124-001/distill/react-raw.native-swift.jsonl 行 1–3，历史自产对照|123 assistant、43 占位/43 引用，三条均以文本收尾，三条都被当前宿主过滤拒收；图片中有 RGB、RGBA|6 工具，system 长 4,903–4,916。此批不能替代未来 2D 数据。|
|3d-animation-agent/evals/2d-v2-counterexamples/verification-evidence/*/{good,bad}/result.json|已有 18 份机器判定，9/9 good 为 ok=true，9/9 bad 为 false；本次只读 JSON，未重跑页面。|这是老验收器的反例基线。在简报指定的 reports/data 范围未取得新 2D 长程 Native/Ready 对。|

**产线分母。** D/export-summary.json 记录发现及导出均为 249 个 shard，训练 3,743 段/1,262 个任务，验证 146/49，task_key 交集 0；训练 before/recovery/main 为 1,249/2,491/3，验证为 49/97/0。排除 Blender 12,628、compact_task 2,586、CAD 22、unknown 17、子代理 1。文档的 401 分片目标不能写成这批已处理 401。D/train-xhs-threejs-plus-swe.ready.stats.json 记录 4,343 出、0 拒、0 参数解析失败、0 末轮已掩、82,397 个合成空思考屏蔽，137,979 图次、单行最多 141；D/val-xhs-threejs.ready.stats.json 为 146 出、0 拒、最多 88 图。train/val 两者统计发生在 Swift encode/delete **之前**。没有重扫压缩包或全量重算这些数。

**复查口径。** JSONL 使用逐行 json.loads；图片按路径去重读头，首个训练样本按出现顺序取前 8 个不同图片，8/8 的 SHA-256 与文件 stem 相等。训练前 16 段每段首图的实际格式为 JPEG 14、PNG 2。完整工具指纹使用 SHA-256(json.dumps(tools, sort_keys=True, ensure_ascii=False).encode()) 前十位，含描述、参数和工具顺序。XHS 两种为 1f56e02c8d / 82b50f99c0，自产六工具为 856dc9fa80，SWE 为 1f8021b58a。样本是可复查的连续段和旧 Canary，所有抽样率仅对各自分母成立。

## 3　从采集到验收的证据链

### 3.1　任务、启动参数和运行目录

- **事实。** U/docker_agent.py:97–129 把任务和 runtime 指令追加到 system，要求读 /task/input.json、写 /output、仅返回所需 JSON；调用 claude --bare，传 --allowedTools Read Write Edit Bash，Blender 才追加 MCP 配置，未传相同的 --tools 限制声明集合。还有 --max-turns；第 14–16、148–150 行的 exec/view_image 属另一入口。U/workflow.py:87 有提交到 /output/artifact 的阶段指令。采集到的公开数据需以实际导出的 messages/tools 为准，不能由当前仓库代码还原每行当年启动参数。
- **事实。** run_claude_cases.py:195–205、241–263、298–349、465–482 和 run_cad_cases.py:44–68、225–273、380–393 都用非 bare、同时传 --tools/--allowedTools 六工具、隔离配置来源和 MCP。动画默认 medium、32,768 输出；CAD 默认 DeepSeek high、Qwen medium、32,768 输出，按 build/repair/edit/healthy 设 24/18/18/12 轮。动画 Qwen 配置默认 compact_window=65536，另一配置为 None；有值才设置环境变量，未设置不代表客户端永不压缩。CAD 的提前停手提示和动画 file:// 交付提示都会进入教师上下文。每 trial 的 /tmp/anim3d-ws 或 /tmp/cad3d-ws 是宿主临时 cwd；隔离的工作目录和依赖软链不能证明助手永远看不到宿主路径。
- **真实暴露。** 前 16 个 XHS 样本同名集合为 Agent、Bash、CronCreate/Delete/List、Edit、EnterWorktree、ExitWorktree、ListAgents、NotebookEdit、Read、ReportFindings、ScheduleWakeup、SendMessage、Skill、TaskCreate/Get/List/Output/Stop/Update、WebFetch、WebSearch、Workflow、Write。该样本没有 TodoWrite、mcp__*、Glob、Grep；自产六工具为 Bash/Edit/Glob/Grep/Read/Write，SWE 只有 bash。Read 的 parameters 指纹两源相同（26f36fe6e7，required 为 file_path），完整 schema 却不同。前 16 段可训练调用中 Bash 1,256、Read 811、Edit 314、Write 26、TaskUpdate 28、TaskCreate 17，WebFetch/Skill/TaskOutput/TaskStop 各 1。工具声明、实际调用和执行许可须分别建账。简单删掉 19 个定义会留下真实的无定义调用。P/process_logs.py:30–52 把 Anthropic input_schema 原样映射为 function.parameters，未知形态透传；T/convert_native_to_xhs_ready.py:335–347 对已是字符串的 tools 不解析校验。
- **交付错位。** THREE-TRACK-DELIVERABLE-SPEC.md:16,27–32,41 和 XHS-UNIFIED-SFT-STANDARD.md:13–23 要求多文件、交付分类、合法压缩段、二值监督与三轨任务验收。configs/taxonomies/{anim2d_tree_v2_0,cadquery_tree_v2_0}.json 均为 v2.0，各 5 个 domains、20 个 leaves、4 个排除的 OOD 条目；contract_schema.json 定义四项契约、六个 track。export_xhs_threejs_sft.py:74–85 对所有 XHS 固定写交互切换契约，该元数据没有逐题验真。run_claude_cases.py:72–94,318–320,416–426 注入离线单页 Three.js 契约并调旧 checker；check_2d_v2.mjs:137–153 只放行目标 file URL、data/blob，合法的同源 css、src 模块、vendor/gsap.min.js 也会被当外部资源。其 renderAt 和 scrub 测试仍可复用（268、361–366）。
- **CAD 硬断点。** run_cad_cases.py:129–146,152–180,314 备料、取件和独立复验都围绕 src/model.py；cad_inspect.py:73–94,249–256,300–332 审单文件并复制到临时工程，检查 STL/3MF/GLB，没有覆盖多模块参数化装配与 STEP 独立回读。规格允许复杂单件走单文件例外，但多体题缺失件、干涉或漏 STEP 未被这条入口充分判定。Three.js 筛选器 threejs_rubric_synth.py:65、threejs_rubric_judge.py:139,380、run_threejs_best_of_2.py:40–65 以该轨题包和多次合格评分选优，不能替代几何/2D 运动断言。

### 3.2　抓包、图片、切段及掩码

- **抓包事实。** logging_proxy_capture.py:152–207,216–233 为 trial 单设日志和图片目录，在 loopback 动态端口建服务并在退出时统计 coverage。P/logging_proxy.py:44–77,94–119 将两种 API 的内联图按原始字节 SHA-256 外置，P/process_logs.py:549–588 逐 request_id 将完整请求历史加响应组装成 session，缺一侧则跳过。logging_proxy_to_swift.py:775–805 解引用并验实际 SHA，按出现次序追加绝对路径，每次出现都要留占位；磁盘去重与对话轮次去重是两个不同分母。XHS 的 inspect_and_clean_3dcodefactory.py:328–342,395–428 按源块顺序外置 base64，用随机临时名替换，已存在同名文件时不重新验 SHA。
- **顺序缺陷已复现。** P/process_logs.py:367–381,413–430,439–451 先汇总 text，再追加 image，工具结果也先于同消息的普通内容。内存输入 user=[text A,image I,text B]，实际得到 [text "A B",image I]；工具内嵌块也走分组。两幅图间的“修改前/修改后”标签可能错配，即使数量相等、两张图各自哈希正确。桥接和 Ready 的计数门无法发现。
- **像素预算事实与推论。** 旧 CAD 十图为 8 张 1280×960 RGB、2 张 640×480 RGB；XHS 训练抽样不同路径中 768×512 RGB 有 143 张、1536×1024 RGB 有 125 张。threejs_rubric_judge.py:74–105,121–135 的特写拼图为 2×2、每格画面 640×420、另加 26 像素标签栏，互动图格为 640×(360+26)；这些是评审拼图，只有进入模型请求才会成为训练图。inspect_and_clean_3dcodefactory.py:278–284 与 run_threejs_best_of_2.py:109–113 按字符/3.3 加每图 2,000 估算。实际基座 ${MODEL_ROOT}/Qwen3.8-27B/config.json:134–135 为 patch=16、空间 merge=2。若 401408 为生效面积上界、按 32×32 合并网格，则面积商是 **392**；512 是另一个启动上限，不能视为每图实际 token。原始 1280×960 四视拼图若按面积等比缩，线性倍率约 0.57，细孔可能丢失；需实测 processor 的有效上限优先级、倍数取整和 grid_thw，再以局部原图检验可辨性。没有观测到模型识别成功率。
- **XHS 切段。** U/trajectory.py:116–147 既识别 compaction boundary 并生成 user 摘要，也有估算窗口补切；不能将该参考实现推定为所有发布行的原始事件日志。实际复入由 inspect_and_clean_3dcodefactory.py:107–163,192–201 与 export_xhs_threejs_sft.py:50–72,125–129,153,189–203 根据 backend、ID、后缀选段并按 task_key 哈希分组。cleaner:375–391 删除 system 内 total_tokens，前几个位置的附录合入 system[0]，后续提醒折入前置 user/tool，若紧邻 assistant 则新增 user。cleaner:472–495 先剥尾部非 assistant（并回退图片），拒绝末轮 masked；before **和 recovery** 均可留末条调用；:518–545 查重复、孤立及未闭合 ID，但空 ID 跳过，set 无法辨出同一有效 ID 回两次。样本首两种段中可见长短不同的起始 user；首个 recovery 的屏蔽不是整段都不训练。
- **自产压缩机制。** P/process_logs.py:684–729,747–783 的前缀比较看 role/content/reasoning/tool_call_id，忽略 assistant.tool_calls 和 session.tools；按消息数降序保留不被覆盖的链。内存中相同文本、不同调用 ID 的两条历史返回 is_prefix_of=True。摘要替换旧历史通常打破前缀；桥接 export_logging_proxy:1051–1066,1088–1100 会对留下的每条链分别验证，没有恢复父段、摘要请求与恢复请求的固有标志。validate_and_bridge_session:848–860,883–889,910–925 拒末尾调用、未答调用、异常末轮；旧段恰以调用截断时会被拒，纯文本摘要任务若满足门限则可能混入。run_threejs_best_of_2.py:67–89,109–116,302 默认要求 accepted==1、实际一行，估算 >172000 另标待切。一次成功的多段 trial 不能直接通过这套筛选。未观察到新 CAD/2D 中真实压缩事件率。
- **五规则确有差异。** U/trajectory.py:191–266,292 对协议泄漏（含伪调用）、重复推理、对应工具执行错误、已训练 call_id 重复、异常结束做 mask；保留已有布尔 mask，trained_call_ids 传跨段。XHS cleaner:464–466 只将已有 true 取反成 loss=False，不重新跑五条。自产 apply_turn_loss_masks（logging_proxy_to_swift.py:315–352,391–458,466–478）按错误 ID/工具名/文本判别，识别结构化 verifier 报告先于 raw_is_error；协议与重复文本另判，trained_call_ids 在每个 session 内重置，所谓 duplicate_target 比的是 ID 而非路径。自产异常截断依靠 finish_reason/原始末响应；空中间 assistant 另在 :853–857 触发整段拒收。P/process_logs.py:570–576 未保留 Anthropic 响应 stop_reason；桥接 :874–876,1026–1035,1097–1099 只向保留 session 传对应请求的 raw_final_truncated。较早一次 length 后仍继续生成时，该坏轮有逃逸路径。中间坏轮可屏蔽、后续纠错可训练；末轮坏则自产默认整条拒。应保存坏轮原因与原始 turn_id 后再切段。

### 3.3　Ready、标签、混训与计量

- **统一转换事实。** T/convert_native_to_xhs_ready.py:66–87,143–167,170–227 将中途 system 就地折为提醒、连续工具观察包成 user、assistant 的 reasoning 和 XML 工具调用转为文本。空思考有正文时拆成相邻的 assistant(False) 和 assistant(True)，整个原轮 masked 时保留整轮 False。:249–259 无首 system 会补默认文本，:273–276 相邻原 assistant 会插空 tool_response，:289–325 剥尾、只检测存在任一训练轮、计数末轮已掩。:321–347 检查占位数与三个消息路径子串，输出仅 tools(JSON 字符串)、messages、images，丢失 task_key、边界类型、来源、验收与轨道。:392–405,481–483 拒行被跳过，尚有一条成功即可正常退出。样本 CAD 路径误差已实际改变准入比例。
- **纯函数反例。** 以 user、含 reasoning=ok 的有效 assistant、user 构成前缀。在末轮分别放 Write(arguments="{")、正常正文但 loss=False、reasoning_content="Δθ≈π"。三组均返回 Ready，统计分别是 arg_parse_failures=1、last_assistant_masked=1、empty_think_masked=1。第一组仍监督无参数 Write；第三组丢数学符号。原因在 :30,90–114,124–139,217–224,318–319；空正则只承认 ASCII 字母数字和部分汉字。另一例 user → tool(id=unknown) → 有效 assistant 也获准，因工具结果在校验前已经失去身份。自产桥 :708,751–755,848–850 用 pending set 只移除匹配项，同样缺孤立结果的显式拒因。目标是校验前保真，不能用格式合法代替回合合法。
- **两条 Ready 路线不可串用。** qwen38_swift_normalize.py:35–52,69–99 用 tokenizer medium 模板渲染并保留子消息，build_ready_preserve_media.py:29–48,58–75 还可剔除过长非空思考、保留历史权重与媒体。convert_and_validate_swift_ready.py:57–60 实际调用该路线。旧 CAD 的 swift-smoke-masked/ready-validated/ready.jsonl 第一行有 16 个训练子消息，权重 0.5/1.0/2.0 分别 6/5/5。把该行误作 Native 喂统一转换器，先统计到 10 次伪工具结果插入，再因宿主路径被拒。已有 Ready 的正确接入点应回溯 Native；在无宿主泄漏的旧 Ready 上，这个插入逻辑不会因此自动报错。
- **路径边界。** T/convert_native_to_xhs_ready.py:31–35,327–342 仅查 messages 中三个固定前缀，未覆盖其他用户、${SHARED_DATA} 或 tools 描述；图文件定位路径本身不应一律删除。launch_h100_lora.sh:134–142 只把 DATA_DIR、RUN_DIR 与模型等挂入容器，实测 CAD 图位于项目 reports 树；即使消息已过筛，直接拼接也可能在训练命名空间找不到图。
- **有效监督。** 冻结口径应为真实模板 encode 后 labels != -100 的 U，先扣 delete，再按实际 pack 和步聚合。用本机基座 tokenizer.json 对每个 loss=True 子消息的 content 独立 encode（无 special tokens 添加，不含 EOS、角色包装与视觉处理），XHS Ready 行 1–4 的正文 token 范围 140,145–324,766，中位 258,867；SWE 尾区前 12 行范围 4,604–23,000，中位 13,083；九个 CAD 中通过的四行范围 1,775–3,869，中位 2,026.5。该值是量级探针，不能外推全库权重。XHS 前四行所有角色正文分别 337,864、336,893、236,067、350,700 token，还要加工具表、图片等。长行更接近 delete 边界；行数占比 600/4343=13.8% 与 SWE 的 U 占比是两种指标。
- **打包与重复。** T/launch_h100_lora.sh:26–39,157–180 使用 393216 max_length 和 packing_length、delete、strict false、binpack、双 shuffle、binary、per-token loss、TP4/PP1/CP2、GBS16，默认一 epoch。delete 配置提议删除超界样本；实际各轨删除数、训练器聚合分母未实跑。binpack 不会均衡各轨 U；长思考和长 Write 可主导某步。XHS 平均 2.97 段/训练任务，前 16 段对同一 task 各段可训练 assistant 完整消息集合求交并计重复差额为 0；已证实的是任务重复曝光，不应宣称所有 recovery 都逐字重复前段监督。旧全参 train_round2_v3/launch_v3_node.sh:167–178 为 packing_length=65536、max_length=180224、binary=false、delete、per-token=true。切换全参绝不能沿用 LoRA 留存率。禁用 binary 快捷路径本身也不证明每条训练数据都具有连续权重。
- **插件和审计盲区。** T/round2_v3_plugin.py:35–58,74–99,131–164 对 GDN、Triton、LoRA sequence parallel 做运行时补丁；:195–226 在 prepare_batch 前按 rank 选代表计 tokens/images，:249,286–307,313–335 汇总指标。记录本地 loss 后跨 rank MAX 不保证是全局按 token 加权 loss；没有按轨、任务、段及掩码原因归因，也不能从该监控推断训练梯度错误。LoRA 默认 RUN_DIR 插件与 T 下 SHA 同为 c3255e66…，旧全参同名插件为 48dfcdfe…。T/audit_ms_swift_labels.py:93–125,131–175 的 sentinel 和少量桶抽样值得保留；“有 False”桶也包含合成空 think，不能代表异常坏轮覆盖；整行存在有效 labels 不能证明 EOS/边界标签正确。
- **额外可复现启动错误。** T/launch_h100_lora.sh:53 的 Bash 参数默认值含 JSON 花括号。本次只执行这行变量赋值，默认值是有效 JSON；传入覆盖值 {"rope_type":"yarn","factor":1.5} 时实际字符串末尾多一个右花括号。预检 :96–111 不解析它，错误延迟至训练入口 :159。

### 3.4　推理与评测

- **事实。** E/run_xhs_eval.py:191–224,361–375,476–500,612–615 提供 LoRA 注册、qwen3_xml、qwen3 reasoning parser、--bare、六工具；cwd=/workspace，依赖 /workspace/vendor，产物在 /workspace/output。max_model_len=262144、max_output=65536、compact_window=200000，单请求限 64 图，未在该命令显式传训练的像素组合。训练抽样 3/16 行图数大于 64。单段总图数不等于实际某次在线请求图数，但整段回放需处理这一上限。
- **模板和因果位置。** 实际服务引用的 ${SHARED_DATA}/3d-agent-sft/round2-v3-full-20261125/chat_template.compat.jinja 与 configs/chat_template.qwen38-compat.jinja SHA 同为 37a725ab…；:47–68 将除 medium/low 之外的值（包括 high、未知值）归 xhigh 并添加文字指令，medium 无前缀；:107–111 支持中途 system 就地输出。服务默认 xhigh，训练命令没有显式传 reasoning_effort，标准写明目标为无前缀 medium。E/compat.py:38–60,164–185 优先拦截带 embedded system 的请求，把所有 embedded 文本无分隔拼到顶级 system，后续轮才有的提醒被提前到首轮；无 embedded 时直接返回，不去 billing；字符串分支也不滤 billing。清洗端选择删除 token 计数或就地折入 user/tool；这三条处理路径不同。:201–228 遇特定 400 上下文报错，按 max_ctx−input−512 再试一次且至少留 2048；实际输出预算因此按题变化。每个 arm 的最终生效档位、token 序列、视觉网格与 clamp 率仍需实测。
- **评测污染。** E/build_xhs_val_suite.py:48–66 在尚未见 reference-0 Read 时，遇到第一张工具图就可能返回；不命中时又回退 images[0]。先观察草图、后读题图的样本可能拿错参考图。:104–119 只从 compact_before 构建题并检查 train_key 交集；:142–151 将图转 RGB PNG。E/run_xhs_eval.py:448–452 根据 case/arm 目录里两个文件直接复用，未比对权重、模板、数据、预算或 verifier 指纹；同名 arm/不同权重可能回陈旧分数。E/verify_xhs_output.cjs:348–391,498–545 从 HTTP 加载、观测错误、像素与交互，L1/L2/L3 和 UI 效果面向 Three.js。run_one_trial:524–539 把 timeout/rc 与 tiers 分列，不能只凭某级通过判定完整停机。CAD 需独立回读与改参，2D 需逆序渲染与时序断言，SWE 防遗忘需独立任务测验。

## 4　修改单和上线门禁

以下为建议实施与可机器断言的验收条件，均未修改生产代码。

|优先级|入口与具体改法|回归夹具与放行条件|
|---|---|---|
|P0 采集契约|run_claude_cases.build_claude_command 与构造 prompt/checker 的调用方；run_cad_cases.run_one_cad_case / verify_delivered_model；cad_inspect.inspect_cad_model；check_2d_v2 的 URL/router。按 track+delivery_contract 分发 cwd、提示、资源、轮限与验收器。CAD 复制完整模块树，逐文件检查、再重建导出并独立回读四格式；2D 用只读本地根提供 HTTP，允许同源资源。|2D 本地 css/src/vendor 合规样本通过，缺模块、外链、假 renderAt 各失败；旧 9 对 good/bad 结果保持。CAD params+parts+assembly 双体装配能改参，缺 STEP、空 3MF、干涉/间隙超差和丢模块各有独立失败码；合法复杂单件仍通过。启动参数快照断言高难模式不附旧 file/收敛提示，逐题固定并记录 bare、工具、输出和轮限。|
|P0 抓包与切段|P/process_logs.convert_anthropic_messages 以原始 block ordinal 流式还原；process_log_entries/is_prefix_of 和 logging_proxy_to_swift.export_logging_proxy 保存 episode/parent/turn/request、stop_reason、schema 指纹，用严格调用签名和真实摘要边界组链，标记 summary-only 与 recovery。run_threejs_best_of_2._verify_exported_sft_record 按任务接收一组可追溯段。|A 图 B 图 C 的原相邻关系、两幅图的 SHA/ordinal 100% 相等；同一空正文但 Write 参数不同保留两分支；重试相同事件只监督一次；强制压缩的 before/recovery 各一，摘要子请求训练数 0，跨段重复监督 ID 数 0，中间 length 屏蔽、下一次修复有监督。|
|P0 训练动作与末轮|在 clean_record_to_native_swift、validate_and_bridge_session 和 T/convert_record 的渲染前共享状态机；验 schema 名称/required/type、非空唯一 ID、有序消费结果、输入格式版本。对 SWE 提交、完整交付、压缩继续分别标明 terminal_kind。拒不明悬空、末轮异常、丢尾观察、坏参数及重入 Ready；空思考按 Unicode 空白判定。|上文四个纯函数反例全部按预期拒收或保真；孤立/空 ID/重复 result/重复 call 各拒；数学 Δθ≈π 原样带监督；空 think 标签全掩但正文有标签；压缩末动作保留监督，段末 EOS 按继续/完成分别明确测试；SWE 提交命令仅在对应契约内合法。禁止为通过验证伪造结果或补交付回执。|
|P0 媒体、路径与拒收对账|T/convert_record / convert_file 为每个 Native 建持久 sidecar（输入 UUID、行号、task、段、轨、终止类型、拒因、输出哈希），将图复制到受控数据根并校验 SHA；扫描模型可见 messages、工具描述与 schema 默认值。修采集器把 traceback、工具脚本和绝对 cwd 暴露给模型的源头。|插入其他用户名、/mnt/data 与工具描述的泄漏均能检出，合法 /workspace、/task、/output 不误报；Ready 解码后的模型可见文本无宿主路径。隔离挂载内只读打开全部图片，换序/缺图/坏 SHA 均失败。每轨 input=accepted+rejected，意外拒收或整轨消失令入口非零退出。|
|P0 评测身份|E/build_xhs_val_suite.extract_reference_image_path 严格解析 reference 调用与结果或已标注首轮用户图；E/run_xhs_eval.run_one_trial 对 suite、权重/adapter、模板、服务参数和 verifier 建缓存键。|先有诊断图再有题图，命中题图已知 SHA；无匹配、有歧义则隔离。改权重/effort 后缓存 miss，同一指纹才复用；超时且有产物单列 artifact pass 与 E2E fail。|
|P1 训练曝光|T/launch_h100_lora.sh、train_round2_v3/launch_v3_node.sh 与插件按 encode 后 U 分轨分任务配额；区分原始异常、空 think、纠错、交付和重复段。每段记录 delete 原因、pack 内跨度与来源；将过长轨迹送回合法边界重切。|长度上限−1/等于/+1 三组夹具逐行对账；同任务所有段同 split；人工重复段/跨源近重复不进入 holdout；pack 前后有效标签、每轨 U 和样本总数相等，累计 SWE U 为 10–15%，其余三轨预先冻结 U 预算。|
|P1 模板、工具和预算|E/compat.normalize 与训练共用时序语义，对 top-level/string/block 都去动态 billing，保留提醒位置；服务显式配置对齐预算和 processor，medium 作配对主测，xhigh 单列。训练保留真实工具环境标记，对 eval 不可用工具做原轨/六工具对照，切勿只改名或删 schema。|同一 JSON 请求含嵌套参数、中文、多工具、多段 system 时，比较实际 swift 编码和服务端渲染 token IDs、tool XML、图片网格；工具 JSON parse/required 校验全过。64/65 图、临界上下文、clamp 和未知 effort 各有透明结果；错档/无效调用计数可查。|
|P1 视觉与交付质量|inspect_and_clean_3dcodefactory.analyze_record、run_threejs_best_of_2._verify_exported_sft_record 采用与训练相同的 processor，保留原拼图与必要的诊断局部图；按题记录回读、干涉、缝隙或运动轨迹的数值真值。|同一图不同比例、RGBA 透明、拼图局部、小字号与细孔各有夹具；逐图实际网格与占位展开一致。相同几何的全图/局部两臂核验，记录分辨率下关键特征识别，不能以文件可打开代替。|
|P2 可复现和监控|T/launch_h100_lora.sh:53 独立定义 JSON 默认值，进入 check 即 json.loads；固定并记录插件/模板/processor SHA。T/round2_v3_plugin._instrumented_train_step 对 loss 使用全局 numerator/denominator，区分 pad 与有效 token，并联结 sidecar；E/compat.run_proxy 按实际 replicas 建 socket（现 :147 固定 0/1）。|默认与 override JSON 都可解析且值完全匹配；单、双、三 replica 配置实际 socket 集合一致或参数预检拒绝；两 rank 分母不同的合成 loss 与手算相等；全参和 LoRA 各跑一套数值回归。|

### 分阶段 Go / No-Go（建议值，尚未执行）

1. **离线零预算门。** 先用上表固定夹具及本报告 16+4 个 XHS 段、12 个 SWE、9 个 CAD 重放，另造至少一对 2D 正反例。每个原生调用、图片、损失轮与末轮标签可追到原始事件。模板对齐比较同一条件下 token ID，并对预期差异列白名单；坏轮、空 think、prompt、tool result 中受监督 token 数均为 0，正常正文/修复/完成 EOS 均有监督。材料不足、轨道静默消失或任一 P0 断言失败即 No-Go。
2. **采集 Canary。** 另行授权后，CAD 与 2D 各 6 个独立任务，覆盖至少三类 leaf，含从零、编辑、修复和多文件依赖；每轨至少 2 题跨真实压缩边界，若未触发，用受控较低窗口专项探针补测并单列。记录尝试总数、合格任务数、段数、真实助手轮、用图、交付 SHA、修复前后证据、峰值上下文、停止原因。验收成功的每个任务必须由独立 verifier 可重现；截断/超时不得充作自然完成。建议每轨至少 5/6 成功且 P0 完整性错误 0 才扩一小批；不能由六题推断 150–300 条的总体优质率。
3. **编码与混训探针。** 用固定镜像离线实际 encode 整个候选 manifest；按来源、任务、段型、长度分位报告输入 token、视觉 token、U、最终正文/EOS、delete 的行数与 U。建议任一轨意外丢失 >2% 任务、合法终段丢失或 U 配额超预算 ±2 个百分点时停止；SWE 单独遵守 10–15%。喂同一 3D/CAD/2D/SWE 小集做 unpacked 与 binpack 单步梯度比对，固定 seed、关闭 dropout，以同一有效 token 分母比较 loss（建议相对误差 ≤1%，先用 BF16 重复运行标定容差），测试不同 CP/DP，检查 cu_seqlens、position_ids 和媒体映射无跨样本注意；无 NaN/OOM，任何轨的监督均非零。LoRA/全参分别验，不能用统计插件的总 tok/s 代替。
4. **推理放行。** 同一冻结 holdout 在 Base 与候选权重上成对跑，相同预算/工具/effort；分别报告 Three.js L1/L2/L3、CAD 四格式与改参/干涉、2D HTTP/乱序 renderAt/交互、SWE 提交成功数，以及各轨 E2E clean（交付通过、自然停机、无超时）分子与分母。专设压缩前后恢复、64 图边界与长输出档；预算不一致的次臂独立报告。建议对小样本逐一复核新退化；凡有错图、错误权重缓存、提前回执、无效调用导致的交付失败，或宣称受支持的预算无法执行，均 No-Go。扩大样本后才做不劣效统计。

## 5　证据边界

审计使用本地源代码、机器产物与真实导出行，没有使用其他审计报告。未读取凭据，未启动训练、GPU、Docker、浏览器或外部 API。未获得未来高难 2D/CAD 的成对线上请求和实际压缩事件，没有实测特定镜像的标签边界、全量 delete 率、打包梯度、部署侧最终视觉 token、自然停机率或工件视觉品质。已有 2D 验收 JSON 与旧 CAD 短轨不能给这些项签字。本文门禁给出了分别取得这些证据的最小验证范围。
