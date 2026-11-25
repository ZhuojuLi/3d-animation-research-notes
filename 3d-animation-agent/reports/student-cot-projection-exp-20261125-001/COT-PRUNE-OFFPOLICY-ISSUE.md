# 问题记录：Round 2 DeepSeek CoT 二次压缩引入 `<think>` 槽位文风错位与 off-policy 分布偏移

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

- **记录日期**：2026-11-25
- **影响范围**：Round 2 数据提纯脚本 `scripts/prune_oneshot_cot.py`、`scripts/prune_react_cot.py` 及其生成的 `oneshot-pruned.native-swift.jsonl` / `react-pruned.native-swift.jsonl`
- **基座对照模型**：`${MODEL_ROOT}/Qwen3.8-27B`（BF16，vLLM 容器 `qwen38-proj-exp-gpu6`，`reasoning_effort="medium"`，`preserve_thinking=True`，与官方 `chat_template.jinja` 逐字符 100% 一致）
- **原始证据文件**：baseline-nll-audit.json（本地附件未发布） · audit_student_nll.py（本地附件未发布） · student_project_cot.py（本地附件未发布）
- **理论对照**：[arXiv:2610.02140 精读（Finetuning with Sampling）](../../../research/arxiv-2610.02140/README.md)

---

## 一、核心现象（27B Base 实测硬数据）

对 Round 2 Canary 全部 18 条轨迹（5 条 One-Shot + 4 条 ReAct，各自原始版 vs DeepSeek 压缩版）使用真实 `Qwen3.8-27B-BF16` 计算精确 token 级负对数似然（NLL，$-\log p_{\text{27B}}(x_t \mid x_{<t})$）：

| Canary 批次 | 样本数 | 思考 tok | **`think_nll`** | **`think_gt5`（NLL>5 极端尾巴）** | `code/tool_nll` | `code/tool_gt5` |
|---|---:|---:|---:|---:|---:|---:|
| `oneshot_raw`（DeepSeek 原始思考） | 5（3 思考 + 2 空思考） | 164,452 | **0.7002** | **1.60%** | **0.2202** | **0.42%** |
| **`oneshot_ds_pruned`（DeepSeek 压缩后）** | 5 | 24,640 | **1.0490（+49.8% 恶化）** | **3.86%（飙升 2.41×）** | 0.2589（+17.6%） | 0.54% |
| `react_raw`（DeepSeek 原始多轮思考） | 4 | 200,705 | **1.1815** | **3.84%** | **0.1629** | **0.34%** |
| **`react_ds_pruned`（DeepSeek 压缩后）** | 4 | 91,184 | **1.3283（+12.4% 恶化）** | **4.76%（+24.0% 飙升）** | 0.1895（+16.3%） | 0.47% |

### 逐条细查的关键佐证

1. **DeepSeek 代码与工具调用本身高度贴合 27B 分布**：
   - `code/tool_nll` 仅 `0.14–0.29`（`NLL > 5` 占比仅 `0.10%–0.62%`）；
   - **跨家族蒸馏的 off-policy 冲击几乎全部集中在 `<think>` 槽位**（NLL 是代码与工具调用的 **5×–8×**）。
2. **即便未压缩的短 ReAct `<think>` 也有高 off-policy 间隙**：
   - `r2-micrometer-healthy`（`c72a5528`，0 轮触发压缩，全部 25 轮为 DeepSeek 原始短思考，共 10,187 tok）的 `think_nll` 高达 **`1.3169`**（`p50=0.7124`、`gt5=4.28%`），说明跨家族教师（DeepSeek `1017`）与学生（Qwen3.8-27B）在 `<think>` 表达风格上本来就有明显分布偏移。
3. **One-Shot 原始超长 `<think>` 低 NLL 的真实原因**：
   - 例如 `ef2e816e`（`os-art-celadon-vase`）原始 `<think>` 长达 56,743 tok，其中 `p50=0.0528` 且后续 15,304 tok HTML 的 `action_nll` 低至 `0.0658`——因为 DeepSeek 在超长 `<think>` 里逐行预演了近乎完整的 HTML 代码，后续 `content` 几乎等价于抄写；而 2 条无思考样本（`7a93cc4e`、`8095a44e`）的 `action_nll` 为 `0.2785–0.2931`。

---

## 二、根因拆解（源码 + 文本双证据）

