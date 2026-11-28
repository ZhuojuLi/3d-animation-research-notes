# Qwen3.8-27B × 384K 高质量长轨迹 × 32×H100 (80GB) 终极训练方案（Swarm 四专家多轮红队辩论定案版）

> 公开整理版 · 2026-11-28。保留成文时点的记录；计划、文献结果和本地实测请分别理解。环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

> **定案日期**：2026-11-27（经 `infra-architect` · `data-strategist` · `algo-posttrain` · `redteam-verifier` 两轮硬核交叉质询与源码/在途日志实证收敛）  
> **硬件与模型基线**：4 机 `32 × H100-80GB`（单机 8 卡 NVSwitch `900 GB/s` + 跨机 IB） · `Qwen3.8-27B`（`48` 层无 RoPE 线性注意力 `GatedDeltaNet` + `16` 层 `mRoPE` 全注意力 + `27` 层未切分 `ViT+Merger`，原生 `262,144` [`256K`] 窗口） · 小红书 `3DCodeFactory` 全量落盘数据（`5,316` 独立训练任务 / `216` 验证任务，`28,602` 段）  
> **核心实证锚点**：在途任务 `start-full-32g-s3-v1` 实时分词/Step-1 日志审计 + `smoke32-s3-purefp32-chunked-v2` 实测吞吐/显存 + 本机 80GB GPU 1 分块 CE 精度实测（[exp1_gpu1_verified_results.json](a100-experiments/exp1_gpu1_verified_results.json)） + 容器内 `ms-swift 4.5.2` / `Megatron-Core 0.19.1` / `mcore-bridge 1.6.2` 源码逐行核验

---

## 一、在途任务 `start-full-32g-s3-v1` 最新实况与四大关键纠偏

专家组对集群 `20:16` 拉起的 `start-full-32g-s3-v1`（`21:24` 完成 `Map` 分词进入 Step 1）与容器底层代码做了只读取证，纠正了前期直觉误判并锁定了真正的瓶颈：

1. **为什么 `[4, 20, 20, 20]` 在 `PP3`（Node 3）没有 OOM，真正的隐患在哪？**
   - 实测 `train-node3.log` 已顺利激活分块 CE（`seq_len=185,228`/CP rank，`chunk_size=16,384`）并**跑通 Microbatch #1 前向+反传**。
   - **第一性原理解释**：一旦分块 CE 把 `PP3` 瞬时 logits+FP32 CE 显存从 `68.2 GiB` 砍到 `~11.0 GiB`，1F1B 流水线调度的在途驻留激活数 `(PP - stage) = [4, 3, 2, 1]` 使真正的显存峰值落在 **`PP0`（4 个微批 + 未切分的 `460.8M` ViT，`70–75.5 GiB`）与 `PP1`（3 个微批）**，而只驻留 1 个微批的 `PP3` 仅占 **`~49.2 GiB`**！
   - **`start-full-32g-s3-v1` 真正的四大硬伤**：
     1. **静默丢数据（实锤）**：`Map` 直接删掉了 **`762 / 18,496` 条训练样本（`4.12%`）**（含 `7` 张 `aspect_ratio ≥ 200` 窄条图触发 `smart_resize ValueError` 整条误删 + **`~420 / 1,112` [`37.8%`] 的 `compact_task` 超 `393,216` 被删**，越深层的压缩死得越惨）；
     2. **流水线算力失衡**：`PP3` 跑 `20 层 + 4 次分块 lm_head GEMM（折合 ~2.3 层算力）≈ 22.3 层`，拖慢全局每步耗时（约 `55 分钟/步`）；
     3. **`PP0` 缺乏单包图片数上限保护**：`ms-swift` 的 `PackingDataset`（`packing.py:41`）**只按 1D token 长度装箱**，遇到 `148` 图长尾段或两段高密视口图拼包（`>90` 张图）仍会在中途引爆 `PP0`（`~93.7 GiB`）；
     4. **冷启动 `384K YaRN` 算法与成本劣势**：剩余 `15,885` 包（`330` 步，`5.872B` tok）需盲跑 **`~12.8 天`**，且强绑 `YaRN 1.5×`。
   - **最优交接动作**：**不要立刻盲杀**——让 `start-full-32g-s3-v1` 自然跑完 **Step 1–2**（拿 `GBS=48` 真实 `step-metrics-node0.jsonl` 遥测），同时利用这 1–1.5 小时在 CPU 上零成本跑完 **Phase 0 精洗数据**，随后干净停机切入正式 **Stage 1**（`0` 分钟 GPU 空转）。

