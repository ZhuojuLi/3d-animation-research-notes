# 3D 动画 27B Dense 首版训练复盘与提速工程经验（Packing / 梯度累积 / TP·PP·DP）

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

日期：2026-11-24  
范围：2 机 16×H800（`gpu34` / `gpu38`），`Qwen3.8-27B`（`model_type=qwen3_5`，`template=qwen3_8`，64 层 = 48 GDN + 16 FullAttn），`${CONTAINER_IMAGE}`（`ms-swift 4.5.2` + `mcore-bridge 1.6.2` + `Megatron-Core 0.19.1` + `fla 0.4.2`）。

> 2026-11-24 用户明确确认：**不考虑 35B MoE 架构，后续只训练 27B Dense 模型**。本文归档首版 16×H800 训练的复盘结论、源码级核验结果、梯度累积与 Packing 耦合机制、27B Dense 并行布局分析，并在同目录补充双机 16×H800 实测提速矩阵结果。

---

## 1. 首版训练（`first-sft-20261123-001`）硬数据复盘

- **首版配置**：`TP=4, PP=4, CP=1, DP=1`，`micro_batch_size=1`，`global_batch_size=1`（`num_microbatches=1`），`max_length=180224`，`padding_free=true`，`packing=false`，`sequence_parallel=true`，全层重计算（`full/uniform/1`），`dataloader_num_workers=0`，未设 `TRITON_CACHE_DIR`。
- **数据长度分布**：共 10,946 条、148,401,879 输入 tokens：
  - Aodi answer-only（10,697 条，97.73%）：均值 12,082 / 中位 11,603 / P95 19,150 / 最大 30,195（0 图）。
  - ReAct（249 条，2.27%）：均值 76,944 / 中位 75,319 / P95 123,222 / 最大 171,524（>64K 共 167 条，>128K 共 6 条，2,546 次图片引用）。
- **实测总耗时与算力利用率**：
  - 训练 `17h 48m 47s`（含 812 条 eval 共 `17h 56m 41s`），16 卡合计平均 **2,314 tok/s（144.6 tok/s/GPU）**，有效 MFU（6P）约 **2.36%**（含全层重计算 8P HFU 约 **3.15%**）。
  - 耗时拆解：Aodi 稳态计算 ~12.69h（71.2%）+ ReAct 稳态计算 ~2.63h（14.8%，仅占 2.27% 行数但贡献 49.1% 全注意力二次项 FLOPs）+ **FLA Triton 按长度桶重编译/autotune ~2.25h（12.7%）** + 首步编译与 22 次 368GB ckpt ~0.49h（2.8%）；合计 18.07h，与实测 17.81h 吻合度 98.6%。
- **纠偏与四大真因**：
  1. **并非 padding 浪费**：`padding_free=true` + `mbs=1` 下每条只 pad 到 4 的倍数。
  2. **头号瓶颈是 `PP=4` + `num_microbatches=1` 的 75% 流水线死气泡**：任意时刻只有 4/16 卡在计算，另 12 卡等待（`nvidia-smi` util=100% 但功率仅 128–156W 待机）。
  3. **FLA Triton `NB` 分桶 bug（FLA #758）**：`causal_conv1d` 按 `ceil(T/1024)` 分桶（116 桶 × ~65s）、`l2norm` 按 `ceil(T/16384)` 分桶（11 桶 × ~61s），且无共享持久 `TRITON_CACHE_DIR`，PP=4 串行编 4 遍、`--rm` 容器重启全丢。
  4. **全层重计算（+33% 计算）+ `dataloader_num_workers=0` 串行 4 遍 encode + 活跃 4 卡内 HFU 偏低（~15.4%）**。
  5. **隐蔽配方效应**：`gbs=1` + `calculate_per_token_loss=true` + `clip_grad=1.0`（日志 100% 步触发裁剪），使 ReAct 按更新步实际份额仅为 **2.27%**，而非按监督 token 计的 10.98% / 加权 12.14%。

---

