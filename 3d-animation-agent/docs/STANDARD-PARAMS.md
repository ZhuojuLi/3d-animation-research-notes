# 3D Agent 全链路统一参数与避坑规范（造数 · 转写 · 验收 · 27B 推理与提交）

> 公开整理版 · 2026-11-28。保留成文时点的记录；计划、文献结果和本地实测请分别理解。环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> 生效日期：2026-11-27（已按 Revision 3 / Option 2 [CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md](../../research/xhs-384k-to-200k-data-adaptation-20261127/CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md)、[OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md](../../research/xhs-384k-to-200k-data-adaptation-20261127/OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md) 与 `decisions.md`（本地附件未发布） 定版更新为：**Blender 4.2.10 LTS + 全链路 `Static YaRN 1.5×`（不切分硬训 `384K` [`393,216`] + 沙盒/评测/线上服务统一 `256K` [`208000 / 80% / 32768 / MAX_TOOL_RESULT_TOKENS=16384`]）**；涉及 SFT 数据与 10 项 §0 修复详见 [XHS-UNIFIED-SFT-STANDARD.md](XHS-UNIFIED-SFT-STANDARD.md)）  
> 适用范围：`${WORKSPACE}/3d-animation-agent` 下全部 3D（Blender `bpy` + Three.js）、CadQuery 参数化建模与 2D Web 动画轨的教师造数、视觉验收、本地 27B 评测与 ModelForge 提交。  
> 血泪教训来源：首版 SFT 复盘 + `Eval v3` 216 份历史重评 + `spotcheck_visual_18790.py` `max_tokens=2048` 假 `WARN` 事故 + `modelforge-checkpoint10946-trial-003`（797557）300 题中 56 题 `reasoning_effort=high` HTTP 400 事故 + 早期未配 `[8, 20, 20, 16]` / 分块 CE / CPU 优化器卸载时的 `384K YaRN` 32 卡 OOM（随后已通过 `[8, 20, 20, 16]` + `LM_HEAD_LOSS_CHUNK_SIZE=16384` + `optimizer_cpu_offload=true` + `vit_gradient_checkpointing=true` 彻底解决，`start-full-32g-s3-v1` Step 1 实测 `peak_alloc=61.97 GiB`）。

---

## 一、五环节统一参数总表（强约束）

