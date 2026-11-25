# Round 2 阶段 1 · 线 A：评测基线与根因诊断总报告

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

- **交付目录**：`${WORKSPACE}/3d-animation-agent/reports/round2-line-a-eval-20261124-001/`
- **比较模型**：`base`（BF16 `Qwen3.8-27B` 原版，服务于 `gpu38`） vs `student`（首版混合 SFT `checkpoint-10946`，服务于 `gpu34`）
- **核心交付清单**：
  1. 任务 A1 根因诊断：[old-dev-failure-diagnosis.md](old-dev-failure-diagnosis.md)
  2. 任务 A2 Aodi 10,697 训练题面查重：devtest-v2-aodi-dedup.json（本地附件未发布）
  3. 任务 A3 GPU 释放凭据：gpu-cleanup.json（本地附件未发布）（16×H800 全 0 MiB / 0 计算进程 / 0 残留容器）
  4. 任务 A3 逐分片技术基线汇总：dev-results.json（本地附件未发布）、test-results.json（本地附件未发布）、all-results.json（本地附件未发布）
  5. 任务 A3 级联失败聚簇：failure-clusters/failure-clusters.json（本地附件未发布） 与 failure-clusters/failure-clusters.md（本地附件未发布）
  6. 任务 A3 27 条技术通过样本 18790 DeepSeek 初步看图抽查：visual-spotcheck-deepseek.json（本地附件未发布）（仅作诊断参考，**非正式冻结盲评**）
  7. 基础设施与门禁记录：services.json（本地附件未发布）、dev-gate.json（本地附件未发布）、compat.log（本地附件未发布）、orchestrator.log（本地附件未发布）、scoring.log（本地附件未发布）、service-logs/（本地附件未发布）

> **口径红线声明**：`evals/devtest-v2` 的盲评一致率与容差阈值尚未冻结，因此本报告中全部通过技术与数值验收的交付均严格标注为 **`technical_pass / pending_blind_review`**，**不虚报正式盲评 `Accepted@1`**。18790 `deepseek-v4.1-flash-1017` 仅用于对全部 27 条 `technical_pass` 样本的 `filmstrip.jpg` 做初步视觉分诊抽查，不替代多视角/交互/保留项正式盲审。

---

## 一、任务 A1 核心结论：旧 Dev“空答缺 HTML”与“broken_delivery”根因

完整逐条取证与可直接合入代码/自检门的修复方案见 [old-dev-failure-diagnosis.md](old-dev-failure-diagnosis.md)，核心发现如下：

1. **旧 dev 3 条 `student`“正常结束却终答为空、缺 HTML”（全集 9/60，100% 仅见于 `student`，`base` 为 0/60）**：
   - **终答前是否写过源码/HTML**：`holdout-sundaram-repair` 0 源码 / 0 HTML；`holdout-debruijn-repair` 写过 `mechanism.mjs` + `scene.mjs` / 0 HTML；`holdout-munsell-repair` 写过 `mechanism.mjs` + 多次截断残缺的 `main.mjs` / 0 HTML。
   - **明确排除**：HTTP 400 / compat 代理故障（`api_errors=[]`）或 `CLAUDE_CODE_MAX_OUTPUT_TOKENS=8192` 硬截断（真正超 8192 会触发合成报错并 `exit=1, is_error=true`，而空答样本末轮仅 191–4,918 est tokens）。
   - **真正根因（模型 SFT 早停退化 × 解析器/CLI 静默终止协议）**：
     - 首版 SFT 中 87.9% 加权监督 token 为无 `<think>`、无 `tools` 的单轮 `aodi_answer_only`，且 249 条 `react` 样本将 `tools` 置空为 `"[]"` 并拆分为 10,098 条纯 `<think>...</think>` 独立 `assistant` 消息（13,425 对连续 `assistant`，5,939 条纯思考消息带非零 loss）。
     - 导致 `student` 学到了不稳定的思考/工具边界：4 条轨迹未闭合 `</think>` 即吐出 `</parameter></function></tool_call>` 并早停 EOS（如 `holdout-munsell-repair`、`test/holdout-soma-build`、`test/holdout-reuleaux-compare`），9 条轨迹末轮仅含未闭合 `thinking` 即发 `<|im_end|>`，`InputValidationError` 达 `base` 的 5.1×（91 vs 18）。
     - vLLM `qwen3` reasoning parser 将未闭合思考整体归入 `thinking`、`content=""`、`tool_calls=[]`、`stop_reason="end_turn"`，Claude Code CLI 据此静默判定正常结束（`exit=0, is_error=false, result=""`）。
