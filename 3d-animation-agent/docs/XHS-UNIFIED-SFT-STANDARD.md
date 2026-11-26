# XHS 对齐统一训练数据与上下文标准规范（3D 展示 · CAD 打印 · 2D 动画三轨共用）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> 生效日期：2026-11-26（已同步对接 [三轨顶级交付产物规格与高难长程造数指南 v2.0](THREE-TRACK-DELIVERABLE-SPEC.md)）  
> 对齐来源：`decisions.md`（本地附件未发布）（`2026-11-26` 条目）· [3DCodeFactory 论文与源码](../../research/arxiv-2611.28783/README.md) · [三轨顶级交付规格](THREE-TRACK-DELIVERABLE-SPEC.md)  
> 设计目标：**确保 3D（XHS 展示）、CAD 打印、2D 动画三轨在多文件工程交付、多轮模板、上下文窗口、图片分辨率、工具协议、思考链与轮级掩码上 100% 统一标准，消除未来 Round 4 三轨合训时的协议断层与跨轨干扰。**

---

## 一、统一核心规格总表（所有赛道强制对齐）

| 规范维度 | 统一标准值（对齐 XHS `3DCodeFactory`） | 工程原因与防坑红线 |
|---|---|---|
| **学生基座与模板** | `Qwen3.8-27B` BF16；`--model_type qwen3_5 --template qwen3_8 --template_backend swift`（**不传 `reasoning_effort`，走原生默认 `xhigh`**） | 经 `chat_template.original.jinja:47`（`default('xhigh')`）与 `token-decode-audit.json` 逐 token 核实：**训练不传参数时 `ms-swift` `qwen3_8` 默认即为 `xhigh`**；推理端同样不传（或用 `chat_template.qwen38-compat.jinja`（本地附件未发布） 默认 `xhigh`）即 100% 逐 token 对齐，切勿在评测端人为改成 `medium` |
| **上下文与位置编码** | **统一支持至 `384K`（`393,216` tokens，YaRN `scale_factor=1.5`）**；短轨（CAD / 2D）通过 `binpack` 高效拼包，不因长窗口浪费算力 | 完整容纳 XHS `compact_before`（起步段）+ `compact_recovery`（精修收尾段），避免半路硬切 prefix 造成 EOS 坍塌 |
| **多模态视觉分辨率** | 统一 `MAX_PIXELS = 401408`（约 `512` 视觉 token/张，≈ `768×512` 等效面积；极细特写可局部裁切而非硬撑 4K 全图） | 压住 25–45 张多轮截图的视觉 token 爆炸，使 93%+ XHS 合法段严丝合缝落入 `384K`，同时让 CAD 4 视图与 2D 拼图看清全部几何细节 |
| **System 消息纪律** | **严格仅 `messages[0]` 为 `role="system"`**；严禁中途插入 `<total_tokens>` 或第二条 `role="system"`（必要环境提醒折入 `user/tool` 的 `<system-reminder>`） | 杜绝 `Qwen3.8` 模板中途 `system` 报错与异常分布 |
| **工具协议与闭合** | 统一 Claude Code 工具 schema（`Read / Write / Edit / Bash / Glob / Grep`）；**0 重复 `call_id`、0 孤立 `tool_result`、0 中途悬空调用**；仅原生压缩边界允许末尾挂起压缩触发调用 | 让 3D / CAD / 2D 共享同一套工具语法与文件读写肌肉记忆，避免跨轨非法工具调用 |
| **思考链 `<think>`** | **100% 保留教师原生简短第一人称 `reasoning_content`**（`--enable_thinking true --preserve_thinking true`）；严禁改写成 Markdown 方案书腔 | 避免离策略 NLL 爆炸，与 XHS 论文及我方 NLL 审计双重印证 |
| **轮级异常 Loss Mask** | 全轨强制启用 5 规则轮级异常掩码（**掩坏轮、保纠错轮**）：`tool_execution_error`、`protocol_leakage`、`repetitive_reasoning_loop`、`duplicate_tool_target`、`abnormal_ending`；`ms-swift` 统一用 **`"loss": False`** 表示屏蔽，并采用 **纯二值等权 Loss（`--loss_scale default --is_binary_loss_scale true`，不做 `<think> 0.5 / <tool_call> 2.0` 人为分块加权）** | 与 XHS 论文 1:1 对齐，消除人为分块权重调参干扰；自产轨由 `logging_proxy_to_swift.py` 默认开启，XHS 外部轨由 `inspect_and_clean_3dcodefactory.py` 精确取反 HF `loss_mask: true → "loss": False` |
| **采样 Harness 与油门** | **对齐 XHS `docker_agent.py`**：使用 `claude --bare`、**不硬传 `--effort` 档位**（走原生默认分布）、单轮输出上限拉满 **`128,000` tok**（`LLM_MAX_OUTPUT_TOKENS`）、**废除 `≤12–30` 轮紧箍咒**（不强催提前交卷，仅设防死循环安全护栏 + 靠后置 Rubric/Best-of-2 筛优）、**0 思考链改写/压缩** | 彻底消除“为了硬塞 180K 窗而掐死教师视觉打磨上限”与“人工改写 CoT 引入离策略 NLL”两大粗糙补丁 |
| **分段与停机纪律** | **严禁半路硬切无 EOS `prefix` 切片**；长轨迹只允许在合法 `compact_boundary` 切段（`compact_before` + `compact_recovery`），并剔除低密度纯摘要段 `compact_task` 与非编码子会话 `-main-agent-` | 保护模型完整的“验收通过即 EOS 停手”策略 |
| **训练轮次与防遗忘** | **严格 `1 Epoch`**；按五本账（有效监督 token `U`）混入 `10–15%` 通用 SWE 多轮回放 | 防止 2 Epoch 过拟合变慢，并守住 ModelForge 通用底座 |
| **交付契约元数据** | 每条入库样本顶层标注 `track`、`task_key`、`segment_type`、`delivery_contract`（`needs_http_server / bundle_mode / allow_network / motion_type` 四字段） | 评测与合训账本可按轨精准追踪，防止跨轨契约混染 |

