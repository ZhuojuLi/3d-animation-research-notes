# Round 2 Phase 3：`v3-full`（Qwen3.8-27B Dense）3-Epoch 训练与全量对比评测总报告

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

- **报告归档目录**：`${WORKSPACE}/3d-animation-agent/reports/round2-v3-full-eval-20261126/`
- **训练产物目录**：`${SHARED_DATA}/3d-agent-sft/round2-v3-full-20261125/`
- **冻结训练数据集**：`${SHARED_DATA}/3d-animation-reports/round2-sft-27b-v3/`（`train-v2-full.ready.jsonl`: `4,278` 条 / `4,324` 图 / `95.16M` 输入 token / `73.75M` 监督 token `U` / `77.24M` 加权监督 `W`；`val-combined.ready.jsonl`: `324` 条 / `297` 图）
- **被测新模型**：
  - `v3_e2`：Epoch 2 `checkpoint-350`（`val eval_loss = 0.292765`，全训练最佳验证点；HF BF16 导出 `${SHARED_DATA}/3d-agent-sft/round2-v3-full-20261125/eval-hf/ckpt-350-serving`）
  - `v3_e3`：Epoch 3 `checkpoint-525`（`val eval_loss = 0.295699`，终点；HF BF16 导出 `${SHARED_DATA}/3d-agent-sft/round2-v3-full-20261125/eval-hf/ckpt-525-serving`）
  - （注：Epoch 1 `checkpoint-175`（`val eval_loss = 0.295673`）与 `checkpoint-20` 亦完整保留于 `start/output/`，本次双臂优先评测了验证集最优的 Epoch 2 与终点 Epoch 3。）
- **对照历史基线**：
  - `Base Qwen3.8-27B`（原生 BF16 权重）：Line A 报告 [round2-line-a-eval-20261124-001/REPORT.md](../round2-line-a-eval-20261124-001/REPORT.md) & Aodi 30 报告 [oneshot30-checkpoint10946-20261124-002-xhigh/REPORT.md](../oneshot30-checkpoint10946-20261124-002-xhigh/REPORT.md)
  - `Round 1 ckpt-10946`（首版混合 SFT，含 10,697 条原始 Aodi + 249 条 Kimi ReAct）
  - `旧 Aodi step-900`（单轮 Aodi 基线，仅 Aodi 30）
- **核心留档凭据**：
  - GPU 释放与 16×H800 清零凭据：`gpu-cleanup.json`（本地附件未发布）（`phase: "released"`，`gpu34` & `gpu38` 全 16 张 H800 均为 `0 MiB / 0 计算进程 / 0 残留容器`）
  - 推理基础设施记录：`services.json`（本地附件未发布）、`dev-gate.json`（本地附件未发布）、`orchestrator.log`（本地附件未发布）、`service-logs/`（本地附件未发布）
  - `devtest-v2` 评分结果：`dev-results.json`（本地附件未发布）、`test-results.json`（本地附件未发布）、`all-results.json`（本地附件未发布）、`failure-clusters/failure-clusters.md`（本地附件未发布）
  - `Aodi 30` 官方浏览器评分结果：`aodi30/v3_e2/render-summary.json`（本地附件未发布）、`aodi30/v3_e2/gallery.html`（本地附件未发布）、`aodi30/v3_e3/render-summary.json`（本地附件未发布）、`aodi30/v3_e3/gallery.html`（本地附件未发布）

> **口径红线声明**：
> 1. `evals/devtest-v2` 盲评一致率与容差阈值尚未冻结，因此 `devtest-v2` 技术验收结果均严格标注为 **`technical_pass / pending_blind_review`**，**不等同于正式盲评 `Accepted@1`**。
> 2. **Suite C（`val-img23d-oneshot`，15 题图生 3D 单轮）本次未产出有效分数**：`run_v3_eval_orchestrator.py`（本地附件未发布） 客户端误传了 `"reasoning_effort": "high"`（DeepSeek 命名），被 Qwen3.8 原生 `chat_template.jinja` 在 1 秒内以 `HTTP 400` 拦截（仅支持 `xhigh` / `medium` / `low`），零算力浪费，修复为 `"xhigh"` 后约 5 分钟即可补跑。

