# 主调研方独立审计报告：三轨合训全链路数据管线对齐与隐患审查

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> **成文时间**：2026-11-26（主调研方独立完成，成文前未读取 Astra 报告或事件流）  
> **审计范围**：小红书 `3DCodeFactory` 清洗入训链路 × 我方 Claude Code + `repos-logging-proxy` 自产采集转换链路 × `ms-swift` Megatron 训练插件 × vLLM + `compat.py` 推理评测沙盒  
> **目标模型**：Dense `Qwen3.8-27B`（`qwen3_8` 模板，384K YaRN + 多模态视觉输入）

---

## 一、结论速览：查出 4 项阻断级（P0）静默隐患与 4 项高危（P1）协议错位

通过对真实脚本逐行比对及对磁盘已导出样本（小红书 `clean-le262k/native-swift.jsonl` 54 条、`train-00000.jsonl.zst` 原始分段、我方 CAD `swift-smoke/*/native-swift.jsonl`、以及 `swe-replay-train-700.ready.jsonl`）的实测解包，确认**若不先修复以下断层就直接启动 CAD/2D 长程采样与三轨合训，必将触发长程轨迹静默丢弃、工具调用幻觉/报错、视觉细节糊化及跨轨梯度淹没**：

### P0 阻断级 Bug（不修会直接毁数据、炸转换或废掉验收）
1. **P0-1 · 自产长程触发自动压缩（`auto-compact`）时，前半程轨迹会被静默整段拒收，且内部摘要请求会混入训练集**（`process_logs.py:684-785` + `logging_proxy_to_swift.py:859-889`）。
2. **P0-2 · 工具集（Tools Schema）三方严重劈叉：小红书训了 25 个工具并高频调 `TaskUpdate`（149 次 > `Write` 111 次），而自产与评测只给 6 个工具且多了小红书未见过的 `Glob/Grep`**（`clean-le262k` 实测 vs `run_claude_cases.py:26` / `run_cad_cases.py:44` / `run_xhs_eval.py:48`）。
3. **P0-3 · 现有 CAD 与 2D 验收器无法运行新落盘的多文件交付规格**：`check_2d_v2.mjs:137-145` 走 `file://` 并拦截一切子模块请求，多文件 ES6 + 本地 `gsap.min.js` 100% 报错；`cad_inspect.py:249` 只拷贝单文件 `src/model.py`（多模块 `params.py + parts/*.py` 必报 `ModuleNotFoundError`），且缺 `STEP` 导出、缺两两零干涉布尔检查、缺剖视图/爆炸图。
4. **P0-4 · `convert_native_to_xhs_ready.py` 存在 3 处静默放行/崩溃缺陷**：① 末轮 `loss: False` 仅计数不拒收（放行无 EOS 监督坏样本，行 `318-320`）；② 裁剪末尾含 `<image>` 的非 assistant 消息时未同步弹出 `images` 导致错位拒收（行 `289-292`）；③ 旧版 `swe-replay-train-700.ready.jsonl` 含 `loss_scale: 0.5` 且缺顶层 `images` 列，直接混拼必触发 PyArrow 报错或被新转换器全量拒收（行 `309-311`）。