2. **`broken_delivery_missing_workspace_file`（旧集 55/120 = 45.8%；`base` 37/60、`student` 18/60）**：
   - **55/55（100%）** 均为 <50 KB 的 HTML 壳引用外置 `<script src=...>`；**52/55（94.5%）** 引用的 bundle 就在 `workspace/output/` 中；**54/55（98.2%）** 跑过截图脚本、**45/55（81.8%）** 读回过 PNG 并自信宣称“已验证”。
   - **直接根因**：旧契约未明确写死“单文件内联、零 `<script src>`” + `/opt/tools/capture.cjs` 在原 `output/` 目录原地加载且不拦截 `file://` 子请求，造成 98.2% 假阳性；正式评分器仅单文件拷入空 staging 目录冷加载并拦截全部子请求。
3. **已在本次 A3 实测中得到直接验证**：
   - `devtest-v2` 题面新增了 `"Deliver one self-contained HTML file that loads offline with no external or workspace-absolute references."` 后，**`broken_delivery_missing_workspace_file` 从 55/120（45.8%）断崖下降至 4/120（3.3%，且 `student` 为 0/60！）**。
   - 同时 `student` 的 `empty_think_only_end_turn` 在 `devtest-v2` 上再次精准复现：**`student` 6/60 vs `base` 0/60**，100% 证实 A1 根因判断。

---

## 二、任务 A2 核心结论：`evals/devtest-v2` 与 Aodi 10,697 训练题面近重复查重

完整结果见 devtest-v2-aodi-dedup.json（本地附件未发布）（同时附带对 249 条 ReAct 训练题面的交叉检查）：

| 查重指标（60 道 `devtest-v2` 题面 vs 10,697 条 `aodi_answer_only`） | 实测值 | 参考阈值 / 结论 |
|---|---:|---|
| `max_sim`（与 `check_devtest_v2_isolation.py` 同口径 token Jaccard） | **0.1957** | `< 0.50`（隔离脚本阈值）且 `< 0.35`（严格复核阈值），**0 对超标** |
| `max_content_token_jaccard`（去除通用 3D/HTML 样板词） | **0.1786** | 无近重复 |
| `max_word_bigram_jaccard`（词 2-gram Jaccard） | **0.0506** | 无短语/模板抄袭 |
| `max_react_token_jaccard`（额外对照 249 条 ReAct 题面） | **0.0726** | 无重叠 |
| 潜在文本/模板泄漏（`potential_leakage_detected`） | **`false`** | **未发现题面或数学契约泄漏** |

- **Top-3 最相似对**（完整 Top-10 见 JSON）：
  1. `v2-geartrain-build` vs `scenes-v2/scene-expansion-0338`（line 6287）：`token_jaccard=0.1957`, `content=0.1176`, `bigram=0.0278`（共享词：`final, gear, input, tooth`）
  2. `v2-geartrain-edit` vs `scenes-v2/scene-expansion-1386`（line 6999）：`token_jaccard=0.1750`, `content=0.1667`, `bigram=0.0000`（共享词：`compare, gear, input, ratios, rotation`）
  3. `v2-spirograph-build` vs `scenes-v1/scene-003176`（line 2425）：`token_jaccard=0.1667`, `content=0.1111`, `bigram=0.0137`（与滚球钟仅共享通用词）
- **概念级标题/术语透明披露**：
  - **dev 6 族**（`collatz, euclid, bresenham, pascal, farey, thuemorse`）在全部 10,697 条 Aodi 中 **0 条概念短语命中**。
  - **test 12 族**中 7 族（`hilbert, fibonacci, cantor, looksay, ferris, egyptian, decimalseventh`）0 命中；5 个机械/物理家族有宽泛题材近邻（`v2-crankslider`: `scene-001829` simple crank slider 等；`v2-spirograph`: `scene-002672` spirograph drawing machine 1 条；`v2-restitution`: `scene-expansion-3601` 等 4 条；`v2-domino`: `scene-expansion-0330/0331/0332` 等 4 条；`v2-geartrain`: gear train / pinion 场景），但均不共享 `devtest-v2` 的 `sample(...)` 确定性数值契约、修复/编辑夹具与多变体 rubric，不构成评测泄漏。

