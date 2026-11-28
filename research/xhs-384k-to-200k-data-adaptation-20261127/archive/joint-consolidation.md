# 主调研 × Claude Opus 5.5 联合审定与最终纠偏定案：回归原生 `256K`（`262,144`）+ `HCPF-Lite@256K`

> 公开整理版 · 2026-11-28。保留成文时点的记录；计划、文献结果和本地实测请分别理解。环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

> **最终拍板日期**：2026-11-27（已同步写入项目 `decisions.md`、`XHS-UNIFIED-SFT-STANDARD.md`、`THREE-TRACK-DELIVERABLE-SPEC.md` 与 `STANDARD-PARAMS.md`）  
> **核心纠偏说明**：前期因显存保守预估一度按非标 `200K`（`204,800`）推演；经用户明确纠偏（**4 机 `32` 卡对标小红书 6 机 `48` 卡恰好对应 `256K / 384K = 2/3`，且 `Qwen3.8-27B` 原生上限本就是 `262,144` [256K]，完全没必要做 `200K` 这种奇怪折中数**）并用真实分词器复测验证，**全链路正式锁定原生满窗 `256K`（`max_length = 262,144`）+ `HCPF-Lite@256K`（方案 C）**！  
> **关联记录**：[Opus 5.5 独立审查原文（保留历史原貌）](opus-review.md) · [初版 200K 探索报告（保留备查）](README.md) · [2026 H2 压缩文献精读](2026h2-compaction-literature-deep-dive.md) · [实测分词与 256K 模拟账本 JSON](empirical_audit_200k_ledger.json)

---

## 一、为什么原生 `256K`（`262,144`）全面碾压非标 `200K` 与 `384K YaRN`？

用 `Qwen3.8-27B` 真实分词器对已落盘的 `v1-dense`（`724` 验证段 $\to$ `17,384` 训练段）与 `v1`（`468` 验证 `compact_task` $\to$ `11,686` 训练段）做精确头对头实测，**`256K` 在四个维度同时达到全局最优**：

| 核心指标（真实 `Qwen3.8-27B` 分词器实测） | 原论文 `384K YaRN`（48 卡） | 前期非标 `200K`（`204,800`） | **🏆 最终定案：原生 `256K`（`262,144`）** |
| --- | :---: | :---: | :---: |
| **基座位置编码与 RoPE 精度** | 需 `YaRN 1.5×`（压缩波长损精度） | 原生 RoPE（浪费末尾 `57K` 原生容量） | **100% 吃满基座原生 `262,144` 满血窗口，0 YaRN 损精度** |
| **硬件卡数与窗口比例对应** | 6 机 `48` 卡 $\to$ `384K` | 非标比例 | **4 机 `32` 卡 $\to$ `256K`（`32/48 = 256/384 = 2/3` 精确咬合）** |
| **原样免切段比例（0 改动直通）** | `~93%` | `13.1%` (`95/724`) | **`18.4%` (`133/724`)** |
| **每条超长段拆成几份？（无观测裁剪）** | 1 份 | 2份:`106` · **3份:`521` (72% 三截碎裂!)** | **2份:`586` (80.9% 仅对半切 1 刀!) · 3份:仅 `5` (0.7%!)** |
| **验证集人工切口总数** | `0` | `1,154` 刀 | **`596` 刀（直接少切 `-48.4%` 近一半！轻裁观测后 `543` 刀、`0` 条三截）** |
| **`compact_task` 仅置空前序 `<think>`（0 删日志、0 删图）直通率** | `~62%` | 仅 **`56.0%`** (`262/468`) | **高达 `97.4%` (`456/468` 零信息损失自然装入！)** |
| **全集总输入 Token / `GBS=48` 步数** | `~6.17B` / `~352` 步 | `7.38B` / `823` 步 | **`6.60B` / `602` 步（轻裁大输出后 `5.45B` / `453` 步，填充率 `95.5%`）** |
| **4 机 `32×80GB` 放开 ViT 显存稳态** | ❌ `78.55 GiB` 连崩三次 | `~60–65 GiB` | **修分块 CE 1 行后稳态 `~52–64 GiB`（余量 `15–27 GiB`）** |