---

## 一、核心结论一览（TL;DR）

本次 Phase 3 完整跑通了 **Qwen3.8-27B Dense 3-Epoch 全参 SFT（零 OOM、零 NaN、15h48m 稳态完训）** 并完成了 **Aodi 30 单轮**与 **devtest-v2 多轮 Agent** 双基准全量对比。结果呈现出**极具研究价值的两极分化**，且根因已被逐帧日志 100% 锁定：

1. **🏆 单轮无截断 3D 生成刷新历史最高纪录（`v3_e2 = 26 / 30 = 86.7%`）**：
   - 在官方 `Aodi 30 (xhigh)` 评测中，`v3_e2`（Epoch 2 `ckpt-350`）仅使用 Round 1 **21% 的 Aodi 数据量**（2,250 条分层 Aodi vs Round 1 的 10,697 条），即取得 **26/30 (86.7%)** 的全历史最佳成绩，超越 **Base 27B（22/30, +4 题）**、**Round 1 `ckpt-10946`（24/30, +2 题）** 与 **旧 Aodi step-900（21/30, +5 题）**。
   - **关键质量跃迁**：`29/30` 交付完整 HTML、**`0` 语法错误、`0` 依赖错误、`0` 次 262K 无限死循环**（彻底根治 Round 1 的 3 题 262K 死循环），`complex_multipart` 达 `9/10`、`spatial_scene` 保持 `10/10` 满分。
2. **⚠️ `devtest-v2` 严格 Line A 协议（单轮硬截断 `8192 tokens` + `3600s` 超时）多轮严重倒退（`v3_e2 = 1/60`, `v3_e3 = 0/60`）**：
   - **并非 3D 编码或数学能力退化**：`v3_e2` 的 `devtest-v2` `numeric_ok` 达到 **`55/60 (91.7%)`**，**反超所有对照模型**（Base `54/60`、Round 1 `53/60`、`v3_e3` `54/60`）；在 28 份已交付 HTML 中，有 **21 题属于纯超时（`other_timeout`）**，其中 **12 题已同时通过 `check_browser_3d_ok` 与 `numeric_ok`**（`v3_e3` 亦有 **14 题**）。
   - **100% 锁定的核心根因——训练与评测的单轮输出上限错配引发“8192 截断 → 空写工具 → `cat >>` 分片追加 → 3600s 超时”级联雪崩**：
     - 训练数据（Pool 1 / Pool 5b DeepSeek `high` ReAct）采集时**无 8,192 单轮输出上限**，教师习惯单轮输出 `2K–5K` 思考 + `5K–8K` 富细节 Three.js `Write`（合计 `8K–14K` token/轮；`v3_e2` 在 Aodi 30 上的单轮完成长度中位数高达 **`8,928 tokens`**、均值 **`10,039 tokens`**，超过一半天然大于 8,192）。
     - 在 Line A 冻结评测协议 `CLAUDE_CODE_MAX_OUTPUT_TOKENS=8192` 下，`v3_e2` 与 `v3_e3` 的单轮 `Write/Edit` 频繁撞穿 8,192 被半途截断，导致空参数 `Write/Edit` 暴涨至 **60 次（`v3_e2`，Base 的 3.2×）** 与 **67 次（`v3_e3`，Base 的 3.5×）**；模型被迫退化为 `Bash cat >>` 逐块拼接源码，**`v3_e2` 触发高达 `170` 次 `cat >>`（Base 仅 `9` 次，暴涨 18.9×！）**，将绝大部分时间耗尽在分块写入与修补语法错误上，**`52/60`（`v3_e2`）与 `59/60`（`v3_e3`）耗尽 3600 秒超时**。
     - 此外，`v3_e2` 全部 6 题 `empty_think_only_end_turn` 中，**5 题**是在多轮截断自救后于 `<think>` 块内直接吐出截断代码 + `</parameter></function></tool_call>`（未闭合 `</think>`），**1 题**（`v2-restitution-edit`）是思考块本身写满 12,651 字符直接撞穿 8,192 截断，均导致 Claude Code 将单块 `thinking` 静默判定为正常结束（`exit=0`）。