### P1 高危分布错位与训推不一致（会显著拉低多轨表现与泛化）
5. **P1-1 · 沙盒工作目录与系统提示词三轨各唱各调**：小红书在 `/workspace` + `/workspace/output`（`claude --bare`，无 git 状态）；自产 CAD 把宿主机 `/tmp/cad3d-ws/cadjob-xxx/workspace/src/model.py` 硬编码进了每一轮 `Read/Edit` 参数（每条轨迹出现 `10–17` 次！），且未加 `--bare` 导致 `system[0]` 混入 `gitStatus: Current branch: HEAD`；自产 3D 提示词仍锁死 `esbuild` 单文件 + `≤30–48` 轮紧箍咒。
6. **P1-2 · 训推模板参数与系统消息折叠不一致**：训练用默认 `reasoning_effort="medium"`（无系统前缀），而 `run_xhs_eval.py:222` 推理强塞 `reasoning_effort="xhigh"` 前缀；训练用 YaRN `393,216` + `MAX_PIXELS=401408`，而 `run_xhs_eval.py:216-219` 启动 vLLM 用 `262,144`（无 YaRN）且未设 `max_pixels=401408`；`compat.py:55-57` 把中途 `system` 拼回 `system[0]`，而训练端折入 `<system-reminder>`。
7. **P1-3 · `MAX_PIXELS=401408`（约 `730×550`）与多格拼图（Contact Sheet）冲突**：若将 4–6 张高清帧/多视角拼成一张大图再经 `MAX_PIXELS=401408` 压缩，单子格有效分辨率仅剩 `~240×180`，2D 文字重叠、HUD 遮挡与 CAD 0.3mm 止口间隙在视觉编码器中彻底糊化。
8. **P1-4 · `--calculate_per_token_loss true` 下单任务多段曝光导致严重跨轨梯度失衡**：小红书单个长任务切出 `2–4` 个分段（累计监督 token `U` 可达 `150K–250K`），而单条 CAD/2D 轨迹 `U` 仅 `8K–25K`；按行数混配会导致小红书单题梯度权重达自产题的 **`10×–25×`**。

---

## 二、一手代码与本地真实导出样本取证对照表

以下全部事实均由本地代码行号与只读样本实测确认：

| 审计维度 | 小红书 `3DCodeFactory` 管线（实测） | 我方自产 CAD / 2D / 3D 管线（实测） | 评测推理端 `eval_xhs_threejs`（实测） | 风险等级 |
| --- | --- | --- | --- | --- |
| **CLI 启动模式与 `system[0]`** | `claude --bare`（`docker_agent.py:121`）；`sys[0]` 6,035 字符，开头 `You are a Claude agent...`，**无 `gitStatus`** | `run_claude_cases.py:197` / `run_cad_cases.py:258` **未传 `--bare`**；`sys[0]` 5,215 字符，开头 `You are Claude Code...`，末尾附带 **`gitStatus: Current branch: HEAD...`** | `run_xhs_eval.py:493` 传 `--bare`（与小红书一致，与我方自产不一致） | **P1** |
| **顶层 `tools` 列表与实际调用** | 顶层固定 **25 个工具**（含 `Agent, TaskCreate, TaskUpdate, WebSearch, Skill...`，**无 `Glob`、无 `Grep`**）；54 条样本实调：`Bash 3048, Read 1534, Edit 530, TaskUpdate 149, Write 111, TaskCreate 7, TaskStop 3, WebSearch 2` | 顶层固定 **6 个工具** `['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Write']`（**有 `Glob/Grep`，无 `TaskCreate/TaskUpdate`**） | 顶层固定 **6 个工具** `Read,Write,Edit,Bash,Glob,Grep`（模型若按小红书习惯调 `TaskUpdate` 会直接触发未知工具错误！） | **P0** |
| **工作区路径分布** | 统一容器挂载 `-w /workspace`，产物在 `/workspace/output`，参考图在 `/workspace/task/reference-0.png`（0 处 `/tmp/...` 工作区路径） | 宿主机临时目录 `--add-dir /tmp/cad3d-ws/cadjob-xxx/workspace`；实测 CAD `native-swift.jsonl` 每条含 **`10–17` 处 `/tmp/cad3d-ws/cadjob-...`** 绝对路径，产物在 `src/model.py` | 容器挂载 `-w /workspace`，`/workspace/output` + `/workspace/vendor` + `/workspace/task` | **P1** |
| **长程自动压缩（Compaction）** | 原生切成 `compact_before`（末轮允许悬空 `tool_calls`）+ `compact_recovery`（首轮 `user` 含 `Summary:` 与 `/logs/agent/...jsonl` 引用），显式剔除 `compact_task`（`export_xhs_threejs_sft.py:59,153`） | **完全不支持压缩切段**：一旦长程触发压缩，`process_logs.py:732` 拆成多段，前段因末轮 `tool_calls` 被 `logging_proxy_to_swift.py:860` **整段丢入 `rejected.jsonl`**，而内部摘要段（即 `compact_task`）反而被当成正常样本放行！ | `run_xhs_eval.py:614` 设 `compact_window=200000` | **P0** |
| **模板 `reasoning_effort`** | `launch_h100_lora.sh:158` 用 `ms-swift` `qwen3_8` 默认 `medium`（**无系统前缀**） | 同左 | `run_xhs_eval.py:222` 强传 **`"reasoning_effort":"xhigh"`**，注入英文长前缀 | **P1** |
| **中途 `system` 处理** | `inspect_and_clean_3dcodefactory.py:386` 折入前一条 `tool/user` 的 `<system-reminder>` | `logging_proxy_to_swift.py:734` & `convert_native_to_xhs_ready.py:77` 折入 `<system-reminder>` | `compat.py:55-57` **直接拼到顶层 `data["system"]` 末尾**，与训练折法相反 | **P1** |
| **视觉分辨率与窗口上限** | 训练 `MAX_PIXELS=401408`（`IMAGE_MAX_TOKEN_NUM=512`），`MAX_LENGTH=393216`（YaRN `1.5`） | 计划用 4–6 格拼图 Contact Sheet（在 `401,408` 总像素上限下单格仅剩 `~240×180` 像素） | `run_xhs_eval.py:216-219` `max_model_len=262144`（**未开 YaRN**，**未限 `max_pixels=401408`**） | **P1** |
| **SWE 防遗忘回放兼容性** | `export_xhs_threejs_sft.py:208` 期望拼入 `native-swift.jsonl` | 现存 `pool4-swe-replay-700` 仅有 `swe-replay-train-700.ready.jsonl`（带旧 `loss_scale: 0.5` 且无 `images` 键） | N/A | **P0** |

