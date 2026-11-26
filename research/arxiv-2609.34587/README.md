# 论文精读：Reinforcement Learning from Intermediate Renders for Image-to-Code Generation（IR4RL, arXiv:2609.34587v1）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*Reinforcement Learning from Intermediate Renders for Image-to-Code Generation*（简称 **IR4RL**）
- **作者与机构**：Omri Kaduri*, Kate Feingold*（Weizmann Institute of Science）, Phillip Isola（MIT）, Tali Dekel（Weizmann Institute of Science）
- **发布时间与链接**：2026-09-28 · 原文：`https://arxiv.org/abs/2609.34587v1` · 项目页：`https://ir4rl.github.io`
- **本地存档**：[paper.html（上游原文）](https://arxiv.org/abs/2609.34587) · [paper.txt（上游原文）](https://arxiv.org/abs/2609.34587) · `sources.json`（本地校验清单未发布）
- **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者亲踩的初始大坑

在 `Image-to-SVG`、`Image-to-TikZ` 等声明式图形代码生成任务中，现有渲染强化学习（如 RLRF、VinciCoder）普遍只对最终完整程序渲染图计算单一终态标量奖励 $R(y, x) = S(\mathcal{R}(y), x)$。作者通过轨迹级可视化拆解（Fig. 2）揭示了 **Outcome-Only GRPO 的三大信用分配大坑**：

1. **好坏操作同锅连坐（Credit Assignment 失灵）**：
   - 在标准 GRPO（§3 Eq. 1–2）中，整条序列的所有 token $t \in [1, T_i]$ 共享同一个序列级优势 $A_i^{\mathrm{Outcome}}$。
   - 如 Fig. 2 Rollout 3 所示，模型前半段代码已精准还原主体轮廓，后半段生成的错误图元却遮挡、扭曲了已有正确结构；终态低分会将前半段正确绘画命令一并惩罚，反之终态尚可时又会纵容中间混入的破坏性或无用废代码。
2. **隐蔽冗余图元与代码膨胀无法根除**：
   - `OmniSVG-4B` SFT 基座在 `MMSVGBench`（Illustrations / Icons）上平均生成 **`11.3k / 8.4k` tokens**；即便加上终态渲染 GRPO（`+ Outcome`），代码长度仍高达 **`5.7k / 3.6k` tokens**，且 Illustrations 像素误差 `MSE` 几乎原地踏步（`5.11 -> 5.08`，Table 1）。
   - 原因在于：被上层图元完全遮盖、或视觉净贡献为零的废命令不会改变终态渲染图，终态奖励对其完全失明。
3. **无折扣全局传播或过粗切分反而劣化（§5.3 Fig. 6b–c 消融踩坑）**：
   - 若将中间进度奖励无衰减（$\lambda = 1.0$）广播给所有前序 token，局部定位信号被全局平均冲淡，性能显著低于局部指数衰减（$\lambda = 0.9$）；
   - 若降低中间渲染频率（每 $N > 1$ 条命令才渲染一次），测试集奖励随 $N$ 增大单调下滑，$N=1$（每条原语结束必渲染）严格最优。

> **范围核实说明（事实边界）**：本文实验严格聚焦于具备“增量图元持久性（generated elements persist as the program evolves）”的两个任务——**`Image-to-SVG`** 与 **`Image-to-TikZ`**；对于 Lottie 矢量动画、HTML 界面与 3D/CAD 场景程序，作者在 §1 与 §6 中将其列为满足“可执行前缀渲染”性质的自然扩展方向，未在本文直接跑实验。

---

## 2. 方法论、精确数学公式与工程细节（含 Appendix 超参/阈值/证明要点）

### 2.1 最小绘画命令切分与前缀语法闭合算子 $\mathcal{C}$（§4.1, App. A.2 & B.2）
设生成程序 token 序列为 $y = (y_1, \dots, y_T)$，在**每一条完整绘画原语结束位置**放置切分边界 $0 = b_0 < b_1 < \dots < b_M = T$（默认最优粒度 $N=1$）：
- **语法闭合算子 $\mathcal{C}$**：直接截断的前缀 $y_{1:b_j}$ 因外层容器未闭合而无法直接编译，需施加任务专属闭合算子 $P_j = \mathcal{C}(y_{1:b_j})$ 将其补全为合法可执行程序：
  - **SVG 闭合机制（App. A.2, Fig. A.2a）**：`OmniSVG` 的专用分词器从不输出外层 `<svg>...</svg>` 或 `<path d="...">` 容器包装，仅输出路径命令与坐标/颜色参数。因此可在每条路径子命令（`move / line / curve / arc / close`）完成后放置边界 $b_j$（实测**占全部生成 token 的约 `15%`**）；任意未完结路径前缀均可以默认黑色闭合回起点，并由 $\mathcal{C}$ 包裹标准容器模板生成合法 SVG $P_j$。
  - **TikZ 闭合机制（App. B.2, Fig. A.2b）**：在每条以分号 `;` 结尾的绘图原语（如 `\draw ...;`、`\fill ...;`）后放置边界 $b_j$（实测**占全部 token 的约 `5%`**）。因标准子词分词器在截断点可能留下未闭合的花括号组 `{...}`、方括号选项 `[...]` 及 `\begin{env}...\end{env}` 环境，$\mathcal{C}$ 动态追踪未闭合定界符栈并按**由内向外（innermost-first）**顺序补齐闭合语法，产出可编译 LaTeX/TikZ 文件。

```text
# Appendix A.2 & B.2 语法闭合算子 C(y_{1:b_j}) 示意：
[SVG 截断前缀]  M 12 40 L 80 40 C 95 40 95 60 80 60          --> 补默认黑填充 + 外层 <svg><path d="... Z" fill="#000"/></svg>
[TikZ 截断前缀] \begin{tikzpicture}\begin{scope}[shift={(1,0)}]\draw (0,0)--(1,1);  --> 栈逆序补齐 \end{scope}\end{tikzpicture}
```

### 2.2 边际渲染进度奖励 $\Delta_j$ 与任务专属视觉打分函数（§4.1 Eq. 3–4, App. A.3 & B.3）
对第 $j$ 个闭合前缀渲染并计算与目标参考图 $x$ 的视觉相似度：
$$
F_j = S\bigl(\mathcal{R}(P_j), x\bigr), \qquad \Delta_j = F_j - F_{j-1} \quad (j = 1, \dots, M) \tag{Eq. 3–4}
$$
其中 $F_0$ 为空白画布得分，$F_M = R(y, x)$ 为完整程序终态得分。
- **防遮挡/防内部废件刷分原理**：$\Delta_j$ 剥离了前序段落 $1 \dots j-1$ 已建立的功劳，孤立度量第 $j$ 段新增代码 $y_{b_{j-1}:b_j}$ 的**边际视觉净贡献**。
  - 若新增原语改善视觉对齐，则 $\Delta_j > 0$ 获得即时正激励；
  - 若新增原语错误遮挡或扭曲已有正确图形，则 $\Delta_j < 0$ 当场受罚；
  - 若在底层或不可见区域堆叠无用废图元，则 $\Delta_j = 0$ 无正梯度。因此无需显式长度惩罚，模型自动将 SVG 长度从 `11.3k` 砍至 `2.5k`（缩短 `4.5×`）。
- **精确视觉相似度函数 $S \in [-1, 1]$**：
  - **SVG 尺度不变归一化 L2（App. A.3 Eq. A.1）**：对输入图与预测渲染图分别做像素 z-score 标准化 $I^{\mathrm{norm}}$（空白画布或语法损坏渲染直接赋 $-1$）：
    $$
    S_{\mathrm{SVG}} = \operatorname{clip}\!\left(1 - \frac{1}{N}\bigl\|I_{\mathrm{in}}^{\mathrm{norm}} - I_{\mathrm{pred}}^{\mathrm{norm}}\bigr\|_2^2,\; -1,\; 1\right) \tag{Eq. A.1}
    $$
  - **TikZ Patch-EMD Self-Sim（App. B.3 Eq. B.1）**：提取 `DeTikZify-v2` 微调 `SigLIP` 的 patch 特征 $f_{\mathrm{in}}, f_{\mathrm{pred}}$，按余弦距离代价求推土机距离（Earth Mover's Distance）$d_{\mathrm{EMD}}$（编译失败或空白赋 $-1$）：
    $$
    S_{\mathrm{TikZ}} = 2\tanh\!\bigl(-d_{\mathrm{EMD}}(f_{\mathrm{in}}, f_{\mathrm{pred}})\bigr) + 1 \in [-1, 1] \tag{Eq. B.1}
    $$

### 2.3 反向指数衰减传播与过程+终态联合优化目标（§4.2–4.3 Eq. 5–6）
1. **Token 级反向距离衰减传播（Eq. 5）**：对任意 token $t$，令其未来渲染边界集合为 $\mathcal{F}(t) = \{j \mid b_j \ge t\}$，token 距离为 $d(t, j) = b_j - t$，定义聚合过程优势：
   $$
   A_{i,t}^{\mathrm{Process}} = \sum_{j \in \mathcal{F}(t)} \lambda^{d(t, j)} \Delta_{i,j}, \qquad \lambda \in [0, 1] \tag{Eq. 5}
   $$
   最优 **$\lambda = 0.9$**（Fig. 6b）：既保持对当前绘画原语 token 的高局部归因，又允许“先画底板短暂微降分（$\Delta_j < 0$）、紧接数个 token 内叠加上层图形大幅提分（$\Delta_{j+1} \gg 0$）”的合法跨步构造获得正向补偿。
2. **过程与终态互补合成（Eq. 6）**：若仅有 $A^{\mathrm{Process}}$，模型每画对几笔就提前输出 `EOS` 停机也能保证每步 $\Delta_j > 0$，但终态残缺不全。故结合组归一化终态优势 $A_i^{\mathrm{Outcome}} = \frac{R_i - \mu_R}{\sigma_R + \varepsilon}$：
   $$
   A_{i,t} = A_i^{\mathrm{Outcome}} + \alpha A_{i,t}^{\mathrm{Process}}, \qquad \text{默认最优 }\alpha = 10 \text{（Fig. 6a，}\alpha>10\text{ 饱和）} \tag{Eq. 6}
   $$
3. **无裁剪 On-Policy GRPO 损失（§3 Eq. 2）**：严格单步 on-policy 更新（不使用 PPO clipping，且实测 $\beta = 0$ 无 KL 惩罚最优）：
   $$
   \mathcal{L}(\theta) = -\mathbb{E}\!\left[\frac{1}{G}\sum_{i=1}^G \frac{1}{T_i}\sum_{t=1}^{T_i} A_{i,t} \log \pi_\theta(y_{i,t} \mid x, y_{i,<t})\right] + \beta \mathcal{L}_{\mathrm{KL}}(\theta) \tag{Eq. 2}
   $$

---

## 3. 实验口径、完整超参数表与核心消融数据（事实）

### 3.1 完整训练超参数对照表（App. A.3–A.6 & B.3–B.5）

| 配置项 | Image-to-SVG（`OmniSVG-4B` / `8B`） | Image-to-TikZ（`DeTikZify-v2-8B`） |
|---|---|---|
| **微调架构** | LLM Q/K/V/O + MLP gate/up/down 挂 LoRA（$r=64, \alpha=128$, drop $0.05$） | LLM Decoder 挂同规格 LoRA（$r=64, \alpha=128$），冻结 SigLIP 编码器 |
| **学习率 & KL** | `4B`: `5e-5`；`8B`: `3.5e-5`（按 $\mu$P $0.7\times$ 缩放）；**$\beta = 0$** | `1e-5`；**$\beta = 0$** |
| **采样与批大小** | $G=16$，每步 $8$ 张唯一图 = **`128` rollouts/step**，`temp = 1.1` | $G=32$，每步 $4$ 张唯一图 = **`128` rollouts/step**，`temp = 1.1` |
| **过程超参** | $\alpha = 10,\; \lambda = 0.9,\; N = 1$（边界占 ~15% token） | $\alpha = 10,\; \lambda = 0.9,\; N = 1$（边界占 ~5% token） |
| **数据规模与算力** | `svg-stack` **仅 `700` 条样本**，**`300` 步**（单卡 B200 训 2 天） | `DaTikZ-v3` 约 `25k` 样本，**`900` 步**（单卡 B200 训 6 天） |
| **RAFT 对照基线** | 15 轮迭代 × 每图采 32 条取最高分 × 训 2 epochs SFT | 40 轮迭代 × 700 子集每图采 32 条取最高分 × 训 2 epochs SFT |

### 3.2 `MMSVGBench` 主表、数据量/模型规模消融与人工评测（Table 1, 2, A.1 & A.2）

| 模型 / 变体 | Illust DINO↑ | Illust LPIPS↓ | Illust MSE↓ | Illust SSIM↑ | Illust Tok↓ | Icons DINO↑ | Icons LPIPS↓ | Icons MSE↓ | Icons Tok↓ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `DiffVG` / `LIVE`（逐图优化参考） | 92.03 / 94.55 | 9.23 / 10.02 | 0.35 / 0.72 | 94.10 / 95.48 | 79.6k / 8.4k | 90.97 / 94.24 | 9.24 / 9.18 | 0.44 / 0.86 | 79.5k / 8.4k |
| `Gemini 3 Flash` / `Sonnet 5` / `GPT-5.2` | 96.66 / 95.95 / 94.71 | 18.63 / 25.70 / 28.97 | 2.96 / 4.40 / 5.30 | 90.63 / 88.64 / 87.41 | 2.6k / 0.7k / 1.7k | 96.92 / 96.58 / 94.96 | 20.14 / 26.01 / 29.83 | 4.39 / 6.09 / 7.82 | 3.5k / 0.5k / 1.5k |
| `StarVector-8B` / `InternSVG-8B` | 85.22 / 91.31 | 25.04 / 19.18 | 5.18 / 3.45 | 89.41 / 91.09 | 2.5k / 3.7k | 88.66 / 92.42 | 25.08 / 17.57 | 6.98 / 4.46 | 2.2k / 2.3k |
| `OmniSVG-4B`（SFT 基座） | 85.48 | 22.26 | 5.11 | 89.70 | 11.3k | 89.21 | 19.82 | 5.80 | 8.4k |
| `OmniSVG-4B + RAFT` | 92.20 | 17.56 | 4.60 | 89.32 | 4.8k | 96.55 | 12.21 | 2.57 | 3.3k |
| `OmniSVG-4B + Outcome RL` | 92.85 | 16.89 | 5.08 | 88.97 | 5.7k | 95.68 | 13.04 | 4.12 | 3.6k |
| `OmniSVG-4B + Process Only` | 95.89 | 12.28 | 2.27 | 92.68 | 3.5k | 97.35 | 11.27 | 2.20 | 2.8k |
| **`OmniSVG-4B + IR4RL`（700 样本）** | **97.48** | **9.79** | **1.17** | **94.22** | **2.5k** | **98.26** | **8.67** | **1.23** | **2.1k** |
| `OmniSVG-4B + IR4RL`（10k 样本, Tab. A.1） | 97.26 | 10.11 | 1.27 | 94.11 | 2.2k | 98.49 | 8.42 | 1.20 | 1.9k |
| `OmniSVG-8B + IR4RL`（Tab. A.2） | 97.34 | 9.56 | 1.20 | 94.32 | 3.0k | 98.38 | 8.47 | 1.12 | 2.3k |

- **人工 Prolific 双盲 2AFC 胜率（Table 2，50 题 × 6 人 = 1,500 票，人机一致率 88%）**：`IR4RL` 对 `Gemini 3 Flash` 人类胜率 **`60.6%`**（VLM 评 `54.0%`），对 `InternSVG-8B` **`76.3%`**，对 `Outcome RL` **`74.0%`**，对 `RAFT` **`74.9%`**，对 `SFT` **`92.7%`**。

### 3.3 `DaTikZ-v3` 主表与奖励组份消融（Table 3 & Table B.1）

| 模型 / 变体 | DreamSim ↑ | SigLIP ↑ | CLIP ↑ | LPIPS ↓ | KID ↓ | C-BLEU ↑ | TED ↓ | Tokens ↓ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `Gemini 3 Flash` / `GPT-5.2` | 91.0 / 84.9 | 96.1 / 93.8 | 94.3 / 91.4 | 27.2 / 35.7 | -0.05 / 0.41 | 6.6 / 4.4 | 51.7 / 54.0 | 2.4k / 1.5k |
| `VinciCoder-8B` / `DeTikZify-v2.5`（开源 GRPO） | 82.6 / 83.6 | 92.5 / 92.2 | 90.6 / 91.0 | 38.3 / 34.8 | 0.77 / 0.72 | 7.4 / 4.6 | 55.1 / 52.9 | 1.1k / 0.8k |
| `DeTikZify-v2`（SFT 基座） | 80.3 | 90.0 | 88.9 | 38.3 | 0.72 | 7.0 | 55.7 | 1.3k |
| `DeTikZify-v2 + Outcome RL` | 83.9 | 92.1 | 90.9 | 34.3 | 0.45 | 7.4 | 53.3 | 1.0k |
| **`DeTikZify-v2 + IR4RL (Ours)`** | **86.9** | **94.0** | **92.8** | **32.8** | **0.20** | 3.1 | 53.9 | **0.6k** |
| *[30% 进度消融 Tab. B.1]* `Outcome` / `Process` / `Ours` | 80.9 / 81.1 / **83.8** | 90.6 / 91.3 / **92.5** | 89.3 / 90.2 / **91.2** | 37.8 / 37.3 / **35.4** | — | 12.9 / 11.9 / **14.4** | 57.3 / 56.8 / **55.5** | 1.3k / **0.7k** / 1.0k |

- **Test-Time Scaling 规律（Fig. 7 & App. A.1 Fig. A.1）**：跨 3 个测试集与 4 档温度 $T \in \{0.3, 0.7, 1.0, 1.3\}$，`IR4RL` 在 $K=1$（小预算）下领先幅度最大，随 $K \to 32$ 差距收窄，说明密集过程 RL 本质上是将基座原本稀有的高质量轨迹概率密度大幅前移。

---

## 4. 对我们 Qwen3.8-27B 三轨项目（特别是 Track 3 cad_inspect.py 与 Track 2 SVG/Canvas）的落地启发（推论）

1. **直接赋能 Track 3 `cad_inspect.py`：用“增量模块/特征布尔差分 $\Delta_j$”彻底封死“大外壳包内部废件”刷分**：
   - 在复杂单件多特征链（`.union() / .cut() / .fillet()`）或多模块装配（`parts/*.py -> assembly.py`）中，若只看终态外表面点云或外部 4 视角图，模型极易在壳体内部塞入不可见的悬空废块或零贡献布尔操作。
   - 借鉴 IR4RL 的闭合前缀 $P_j = \mathcal{C}(y_{1:b_j})$，我们可在 `cad_inspect.py` 中按 AST 语句块或子零件逐一求值，计算边际三维收益 $\Delta_j = \operatorname{VoxelIoU}(M_j, M_{\mathrm{gt}}) - \operatorname{VoxelIoU}(M_{j-1}, M_{\mathrm{gt}})$（无真值装配题则计算边际包络/孔轴探针满足度增益减去新增两两布尔干涉体积 $-\Delta V_{\mathrm{intersect}, j}$）。任何被外壳完全吞没、净几何增益 $\Delta_j \le 0$ 或引发内部干涉的子模块都会在对应代码段直接吃到零或负过程优势。
2. **直接赋能 Track 2 SVG/Canvas 多图层动效：按 `<g>` 图层或渲染子函数做语法闭合中间快照**：
   - 我们的 Track 2 工程（`src/{scene,motion,renderer}.js + assets/*.svg`）天然具备图层堆叠结构。在后训练 RL 中无需逐 token 渲染，只需以每个 `<g id="layer_k">` 或 Canvas 图层绘制函数为切分点做闭合快照（配合 $\lambda = 0.9$ 局部衰减与 $\alpha = 10$ 权重），即可精准惩罚画歪或遮挡主体的坏图层，并将冗余绘制代码自然压缩 `3×–4×`。
3. **`700` 样本饱和定律支撑“少而精”高难造数**：每条轨迹蕴含数十次密集环境增量反馈时，`700` 题与 `10,000` 题效果持平，直接验证我们每轨精选 `150–300` 条高难题深挖细粒度监督的极高性价比。