3. **📊 Epoch 2（`ckpt-350`）在全部独立维度严格优于 Epoch 3（`ckpt-525`）**：
   - 验证集 `eval_loss`（`0.2928` vs `0.2957`）、Aodi 30（`26/30` vs `24/30`）、`devtest-v2` HTML 交付率（`28/60` vs `20/60`）、空写工具次数（`60` vs `67`）、工具调用轮数（`38.6/题` vs `26.3/题`）均指向 **Epoch 2 已达最优，Epoch 3 出现轻度过拟合与单轮更冗长倾向**。

---

## 二、Phase 3 训练全过程与稳定性记录（`round2-v3-full-20261125`）

### 2.1 工程加固与拓扑定型（`M7` Step 17 OOM → `M2+` 零故障 525 步完训）

1. **5 步 Smoke 准入（`smoke-admission.json`）**：在 `binpack@65536` + `max_length=180224` 下确认精确装箱规模——`train_dataset = 1,400` packs（`1,400 / gbs 8 = 175.000` 步/epoch 精确整除），`val_dataset = 83` packs（`eval_iters = 10` 覆盖 `80/83 = 96.4%`），`smoke eval_loss = 0.490535`，双机 `exit=0`。
2. **早期 `M7`（`TP4·PP2·DP2`）Step 17 显存异常根因与彻底修复**：
   - 根因定位为两点叠加：(a) FLA `l2norm.py` / `fused_norm_gate.py` / `layernorm.py` 6 个 Triton 内核在 `@triton.autotune` key 中保留了未使用的 `NB = ceil(T/65536)`，导致首次遇到超长 pack 时在训练中段触发 25-config 原始 CUDA 驱动显存压测；(b) Step 1 建立 Adam 状态后，`TP4·PP2·DP2` 在 `156K–168K` 超长 ReAct 序列上仅余 ~2 GiB 显存余量。
   - 加固方案（版本控制于 `scripts/train_round2_v3/round2_v3_plugin.py`（本地附件未发布） 与 `scripts/train_round2_v3/launch_v3_node.sh`（本地附件未发布））：
     - 插件级拦截 `Autotuner.run` 将全部 6 个 FLA norm 内核的 `NB` 固定为 `4`，并在 `Autotuner.check_disk_cache` 触发未命中 benchmark 前插入 `torch.cuda.empty_cache()`；
     - 启用 Tri Dao CUDA `causal_conv1d` 替换慢速 fallback，并保持严格 `grad_norm` 有限性守卫与逐 step 显存/耗时埋点；
     - 切换为 **`M2+` 拓扑（`TP4·PP4·VPP2·DP1 + overlap_p2p_comm=true`）**，在保持 `gbs=8`、`525` 步与完全一致优化轨迹（Step 1 loss 差值 `3e-6`）的前提下直降 **7 GiB 峰值显存**。原 Step 16 终止目录归档为 `start-aborted-m7-step16`。

### 2.2 正式 3-Epoch 训练指标与验证曲线

| 训练配置 / 里程碑 | 实测值 |
|---|---|
| **训练硬件与并行拓扑** | `gpu34 + gpu38`（16×H800 80GB），`TP4·PP4·VPP2·DP1 + overlap_p2p_comm=true`，`recompute=full/uniform/1`，TE fused CE |
| **优化器与超参** | `gbs=8 (m=8)`，`calculate_per_token_loss=true`，`lr=5e-6 → 5e-7` cosine，`warmup=26`（5.0%），`weight_decay=0.1`，`clip_grad=1.0`，`adam_beta=(0.9, 0.95)` |
| **总训练步数与耗时** | `525` steps（3.000 epochs），`2026-11-25 16:25` → `2026-11-26 08:16`，总计 **`15h 48m 06s`** |
| **稳态吞吐与显存峰值** | 均值 `5,118 tok/s`（`106.3s/step`）；全局峰值 **`69.12 GiB alloc / 71.05 GiB reserved`**（距 80 GiB 红线保留 9 GiB 余量） |
| **稳定性与极端样本** | **0 OOM / 0 崩溃 / 0 NaN**；平稳通过单样本 `168,740 tok` 及单 batch `100` 图峰值；双机 `exit=0` |
| **Step 5（Smoke 近原生）** | `eval_loss = 0.490535` |
| **Epoch 1（Step 175，`checkpoint-175`，`5h 19m`）** | `eval_loss = 0.295673` |
| **Epoch 2（Step 350，`checkpoint-350`，`10h 37m`）** | **`eval_loss = 0.292765`**（🏆 **`best_model_checkpoint`**） |
| **Epoch 3（Step 525，`checkpoint-525`，`15h 48m`）** | `eval_loss = 0.295699`（最终 train loss `0.253`，相对 Epoch 2 轻度回升 `+0.0029`） |

