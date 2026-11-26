# 3D Agent 全链路统一参数与避坑规范（造数 · 转写 · 验收 · 27B 推理与提交）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> 生效日期：2026-11-25  
> 适用范围：`${WORKSPACE}/3d-animation-agent` 下全部 3D 动画（Three.js）、图生 3D、CadQuery 参数化建模与 2D 动画轨的教师造数、CoT 改写、视觉验收、本地 27B 评测与 ModelForge 提交。  
> 血泪教训来源：首版 SFT 复盘 + `Eval v3` 216 份历史重评 + `spotcheck_visual_18790.py` `max_tokens=2048` 假 `WARN` 事故 + `modelforge-checkpoint10946-trial-003`（797557）300 题中 56 题 `reasoning_effort=high` HTTP 400 事故。

---

## 一、五环节统一参数总表（强约束）

| 环节 | 模型与专用通道 | 思考档位 (`reasoning_effort`) | 输出 `max_tokens` / 上下文预算 | 轮数与收敛护栏 | 必守防坑红线 |
| --- | --- | --- | --- | --- | --- |
| **1. 教师造数**（生成 / 修复 / 编辑 / 健康对照） | **3D 专用 DeepSeek `1017`**（`.env.deepseek`，直连 PhanRouter，不与 PPT/18790 混池） | **`high`**（拉满质量上限） | 单轮输出 **`32768`**（禁止 8192 截断大 HTML） | Three.js：生成 `≤36`、修/改/健康 `≤24`；<br>CadQuery：生成 `≤24`、修/改 `≤18`、健康 `≤12` | ① 全量走 `repos-logging-proxy` 抓包（保留真实 `system` 与完整工具 schema）；<br>② 沙盒工具源码与运行环境 **0 宿主机路径泄漏**（禁 `/mnt/disk1`、`${USER_HOME}`）；<br>③ 离线单文件内联 + 自检通过后立刻收尾，禁无限微调 |
| **2. CoT 压缩 / 改写**（控制超长 `<think>`） | 现阶段 DeepSeek `1017`；后续高要求批次优先切 **27B 学生原生投影**（`scripts/student_project_cot.py`） | DeepSeek 改写开 **`low`**；27B 原生投影开 **`medium`** | 输出 **`16384`**（防思考+独白合计截断）；目标长度 One-Shot `3K–8K` tok、ReAct 仅压缩超长轮 | 单轮改写，保留 100% 原始代码与工具调用 | ① **严禁输出 Markdown `#` 标题或审阅报告腔**，必须纯文本第一人称内心独白；<br>② 改写后强制校验代码/工具字段 SHA-256 逐字节不变；<br>③ 放量前用 `scripts/audit_student_nll.py` 核查 `think_nll` 与 `>5` 极端尾巴 |
| **3. 视觉验收 / `Eval v3` 盲评** | **3D 专用 DeepSeek `1017`**（`.env.deepseek`，`scripts/eval_3d_v3.py`） | **`low`**（客观稳定、减少无效发散） | **单图/单评 ≥ `12000`**；**多图/A·B 盲评对战 ≥ `12000`（若空正文自动升至 `16384` 重试）** | 单次严格 JSON 输出 + 原子断点续跑 | ① **严禁设 `2048` 或 `4096`**（推理型模型 `reasoning_tokens` 消耗 `max_tokens`，超预算会返回空 `content`）；<br>② **严禁将解析失败/空响应兜底归为 `WARN`**，必须显式标 `ERROR` / `judge_error` 并重试；<br>③ 100% `blind_id` 匿名 + 50/50 翻转位置 + 纯 WebGL 帧差防 HUD 假动 |
| **4. 27B 学生本地评测** | 原版 `${MODEL_ROOT}/Qwen3.8-27B`（BF16）或 SFT 导出 HF 权重 | **统一主测 `medium`**（与 SFT 训练分布 100% 同构）；单轮极难/摸天花板可加测 **`xhigh`** | 上下文 **`131072`**（CadQuery）~ **`262144`**（Three.js 多轮）；自动压缩窗口留 32K–60K 余量；单轮输出 **`65536`**（绝不再用 8192） | 与教师采用同口径 `--max-turns` | ① **严禁正式评测或长驻服务携带 `--enforce-eager`**（会关闭 CUDA Graph 与 `torch.compile`，使 A100 TP2 单流速度从 ~45 tok/s 暴跌至 ~13 tok/s，并配合 `--enable-prefix-caching --mamba-cache-mode align` 复用多轮前缀）；<br>② **扫卡 → 多卡并起分片跑 → 推理结束立刻停删容器 → `nvidia-smi` 核验归零**；<br>③ 绝不把 64K / 8192 配置性截断误判为模型失败 |
| **5. ModelForge / 沙盒服务提交** | 导出 HF 权重目录 | 模板必须采用统一加固版 `chat_template.qwen38-compat.jinja`（本地附件未发布）（对齐 Aodi `servingfix`：除 `medium`/`low` 外任意 effort 全部映射 `xhigh`，绝不抛错） | 上下文 **`262144`**，`preserve_thinking=true`，TP2/TP4 | 平台要求请求失败率 **`< 1%`**（目标 `0%`） | ① **强制合入 `configs/chat_template.qwen38-compat.jinja`**（含非 `medium/low` 全映 `xhigh` + 中途 `role=system` 内联渲染不抛错，同步写入 `chat_template.jinja`）；<br>② 提交前跑满 OpenAI + Anthropic + 中途 `system` + `high/max/minimal` 全矩阵回归；<br>③ 彻底免去外置 adapter 转发层 |

