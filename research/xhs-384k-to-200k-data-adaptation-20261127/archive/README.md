# 归档说明：小红书 384K 轨迹适配早期调研（Revision 1 / Revision 2）

> 公开整理版 · 2026-11-28。保留成文时点的记录；计划、文献结果和本地实测请分别理解。环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

> **归档状态**：本目录保存的所有调研文档、评审记录与部分模拟/转换脚本均已由 **Revision 3 / Option 2** 正式取代。  
> **当前唯一定版规范（请勿使用本归档内的旧参数指导训练、造数或推理）**：
> - [../README.md](../README.md) — Revision 3 / Option 2 目录总览与速查表
> - [../CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md](../CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md) — 四模型无尘室裁决：`384K` 不切分硬训（`Static YaRN 1.5×`）+ `256K` 统一造数/评测/服务沙盒与 4 条防翻车铁律
> - [../OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md](../OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md) — Option 2 CAD/2D 数据设计、独立提效评估与多轨混训配比全案

---

## 一、为什么早期 Revision 1 与 Revision 2 被 Revision 3 / Option 2 取代？

| 演进版本 | 核心路线与上下文配置 | 为什么被下一代 / Option 2 取代？ |
| --- | --- | --- |
| **Revision 1**（`HCPF-200K`） | `max_length = 204,800`（`200K`），`rope_type = "default"`（关闭 YaRN），`CLAUDE_CODE_AUTO_COMPACT_WINDOW = 185000`（`85%`），`HCPF-200K + ct_diet` | 浪费 `Qwen3.8-27B` 原生 `262,144` 上限的 `21.9%–24.5%` 容量；将 `72.2%`（`523/724`）XHS 执行段碎裂为 3 截（共 `1,152` 刀、`2.591×` 膨胀）；引入 `[archived]` / `[updated in later turns]` 实体级 OOD 占位符破坏 Prefix Cache（见 [opus-review.md](opus-review.md) L17–20, L171）。 |
| **Revision 2**（原生 `256K + HCPF-Lite@256K`） | `max_length = 262,144`（`256K`），`rope_type = "default"`（关闭 YaRN），`CLAUDE_CODE_AUTO_COMPACT_WINDOW = 220000`（`85%`），`HCPF-Lite@256K`（`BUDGET=254,000`）+ `ct_diet` | 虽消除了 `200K` 容量浪费与 OOD 占位符，但仍需把 `80.9%`（`586/724`）XHS 执行段人为一刀切半（`596` 刀、`1.82×` 膨胀），在 `200K–384K` 区间造成**因果泄漏（Off-Policy Causal Leakage）**——教师后续决策 `P(a_t | h_t)` 基于前文完整原始代码与视口图，一旦前序折叠/截断即等价于教模型“没看见也假装记得并往下编”（见 [../CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md](../CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md) L49–51）。 |
| **Revision 3 / Option 2（当前唯一基准）** | **`Train Long, Synthesize & Serve Short`**：全链路锁定同一 **`Static YaRN 1.5×`**（`max_position_embeddings=393216`）；`32×H100` 零切分硬训完整 `384K` XHS（`100%` 存活）；新造数、评测与 `vLLM`（`--max-model-len 327680`）锁定 **`256K` 沙盒（`208K / 80%` 自动压缩 + `MAX_TOOL_RESULT_TOKENS=16384`）** | `Qwen3.8-27B` 有 `48/64`（`75%`）`GatedDeltaNet` 层不用 RoPE，剩余 `16` 层全注意力又有 `75%` NoPE，全网仅 **`6.25%` 维度使用 RoPE**；`Static YaRN 1.5×` 下 `≤8K` 高频对偏移严格 `0.0%`，仅 `3.32%` 头维度插值，全参 SFT 后在 `≤256K` 残余差异 `<0.5%`（`CLEANROOM-...md` L52–55）。叠加分块 LM-Head CE（`16384`）+ FP32 `main_grad` + `[8,20,20,16]` 切层 + `2D (tok<=393216, img<=80)` 装箱守卫，`start-full-32g-s3-v1` Step 1 已物理验证 `32×H100` 稳跑 `384K`（`peak_alloc=61.97 GiB, peak_reserved=73.48 GiB`）。 |

---

## 二、归档文件完整清单（共 10 项）

> **格式保留说明**：以下所有历史文件均**逐字节原样归档**，未改写内部正文；因此部分 Markdown 原文中的 `../` 相对路径仍对应归档前的目录深度（而同在 `archive/` 内的互相引用如 `opus-review.md`、`empirical_audit_200k_ledger.json`、`a100-experiments/...` 仍保持有效）。