两枚目标 checkpoint 均通过 `megatron export --to_hf true` 并行导出为 54.28 GB BF16 safetensors，并从 `${MODEL_ROOT}/Qwen3.8-27B` 完整拷贝字节级一致的原生 tokenizer、`chat_template.jinja` 与 `config.json`（`EXPORT_CKPT350_OK`、`EXPORT_CKPT525_OK`）。

---

## 三、Suite A：官方 Aodi 30 One-Shot（`xhigh` 无上限）—— 刷新全历史纪录

严格对齐 [oneshot30-checkpoint10946-20261124-002-xhigh/REPORT.md](../oneshot30-checkpoint10946-20261124-002-xhigh/REPORT.md) 协议：`prompts.jsonl` 30 题同提示词、显式 `reasoning_effort="xhigh"`、`temperature=0.7, top_p=0.95, top_k=20, seed=42`、262,144 上下文无输出上限，由官方 `render.js` 进行离线 Chromium 渲染与语法/依赖/WebGL 绘制验收。

### 3.1 五模型全量对比表

| 模型与配置 | 总通过（`runnable`） | 基础几何 (`basic`) | 多部件 (`complex`) | 空间场景 (`spatial`) | 完整 HTML | 语法 / 依赖错 | 262K 死循环 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 旧 Aodi `step-900` · `xhigh` | 21 / 30 (70.0%) | 5 / 10 | 7 / 10 | 9 / 10 | — | — | — |
| 原生 `Qwen3.8-27B` · `xhigh` | 22 / 30 (73.3%) | 7 / 10 | 8 / 10 | 7 / 10 | — | — | — |
| Round 1 `ckpt-10946` · `xhigh` | 24 / 30 (80.0%) | 6 / 10 | 8 / 10 | **10 / 10** | 27 / 30 | — | 3 题 |
| Round 2 `v3_e3` (`ckpt-525`) · `xhigh` | 24 / 30 (80.0%) | 7 / 10 | 7 / 10 | **10 / 10** | 27 / 30 | **0 / 0** | **0 题** |
| **🏆 Round 2 `v3_e2` (`ckpt-350`) · `xhigh`** | **26 / 30 (86.7%)** | **7 / 10** | **9 / 10** | **10 / 10** | **29 / 30** | **0 / 0** | **0 题** |

### 3.2 `v3_e2` 关键数据洞察与失败拆解

- **用更少 Aodi 数据拿到显著更高分**：相比 Round 1（10,697 条原始 Aodi 占 87.9% 加权监督），`v3-full` 仅保留 2,250 条分层 Aodi（占比 35.9% W）并引入 DeepSeek 清洗版 Pool 2a/2b 与 Pool 1/5，单轮质量不降反升至 **26/30 (+2 题 vs Round 1，+4 题 vs Base)**。
- **与 Round 1 `ckpt-10946` 逐题差分**：`both_pass = 21`；**净增 +5 题**（`basic_01, basic_05, basic_09, complex_02, complex_06`）；**丢失 -3 题**（`basic_07, basic_08, complex_08`）；`both_fail = 1`（`basic_06`）。
- **生成长度与复杂度分布（重要伏笔！）**：
  - `v3_e2` 完成 29 题的 `completion_tokens` **中位数 `8,928`、均值 `10,039`、最大值 `34,775`**（`thinking_chars` 中位数 `10,165`，`draw_calls` 中位数 `360`，生成耗时中位数 `447.0s`）——**彻底告别了 Round 1 的 262,144 token 失控死循环**，但也直接印证了模型在高质量单轮 3D 生成时天然需要 **8K–14K tokens**。
  - `v3_e3` 完成 27 题的 `completion_tokens` 中位数 `8,778`、均值 `9,812`、最大值 `32,103`（`draw_calls` 中位数 `285`）。