---

## 三、分环节深度审计（从采集到推理的 5 道关卡）

### 3.1 关卡一：采集沙盒与工具面（`docker_agent` vs `run_claude_cases` / `run_cad_cases`）
1. **工具面不对称（25 vs 6）**：
   - 实查 `clean-le262k/native-swift.jsonl` 全量 54 条 Three.js 样本，每条 `tools` 均为 Claude Code `--bare` 默认的 **25 个工具**；教师不仅看得到这 25 个工具定义（占约 `~12K–15K` system tokens），而且在 54 条样本中实际发起了 **`149` 次 `TaskUpdate`、`7` 次 `TaskCreate`、`3` 次 `TaskStop`、`2` 次 `WebSearch`**！
   - 反观我方 `run_claude_cases.py`、`run_cad_cases.py` 和评测端 `run_xhs_eval.py` 均通过 `--tools Read,Write,Edit,Bash,Glob,Grep` 锁死为 **6 个工具**。这带来双向风险：
     - **训练学到 `TaskCreate/TaskUpdate`，推理端（`run_xhs_eval.py`）却禁用了它们** → 模型在评测长程任务时一旦按小红书肌肉记忆调 `TaskCreate/TaskUpdate`，立刻收到工具不存在报错；
     - **自产 CAD/2D 用 6 工具（含 `Glob/Grep`），小红书 3D 用 25 工具（无 `Glob/Grep`）** → 模型靠顶层工具列表就能“作弊式路由”（看到 25 工具走 XHS 风格、看到 6 工具走旧短程风格），破坏跨轨共享的工程元能力。
   - **还有一个隐藏坑**：小红书 `compact_recovery` 段首条 `user` 摘要末尾包含固定提示词：`read the full transcript at: /logs/agent/sessions/projects/-workspace/<uuid>.jsonl`；若推理容器开启 `auto-compact` 时该路径不可读或不存在，模型按训练习惯 `Read` 该路径将触发报错。
2. **工作区路径契约分裂**：
   - 小红书与 `run_xhs_eval.py` 都在纯净 Docker 容器内以 `/workspace` 为根、交付至 `/workspace/output/`。
   - 我方 `run_cad_cases.py` 直接在宿主机 `/tmp/cad3d-ws/cadjob-<rand>/workspace` 裸跑进程，导致模型所有绝对路径操作都带着 `/tmp/cad3d-ws/cadjob-...` 印记，且交付路径叫 `src/model.py` 而非 `/workspace/output/...`。
   - `convert_native_to_xhs_ready.py:31-35` 的宿主机路径黑名单仅写了 `("${WORKSPACE}", "${USER_HOME}", "${REFERENCE_DATA}")`，漏掉了 `${SHARED_DATA}`、`/tmp/cad3d-ws`、`/tmp/anim3d-ws` 等路径。