## 2. 梯度累积（Gradient Accumulation）与 Packing 的协同机制

1. **在 Megatron-SWIFT 中如何开启梯度累积**：
   - 框架不设独立的 `--gradient_accumulation_steps`，梯度累积步数由公式决定：`num_microbatches = global_batch_size // (micro_batch_size * data_parallel_size)`（`megatron_args.py:954`）。
   - 首版 `gbs=1, mbs=1, DP=1 → num_microbatches=1`，完全没有梯度累积，导致 `PP=4` 气泡高达 `(PP-1)/PP = 75%`。
   - 提高 `global_batch_size` 使 `num_microbatches = m >= 2*PP` 后，1F1B 流水线利用率升至 `m / (m + PP - 1)`（如 `PP=4, m=8` 达 73%；`PP=2, m=4` 达 80%、`m=8` 达 88.9%）。
2. **为什么梯度累积与 Packing 必须配合使用**：
   - 不开 Packing 时，连续 micro-batch 长度在 2.4K–171.5K 剧烈波动，1F1B 流水线与多 DP rank 会出现严重长短木桶等待（straggler stall），且触发 116 个 Triton conv1d 桶。
   - 打开 `--packing true --packing_strategy binpack` 后，每个 micro-batch 被打成高度齐平的 pack（填充率 99%+），DP/PP 负载均衡、Triton 桶从 116 骤降至 6–37 个；同时 `calculate_per_token_loss=true` 在累积窗口内按总有效监督 token 归一化梯度，避免跨 micro-batch 样本数不同导致的梯度偏差。
3. **本镜像源码核验结论（`ms-swift 4.5.2` + `mcore-bridge 1.6.2`）**：
   - 图文混合 pack 原生可用：`Qwen2VLTemplate.packing_row` 逐条独立算 3D mRoPE `position_ids`，纯文本自动补零 `mm_token_type_ids`，`HuggingFaceVit._hf_get_inputs_embeds` 按 `image_mask` `masked_scatter` 回填。
   - FA2 varlen 与 GDN 的 `causal_conv1d`、`chunk_gated_delta_rule` 均传入 `cu_seqlens`，无跨样本状态泄漏，注意力保持 $\sum T_i^2$ 复杂度。
   - 预处理走 `AddLengthPreprocessor` + `LazyLLMDataset`，不常驻全部图片张量；需设 `--dataset_num_proc 8~16`。
   - **重要避坑**：`mcore-bridge 1.6.2` 的 `GatedDeltaNet` 在 `CP > 1` + `cu_seqlens` 时用 Python 循环逐样本发起 `tensor_a2a_cp2hp / hp2cp`，大 pack 含十几条短样本开 CP 会产生数千次小通信，**当前镜像下开 Packing 优先保持 `CP=1`**。
4. **`packing_length` 与优化步数解耦**：
   - `binpack @ 65,536`：10,946 行 → 2,227 packs（167 条超 65K 的 ReAct 单条成 pack 不丢弃，均值 66.5K，conv 桶 68）。
   - `binpack @ 98,304`：10,946 行 → 1,510 packs（44 条超 98K 单条成 pack，均值 98.1K，conv 桶 37）。
   - `binpack @ 131,072`：10,946 行 → 1,137 packs（6 条超 131K 单条成 pack，均值 130.3K，conv 桶 13）。
   - `binpack @ 180,224`：10,946 行 → 826 packs（0 超限，均值 179.3K，conv 桶 6）。
   - **配方提醒**：开 packing + 梯度累积后，每步 token 吞吐量扩大（`gbs × packing_length`），单轮步数大幅减少，必须同步重算 `train_iters / epochs / warmup / save_steps / lr`，且 ReAct 有效梯度份额从按步 2.27% 变为按 token ~10.3%–12.9%。

---

## 3. 27B Dense 在 2 机 16×H800 上的并行拓扑分析