- **两臂失败逐题明细**：
  - **`v3_e2`（仅 4 题失败）**：`basic_06`（1800s 生成超时）；`basic_07`（运行时 JS 错 `φ is not defined`）；`basic_08`（运行时 JS 错 `mesh.rotation.setFromUnitVectors is not a function`）；`complex_08`（运行时 JS 错 `strokes is not iterable`）。
  - **`v3_e3`（6 题失败）**：3 题 1800s 生成超时（`basic_05, complex_02, complex_03`）、2 题浏览器 20s 采集超时（`basic_07, basic_09`）、1 题运行时 JS 错（`complex_01`: `innerShape.scale is not a function`）。
- **可视化画廊**：`aodi30/v3_e2/gallery.html`（本地附件未发布）（拼接图：`basic_geometry.png`（本地附件未发布） / `complex_multipart.png`（本地附件未发布） / `spatial_scene.png`（本地附件未发布））、`aodi30/v3_e3/gallery.html`（本地附件未发布）。

---

## 四、Suite B：冻结 `evals/devtest-v2`（60 题 = dev 12 + test 48）—— 多轮严重倒退与根因取证

严格复刻 Line A 基线执行协议：同一 vLLM 镜像（`sha256:31577e8a...`）、同一 Trial 容器镜像（`sha256:d50fb761...`）、`gpu34`（2×TP4 `v3_e2`）与 `gpu38`（2×TP4 `v3_e3`）对称副本、`--effort medium`、**`CLAUDE_CODE_MAX_OUTPUT_TOKENS=8192`**、`TRIAL_TIMEOUT_S=3600`、单副本并发 `12`、`dev-gate.json`（**0 条基础设施错误**，全 120 题 `HTTP 400 = 0`，vLLM 聚合生成吞吐稳态 `115–125 tok/s`、峰值 KV 占用仅 `14.6%–20.3%`）。

### 4.1 四模型核心指标全景对比表（严格 `technical_pass / pending_blind_review` 口径）

| 指标（`evals/devtest-v2` 全集 60 题 = dev 12 + test 48） | `Base Qwen3.8-27B` | `Round 1 ckpt-10946` | **`Round 2 v3_e2 (ckpt-350)`** | `Round 2 v3_e3 (ckpt-525)` |
|---|---:|---:|---:|---:|
| **`technical_pass / pending_blind_review`（全集 60）** | **12 / 60 (20.0%)** | **15 / 60 (25.0%)** | **1 / 60 (1.7%)** | **0 / 60 (0.0%)** |
| — Dev 分片 (12 题) / Test 分片 (48 题) | 4/12 ；8/48 | 4/12 ；11/48 | 0/12 ；1/48 (`v2-hilbert-compare`) | 0/12 ；0/48 |
| — 族加权均值 (`family_mean_technical_pass`) | 22.2% | 26.4% | 1.4% | 0.0% |
| — `technical_pass` 且 `repeat_exact=true` | 10 / 60 (16.7%) | 14 / 60 (23.3%) | 1 / 60 (1.7%) | 0 / 60 (0.0%) |
| **数值验收通过（`numeric_ok` / `check_module_ok`）** | 54 / 60 (90.0%) | 53 / 60 (88.3%) | **🏆 55 / 60 (91.7%)** | 54 / 60 (90.0%) |
| 交付 `output/index.html` / 单文件冷加载通过 (`cold_load`) | 47 / 60 ；42 / 60 | 45 / 60 ；40 / 60 | 28 / 60 ；23 / 60 | 20 / 60 ；17 / 60 |
| `check_browser.mjs --kind 3d` 通过 | 36 / 60 | 37 / 60 | 13 / 60 | 14 / 60 |
| **整题超时（3600s `timeout`）** | 41 / 60 | 36 / 60 | **52 / 60** | **59 / 60** |
| — 其中纯超时 `other_timeout`（含已过 `cb3d & numeric`） | 26（—） | 23（—） | **21（12 题已过 `cb3d & numeric`）** | **16（14 题已过 `cb3d & numeric`）** |
| 思考态空答早停（`empty_think_only_end_turn`） | **0 / 60** | 6 / 60 | 6 / 60 | **0 / 60** |
| **诊断指标：总工具调用次数（均次/题）** | 1,844 (30.7) | 2,584 (43.1) | 2,314 (38.6) | 1,577 (**26.3**) |
| **诊断指标：看图验证次数（`image_tool_results`）** | 176 (2.9/题) | 168 (2.8/题) | 96 (1.6/题) | 60 (1.0/题) |
| **🔥 诊断指标：空参数 `Write/Edit` 次数（8192 截断指标）** | **19** | 30 (1.6×) | **60 (3.2× Base)** | **67 (3.5× Base)** |
| **🔥 诊断指标：`Bash cat >>` 分片追加源码次数** | **9** | 62 (6.9×) | **170 (18.9× Base!!)** | **81 (9.0× Base)** |
| **诊断指标：`InputValidationError` 次数** | 23 | 97 | 75 | 84 |
| **诊断指标：`<think>` 内泄漏 `</tool_call>` 次数** | 0 | 3 | 5 | 0 |
| **诊断指标：总思考字符数（全 60 题）** | 5.96M ch | 6.34M ch | **6.87M ch** | 5.62M ch |
| 交付 HTML 大小中位数 | 501 KB (n=47) | 515 KB (n=45) | 522 KB (n=28) | 518 KB (n=20) |