---

## 三、任务 A3：`evals/devtest-v2`（60 题 = dev 12 + test 48）首次配对基线

### 3.1 执行协议、夹具审计与 GPU 释放核验

- **严格沿用首版已验证环境**：vLLM 镜像 `${CONTAINER_IMAGE}`、TP4、262144 上下文、medium 思考、200000 自动压缩、8192 `max_output_tokens`、3600s/题、`compat.py` 兼容入口、`Read,Write,Edit,Bash,Glob,Grep`。
- **并行部署与配对对称性**：`gpu38`（2× Base 27B TP4，GPU 0–3 / 4–7）与 `gpu34`（2× `checkpoint-10946` TP4，GPU 0–3 / 4–7），同题在两臂绑定相同副本编号（`idx % 2`），单副本并发 ≤12。先跑通 dev 12 并通过 `dev-gate.json`（**0 条 HTTP/compat 基础设施错误**，24/24 正常执行），再放开跑 test 48（96/96 正常执行，**全 120 题 0 条 HTTP 400/连接类故障**）。
- **重要发现（`evals/devtest-v2/cases.json` 缺省 `fixture` 字段）**：冻结的 `evals/devtest-v2/cases.json` 中 30 道 `repair`/`local_edit` 题未写 `"fixture"` 键，但 `evals/devtest-v2/fixtures/<case_id>/mechanism.mjs` 实际存在且题面声明根目录提供 `mechanism.mjs`。本 runner 在不修改冻结原件前提下，按目录确定性加载全部 30 份 `mechanism.mjs` 并在 `start.json` 中登记 sha256（建议线 C 在下一版冻结时同步补齐 `cases.json` 的 `fixture` 字段）。
- **GPU 硬规 100% 达标**：全部 120 条推理于 `2026-11-24T15:49:39Z` 结束后立即进入 `finally:` 回收，41 秒内完成全部 4 个 vLLM 容器日志归档、停止、删除及本地隧道清理，`gpu-cleanup.json` 于 `2026-11-24T15:50:21Z` 核验 `gpu34` 与 `gpu38` **全部 16 张 H800 均为 0 MiB / 0 计算进程 / 0 残留容器（`phase: "released"`）**，所有浏览器评分与失败聚类均在释卡后进行。

### 3.2 核心配对结果总表（技术与数值验收；盲评待定）

> **注意**：`technical_pass` 表示在 3600s 内正常结束、源码与 `mechanism.mjs` 齐全、数值验收（`sample.mjs` 与 `evals/devtest-v2/check_module.mjs` **120/120 完全一致，0 差异**）全过、离线单文件冷加载（`observe.cjs`：0 外部请求、0 页面错误、有 WebGL 绘制、≥2 唯一画面、非空 `__3D_STATE__`、65/65 帧完整）全过，**状态为 `technical_pass / pending_blind_review`**。