---

## 二、`Qwen3.8-27B` 思考档位与 SFT 压缩 CoT 的底层耦合原理

经直接核验原版 `${MODEL_ROOT}/Qwen3.8-27B/chat_template.jinja`（副本见 `chat_template.original.jinja`（本地附件未发布））与 `ready.jsonl` 实际入训样本，明确以下 4 条技术事实：

1. **没有独立权重或隐藏路由 token**：`Qwen3.8-27B` 的思考档位本质上只是模板在 `<|im_start|>system` 最前面拼接的一句纯英文指令：
   - **`medium`**：**不插入任何前缀（空字符串）**；
   - **`xhigh`（默认）**：插入 `Reasoning effort is set to xhigh. Please think carefully through the task, validate key assumptions, consider plausible alternatives, and prioritize correctness, consistency, and clarity in the final answer.`；
   - **`low`**：插入 `Reasoning effort is set to low. Keep your thinking brief and focused, moving directly to the conclusion without unnecessary elaboration.`；
   - **`high`（原生不支持）**：原生模板直接抛 `TemplateError` 返回 HTTP 400，**必须用兼容模板映射为 `xhigh`**。
2. **SFT 训练数据里的 `<think>` 权重机制**：
   - `ms-swift 4.5.2` 合并连续同轮 `assistant` 后按分段赋权：思考 `<think>...</think>` **`loss_scale = 0.5`**、正文 **`1.0`**、工具调用 `<tool_call>...</tool_call>` **`2.0`**、天然空思考 **`loss = False`**。
   - 当前 SFT 入训样本的 `system` 不含 `Reasoning effort is set to ...` 前缀，**即 100% 对应原版的 `medium` 模板分布**。
3. **压缩 CoT 对不同推理档位的实际影响**：
   - **`medium`（最推荐默认主测档位）**：与训练分布 100% 对齐，直接体现精炼高信息密度思考 + 准时收尾收益；
   - **`xhigh` / `high`（可用）**：推理时加上原版 `xhigh` 英文指令仍会触发更深入思考，但上限会略受 SFT 压缩目标区间牵引（因此 One-Shot 压缩区间应守在 `3K–8K` 而非压到 `<1K`，避免把复杂题的推理空间压死）；
   - **`low`（兼容）**：与精炼短思考高度契合。

---

## 三、视觉分级定义与 `Eval v3` 验收口径统一

1. **历史抽检脚本（`spotcheck_visual_18790.py`）与新版 `Eval v3`（`eval_3d_v3.py`）的统一判定标准**：
   - **`PASS`**：3D 主体构图清晰、几何与材质扎实无穿模/浮空、且纯 WebGL 画面具备真实连贯 3D 运动（`Eval v3` 另要求五维总分 `≥ 70/100` 且通过纯 WebGL 帧差护栏，排除 HUD 假动）。
   - **`WARN` / `minor_issue`**：3D 作品本身可用且构图/工艺良好，但存在次要提醒项（例如静物/微缩展示类样本帧间位移极小、局部次要元素轻微穿插或边角裁剪）。**严禁把 API 超时、空正文或 JSON 解析失败混入 `WARN`**。
   - **`FAIL`**：白屏/黑屏、核心机构完全冻结或仅 HUD 动、部件脱离/炸点/循环断层、严重偏题或未能完成修复/编辑目标。
   - **`ERROR` / `judge_error`**：接口异常、预算截断或解析失败，**独立记账并触发高预算重试，绝不伪装成 `WARN` 或 `PASS`**。
2. **四轨解耦汇报口径（所有 3D 动画评测通用）**：
   - 轨道 1：**可渲染交付率**（明确拆分 `standalone_inline` vs `workspace_bundle` 补救）
   - 轨道 2：**作品质量均分（0–100）& 视觉通过率**（解耦超时与打包，真实衡量 3D 能力）
   - 轨道 3：**匿名同题盲评胜率（Win / Tie / Loss）**（全集 + 双方均出图正面交锋）
   - 轨道 4：**严格端到端干净交付率（`E2E Clean Pass`）**（视觉通过 + 单文件内联 + 数值通过 + 零超时零空答早停）
