# 主调研 × Claude Opus 5.5 联合审查收敛结论：`HCPF-Lite`（方案 C）与 4 机落地定案

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> **审定日期**：2026-11-27  
> **Opus 5.5 独立审查路由核验**：经专用 `claude-phanthy.sh`（`${LOCAL_ADAPTER}`）执行，`session_id = b38e2274-3b6b-43b5-a77d-c952905fa1b0`，`is_error = false`，服务端实报 `modelUsage = claude-opus-5-5`（32 轮工具实查，输出 401 行审查报告）。  
> **阅读入口**：[Opus 5.5 独立审查原文](opus-review.md) · [主调研初版报告（保留原件对照）](README.md) · [2026 H2 文献精读](2026h2-compaction-literature-deep-dive.md) · [实测分词账本](empirical_audit_200k_ledger.json)

---

## 一、双方完全一致的四大铁律（零分歧共识）

1. **必须放弃 `384K YaRN` 硬跑，果断切至 `200K`（`max_length = 204,800`）+ 原生 `262K` 基座**：
   - 刚刚跑出的 4 机 32 卡 `smoke32-c2-tp2pp4cp4` 实测证明：即使在 **冻死 `freeze_vit: true`（违反当天 `decisions.md` 放开视觉的要求）** 且退到 `CP=4, DP=1` 下，显存仍高达 **`72.54 GiB`（`91.6%` 占用）**——13 天长跑中只要遇到一个长尾多图包（最高 `148` 图）必在 `PP0` 炸穿；而 `tp4pp4cp2` 放开 ViT 已连崩三次（`78.55 GiB` OOM）。
   - 切到 `200K` 后天然小于 `Qwen3.8-27B` 原生 `262,144` 上限，**直接关掉 `YaRN 1.5×` 回退原生基座**，同时满足 `freeze_vit=false, freeze_aligner=false` 与充裕显存安全垫。
2. **抽屉原理锁死“单段瘦身不拆段”不可行，过滤/硬截断/旧脚本 `--window-chars` 全部否决**：
   - 可训 `<think>`（P50 `168.3K`）+ `tool_call`（P50 `87.0K`）+ 首轮锚点（`20.6K`）的不可压缩下界达 **`275.8K > 200K`**；单段激进删工具输出与旧图仅能救活 **`16.7%`**。
   - 只筛 `≤200K` 会 `100%` 杀光 `compact_before`（`0 / 6,056` 存活）；旧脚本 `--window-chars` 是无重叠字符窗、静默吞数据且合并 `user+tool` 破坏 `last_query_index`，永久封存；离线调教师在 `27,661` 个切点重写合成 `<summary>` 既贵（`5B` 输入 token）又违反“不改写教师 CoT”红线，同样否决。
3. **现成 `v1-dense-ct10pct` 直接上 `200K + delete` 会导致 `compact_task` 存活率为 `0%`，必须做 `ct_diet` 瘦身**：
   - 原长 P50 = `394K` 的 `1,112` 条 `compact_task` 在 `200K` 下会被 `100%` 静默丢弃；`ct_diet` 将其压至 P50 = `151K`（`99.8% ≤ 200K`）是零成本保留 9 节摘要交接能力的唯一正解。

---

## 二、Opus 5.5 抓出的 5 处关键纠偏与工程漏洞（主调研核实采信）