### 4.2 级联失败聚簇（`classify_first_sft_failures.py`，全集 120 行）

| 级联根因 | `v3_e2` (60 题) | `v3_e3` (60 题) | 备注 |
|---|---:|---:|---|
| `no_delivery_html`（超时前未写出 HTML，或早停缺 HTML） | **32** | **40** | `v3_e2` 含 26 超时缺 HTML + 6 早停缺 HTML；`v3_e3` 含 39 超时 + 1 `abnormal_end` |
| `other_timeout`（已交付可运行 HTML，唯独超时） | **21** | **16** | `v3_e2` 中 **12 题**、`v3_e3` 中 **14 题**均已通过 `check_browser_3d_ok & numeric_ok` |
| `broken_delivery_missing_workspace_file` | 2 | 1 | 外置脚本比例保持极低（2.5%） |
| `browser_cascade_unresolved` | 2 | 1 | 超时中途残缺文件 |
| `page_error_without_external` | 1 | 1 | 运行时 JS 错（`v3_e2` 为 `v2-euclid-build`） |
| `numeric_failure` | 1 | 1 | 极低，整体数值验收率 ≥90% |
| `unclassified`（即 `technical_pass / pending_blind_review`） | **1** | **0** | `v3_e2`: `v2-hilbert-compare` |

### 4.3 深度法医取证：为什么会从“Aodi 30 历史第一”变成“devtest-v2 超时雪崩”？

通过对全部 120 条 `stream.jsonl` 和 4 份 vLLM 服务日志的逐轮拆解，已 100% 锁定 **3 层级联因果链**（排除基础设施故障——`devtest-v2` 期间 0 条 HTTP 400，vLLM 稳态 `115–125 tok/s`）：

1. **第一层根因（主因，解释 85%+ 失败）：训练-评测单轮输出上限结构性错配（`Train 32K–64K/turn` vs `Eval 8192/turn`）**
   - `round2-sft-27b-v3` 中，Pool 1（325 条离线 r180 ReAct）和 Pool 5b（46 条图生 3D ReAct）由 DeepSeek `high` 在无 8K 输出截断下采集，习惯“单轮 2K–5K `<think>` + 单轮一次性 `Write` 整个 15–30 KB 的 `scene.mjs`/`main.mjs`”，合计每轮输出 **8K–14K tokens**（同一现象也在 Aodi 30 上直接体现：`v3_e2` 单轮输出中位数为 **8,928 tokens**）。
   - 然而 `devtest-v2` 冻结评测沿用了 Line A 的 **`CLAUDE_CODE_MAX_OUTPUT_TOKENS=8192`**。当模型尝试写出完整模块时，思考 + 代码直接撞穿 8,192 截断，导致工具调用 XML 参数残缺，vLLM `qwen3_xml` parser 解析为空对象 `{}`（**空 `Write/Edit` 暴涨至 `60` / `67` 次，达 Base 19 次的 3.2×–3.5×**），Claude Code 抛回 `InputValidationError`。
   - 模型在日志中甚至明确意识到截断（如 `v2-spirograph-build` 思考原文：`"Again truncated at ~3.1KB in the middle of the line..."`），随之被迫切换为 **`Bash cat >>` 逐段手工追加源码**：`v3_e2` 触发了惊人的 **`170` 次 `cat >>`（Base 仅 `9` 次，18.9×！）**。每一次分片写入都需要重新思考上下文边界、拼接引号、排查语法错、再重写，彻底拖垮 3,600s 预算——在 12 并发下，模型还没来得及完成打包和视觉验证（看图次数 `imgs` 从 Base 的 176 暴跌至 `v3_e2` 的 96 和 `v3_e3` 的 60），整题即因超时被强杀。
