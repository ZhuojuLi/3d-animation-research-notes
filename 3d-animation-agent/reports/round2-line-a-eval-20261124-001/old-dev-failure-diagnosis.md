# 旧 Dev“空答缺 HTML”与“broken_delivery”根因精准诊断

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

- **分析对象**：`reports/first-sft-eval-20261123-001/`（冻结 dev 12 题 × 2 臂 = 24 条；必要时交叉核对 test 48 题 × 2 臂 = 96 条，总计 120 条最终计分轨迹）
- **参考输入**：
  - `reports/line-c-devtest-mutation-20261124-001/c1-failure-clusters/failure-clusters.json`
  - `reports/first-sft-eval-20261123-001/opus-dev-review/OPUS-REVIEW.md`
  - 原始轨迹 `runs/first-sft-eval-20261123-001/{dev,test}-trial-1/`、`compat.log`、`service-logs/` 及首版 SFT 数据 `${SHARED_DATA}/3d-agent-sft/first-sft-20261123-001/input/train.jsonl`
- **核查结论摘要**：
  1. **旧 dev 3 条“正常结束却终答为空、缺 HTML”（全集 9 条，100% 集中在 `student` / `checkpoint-10946`，`base` 为 0/60）**：**不是** HTTP 400、compat 代理或 8192 `max_tokens` 硬截断所致，而是 **SFT 后学生模型独有的早停 EOS 与思考/工具边界失稳**（在未闭合 `</think>` 时直接输出 `<|im_end|>`，或在 `<think>` 内部未闭合即输出 `</parameter></function></tool_call>` 并早停），叠加 **vLLM `qwen3` reasoning parser + Claude Code CLI 对空文本 `end_turn` 直接判成功的协议放大器**。
  2. **`broken_delivery_missing_workspace_file`（全集 55/120，dev 8/24、test 47/96）**：**100%（55/55）都是“外置 `<script src=...>` 文件未内联”导致的离线单文件冷加载失败**，其中 **52/55（94.5%）** 所引用的 bundle 实际就躺在 `workspace/output/` 里，**54/55（98.2%）** 运行过截图工具，**45/55（81.8%）** 还读回了 PNG 截图并误以为验证通过。直接根因是 **旧契约表述歧义 + `/opt/tools/capture.cjs` 在原 `output/` 目录内直接加载（不隔离目录、不拦截 `file://` 子请求）制造了系统性假阳性**。

---

## 一、旧 Dev 3 条“正常结束却终答为空、缺 HTML”逐条取证

### 1.1 终答前是否写过源码/HTML？（逐条精确证据）

3 条轨迹均为 `student`（`checkpoint-10946`）在 dev repair 题上的最终计分尝试，均以 `exit=0`、`timeout=false`、`is_error=false`、`subtype="success"`、`stop_reason="end_turn"`、`result=""`、`api_errors=[]`、`stderr=0 B` 结束：

| Case (`dev-trial-1`) | 耗时(s) | 轮数 / 工具调用 | 总 `output_tokens` / 末轮估算思考 token | 终答前工作区实际文件（不含 `node_modules`） | 是否写过源码 | 是否写过 HTML | 末轮 `stream.jsonl` 实际尾部证据 |
|---|---:|---:|---:|---|---|---|---|
| `holdout-sundaram-repair/student` | 218.2 | 3 / 2 (`Bash`, `Read`) | 3,619 / 4,918 est | 仅初始夹具 `mechanism.mjs` (40 B) | **否** | **否** | 事件 `[3526]` 仅含 12,851 字符 `thinking`，尾部出现破折号/省略号退化（`……——stroke cell labeled sample——labeled out of range the stroke is off tray……`）后直接 EOS，无 `</think>`、无 `text`、无 `tool_use` |
| `holdout-debruijn-repair/student` | 1,424.8 | 14 / 13 | 26,616 / 2,419 est | `mechanism.mjs` (52 B), `output/src/mechanism.mjs` (894 B, 已用 `node` 验证 0..11 全对), `output/src/scene.mjs` (12,482 B) | **是**（已写并验证 `mechanism.mjs`，已写 `scene.mjs`） | **否** | 事件 `[21094]` 仅含 6,393 字符 `thinking`，在讨论 esbuild IIFE 打包内联方式时于句中（`Actually by default esbuild iife declares an export namespace via wrapped function`）直接 EOS，无 `</think>`、无 `text`、无 `tool_use` |
| `holdout-munsell-repair/student` | 1,804.1 | 17 / 16 | 32,882 / 2,654 est | `mechanism.mjs` (33 B), `output/src/mechanism.mjs` (825 B, 已用 `node` 验证), `output/src/main.mjs` (3,453 B，半截残码) | **是**（写过 `mechanism.mjs`，并 5 次 `Write` + 4 次 `Edit` 尝试写 `main.mjs`） | **否** | 事件 `[24532]` 仅含 6,126 字符 `thinking`，**未输出 `</think>` 即在思考末尾直接输出了 `RING\n</parameter>\n</function>\n</tool_call>`** 并 EOS，无 `text`、无 `tool_use` |