### 3.2 关卡二：长程抓包、压缩切段与异常掩码（`process_logs.py` + `logging_proxy_to_swift.py`）
1. **自产长程采样必撞的 `auto-compact` 静默丢数据 Bug（P0-1）**：
   - 旧管线设了 `≤12–30` 轮上限，从未触发压缩；但新规范要求放开到 **50–150 轮长程精修**。
   - 一旦单次会话超过 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`，Claude Code 会先后发出：① 压缩前的多轮请求序列；② 一次独立的上下文总结请求（生成 `<analysis>...<summary>...`）；③ 以总结作为新 `user[1]` 的续写请求序列。
   - `repos-logging-proxy/process_logs.py:684-785` 的 `deduplicate_sessions` 仅依赖 `is_prefix_of` 去重——由于续写序列的 `messages[1]` 变成了总结文本，与前半程不再构成前缀关系，同一个 trial 会裂变成 3 条独立 session！
   - 随后进入 `logging_proxy_to_swift.py:859-889`：
     - **前半程 session**：通常停在触发压缩前的 `tool` 结果或未闭合 `tool_calls` 上，被 `final_message_not_assistant` 或 `dangling_final_tool_calls` **100% 拒收进 `rejected.jsonl`**（白白烧掉前半程几十轮 API 费且丢失全部架构搭建监督！）；
     - **总结 session**：末轮恰好是无工具调用的纯文本 `<summary>`，反而**畅通无阻混入 `native-swift.jsonl`**（把小红书专门剔除的低质量 `compact_task` 摘要段灌进了学生模型！）。
2. **`is_prefix_of` 不比对 `tool_calls` 的潜在覆盖隐患（`process_logs.py:688-729`）**：
   - `process_logs.py:727` 注释写明 `# Intentionally NOT comparing tool_calls array`。当 assistant 某轮 `content == ""` 且 `reasoning_content` 极短或为空（纯工具调用轮）时，若发生重试或同前缀分支，可能误判前缀包含关系。

### 3.3 关卡三：多文件验收器与合成器断层（`cad_inspect.py` / `check_2d_v2.mjs` / `threejs_rubric_synth.py`）
1. **2D 验收器 `check_2d_v2.mjs` 与新规格硬冲突（P0-3a）**：
   - 第 `137–145` 行强制使用 `file://` 打开单 HTML，并拦截除自身 `url / data: / blob:` 之外的一切请求（连本地同目录 `./src/main.js`、`./css/styles.css`、`./vendor/gsap.min.js`、`./assets/*.svg` 都会因 ES Module `file://` CORS 或路由拦截直接判 `offline_or_page_error` 失败！）。
   - 第 `319` 行无条件将任何 `animationDuration > 0` 的 CSS 动画判为违规（`svg_uncoupled_css_or_smil_clock`），在混合 DOM+SVG 页面中易误杀过渡动效。
   - 视口固定死 `800×500`，未覆盖 `1280×720` / `1440×900` 跨分辨率文字/HUD 重叠硬检，也尚无 `renderAt(t) → MP4` 导出器。
2. **CAD 验收器 `cad_inspect.py` 与新规格硬冲突（P0-3b）**：
   - 第 `184` 行仅对单文件做 AST 扫描，第 `249` 行仅将单个 `source_path` 复制到临时目录 `ws_tmp/src/model.py`——多文件装配结构（`src/params.py + src/parts/*.py + src/assembly.py`）在回读校验时必然找不到子模块。
   - **完全没有 `STEP`（`.step`）导出与 OCCT `STEP` 回读校验**（仅导出了 `GLB / 3MF / STL`）。
   - **完全没有多零件两两布尔交集（Tier 4 零干涉）硬检**：两个互相穿模咬死的齿轮或方向画反插进盒壁的盖板，只要各自网格水密，就能骗过当前 `cad_inspect.py` 拿到 `"ok": true`！
   - **缺少剖视图（`section_view.png`）与爆炸图（`exploded_view.png`）自动渲染**：内部盲孔、相交阀道与内止口咬合间隙在外部 4 视图中被外壳完全遮挡，教师与学生均“看不见内部错误”。