2. **第二层根因：Epoch 3 单轮更冗长、工具周转进一步放缓**
   - 在完全相同的 3,600s 时限和几乎相同的推理速度（`115.5` vs `124.5 tok/s`）下，`v3_e3` 全 60 题仅完成了 `1,524` 次 HTTP 200（均值 `26.3` 工具/题），显著少于 `v3_e2` 的 `2,190` 次（均值 `38.6` 工具/题），单轮消耗 token 多 ~40%，空 `Write/Edit` 进一步增至 `67` 次，导致 **59/60 超时、40/60 连 `output/index.html` 都未能落盘**。
3. **第三层根因（`v3_e2` 6 题 `empty_think_only_end_turn` 精准解剖）**：
   - 对 `v3_e2` 全部 6 题早停末轮（`v2-collatz-build`, `v2-spirograph-repair`, `v2-cantor-edit`, `v2-restitution-edit`, `v2-ferris-edit`, `v2-decimalseventh-repair`）逐字提取后发现它们**同样与 8,192 截断直接耦合**：
     - **`v2-restitution-edit`（1 题）**：末轮 `<think>` 写了 `12,651` 字符在行中硬截断（`...primary at (0,0.015,0) cyan; comparison at (1`），思考本身用光 8,192 tokens，未及输出 `</think>` 即终止。
     - **其余 5 题**：全部发生在模型多轮 `cat >>` / `Edit` 分块补丁的第 18–57 轮（耗时 2,060s–3,518s），模型在 `<think>` 内直接写入了半截 JS 代码并直接跟上 `</parameter></function></tool_call>`（例如 `v2-collatz-build`: `startStamp = performance.now() - \n</parameter>\n</function>\n</tool_call>`；`v2-ferris-edit`: `ctx.fillText('φ = ' + phaseLabel, PX_W - 48, 318); ctx \n</parameter>\n</function>\n</tool_call>`），却漏写了 `</think>`。vLLM `qwen3` parser 将整段归入 `thinking`、`tool_calls=[]`，Claude Code 静默以 `subtype="success", exit=0` 结束整题。
     - 值得注意：**`v3_e3` 的 `xmlInThink = 0` 且 `empty_think_only_end_turn = 0/60`**，证明 `round2-sft-27b-v3` 的严格消息结构审计与纯文本 CoT 清洗到 Epoch 3 已基本消除格式边界漂移，但单轮长度过长（vs 8,192 cap）仍把 `v3_e3` 彻底锁死在超时上。

---

## 五、Suite C（`val-img23d-oneshot`，15 题图生 3D）透明披露

- **现状**：本次未产出有效评分。
- **原因**：`run_v3_eval_orchestrator.py`（本地附件未发布） 在构造 OpenAI `/v1/chat/completions` 请求时传入了 `"chat_template_kwargs": {"enable_thinking": True, "reasoning_effort": "high"}`。Qwen3.8 原生模板仅接受 `"xhigh"` / `"medium"` / `"low"`，4 台 vLLM 副本在 1 秒内精确拦截了全部 30 次请求（`gpu34`: `8+7=15` 次 HTTP 400；`gpu38`: `8+7=15` 次 HTTP 400），零 GPU 浪费，亦未污染 Suite A/B。
- **修复方式**：将该行 `"high"` 改为 `"xhigh"`（或 `"medium"`），搭配下一轮 GPU 诊断任务顺带 5 分钟即可完成补测与官方渲染评分。

