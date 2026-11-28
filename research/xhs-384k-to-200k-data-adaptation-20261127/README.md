# 小红书 `384K` 不切分硬训 + `256K` 沙盒造数评测与多轨混训定版目录（Revision 3 / Option 2）

> 公开整理版 · 2026-11-28。保留成文时点的记录；计划、文献结果和本地实测请分别理解。环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> **定版状态**：**Revision 3 / Option 2（唯一权威基准，2026-11-27）**  
> **核心原则**：**`Train Long, Synthesize & Serve Short`** —— 全链路（Stage 1–4 训推与 `vLLM` 部署）锁定同一套 **`Qwen3.8-27B` + `Static YaRN 1.5×`**（`max_position_embeddings = 393,216`）；`32×H100` 直接无切分硬训完整 `384K` 小红书数据（彻底废除 `HCPF-Lite` 切分以杜绝 Off-Policy Causal Leakage），同时所有新合成 CAD/2D 数据、评测基准、Stage 3 修复 RL 与线上 `vLLM` 服务统一运行在 **`256K`（`262,144`、`208K / 80%` 自动压缩）沙盒** 并复用同一份 `Static YaRN 1.5×` `config.json`。

---

## 一、目录结构索引（仅保留 Option 2 定版文档与归档入口）

| 入口 | 定位与职责 |
|---|---|
| [**CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md**](CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md) | **四模型无尘室独立裁决**：论证 Option 2（`384K` 不切分硬训 + `256K` 沙盒/服务）严格优于全 `384K`（Option 1）与切碎 `256K`（Option 3），给出 `Qwen3.8-27B` `6.25%` RoPE 维度数学证明及 4 条防翻车工程铁律。 |
| [**OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md**](OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md) | **Option 2 工程落地总蓝图**：§0 10 类硬前置代码/框架漏洞修补、CAD/2D 数据设计（`MVP 300 / Standard 600 [推荐] / Scale 1,200`）、`1×8×H100` 5 臂 Canary、`32×H100` Stage 1–4 拓扑与精确配比总表。 |
| [**archive/README.md**](archive/README.md) | **Rev 1（`200K`）与 Rev 2（原生 `256K + HCPF-Lite`）历史归档清单**：收录 10 项已废止调研文档/脚本，并标注仍有效的一手分词账本（`empirical_audit_200k_ledger.json` L1–141）与 A100 分块 CE 精度/显存实测（`exp1_gpu1_verified_results.json`）。 |
| [**OPTION2-VERSION-DIFF-AND-CHANGE-CHECKLIST.md**](../../3d-animation-agent/docs/OPTION2-VERSION-DIFF-AND-CHANGE-CHECKLIST.md) | **全工作区版本差异与逐文件改动对照清单**（`M4` 汇总交付物，对照 Revision 1 / Revision 2 / Option 2）。 |

---

## 二、Option 2 锁定参数速查表（Single Source of Truth）

| 维度 | Option 2 唯一锁定值（来自 `CLEANROOM-...md` 与 `OPTION2-...md`） |
|---|---|
| **学生基座与 RoPE（训推严格同构）** | `Qwen3.8-27B` BF16；`max_position_embeddings = 393216`；`rope_scaling = {"rope_type": "yarn", "factor": 1.5, "original_max_position_embeddings": 262144, "mrope_interleaved": true, "mrope_section": [11, 11, 10], "partial_rotary_factor": 0.25, "rope_theta": 10000000}`（**全阶段及 `vLLM` 严禁剥离 `rope_scaling` 或改用 Dynamic YaRN**） |
| **XHS `384K` 入训与装箱** | **零 `HCPF-Lite` 切分**；`MAX_LENGTH = 393216`，`PACK_LEN = 393216`（`94%` 填充 = `369.62K`/包），2D 装箱守卫 `(tok <= 393216, img <= 80)`；Phase-0 CPU 零丢弃清洗（pad `7` 张 `AR >= 200` 图、瘦身 `384K compact_task` 空 `<think>` `P90 406K -> 244K`、`"-agent-"` 过滤、`retry02` 去重、仅对 `~335` [`1.93%`] `393K–402K` 边际段裁远端 `<10K` 无关 `loss=False` 刷屏日志，`100%` 不切分存活） |
| **`32×H100` 拓扑与优化器** | `TP=4, PP=4, CP=2, DP=1, SP=true`，非对称切层 **`[8, 20, 20, 16]`**，`recompute = full/uniform/1`，`vit_gradient_checkpointing = true`，`AdamW (beta=0.9/0.95, wd=0.1, clip=1.0)` + **FP32 `main_grad`** + `optimizer_cpu_offload = true` + `LM_HEAD_LOSS_CHUNK_SIZE = 16384`。<br>**严禁**：`FP8`、`tp_comm_overlap`、`VPP=2`、`recompute_num_layers=2`、`Muon` |
| **Unified Schema 与 Loss 权重** | PyArrow 统一格式 `{"id", "channel", "images", "messages": [{"role", "content", "loss", "loss_scale"}]}`（无顶层 `tools` 键）；7 个 channel：`xhs_blender, xhs_threejs, cad_exec, anim2d_exec, compact_384k, compact_256k, swe_anchor`；空 `<think>` 拆分为 `{"loss": False, "loss_scale": 0.0}` + 正文 `{"loss": True, "loss_scale": w_ch}`；`validation.jsonl` 强制 `loss_scale = 1.0`；`--is_binary_loss_scale false`（有界 `w_i`，`true` 仅作 Raw U% 回退） |
| **`256K` 沙盒 / 造数 / `vLLM` 服务** | `AGENT_CONTEXT_WINDOW_TOKENS = 262144`、`CLAUDE_CODE_AUTO_COMPACT_WINDOW = 208000`（`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE = 80`）、`CLAUDE_CODE_MAX_OUTPUT_TOKENS = 32768`、`MAX_TOOL_RESULT_TOKENS = 16384`（`208K + 16.4K + 4K + 32.8K = 261.2K < 262,144`）；压缩提示词禁写 `/384K` 或 `/256K` 分母；`xhs_v2_produce.py` `max_export_tokens = 262144`、裁判 `max_tokens >= 12000`；`vLLM`（`TP >= 2`）复用同份 `Static YaRN 1.5×` `config.json` + `--max-model-len 327680`（或 `393216` 防突发垫）+ `--enable-prefix-caching --mamba-cache-mode align` |
| **四阶段课程与配比** | • **Stage 1**（`384K` XHS，`GBS=48`，留出 `20% = 1,063` 任务）：`64.2%` Blender + `34.8%` Three.js + `1.0%` `compact_384k`（Step 50/100 SWE 哨兵）<br>• **Stage 2**（`Standard 600+600`，`GBS=32`，`~0.25–0.30×` LR，`G0 cu_seqlens` 单测先过）：`21.9%` Blender + `12.2%` Three.js + `22.8%` CAD + `22.7%` 2D + `2.5%` Compact + `17.9%` SWE<br>• **Stage 3**（`≤64K Repair-RL`，`GSPO-token`）：`40%` XHS + `25%` CAD + `25%` 2D + `10%` SWE<br>• **Stage 4**（`256K` On-Policy `RFT`）：`256K` 沙盒采样 + `20%` 未切分 `384K` XHS 回放 + `15%` SWE $\to$ `Qwen3.8-27B-Unified-Option2-Final` |