| # | 归档路径 | 原路径 / 名称 | 版本归属 | 内容摘要与定位 |
|---:|---|---|---|---|
| 1 | [rev1-200k-README.md](rev1-200k-README.md) | 原 `README.md`（为防与本清单重名而改名） | **Rev 1**（含顶部 Rev 2 纠偏条） | 初版 `HCPF-200K`（`204,800`, YaRN OFF, `185K/85%`, `TP4·PP2·CP2·DP2`）深度调研报告。 |
| 2 | [2026h2-compaction-literature-deep-dive.md](2026h2-compaction-literature-deep-dive.md) | `2026h2-compaction-literature-deep-dive.md` | **Rev 1**（`~200K`） | 2026 下半年长程压缩文献精读（`Kimi K3`, `CompactionRL`, `RECAP`, `The Compaction Cliff`, `CliffCompaction`, `DAG-SFT`, `MemTrace`, `ScaleCUA`, `AutoCompact`, `PAIR`, `ActObs`, `Qwen3.8-Next`, `DeNovoSWE`）；其中论文机制仍具参考价值，末尾 `200K + 185K/85%` 结论已由 Option 2 取代。 |
| 3 | `opus-task.md`（本地附件未发布） | `opus-task.md` | **Rev 1**（`≤200K`） | 委托 `claude-opus-5-5` 对比 `PM-SW@200K` 与 `HCPF-200K` 的独立审查任务书。 |
| 4 | [opus-review.md](opus-review.md) | `opus-review.md` | **Rev 1**（提出 `HCPF-Lite`） | `claude-opus-5-5` 独立架构审查原文：提出方案 C（`HCPF-Lite`）、驳回 `200K` 虚假加速叙事、定位 `gdn_v3_plugin.py:213` BF16 `main_grad` 累加非等价问题与 `VPP=2` `_instrumented_prepare_batch` 计数 bug、修正 `384K` 基线步数（`~330–360`）。 |
| 5 | `opus-result.json`（本地附件未发布） | `opus-result.json` | **Rev 1** | 上述 `opus-task` 调用 Claude Code CLI 的完整执行回执 JSON（`session_id: b38e2274-3b6b-43b5-a77d-c952905fa1b0`, `num_turns: 32`, `total_cost_usd: 6.14507425`）。 |
| 6 | `opus-stderr.log`（本地附件未发布） | `opus-stderr.log` | **Rev 1** | `opus-task` 运行时的标准错误日志（0 字节空文件）。 |
| 7 | [empirical_audit_200k_ledger.json](empirical_audit_200k_ledger.json) | `empirical_audit_200k_ledger.json` | **Raw 一手实测（L1–141）+ Rev 1/2 模拟（L142–238）** | `${MODEL_ROOT}/Qwen3.8-27B` 分词器对 `v1_dense`/`v1_full` 的一手真实统计（L1–141 **长期有效**）；L142–238 为已废止的 `HCPF-200K` / `ct_diet` / `HCPF-Lite@256K` 模拟结果。 |
| 8 | [joint-consolidation.md](joint-consolidation.md) | `joint-consolidation.md` | **Rev 2** | 主调研 × Opus 5.5 原生 `256K + HCPF-Lite@256K`（`220K/85%`, YaRN OFF）联合定案原文。 |
| 9 | [QWEN38-27B-32xH100-TRAINING-PLAN.md](QWEN38-27B-32xH100-TRAINING-PLAN.md) | `QWEN38-27B-32xH100-TRAINING-PLAN.md` | **Rev 2** | Swarm 四专家原生 `256K` 训练方案（含 `start-full-32g-s3-v1` 静默丢数据取证与 4 项硬硬件禁令）。 |
| 10 | [a100-experiments/](a100-experiments/) | `a100-experiments/` | **Exp 1 有效实测 + Exp 2 Rev 2 脚本** | 包含 `exp1_gpu1_verified_results.json`（**长期有效**的 A100 分块 CE 精度与显存实测）、`exp1_megatron_ce_and_stage_vram.py`（Exp 1 基准脚本）与 `exp2_build_and_verify_hcpf_lite_256k.py`（已废止的 Rev 2 `HCPF-Lite@256K` 构建脚本）。 |

---

## 三、本归档中在 Option 2 下**仍然有效**的一手实测资产（附精确行号边界）