| 分片 | 指标 | `base` (Qwen3.8-27B 原版) | `student` (checkpoint-10946) | 配对对比 / Δ（student − base） |
|---|---|---:|---:|---|
| **Dev (12 题 / 6 族)** | **`technical_pass / pending_blind_review`** | **4 / 12 (33.3%)** | **4 / 12 (33.3%)** | both=3, base_only=1, student_only=1, neither=7；族均值 Δ=**0.0000** (95% CI `[-0.2500, +0.2500]`) |
| | `technical_pass` 且 `repeat_exact=true` | 3 / 12 (25.0%) | 3 / 12 (25.0%) | 持平 |
| | 交付 `output/index.html` / 单文件冷加载无外部错 | 12 / 12 ；10 / 12 | 10 / 12 ；9 / 12 | `student` 少 2 份（1 超时 + 1 空答早停） |
| | `check_module.mjs` 数值通过 / `check_browser.mjs` 3D 通过 | 12 / 12 ；10 / 12 | 11 / 12 ；9 / 12 | 两臂数值正确率均 ≥91.7% |
| | 整题超时（3600s） / 思考态空答早停 | 7 / 12 ；**0 / 12** | 6 / 12 ；**1 / 12** | `student` 复现 A1 空答早停 |
| | 总耗时(s) / 观测总 token | 39,729.9s / 11.41M | 36,363.0s / 23.66M | `student` 均单题工具轮次更多 |
| **Test (48 题 / 12 族)** | **`technical_pass / pending_blind_review`** | **8 / 48 (16.7%)** | **11 / 48 (22.9%)** | both=3, base_only=5, student_only=8, neither=32；族均值 Δ=**+0.0625** (95% CI `[-0.0417, +0.1875]`) |
| | `technical_pass` 且 `repeat_exact=true` | 7 / 48 (14.6%) | **11 / 48 (22.9%)** | `student` test 技术通过 100% 满足 `repeat_exact` |
| | 交付 `output/index.html` / 单文件冷加载无外部错 | 35 / 48 ；32 / 48 | 35 / 48 ；31 / 48 | 基本持平 |
| | `check_module.mjs` 数值通过 / `check_browser.mjs` 3D 通过 | 42 / 48 ；26 / 48 | 42 / 48 ；28 / 48 | 数值两臂均 87.5% |
| | 整题超时（3600s） / 思考态空答早停 | 34 / 48 ；**0 / 48** | 30 / 48 ；**5 / 48** | `student` 复现 A1 空答早停（5 次） |
| | 总耗时(s) / 观测总 token | 157,173.5s / 29.15M | 148,436.8s / 59.32M | `student` 每技术通过耗时低 31.3%（13.5ks vs 19.6ks） |
| **全集 (60 题 / 18 族)** | **`technical_pass / pending_blind_review`** | **12 / 60 (20.0%)** | **15 / 60 (25.0%)** | both=6, base_only=6, student_only=9, neither=39；族均值 **26.4% vs 22.2%**，Δ=**+0.0417** (95% CI `[-0.0694, +0.1528]`) |
| | `technical_pass` 且 `repeat_exact=true` | 10 / 60 (16.7%) | **14 / 60 (23.3%)** | `student` 回放幂等率更高（93.3% vs 83.3%） |
| | 按题型拆解（`generation` / `repair` / `local_edit`） | 5/30 ；4/18 ；3/12 | 7/30 ；3/18 ；5/12 | `student` 在生成与局部编辑占优，修复略弱（受早停拖累） |
| | `check_browser.mjs --kind 3d` 通过（全 60 题 / 仅技术通过内） | 36/60 ；11/12 | 37/60 ；14/15 | 额外抓出 2 条依赖 `rAF` 才渲染的隐蔽缺陷 |
| | **18790 DeepSeek 初步看图抽查（27 条 `technical_pass` 全量，非正式盲评）** | **9 looks_good / 3 clear_defect** | **10 looks_good / 1 minor_issue / 4 clear_defect** | 见 3.4 节，明确剔除仅 HUD 动/机构错误样本 |

### 3.3 `classify_first_sft_failures.py` 级联失败聚簇（全集 120 条）与新旧题集对比

| 级联根因（`classify_first_sft_failures.py`） | 旧集 `holdout-v1` (120) | 新集 `devtest-v2` 总计 (120) | `devtest-v2` `base` (60) | `devtest-v2` `student` (60) | 核心演化解读 |
|---|---:|---:|---:|---:|---|
| **`other_timeout`（纯超时：代码/数值/冷加载全过，唯独超时）** | 9 (7.5%) | **49 (40.8%)** | **26 (43.3%)** | **23 (38.3%)** | **跃升为第一大瓶颈！** 49 条中 **43 条通过 `check_browser.mjs` 3D 检查、34 条 `repeat_exact=true`**，说明模型做好了但陷入无限微调不收尾 |
| `no_delivery_html`（缺 `output/index.html`） | 35 (29.2%) | **28 (23.3%)** | 13 (21.7%) | 15 (25.0%) | `base` 多为超时前未及打包或超 8192；`student` 含 4 条正常退出空答早停 |
| **`technical_pass / pending_blind_review`**（脚本标记 `unclassified`，0 机器错误） | 18 (15.0%送盲审) | **27 (22.5%)** | 12 (20.0%) | 15 (25.0%) | 相比旧集送盲审率（18/120 = 15.0%）提升 +7.5pp |
| **`broken_delivery_missing_workspace_file`（外置 `<script src>`）** | **55 (45.8%)** | **4 (3.3%)** | **4 (6.7%)** | **0 (0.0%)** | **降幅 -42.5pp！** 新题面单文件声明彻底消灭了 `student` 的外置脚本失误 |
| `browser_cascade_unresolved`（冷加载异常/超时未完整回放） | 1 (0.8%) | 4 (3.3%) | 1 (1.7%) | 3 (5.0%) | 多伴随超时中途文件残缺 |
| `numeric_failure`（`mechanism.mjs` 数值检查失败） | 1 (0.8%) | 3 (2.5%) | 2 (3.3%) | 1 (1.7%) | 另有 4 条数值错同时缺 HTML 归入 `no_delivery_html`（共 7 条数值失败） |
| `other_offline_or_page_error_timeout` + `page_error_without_external` | 0 | 4 (3.3%) | 1 (1.7%) | 3 (5.0%) | 运行时 JS 报错（非外部依赖） |
| `other_abnormal_end`（`test/v2-fibonacci-build/base` 读图超 16 张触发 vLLM 500） | 0 | 1 (0.8%) | 1 (1.7%) | 0 | **新发现**：`base` 单会话 `Read` 超过 16 张 PNG 触碰 `--limit-mm-per-prompt '{"image":16}'`（另有 4 条超 8192 `max_output_tokens` 归入 `no_delivery_html`） |

