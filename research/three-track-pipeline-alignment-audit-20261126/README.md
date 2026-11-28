# 三轨合训全链路数据管线对齐与隐患联合审核汇总（主调研方 × Astra）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> **审核日期**：2026-11-26  
> **目标基座与训练栈**：Dense `Qwen3.8-27B` BF16 · `ms-swift 4.5.2` Megatron · `qwen3_8` 模板 · `384K` YaRN + 多模态视觉输入  
> **双方独立底稿（先独立成文、后交叉汇总）**：[主调研方独立报告](main-report.md) · [Astra 独立报告](astra-report.md) · `共享问题书`（本地附件未发布） · `Astra 任务书`（本地附件未发布）  
> **Astra 会话凭据**：`thread_id = 01a21878-95bb-70c2-be14-79109db47117`（`model_provider = phanthy_local`，`model = gpt-6.2-astra`，`turn.completed = 1`，退出码 `0`；期间经历 2 次流重连自动恢复，无人工干预）

---

## 一、联合放行裁决（Executive Verdict）

> **2026-11-27 整改状态更新（Gate 1 代码与离线回归门已通过）**：本报告列出的核心代码级 P0 / P1 / P2 修复（`logging_proxy_to_swift.py` 流式图文保序、`tool_calls` 严格去重与 `auto-compact` 原生切段、`convert_native_to_xhs_ready.py` 渲染前状态机拦截与数学思考保留、`check_2d_v2.mjs` 本地只读 HTTP 多文件与 `export_2d_mp4.mjs`、`cad_inspect.py` 多模块 + `STEP` 回读 + 布尔零干涉 + 剖视/爆炸图、`compat.py` 中段 `<system-reminder>` 折叠、`build_xhs_val_suite.py` 参考图严格 `tool_call_id` 匹配、`claude --bare` 不传 `--tools`/`--effort` 对齐、`launch_h100_lora.sh` 花括号与插件全局加权 Loss）已在 `3d-animation-agent` 完成落地并通过 **39 项 `pytest` 管线/反例单测 + 9/9 组 `2d-v2-counterexamples` 回归验证**。同时因 3D 专用 DeepSeek 配额耗尽且专用通道 `kimi-k3.1-pro` 已恢复，CAD 与自产长程采集教师已切换为优先使用 **`kimi-k3.1-pro`**，下一步可按 **Gate 2** 执行小批 Canary 验证。

**（以下保留 2026-11-26 审核成文时的原始裁决与取证记录）**
**双方独立审计达成 100% 一致裁决：当前状态下，大规模启动 CAD/2D 长程教师采集与三轨正式混合训练均为 `No-Go`；外部小红书 `3DCodeFactory` 离线清洗可继续，但必须在动用教师 API 预算和正式合训前先修完下述 `7` 项 P0 阻断级隐患。**

核心原因用一句话概括：**表面上“脚本能导出 JSONL”，但从「采集沙盒 → 代理抓包与压缩切段 → 统一 Ready 转换 → 容器挂载与混合打包 → vLLM 推理评测」整条链路上，横亘着多处已被代码和真实样本复现的静默丢数据、错位监督和验收拒真断点。**

---

## 二、一手代码与已落盘真实样本取证总表

双方分别核查了本地脚本源码、本地分片（`clean-le262k` 54 条、`train-00000.jsonl.zst`）、JuiceFS 已导出全量小红书+SWE 数据集（`${SHARED_DATA}/3d-animation-reports/xhs-threejs-sft-20261126/`）及我方历史 CAD / 3D 自产导出样本：