### 3.4 关卡四：模板转换、打包与多轨 Loss 配比（`convert_native_to_xhs_ready.py` + `ms-swift`）
1. **`convert_native_to_xhs_ready.py` 三处具体代码缺陷（P0-4）**：
   - **缺陷 A（第 `318–320` 行）**：`if out_msgs[-1].get("loss") is False: stats["last_assistant_masked"] = 1`——只统计不拒收！一旦某条记录末轮被标为 `loss: False`，入训后最后一条消息标签全为 `-100`，破坏终轮收敛监督（对比 `inspect_and_clean_3dcodefactory.py:486-487` 与 `logging_proxy_to_swift.py:917-920` 都是直接拒收）。
   - **缺陷 B（第 `289–292` 行）**：裁剪末尾非 assistant 消息时只 `out_msgs.pop()`，未同步扣除该消息内 `<image>` 对应的 `rec["images"]` 尾部元素，导致原本合法的切段因 `image_placeholder_mismatch` 被误杀。
   - **缺陷 C（SWE 回放接入断层）**：现有 `pool4-swe-replay-700/swe-replay-train-700.ready.jsonl` 是按旧版 `qwen38_swift_normalize.py` 生成的（含 `"loss_scale": 0.5`、已拆分子消息、无 `"images": []` 列）。既不能直接与新 `ready.jsonl` 拼接（触发 PyArrow 列不一致 + `loss_scale` 污染），也不能喂给 `convert_native_to_xhs_ready.py`（第 `309` 行直接因 `unexpected_loss_scale` 全部拒收）。必须回溯 SWE 原始未拆分 OpenAI/native 源重新走 `convert_native_to_xhs_ready.py`！
2. **拼图分辨率与 `MAX_PIXELS=401408` 的物理矛盾（P1-3）**：
   - 小红书之所以能用 `MAX_PIXELS=401408`（约 `512` 视觉 token/张），是因为**小红书每次 `Read` 的是单张独立渲染图（如 `960×640` 或 `1280×800`）**，缩到 `401,408` 像素仍有约 `780×514` 的清晰度。
   - 而我方自产规范要求拼 **4–6 格 Contact Sheet**！一张 `2×3` 拼图压到 `401,408` 总像素后，每一格只剩 **`~250×170` 像素**，字号 `<16px` 的 UI 标签和 CAD 细微倒角/止口全部糊成马赛克。
   - **解法**：要么自产也像小红书一样传单张关键视图（或最多 `2×2` 紧凑裁切拼图 + 局部特写单图），要么将 `MAX_PIXELS` 对齐到 `802,816`（`1024` token/张）并同步在训练和 vLLM 推理端显式锁定同一 `max_pixels`！
3. **跨轨有效监督 Token `U` 严重失衡（P1-4）**：
   - `launch_h100_lora.sh:176` 开启了 `--calculate_per_token_loss true`。
   - 实测小红书 1 个复杂 Three.js 任务常含 `compact_before-0` + `1~3` 条 `compact_recovery`，单任务贡献 `80K–250K` 有效监督 token `U`；且 `compact_before` 与 `compact_recovery` 末轮是**未闭合 `tool_calls`**（见 `train-00000.jsonl.zst` 实查：`compact_before-0` 与 `compact_recovery-0` 均以 `has_tc=True, content=""` 结束），只有最后一段才教“写总结并 EOS 停机”。
   - 若小红书全量灌入数千段，而 CAD / 2D 各只造 200 条（单条 `U ≈ 10K–25K`），则：
     1. **梯度占比失衡**：CAD + 2D 合计 `U` 可能不足总训练 `U` 的 `5%`；
     2. **停机分布偏移**：大量未收尾的 `compact_before / intermediate recovery` 段若比例过高，会稀释自然收尾段的停机信号。必须严格按 **有效监督 token `U`（五本账）** 控制 `3D : CAD : 2D : SWE` 的真实梯度配比（如动态对 CAD/2D 欠采样小红书或控制小红书精选高分集规模）。