> **注**：`holdout-sundaram-repair/student` 在 `dev-transport-incident` 的旧尝试（因 HTTP 400 归档重跑）中曾写出 `output/src/mechanism.mjs` 与 `output/src/main.mjs`，但正式计分的重跑尝试在第 3 轮就因早停退出；`holdout-debruijn-repair/student` 与 `holdout-munsell-repair/student` 均未经历 HTTP 400 重跑。

### 1.2 全集 120 条交叉对照：这是 `student` 独有的系统性退化

对全部 120 条（dev 24 + test 96）扫描“正常退出（`exit=0, !timeout, !is_error`）且无 HTML 交付”及 XML/工具调用异常：

| 指标（全集 60 题/臂） | `base` (Qwen3.8-27B 原版) | `student` (checkpoint-10946) | 结论 |
|---|---:|---:|---|
| 正常退出且末轮仅含 `thinking`（终答 `""`、无 HTML） | **0 / 60** | **9 / 60**（dev 3 + test 6） | **100% 仅见于 `student`** |
| 正常退出仅发过渡短文本无工具调用（无 HTML） | **0 / 60** | **1 / 60**（`test/holdout-analemma-compare`） | 仅见于 `student` |
| `thinking` 内容中出现 `</parameter>` / `</function>` / `</tool_call>` 泄漏 | **0 题 / 0 轮** | **4 题 / 4 轮**（含 dev `munsell-repair`、test `soma-build`、`reuleaux-compare` 等） | **100% 仅见于 `student`** |
| 触发 `8192 output token maximum` 合成报错（`is_error=true, exit=1`） | **4 / 60** | **1 / 60**（`test/holdout-bulgarian-build`） | 真正超 8192 会走报错通道，**不会**静默空答 |
| 空参数 `tool_use`（`input={}`）次数 | 13 次 | **49 次**（3.8×） | `student` 工具 XML 协议显著退化 |
| 工具 `InputValidationError` 次数 | 18 次 | **91 次**（5.1×） | `student` 参数截断/缺参频发 |