### 3.4 关键能力与视觉抽查洞察（为 Round 2 阶段 2 提供直接抓手）

1. **`check_browser.mjs --kind 3d` 抓出的 2 条隐蔽 `rAF` 依赖缺陷**（`observe.cjs` 未拦住，因未 stub `requestAnimationFrame`）：
   - `test/v2-ferris-compare/base`：`browser_or_protocol_error`（禁用 `rAF` 后初始化/渲染卡死）；
   - `test/v2-hilbert-compare/student`：`no_webgl_draw`（禁用 `rAF` 后 `draws=0`，说明 `renderAt(t)` 未同步调用 `renderer.render()`，DeepSeek 看图也独立证实其 12 帧仅 HUD 变化、3D 几何静止）。
2. **18790 `deepseek-v4.1-flash-1017` 全量 27 条 `technical_pass` 初步画面抽查摘要**（详见 visual-spotcheck-deepseek.json（本地附件未发布），**仅作分诊参考，非正式盲评**）：
   - **Dev 8 条**：`base` 3 `looks_good`（`collatz-build`, `collatz-repair`, `farey-build`）+ 1 `clear_defect`（`pascal-repair` 钉阵膨胀爆炸未保布局）；`student` 3 `looks_good`（`collatz-build`, `farey-build`, `pascal-repair`）+ 1 `minor_issue`（`pascal-build` 末帧仅到 ROW8 未显 ROW10/C(10,3)）。
   - **Test 19 条**：`base` 6 `looks_good` + 2 `clear_defect`（`domino-edit` 3s 后冻结、`ferris-repair` 初始高度模型错）；`student` 7 `looks_good` + 4 `clear_defect`（`crankslider-repair` 仅 HUD 动、`hilbert-compare` 仅 HUD 动、`domino-edit` 后排橙色多米诺未倒、`ferris-build` 4.375s 后高度掉回 0）。
   - **值得关注的信号**：`student` 2 条 `empty_think_only_end_turn` 但碰巧已有 HTML 的样本（`test/v2-crankslider-repair`、`test/v2-domino-edit`）在画面抽查中 **2/2 均为 `clear_defect`**，说明早停打断了模型最后的自检与修复轮次。
3. **对 Round 2 线 B / 线 D 的最高 ROI 优先级建议（按可挽回题数排序）**：
   - **P0（可挽回 ~40% 全集失败）：收束与收敛纪律（Convergence Discipline）**。49/120 条样本已经是可冷加载、数值正确的成品却死于 3600s 超时（且 `base` 还因读图 >16 张触发 1 次 vLLM 多图上限报错）。线 B 教师采集必须强制限制读图次数（≤8–10 张）与修图轮数（1–2 轮），并让 SFT 学生学会“自检全过即立刻收尾交付”。
   - **P1（彻底根治 `student` 专属退化）：修复 SFT 轨迹消息编码与配比**。取消连续拆分的纯 `<think>` `assistant` 消息、保留真实 `tools` schema、降低非思考单轮 Aodi 权重占比，根除 `student` 独有的 `empty_think_only_end_turn`（旧集 9/60、新集 6/60，而 `base` 两集均为 0/60）。
   - **P2（堵住最后 3.3% 外置脚本 + `rAF` 同步渲染 + 乱序回放）**：将 `capture.cjs` 升级为“单文件孤立冷加载 + `rAF` 冻结检查 + 乱序 `renderAt` 幂等自检”，并同步合入教师准入门。