---

## 二、专家组两轮红队辩论的五大核心交锋与定案

### 交锋 1：全程 `384K YaRN` vs `256K → 384K` 两阶段退火 vs **100% 纯原生 `256K` 多阶段主线**
- **初期分歧**：`infra-architect` 首轮提议用 `2.25` 天跑 Stage-2 `384K YaRN` 退火以覆盖未切分 `256K–384K` 段；`algo-posttrain` 与 `data-strategist` 坚决主张 **100% 纯原生 `256K`（`262,144`，`rope_type="default"`，零 YaRN）贯通 SFT → RL → RFT**。
- **终局裁决（全票收敛至纯原生 `256K` 主线，`384K YaRN` 仅留作 `0` 预算休眠备选）**：
  1. **数据真相**：`3DCodeFactory` 平均轨迹长达 **`1,094.5K` tokens**，**`98.2%`（`6,056 / 6,166`）本身就是多段 `Claude Code` 自动压缩接力轨迹**！`384K` 只是小红书 `48` 卡对应的单段窗口（`32 卡 / 48 卡 = 256K / 384K = 2/3`）。
  2. **`Qwen3.8-27B` 混合架构 `mRoPE` 物理账**：全模型 `48` 层 `GatedDeltaNet` 无位置编码，仅靠 `16` 层全注意力的 **`64` 个旋转维（`32` 对复频率）** 承载全局进度与视口几何。开 `YaRN 1.5×` 后，虽然局部高频对 `i=0..14`（`≤7.26K`，含图内 `32×64` patch 坐标）波长不变，但 `mscale = 1.04055` 在 `qk_layernorm` **之后**仅放大这 `64` 维，从第 0 步起制造 **`+8.27%`（`mscale²`）旋转维/NoPE 维能量偏置**，同时扭曲 `12K–241K` 跨轮代码/渲染对齐相位、压缩超长频段诱发 **不吐 EOS 死循环（Endless Generation）**。
  3. **线上推理与 RL 吞吐碾压**：`vLLM`（`--mamba-cache-mode align --enable-prefix-caching`）下，原生 `256K` 每并发序列 KV 仅 **`16.0 GiB`**（`+146.8 MiB` GDN 状态），比 `384K`（`24.0 GiB`）省 **`33%` 显存**、提升 **`+50%` 并发采样吞吐**，且与沙盒 `CLAUDE_CODE_AUTO_COMPACT_WINDOW=220000`（预留 `32K` 输出）及 CAD / 2D 赛道 **1:1 零摩擦同构**。
  4. **避免分叉浪费**：若 Stage 2 切去 `384K YaRN`，产出的权重无法无损回退到原生 `256K` 服务，白白烧掉 `72 H100-卡天`；省下的算力投入 **沙盒执行验证 RL** 收益高出一个量级！（仅当 Day 4 评测发现 `256K+220K压缩` 在超长题上落后论文趋势 `>1.5` 分时，才唤醒 `[8, 20, 20, 16]` `384K YaRN` `80` 步应急分支）。