| 样本 / 代码资产 | 已证实的一手数字与行为（带分母） | 暴露出的核心对齐断层 |
| --- | --- | --- |
| **JuiceFS 小红书导出集**（`export-summary.json` + `ready.stats.json`，Astra 实查） | 已扫 **249 个分片**（非全量 401）：训练 **3,743 段 / 1,262 独立任务**（`before 1,249 / recovery 2,491 / main 3`），验证 **146 段 / 49 任务**，`task_key` 交集 `0`；单行最多 **141 张图**（超评测 64 图上限）；产生 **82,397 个合成空 `<think>` 屏蔽** | ① 平均 **2.97 段/任务**，单段可训练正文 token 中位达 **258.9K**（行 1–4 实测），远超单条 CAD（中位 **2.0K**）与 SWE（中位 **13.1K**）；<br>② 完整未切 `main` 仅 **3 条**，99.9% 靠 `compact_before + recovery` 承载 |
| **小红书 vs 自产 vs 评测工具面**（双方独立实查） | 小红书顶层声明 **25 个工具**（含 `Agent, TaskCreate, TaskUpdate, WebFetch, Skill...`，**无 `Glob/Grep`**）；`clean-le262k` 54 段中实调 **`TaskUpdate` 149 次（多于 `Write` 111 次！）、`TaskCreate` 7 次**，前 16 段实调 `TaskUpdate 28 / TaskCreate 17 / WebFetch 1 / Skill 1` | 我方自产（`run_claude_cases.py` / `run_cad_cases.py`）与评测（`run_xhs_eval.py:48`）均锁死 **6 个工具**（含小红书没有的 `Glob/Grep`，**禁用了模型在小红书里高频学到的 `TaskUpdate/TaskCreate`**） |
| **SWE 防遗忘回放 600 条**（主报告查 `pool4` + Astra 查尾区 600 行） | ① JuiceFS 追加的 **600/600 条** SWE 全部只有单工具小写 `bash`、`system` 仅 95 字符，且 **100% 以 `COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT` 工具调用结尾**（非自然文本 EOS）；<br>② 本地 `pool4` 旧 `ready.jsonl` 带 `loss_scale: 0.5` 且无 `images` 键 | ① SWE 末轮“调工具即结束”与编码轨“调工具等回包 / 压缩截断、自然文本才结束”语义直接冲突；<br>② 600 行虽占行数 `13.8%`（600/4343），但有效监督 token `U` 占比远低于行数占比；旧 `ready.jsonl` 不可重入新转换器 |
| **我方历史 CAD 9 题导出**（`cad-print-seed-baseline` 9 文件） | 9/9 含宿主机临时绝对路径 `/tmp/cad3d-ws/cadjob-...`（每条 `10–17` 处），且 **5/9 因消息内残留 `${WORKSPACE}` 被 `convert_native_to_xhs_ready.py` 直接拒收**；`system[0]` 5,215 字符含 `gitStatus: Current branch: HEAD`（因未传 `--bare`） | 自产裸跑宿主机 `/tmp` 工作区 + 漏传 `--bare` + 图片存于 `reports/` 树（未挂入训练容器 `DATA_DIR`） |
| **多模态图文重排与转换纯函数反例**（Astra 内存实测复现 + 主报告代码审计） | ① `process_logs.py:413-451` 将 `[text A, image I, text B]` 重排为 `[text "A B", image I]`；<br>② `convert_native_to_xhs_ready.py` 对 `Write(arguments="{")` **仍输出无参 `<function=Write>` 且标 `loss: True`**；对 `<think>Δθ≈π</think>` **误判为空思考抹除**；对末轮 `loss: False` **不拒收直接放行** | 计数校验（占位符数 == 图片数、`rows_out > 0`）**完全抓不住图文顺序错位、无参坏工具监督、纯符号思考丢失与无 EOS 末轮放行** |

---

## 三、双方共识、各自独有发现与口径对齐

### 3.1 高度一致的六大核心共识
1. **现有 2D 与 CAD 验收入口必须先升级才能采高难多文件数据**：`check_2d_v2.mjs:137-145` 仅放行单 `file://` URL，会 100% 误杀本地 `css/styles.css`、`src/*.js` 与 `vendor/gsap.min.js`；`cad_inspect.py:249` 只拷单文件 `src/model.py`，不支持 `params.py + parts/*.py + assembly.py` 多模块工程，且缺 `STEP` 独立回读、缺两两零件零干涉布尔硬检。
2. **自产长程管线一旦撞上 `auto-compact` 必然掉链子**：`process_logs.py` 的 `is_prefix_of` 在压缩摘要替换历史后会断链分裂，且比较器忽略 `assistant.tool_calls`；`logging_proxy_to_swift.py` 会将压缩前挂起调用的前半程整段拒收、却可能把纯文本压缩摘要子请求误放行；`run_threejs_best_of_2.py:302` 还写死了 `accepted == 1` 单行假设。
3. **顶层工具面与 CLI `--bare` 必须统一**：不能一边拿小红书 25 工具（高频调 `TaskUpdate/TaskCreate`）训练，一边在评测与自产里只开 6 工具（`Bash/Edit/Glob/Grep/Read/Write`）且自产不加 `--bare` 注入 `gitStatus`。
4. **`convert_native_to_xhs_ready.py` 必须在渲染前做严格状态机校验**：拒绝末轮 `loss: False`、拒绝孤立/重复/空 `tool_call_id`、拒绝参数 JSON 损坏的工具调用（严禁降级成无参调用继续训练）、拒绝旧 `ready.jsonl` 二次重入。
5. **混训配比严禁按“行数”拍脑袋，必须按模板编码且扣除 `delete` 后的真实有效监督 token `U` 记账**：小红书单段 `U` 比单条 CAD 大两个数量级（~250K vs ~2K–15K），按行数混配会导致短轨被彻底淹没。
6. **训推上下文与视觉预算必须同构（注：`reasoning_effort` 已核实“不传即默认 `xhigh`”，无需改 `medium`！）**：经回查 `chat_template.original.jinja:47`（`reasoning_effort|default('xhigh')`）与本地 `token-decode-audit.json` 逐 token 实测，**训练端不传 `reasoning_effort` 时 `ms-swift` `qwen3_8` 默认自动注入的就是 `xhigh`**，因此训练不传与 `run_xhs_eval.py` 默认 `xhigh` 本身就是 **100% 对齐**的（若人为改成 `medium` 反而错位）；真正未对齐的是上下文与多模态处理器参数（训练 `393,216` YaRN + `MAX_PIXELS=401408`，而 `run_xhs_eval.py` 当前为 `262,144` 无 YaRN + `limit-mm=64` 未锁同构 `max_pixels`），以及 `compat.py` 将中途 `system` 提前拼到首轮 `system[0]`（违反时序因果且与训练折入 `<system-reminder>` 相反）。