在 test 集的 6 条同类 `student` 空答轨迹中，同一退化模式完全复现：
- **未闭合 `</think>` 即泄漏 XML 闭合标签**：`test/holdout-soma-build/student`（末轮仅 971 est tokens，尾部 `['L','#f6c245',[ 2.1,-0.8,-2.1],[2\n</parameter>\n</function>\n</tool_call>`）、`test/holdout-reuleaux-compare/student`（末轮仅 726 est tokens，尾部 `% - src/p\n\n</parameter>\n</function>\n</tool_call>`）。
- **低 token 句中早停 EOS**：`test/holdout-galton-edit/student`（末轮仅 **191 est tokens / 564 字符**，停在 ``I have been emitting ` ``）、`test/holdout-sarrus-compare/student`（934 est tokens，停在公式 `SET equal ⇒ Mx = 0 ⇒ 1`）。
- **长思考文本/符号退化后早停 EOS**：`test/holdout-reuleaux-repair/student`（6,548 est tokens）、`test/holdout-reuleaux-edit/student`（8,619 est tokens，尾部退化为 `.]ø. . Major μ.**]:.[-ω.#.#` 乱码后 EOS）。

更关键的直接反证来自 `dev/holdout-munsell-repair/student` 的前序写入轮次：
- `[11766]`（`Write main.mjs`，2,572 B）断在 `function at(t) {`；
- `[11910]`（`Write main.mjs`，6,843 B）断在注释末尾；
- `[16181]`（`Write main.mjs`，7,141 B）断在注释末尾；
- `[16292]`（`Write main.mjs`，仅 988 B，思考仅 165 est tokens）断在 `went\n// blank; the`；
- `[22301]`（`Edit main.mjs`，仅 1,112 B，思考仅 **18 est tokens**，整轮总输出不足 400 tokens，远小于 8192）断在 `const rimLight = new THREE.DirectionalLight(0x7`；
- `[22414]`（`Edit main.mjs`，仅 **14 B**，思考 157 est tokens）断在 `scene.add(rim\n`！
- 甚至学生模型自己在 `[24532]` 的思考里困惑地写道：*`The file ends with const rimLight = new THREE.DirectionalLight(0x7$ — that is, the Write/Edit content in my message got truncated mid-parameter: 0x7fa8ff became 0x7... apparently even my tool-call parameters in longish turns get cut off??`*——这证明**并非任何基础设施或 8192 上限截断，而是学生模型权重自身在长代码/多轮编辑上下文中过早采样出 `</parameter></function></tool_call>` 或 `<|im_end|>`**。

### 1.3 根因归属定位（模型 SFT 退化 × 协议放大器）

1. **首要根因：首版 SFT 数据配方与消息编码造成的模型早停/边界退化（权重层）**
   - **单轮非思考数据绝对主导**：首版 SFT 10,946 条训练样本中，10,697 条（127.5M / 145.2M = **87.9%** 加权监督 token）为 `aodi_answer_only`，**0 条含 `<think>`、0 条含 `tools`**，大幅改变了 `<|im_end|>` 停止分布，并稀释了长 CoT 与 XML 工具调用的鲁棒性。
   - **ReAct 样本缺工具 schema 且拆分连续 `assistant` 消息**：核查 `${SHARED_DATA}/3d-agent-sft/first-sft-20261123-001/input/train.jsonl` 中全部 249 条 `react` 样本发现：
     - `tools` 字段全部为 `"[]"`（`stage_inputs.py:64` 显式 `assert json.loads(item['tools'])==[]`），系统提示仅为 `"You are a helpful assistant."`，与评测期注入完整 `# Tools` XML 协议的 prompt 存在分布偏移；
     - 为施加 `0.5 / 1.0 / 2.0` 分段 `loss_scale`，每轮 assistant 被拆成连续 2–3 条 `role="assistant"` 消息（249 条共产生 **23,523 条 `assistant` 消息、13,425 对连续 `assistant`、10,098 条纯 `<think>...</think>` 独立 `assistant` 消息，其中 5,939 条带非零 loss**），而工具调用以纯文本而非结构化 `tool_calls` 写入后续 `assistant` 消息。模型因此学到了“思考结束后即可终止 turn / 思考与 XML 工具块解耦”的不稳定边界先验。
2. **放大器：推理 parser 与客户端 CLI 的静默结束机制（协议/客户端层）**
   - `compat.log` 显示 `compat.py` 仅做 `normalize_embedded_system` 透传，未触发任何报错；`service-logs/` 中 `Qwen3XMLToolParser` 正常加载。
   - 当模型未闭合 `</think>` 即输出 `<|im_end|>`（哪怕中间已经吐出了 `</parameter></function></tool_call>`），vLLM `--reasoning-parser qwen3` 将全段归入 `reasoning_content`（映射为 Anthropic `thinking` 块），`content=""`、`tool_calls=[]`、`stop_reason="end_turn"`。
   - Claude Code CLI 收到 `stop_reason="end_turn"` 且无 `tool_use` 的消息后，**即使 `text` 为空且 `output/index.html` 不存在，也会直接判定任务正常完成（`exit=0, is_error=false, result=""`）**，不触发任何续写或提示重试。

---

## 二、`broken_delivery_missing_workspace_file` 根因精准诊断

### 2.1 全集 55 条与 dev 8 条精准统计

`failure-clusters.json` 中 `broken_delivery_missing_workspace_file` 共 **55 / 120 条**（占全部 114 条非通过样本的 **48.2%**；`base` 37/60 = 61.7%，`student` 18/60 = 30.0%；dev 8/24，test 47/96）：

| 诊断维度（基于全部 55 条轨迹与工作区实测） | 命中数 / 55 | 占比 |
|---|---:|---:|
| `output/index.html` < 50 KB（仅为 HTML 壳，含外部 `<script src=...>`） | **55 / 55** | **100.0%** |
| 归类：`base` 外置 esbuild bundle (`./src/bundle.js`, `./app.js`, `js/bundle.js` 等) | 37 / 37 (base) | 100.0% of base |
| 归类：`student` 外置 esbuild bundle / 外置 `.js` 源码 | 15 + 3 / 18 (student) | 100.0% of student |
| HTML 引用的目标 JS 文件**实际存在于 `workspace/output/` 内** | **52 / 55** | **94.5%** |
| 轨迹中明确调用过 `esbuild`（其余多通过自写 `build.mjs` 调用 esbuild API） | **45 / 55** | **81.8%** |
| 轨迹中运行过 `/opt/tools/capture.cjs` 或 Playwright 浏览器截图 | **54 / 55** | **98.2%** |
| 轨迹中用 `Read` 读回过真实截图（`image_tool_results > 0`） | **45 / 55** | **81.8%** |
| 正常完成且非超时（终答普遍声称“已验证通过”） | **28 / 55** | **50.9%** |

### 2.2 典型抽样轨迹证据（dev 4 条 + test 4 条）

1. **`dev/holdout-mancala-repair/student`**（正常结束，非超时）：
   - 执行 `./node_modules/.bin/esbuild output/src/main.mjs --bundle --format=iife --outfile=output/src/bundle.js` 生成 1.15 MB 外置 bundle；
   - `output/index.html`（2,077 B）写入 `<script src="./src/bundle.js"></script>`；
   - 在原工作区运行 Playwright 截了 3 张图并 `Read` 查看，全部渲染正常，终答宣称 *"Done. Everything is verified and the artifacts are in `output/`."*；
   - 评分器 `score.py` 仅将 `output/index.html` 单文件拷入空 staging 目录并拦截一切非 `file:///workspace/index.html` 请求 → 拦截 `file:///workspace/src/bundle.js` → `net::ERR_FAILED` → 5 项级联全败。
2. **`dev/holdout-mancala-repair/base`**（正常结束，读图 10 张）：
   - 同样生成 `output/src/bundle.js`（1.15 MB）并在 `output/index.html`（2,715 B）用 `<script src="src/bundle.js">` 引用，甚至额外拷入 `output/src/vendor/three.*.js`，经 `/opt/tools/capture.cjs output/index.html /tmp/t2.png 2` 验图 10 次后自信交付，单文件冷加载直接失败。
3. **`dev/holdout-sundaram-repair/base`**（正常结束，读图 6 张）：
   - 自写 `output/build.mjs` 打包出 `output/js/bundle.js`（1.11 MB），`output/index.html`（2,009 B）写 `<script src="js/bundle.js">`，经 `capture.cjs` 验图 6 次后终答宣称 *"verified end-to-end by driving the actual page with the capture tooling"*。
4. **`dev/holdout-trammel-build/base`**（正常结束，读图 5 张）与 **`dev/holdout-munsell-repair/base`**（正常结束，读图 10 张）：
   - 分别输出 `output/app.js`（1.22 MB，`<script src="./app.js">`）与 `output/src/bundle.js`（`<script src="./src/bundle.js">`）；后者甚至在终答中误称 *"three.js 0.180.0 inlined via esbuild"*，说明模型以为 `esbuild --bundle` 产出的本地 bundle 就等于“inline / self-contained”。
5. **test 集抽样同样完全一致**：`test/holdout-tusi-edit/base`（`./js/app.bundle.js`）、`test/holdout-tusi-repair/student`（`./src/scene.bundle.js`，读图 3 张后宣称 *"All contract checks pass"*）、`test/holdout-nipkow-build/student`（`./src/scene.bundle.js`，读图 11 张）、`test/holdout-chladni-edit/student`（`src/main.js`，读图 3 张）。

### 2.3 根因归属定位（契约表述 × 验证工具盲区 × 行为惯性）

| 层级 | 具体问题 | 影响占比 |
|---|---|---|
| **验证工具盲区（主因）** | `/opt/tools/capture.cjs` 直接在工作区原地打开 `output/index.html`，既不复制到空目录，也不设 `page.route` 拦截外部/相对子资源。只要 `output/src/bundle.js` 在同目录存在，`capture.cjs` 100% 绿灯，制造了 **54/55 的验证假阳性**。 | 覆盖 98.2% 失败样本 |
| **契约与提示歧义（次因）** | 旧 `OUTPUT_CONTRACT` 写 *"Create an offline, self-contained `output/index.html`... Only files in output/ are delivered"*，未明确写死“禁止任何 `<script src>` / `<link href>` / 相对文件引用，必须将打包后 JS 文本内联写入 `<script>...</script>` 且单文件复制到空目录后能通过 `file://` 冷加载”。模型因此把“打包进 `output/` 不连 CDN”等同于 self-contained。 | 覆盖 100% 失败样本 |
| **行为惯性与数据残留** | 原版 `Qwen3.8-27B` 默认前端工程习惯就是 `esbuild --outfile=output/src/bundle.js` + `<script src=...>`（内联率仅 10/47 = 21.3%）；首版 `student` 经 SFT 后内联率提升至 20/38（52.6%），但 249 条 ReAct 样本中仍有 87 条出现 `outfile=output/...` 中间打包步骤，在没有硬性单文件自检门的情况下，约一半交付仍滑回外置 `<script src>`。 | `base` 61.7% vs `student` 30.0% |

---

## 三、可直接合入「线 B 教师自检」与「学生公开自检」的具体修复建议

> **原则区分**：凡涉及评测环境（`capture.cjs`、`OUTPUT_CONTRACT`）的改动，须在正式协议升级时对 `base` 与 `student` **完全对称开放**（本轮 A3 基线严格沿用既有 `first-sft-eval` 协议以保证可比性，不擅改）。以下条目已按“可直接合入线 B 教师自检/数据清洗”与“可直接合入学生公开自检（下一版公共评测工具）”明确拆列。

### 3.1 直接合入「学生公开自检」（公共 `/opt/tools/capture.cjs` 与 `OUTPUT_CONTRACT`，两臂共享）

1. **将 `/opt/tools/capture.cjs` 升级为“隔离单文件冷加载 + 外部请求拦截 + 乱序定帧探针”**：
   - 在加载前，自动将传入的 `output/index.html` **单独复制到 `/tmp/capture-isolated-<pid>/index.html`**（不复制同目录任何 `.js`/`.css`）；
   - 开启与评分器同构的 `page.route('**/*', ...)`，除主 HTML、`data:`、`blob:` 外一律 `abort()` 并记录 `external_requests`；监听 `pageerror` 与 `console.error`；
   - 校验 `window.__SCENE_READY__ === true`、`typeof window.renderAt === 'function'`、非零 WebGL draw call，并输出结构化 JSON（含 `isolated_cold_load`, `external_requests`, `page_errors`, `webgl_draws`）；若 `external_requests.length > 0` 或 `page_errors.length > 0`，直接返回**非零退出码并打印明确报错**（例如：`EXTERNAL_OR_RELATIVE_ASSET_BLOCKED: file:///.../src/bundle.js — inline all JS/CSS inside output/index.html`）。
   - **预期效果**：直接消灭 54/55（98.2%）因原地截图假阳性导致的 `broken_delivery_missing_workspace_file`。
2. **在公共 `OUTPUT_CONTRACT` 中给出一行无歧义的内联规则**（两臂完全一致）：
   - 明确写清：`output/index.html` 必须能在单独复制到任意空目录后直接通过 `file://` 打开且零子请求；禁止任何 `<script src=...>`、`<link rel="stylesheet" href=...>` 或 ES module 相对路径导入；请用 `esbuild --bundle --format=iife` 产出 JS 文本后直接内联进 `<script>...</script>`（注意用函数式替换 `tpl.replace('/*__BUNDLE__*/', () => js)` 避免 `$` 替换陷阱，并转义 `</script>` 为 `<\/script>`）。
   - 补充回放无状态提醒：`window.renderAt(t)` 必须对任意乱序时间戳幂等（例如从 `t=duration` 回到 `t=0` 或重复 `renderAt(t)` 不留历史帧残影，清除所有累计轨迹/高亮状态后再按绝对时间 `t` 重算）。

### 3.2 直接合入「线 B 教师自检与 SFT 数据准入门」

1. **教师交付硬门（Trajectory Acceptance Gate，未全过不得入库）**：
   - **单文件孤立冷加载门**：将 `output/index.html` 单文件拷入空目录，跑与 `score.py` / `check_browser.mjs` 同构的 `file://` 离线检查（0 `external`、0 `pageErrors`、`webgl_draws > 0`、`unique_screens >= 2`、非空有限 `__3D_STATE__`）；同时静态扫描 `output/index.html` 拒绝任何 `<script[^>]+src=` 与 `<link[^>]+href=`。
   - **乱序回放与定帧幂等门（消灭 dev 盲审高频缺陷）**：自动执行 `t=duration → t=0.37*duration → t=0 → t=0.37*duration`，要求 `repeat_exact=true`（两次相同时间戳的屏幕像素与 `__3D_STATE__` 完全一致）且回到 `t=0` 与初始 `t=0` 一致（直接堵住 `holdout-sundaram-build` 这类回拖残影），并检验 `scrub` 控件联动与暂停后 400ms 冻结不变。
   - **编辑/修复题源码与不变量门**：要求 `output/src/mechanism.mjs` 存在、`check_module.mjs` 全过、且在工作区内无临时调试垃圾文件混入 `output/`。
   - **教师收敛约束**：继续沿用并落实 `TEACHER_CONVERGENCE_PROMPT` 中的单文件内联 + `file://` 自检 + 读图上限（<= 10 张），防止教师轨迹超长（首版 167/249 条 > 64K token）。
2. **SFT 轨迹格式与配方修复（根治 `student` 9/60 早停空答与 5× 工具报错）**：
   - **彻底禁止把单轮 `assistant` 拆成多条连续 `assistant` 消息**：每轮推理只保留**单一 `assistant` 消息**，严格按照 `chat_template.jinja` 原生格式（`<think>\n{reasoning}\n</think>\n\n{content}{tool_calls}<|im_end|>`）编码，**禁止出现纯 `<think>...</think>` 结尾的独立 `assistant` 消息**；若需区分思考/正文/工具的 `loss_scale`，应在 token 级按 span 赋权，而非拆分成多条消息制造伪边界。
   - **保留真实系统提示与 `tools` schema**：不得再将 `react` 样本的 `tools` 置空为 `"[]"`，应完整保留与推理侧一致的 `# Tools` 定义，消除训练-推理分布偏移。
   - **入库过滤思考退化/截断样本**：对教师每轮输出增加自动审计——拒绝任何未闭合 `</think>`、在 `<think>` 内出现 `<tool_call>`/`</parameter>`、空参数 `tool_use`、或 `text="" && tool_calls=[]` 的异常轮次；同时严格控制 `aodi_answer_only`（无 `<think>` 无工具的单轮 HTML）在混合 SFT 中的权重占比（避免 87.9% 单轮无思考 token 压垮多轮 agent 的思考与工具停止分布）。
   - **去除教师轨迹中的外置 bundle 习惯**：禁止包含 `esbuild ... --outfile=output/...js` + `<script src=...>` 的中间绕路轨迹直接无修正入库；若教师必须分步打包，仅允许打包到 `/tmp/bundle.js` 并立即由构建脚本内联写入 `output/index.html`。

### 3.3 客户端/评测器侧可观测性建议（供后续协议迭代评审）

- **区分“正常完成”与“异常早停空答”**：在下一版评测汇总脚本中，将 `exit=0 && result=="" && last_assistant_blocks==["thinking"]` 单独标记为 `empty_thinking_only_end_turn`（而非与 `timeout` 混为 `no_delivery_html`），便于持续追踪 SFT 模型是否彻底根治早停退化。
- **不在无预注册前提下修改评测重试策略**：生产部署 Agent 时可对“空文本 + 无工具调用 + 缺少交付文件”的 `end_turn` 自动追加 1 次续写提醒（例如 *"Your previous turn ended inside thinking without emitting a tool call or final answer; `output/index.html` does not exist yet. Continue and deliver."*），但在模型对照评测中应保持两侧完全一致且先在协议中预注册。