### 交锋 2：源码级排雷——哪些 H100 “加速黑科技”绝对不能开？
经容器内源码逐行核查，**明确封禁 4 个必崩/负收益开关，锁定 3 个真提速/稳显存机制**：
- ❌ **严禁开 `--fp8_format e4m3`**：`GatedDeltaNet.in_proj` 在 `TP=4` 下局部维度为 `16,480 / 4 = 4,120`（**`4120 % 16 == 8 ≠ 0`**），且 `padding_free` 序列长 `S_sp % 8 ≠ 0`，反传必触发 TransformerEngine `assert_dim_for_fp8_exec` 硬崩溃！
- ❌ **严禁开 `--tp_comm_overlap true`**：`GatedDeltaNet` 运行时动态关闭 `sequence_parallel` 并做全长 `all_gather`（为静态 Userbuffer 尺寸的 4 倍），必崩！
- ❌ **严禁改 `--recompute_num_layers 2` 或 `VPP=2`**：`mcore_bridge` 中 `full + uniform + num_layers=2` 仍重算 100% 层（`0%` 算力节省）却让块内反传激活翻倍；`VPP=2` 会让 `PP0` 在途驻留激活膨胀 `1.375×`。严格锁定 **`full / uniform / 1`**！
- ❌ **严禁启用 `Muon` 优化器**：尽管镜像带 `.muon`，但 `Qwen3.8-27B` 存在 **4 处源码级阻断**（`GDN.in_proj` 把 6 维标量衰减门 `b,a` 混入 `4120×5120` 矩阵做 Newton-Schulz 正交化导致门控梯度暴涨 `13×`；`GatedSelfAttention` `[3584,5120]` 触发 `muon_split_qkv` 整除异常；27 层 `ViT` 被误送入 NS；不支持 `DistributedOptimizer` CPU Offload）。**严格锁定 `AdamW` + FP32 `main_grad`（`--use_precision_aware_optimizer false --optimizer_cpu_offload true`，每 48 微批仅做 1 次 CPU 更新，耗时占比 `<0.15%` 却净省 `10.6 GiB`/卡）**！
- ✅ **真均衡层切分 `[10, 19, 19, 16]`（原生 `256K`）**：因 `PP3` 的 4 次分块 `lm_head` GEMM + 2 次 FP32 CE 等效于 **`~2.3` 层算力**，将 `[10, 18, 18, 18]` 微调为 **`[10, 19, 19, 16]`**（`first=10, last=16`），使 `PP1` (`19L`)、`PP2` (`19L`)、`PP3` (`16L + 2.3L = 18.3L`) 计算耗时误差 `<4%`，四机峰值显存仅 **`62.1 / 49.6 / 43.0 / 35.6 GiB`**（全员余量 **`>17 GiB`**），稳态吞吐达 **`185–205 tok/s/gpu`（`511M–567M tok/天`）**！

### 交锋 3：破解 `ms-swift` 1D 装箱“图片炸弹” + 数据去重省出 `4+` 天算力
- **图片双重硬锁（`≤ 64` 张图/包，0 删活跃图）**：`swift/dataset/packing.py:41` 只看 1D token 长度装箱。方案同时上双保险：
  1. Phase 0 切分时强制每子段满足线性密度 `imgs_s ≤ min(56, max(8, floor(64 * tok_s / 262144)))`（超密段仅将干净切点回退 2–4 轮，**不删任何一张活跃区视口图**，代数上保证任意 `≤262,144` 拼包总图数自动 `≤64`）；
  2. 在 `gdn_v3_plugin.py` 增加 20 行 2D 装箱补丁 `(sum_tok ≤ 262144 AND sum_img ≤ 64)` 及 `max_mbs_images ≤ 64` 监控断言。
- **全盘取证精洗（省下 `~22%` 冗余 Token）**：
  - 扫描全部 `695,648` 张 JPEG：精确定位全部 **`7` 张 `aspect_ratio ≥ 200` 异常图**（涉及 `12` 条训练段），离线 letterbox pad 至 `min_edge ≥ 32` **100% 救回**；
  - 修复子代理过滤正则（`"-main-agent-"` 漏了 **`8` 条 `"-extra_text-agent-"`**，改为过滤 `"-agent-"` 剔除全部 `12` 条）；
  - 剔除 `23` 条 `retry02` 重复轨迹；在 `5,316` 个独立任务上严格执行 **`1 任务 1 主轨迹`**（`85%` 带参考图 `main` + `15%` 不重叠纯文本 `extra_text`），并对 `317` 条 `5–8` 段超长拉锯任务裁剪掉中间无效反复试错段（保留首段从零建仓 `compact_before-0` + 末段收敛 `EOS`），叠加 `20%` 任务率 `ct_diet`（`messages[0..1]` 与 `[q_sum, summary]` 白名单 + 历史空 `<think>` + `>700` tok 日志留头尾，`100% ≤ 158K`）。