### 3.2 双方互补的独有高价值发现（合并采纳）

| 来源 | 独有发现 | 工程影响与处置 |
| --- | --- | --- |
| **Astra 独有复现** | **`process_logs.py:367-381, 413-451` 图文混排顺序错乱**：先收集全部 `texts` 再追加 `image_blocks`，导致同一消息内“修改前/修改后”多图说明与图片错位 | **升为 P0**：改为按原始 content block 序号流式保序转换 |
| **Astra 独有复现** | **`convert_native_to_xhs_ready.py:30` `EMPTY_THINKING_RE` 误杀纯数学/符号思考**（如 `Δθ≈π`），以及 **`:90-139` 参数 JSON 解析失败仍生成无参 `<tool_call>` 并赋 `loss: True`** | **升为 P0**：空思考仅判 Unicode 空白（`not content.strip()`）；工具参数解析失败直接拒收或整轮置 `loss: False` |
| **Astra 独有复现** | **600 条已混入 SWE 100% 以 `COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT` 工具调用收尾**；**`launch_h100_lora.sh:53` `ROPE_SCALING_JSON` 默认值花括号在传参覆盖时多拼一个 `}`**；**训练容器未挂载自产图片目录**；**`build_xhs_val_suite.py:48-66` 先看草图再读题图会拿错参考图**；**`run_xhs_eval.py:448` 缓存复用不验权重指纹** | **全部纳入 P0/P1/P2 修复单** |
| **主报告独有补充** | **CAD 验收器缺少内部剖视图（`section_view.png`）与爆炸图（`exploded_view.png`）**，导致盒盖下伸止口画反、内部相交阀孔被外壳遮挡无法在多轮看图中自检发现 | **纳入 P0 验收器升级**：多体与腔体件必出剖视/爆炸图供教师看图纠错 |
| **主报告独有补充** | **`convert_native_to_xhs_ready.py:289-292` 剥除尾部非 assistant 消息时未同步回退尾部 `<image>` 对应的 `images[]`**；以及 **多格拼图（Contact Sheet）在 `MAX_PIXELS=401408` 下单格被压至 `~240×180` 糊化细孔与小字** | **纳入 P0/P1**：剥尾同步回退图片；核准 Qwen3.8 processor 实际网格（`patch=16, merge=2`，`401408 / 1024 ≈ 392` 合并格）并配局部原图特写防止糊化 |

### 3.3 细微口径差异与统一裁定
- **视觉 token 计算公式校正**：主报告沿用了旧注释中的 `28×28` 估算（`512` token）；Astra 核对了本地 `${MODEL_ROOT}/Qwen3.8-27B/config.json:134-135` 实为 **`patch_size=16, spatial_merge_size=2`（即 `32×32 = 1024` 像素/合并 token）**，`401,408` 面积对应约 **`392` 个视觉 token**，而环境变量 `IMAGE_MAX_TOKEN_NUM=512` 是独立上限。**裁定**：以真实 `processor` 编码后的 `image_grid_thw` 与 `input_ids` 实测为准，废除一切手写字符/像素估算公式。
- **小红书 `TaskUpdate/TaskCreate` 工具处置**：主报告曾提出“或将 `TaskUpdate` 轮标 `loss: False`”作为备选之一；Astra 明确指出若仅删工具定义会留下无定义调用，建议保留真实工具环境标记并做原工具面 vs 6 工具对照（或在评测沙盒提供无副作用的轻量 Task 状态内建支持）。**裁定**：严禁粗暴只删 `tools` 定义；优先实测对齐 Claude Code `--bare` 原生工具面，确保训推工具集合一致。