- **硬件与排布约束**：Megatron-Core 0.19.1 默认 `order="tp-cp-ep-dp-pp"`；H800 单机 8 卡 NVLink、跨机 200Gb IB。`Qwen3.8-27B` 要求 `TP ∈ {1,2,4,8}`，`TP×CP | 16`；`num_query_groups=4`，故 `TP=8` 会触发 `GatedSelfAttention` 额外 QKV All-Gather。
- **候选对比（均启用分布式优化器 + SP + 全层重计算）**：
  - `TP4·PP2·CP1·DP2`（静态 40.3G）：按 `tp-cp-dp-pp`，**TP=4 与 DP=2 均在单机 NVLink 内**，跨机仅 PP stage 0→1 的 P2P！在 `packing_length=65K~98K` + `gbs=8~16`（`m=4~8`，气泡 11–20%）下总显存约 57–68G，但在 180K 满包 + `m>=2` 时在途 2 份激活估算 ~85G 有 OOM 风险。
  - `TP8·PP1·CP1·DP2`（静态 40.3G）：**零 PP 气泡**、`m_inflight=1`，180K 满包估算峰值 ~63G 稳过，跨机仅 DP（可开 `overlap_grad_reduce` + `overlap_param_gather`）；代价是 `TP=8 > KV=4` 通信加重，需实测吞吐。
  - `TP4·PP4·CP1·DP1` + `gbs=8~16`（静态 33.1G）：最保守显存兜底，可叠加 `VPP=2 + overlap_p2p_comm=true` 进一步压低气泡，适合做 65K–98K/131K 对照与显存红线参照。
  - 辅助提速项（待实测矩阵量化）：共享持久化 `TRITON_CACHE_DIR`、`dataloader_num_workers=4`、`recompute_method=block` 逐级减少重计算层数、`overlap_grad_reduce / overlap_param_gather`。

---

## 4. 27B Dense 双机 16×H800 实测提速矩阵（2026-11-24）

### 4.1 基准设计与可复现资产

- **代表子集**：`${SHARED_DATA}/3d-agent-bench/27b-speed-matrix-20261124/input/bench256.jsonl`（SHA-256: `af926f25adae319bedd030edd16fb73e8bf8b2a1096d61aa71280deb08f27c92`），从首版冻结训练集按真实比例抽取 256 条（250 Aodi + 6 ReAct，固定包含全集最长 **171,524 tokens / 30 图** 样本与 154,273 / 128,532 / 105,460 / 75,220 / 68K 阶梯样本）。在 `binpack@65536` 下生成 53 个 packs（47 个 ~65K pack + 6 个 >65K 单条 ReAct pack）。
- **测量探针与脚本**：`${WORKSPACE}/3d-animation-agent/reports/bench-27b-speed-20261124/`（`bench_probe.py`、`run_point_node.sh`、`run_matrix.py`、`matrix-results.json`、`gpu-cleanup.json`）。探针在每个 `train_step` 前后同步 CUDA 并重置峰值统计，汇总 16 卡精确全局 token 数、墙钟耗时、最大峰值显存（allocated / reserved）及 loss。
- **对比口径**：所有实测均启用持久本地 NVMe Triton 缓存（`/var/tmp/triton-cache-27b-bench`）、`--dataloader_num_workers 4`、`--dataset_num_proc 8`、`--nccl_comm_warmup true`、`--train_dataloader_shuffle true`（`seed=42`）、全层重计算（`full/uniform/1`）、BF16 与分布式优化器。稳态吞吐均剔除第 1 步冷编译（Steps 2+）。

### 4.2 实测结果总表（16×H800 80GB，26.90B 可训练参数，BF16 理论峰值 15,824 TFLOPS）

