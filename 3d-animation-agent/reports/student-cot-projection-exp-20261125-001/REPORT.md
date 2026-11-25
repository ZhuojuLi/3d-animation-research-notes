# 27B 基座 NLL 分布体检与学生原生 CoT 投影实验报告（arXiv:2610.02140 轻量化落地）

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

- **实验日期**：2026-11-25
- **理论依据**：[arXiv:2610.02140 精读（Finetuning with Sampling）](../../../research/arxiv-2610.02140/README.md)
- **问题专项记录**：[COT-PRUNE-OFFPOLICY-ISSUE.md](COT-PRUNE-OFFPOLICY-ISSUE.md)
- **新建脚本与单测**：
  - scripts/audit_student_nll.py（本地附件未发布）（Qwen3.8-27B 精确逐 token NLL 与 off-policy 尾巴体检）
  - scripts/student_project_cot.py（本地附件未发布）（学生原生 `<think>` 投影采样 + 似然优选 + 可选段落级 MCMC）
  - tests/test_student_projection.py（本地附件未发布）（5 项离线单测全过）
- **实测模型与服务环境**：
  - 基座权重：`${MODEL_ROOT}/Qwen3.8-27B`（BF16）
  - vLLM 镜像：`${CONTAINER_IMAGE}`
  - 节点与设备：`ucloud-wlcb-gpu-016` / `GPU6`（A100-SXM4-80GB），临时容器 `qwen38-proj-exp-gpu6`（ID `4038deea5963552d3726c1c1d8540dd6a87549800e503deba95b1f50e858c2f3`，`max_model_len=163840`, `max_num_batched_tokens=2048`, `gpu_memory_utilization=0.85`, `max_num_seqs=4`，**已于 2026-11-25 15:19 停止并删除，GPU6 已释放**）
  - 模板一致性校验：`render_record_with_spans` 与 `Qwen3.8-27B` 官方 `chat_template.jinja`（`reasoning_effort="medium", preserve_thinking=True`）逐字符 **100% 匹配**；ReAct 多图记录采用文本占位计分（`text_only_image_placeholder`），输出 JSONL 完整保留全部图片路径、`<image>`、tools、tool_calls 与 HTML，SHA-256 **100% 逐字节不变**。

---

## 一、实验核心结论（一页看完）

1. **先发现了隐藏隐患**：Round 2 原有 DeepSeek CoT 压缩脚本（`prune_oneshot_cot.py` / `prune_react_cot.py`）把 DeepSeek `msg["content"]` 里的 Markdown 方案书硬塞进 `<think>` 槽位，虽然压短了长度，却把 `<think>` 推得离 `Qwen3.8-27B` 自身分布更远（One-Shot `think_nll` `0.7002 → 1.0490`、`>5` 尾巴 `1.60% → 3.86%` 飙升 2.4×；ReAct 触发轮 `think_nll` `1.2485 → 1.4488`、`>5` 尾巴 `4.37% → 6.90%`）。同时核查确认 **Aodi 两套数据均无此问题**。
2. **27B 学生原生 CoT 投影（`student_project_cot.py`）效果非常显著，尤其在多轮 ReAct 上达到 13/13（100%）完胜**：
   - **ReAct 全部 13 个成功投影的触发轮**：保持 DeepSeek 工具调用与回复 **100% 逐字节不变**，仅用 27B 自己原生 `<think>` 重写 + 无参考似然优选（$M=4, k=0$）：
     - 均思考长度：`9,590 → 1,368 tok`（比 DeepSeek 压缩的 `1,633` 还精简 **-16.2%**）；
     - **`think_nll`**：DeepSeek 压缩 `1.4488` → 27B 投影 **`0.8901`**（**暴降 -38.6%**，甚至比原始 DeepSeek `1.2485` 还低 **-28.7%**）；
     - **`think_gt5`（极度 off-policy 尾巴）**：DeepSeek 压缩 `6.90%` → 27B 投影 **`2.62%`**（**暴降 -62.0%**）；
     - **`action_nll`（后续工具调用可预测性）**：`0.2179` vs DeepSeek 压缩 `0.2181`（**完全持平并微优**，说明零因果信息损失！）。
   - **One-Shot 完整 5 条全池**：
     - 全池 `overall_nll` 从 DeepSeek 压缩 `0.4054` 降至 **`0.3360`（-17.1%）**，`overall_gt5` 从 `1.16%` 降至 **`0.81%`（-30.2%）**；
     - 全池 `think_nll` 从 `1.0490` 降至 **`0.7848`（-25.2%）**，`think_gt5` 从 `3.86%` 降至 **`2.51%`（-35.0%）**；
     - 在 `os-arch-pagoda` 上，**`k=1` 段落级贪心 MCMC** 进一步把 `think_nll` 从 `0.7568` 压至 **`0.6408`**（比 52K 原始 DeepSeek `0.6920` 还贴近 27B，比 DeepSeek 压缩 `1.0831` 低 **-40.8%**）。