| 编号 | 主调研初稿盲点 / 偏差 | Opus 5.5 源码与算术纠偏（已复核确认） | 最终采信修正 |
| :---: | --- | --- | --- |
| **1** | 方案 B（`HCPF-200K`）自造 `[Historical viewport render #k archived]` 与 `MemTrace` `[Code payload ... updated in later turns]` 占位符 | ① 这两类字符串在 `Claude Code` 线上出现概率为 **`0%`（实体级 OOD）**；若靠线上代理层每轮改写中段补齐，会**逐轮打穿 vLLM Prefix Caching**！<br>② 本数据 `76.6%` 是 `Bash`（`cat << EOF > file`、`python -c`、`cd` 改相对路径），离线推断“文件是否被后续覆盖”必然误判说谎！ | **砍掉自定义归档文案与语义覆盖推断，收敛为方案 C（`HCPF-Lite`）**：远端旧视口图直接移除不留假文本，远端工具调用/返回统一按确定性预算截断！ |
| **2** | 远端历史轮剥离 `<think>` 写法未限定标签保留 | 在 `--preserve_thinking true` + `qwen3_8` 模板下，彻底删掉 `<think></think>` 标签会偏离 `ASSISTANT_TURN_RE`；**替换为空块 `<think>\n\n</think>`** 才与模板 `non_thinking_prefix` 逐字节一致且被 `ignore_empty_think` 原生兼容！ | 强制把远端 `<think>...</think>` 替换为 `<think>\n\n</think>`，并加单测断言：`count('<think>') == assistant 轮数`。 |
| **3** | `ct_diet` 未显式锁定 `messages[0..1]` 白名单，且未测剥离 `<think>` 后的摘要信息缺口 | ① 剥离范围必须严格限定在 `[2, len(msgs)-2)`，永久保护 `messages[0..1]`（含 `USER REQUEST` 与 `I_ref`）；<br>② 抽 30 条验证集做 `RECAP` `ΔNLL` 哨兵检验，若 `ΔNLL > 0.15` 则退回“仅剥离 `>2,000` tok 的超长远端 `<think>`”。 | 全盘采纳进 `ct_diet` 规格与门禁第 4 步。 |
| **4** | 将 `200K` 的 `859` 步与原论文未打包 `765` 步直接比较，误称“仅慢 12%” | 打包后 `GBS=48` 在 `384K` 每步吃 `~17.5M` tok（仅 `~352` 步），在 `200K` 每步吃 `~8.7M` tok（`859` 步）；**按真实总输入 Token 算，`200K` 因重叠前缀比 `384K` 多 `+20%`（`7.46B` vs `6.17B`），32 卡全量 1 epoch 均需 `~13.6–15.7 天`！** | 修正算力预期：选 `200K` 的真理由是**显存余量 + 放开 ViT + 原生 RoPE**；同时对活跃窗内 `loss=False` 超长观测做轻截断 + `spine ≤12K / tail ≤32K`，把总 Token 压回 `~6.6B`（`~13.9` 天），并**先跑 `30%–40%` 分层子集（`~5 天`）验点**！ |
| **5** | 推荐拓扑 A（`TP4·PP2·CP2·DP2`）与“分块 CE 逐比特等价”表述过满 | ① `TP4·PP2·CP2·DP2` 每 stage 占 16 卡（跨 2 机导致 DP 跨机）且 `PP0` 驻留 32 层 + 放开的 ViT 极易重演 OOM；**`TP=2, PP=4, CP=2, DP=2`（拓扑 0）每 stage 恰好单机 8 卡、16 层、`S_local=102,400` 与刚跑通的 `98,304` 仅差 `4.2%`**！<br>② `main_grad +=` 语义安全，但仅在 `main_grads_dtype=fp32` 下数值等价（`PREC_AWARE=true` 的 BF16 12 段累加有舍入误差）；且开 `VPP=2` 前须修 `gdn_v3_plugin.py` 的 `vp_stage` 漏计一半 Token bug。 | 首选 **`TP=2, PP=4, CP=2, DP=2`（拓扑 0）** 零赌性首跑；若后续测 `TP=4, PP=4, VPP=2, CP=1, DP=2`，先修 `vp_stage` 统计并保持 `PREC_AWARE=false`（FP32 `main_grad`）。 |

---

## 三、双方案对比后的终极拍板规格：`HCPF-Lite`（方案 C，`R1–R8`）

| 对比项 | 方案 A：`PM-SW@200K`（纯重叠滑窗） | 方案 B：`HCPF-200K`（初稿四层折叠） | **🏆 终审胜出方案 C：`HCPF-Lite + ct_diet`** |
| --- | --- | --- | --- |
| **核心做法** | 首轮锚点 + `60K` 逐字滑窗 + 活跃区 | 首轮锚点 + `24K` 自定义占位符脊柱 + `12` 轮滑窗 + 活跃区 | **首轮锚点 + `≤12K` 纯原生截断脊柱 + `max(12轮, ≤32K)` 滑窗 + 活跃区（`loss=False` 超长输出轻截）** |
| **跨百轮文件连续性** | ❌ 第 5–35 轮凭空蒸发（`DAG-SFT -4.0 pp` 断层） | ✅ 完整保留 | **✅ 完整保留（文件名、命令头、报错行白名单 100% 在场）** |
| **自造 OOD 字符串** | 0 | ❌ 有 `[archived]` / `[updated in later turns]` | **✅ 0（仅用空 `<think>\n\n</think>` + 标准 `... [truncated N tokens] ...`，远端图直接移除）** |
| **线上代理改动 & Prefix Cache** | 零改动 / 满血缓存 | ❌ 需代理同步折叠，打穿 Prefix Cache | **✅ 零代理改写、100% 保护 vLLM Prefix Cache（仅设 `185K` 自动压缩水位）** |
| **代码量与隐形 Bug 率** | `~300` 行 / 低 | `~1,200` 行 / 高（Shell 写文件推断易错） | **`~500` 行纯确定性规则 / 极低（附 `R7` 5 条硬单测不变量）** |
| **全集总 Token 与 32 卡墙钟** | `~7.5B`（`~15.8 天`） | `~7.46B`（`~15.7 天`） | **`~6.6B`（全量 `~13.9 天`；首轮 `35%` 分层里程碑仅需 `~5 天`！）** |