### 交锋 4：独立视觉塔学习率 `--vit_lr 2e-6` 与空思考掩码核实
- **分层学习率**：`GBS=48` 每步有 `~2,500` 张图（约 `100 万` 视觉 token）冲刷未切分的 27 层 `Qwen3.5-ViT`。源码核实 `swift/megatron/trainers/base.py:345-413` 原生支持在 `CPUOffloadOptimizer` 内按组缩放学习率——锁定 **`--lr 1e-5 --vit_lr 2e-6 --aligner_lr 1e-5`**，防止 ViT 预训练几何特征过热漂移！
- **空思考防坍缩**：核实 `v1` 中有 **`19.2%` 的 `loss=True` 执行轮**与 **`48.9%` 的 `compact_task` 摘要轮**原始 `reasoning_content` 为空（被包成 `<think>\n\n</think>`）。实测日志 `[LABELS]` 证实 `--loss_scale default`（自动展开为 `default+ignore_empty_think`）+ `--is_binary_loss_scale true` 会将空 `<think>\n\n</think>` 精准掩码为 **`-100`**，彻底杜绝模型学会“跳过思考直接调工具”的坍缩风险！

### 交锋 5：算力分配为什么必须是 **`57% SFT : 43% RL+RFT`**（以及如何 `$0` API 成本造出 RL 环境）？
- **盲跑 100% SFT 的天花板**：全量 SFT 训满两周也解决不了多模态代码 Agent 的两大顽疾——**平均 `<0.6` 轮过早自我放过（Self-Lenient Early Stopping）** 与 **布尔穿模/运行时异常修不好**（`IterCAD` 实测二阶段继续 SFT 反而使几何误差恶化 `10.55 → 12.44`，而短周期 `GSPO` RL 直接砍半至 `5.09`）。
- **为什么不做 `256K/384K` 从零长程在线 RL，而做 `≤64K` 确定性 `Repair-RL` + `256K` `RFT` 回写？**
  - 从零 `256K/384K` 在线 RL 在 16 张采样卡上仅能跑 `~32` 并发，一步要 `5–7.5 小时`（物理不可行）；
  - 专家组在落盘 `v1-dense` 中实测发现：**`83.6%` 的轨迹天然包含 `Traceback/Error/坏渲染图 → loss=True 修复成功` 的真实跃迁对**（训练集共约 **`6.4 万` 处运行时报错修复 + `44.9 万` 处视口看图精修**）！在 Stage 1 训练期间，纯靠后台 CPU 回放前序 `Write/Edit` 即可 **`$0` API 成本** 提取出 **`2,400+` 个真实残损工程快照（`≤20K` 输入，`≤64K / ≤12 轮` 修复窗口）**，在 `16` 张 vLLM 卡上并发跑 `140+` 沙盒（**`~16 分钟/步`**，`3.6 天` 跑完 `220–240` 步确定性 `GSPO` RL），最后用 `1.5 天` `256K` 全长 `On-Policy RFT` 把修复直觉写回满窗生成！
- **零空转与洁净基线隔离（满足 `decisions.md` 红线）**：Stage 1 **100% 纯跑小红书数据**产出纯净复刻基线 `ckpt-S1-clean`；Stage 2 再分叉混入已就绪落盘的 `SWE` 通用防遗忘锚点与通过验收的 `CadQuery / 2D Web` 数据（若外部合成延期则自动由剩余高难 3D 任务补位，**`0.0` 小时 GPU 空转**）。

---

## 三、`32 × H100` 全周期 `11.7 天`（`374 H100-卡天`）执行总表