下列测量数据源自 `${MODEL_ROOT}/Qwen3.8-27B` 真实分词器、线上集群故障日志及本机 `NVIDIA A100-SXM4-80GB (GPU 1)` 隔离实测，**可直接继续引用，但严禁混用同一文件中的 Rev 1/Rev 2 切分模拟块**：

1. **XHS `3DCodeFactory` 一手原始分词账本（[empirical_audit_200k_ledger.json](empirical_audit_200k_ledger.json) L1–129）**：
   - `v1_dense`（L7–29）：总计 `18,108` 段（`17,384` 训 / `724` 验）、`5,532` 独立任务；`v1_full`（L30–37）：总计 `29,795` 段（`28,602` 训 / `1,193` 验），含 `11,686` 条 `compact_task`（`468` 验）。
   - `raw_length_distribution_on_val`（L39–96）：`v1_dense_all` `P50 = 380,480 / P90 = 394,477 / Max = 414,506`（仅 `13.4% ≤ 200K`）；`v1_full_compact_task` `P50 = 394,075 / P90 = 406,106 / Max = 424,391`（可训 `<summary>` `P50 = 11,011`）。
   - `component_token_anatomy_120_exec_segments`（L98–128，60 Blender + 60 Three.js）：`mean = 343,319 / P50 = 390,747 / P90 = 408,653`；`asst_think_train` `45.6%`（`mean = 156,409`）、`asst_tc_train` `23.5%`（`mean = 80,602`）、`tool_obs_txt` `18.2%`（`mean = 62,481`，`Bash 76.6%` / `Read 22.2%`）、`vis_512` `5.3%`（`mean = 18,144`）、`sys_plus_tools` `4.6%`（`15,878`）、`user0_anchor` `1.2%`（`4,196`）、masked bad turns `0.9%`。
   - ⚠️ **已废止模拟区块（Option 2 下禁止采用）**：同一文件 **L142–174**（`hcpf_200k_verified_simulation`）、**L175–191**（`ct_diet_compact_task_rescue`）、**L192–238**（`hcpf_lite_256k_ratified_final_simulation`）。

2. **384K OOM 根因、静默丢数据取证与硬件开关禁令（[empirical_audit_200k_ledger.json](empirical_audit_200k_ledger.json) L130–141；[QWEN38-27B-32xH100-TRAINING-PLAN.md](QWEN38-27B-32xH100-TRAINING-PLAN.md) L17–19, L36–40）**：
   - OOM 根因：`gdn_v3_plugin.py:213` 未放开全参分块 CE（物化 `[196608, 62080]` logits 约 `22.7 GiB`）与 `PP0` 未切分 `ViT` 多图尾包（`66–148` 张图）。
   - `start-full-32g-s3-v1` 静默丢数据实锤：`Map` 丢弃 `762 / 18,496` 条（`7` 张 `AR ≥ 200` 异常图触发 `smart_resize` 误删 + `~420 / 1,112` `compact_task` 超 `393,216` 被删）——直接催生了 Option 2 §0 #10 的 Phase-0 零丢弃清洗与 `(tok <= 393216, img <= 80)` 2D 装箱守卫。
   - 硬件禁令：`FP8`（`4120 % 16 != 0`）、`tp_comm_overlap`、`recompute_num_layers=2`、`VPP=2`、`Muon` 优化器（Option 2 §4.3 沿用全部禁令）。

3. **A100-80GB 分块 LM-Head CE 精度与显存基准（[a100-experiments/exp1_gpu1_verified_results.json](a100-experiments/exp1_gpu1_verified_results.json) L1–51）**：
   - 根本公式：`fused_vocab_parallel_cross_entropy` 分配 `6 bytes * S_local * V_shard`（`BF16 logits + FP32 CE`），导致 `384K TP4·CP2` 不分块直接 OOM（`68.20 GiB`），而 **`chunk_size = 16384` 在 `384K TP4·CP2` 实测 PASS**（`~15.1 GiB` 瞬时增量、`5.68 GiB / 16K chunk`）。
   - `main_grad_dtype = fp32` 相对未分块 FP32 Oracle 的 `wgrad` 相对 L2 误差仅 **`1.11e-05`（4 chunks）/ `2.10e-05`（12 chunks）**，而 `bf16` 累加误差大 ~`142×`（`2.24e-03` / `3.00e-03`）——直接支撑 Option 2 锁定 **`LM_HEAD_LOSS_CHUNK_SIZE=16384` + FP32 `main_grad` + `AdamW` + `optimizer_cpu_offload=true`**。