| 点位 | 并行拓扑（16 卡） | Packing / `gbs`（每 DP 累积 `m`） | 特殊优化 | 稳态混合吞吐（16卡 / 单卡） | 纯 65K 稳态吞吐 | 相对首版提速 | MFU (6P) | 峰值显存 Alloc / Res | 最大单包长度 | 状态与结论 |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 首版基线 | `TP4·PP4·DP1` | 关 / `gbs=1`（`m=1`） | 无缓存、`workers=0` | 2,314 / 144.6 tok/s | 2,829 tok/s（纯 Aodi） | 1.00× | 2.36% | 52.3 / 63.8 GiB | 171,524 | 75% PP 气泡 + 2.25h Triton 重编译 |
| `M1` | `TP4·PP4·DP1` | `binpack@65K` / `gbs=8`（`m=8`） | 共享缓存、`workers=4` | 5,623 / 351.4 tok/s | 5,821 tok/s（Step2 6,579） | **2.43×** | 5.74% | 53.98 / 57.73 GiB | 171,524 | **PASS 5/5**，最省显存的稳妥兜底 |
| `M2` | `TP4·PP4·VPP2·DP1` | `binpack@65K` / `gbs=8`（`m=8`） | `VPP=2` + `overlap_p2p` | 6,034 / 377.1 tok/s | 6,538 tok/s（Step2 7,122） | **2.61×** | 6.15% | 55.80 / 60.73 GiB | 171,524 | **PASS 5/5**，`PP=4` 开 `VPP=2` 再提 +7.3% |
| `M3` | `TP4·PP2·DP2` | `binpack@65K` / `gbs=8`（`m=4`） | `overlap_dp`（TP+DP 全机内） | 6,485 / 405.3 tok/s | 7,019 tok/s（Step2 7,340） | **2.80×** | 6.61% | 63.56 / 66.37 GiB | 171,524 | **PASS 5/5**，零外部插件最速方案 |
| **`M7`（冠军）** | **`TP4·PP2·DP2`** | **`binpack@65K` / `gbs=8`（`m=4`）** | **`M3` + CUDA `causal_conv1d`** | **6,657 / 416.0 tok/s** | **7,405 tok/s（Step2 7,565）** | **2.88×（纯65K 3.27×）** | **6.79%（纯65K 7.55%）** | **63.56 / 66.37 GiB** | **171,524** | **PASS 5/5，综合最优；零额外显存，彻底消除 `conv1d` 桶重编译** |
| `M4` | `TP4·PP2·DP2` | `binpack@98K` / `gbs=8`（`m=4`） | `overlap_dp` | — | — | — | — | Step1 51.5 / 57.6 GiB | 98,180 | **Step 2 OOM**：154K ReAct `lm_head` logits 需 17.84 GiB，仅余 17.44 GiB（差 0.40 GiB） |
| `M8` | `TP4·PP2·VPP2·DP2` | `binpack@65K` / `gbs=16`（`m=8`） | `VPP=2` + `overlap_p2p+dp` + CUDA `conv1d` | 5,374 / 335.9 tok/s | — | 2.32× | 5.48% | 70.20 / 72.01 GiB | 171,524 | **Step 4 OOM（且更慢）**：`PP=2` 开 `VPP=2` 增加跨机 P2P 跳数与在途激活，154K logits 处 OOM |
| `M9` | `TP4·PP2·DP2` | `binpack@65K` / `gbs=16`（`m=8`） | 无 VPP、`overlap_dp` + CUDA `conv1d` | 5,492 / 343.2 tok/s | — | 2.37× | 5.60% | 63.56 / 68.12 GiB | 171,524 | 2/4 步触发 780s 限时退出；同批 16 包耗时 194.2s 慢于 `M7` 两步合计 164.2s |
| `M5` | `TP8·PP1·DP2` | `binpack@65K` / `gbs=8`（`m=4`） | 零 PP 气泡 + CUDA `conv1d` + `GLOO_SOCKET_IFNAME` | 5,376 / 336.0 tok/s | 5,189 tok/s（Step2 5,296） | 2.32× | 5.48% | **55.59 / 58.21 GiB** | 171,528 | 跑完 4 步（首步含 TP8 冷编译 287.6s 触发限时）；显存降 8G，但 `TP=8 > KV=4` + 跨机 DP 慢 ~20% |
| `M6` | `TP8·PP1·DP2` | `binpack@180K` / `gbs=4`（`m=2`） | 零 PP 气泡 + 180K 满包 + CUDA `conv1d` | 4,341 / 271.3 tok/s | 5,426 tok/s（纯文本180K） | 1.88× | 4.43% | 67.29 / 70.45 GiB | **179,936** | **PASS 4/4**：证明 `TP8·PP1` 可稳跑 180K 满包，但吞吐显著低于 `M7` |