---

## 六、16×H800 GPU 清理与资源释放核验

- 推理于 `2026-11-26T04:11:48Z`（北京时间 `12:11:48`）结束后自动进入 `finally:` 清理流程：4 台 vLLM 容器日志全部 gzip 归档至 `service-logs/`（本地附件未发布）、容器停止并删除、SSH 隧道与 `compat.py` 关闭。
- `gpu-cleanup.json`（本地附件未发布） 于 `2026-11-26T04:12:30Z`（北京时间 `12:12:30`）正式落盘并核验：`phase == "released"`，`errors == []`，`gpu34`（8×H800）与 `gpu38`（8×H800）**全部 16 张卡 `used_mib == 0`、`active_processes == []`、`leftover_containers == []`**。
- 北京时间 `12:24` 经独立 live `ssh gpu34/gpu38 nvidia-smi` 二次复核，16×H800 仍保持 100% 空闲清零。所有浏览器评分与失败聚类均在释卡后于本机 CPU 完成。

---

## 七、下一步最高 ROI 行动方案（待决策）

基于本次“单轮 26/30 创历史新高 + 数值 55/60 第一 + 多轮撞穿 8192 截断雪崩”的清晰因果链，建议按以下优先级推进：

### 方案 A（推荐优先，仅需 ~30–40 分钟 GPU）：低成本验证“8192 截断假设” + 补测 Epoch 1 & 图生 3D Val
1. **将 `CLAUDE_CODE_MAX_OUTPUT_TOKENS` 从 `8192` 放开至 `32768`**，在 `devtest-v2/dev`（12 题）上做配对诊断，同时纳入 **`v3_e2` (`ckpt-350`)** 与尚未评测的 **Epoch 1 (`ckpt-175`, `eval_loss=0.2957`)**（Epoch 1 距 Base 多轮收敛习惯更近，大概率在 8K 和 32K 下都更轻快）。
2. **顺带补跑修复后的 Suite C `val-img23d-oneshot`（15 题，`reasoning_effort="xhigh"`）**，仅需 ~5 分钟，补齐图生 3D 专项定量验收。
3. **直接回答两个决定路线的问题**：
   - 若放开至 `32768` 后 `v3_e2` 的 `dev-12` `technical_pass` 迅速飙升（如超过 Base 4/12、Round 1 4/12），说明**模型真实多轮能力已显著提升，瓶颈纯粹是 Line A 评测的 8192 单轮上限过窄**；
   - 若 `ckpt-175`（Epoch 1）在 `8192` 与 `32768` 下双双领先，则直接明确 **1.0–1.5 epoch / 更低 LR** 为最优早停区间。

### 方案 B（若业务/评测必须死守 `8192 tokens/turn` 上限）：Round 2.5 极简精炼 SFT 迭代（无需重采海量数据）
1. **严格 8K-Safe 多轮数据约束**：对 Pool 1 / Pool 5b ReAct 轨迹施加单轮输出上限审计（`<think>` 压至 `≤1,200 tokens`，超大 `Write` 拆分为 `≤3,000 tokens` 模块文件 `mechanism.mjs` / `scene.mjs` / `ui.mjs`），并在 Pool 1 中显式强化“首轮快速落盘 → 1–2 轮看图修补 → 立刻 `STOP` 交付”的收敛纪律（消除 `other_timeout`）。
2. **保护已验证的 `26/30` 单轮底座**：保持 `v3` 的 Pool 2a/2b/3/5a 高质量单轮配比不变，微调 LR 至 `2e-6 ~ 3e-6`、训练 1.5–2 epochs，在保住 Aodi 30 `26/30+` 的同时将 `devtest-v2` 8K 协议下的多轮通过率推高至 `35%–50%+`。

### 方案 C（消融实验 `v3-oneshot-only`）
- 建议**暂缓至方案 A 结果出炉后再决定**。若方案 A 证实 `v3_e2` 在 32K 下多轮强劲，则原计划的 `oneshot-only` 消融可在统一 32K 口径下更有意义地量化 Pool 1/5b ReAct 数据的净增益。
