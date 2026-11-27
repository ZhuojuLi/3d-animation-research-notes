# 3D Agent 全链路统一参数与避坑规范（造数 · 转写 · 验收 · 27B 推理与提交）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> 生效日期：2026-11-27（已按 `2026-11-27` `decisions.md`（本地附件未发布） 最终纠偏更新为 **Blender 4.2.10 LTS + 原生 `256K`（`262,144`，关闭 YaRN，不采用非标 `200K` 窗口）** 口径；涉及 XHS 对齐主线与原汁原味无 CoT 改写规则，以 [XHS-UNIFIED-SFT-STANDARD.md](XHS-UNIFIED-SFT-STANDARD.md) 为准）  
> 适用范围：`${WORKSPACE}/3d-animation-agent` 下全部 3D（Blender `bpy` + Three.js）、CadQuery 参数化建模与 2D Web 动画轨的教师造数、视觉验收、本地 27B 评测与 ModelForge 提交。  
> 血泪教训来源：首版 SFT 复盘 + `Eval v3` 216 份历史重评 + `spotcheck_visual_18790.py` `max_tokens=2048` 假 `WARN` 事故 + `modelforge-checkpoint10946-trial-003`（797557）300 题中 56 题 `reasoning_effort=high` HTTP 400 事故 + `384K YaRN` 全参放开 ViT 32 卡 OOM 实测。

---

## 一、五环节统一参数总表（强约束）

| 环节 | 模型与专用通道 | 思考档位 (`reasoning_effort`) | 输出 `max_tokens` / 上下文与压缩预算 | 轮数与收敛护栏 | 必守防坑红线 |
| --- | --- | --- | --- | --- | --- |
| **1. 教师造数 / 统一沙盒对比**（Blender / Three.js / CAD / 2D） | 默认 **`kimi-k3.1-pro`**（`.env`）或 **`claude-opus-5-5`**（`claude-phanthy.sh`）；*（旧 `.env.deepseek` 额度已耗尽）* | **`claude --bare` 不硬传 `--effort`**（走模型原生默认分布） | **统一原生 `256K` 沙盒窗口**：`AGENT_CONTEXT_WINDOW_TOKENS=262144`；默认 `32K` 输出（`32768`）配 `CLAUDE_CODE_AUTO_COMPACT_WINDOW=220000` + `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=85`（若放宽 `64K` 输出则压缩水位下调至 `190000`） | 废除 `≤12–30` 轮紧箍咒，统一设安全护栏 **`--max-turns 120`**（允许 `--continue` 续段）与 `--timeout 3600` | ① 四合一预装工具链（**`Blender 4.2.10 LTS` + `Three.js r180` + `CadQuery 2.6.1` + `Playwright/Chromium`**）严格离线（`allow_network=false`，清除 `*_proxy`）；<br>② 沙盒工作区 **0 宿主机路径泄漏**（禁 `${WORKSPACE_DISK}`、`${USER_HOME}`）；<br>③ 0 思考链改写、0 外部 CDN |
| **2. CoT 压缩 / 改写**（⚠️ **XHS 主线已停用**，仅留 Round 2 历史对照） | XHS 401 主线与 `HCPF-Lite` **严禁改写活跃区 `<think>`**；仅在旧 Round 2 复现实验时使用 `scripts/student_project_cot.py` | 历史对照：DeepSeek `low` / 27B 投影 `medium` | 历史对照：`16384`；`HCPF-Lite` 仅对 `loss=False` 远端历史轮替换为空块 `<think>\n\n</think>` | — | ① **XHS 401 与新自产轨严禁改写 CoT**（避免离策略 NLL 爆炸）；<br>② 远端剥离必须保留 `<think>\n\n</think>` 空块以对齐 `qwen3_8` 模板 |
| **3. 视觉验收 / `Eval v3` & XHS Rubric 盲评** | 异族裁判 **`kimi-k3.1-pro`**（`.env`；旧 `.env.deepseek` 额度已耗尽） | 客观低发散配置（`low` / 严格 JSON） | **单图/单评 ≥ `12000`**；**多图/A·B 盲评对战 ≥ `12000`（若空正文自动升至 `16384` 重试）** | 单次严格 JSON 输出 + 原子断点续跑；确定性硬检前置短路（失败样本 `0` Judge Token） | ① **严禁设 `2048` 或 `4096`**（推理型模型 `reasoning_tokens` 消耗 `max_tokens`，超预算会返回空 `content`）；<br>② **严禁将解析失败/空响应兜底归为 `WARN`**，必须显式标 `ERROR` / `judge_error` 并重试；<br>③ 100% `blind_id` 匿名 + 50/50 翻转位置 + 纯 WebGL 帧差防 HUD 假动 |
| **4. 27B 学生本地评测** | 原版 `${MODEL_ROOT}/Qwen3.8-27B`（BF16 **原生 `262,144` [256K] RoPE，关闭 YaRN**）或 SFT 导出 HF 权重 | **XHS 对齐主线不传 effort（走原生默认 `xhigh`）**；*（仅旧 Round 2 `ready.jsonl` 对照测 `medium`）* | **与原生 `256K` 训练 1:1 对齐**：vLLM **`--max-model-len 262144`**、`MAX_PIXELS=401408`；沙盒 `AGENT_CONTEXT_WINDOW_TOKENS=262144`，配 `32K` 输出 + `220000` / `85%` 压缩（或 `64K` 输出 + `190000` 压缩，严守 `compact + output < 262,144`） | 与教师采用同口径 `--max-turns` / `--timeout-s` | ① **严禁正式评测或长驻服务携带 `--enforce-eager`**，必须配合 `--enable-prefix-caching --mamba-cache-mode align` 且**零代理中段改写**（保护 Prefix Cache）；<br>② **扫卡 → 多卡并起分片跑 → 推理结束立刻停删容器 → `nvidia-smi` 核验归零**；<br>③ 绝不把配置性截断误判为模型失败 |
| **5. ModelForge / 沙盒服务提交** | 导出合并 BF16 HF 权重目录（`0644` 权限，目录 `0755`） | 模板必须采用统一双修加固版 `chat_template.qwen38-compat.jinja`（本地附件未发布）（对齐 Aodi `base-27b-submit-003`：除 `medium`/`low` 外任意 effort 全映 `xhigh` + 中途 `system` 内联渲染不抛错） | 按平台 `submit.yaml` 规格配置（如 `--max_model_len 1000000` + `VLLM_ALLOW_LONG_MAX_MODEL_LEN=1`，`preserve_thinking=true`，TP4） | 平台要求请求失败率 **`< 1%`**（目标 `0%`） | ① **强制双写 `chat_template.jinja` 与 `tokenizer_config.json`**；<br>② 提交前在官方 `vllm-openai:v0.25.1` 镜像实测 `plain / reasoning_effort=high / mid_conversation_system / tool_call` 全矩阵 HTTP 200；<br>③ 默认仅署名 `${OWNER}`，绝不落盘密码或 token |

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