---

## 二、终极数据改造协议：`HCPF-Lite @ 256K`（方案 C · 通俗四段积木规格）

经独立 `claude-opus-5-5` 源码级审查，**同时否决“纯重叠滑窗（方案 A，中间蒸发 30 轮导致孤立文件幻觉）”与“贴英文假便签（方案 B，自造 `[archived]` / `[updated in later turns]` 零线上命中率且破坏 Prefix Cache）”**，定案纯原生截断 **`HCPF-Lite @ 256K`**（目标 `max_length = 262,144`，单段预算上限 `BUDGET = 254,000`）：

### 2.1 执行段（`main + compact_before + compact_recovery`）处理规则（`R1–R8`）
1. **`R1` 免切直通**：含图总 Token `≤ 254,000` 的段（`18.4%`）**100% 原样输出，0 改动**。
2. **`R2` 干净相位对半切 1 刀**：对 `> 254,000` 的段，在预算区间末端回溯挑选 **`loss == True` 且紧随工具返回不含运行时异常（无 `Traceback / SyntaxError / ReferenceError / TypeError / Error:`）** 的完整原子步末端切开（实测 `596 / 596 = 100.0%` 命中干净相位点，`80.9%` 只需切 1 刀分成上下半场两筐）：
   - **上半场（子段 $w=0$）**：`[System + Tools] + [原始需求/前序 Summary + 参考图 I_ref] + [Turns 1..t_1]`，**100% 原封不动**。
   - **下半场（子段 $w \ge 1$，四段积木拼装，前 3 段全置 `loss=False` 只读不训）**：
     - **积木 1 · 置顶题目与原图（`messages[0..1]`，`≤22K`，`loss=False`）**：`system + <tools>` 与原始需求 + 参考图 `I_ref`（或原生前序 `<summary>`）逐字节钉死在段首。
     - **积木 2 · 远期“自然瘦身流水账”（$z_1 \dots z_{t_1 - 13}$，上限 `≤12,000` tok，`loss=False`）**：一轮都不删（不断号），只做 4 项 **100% 原生同构** 瘦身：
       1. `assistant` 内部 `<think>...</think>` 替换为空壳 **`<think>\n\n</think>`**（严禁删掉标签，对齐 `qwen3_8` 模板与 `ignore_empty_think`）；
       2. 远端旧视口截图 `<image>` **直接移除（同步从 `images[]` 删除，绝不塞 `[archived]` 假字符串）**；
       3. `tool_call` 保留工具名、`file_path` 与参数前 `80` tok（不做易错的 Shell 文件覆盖猜测）；
       4. `tool` 返回保留头 `200` + 尾 `200` tok，中间用 `Bash` 原生风格 `... [truncated N tokens] ...` 省略，**任何含 `Traceback / Error / 文件路径` 的行白名单直通**。
     - **积木 3 · 近期“高清原片缓冲带”（切口前最近 `max(12 轮, ≤32,000 tok)`，强制 `loss=False`）**：100% 逐字节、逐图（含完整 `<think>`、最新代码与最近视口图）原样保留，强制 `loss=False` 保证**零重复算梯度**。
     - **积木 4 · 下半场活跃监督区（$z_{t_1} \dots$ 末端，原 HF `loss_mask`）**：100% 原汁原味训练并保留自然 `EOS` 收尾（可选仅对其中 `loss=False` 且 `>1,200` tok 的超长终端刷屏日志留首尾 + 报错行，把全集再省至 `5.45B` tok 且三截率降为 **`0%`**）。
3. **`R7` 单测硬门禁（违反任一条入 `rejected.jsonl`）**：`duplicate_supervised == 0`、`count('<think>') == assistant 轮数`、`count('<image>') == len(images)`、`total_tokens <= 254,000`、`sha256(messages[0])` 与源严格一致。