---

## 四、统一整改路线图（开工前必改清单）

按先后依赖整理为 **7 项 P0（动用 API 与正式合训前必改）** + **4 项 P1（混训与评测配平必改）** + **2 项 P2（稳健性加固）**：

### P0 阻断级修复（零 API 费，纯本地代码与单测）
1. **[P0-1] 升级 2D 与 CAD 多文件沙盒及验收器**（`run_claude_cases.py` / 新 `run_2d_cases.py`、`check_2d_v2.mjs`、`run_cad_cases.py`、`cad_inspect.py`）：
   - 全部自产采集统一进 **Docker `-w /workspace` + `claude --bare`**（产物统一落 `/workspace/output/`，彻底根除 `/tmp/cad3d-ws`、`/mnt/disk1` 宿主路径与 `gitStatus` 污染）；
   - `check_2d_v2.mjs` 改为挂载本地只读 HTTP 服务加载 `/workspace/output/`（放行同源 `css/src/assets/vendor/gsap.min.js`，阻断一切外网），保留 `renderAt(t)` 乱序复现与 `#scrub/#play/#pause` 硬检，新增双视口零重叠检测与一键 MP4 导出脚本；
   - `cad_inspect.py` 支持完整复制并 AST 审计多模块目录（`params.py + parts/*.py + assembly.py`），补齐 **`.step` 导出与 OCCT 独立回读**、**多零件两两布尔交集零干涉检查**，以及 **剖视图 `section_view.png` + 爆炸图 `exploded_view.png` 渲染**。
2. **[P0-2] 修复 `repos-logging-proxy/process_logs.py` 图文保序与严格调用签名**：
   - `convert_anthropic_messages` 改为按原始 content block 顺序流式生成图文部件（禁止先聚拢全部文本再贴图片）；
   - `is_prefix_of` 纳入归一化后的 `tool_calls` 签名与 `tools` 指纹，保存原始 `stop_reason` / 请求序号。
3. **[P0-3] 为 `logging_proxy_to_swift.py` 与 `run_threejs_best_of_2.py` 补齐原生 `auto-compact` 多段导出**：
   - 识别压缩边界：自动剥离不入训的纯摘要子请求（`compact_task`），将同一 trial 的压缩前段导出为 `compact_before`（保留合法挂起调用监督）、压缩后段导出为 `compact_recovery`，共享同一 `task_key`；
   - `run_threejs_best_of_2.py` 按 `task_key` 接收完整分段组（解除 `accepted == 1` 单行死锁）。
4. **[P0-4] 加固 `convert_native_to_xhs_ready.py` 渲染前状态机与异常拦截**：
   - **直接拒收**：工具参数 JSON 解析失败、孤立/重复/空 `tool_call_id`、末轮 `loss: False`、重入已拆分的旧 `ready.jsonl`（带 `loss_scale` 或相邻拆分 assistant）；
   - **修复空思考正则**：仅当 `reasoning.strip() == ""`（纯空白）时才判为空思考，保护 `Δθ≈π` 等纯数学符号推理；
   - **修复剥尾图片同步**：剥除尾部非 assistant 消息时同步弹出对应数量的尾部 `images`；
   - **保留 sidecar 账本**：为每条输出保留 `uuid / task_key / track / segment_type / terminal_kind` 对账文件，且当任一轨道整轨拒收或异常拒收超阈值时非零退出。
5. **[P0-5] 统一图像归档挂载与全量宿主路径扫描**：
   - 合并数据集时将所有引用图片按 SHA-256 统一归集/硬链至 `$DATA_DIR/images/` 并校验容器内可读性；扩充宿主路径扫描覆盖用户名、`${SHARED_DATA}/`、`/tmp/*ws*` 及 `tools` 描述文本。
6. **[P0-6] 厘清 SWE 回放末轮协议与重新转换**：
   - 回溯 SWE 原始未拆分 Native 数据重走统一转换器；明确评估 `COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT` 终止动作与主轨自然语言收尾的兼容性（必要时仅保留自然收尾通用多轮样本，或严格验证其独立 `bash` 工具命名空间不串扰 `Bash`）。