| 阶段 | 时长 (`32×H100`) | 精确数据配方（`0` 静默丢弃） | 步数 / Token / 拓扑 | 产物与硬性 Go/No-Go 门禁 |
| --- | :---: | --- | :---: | --- |
| **Phase 0：CPU 离线精洗**（与在途任务 Step 1–2 重叠） | `~1.5 小时` CPU（`0` GPU 空闲） | 从 `v1` 全分片：剔 `12` 条 `-agent-` 与 `23` 条 `retry02`；pad `7` 张 `AR>180` 窄条图（救回 `12/12` 行）；`5,316` 独立任务严格 `1` 任务 `1` 轨迹 + `>4` 段拉锯裁剪；生成 `HCPF-Lite@256K`（`BUDGET=254K`, `dup_U=0`, 代数锁 `imgs≤64`）+ `20%` 任务率 `ct_diet`（`≤158K`, `P50=91.5K`）。 | 产出 `3dcodefactory-hcpf-256k-v2` | **G0**：`0` 删行、`0` 图片报错、`max_mbs_images≤64`、`ct_diet RECAP ΔNLL<0.15`、四机 `reserved ≤65 GiB`、吞吐 `≥185 tok/s/gpu`。 |
| **Stage 1：纯净隔离原生 `256K` 主力 SFT** | **`4.1 天`** (`131 卡天`) | **100% 纯小红书 3D**（`0%` SWE/CAD/2D）：按分类分层取 `50%` 独立任务（`2,658` 任务，`depth≤3` $\to$ `12,450` 条 `HCPF-Lite@256K` + `532–1,080` 条 `ct_diet`）。 | **`190` 步** @ `GBS=48`（`9,120` 2D 包，**`2.285B` tok**）；`TP4·PP4·CP2·DP1`，层切分 **`[10,19,19,16]`** | 永久归档纯净基线 **`ckpt-S1-clean`**。**G1**：`val_loss` 单调降、`non-EOS <2%`、`realhard6`+`devtest-v2` 显著超基座、`220K` 压缩续写跑通。 |
| **Stage 2：多轨融合 + 防遗忘 `256K` SFT** | **`2.5 天`** (`80 卡天`) | 从 `ckpt-S1-clean` 分叉：剩余高难几何（`d_geo≥3`）3D 任务（`1.03B` tok）+ `ct_diet`（`0.06B`）+ 已落盘 `SWE` 通用锚点（`0.20B`, `~12% U`）+ 验收达标的 `CadQuery / 2D Web`（`0.10B`，跨轨干扰 `<1.0 pp` 准入）。 | **`115` 步** @ `GBS=48`（`5,520` 包，**`1.38B` tok**）；`lr: 5e-6 → 1e-6`, `vit_lr: 1e-6` | **`ckpt-S2-prod`**。**G2**：通用代码退化 `<0.5–1.0 pp`、`0` 跨轨工具串味、CAD/2D 正向涨点。 |
| **Stage 3：`≤64K` 确定性沙盒 `Repair-RL`** | **`3.6 天`** (`115 卡天`) | 先修 4 处验收器漏洞并跑 `8h` 探针，再跑 **`220–240` 步**（`G=8 × 24–32` 题/步，`≤12` 轮）：基于 CPU 从 `v1-dense` 提取的 `2,400+` 真实残损工程 + CAD/2D 修复态 + `10%` SWE；**100% 纯程序确定性奖励**（`bpy` + `Playwright/WebGL` + `OCCT`），`GSPO-token` + `PhyCAD HBA`，`lr=1e-6, kl=0.01, freeze_vit=true`。 | `16` 卡 vLLM（`4×TP4`，`140+` 并发沙盒）+ `16` 卡训练（`TP4·PP4·CP1·DP1`，`0` GDN CP 通信） | **`ckpt-S3-rl`**。**G3 (`8h` 探针)**：非死组 `≥60%`、`0/10` 作弊样本拿分、`KL<0.04`；若探针未过无缝切 `Best-of-8` RFT（`0` 空转）。 |
| **Stage 4：满窗 `256K` 在策略 `RFT` 蒸馏回写** | **`1.5 天`** (`48 卡天`) | `0.5 天` `32` 卡 vLLM 满窗采样（`~800` 道难题 × `N=4`，开 `220K` 自动压缩）$\to$ 确定性硬检 + 五维双向 `Best-of-2` 择优 $\to$ `1.0 天` SFT 回写（含 `12%` SWE）。 | **`50` 步** @ `GBS=48`（`lr: 3e-6 → 5e-7`, `vit_lr: 1e-6`），`TP4·PP4·CP2·DP1`，`[10,19,19,16]` | **`Qwen3.8-27B-Unified-256K-Final`**。**G4**：四赛道 `Accepted@1` 较纯 SFT 再涨 **`+6 ~ +10 pp`**，SWE 漂移 `≤1.0 pt`。 |

---

## 四、Stage 1 一键生产启动参数（经 `ms-swift 4.5.2` 全参数名核验）