### 2.2 摘要段（`compact_task`）无损入训规则（`256K` 巨大红利）
- 永久锁定 `messages[0..1]`（系统与首轮需求/`I_ref`）及末尾 `[q_sum, summary]` 白名单；
- 对中间 `[2, len(msgs)-2)` 历史轮按 Qwen3.8 原生多轮规则将旧 `<think>` 置为空壳 `<think>\n\n</think>`——**实测仅此一步（不删任何一张图、不截任何一行日志）即有 `97.4%`（`456 / 468`）直接满足 `≤256K`（P50 = `200.4K`）**！
- 若对齐线上沙盒 `220K` 自动压缩水位，同步对超长 `>700` tok 原始工具日志做头尾保留（`ct_diet`），则 **`100.0%`（`468 / 468`）落入 `≤158K`（P50 = `91.5K`, P90 = `120.8K`）**；抽 30 条验证 `RECAP ΔNLL < 0.15` 后分层混入 `15%–25%`（约 `2,000–2,500` 条）。

---

## 三、4 机 `32×80GB` 原生 `256K` 训练与线上沙盒 1:1 对齐清单

1. **必打 1 行显存补丁（解锁 `256K` 充裕余量的关键钥匙）**：
   - 移除 `gdn_v3_plugin.py:213` 中 `_patch_chunked_lm_head_loss` 的 `and not self.output_layer.weight.requires_grad` 限制，同时保持 `PREC_AWARE=false`（使用 **FP32 `main_grad`** 精确原地累加 `+=`，并通过 `num_chunks=1 vs 2` 单测核验相对误差 `< 1e-6`），并修复 `_instrumented_prepare_batch` 的 `vp_stage` 计数。
   - **效果**：在 `256K`（`S_local = 131,072`）下，末级 PP 卡 `lm_head` BF16 logits 显存从 **`30.3 GiB` 直降至 `3.8 GiB`（`TP=4`）或 `7.6 GiB`（`TP=2`），净省 `22.7–26.5 GiB`**！
2. **4 机 `32×80GB` 推荐并行拓扑与 5 天里程碑**：
   - 基座与超参：`--model ${MODEL_ROOT}/Qwen3.8-27B`（原生 `262,144`，无 YaRN）、`--max_length 262144 --packing true --packing_strategy binpack --packing_length 262144 --freeze_vit false --freeze_aligner false --calculate_per_token_loss true --lr 1e-5 --global_batch_size 48`；
   - 并行拓扑（每 PP stage 均严格 8 卡锁死在单机 NVLink 内，跨机仅走 PP P2P）：
     - **稳妥首选**：`NNODES=4, TP=4, PP=4, CP=2, DP=1`（`m=48` 微批气泡仅 `6.25%`，每卡 SP 激活仅 `32,768`，放开 ViT 后稳态仅 **`~52–58 GiB`**）；
     - **双 DP 对照**：`NNODES=4, TP=2, PP=4, CP=2, DP=2`（分块 CE 后稳态 **`~58–65 GiB`**，先跑 10 分钟 2 步 `256K` smoke 实测择优）；
   - **时间盒纪律**：全量 `v1-dense + ct_diet` 在 32 卡上 1 epoch 约 `11.5–13.5 天`；**第一轮先跑 `30%–40%` 按 `task_group` 分层的子集（约 `4–5 天`）拿首个 Checkpoint 实测三轨 `Accepted@1`**，确认相对基座显著涨点后再跑完剩余全量。
3. **线上 `vLLM` 与沙盒环境变量 1:1 原生对齐（与 `decisions.md` 同步）**：
   - 本地 `27B` `vLLM`：`--max-model-len 262144 --enable-prefix-caching --mamba-cache-mode align`（`MAX_PIXELS=401408`，**0 代理层中段历史改写，100% 满血命中 Prefix Cache**）；
   - 沙盒环境：`AGENT_CONTEXT_WINDOW_TOKENS=262144`；默认 `32K` 输出（`32768`）配 `CLAUDE_CODE_AUTO_COMPACT_WINDOW=220000` + `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=85`（`64K` 输出档配 `190000`，严守 `compact + max_output < 262,144`）。