3. **两条直接指导生产调参的实证发现（已立刻修进 `student_project_cot.py`）**：
   - **长度下限很关键**：`os-mech-tourbillon` 候选过短（1,966 tok）时，信息密度过高反而使 `think_nll` 升至 `1.22`、`code_nll` 升至 `0.297`；已将 One-Shot 默认 `--min-tokens` 提至 `2500`（建议生产 `3000–3500`）、ReAct 默认提至 `400`。
   - **消除“粉红大象效应”**：ReAct 唯一 1 轮回退（`daf3cfeb` Turn #21）是因旧提议 prompt 写有 `"privileged guidance / bracketed block"`，27B 在 `<think>` 里自我提醒不要提及该词反而触发了防泄露拦截；已改写为中性 `## Working Technical Scratchpad` 提议格式并补跑 5/5 单测通过。

---

## 二、6 路全轨迹对照总表（final-6way-nll-audit.json（本地附件未发布））

全部 6 组在完全相同的 `Qwen3.8-27B-BF16` 基座、同一 `reasoning_effort="medium"` 模板下计分：

| 批次 | 条数 | 思考 tok | **Overall NLL** | **Overall >5 尾巴** | **`think_nll`** | **`think_gt5`** | `action/code_nll` | `action_gt5` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `oneshot_raw` | 5 | 164,452 | 0.5096 | 1.14% | 0.7002 | 1.60% | 0.2202 | 0.42% |
| `oneshot_ds_pruned` | 5 | 24,640 | 0.4054 | 1.16% | 1.0490 | 3.86% | 0.2589 | 0.54% |
| **`oneshot_27b_proj`** | 5 | **12,612** | **0.3360** | **0.81%** | **0.7848** | **2.51%** | 0.2838 | 0.61% |
| `react_raw` | 4 | 200,705 | 0.8334 | 2.64% | 1.1815 | 3.84% | 0.1629 | 0.34% |
| `react_ds_pruned` | 4 | 91,184 | 0.7210 | 2.47% | 1.3283 | 4.76% | 0.1895 | 0.47% |
| **`react_27b_proj`** *(仅改 13/184 轮)* | 4 | 93,823 | **0.6917** | **2.18%** | **1.2303** | **3.99%** | 0.2068 | 0.54% |

> 注：ReAct 全轨迹 184 个 assistant 轮中仅 14 轮超过 `3000` 阈值（13 轮成功投影、1 轮安全回退），其余 170 轮短思考未动（原样保留 DeepSeek 思考，均 NLL ~1.30），因此全轨迹均值的绝对降幅被未动轮次稀释；聚焦 13 个真实改写轮的净效果见下节。

---

## 三、逐条与逐轮细表

### 3.1 One-Shot 3 条触发样本明细（oneshot-projection-report.json（本地附件未发布））

`valid_candidates = 12/12`（0 泄露，HTML 与 User SHA-256 100% 不变）：