```bash
# 4 机 x 8 卡 H100-80GB（单机内 TP4 x CP2 = 8 卡全走 NVSwitch，跨机仅走 PP P2P）
MODEL_DIR=${MODEL_ROOT}/Qwen3.8-27B          # 原生 262,144 RoPE（rope_type="default"，不开 YaRN）
DATA_DIR=${REFERENCE_DATA}/code2video/training/data/3dcodefactory-hcpf-256k-v2/stage1_clean
PLUGIN=${REFERENCE_DATA}/code2video/training/runs/phase2-3dcodefactory-paper-s3-384k/gdn_v3_plugin.py
# gdn_v3_plugin.py 补入 ~25 行：2D (tok<=262144, img<=64) PackingDataset 匹配 + max_mbs_images<=64 断言

export USE_MCORE_GDN=true MCORE_GDN_CONV1D_BACKEND=cuda NCCL_NVLS_ENABLE=0
export PYTORCH_ALLOC_CONF=expandable_segments:True LM_HEAD_LOSS_CHUNK_SIZE=16384
export MAX_PIXELS=401408 IMAGE_MAX_TOKEN_NUM=512 EARLY_SAVE_STEP=10

megatron sft \
  --model /models/Qwen3.8-27B --model_type qwen3_5 --template qwen3_8 --template_backend swift --torch_dtype bfloat16 \
  --external_plugins "$PLUGIN" \
  --dataset "$DATA_DIR/train.swift.jsonl" --val_dataset "$DATA_DIR/validation.swift.jsonl" --split_dataset_ratio 0 \
  --dataset_shuffle true --train_dataloader_shuffle true --seed 42 --data_seed 42 --strict false \
  --dataset_num_proc 16 --dataloader_num_workers 4 \
  --enable_thinking true --preserve_thinking true --loss_scale default --is_binary_loss_scale true \
  --max_length 262144 --truncation_strategy delete --max_pixels 401408 \
  --packing true --packing_strategy binpack --packing_length 262144 --packing_num_proc 16 \
  --tuner_type full --freeze_vit false --freeze_aligner false --freeze_llm false \
  --tensor_model_parallel_size 4 --pipeline_model_parallel_size 4 --context_parallel_size 2 --sequence_parallel true \
  --decoder_first_pipeline_num_layers 10 --decoder_last_pipeline_num_layers 16 \
  --recompute_granularity full --recompute_method uniform --recompute_num_layers 1 --vit_gradient_checkpointing true \
  --cross_entropy_loss_fusion true --cross_entropy_fusion_impl native --calculate_per_token_loss true \
  --nccl_comm_warmup true --tp_comm_overlap false --overlap_grad_reduce false \
  --optimizer adam --adam_beta1 0.9 --adam_beta2 0.95 --adam_eps 1e-8 --weight_decay 0.1 --clip_grad 1.0 \
  --use_distributed_optimizer true --optimizer_cpu_offload true --use_precision_aware_optimizer false \
  --lr 1e-5 --vit_lr 2e-6 --aligner_lr 1e-5 --min_lr 1e-6 --lr_decay_style cosine \
  --train_iters 190 --lr_decay_iters 190 --lr_warmup_iters 10 \
  --micro_batch_size 1 --global_batch_size 48 \
  --eval_iters 4 --eval_steps 50 --save_steps 50 --save_total_limit 6 --logging_steps 1 \
  --save_safetensors true --no_save_optim false --no_save_rng false \
  --ddp_timeout 5400 --add_version false --output_dir "$OUT_DIR"
```

### 五、线上 `vLLM` 与 `Claude Code` 沙盒 1:1 配套对齐参数
- **`vLLM` 部署**：`--max-model-len 262144 --tensor-parallel-size 4 --enable-prefix-caching --mamba-cache-mode align`（`MAX_PIXELS=401408`，代理层 `0` 中段改写以 **100% 命中 Prefix Cache**，模板默认 `xhigh`）；
- **`Claude Code` 沙盒**：`AGENT_CONTEXT_WINDOW_TOKENS=262144`、`CLAUDE_CODE_MAX_OUTPUT_TOKENS=32768`、`CLAUDE_CODE_AUTO_COMPACT_WINDOW=220000`、`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=85`（`64K` 输出档配 `190000`）。