### 4.3 Loss 数值等价性验证（相同 `gbs=8`、相同随机种子 `seed=42`）

跨越 5 种不同并行布局与内核（`M1` `TP4·PP4`、`M2` `TP4·PP4·VPP2`、`M3` `TP4·PP2·DP2`、`M7` CUDA `causal_conv1d`、`M5` `TP8·PP1·DP2`），逐 step loss 完全对齐在 BF16 舍入误差内：

- Step 1（含 171,524 tok / 30 图 ReAct）：`0.359689 ~ 0.359738`（`max Δ = 0.000049`，其中 `M3` 与 `M7` 精确一致 `0.359724`）
- Step 2（纯 65K）：`0.302929 ~ 0.303062`（`max Δ = 0.000133`）
- Step 3（纯 65K）：`0.294650 ~ 0.294749`（`max Δ = 0.000099`）
- Step 4（含 105K / 13 图 ReAct）：`0.332484 ~ 0.332594`（`max Δ = 0.000110`）
- Step 5（含 75K / 15 图 ReAct）：`0.340651 ~ 0.340708`（`max Δ = 0.000057`）

### 4.4 实测暴露的 6 条关键工程踩坑与边界

1. **`binpack` 必配 `train_dataloader_shuffle=true` + `nccl_comm_warmup=true`**：首轮 `M1` canary 实测发现，`PackingDataset(binpack)` 默认按长度降序输出 packs；若保持 `--train_dataloader_shuffle false`，会把全部超长 ReAct（171K+154K+128K+105K）堆进第 1 步流水线，叠加延迟初始化的 NCCL 通信器（`nccl_comm_warmup` 默认 `false`），直接在 Step 1 显存峰值处触发 `ncclUnhandledCudaError OOM`。补齐两项开关后，`M1` 峰值显存回落至 57.73 GiB 稳过。
2. **`TP=4` 的 `lm_head` logits 显存红线**：`Qwen3.8-27B` 词表 `V=248,320`，`TP=4` 下 `output_layer` 一次前向需物化 `[S, V/TP]` BF16 logits（154K 占 **17.84 GiB**，171K 占 **19.83 GiB**）。因此 `TP4·PP2·DP2` 在保留 171K–180K 样本时，**`packing_length=65536` 是安全上限**（峰值 66.37 GiB、留有 12.8 GiB 余量）；推到 `98304`（`M4`）即差 0.40 GiB OOM。
3. **`VPP=2` 只利好 `PP=4`，反伤 2 机 `PP=2`**：`M2`（`PP=4, VPP=2`）较 `M1` 提速 +7.3%，因 3 跳 P2P 中有 2 跳在机内 NVLink；但 `M8`（2 机 `PP=2, VPP=2`）把跨机 P2P 跳数翻倍且多驻留在途激活，实测更慢（5,374 tok/s）并在 154K ReAct 处 OOM。
4. **跨机 `DP=2` 必须显式绑定 `GLOO_SOCKET_IFNAME=ens10f0np0`**：`M5/M6` 首次启动时因 `DP=2` 跨 `gpu34/gpu38`，Megatron 创建跨机 `data_parallel_group_gloo` 未指定网卡而解析到 `127.0.1.1` 导致 29 秒崩溃。绑定 `GLOO_SOCKET_IFNAME=ens10f0np0` 后立即正常。同时查见 `gpu34` 的 `ibdev2netdev` 仅 `mlx5_1(ens2np0)` 与 `mlx5_6(ens10f0np0)` 为 Up，进一步印证 `TP4·PP2·DP2` 将大流量的 TP 与 DP 全部锁在单机 NVLink 内是最优选择。
5. **Tri Dao CUDA `causal_conv1d` 是免费纯增益**：镜像已预装 `causal-conv1d 1.6.1`，仅在 `external_plugins` 中将 `mcore_bridge.model.modules.gated_delta_net.causal_conv1d` 默认 `backend` 由 `'triton'` 改为 `'cuda'`，即可在零额外显存、`Δ<1e-4` 等价的前提下，彻底消除 FLA #758 的 116 桶 Triton `conv1d` 重编译（冷启动步省 23s，稳态再提 +3%~8%）。
6. **在保留 171K ReAct 时必须维持全层重计算**：`TP=4, S=171K` 下单层非重计算激活约 7.5 GiB × 2 在途微批，关闭或减少重计算层数在超长步必 OOM。