---

## 二、三轨对齐映射表（如何保证 CAD & 2D 无缝融入同一模型）

| 轨道 | 运行与交付契约 | 分类树与工厂流程（统一复刻 XHS） | 典型单条长度 & 打包方式 |
|---|---|---|---|
| **Track 1a · 3D 展示/场景（主力）** | XHS 原生栈（`Three.js r180 + vendor + importmap + local http.server + OrbitControls`） | 直接吃满 XHS 401 分片合法段（`before + recovery + main`），Blender = `0%` | `25K–384K`（384K YaRN + `MAX_PIXELS=401408`） |
| **Track 1b · 3D 离线机械动画（轻量保留）** | `esbuild` 单文件内联 + `window.renderAt(t)` | 已有 Pool 1/5b + Astra 联检 `Rubric + P07 + Best-of-2` | `40K–172K`（同模板、同工具、显式契约隔离） |
| **Track 2 · CAD 建模打印（高难单件 + 多零件装配）** | `CadQuery` 参数化工程（复杂单件 `src/model.py`；2–6 件装配拆 `params.py + parts/*.py + assembly.py + export.py`）→ **`STEP` + `3MF` + `STL/GLB`** + 4 视角/剖视图（详规见 [THREE-TRACK-DELIVERABLE-SPEC.md](THREE-TRACK-DELIVERABLE-SPEC.md)） | [cadquery_tree_v2_0.json](../configs/taxonomies/cadquery_tree_v2_0.json)（高难长程主力：对齐小红书 5 大类 × 4 接地气词条 = 20 词条；兼容 [v1.1](../configs/taxonomies/cadquery_tree_v1_1.json)）+ `P07` + 五层几何/防干涉金字塔 + 阶梯 Best-of-2 + 轮级 mask；高复杂单件锚点见 [2026 样本调研](../../research/cad-2d-sample-study-and-taxonomy-v2-20261126/README.md) | `20K–120K`（聚焦高难长程，经 `binpack` 与长序列同锅对齐，五本账按 `U` 控比） |
| **Track 3 · 2D Web 多文件交互动画（主）** | **离线多文件 Web 交互动画工程**（`index.html + css/styles.css + src/*.js + assets/*.svg + vendor/gsap.min.js`，Canvas 2D + SVG + GSAP，本地 `http.server`）+ `window.renderAt(t)` + `#play/#pause/#scrub` + **一键 Playwright/FFmpeg 导 MP4**（详规见 [THREE-TRACK-DELIVERABLE-SPEC.md](THREE-TRACK-DELIVERABLE-SPEC.md)；轻量单文件仅保留兼容） | [anim2d_tree_v2_0.json](../configs/taxonomies/anim2d_tree_v2_0.json)（高难长程主力：对齐小红书 5 大类 × 4 接地气词条 = 20 词条；兼容 [v1.1](../configs/taxonomies/anim2d_tree_v1_1.json)）+ `P07` + 对标 `AnimWeb-Bench`/`MotionGraphicsBench` 升级多文件时空确定性硬检 + 阶梯 Best-of-2 + 轮级 mask（**放弃简单单轮堆量，不走 Manim**） | `30K–180K`（多文件长程视觉精修，经 `binpack` 同锅对齐，五本账按 `U` 控比） |

---

## 三、落盘前必过 4 道硬核验（三轨通用准入闸）

1. **零宿主机路径泄漏**：扫描所有 `messages` 与 `tool_calls`，`0` 处命中 `/mnt/disk1`、`${USER_HOME}`、`${REFERENCE_DATA}`（图像路径仅存在于顶层 `images[]`）；
2. **零任务泄漏划分**：`train / val / test` 严格按 `task_key` / 祖先家族隔离，同任务所有分段绝不跨集；
3. **`<image>` 占位符精确对齐**：每条记录 `messages` 中 `<image>` 出现次数严格等于 `len(images)`，且每张图文件在共享盘存在可读；
4. **`ms-swift` 逐 Token Labels 审计**：训练启动前必跑 10 秒 CPU 模板编码抽检，确认 `"loss": False` 轮次 `labels == -100`、紧邻纠错轮与终轮 EOS 均有有效监督 `labels != -100`。