### 1. 槽位与文风错位（主因）
- 实查 `scripts/prune_oneshot_cot.py:186-229` 与 `scripts/prune_react_cot.py:199-243`：压缩脚本调用 DeepSeek 时传了 `"reasoning_effort": "low"`（DeepSeek 先在内部思考 ~500 tok），然后取出的是 DeepSeek 的**正式回答正文 `msg["content"]`**，直接塞回训练样本的 `<think>...</think>` 槽位。
- `msg["content"]` 默认带有正式技术方案书的 Markdown 排版（`# 一级标题`、`## 二级标题`、斜体修辞、审阅报告句式），与 `Qwen3.8-27B` 在 `<think>...</think>` 内期望的自然口语化内心独白严重错位：
  - **原始 `<think>`**：`Let me create a complete standalone HTML file with a procedural Three.js scene of a five-story East Asian pagoda at twilight. Key elements: - Carved stone courtyard...`
  - **压缩后塞入 `<think>` 的 `content`**：`# Five-Story Timber Pagoda — Diorama Build Plan\n\n## 1. Art direction and overall composition\n\nI want this to read as a *museum vitrine piece*, not a game asset...`

### 2. 去冗余压缩的伴生信息密度上升
- 将 55K 原始思考压至 6K–9K（删去约 85% 的重复碎碎念与逐行代码预演）本身是训练所必需的（防止被 `swift-preprocess` 超长阈值丢弃及长废话稀释权重），但删除大量低熵重复 token 后，剩余高信息密度决策的平均每 token 熵自然上升，且缺少代码预演也会使 `code_nll` 温和上浮（`0.2202 → 0.2589`，仍明显优于无思考的 `0.28–0.29`）。

### 3. 风险界定：内容质量 vs 学生可学习性
- **内容信息质量未受损**：架构、PBR 贴图、几何尺寸、动画公式和离线自检要点保留完整，且非思考代码/工具字段经 SHA-256 校验 100% 逐字节不变；
- **但对 27B 的可学习性（off-policy 风险）明显恶化**：按 `arXiv:2610.02140` 结论，`<think>` 的高 NLL 和 2.4× 飙升的 `>5` 极端尾巴会在 SFT 中放大梯度冲击、加剧通用能力遗忘与 EOS/格式偏移风险。

---

## 三、归属核查：Aodi 数据是否存在同类问题？

实查 `${REFERENCE_DATA}/code2video/training/data/` 确认：**Aodi 的两套数据均不存在该问题，本次问题由 Round 2 新增的 DeepSeek 二次压缩脚本引入**：

| 数据集路径 | 是否存在该问题 | 实查依据 |
|---|---|---|
| `threejs-mixed-swift-answer-only-v1/train.jsonl`（Round 2 池 3 底座来源） | **不存在** | 纯 answer-only，0 `<think>`，仅含最终 HTML 代码 |
| `threejs-mixed-swift-thinking-v1/train.jsonl`（Aodi 思考版） | **不存在** | 首条实查为原生自然思考独白（`<think>\nWe need respond likely with HTML code. Need interpret request. Need create standalone stylized scene...`），超长样本由 `build_ready_to_train.py` 整条丢弃，未做“摘要成 Markdown 报告再塞回 `<think>`”的二次重写 |

---

## 四、改进方向与验证计划

1. **正在 GPU6 实测的验证方案（`scripts/student_project_cot.py`）**：
   - 保持 DeepSeek 产出的可执行 HTML 代码与工具调用 **100% 逐字节不变**；
   - 将 `<think>` 压缩/重写改为由 **学生基座 `Qwen3.8-27B-BF16` 自己**在原生 `<think>` 槽位下进行特权引导采样（`arXiv:2610.02140` 轻量化投影采样），生成 $M=4$ 候选 + 无参考基座似然优选（兼顾 `think_nll` 与 `code/tool_nll`）+ 可选段落级贪心 MCMC；
   - 完整实测对比结果将在本目录 `REPORT.md` 补齐（含 GPU6 释放凭据）。
2. **若继续保留 DeepSeek 压缩作为低成本备选时的最低限度修补**：
   - 严禁在 `prune_oneshot_cot.py` / `prune_react_cot.py` 输出中使用 Markdown 标题（`#`、`##`）、斜体/报告腔，改为口语化、连贯的第一人称内心独白风格，并放量前统一跑一次 `scripts/audit_student_nll.py` 把关 `think_nll` 与 `think_gt5` 尾巴。