| 环节 | 模型与专用通道 | 思考档位 (`reasoning_effort`) | 输出 `max_tokens` / 上下文与压缩预算 | 轮数与收敛护栏 | 必守防坑红线 |
| --- | --- | --- | --- | --- | --- |
| **1. 教师造数 / 统一沙盒对比**（Blender / Three.js / CAD / 2D） | **`80–85% kimi-k3.1-pro`**（`.env`）+ **`15–20% claude-opus-5-5`**（`claude-phanthy.sh`，`200K` 只取执行段入 `393,216` 拼包，剔除 `~148K` 早压段）；*（旧 `.env.deepseek` 额度已耗尽）* | **`claude --bare` 不硬传 `--effort`**（走模型原生默认分布） | **统一 `256K` 沙盒水位**：`AGENT_CONTEXT_WINDOW_TOKENS=262144`、`CLAUDE_CODE_AUTO_COMPACT_WINDOW=208000`、`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80`、`CLAUDE_CODE_MAX_OUTPUT_TOKENS=32768`、`MAX_TOOL_RESULT_TOKENS=16384`（`208K+16.4K+4K+32.8K = 261.2K < 262,144`）；**压缩提示词严禁写死 `/384K` 或 `/256K` 绝对分母** | 废除 `≤12–30` 轮紧箍咒，统一设安全护栏 **`--max-turns 120`**（允许 `--continue` 续段）与 `--timeout 3600` | ① 四合一预装工具链（**`Blender 4.2.10 LTS` + `Three.js r180` + `CadQuery 2.6.1` + `Playwright/Chromium`**）严格离线（`allow_network=false`，清除 `*_proxy`）；2D 沙盒仅挂隔离 `web2d_node_modules`（`playwright-core` + 本地 `vendor/gsap/gsap.min.js`，严禁 `three`）；<br>② 沙盒工作区 **0 宿主机路径泄漏**（禁 `/mnt/disk1`、`${USER_HOME}`、`/tmp/xhsv2-ws`）；<br>③ 0 思考链改写、0 外部 CDN |
| **2. CoT 处理与空 `<think>` 拆分**（⚠️ **XHS 严禁改写 CoT 与 `HCPF-Lite` 切分**） | XHS 401 主线与自产轨 **严禁改写活跃区 `<think>` 与 `HCPF-Lite` 切分**；仅在旧 Round 2 复现实验时使用 `scripts/student_project_cot.py` | XHS/Option 2 走原生 `qwen3_8` 默认 `xhigh`（Round 2 历史对照：DeepSeek `low` / 27B `medium`） | **Option 2 §0 #1 拆分规则**：`loss=True` 且思考为空的 assistant 拆成空思考 `{"loss": False, "loss_scale": 0.0}` + 正文 `{"loss": True, "loss_scale": w_ch}`；仅对 `compact_task` 的 `loss=False` 历史轮做空 `<think>` 瘦身（`384K P90 406K -> 244K`，`256K <= 125K`） | — | ① **XHS 401 与新自产轨严禁改写 CoT 或做 `HCPF-Lite` 切分**（避免离策略 NLL 爆炸与因果泄漏）；<br>② 远端/空思考剥离必须保留 `<think>\n\n</think>` 空块以对齐 `qwen3_8` 模板且 `loss_scale=0.0` |
| **3. 视觉验收 / `Eval v3` & XHS Rubric 盲评** | **跨家族异族裁判**（主用 **`kimi-k3.1-pro`** 评非 Kimi 样本；**严禁同家族自评——绝不能用 `kimi` 评 `kimi`**；Kimi 产出用跨家族裁判 / Opus / 双非教师盲评；旧 `.env.deepseek` 已停用） | 客观低发散配置（`low` / 严格 JSON） | **单图/单评 ≥ `12000`**；**多图/A·B 盲评对战 ≥ `12000`（若空正文自动升至 `16384` 重试）** | 单次严格 JSON 输出 + 原子断点续跑；确定性硬检前置短路（失败样本 `0` Judge Token） | ① **严禁设 `2048` 或 `4096`**（推理型模型 `reasoning_tokens` 消耗 `max_tokens`，超预算会返回空 `content`）；<br>② **严禁将解析失败/空响应兜底归为 `WARN`**，必须显式标 `ERROR` / `judge_error` 并重试；<br>③ 100% `blind_id` 匿名 + 50/50 翻转位置 + `check_2d_v3.mjs` / 纯 WebGL 帧差防假动 |
| **4. 27B 学生本地评测** | `Qwen3.8-27B`（**全链路锁定 `Static YaRN 1.5×` `config.json`**：`max_position_embeddings=393216, rope_scaling={"rope_type":"yarn","factor":1.5,"original_max_position_embeddings":262144,"mrope_interleaved":true,"mrope_section":[11,11,10],"partial_rotary_factor":0.25,"rope_theta":10000000}`，**严禁剥离 `rope_scaling` 或改 Dynamic YaRN**） | **XHS/Option 2 主线不传 effort（走原生默认 `xhigh`）**；*（仅旧 Round 2 `ready.jsonl` 对照测 `medium`）* | **训推同构 `Static YaRN 1.5×` + `256K` 沙盒**：`vLLM`（`TP >= 2`）保留完全一致的 `Static YaRN 1.5×` `config.json` 并设 **`--max-model-len 327680`**（或 `393216` 突发缓冲垫）、`MAX_PIXELS=401408`；沙盒 `AGENT_CONTEXT_WINDOW_TOKENS=262144`，配 `CLAUDE_CODE_MAX_OUTPUT_TOKENS=32768` + `CLAUDE_CODE_AUTO_COMPACT_WINDOW=208000` + `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80` + `MAX_TOOL_RESULT_TOKENS=16384` | 与教师采用同口径 `--max-turns` / `--timeout-s` | ① **严禁正式评测或长驻服务携带 `--enforce-eager`**，必须配合 `--enable-prefix-caching --mamba-cache-mode align` 且**零代理中段改写**（保护 Prefix Cache）；<br>② **扫卡 → 多卡并起分片跑 → 推理结束立刻停删容器 → `nvidia-smi` 核验归零**；<br>③ 绝不把配置性截断误判为模型失败 |
| **5. ModelForge / 沙盒服务提交** | 导出合并 BF16 HF 权重目录（`0644` 权限，目录 `0755`；`merge_lora_to_hf.py` 等导出脚本**必须完整保留 `Static YaRN 1.5×` `config.json`**） | 模板必须采用统一双修加固版 `chat_template.qwen38-compat.jinja`（本地附件未发布）（对齐 Aodi `base-27b-submit-003`：除 `medium`/`low` 外任意 effort 全映 `xhigh` + 中途 `system` 内联渲染不抛错） | 按平台 `submit.yaml` 规格配置（如 `--max_model_len 1000000` + `VLLM_ALLOW_LONG_MAX_MODEL_LEN=1`，`preserve_thinking=true`，TP4） | 平台要求请求失败率 **`< 1%`**（目标 `0%`） | ① **强制双写 `chat_template.jinja` 与 `tokenizer_config.json`**，并核对 `config.json` 含完整 `Static YaRN 1.5×` 字段；<br>② 提交前在官方 `vllm-openai:v0.25.1` 镜像实测 `plain / reasoning_effort=high / mid_conversation_system / tool_call` 全矩阵 HTTP 200；<br>③ 默认仅署名 `researcher`，绝不落盘密码或 token |