### 3.5 关卡五：推理评测链路（`run_xhs_eval.py` + `compat.py`）
1. **推理模板 `reasoning_effort` 漂移**：`run_xhs_eval.py:222` 传入 `"reasoning_effort": "xhigh"`，与训练端 `ms-swift` 默认 `medium` 不一致；应统一改为 `"medium"`（无额外英文训诫前缀）。
2. **vLLM 上下文与视觉处理器未对齐训练参数**：`run_xhs_eval.py:216-219` 未挂载 YaRN `rope_scaling`（仅开 `262,144`），且未限制 `--mm-processor-kwargs '{"max_pixels": 401408}'`，导致推理端单张截图吃掉 `1,500–2,000` token，多看几张图就提前撞上 `200K` 压缩线或 `262K` 上限。
3. **`compat.py` 中途 `system` 归一化方式与训练相反**：`compat.py:55-57` 把中途 `system` 拼进顶层 `data["system"]`，应改为与 `convert_native_to_xhs_ready.py:66-87` 完全一致地折入前一条 `user/tool` 的 `<system-reminder>`。

---

## 四、上线前代码级整改清单（P0 / P1 / P2）与验证门禁

### 4.1 必改代码项

| 级别 | 目标脚本与位置 | 具体修改动作 | 机器可验验收标准 |
| --- | --- | --- | --- |
| **P0-1** | `repos-logging-proxy/process_logs.py` + `scripts/logging_proxy_to_swift.py` | 新增 **Claude Code 原生压缩切段支持**：识别压缩摘要请求（过滤剔除 `<analysis>/<summary>` 纯摘要 `compact_task`），将同一 trial 的压缩前会话标为 `compact_before`（允许末轮合法闭合或触发点 `tool_calls`）、压缩后会话标为 `compact_recovery`，绑定同一 `task_key` | 构造 1 条实测触发 `auto-compact` 的长程日志跑单测：`compact_before` 与 `compact_recovery` 双双保留，`compact_task` 摘要段 100% 过滤，0 误拒 |
| **P0-2** | 采集端 `run_claude_cases.py` / `run_cad_cases.py` / 新 `run_2d_cases.py`、清洗端 `inspect_and_clean_3dcodefactory.py`、评测端 `run_xhs_eval.py` | **统一工具面与 `--bare` 协议**：① 自产与评测全部统一用 **`claude --bare`** 在容器 `-w /workspace` 下运行（彻底消除 `gitStatus` 与 `/tmp/cadjob-...` 路径泄漏）；② 清洗小红书时检查/处理非核心工具调用：要么推理容器通过轻量内置 stub/配置对齐工具面（或在清洗小红书时将 `TaskCreate/TaskUpdate` 轮标 `loss: False` 并在新采集中统一工具集），严禁“训练教调 `TaskUpdate`、推理报错无此工具” | 抽检导出 `ready.jsonl`：三轨 `system[0]` 均无 `gitStatus`、无 `/tmp/*job*`，且模型在评测沙盒中 `unknown tool` 发生率 = `0%` |
| **P0-3** | `scripts/check_2d_v2.mjs` + `scripts/cad_inspect.py` | ① **升级 `check_2d_v2.mjs` → 支持本地临时 `http.server` 多文件目录加载**（放行 `http://127.0.0.1:<port>/` 同源请求，阻断一切公网域名），增加 `1280×720` / `1440×900` 双视口文字/HUD 零重叠检测及 `export_2d_mp4.mjs`；<br>② **升级 `cad_inspect.py`** 支持拷贝整个 `output/src/` 包目录、新增 **`STEP`（`.step`）导出与 OCCT 回读**、新增 **多零件两两布尔交集体积 `≤ 1e-3 mm³` 零干涉硬检**、新增 **自动剖视图 `section_view.png` + 爆炸图 `exploded_view.png` 渲染** | 跑正反例单测：多文件 ES6+GSAP 正例全过、外链 CDN 秒杀；CAD 穿模齿轮/反止口盒盖 100% 被干涉检与剖视图抓出 |
| **P0-4** | `scripts/train_xhs_27b_lora/convert_native_to_xhs_ready.py` + SWE 回放重导 | ① 第 `318` 行：当 `out_msgs[-1].get("loss") is False` 时**直接拒收**（除非显式声明的中间段且末轮有监督）；② 第 `289` 行：弹出末尾消息时同步按其中 `<image>` 数量弹出尾部 `images`；③ 扩充 `HOST_LEAK_SUBSTRINGS` 覆盖 `${SHARED_DATA}/`、`/tmp/cad3d-ws`、`/tmp/anim3d-ws`；④ 从 SWE 原始未拆分源重跑 `convert_native_to_xhs_ready.py` 生成纯净二值 loss 版 SWE 回放 | `audit_ms_swift_labels.py` 全量扫过三轨 + SWE 合并文件：0 PyArrow 错、0 `loss_scale`、0 末轮全 `-100`、0 路径泄漏 |
| **P1-1** | `scripts/eval_xhs_threejs/{run_xhs_eval.py,compat.py}` | ① `run_xhs_eval.py:222` 将 `"reasoning_effort"` 改为 **`"medium"`**；② vLLM 显式对齐训练 `--rope-scaling`（384K YaRN）与 `--mm-processor-kwargs '{"max_pixels": ...}'`；③ `compat.py:38` 将中途 `system` 改为折入前一条 `user/tool` 的 `<system-reminder>` | 训推同输入 prompt 编码逐 token 对齐测试 100% 一致 |
| **P1-2** | 视觉拼图尺寸与五本账配比脚本 | ① 规定 Contact Sheet 最多 **`2×2`（4 格）** 且关键细节配独立局部特写图（或同步将训推 `MAX_PIXELS` 提至 `802,816`）；② 合训配比严格按 **非 mask 有效监督 token `U`**（而非行数）配平 `3D : CAD : 2D : SWE`（建议首轮探针 `U` 比约 `45% : 22% : 23% : 10%`），同一任务多分段共享 `task_key` 严禁跨 `train/val` | 导出合训账本 JSON：逐轨报告独立 `task_key` 数、段数、总输入 token、有效监督 `U` 及自然 EOS 段占比 |

