# 独立架构审查：小红书 `3DCodeFactory`（384K）→ `≤200K` 数据处理方法与双方案硬碰硬裁决

> 公开整理版 · 2026-11-28。保留成文时点的记录；计划、文献结果和本地实测请分别理解。环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

> **审查人**：`claude-opus-5-5`（资深分布式训练 / 长程多模态 Agent 数据架构视角）
> **审查日期**：2026-11-27
> **审查对象**：[主调研报告 `README.md`](README.md) · [2026 H2 文献专题](2026h2-compaction-literature-deep-dive.md) · [`empirical_audit_200k_ledger.json`](empirical_audit_200k_ledger.json) · `decisions.md`（2026-11-27 条） · 三套落盘数据集 `prep-report.json` · `prepare_3dcodefactory_swift.py` · `gdn_v3_plugin.py` · `launch.sh` · `smoke32-c2-tp2pp4cp4` 实测日志
> **审查口径**：只读、只算账、不给面子。凡是能拿真实 token / 真实 GiB / 真实 `s/it` 反推的，一律反推；凡是报告里对不上的数字，一律点名。

---

## 零、裁决摘要（先给结论，后面全部是证据）

1. **数据侧：主报告的方向对，但三处账算错了，且错得都朝"让自己方案更好看"的方向偏。**
   - `384K` 基线步数 `765` 步 / `36,720` packs 是错的：`17,384 × ~355K ≈ 6.2B` tokens，`binpack@393,216` 实际只需 **`~15,700–17,400` packs ≈ `330–360` 步（GBS=48）`**。因此 `HCPF-200K` 的 `859` 步不是 `+12.3%`，而是 **`+139%` 步数**。
   - 但步数没有意义，**token 数才有意义**：`HCPF` 的 `41,275 packs × 204,800 × 88.3% ≈ 7.46B` 输入 tokens，比 `384K` 直跑的 `6.2B` 多 **`+20%`**（前缀重叠/脊柱重复）。换算成墙钟：`384K ≈ 13.6 天/epoch`，`200K+HCPF ≈ 15.7 天/epoch`。**"改 200K 更快"这个卖点是假的**——真理由是显存余量与原生 RoPE，不是速度。
   - `ct10pct` 在 `200K + --truncation_strategy delete` 下的可用率是 **`12.6%`（`2,329 / 18,496`）**，且其中 `compact_task` 存活 **`0` 条**。这版数据在当前训练配置下等于自废武功。

2. **方案选择：`A` 和 `B` 都不该原样落地，选我给的 `方案 C`（`HCPF-Lite`）——它本质是"用 `B` 的完整性 + `A` 的无人工痕迹"。**
   - `A` 的致命伤不是"60K 外前文断层"，而是**它在 `w≥1` 子段里制造了一个 `Claude Code` 线上永远不会出现的上下文形状：第 36 轮紧接着首轮，中间凭空蒸发 30 轮**。`DAG-SFT` 的 `-4.0 pp` 打的就是这个。
   - `B` 的致命伤不是不好，而是**自造了 `[Historical viewport render #k archived]` / `[Code payload ... updated in later turns]` 这类线上零命中率的 token 串**。这不是"训推不一致"的抽象风险，是实体级 OOD。
   - **`方案 C` 的规格只有一句话：`w≥1` 子段里除了"空 `<think>` 块"和"真·截断省略号"之外，不出现任何非原生 token。**

3. **训练侧：`gdn_v3_plugin.py:213` 是 `tp4pp4cp2` 崩溃的"直接诱因"，但报告里"去掉它就是逐比特等价"的说法是错的。**
   - 崩溃栈已核实：`transformer_engine/pytorch/module/linear.py:723 backward → general_gemm` 抛 `torch.OutOfMemoryError: Tried to allocate 1.58 GiB ... 78.55 GiB in use`。这是**反传**，不是前向——前向 `[196608, 62080]` BF16 logits（`22.7 GiB`）刚刚挤进去，反传再要 `1.58 GiB` 就死了。
   - `weight.main_grad` 的累加机制**确实是 `+=`，不会覆盖**，所以"去掉这行"在语义上安全。但本次 run 开了 `use_precision_aware_optimizer=true + main_grads_dtype=bf16`，**12 段 bf16 累加 ≠ 1 次 fp32 累加**，所谓"数学逐比特等价"不成立。要用分块，就把 `main_grads_dtype` 换回 `fp32`。

4. **拓扑：三选一里选拓扑 3；但我真正的首选是第四个——`TP=2, PP=4, CP=2, DP=2`。**
   - 它跟刚刚跑通的 `TP=2/PP=4/CP=4/DP=1` 只差两个参数，**每卡序列长度 `102,400` vs 实测 `98,304`（+4.2%）**，显存是可外推的已知量（`~63 GiB`）。这是全项目最便宜的一次"确定性成功"。

5. **最大的账报告里根本没算：32 卡训一遍 `v1-dense`，无论 384K 还是 200K，都是 `13–16 天/epoch`。** 用户真正该拍板的不是"200K 还是 384K"，而是"要不要先跑 30–40% 分层子集"。见第四节。

---

## 一、一手材料实查结果（含我发现的账本不一致）

### 1.1 落盘数据实查

| 数据集 | 实测 `train.swift.jsonl` 行数 | `prep-report.json` 自述 | 结论 |
| --- | ---: | --- | :--- |
| `3dcodefactory-paper-s3-v1-dense` | **`17,384`** | `17,384` | ✅ 一致 |
| `3dcodefactory-paper-s3-v1-dense-ct10pct` | **`18,496`** | `18,496`（`17,384` dense + `1,112` ct） | ✅ 一致 |
| `3dcodefactory-paper-s3-v1` | （报告述 `28,602`） | `28,602` | 采信 |

`ct10pct` 的分层抽样账本身很干净：按 `(split, track, compaction_depth 1/2/3/4/5+)` 分 20 层抽 `547` 个 task → `1,112` 条段，`val_mod=25` 的 task 级隔离没有泄漏（`task_overlap: 0`）。**这个数据集的问题不在抽样质量，在它落进 `200K` 窗口之后会发生什么**（见 2.3）。

### 1.2 四机实测：`smoke32-c2-tp2pp4cp4`（唯一跑通的那次）

```
dt_s=782.528   input_tokens=2,926,152   supervised_tokens=1,606,220
packed_samples=9   images=421   total_microbatches=8
max_mbs_tokens=390,592   min_mbs_tokens=311,944
tok_per_s=3,739.4   tok_per_s_per_gpu=116.9
peak_alloc_gib=62.241   peak_reserved_gib=72.545
loss=1.049582   grad_norm=1.724032   applied=true
logging.jsonl: elapsed="13m 2s", memory=72.54 GiB, train_speed=782.42 s/it
```

**四个必须写进决策的事实：**

1. `72.545 / 79.18 = 91.6%` 显存占用。**这是"跑通"，不是"能跑 13 天"**。13 天里只要来一个 `148` 张图的 pack（`prep-report.json` 里 `image_quantiles.max = 148`），ViT 激活就会在 `PP0` 上顶穿——`smoke-384k-57-38-fvit` 就是这么死在 `77.72 + 1.86 GiB` 的。**91.6% 占用 + 长尾 pack = 一个必然会在第 N 小时炸的长跑。**
2. `tok/s/gpu = 116.9` 是被 **`DP=1, p=4, m=8`** 严重污染的。1F1B 气泡 `= (p−1)/m = 3/8 = 37.5%`。换成正式配置 `GBS=48, DP=2 → m=24`，气泡降到 `12.5%`，**外推 `tok/s/gpu ≈ 116.9 × 0.875/0.625 ≈ 163.6`**。这个数才是后面算天的依据。
3. `max_mbs_tokens=390,592` 对 `393,216` 的 `packing_length` = 填充率 `99.3%`；而同批 `min=311,944`。binpack 本身没问题，**问题是一条 384K pack 里塞了 `421/8 ≈ 53` 张图**。
4. 这份 args 里 `freeze_vit: true`、`trainable_parameters: ["visual.visual.merger"]`。**这不是论文 Table S3（`freeze_vit=false`），也不是 `decisions.md` 当天要求的形态。** 384K 能跑通的代价是冻死 ViT；而 `decisions.md` 第 62 行刚明确"视觉对齐层不再冻死"。**换句话说：现在跑通的这个配置，本身已经违反了当天的拍板。** 这一条足以单独否定"就按现在这个跑 13 天"。

### 1.3 三次崩溃的真凶：`tp4pp4cp2` 家族

- `smoke32-c1-tp4pp4cp2-v3` 已核实栈：`backward_step → custom_backward → TE linear.py:723 backward → general_gemm → torch.OutOfMemoryError: Tried to allocate 1.58 GiB ... GPU 2 has 79.18 GiB, 627.25 MiB free, 78.55 GiB in use（PyTorch 74.24 GiB）`。
- `-v2` 同一位置同一异常；`smoke-384k-2n16g-tp4pp2cp2` 同族但更早炸（`Tried to allocate 14.90 GiB`，对应报告引用的 `78.52 GiB in use on rank6`）。
- **判定：`gdn_v3_plugin.py:213` 是直接诱因，但不是全部。** 算一笔：`TP=4 → V/TP = 62,080`，`CP=2 → S_local = 196,608`，`[196608, 62080] BF16 = 22.72 GiB` 的 logits 必须在前向物化并**保留到反传**（因为 `output_layer.weight.requires_grad=True`）。22.72 GiB 单独不算致命，致命的是它叠在 `recompute_num_layers=1`（每个 PP stage 只重算 1/16 层，其余 15 层的激活全部留驻）之上。
- **注意一个报告没说的小事**：`-v1` 目录里连 `args.json` 都没落下（`-v2/-v3` 有），说明 `-v1` 死在参数 dump 之前，**未必是同一种死法**。报告里"连崩三次"是事实，"三次同一个原因"是推断，未被证据支持。

---

## 二、问题一：现有落盘数据到底有哪些处理手段，各自值多少

### 2.0 先钉死那个"抽屉原理"（这一步报告做对了，我不重复，但要给到最锐的版本）

真实分词账本（`Qwen3.8-27B` 实测，120 条执行段）：

| 组件 | mean | **P50** | 占比 | `loss` |
| --- | ---: | ---: | ---: | --- |
| `sys + <tools>` | 15,878 | 15,313 | 4.6% | False |
| `messages[1]` 首轮需求/前序摘要 | 4,196 | 5,255 | 1.2% | False |
| **`asst_think_train`** | 156,409 | **168,256** | **45.6%** | **True** |
| **`asst_tc_train`** | 80,602 | **87,004** | **23.5%** | **True** |
| 坏轮 think + tc（已掩码） | 3,101 | 539 | 0.9% | False |
| `tool_obs_txt`（Bash 76.6% / Read 22.2%） | 62,481 | 65,417 | 18.2% | False |
| `vis_512`（中位 39 张） | 18,144 | 17,476 | 5.3% | False |

**P50 口径下的不可压缩下界 = `168,256 + 87,004 + 15,313 + 5,255 = 275,828`。** 这已经比 `192K` 大 `43%`，比 `200K` 大 `38%`。**所以任何"不拆段"的方案在 P50 上就是不可能的，不需要再讨论。** 这一条我给满分。

### 2.1 类一：单段内无损/轻损瘦身——**能救 `16.7%`，仅此而已**

逐项算账（用上面 P50 数字）：

| 手段 | 动了什么 | P50 净省 | 风险 | 我的裁决 |
| --- | --- | ---: | --- | --- |
| `512 → 256` tok/图 | `loss=False` 旧视口图 | `17,476 × 50% ≈ 8,700`（`-2.3%`） | `3DCodeEdit` 证明多轮视觉文本诊断是 `+20 pp` 的来源；把图降到 256 会让穿模/材质判断失真 | **只在远端前缀做，活跃窗口内决不动** |
| 截断 `Bash/Read` 大输出 | `loss=False` 工具返回 | `65,417 × ~40% ≈ 26,000`（`-6.8%`） | 报错行/行号可能被截掉 → `Failure Masking` | 头尾各留 350 tok，**必须正则强制保留 `Traceback/Error/行号`** |
| 清理 `loss=False` 废轮 `<think>` | 坏轮思考 | `539`（`-0.14%`） | 无 | **收益可忽略，但该做（token 免费）** |
| 剔死胡同轮 | 全轨迹 | 账本没测 | 需要 DAG 分析，`DAG-SFT` 说能省 `48%` token 且 `+1.7 pp` | **值得做，但这是"减 token"不是"减长度"，救不了装箱** |

**三项全上（不加 DAG 剪枝）的实测结果（账本 `single_segment_diet_only_ablation`）：`P50 = 302,672`，`≤192K` 命中 `16.7%`。** 这就是"不拆段"的天花板。**结论：类一不是备选方案，是必须叠在拆段之上的"降低重复前缀成本"的辅助手段。** 报告把它列在"手段"里是对的，但没点破它真正的用途——见 2.4(c)。

### 2.2 类二：过滤与硬截断——三条全部否决，但理由要分清

| 手法 | 留存 | 为什么不行 |
| --- | ---: | --- |
| 只筛 `≤200K` | `13.4%`（`2,329/17,384`） | `compact_before` 存活 **`0/6,056`**。模型永远学不到"从空目录搭 3D 工程"，而这恰恰是 `3DCodeFactory` 最值钱的起步段。**否决。** |
| 只留前 `200K` | 100%（但都是残片） | 直接砍掉自然 `EOS`。`Qwen3.8-Next` 已点名"丢失精确 RoPE 相位 + 无收尾残片 → Endless Generation"；`3DCodeFactory` Table S8 又说后程多视角精修独占 `+11.75`。我方 9B-mix 已经踩过一次无 EOS 超时。**否决。** |
| 旧脚本 `--window-chars`（Mode B） | 100%（但变形） | 见下 |

**`--window-chars` 的四个具体坑（我读了代码，逐个点名）：**

1. **它是字符窗不是 token 窗。** 默认 `260,000` chars；`prep-report.json` 实测 `char p50 = 1,148,377` 对应 `~380K` tokens → **`~3.0 chars/token`**，即 `260K chars ≈ 87K tokens`，只有段的 `23%`。一段被切成 **`~5` 个无重叠窗**。字符→token 的 3σ 抖动有 ±30%，必然有一批窗越过 `max_length` 被 `--truncation_strategy delete` 静默吞掉。
2. **零重叠、零脊柱。** `make_record` 只把 `sys_msg + anchor_user` 塞回每个窗，中间的 `Turns 1..k` 全没了。这正是 `DAG-SFT` 实测 `-4.0 pp` 的形态（第 50 轮 `Edit(file_path="js/scene.js")` 调的是第 12 轮建的文件，中间凭空消失）。
3. **静默丢数据的两个暗门**：`if trainable_turns == 0: return None`（一个窗里若全是 `loss=False` 就整窗丢弃，无日志无计数）；`drop_masked_thinking` 默认 `True`（只要没开 `--paper-exact` 就把掩码轮思考清空）——**这是"顺手加戏"，违反 `decisions.md` "不做未验证的二次改标"。**
4. **它顺手改了消息形态**：`make_record` 把连续的 `user/tool` 合并成一条 `user`，并往正文里注入字面量 `<tool_response>...</tool_response>`。而 `chat_template.qwen38-compat.jinja` L96 判定"是不是真 query"靠的就是"最后一条 user 是否以 `<tool_response>` 开头且以 `</tool_response>` 结尾"。**当合并块是 `user + tool` 混合时这个判定会失效**，`last_query_index` 被算错，进而影响 L121 的 `preserve_thinking` 分支。这是一个真实的、会在推理端复现的隐性 bug。

**结论：Mode B 应永久封存，不要出现在任何 `--window-chars > 0` 的启动命令里。**

### 2.3 类三：`compact_task` 专项——`ct10pct` 现在这版是废的

`compact_task` 的结构：前 `~383K` 全 `loss=False`，只有末尾 `~11K` 的 `<analysis> + <summary>` 算 `loss=True`（账本：`trainable_summary_tok_p50 = 11,011`）。

| 做法 | 输入 P50 | `≤200K` 通过 | 训练价值 | 裁决 |
| --- | ---: | ---: | --- | --- |
| ① `v1-dense-ct10pct` 原样上 `200K + delete` | `394,075` | **`0.0%`（`0/468`）** | **0** | ❌ **这版数据集在 200K 下 `compact_task` 全灭**；连带 `dense` 段也只活 `2,329` 条 → **整份数据可用 `12.6%`** |
| ② `ct_diet` 三步瘦身 | **`151,072`** / P90 `174,637` | **`99.8%`（`467/468`）** | 高 | ✅ **唯一正解**，但规格要打补丁（见下） |
| ③ 按 `180K` 前缀截取 | `180K` | 100% | **0** | ❌ 两种截法都不行，见下 |

**③ 为什么行不通（报告只说了"不行"，没说为什么）：**
- **取前 `180K`**：`q_sum` 指令和整个 `<summary>` 都在 `383K` 之后，前缀截取把它们全切掉了。`prepare_3dcodefactory_swift.py` L288 `if not any(m["role"]=="assistant" and m.get("loss")): return []` → **这一行会被静默丢成空**，一条都产不出来。
- **取后 `180K`**：`<summary>` 留住了，但原始 `USER REQUEST`、`I_ref` 参考图、以及摘要里引用的所有文件创建历史全丢了。学生被要求"根据一段没有开头的记录写交接摘要" → **这就是在训练幻觉**。而且它同时违反了 `Compaction Cliff` 的 Knowledge Triage（首轮契约必须钉死）。

**`ct_diet` 必须补的一刀（报告漏了）：** 报告三步是"剥 `q_sum` 前旧 `<think>` + 截断 `>600` tok 工具日志 + 留首图与近 6 图"，**但没说 `messages[0..1]` 必须逐字钉死**。`q_sum` 之前那 `383K` 里既有垃圾也有 `USER REQUEST` 和 `I_ref`。如果不显式钉死，第一步"剥离全部历史 `assistant` 的 `<think>`"很容易顺手把首轮需求也当成历史处理掉。**规格补丁：`ct_diet` 的剥离范围是 `[2, len(q_sum)-1)`，`messages[0]`（system+tools）与 `messages[1]`（原始需求 + `I_ref`）永久白名单。**

**还有一个质量隐患报告完全没提：`ct_diet` 的监督目标是"教师看过 `156K` 旧 `<think>` 后写的摘要"，而我们把它前面的 `<think>` 剥了。** 学生在信息量更少的前缀上被要求复现同一份摘要 → 摘要里凡是"只能从被剥掉的 `<think>` 推导出来"的细节，都是在教模型编。**这不是理论风险，是可测的**：用 `RECAP` 的 NLL 检验——取摘要后真实的前 5 个动作，比较其在 `ct_diet` 前缀 vs 原 `394K` 前缀下的 NLL，若 `ΔNLL > 0.15` 就说明前缀砍过头了，把 `<think>` 剥离策略改成"只剥 >2,000 tok 的远端 think"。

### 2.4 类四：报告遗漏的处理思路（两个值得做，一个必须否决）

**(a) ❌ 在 `~180K` 切点离线合成原生 `Claude Code` 风格 `<summary>`（任务书问题 1.4）**

思路本身不蠢（`CliffCompaction` 明确"绝不递归压缩旧摘要"，每段都从原始历史重建，所以不存在 `Compaction Cliff` 的 5 级崩塌）。但算完账我否决：

- **规模**：`45,045` 子段 − `17,384` 段 = **`27,661` 个切点**需要合成。每个切点输入 `~180K` → **`5.0B` 教师输入 tokens + `~300M` 输出 tokens**。按 `DeepSeek-V4.1-Flash` 档位也要四位数美元，按前沿档位是五位数；时间是"并发 200 × 4–8 小时"级别。
- **红线**：`decisions.md` 第 61 行"不做 CoT 改写"、第 60 行"保留完整压缩闭环"。用教师重新生成摘要，产出的就不再是小红书教师的原始 CoT 了，**这是对当天拍板的正面违反**。
- **更关键的是没必要**：你手里已经有 **`11,686` 条真·教师原创的 `<summary>`**。`ct_diet` 把它们抢救到 `P50 = 151K`，成本为零、零幻觉（摘要里每个路径都真在输入前缀里）。**用真货，别合成。**
- **唯一值得留的口子**：抽 `500` 个切点做 `HCPF-Lite` vs 合成 `<summary>` 的 A/B，用 `RECAP` 的 `ΔNLL` 当裁判。这是一个 3 小时、$100 以内的可证伪实验，可以放进 Go/No-Go 的可选项。

**(b) ✅ 被完全漏掉的高价值手段：把类一的"瘦身"从"整段"挪到"活跃窗口内 `loss=False` 部分"**

报告把瘦身当"救不救得回来"的手段测了（`16.7%`，失败），就丢掉了。但它的正确用法是**在 `HCPF` 内部**：一个 `198K` 活跃窗口里 `23.5%` 是 `loss=False` 的 `tool_obs + vis`。把这部分按 2.1 的表截一遍（只动 `loss=False`，只留头尾 + 强制保留报错行 + 远端图归档），**每窗能多塞 `~12–15%` 的真监督 token**，子段数从 `45,045` 降到 `~39,000`，**整轮 token 从 `7.46B` 降到 `~6.6B`（`-11%`）→ 直接省 1.7 天**。

代价：动了观测。但**不动 `loss=True` 的任何 token，不改 CoT，不改标**——严格落在 `decisions.md` 允许范围内。**这是本次审查里性价比最高的单条建议，报告一行都没写。**

**(c) ✅ 降低前缀重复成本：`spine 24K → 12K`、`tail 12 轮 → 12 轮但封顶 32K tok`**

`HCPF` 的 `+20%` token 全是重复前缀。`PAIR` 说 `K=12` 轮能熨平边界，那是**轮数**不是**token 数**——本域一轮中位 `~5K` tokens，12 轮 `~60K`，纯属浪费。改成"至少 12 轮，最多 32K tokens"：边界保真度损失可忽略（`PAIR` 的失效集中在"紧邻切点前 1–2 个原子步"），省 `~25K/子段 × 45,045 ≈ 1.1B tokens ≈ 1.5 天`。

---

## 三、问题二：方案 A / B / C 正面硬刚

### 3.1 五维对比（每一格都有出处）

| 维度 | **A · `PM-SW@200K`** | **B · `HCPF-200K`** | **C · `HCPF-Lite`（本次裁决方案）** |
| --- | --- | --- | --- |
| **实现复杂度** | **低**：切点 + 重叠窗口，无内容改写。`~300` 行 Python | **高**：要判定"该文件是否被后续覆盖"（`MemTrace`）、要维护图/代码/命令三类折叠器、要同步裁剪 `images[]`。`~1,200` 行 + 一套边界回归测试 | **中**：`~600` 行。折叠规则只有 2 条（空 `<think>`、工具输出截断），**不含任何语义判定** |
| **远端状态连续性** | ⚠️ **断层**：`w≥1` 里首轮紧接第 36 轮，第 5–35 轮蒸发 | ✅ **零断层**：路径/命令/拓扑 100% 在场 | ✅ **零断层**（同 B），但**保留的是"真·工具返回截断"，不是占位符** |
| **孤立文件幻觉风险** | 🔴 **高**（正是 `DAG-SFT -4.0 pp` 的形态） | 🟢 低 | 🟢 低 |
| **训推一致性（Train-Test）** | 🟢 **最优**：消息分布与线上 100% 同构，代理层零改动 | 🔴 **有实体级 OOD**：`[Historical viewport render #3 archived]`、`[Code payload (N chars) written to <path>; updated in later turns]` 这类串在 `Claude Code` 线上命中率为 **0** | 🟢 **同构**：折叠后的内容 = "空 think 块" + "真·截断省略号"，两者都是线上原生形态（见 3.2.2） |
| **潜在隐形 bug** | 中（切点算子 + 重叠区间边界） | **高**：`MemTrace` 的覆盖判定（见 3.2.3）、`images[]` 与 `<image>` 占位符 1:1 对账、`preserve_thinking` 交互 | 低（无语义判定） |

### 3.2 对方案 B 三个隐患的拷问（任务书点名要答）

#### 3.2.1 训推不一致 + 会不会打死 vLLM Prefix Caching

**结论：`B` 的训练侧上下文，线上确实不存在；而"代理层同步改写"这个补救方案，会以最恶劣的方式打死 Prefix Caching。**

拆开说：

- **`Claude Code` 的真实行为**：`185K` 之前是**未折叠的完整消息**，到点一次性换成 `<summary>`。所以线上任意时刻，模型看到的要么是"全量 verbatim"，要么是"锚点 + 摘要 + 最近若干轮"。**"锚点 + 分层折叠脊柱 + 12 轮逐字"这个第三种形态，只有你的离线管线会造出来。**
- **能不能靠代理层补齐？** 能造，但代价是缓存。vLLM 的 Prefix Caching 是按 token 前缀做块级复用的：你在**历史中段**（比如第 20 轮）插入/改写内容，从那个位置往后**全部失效**。而 `HCPF` 的折叠边界是随轮次推进的——第 41 轮时折到第 29 轮，第 42 轮就折到第 30 轮。**每一轮都改写中段 → 每一轮的缓存命中点都往回退几万 token → Prefix Cache 的实际收益趋近于 0**，而长上下文 Agent 推理的成本结构里，Prefix Cache 是唯一能让 `185K` 会话跑得起的机制。
  - 退一步：除非把折叠边界**量化成固定栅格**（比如只在每 32K token 的整数倍处折），让"已折叠区"永久冻结。但那样 `B` 的"远端 `≤24K` 自适应脊柱"就退化成了"固定栅格压缩"，实现复杂度和收益预期都要重算。
- **所以 `B` 的真实定位是：一套只得靠线下代理层复刻才能兑现的训练期脚手架。** 这在工程上不是不能做，是**为了一个尚未被证明有效的结构，去抵押整个推理侧的缓存收益**。

**这也是我判 `C` 的核心：`C` 折叠后的内容——空 `<think>` 块 + 截断的工具输出——线上本来就会自然出现**（`Claude Code` 的 `Bash` 工具本身就会截断超长输出；`preserve_thinking=false` 的历史轮就是空 think）。所以 `C` 不需要代理层做任何事，**Prefix Cache 的形态与原生完全一致**。

#### 3.2.2 剥离远端 `assistant` 的 `<think>` 与 `preserve_thinking` 是否兼容？

**结论：兼容，但只有一种实现方式兼容——"把 `<think>` 内部清空"，绝不能"删掉 `<think></think>` 标签"。删标签 = 制造新 OOD。**

依据 `chat_template.qwen38-compat.jinja`：

- L121–125：`preserve_thinking is undefined or preserve_thinking is true or loop.index0 > ns.last_query_index` → 走 `<|im_start|>assistant\n<think>\n{reasoning_content}\n</think>\n\n{content}`；否则 **完全不发 `<think>` 标签**。
- 训练命令是 `--preserve_thinking true`（`launch.py` 第 241 行、`args.json` 确认），所以**所有** `assistant` 轮都会发 `<think>`。
- 又因为本管线把思考**折进 `content` 的字面量**（`prepare_3dcodefactory_swift.py` L263–269：`<think>\n{rc}\n</think>\n\n{text}`），`reasoning_content` 恒为空 → 模板会渲染出 **`<think>\n\n</think>\n\n` + 正文**。这个空 think 块与 `add_non_thinking_prefix` 的 `non_thinking_prefix='<think>\n\n</think>\n\n'`（`args.json` 里 `template_meta` 已确认）**逐字节相同**。
- 所以：**"剥离远端 `<think>`"的正确实现 = 把该轮 `content` 里的 `<think>...</think>` 替换成 `<think>\n\n</think>`**，产出的是模型在"非思考模式"下见过的合法形态。
- 反过来，如果图省事直接 `re.sub(r'<think>.*?</think>', '', ...)` 把整段删掉，渲染出来就是 `<|im_start|>assistant\n<think>\n\n</think>\n\n` **后面紧跟一个没有 think 的正文**——这在训练分布里存在，但**在"每一轮都 preserve_thinking"的本次配置下不存在**，是自造 OOD。

**还有一个连带坑**：这条规则**只对 `role="assistant"` 成立**。`tool` 消息里如果原文含 `<think>`（Blender 脚本里真会出现），已被 `escape_literal_image_tags` 式的转义逻辑保护了一半，但 `<think>` 没有对应转义。**建议在 `HCPF-Lite` 里加一条断言：折叠后整条记录中 `<think>` 的出现次数必须等于 `assistant` 消息条数**，对不上就落 `rejected.jsonl`。这是一条零成本的正确性防线。

#### 3.2.3 `MemTrace` 式"该文件是否被后续更新"判定的边界坑

只需一件事就能看出 `B` 的风险等级：**它要求你离线复刻一个 shell 解释器。** 具体坑（每一条都能让 `[Code payload ... updated in later turns]` 说谎）：

1. **非 `Write` 写文件**：`Bash` 里的 `cat << 'EOF' > scene.py`、`python3 -c "open('x','w')"`、`sed -i`、`tee`、`cp`、`mv`、`patch`、`git apply`、`bpy.ops.wm.save_mainfile`（写 `.blend`）、Playwright 截图落地。本域 `Bash` 占工具返回的 `76.6%`，**这类写法是主流不是边缘**。
2. **`Write` 的 `file_path` 常是相对路径**，而后续 `Edit` 可能给绝对路径（或反之）。要正确判定"同一文件"，必须做"以会话 cwd 为基准的路径归一化"，而 cwd 本身会被 `cd` 改。
3. **同一文件被"先 `Write` 后多次 `Edit`"**：`MemTrace` 折叠掉 `Write` 的正文，只留 `[written to X; updated in later turns]`——但模型恰恰需要知道**最后一次 `Edit` 之后的完整内容**。你把最新状态折叠掉了，等于把 `MemTrace` 的 `+21.2 pp` 反过来用。
4. **参数体里含 `</parameter>` 字面量**：`chat_template` L141–146 按 `arguments|items()` 逐参数渲染，值里出现 `</parameter>` 会破坏 XML 结构。这是**已经存在**的风险，`normalize_tool_calls` 的 `json.loads` 并不处理它。折叠逻辑只要参与"截断参数体"，就会把问题从"偶发"变成"必然"。
5. **判定的时机语义**：`Edit(old_string=...)` 意味着"当前内容包含 old_string"，是**读**不是写；把它当"更新"会误折叠。

**`C` 的规避方式很干脆：不做判定。** 统一规则——远端 `tool_call` 的参数体按 token 预算截断（保留 `name` + `file_path` + 前 `80` tok 的命令头），远端 `tool` 返回按 token 预算截断（保留头尾 + 强制保留报错行）。**不做"这个文件后来有没有变"的推理，就没有判错的空间。**

### 3.3 最终裁决：`HCPF-Lite`（方案 C）精确规格

> 一句话：**`B` 的完整性 + `A` 的无人工痕迹 + `PAIR` 的近端滑窗。把它压缩成 8 条可实现的硬规则。**

```
输入：v1-dense 一条执行段（原子步 z_i = assistant + 其全部 tool_calls + 其全部 tool_responses，绑定不可劈）
目标：max_length = 204,800；单段硬上限 BUDGET = 198,000（安全垫 6,800）
规则（全部确定性，零 LLM，零语义判定）：

R1  [不拆] 总长 ≤ 198,000 → 原样输出，0 改动。（实测 13.4%）
R2  [锚点钉死] 每个子段第 1 条 = messages[0]（system + <tools>）逐字节；
                第 2 条 = messages[1]（原始 USER REQUEST + 参考图 I_ref）。
                若是 compact_recovery 段，messages[1] 本身是前序 <summary>，原样保留，
                并在其前不再追加任何内容。loss=false。总预算 ≤ 22,000。
R3  [干净相位切点] 在累计 165K–198K 区间向前回溯，取满足以下全部条件的原子步末端：
                (a) 该步的 assistant 轮原 loss=True；
                (b) 该步全部 tool_response 不含 /Traceback|SyntaxError|ReferenceError|
                    TypeError|Error:|error:/（大小写不敏感且不在 fenced block 外……此处用原
                    文前缀匹配，不做语义判断）；
                (c) 该步不得截断一个尚未闭合的 tool_call/tool_response 对。
                —— 命不中就把 (a) 放宽，绝不跨步硬切。实测命中率 100%（1,152/1,152）。
R4  [远端脊柱 ≤ 12,000 tok] 仅作用于 z_1 .. z_{t_k-13}：
                (a) assistant 正文保留，内部 <think>…</think> → <think>\n\n</think>（空块，不删标签）；
                (b) tool_call 保留 name + file_path + 参数体前 80 tok；
                (c) tool_response 保留头 200 + 尾 200 tok，拼接处插 "… [truncated N tokens] …"
                    （与 Bash 工具原生截断同形的纯 ASCII 省略）；
                (d) 强制保留：任何含 /Traceback|Error|not found|Permission denied/ 的行，
                    以及任何形如 python/three/bpy 文件路径的 token —— 不占预算，白名单直通；
                (e) 远端 <image> 直接移除（不留占位符），同步从 images[] 删除 —— 因为
                    "一轮本来就没有图"是原生态，而 "[archived]" 不是。
R5  [近端滑窗] 紧接活跃区之前的原子步，取 max(12 轮, 32,000 tok)，100% 逐字节逐图保留
                （含真实 <think>、真实视口图、最新 Read/Write 全文），但 assistant/tool_call
                的 loss 一律强制置 False。
R6  [活跃区] z_{t_k} .. 末端，100% 逐字节、原 HF loss_mask 不动，末段保留自然 EOS。
R7  [全局不变量]（每条都进单测）
                (i)  任一 token 的 loss=True 至多出现 1 次（duplicate_supervised = 0）；
                (ii) 每条记录 '<think>' 计数 == assistant 消息条数；
                (iii) sum(content.count('<image>')) == len(images)；
                (iv) 总长 ≤ 198,000；
                (v)  messages[0].content 与源逐字节相同（sha256 对账）。
R8  [失败处理] 违反 R7 任一条 → 写 rejected.jsonl，不硬崩、不静默丢。
```

**和 `B` 的差别只有三处，但每一处都决定了线上能否兑现：**
1. 没有 `[Historical viewport render #k archived]`——远端图**直接消失**，不占位。
2. 没有 `[Code payload ... updated in later turns]` 这种 `MemTrace` 语义折叠——统一按 token 预算截断，不做"是否被覆盖"的推理。
3. 剥离 `<think>` 一律产出**空块**，不产出去掉标签的形态。

**和 `A` 的差别只有一处：`w≥1` 子段里没有"轮次断层"。**

**训推对齐的最终表述（这句话可以直接写进方案文档）：**
> 训练样本的 `w≥1` 前缀，与线上 `Claude Code` 在 `185K` 触发 `<summary>` 压缩后、经过 `logging_proxy` 会话延续时的形态，在 **token 级**属于同一族：`[system+tools 逐字] + [原始需求 + I_ref 逐字] + [一份有损的远端历史] + [最近 12 轮逐字] + [活跃区]`。
> 其中"有损的远端历史"在训练时是"截断的工具输出 + 空 think"，在推理时是真 `<summary>`。**两者都是"有损"，只是有损的方式不同**——这正是 `RECAP` 用 `ΔKL` 度量、`SelfCompact` 用元认知准则建模的那个不变量。**不需要代理层做任何改写，因此不触碰 Prefix Cache。**

---

## 四、问题三：先算清大账

### 4.1 `gdn_v3_plugin.py:213` 是不是真凶？去掉它安不安全？

**（1）是不是真凶：是直接诱因，报告的一行修法方向对，但结论下得太快。**

- `can_chunk` 的最后一个条件 `not self.output_layer.weight.requires_grad`，在 `--tuner_type full` 下恒为 `False` → 整条分块路径被绕过（`gdn_v3_plugin.py:213`）。
- 绕过之后走 `orig_postprocess` → 一次性物化 `[S_local, V/TP]`。
  - `384K + TP2 + CP4`（跑通的配置）：`98,304 × 124,160 × 2B = 24.4 GiB`
  - `384K + TP4 + CP2`（崩的配置）：`196,608 × 62,080 × 2B = 22.7 GiB`
  - 两个量级一样，**所以"TP 从 2 提到 4 就能救"是幻觉**——`V/TP` 减半被 `S` 翻倍抵掉了。这解释了为什么 `tp4pp4cp2` 反而炸了。
- 崩溃点在**反传**的 TE `general_gemm`，说明前向是把 `22.7 GiB` 硬挤进去的、然后要留到反传。这不是"再多留给前向一点"能解决的，是结构性的。

**（2）去掉它是否 100% 安全：主报告"逐比特等价"的表述错误，需要修正为"语义安全，数值近似"。**

逐个机制核：

| 机制 | 实际情况 | 判定 |
| --- | --- | --- |
| `main_grad` 分配 | `use_distributed_optimizer=True` 时，`ColumnParallelLinear` 在构造期预分配 `weight.main_grad` 缓冲，并置 `weight.grad=None`、`grad_added_to_main_grad=True` | ✅ 无 `weight.grad` 覆盖问题 |
| wgrad 累加语义 | `gradient_accumulation_fusion=True` 走 `wgrad_gemm_accum_*`，即 **`C += A @ B`，原地累加**。多次 `_forward_output_layer` 的反传会**正确累加到同一块 `main_grad`**，不覆盖 | ✅ **"覆盖 main_grad"的担心不成立** |
| `torch.utils.checkpoint(use_reentrant=False)` 重算 | 每个 chunk 的重算在各自的反传段内顺序发生，不会并发写同一 `main_grad` | ✅ 安全 |
| **数值精度** | 本次 run 开了 `use_precision_aware_optimizer=true, main_grads_dtype=bf16, accumulate_allreduce_grads_in_fp32=false`。`S=393,216 / chunk=32,768 = 12` 段。**12 次 bf16 原地累加 ≠ 1 次 fp32 累加**（bf16 尾数 8 bit，累加误差随段数线性放大，`~1e-2` 相对量级） | ⚠️ **"数学逐比特等价"错误。要用分块，必须 `main_grads_dtype=fp32`（或 `--accumulate_allreduce_grads_in_fp32 true`）** |
| `disable_grad_reduce=True` + 外层 `gather_from_sequence_parallel_region(tensor_parallel_output_grad=True)` | 逻辑上是"chunk 内抑制 dgrad 的 TP all-reduce，由外层 gather 的 reduce-scatter 统一加一次"，与不 chunk 时的 `ColumnParallelLinear(sequence_parallel=True)` 等价。但 **`disable_grad_reduce` 是构造期读取还是前向期读取，取决 TE 版本**——若在构造期缓存，`finally` 里的恢复就是空操作，结果是"多一次 TP all-reduce"（正确但慢）或"少一次"（错） | ⚠️ **必须单测：用 `num_chunks=2` 与 `num_chunks=1` 跑同一 batch，比对 `main_grad` 的相对误差应 < 1e-3（bf16）/ < 1e-6（fp32）** |
| `sequence_parallel` 属性在 chunk 内被临时置 `False` | 在 `_chunk_loss_fn` 的 `try/finally` 里正确恢复；重算时也重新进入该上下文 | ✅ |
| `compute_language_model_loss` 的 vocab-parallel all-reduce | 从 1 次变成 12 次（`vocab_parallel_cross_entropy` 的 max/sumexp 归约）。`TP=4` 走 NVLink，**代价可忽略**，但确实不是零 | ✅ |

**（3）但真正的结论是：在 `200K` 下，这条补丁的紧迫性大幅下降，可以先不碰。**

按 `lm_head` logits 峰值 = `S_local × V/TP × 2B` 列表：

| 配置 | `S_local` | `V/TP` | logits 峰值 | 实测对照 |
| --- | ---: | ---: | ---: | --- |
| `384K, TP=2, CP=4` | 98,304 | 124,160 | **24.4 GiB** | 实测 `peak_alloc = 62.24 GiB`（这条占 39%） |
| `384K, TP=4, CP=2` | 196,608 | 62,080 | **22.7 GiB** | 💥 OOM |
| **`200K, TP=2, CP=2`** | **102,400** | 124,160 | **23.7 GiB** | — |
| **`200K, TP=4, CP=2`** | **102,400** | 62,080 | **11.8 GiB** | 推荐 |
| `200K, TP=4, CP=1` | 204,800 | 62,080 | 23.7 GiB | 拓扑 2/3 的隐忧 |
| `200K, TP=2, CP=4` | 51,200 | 124,160 | 11.8 GiB | 最省，但 CP 通信最多 |

**操作建议（有先后）：**
1. **先做 `200K + TP=2, CP=2`**：`S_local` 与实测的 `98,304` 只差 `4.2%`，`24 GiB` 的 logits 尖峰照旧，**实测 `62.2 GiB` 的显存形状可以直接外推**，不赌。
2. **要上 `TP=4` 或 `VPP`，就必须先修 213 行**，否则 `V/TP` 减半没有任何收益。
3. 修 213 行时同时改 `main_grads_dtype=fp32`，并加 4.1(2) 表里那个 `num_chunks` 对账单测。**改之前先跑这个单测，再改，再跑一次——不要直接在 13 天的 run 上验证。**

### 4.2 `384K YaRN` vs `256K` vs `200K`：五维定论

**先修一个前提：报告"200K 更快"的论断是错的。** 在"每卡序列长度保持 `~100K` 不变"的前提下（这正是让显存可控的唯一办法），**每 token 的注意力二次项成本不变**，而 `200K` 因为多切了 `~1.5` 倍刀数，多出 `+20%` 的重复前缀 token。**所以 200K 反而更慢。**

| 维度 | `384K`（YaRN 1.5×） | `256K`（原生上限 `262,144`） | **`200K`（`204,800`）** |
| --- | --- | --- | --- |
| **可用的最好拓扑（32 卡）** | `TP2/PP4/CP4/DP1`（每 stage 1 机） | `TP2/PP4/CP4/DP1` 或 `TP4/PP4/CP2/DP1` | **`TP2/PP4/CP2/DP2`**（每 stage 1 机） |
| **每卡序列长度** | `98,304` | `65,536`（CP4） | **`102,400`** |
| **实测/外推显存** | **`72.54 GiB`（`91.6%`，实测）** | `~50–56 GiB`（外推） | **`~60–65 GiB`（外推，与实测同形）** |
| **1 epoch 输入 tokens** | `6.17B`（`binpack` 填充 `93%`） | `~7.0B`（切 ~2.0 刀） | **`7.46B`（`HCPF-Lite` 调优后 `~6.6B`）** |
| **`GBS=48` 步数** | `~330–360` | `~430` | **`859`（调优后 `~760`）** |
| **`tok/s/gpu`（气泡修正后）** | `~163.6` | `~170` | `~170` |
| **天 / epoch（32 卡）** | **`13.6 天`** | **`14.9 天`** | **`15.7 天`（调优后 `13.9 天`）** |
| **GDN `CP>1` 循环开销** | 高（`CP=4`，`binpack` 下退化为逐子样本 Python `all-to-all`） | 高（`CP=4`） | **中（`CP=2`，通信量减半）** |
| **RoPE 分辨率** | ❌ YaRN `1.5×`，人为压缩 1.5 倍波长，3D 视口坐标 / 代码行号分辨率受损 | ✅ 原生 | ✅ 原生 |
| **单条 1.09M 轨迹拆段数** | `3` 段（原始） | `~4.3` 子段 | **`~5.4` 子段（调优后 `~4.7`）** |
| **长跑风险（13 天维度）** | 🔴 **91.6% 占用 + 长尾 148 图 pack = 必炸** | 🟡 中 | 🟢 低 |

**定论：选 `200K`。但理由要换成这四条，不是"更快"：**
1. **91.6% 显存占用跑不完 13 天。** 只要来一个 `148` 图的 pack 就复现 `smoke-384k-57-38-fvit`。这是唯一的"一票否决"级理由。
2. **`384K` 能跑通的前提是冻死 ViT，而 `decisions.md` 第 62 行刚要求放开。** 放开 ViT 后 `PP0` 必炸。
3. **`200K < 262,144` 可以直接回退原生基座，白捡 RoPE 分辨率。**
4. **`256K` 最尴尬**：它既没能在 32 卡上保住 `DP=2`（`CP=4` 才能舒服，就回到 `DP=1`），又照样要切 `~2` 刀、照样 `~15 天`，却丢了"原生满窗"的叙事。**没有理由选它。**
5. **调优后 `200K` 与 `384K` 的墙钟基本打平（`13.9` vs `13.6` 天）**，而前者多了一份显存保险和原生 RoPE。**这才是"甜点"的正确论证。**

### 4.3 拓扑裁决：三选一里选 3，但我真正推荐的是"拓扑 0"

先摆清一个报告完全没算的排布事实——**Megatron 的并行维序是 `TP → CP → DP → PP`，所以"每个 PP stage 占几台机"由 `TP × CP × DP` 决定：**

| 拓扑 | `TP×PP×CP×DP` | 每 stage 卡数 | 每 stage 是否单机（8 卡） | 跨机流量 | 驻留层数/stage | `S_local` |
| --- | --- | ---: | :---: | --- | ---: | ---: |
| 实测跑通 `TP4·PP4·CP2`（崩）/ `TP2·PP4·CP4`（通） | `2×4×4×1=32` | 8 | ✅ 单机 | 仅 PP P2P | 16 | 98,304 |
| **拓扑 1** `TP4·PP2·CP2·DP2` | `4×2×2×2=32` | **16** | ❌ **跨 2 机** | **PP P2P + DP 梯度 all-reduce 全跨机** | **32** | 102,400 |
| **拓扑 2** `TP4·PP4·CP1·DP2` | `4×4×1×2=32` | 8 | ✅ 单机 | 仅 PP P2P | 16 | **204,800** |
| **拓扑 3** `TP4·PP4·VPP2·CP1·DP2` | `4×4×1×2=32` | 8 | ✅ 单机 | 仅 PP P2P | **8** | **204,800** |
| **拓扑 0（我的推荐）** `TP2·PP4·CP2·DP2` | `2×4×2×2=32` | 8 | ✅ 单机 | 仅 PP P2P | 16 | **102,400** |

**裁决：**

- **❌ 拓扑 1 出局**，两条硬伤：`PP=2` 让 32 层 + ViT + Aligner 同驻 `Stage 0`——这正是 `smoke-384k-57-38-fvit` 在 `77.72 GiB` 处差 `1.86 GiB` 的死法，**而且现在还要放开 ViT**；同时 `DP` all-reduce 跨机，白扔掉 IB 带宽。
- **⚠️ 拓扑 2 次选**：`CP=1` 彻底消灭 GDN 的 CP `all-to-all`（这是真收益），但 `S_local = 204,800` 是实测 `98,304` 的 **`2.08×`**，全注意力工作区翻倍还没 VPP 缓冲。**赌性太大，不作为首跑。**
- **🥈 三选一取拓扑 3**：`VPP=2` 把驻留层数从 16 砍到 8，大致抵消 `S` 翻倍，`CP=1` 拿掉全部 CP 通信。**但落地前必须先修一个真实 bug**：`_instrumented_prepare_batch(self, data, vp_stage=None)` 只在 `vp_stage in (None, 0)` 时计数——**开 VPP=2 后 `step-metrics` 的 `input_tokens` 会少算一半**，你会拿着错的 `tok/s` 做后面所有判断。而且 `VPP` 要求 `num_microbatches % (PP × VPP) == 0`：`GBS=48, DP=2 → m=24`，`24 % 8 = 0` ✅  fortunately 成立。
- **🥇 我的首选是拓扑 0：`TP=2, PP=4, CP=2, DP=2`**。理由只有一条但压倒性：**它是"刚刚跑通的那个配置"改两个参数**。
  - `CP 4→2`：`S_local` 从 `98,304` → `102,400`（**`+4.2%`**），logits 峰值 `24.4 → 23.7 GiB`（**更小**）。
  - `DP 1→2`：每 stage 仍是 8 卡 = 单机 ✅，跨机只有 PP P2P ✅，气泡从 `6.25%`（`m=48`）变成 `12.5%`（`m=24`）——**这是唯一变差的一项，代价 `~6%` 吞吐**。
  - 换来的是：CP 通信量减半、显存形状可外推、`dataloader` 有真正的 DP 并行、ViT 放开后 `PP0` 仍有 `~14 GiB` 余量。
  - **启动命令只改两个数，第一次 smoke 的可信度接近 100%。** 在"13 天一次"的量级上，这个确定性比省 3% 吞吐值钱得多。

**执行顺序：拓扑 0 跑通 → 拿它的 `tok/s` 做基线 → 再试拓扑 3 博 10–15% 吞吐。**

---

## 五、问题四：Go / No-Go 行动单（6 步，每步带验收判据）

| # | 动作 | 验收判据（不满足就停） | 预估 |
| :---: | --- | --- | --- |
| **1** | **改配置起 200K smoke**：`MAX_LEN=204800`；`TP=2, PP=4, CP=2, DP=2`；`--model ${MODEL_ROOT}/Qwen3.8-27B`（原生 262K，**关 YaRN**）；`FREEZE_VIT=false, FREEZE_ALIGNER=false`；`GBS=48`（不用 `SMOKE_GBS=8`，否则气泡污染判据）；数据先用 `v1-dense` | `step-metrics-node0.jsonl` 出现 `applied: true`；`peak_reserved_gib ≤ 68`；`dt_s ≤ 300`（对应 `tok/s/gpu ≥ 145`）；`loss` 有限、`grad_norm` 有限；**且检查 max 那条 pack 的 `images` 数 ≥ 30 时仍不 OOM** | 1 次 ≈ 10 min |
| **2** | **修 telemetry 与数值前提**：`_instrumented_prepare_batch` 的 `vp_stage` 守卫改成"所有 vp_stage 都计数"（为拓扑 3 留路，且当前 `vp_stage=None` 时行为不变，零风险）；`main_grads_dtype` 保持 `bf16` 但记一笔"未启用分块 CE" | 同一 batch 连跑 2 步，第 2 步 `input_tokens` 与第 1 步相等（现在也相等，此步主要是防回归） | 20 min |
| **3** | **跑通 `HCPF-Lite` 制备，先用 `724` 条验证段开箱**：实现第三节 `R1–R8`，只跑 `validation.swift.jsonl` | 硬指标全中：`0` 条 > 198,000；`duplicate_supervised = 0`；`'<think>' 计数 == assistant 条数` 对每条成立；`<image>` 计数 == `len(images)`；`U 保留率 = 100.0000%`；`subsegments_per_segment` 的 `4+` 桶为 `0`；`rejected.jsonl` 条数 `0`；**`≤204800` 打包后 packs 数 ≤ 1,900（对应账本 `1,719` 的 `+10%` 容差）** | 2–3 h |
| **4** | **`ct_diet` 落地 + `ΔNLL` 哨兵**：实现 2.3 的三步 + "`messages[0..1]` 白名单"补丁；对 `468` 条验证 `compact_task` 抽样 `30` 条算 `ΔNLL` | `P50 ≤ 155K`、`≤200K` 通过率 `≥ 99%`；**`ΔNLL(ct_diet ‖ raw) < 0.15`**，超过就退回"只剥 >2,000 tok 的远端 think"再测；`<summary>` 里出现的每个文件路径都能在输入前缀中 `grep` 到（幻觉率 `0/N`） | 3 h |
| **5** | **全量制备 + 时间盒训练**：`HCPF-Lite` 跑全量 `17,384` + `2,500` 条 `ct_diet`；**但第一轮只训 `30–40%` 分层子集（按 `task_group` 哈希，`~6,000` 段 / `~2.2B` tokens）**，`GBS=48`，1 epoch | 训前：`packs` 与 `steps` 落在账本外推 `±10%`；训中：每 `50` 步落一次 `step-metrics`，`tok/s/gpu ≥ 145` 稳定、`loss` 单调下降、`peak_reserved` 不爬升；训后：产出 checkpoint 并在 devtest 上与基座做配对评测，**`Accepted@1` 三项（3D 动画 / 3D 打印 / 2D 动画）不得低于基座** | **`~5 天`** |
| **6** | **裁决是否上全量 13 天**：看第 5 步的 checkpoint 曲线外推 | 子集 checkpoint 在 3D 动画轨 `Accepted@1` 相对基座涨幅 `≥ +8 pp` 且三轨无退化 → 上全量；否则**先查数据配比与 `ct_diet` 比例，不烧 13 天** | 决策点 |

**第 5 步的时间盒是整个清单里唯一真正的"Go / No-Go"**：`13–16 天/epoch` 是硬约束，不是调参能解决的。32 张 H800 上跑 `6.2B` tokens 的 `27B` 全参 SFT，`~14 天` 是物理。**先花 5 天买一个可评测的 checkpoint，比花 14 天赌一个没验过 pipeline 的 run 理性得多。**

---

## 六、我不同意主报告的五处（逐条留档）

| # | 报告原文 | 我的实测/推算 | 影响 |
| :---: | --- | --- | --- |
| 1 | "`HCPF` 仅比 384K 多 `+12.3%`（`+94` 步）" | `384K` 真实基线 `~330–360` 步（不是 `765`）；`HCPF` `859` 步 = **`+139%`** | 步数叙事失效，但**改用 token/墙钟口径后结论不变**（`+20%` 体积，`+15%` 墙钟） |
| 2 | "`200K` 是吞吐甜点" | 等 `S_local` 前提下 `200K` 因多切刀数 **慢 `~15%`**；快不起来 | **结论不变（仍选 200K），但理由必须换成显存余量 + 原生 RoPE + 能开 ViT** |
| 3 | "分块 CE 在反传时**数学逐比特等价**" | `main_grad +=` 语义正确，但 `main_grads_dtype=bf16` + `12` 段累加 **不是逐比特等价** | 要用分块，必须同时 `main_grads_dtype=fp32` 并加 `num_chunks` 单测 |
| 4 | "`ct_diet` 三步" | 漏了"`messages[0..1]` 必须白名单" | 不补这一刀，首轮需求会被当成"历史 think"顺手剥掉 |
| 5 | 隐式假设"数据照单全收" | **`13–16 天/epoch` 从未被计算** | 这是唯一会改变项目节奏的数字，必须补 |

---

## 七、一句话收尾

这批数据的处理，难点从来不是"怎么把 `384K` 塞进 `200K`"——那是 `2.6` 倍拆段加一份确定性前缀就能解决的工程题；**难点是"拆完之后，第 36 轮的模型还能不能像在 `384K` 里那样，知道第 12 轮那个 `scene.js` 的 `camera.position` 被改过三次、最后停在哪个值"**。

`方案 A` 用"多给 60K 逐字窗口"回答它，`方案 B` 用"造一条折叠脊柱"回答它，`方案 C` 用"少删一点、别造假、边界留足 12 轮"回答它。

**选 `C`。然后花 5 天而不是 14 天去证明它对。**