7. **[P0-7] 修复评测基准提取与缓存污染**（`build_xhs_val_suite.py` + `run_xhs_eval.py`）：
   - `extract_reference_image_path` 严格匹配读取 `/workspace/task/reference-0` 的 `tool_call_id` 回包（无匹配报错隔离，禁止盲退 `images[0]` 或误取前序草图）；
   - `run_xhs_eval.py` 缓存复用必须校验 `{model_or_adapter_sha, template_sha, effort, max_pixels, verifier_sha}` 完整指纹。

### P1 混训配平与训推同构修复
1. **[P1-1] 遵循小红书“不传多余定制参数、走原生默认”原则，仅对齐上下文与视觉上限**：
   - **`reasoning_effort` 与 `--effort` / `--tools` 保持“不传”**：训练端不传 `reasoning_effort`（原生默认即 `xhigh`），推理端同样保持默认 `xhigh`（**切勿改成 `medium`**）；采集与评测 `claude --bare` 同样对齐小红书 `docker_agent.py` **不传 `--effort`、不传 `--tools`**（仅用 `--allowedTools` 控制可执行权限，天然保留一致的原生 25 工具表，顺带消除 P0-4 的 `25 vs 6` 工具表劈叉！）；
   - `run_xhs_eval.py` 显式对齐训练的 YaRN `rope_scaling`（或按实际部署窗口筛段）、真实 `max_pixels` 与图片上限；`compat.py` 将中途 `system` 改为就地折入 `<system-reminder>` 并全路径剥离动态 billing 头。
2. **[P1-2] 核查非白名单工具调用的执行行为**：不传 `--tools` 仅传 `--allowedTools Read Write Edit Bash` 后，核实 Claude Code `--bare` 对 `TaskCreate/TaskUpdate` 等内建状态工具是原生放行还是拦截，确保自产采集、小红书历史段与推理沙盒三者行为一致。
3. **[P1-3] 按真实 `encode + delete` 后的有效监督 Token `U` 配平四源预算**：用容器内真实 `ms-swift` 模板统计 `3D : CAD : 2D : SWE` 的非 mask `U`、截断删除率与自然 EOS 段比例（SWE 控制在 `10%–15% U`，防止小红书单题 ~250K `U` 淹没短轨）。
4. **[P1-4] 视觉拼图清晰度保护**：基于 `patch=16, merge=2` 实测网格，限制拼图最多 `2×2` 并为关键细部（2D 小字/支点、CAD 止口/孔位）配独立局部特写图。

### P2 工程加固
1. **[P2-1] 修复 `launch_h100_lora.sh:53` JSON 默认值花括号语法**：拆分为独立变量赋值并在 `check` 阶段做 `python3 -c 'import json,sys; json.loads(sys.argv[1])'` 预检；同时修复 `compat.py:147` 写死 `(0, 1)` 双 replica 的限制。
2. **[P2-2] 修正 `round2_v3_plugin.py` 全局 Loss 统计**：将跨 rank `MAX` 改为全局有效监督 token 分子/分母精确加权比，并支持关联 sidecar 按轨统计。

---

## 五、分阶段放行门禁（Go / No-Go Gates）

1. **Gate 1 · 离线零预算回归门（0 API / 0 GPU）**：用全部 4 个纯函数反例 + 现有 16 段 XHS + 12 条 SWE + 9 条 CAD + 新造多文件 2D/CAD 正反例夹具跑通单测；`P0-1 ~ P0-7` 全部 100% 通过、训推同一请求编码 token ID 逐位对齐后，才允许发起教师 API 采样。
2. **Gate 2 · 小批长程采集 Canary 门（CAD 6 题 + 2D 6 题）**：覆盖多模块构建与真实/受控压缩边界（每轨 ≥2 题跨 `auto-compact`）；每轨 ≥5/6 独立复验通过、`compact_task` 混入数 = `0`、宿主路径泄漏 = `0`、真实单题成本核清后，才放行扩采至 150–300 题。
3. **Gate 3 · 容器真实编码与 Binpack 梯度探针门**：全候选集经固定训练镜像离线 encode，核验各轨 `delete` 丢失率 `≤2%`、`U` 配比偏差在 `±2pp` 内，且单步 `unpacked vs binpack` 有效 loss 相对误差 `≤1%`、各轨梯度非零。
4. **Gate 4 · 成对推理与防串扰放行门**：同一冻结留出集（3D `core20` + CAD 多体 + 2D 多文件 + SWE）与 `27B Base` 同参配对评测，`unknown tool` 跨轨误调 = `0`、超时与产物通过分列统计、无回归退化后方可签署正式全量合训。