---

## 二、`Qwen3.8-27B` 思考档位与 SFT 压缩 CoT 的底层耦合原理

经直接核验原版 `${MODEL_ROOT}/Qwen3.8-27B/chat_template.jinja`（副本见 `chat_template.original.jinja`（本地附件未发布））与 `ready.jsonl` 实际入训样本，明确以下 4 条技术事实：

1. **没有独立权重或隐藏路由 token**：`Qwen3.8-27B` 的思考档位本质上只是模板在 `<|im_start|>system` 最前面拼接的一句纯英文指令：
   - **`medium`**：**不插入任何前缀（空字符串）**；
   - **`xhigh`（默认）**：插入 `Reasoning effort is set to xhigh. Please think carefully through the task, validate key assumptions, consider plausible alternatives, and prioritize correctness, consistency, and clarity in the final answer.`；
   - **`low`**：插入 `Reasoning effort is set to low. Keep your thinking brief and focused, moving directly to the conclusion without unnecessary elaboration.`；
   - **`high`（原生不支持）**：原生模板直接抛 `TemplateError` 返回 HTTP 400，**必须用兼容模板映射为 `xhigh`**。
2. **SFT 训练数据里的 `<think>` 与 `loss_scale` 权重机制**：
   - **Option 2 定案口径（当前唯一现行标准）**：全轨统一 PyArrow Schema `{"id", "channel", "images", "messages": [{"role", "content", "loss", "loss_scale"}]}`（无顶层 `tools` 键）；**训练时采用 `--is_binary_loss_scale false`**（有界样本梯度权重 $w_i \in [0.55, 2.55]$，$\mathbb{E}_U[w_i]=1.00$；保留 `--is_binary_loss_scale true` 作 Raw `U%` 回退档）；**`loss=True` 且思考为空的 assistant 强制拆为两段**：空思考 `{"loss": False, "loss_scale": 0.0}` + 正文/工具调用 `{"loss": True, "loss_scale": w_ch}`（防止自定义 `loss_scale` 绕过 `IgnoreEmptyThinkLossScale`）；**`validation.jsonl` 强制设 `loss_scale = 1.0`**；默认 `qwen3_8` 模板不传 `reasoning_effort` 时即为 **`xhigh`**。
   - *（Round 2 历史行为留档）*：早期 Round 2 `ready.jsonl` 曾由 `ms-swift 4.5.2` 在未写 `loss_scale` 字段且 `system` 无前缀（对应 `medium`）时，按 `think=0.5 / content=1.0 / tool_call=2.0 / empty_think=False` 赋权。
3. **思考档位对推理行为的实际影响（历史 Round 2 vs Option 2 `xhigh`）**：
   - **`xhigh`（Option 2 / XHS 401 主线默认）**：`qwen3_8` 模板默认启用 `xhigh`，与 XHS 401 分片及自产多轮轨迹 100% 逐 token 对齐；
   - **`medium`（仅 Round 2 历史对照）**：仅用于旧 Round 2 `ready.jsonl` 对照评测，Option 2 主线切勿人为降成 `medium`；
   - **`low`（兼容）**：与精炼短思考及确定性 JSON 裁判兼容。

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