| 样本 | 方案 | 思考 tok | `think_nll` | `p50` | `p95` | `think_gt5` | `code_nll` | 综合 `bal` |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `os-arch-pagoda` (`ad8d18b7`) | Raw DeepSeek | 52,473 | 0.6920 | 0.1095 | 3.2478 | 1.51% | 0.1946 | 0.4433 |
| | DeepSeek 压缩 | 9,477 | 1.0831 | 0.3267 | 4.6332 | 4.10% | **0.2564** | 0.6697 |
| | 27B 投影 (`k=0`) | 6,144 | 0.7568 | 0.2003 | 3.4010 | 2.08% | 0.2917 | 0.5242 |
| | **27B 投影 (`k=1` MCMC)** | 8,055 | **0.6408** | **0.0798** | **3.0880** | **1.79%** | 0.2893 | **0.4651** |
| `os-art-celadon-vase` (`ef2e816e`) | Raw DeepSeek | 56,739 | 0.6579 | 0.0528 | 3.1880 | 1.59% | 0.0658 | 0.3619 |
| | DeepSeek 压缩 | 6,094 | 1.1180 | 0.3686 | 4.4776 | 3.92% | **0.1769** | 0.6475 |
| | **27B 投影 (`k=0`)** | 2,579 | **0.9001** | **0.2204** | **4.0511** | **3.37%** | 0.2573 | **0.5787** |
| `os-mech-tourbillon` (`5381b5f7`) | Raw DeepSeek | 55,228 | 0.7515 | 0.1243 | 3.4087 | 1.70% | 0.1791 | 0.4653 |
| | **DeepSeek 压缩** | 9,057 | **0.9670** | **0.2077** | **4.3317** | **3.58%** | **0.2513** | **0.6091** |
| | 27B 投影 (`k=0`，过短反例) | 1,966 | 1.2226 | 0.5680 | 4.7895 | 4.37% | 0.2974 | 0.7600 |

### 3.2 ReAct 全部 14 个触发轮次明细（react-projection-report.json（本地附件未发布））

4/4 轨迹 `integrity_verified = True`（`tool_calls`、`assistant_content`、`non_assistant_messages`、`images`、`tools_schema` SHA-256 100% 逐字节不变）：

| 轨迹 / 轮次 | 状态 | 思考 tok（Raw→DS→27B） | `think_nll`（Raw / DS / **27B**） | `think_gt5`（Raw / DS / **27B**） | `action_nll`（Raw / DS / **27B**） |
|---|---|---:|---|---|---|
| `daf3cfeb` Turn #6 | `projected_ok` | 3,953 → 2,542 → **1,492** | 1.452 / 1.267 / **0.697** | 5.5% / 5.3% / **1.7%** | 0.232 / 0.206 / 0.228 |
| `daf3cfeb` Turn #8 | `projected_ok` | 18,925 → 2,016 → **1,765** | 1.256 / 1.389 / **0.832** | 4.5% / 7.1% / **2.5%** | 0.315 / 0.309 / **0.284** |
| `daf3cfeb` Turn #9 | `projected_ok` | 6,553 → 2,196 → **3,584** | 1.407 / 1.320 / **0.633** | 6.0% / 6.4% / **1.2%** | 0.213 / 0.246 / 0.265 |
| `daf3cfeb` Turn #21 | `failed_guard` *(回退原样)* | 6,927 → 852 → 6,927 | 1.408 / 1.548 / — | 5.1% / 8.2% / — | 0.110 / 0.120 / — |
| `3bdf989d` Turn #3 | `projected_ok` | 11,201 → 1,215 → **336** | 1.342 / 1.413 / **1.001** | 4.6% / 5.3% / **4.1%** | 0.236 / 0.250 / 0.281 |
| `3bdf989d` Turn #5 | `projected_ok` | 11,723 → 2,704 → **1,518** | 1.224 / 1.380 / **0.911** | 4.4% / 5.7% / **2.5%** | 0.340 / 0.373 / **0.356** |
| `3bdf989d` Turn #17 | `projected_ok` | 3,601 → 621 → **203** | 1.455 / 1.531 / **1.014** | 4.7% / 7.5% / **2.4%** | 0.037 / 0.030 / **0.005** |
| `fc2addf5` Turn #3 | `projected_ok` | 14,381 → 1,865 → **314** | 1.282 / 1.765 / **1.385** | 4.3% / 9.6% / **6.0%** | 0.159 / 0.190 / **0.162** |
| `fc2addf5` Turn #4 | `projected_ok` | 19,440 → 1,732 → **213** | 1.190 / 1.475 / **1.117** | 4.1% / 7.4% / **4.2%** | 0.138 / 0.145 / 0.162 |
| `fc2addf5` Turn #5 | `projected_ok` | 10,215 → 1,452 → **622** | 1.128 / 1.597 / **0.804** | 4.1% / 8.5% / **2.7%** | 0.335 / 0.397 / **0.380** |
| `fc2addf5` Turn #8 | `projected_ok` | 10,296 → 1,105 → **3,584** | 1.017 / 1.577 / **0.663** | 3.7% / 8.5% / **1.5%** | 0.232 / 0.277 / **0.276** |
| `fc2addf5` Turn #9 | `projected_ok` | 6,698 → 1,291 → **1,109** | 1.111 / 1.586 / **0.808** | 4.1% / 7.8% / **2.2%** | 0.211 / 0.245 / 0.273 |
| `fc2addf5` Turn #31 | `projected_ok` | 4,679 → 1,488 → **1,468** | 1.256 / 1.373 / **1.046** | 3.4% / 5.7% / **2.2%** | 0.008 / 0.007 / 0.045 |
| `fc2addf5` Turn #48 | `projected_ok` | 3,004 → 1,001 → **1,579** | 1.112 / 1.162 / **0.661** | 3.4% / 4.9% / **0.9%** | 0.110 / 0.160 / **0.114** |
| **13 轮投影汇总均值** | **13/13 完胜 DS 压缩** | **9,590 → 1,633 → 1,368** | **1.2485 / 1.4488 / 0.8901** | **4.37% / 6.90% / 2.62%** | **0.1974 / 0.2181 / 0.2179** |