### 4.2 上线前四步 Go / No-Go 门禁

1. **Gate 1（转换与标签一致性 CPU 门禁，0 GPU）**：三轨样板各抽 5 条 + SWE 5 条合入同一 `ready.jsonl`，跑 `audit_ms_swift_labels.py`，确认 `labels != -100` 精确落在非 mask assistant 轮（含末轮 `<|im_end|>`），0 路径泄漏、0 工具未闭合。
2. **Gate 2（CAD / 2D 新验收器正反例门禁，0 API）**：多文件 2D 与多模块装配 CAD 各构造 4 对 `gold / bad`（含穿模、止口画反、ES6 子模块加载、HUD 遮挡），验收器达成 **100% 正例全过、反例全杀**。
3. **Gate 3（每轨 3–5 题真长程 Canary 采样门禁）**：在统一 Docker `/workspace` + `claude --bare` 下各跑 3–5 道 `27B Base` 做不好的高难题，验证即使触发 `auto-compact` 也能完整导出 `before + recovery`、单题真实成本可控、且视觉拼图在目标 `MAX_PIXELS` 下肉眼清晰可辨。
4. **Gate 4（小规模三轨合训干扰探针）**：在全量合训前先跑固定步数 LoRA/探针，分别测 3D（`core20`）、CAD、2D 与通用代码回放，确认 **0 跨轨工具误调**（如 CAD 调 `http.server`、3D/2D 调不存在的 `TaskUpdate`）且各轨均优于 `27B Base`。

---

## 五、未核验项与边界说明

1. 本次未读任何 `.env*` 密钥，未连接远端 `${SHARED_DATA}/3d-animation-reports/xhs-threejs-sft-20261126/`（当前机器未挂载 `/mnt/data`，故小红书样本实测基于本地 `${WORKSPACE}/datasets/3dcodefactory/` 分片与 `clean-le262k` 54 条清洗样本）。
2. 全量 401 分片中 `TaskCreate / TaskUpdate / Agent / WebSearch` 的精确全库占比，建议在挂载全量分片的节点跑 1 次只读工具频次统计后决定“掩码该轮”还是“保留轻量 Todo/Task 工具 stub”。
3. `MAX_PIXELS=401408` vs `802,816` 在 8×H100/16×H800 `384K` 窗口下的精确吞吐影响，留待 Gate 1/4 实测确认。