### 4.5 全集 1 Epoch 耗时估算与最终生产推荐模板

- **全集（10,946 条 / 148.4M tokens，2,227 packs @ 65K）单轮训练耗时**：按 `M7` 稳态口径（纯 65K 7,405 tok/s，含 7.5% 超 65K ReAct 的保守加权约 6,545–6,657 tok/s），**单轮训练从 `17h 49m` 压降至约 `6.2–6.5h`（提速 2.8–2.9×，单轮省 ~11.5 小时）**；纯零插件版 `M3` 约 `6.4–6.7h`。
- **训练配方同步调整提醒**：`binpack@65536 + gbs=8` 下每步约 520K–550K tokens，10,946 条数据 1 epoch 仅约 **278 个优化步**（首版为 10,946 步），且 ReAct 有效梯度权重从按步 2.27% 恢复为按监督 token ~11–12%。正式开训前必须同步重算 `num_train_epochs / train_iters`、`lr`（大 batch 通常需相应调高并设 `lr_warmup_fraction ~0.05`）、`save_steps` 与 `eval_steps`。
- **推荐生产启动核心参数（2 机 16×H800，`Qwen3.8-27B`）**：

```bash
# 容器环境变量（核心新增/保留项）
-v /var/tmp/triton-cache-27b:/triton-cache -e TRITON_CACHE_DIR=/triton-cache \
-e GLOO_SOCKET_IFNAME=ens10f0np0 -e NCCL_SOCKET_IFNAME=ens10f0np0 \
-e 'NCCL_IB_HCA=^=mlx5_8:1' -e USE_MCORE_GDN=true \
-e PYTORCH_ALLOC_CONF=expandable_segments:True \

# megatron sft 核心效率参数（M7 冠军配置；不加插件则为 M3）
--packing true --packing_strategy binpack --packing_length 65536 \
--max_length 180224 --truncation_strategy delete \
--train_dataloader_shuffle true --nccl_comm_warmup true \
--dataset_num_proc 8 --dataloader_num_workers 4 \
--tensor_model_parallel_size 4 --pipeline_model_parallel_size 2 --context_parallel_size 1 \
--sequence_parallel true --use_distributed_optimizer true \
--overlap_grad_reduce true --overlap_param_gather true \
--cross_entropy_loss_fusion true --cross_entropy_fusion_impl te \
--recompute_granularity full --recompute_method uniform --recompute_num_layers 1 \
--micro_batch_size 1 --global_batch_size 8
# 推荐挂载独立轻量插件，彻底消除 FLA #758 conv1d 重编译：
--external_plugins ${WORKSPACE}/3d-animation-agent/scripts/mcore_gdn_cuda_conv1d_plugin.py
```

### 4.6 GPU 释放核验凭据

- 实测结束后已于 `2026-11-24 18:19:14 +08:00` 核验 `gpu34` 与 `gpu38` 共 16 张 H800：无任何残留 `bench-27b-*` 容器，GPU 计算进程数均为 `0`，16 卡显存占用全部为 `0 MiB`。凭据文件：gpu-cleanup.json（本地附件未发布）。