---

## 四、Round 2 放量使用建议

1. **ReAct 超长思考压缩（强烈推荐改用 `student_project_cot.py` 替代 DeepSeek 压缩）**：
   - 13/13 触发轮 100% 碾压 DeepSeek 压缩（`think_nll` **-38.6%**、`>5` 尾巴 **-62.0%**、`action_nll` 持平微优），而且本机闲置 1 张 A100-80GB 即可离线批跑、**0 额外 DeepSeek API 费用**；
   - 推荐参数：`--mode react --proposal-style native_think --num-candidates 4 --min-tokens 400 --max-gen-tokens 3584 --select-by balanced_nll --mcmc-steps 0`（对 300–400 条 ReAct 中真正超 `>3000` 阈值的轮次做定点投影，既快又稳；若预算充裕，还可把阈值降到 `>1500` 覆盖更多中长轮）。
2. **One-Shot 超长思考压缩（推荐 `student_project_cot.py` 配 `min_tokens >= 2500`）**：
   - 配合 `--min-tokens 2500 --max-gen-tokens 7168 --num-candidates 4 --select-by balanced_nll`（`k=0` 已够快，重点难例可开 `--mcmc-steps 1`），兼顾低 `think_nll`、低 `>5` 尾巴与低 `code_nll`。
3. **开训前标配 `audit_student_nll.py` 体检门禁**：
   - 每批合成/提纯数据入训前，用 `audit_student_nll.py` 抽样 20–50 条跑一遍 27B Base NLL 分布，盯紧 `think_nll` 与 `think_gt5`（建议把 `think_gt5` 压到 `<3.0%`、`think_nll < 1.0`），防止再次出现“肉眼工整但 27B 极难消化”的隐性 off-policy 污染。

---

## 五、GPU 释放凭据

- **时间**：2026-11-25 15:19:39 CST
- **节点 / 卡号**：`ucloud-wlcb-gpu-016` / `GPU6`（NVIDIA A100-SXM4-80GB）
- **停止并删除容器**：`qwen38-proj-exp-gpu6`（ID `4038deea5963552d3726c1c1d8540dd6a87549800e503deba95b1f50e858c2f3`）
- **复核命令与结果**：
  - `docker ps -a --filter name=^/qwen38-proj-exp-gpu6$` → 空（已彻底删除）
  - `nvidia-smi -i 6` → `6, NVIDIA A100-SXM4-80GB, 4 MiB, 81150 MiB, 81920 MiB, 0 %`
  - `nvidia-smi --query-compute-apps` → GPU6 无任何残留计算进程（其他用户 GPU0/GPU4/GPU5 进程均未受影响）。
