# 论文精读：RefineSVG: Visual Feedback-Driven Reinforcement Learning for Image-to-SVG Generation（arXiv:2607.27699v1, ACM MM '26）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*RefineSVG: Visual Feedback-Driven Reinforcement Learning for Image-to-SVG Generation*
- **作者与机构**：Shaobo Liu*, Feiqiao Mao, Shuaishuai Zhou, Weiqi Tan, Zhiqiong Lu, Zhengping Liang（深圳大学 Shenzhen University）, Yan Zhan（北京大学 Peking University）
- **发表会议与链接**：ACM Multimedia 2026（MM '26）· 原文：`https://arxiv.org/abs/2607.27699v1` · 代码：`https://github.com/liuxiaobo66/RefineSVG`
- **本地存档**：[paper.html（上游原文）](https://arxiv.org/abs/2607.27699) · [paper.txt（上游原文）](https://arxiv.org/abs/2607.27699) · `sources.json`（本地校验清单未发布）
- **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者亲踩的初始大坑

现有 MLLM（如 StarVector、OmniSVG、InternSVG）在 `Image-to-SVG` 任务上采用“看一眼输入图、单次前向盲写数千个 SVG token”的开环推理范式，在复杂插画与多层嵌套图标上必然出现**几何坐标漂移（Geometric Drift）、遮挡层级误差累积（Error Accumulation）与视觉幻觉（Visual Hallucination）**（§1 Fig. 1）。作者在构建闭环“生成 $\to$ 渲染对比 $\to$ 局部修正”Agent 时亲踩了四个工程大坑：

1. **大坑一：自然语言 BPE 切碎浮点坐标，导致单轮 SFT 代码膨胀至 `8.9k` tokens 且 `MSE` 倒退（§3.1 & Table 1）**：
   - 原生 BPE 将 `<path` 与连续坐标拆成无几何意义的碎片，`Qwen2.5-VL-7B + SVG-SFT` 单轮平均吐出 **`8.91k` tokens**，单图推理慢达 **`100s`**，且 `MSE` 甚至比未微调基座更差（`0.3477 -> 0.4121`），上下文窗口被迅速撑爆，根本塞不下多轮视觉反馈。
2. **大坑二：冷启动造数不做“带通过滤 + 拓扑对齐”，模型会学成“无视残差推倒重写”（§3.3 Stage 2）**：
   - 用 Stage 1 模型生成初稿构造 `(初稿 + 残差图 -> 真值 SVG)` 修复对时，若混入极低分崩溃初稿，初稿与真值图元毫无对应关系，监督信号会退化为**全盘推倒重写（Wholesale Rewriting）**；若混入近乎满分的初稿，则缺乏有效纠错信号。
3. **大坑三：跳过 ReAct 冷启动直接跑 RL，小模型直接崩盘 `-0.098 DINO`（§4.3 Table 2 `w/o Cold-Start`）**：
   - 预训练语料中不存在“读残差热力图改矢量代码”的对齐分布；直接从 Stage 1 跳到闭环 GRPO，3B 模型 `DINO` 从 `0.8872` 暴跌至 **`0.7894`（`-0.0978`）**、长度膨胀至 `806` tokens；7B 模型同样下跌 `-0.0321`（`0.9207 -> 0.8886`）。
4. **大坑四：开环 RL 天花板随模型增大越发受限，且只喂渲染图不喂 `Diff-Map` 会损失大模型精修精度（Table 2）**：
   - 不带推理期视觉反馈的开环 `Direct RL`（类似 RLRF）在 7B 上落后完整闭环 **`-0.0409 DINO`**（3B 落后 `-0.0152`，模型越大开环损失越重！）；而去掉 `Diff-Map` 仅喂原渲染图，7B 的 `DINO` 跌幅（`-0.0185`）是 3B（`-0.0087`）的两倍以上。此外，RL 探索初期（Fig. 4 下图）策略会堆叠冗余图元骗分，必须靠平滑代码效率奖励压制。

---

## 2. 方法论、精确数学公式与工程细节（含 Appendix 超参/阈值/证明要点）

> **文献打包核实说明**：arXiv HTML 正文完整给出了全部核心数学方程与 Stage 1–3 训练/奖励超参（§3.1–§4.1），但文末第 1758 行注明 `Diff-Map` 融合常数 $(\alpha,\beta,\gamma,p)$ 的具体取值与 Stage 2 带通过滤的精确 CLIP 上下界数值列于外部 `supplementary.pdf`（未随 HTML 打包）。以下严格记录正文全部已核实精确公式、结构与超参。

### 2.1 725 个 SVG 语义专用原子词表与先验均值初始化（§3.1 & Fig. 3）
在 `Qwen2.5-VL` 分词器上扩充 **`725` 个 SVG 专用 token**（仅更新 LLM 参数，视觉编码器与 Projector 全程冻结）：
1. **结构原语（`112` 个）**：原子化标签（`<svg`, `<path`, `<rect`, `<circle` 等）、属性键（`d="`, `fill="` 等）、路径命令（`M, L, C, Z`）与闭合定界符（`/>`, `</svg>`）；
2. **$256 \times 256$ 画布双 token 量化坐标（`357` 个）**：拆为整数 token（`0`–`256`，共 `257` 个）与两位小数 token（`.00`–`.99`，共 `100` 个），任意浮点坐标（如 `128.75`）精确编码为 **2 个语义完整 token**；
3. **256 色混合调色板（`256` 个）**：从灰度与 HSL 空间系统采样 `128` 基础色 + 训练集全量 hex 色值聚类中心的 `128` 高频色；
4. **语义先验嵌入初始化**：每个新增 token 的词向量初始化为其简短自然语言描述在原分词器下子词嵌入的均值。
- **全分位长度压缩逾 52%（Fig. 3，基于 `1.55M` 样本统计）**：均值 **`1977 -> 933`（压缩 `52.8%`）**，中位数 P50 `1248 -> 594`（`-52.4%`），复杂长尾 P90 `4426 -> 2129`（`-51.9%`）。

### 2.2 `YCbCr` 空间三通道显式视觉残差图 `Diff-Map` 精确计算（§3.2 Eq. 1）
首轮生成草稿 $S_{\mathrm{init}}$ 经 `CairoSVG` 光栅化为预览图 $I_{\mathrm{pred}}$ 后，将 $I_{\mathrm{pred}}$ 与目标图 $I_{\mathrm{tgt}}$ 转换至 **`YCbCr` 颜色空间**，提取三路感知残差：
- **亮度差 $\Delta L$**：`Y` 通道亮度绝对偏差；
- **色度距离 $\Delta C$**：由 `Cb`、`Cr` 双色度通道计算的色彩距离；
- **结构梯度差 $\Delta G$**：对 `Y` 亮度通道计算梯度幅值后的边缘/轮廓差异。

各通道独立经鲁棒分位数归一化算子 $\mathcal{N}(\cdot)$ 缩放后，按幂律非线性融合生成残差强度图（Eq. 1）：
$$
S_{\mathrm{diff}} = \bigl(\alpha \cdot \mathcal{N}(\Delta L) + \beta \cdot \mathcal{N}(\Delta C) + \gamma \cdot \mathcal{N}(\Delta G)\bigr)^p, \qquad \alpha < \beta < \gamma,\;\; 0 < p < 1 \tag{Eq. 1}
$$
- **设计精髓**：严格约束 $\alpha < \beta < \gamma$ 使热力图优先高亮**边缘几何形变（$\Delta G$）与填色错误（$\Delta C$）**而非次要亮度起伏；幂指数 $p < 1$ 起非线性动态范围压缩作用，平滑弱噪声过渡同时保留显著误差峰值。随后将 $S_{\mathrm{diff}}$ 转为伪彩热力图 $D$，拼成三联图 $I_{\mathrm{triplet}} = [I_{\mathrm{tgt}} \oplus I_{\mathrm{pred}} \oplus D]$ 触发 ReAct 修正（若检测无实质残差则原样返回草稿优雅退出）。

### 2.3 带通防重写冷启动 + 端到端 Agentic GRPO 与余弦效率奖励（§3.3–3.4 Eq. 2–8）
1. **Stage 2 拒绝采样双重门禁（`20K` 修复轨迹，Eq. 3）**：
   - **Band-Pass CLIP 过滤**：筛除高相似度近完美草稿（无学习信号）与低相似度严重崩坏草稿（防止学成推倒重写）；
   - **图元拓扑兼容过滤**：强制保留草稿与真值 SVG 具备匹配的元素拓扑结构，确保监督信号严格对应局部修订。
   - 构造完整单轮闭环序列并对环境 token 严格掩码：
     $$
     X = \bigl[\underbrace{I_{\mathrm{tgt}},\, P_{\mathrm{init}}}_{\text{mask}=0},\; \underbrace{S_{\mathrm{init}}}_{\text{loss}=1},\; \underbrace{T_{\mathrm{call}},\, I_{\mathrm{triplet}},\, P_{\mathrm{react}}}_{\text{mask}=0},\; \underbrace{S_{\mathrm{correct}}^*}_{\text{loss}=1}\bigr] \tag{Eq. 3}
     $$
2. **Stage 3 端到端无 KL Agentic GRPO（Eq. 4）**：在 `35K` 复杂样本池（`>700` tokens）上采样 $G=8$ 条完整两步轨迹 $\{o_i\}_{i=1}^G$（策略梯度仅作用于 $S_{\mathrm{init}}^{(i)}, S_{\mathrm{correct}}^{(i)}$；遵循 DAPO 结论**完全去掉 KL 正则 $\beta=0$**）：
   $$
   \mathcal{J}(\theta) = \mathbb{E}_{q, \{o_i\}}\!\left[\frac{1}{G}\sum_{i=1}^G \min\bigl(\rho_i \hat{A}_i,\; \operatorname{clip}(\rho_i, 1-\epsilon, 1+\epsilon)\hat{A}_i\bigr)\right] \tag{Eq. 4}
   $$
   对终稿 $S_{\mathrm{correct}}^{(i)}$ 渲染图计算多维结果奖励：
   - **指数衰减像素结构项（Eq. 5）**：
     $$
     R_{\mathrm{struct}} = \exp\bigl(-\kappa \cdot \mathrm{MSE}(I_{\mathrm{pred}}, I_{\mathrm{tgt}})\bigr), \qquad \kappa = 3.0 \tag{Eq. 5}
     $$
   - **DINOv2 硬截断语义感知项（Eq. 6）**：
     $$
     R_{\mathrm{sem}} = s \cdot \mathbb{I}[s \ge \tau], \qquad s = \cos\bigl(f_{\mathrm{DINOv2}}(I_{\mathrm{pred}}), f_{\mathrm{DINOv2}}(I_{\mathrm{tgt}})\bigr), \quad \tau = 0.3 \tag{Eq. 6}
     $$
   - **平滑余弦代码效率奖励（Eq. 7）**：设预测与真值长度比为 $r = N_{\mathrm{pred}} / N_{\mathrm{tgt}}$，免罚容忍比 **$r_{\mathrm{tol}} = 1.5$**，归零上限比 **$r_{\mathrm{max}} = 3.0$**：
     $$
     R_{\mathrm{eff}} = \frac{1}{2}\!\left(1 + \cos\!\left(\pi \cdot \operatorname{clamp}\!\left(\frac{r - r_{\mathrm{tol}}}{r_{\mathrm{max}} - r_{\mathrm{tol}}},\; 0,\; 1\right)\right)\right) \tag{Eq. 7}
     $$
     当 $r \le 1.5$ 时恒得满分 $1.0$（保护合理细节不被误砍）；$1.5 < r < 3.0$ 平滑余弦衰减；$r \ge 3.0$ 归零。
   - **加权合成与分级惩罚覆写（Eq. 8）**：取 $(w_1, w_2, w_3) = (0.3, 0.5, 0.2)$ 得 $R_{\mathrm{vis}} = 0.3 R_{\mathrm{struct}} + 0.5 R_{\mathrm{sem}} + 0.2 R_{\mathrm{eff}}$，按缺核心代码（$\mathbb{I}_{\mathrm{miss}}$）、渲染崩溃（$\mathbb{I}_{\mathrm{render}}$）与 ReAct 分隔符格式违规（$\mathbb{I}_{\mathrm{fmt}}$）分层裁决：
     $$
     R_{\mathrm{total}} = \begin{cases} \lambda_1 = -0.5, & \text{若 }\mathbb{I}_{\mathrm{miss}}=1 \text{ 或 } \mathbb{I}_{\mathrm{render}}=1 \text{（致命失败直接覆写总分）} \\[3pt] R_{\mathrm{vis}} + \lambda_2 \;\;(\lambda_2 = -0.3), & \text{若 }\mathbb{I}_{\mathrm{fmt}}=1 \text{（格式瑕疵扣固定偏置，保留视觉分梯度）} \\[3pt] R_{\mathrm{vis}}, & \text{正常完稿} \end{cases} \tag{Eq. 8}
     $$
3. **迭代轮数边界说明（§5）**：RefineSVG 采用 **1 轮生成 + 1 轮修正** 单步闭环即可把 `SVG-SFT` 的 `8.91k` tokens 压至 `634` tokens（缩减 **`14×`**）、总耗时从 `100s` 降至 **`27s`（快 `3.7×`）**；作者指出扩展至多轮精修的核心瓶颈在于多轮拓扑对齐冷启动数据构造与自适应停机判据设计。

---

## 3. 实验口径、完整超参数表与核心消融数据（事实）

### 3.1 三阶段完整训练超参数表（§4.1，32× NVIDIA H20 GPUs，Cosine LR）

| 训练阶段 | 数据集来源与规模 | 学习率 / 批大小 / 轮数 / 关键超参 |
|---|---|---|
| **Stage 1: Open-loop SFT** | `SVG-Stack` 质检过滤 `1.52M` 对（$256\times 256$） | `3 epochs`, `lr = 1e-5`, `effective_bs = 512`（冻结 ViT + Projector） |
| **Stage 2: ReAct Cold-Start** | 拒绝采样带通+拓扑过滤 `20K` 修复对 | `2 epochs`, `lr = 1e-6`, **`max_context_len = 24,576`** |
| **Stage 3: Agentic GRPO** | 偏向复杂图形（`>700` tok）的 `35K` 候选池 | $G=8$, `actor_lr = 1e-6`, $\epsilon=0.2$, `temp=1.0`, **KL $=0$**；评测 `temp=0.6`（3 次独立运行求均） |

### 3.2 `SVG-Stack-1K` 主表全指标与 3B/7B 逐级演进/消融对照（Table 1 & Table 2）

| 模型 / 阶段 / 消融变体 | 参数量 | DINO ↑ | PSNR ↑ | CLIP-I2I ↑ | SSIM ↑ | LPIPS ↓ | MSE ↓ | #Tok ↓ | 耗时 (s) ↓ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `DiffVG` / `LIVE`（优化法参考） | — | 0.8419 / 0.9053 | 32.48 / 33.93 | 0.9586 / 0.9719 | 0.9539 / 0.9804 | 0.1917 / 0.0764 | 0.0008 / 0.0006 | 268.4k / 72.6k | 109 / 402 |
| `Qwen3-VL-235B` | 235B | 0.7690 | 6.58 | 0.8691 | 0.3279 | 0.4348 | 0.4463 | 8.65k | — |
| `GPT-5.2` / `Gemini-3.1-Pro` | 闭源 | **0.9247** / 0.9138 | 11.92 / 13.19 | **0.9483** / 0.9433 | 0.6114 / 0.6564 | 0.2801 / 0.2414 | 0.1228 / 0.1205 | 849 / 1.14k | — |
| `StarVector` / `OmniSVG` / `InternSVG` | 8B | 0.7820 / 0.8212 / 0.8647 | 9.89 / 11.72 / 13.70 | 0.8830 / 0.8838 / 0.9098 | 0.4296 / 0.6072 / 0.6397 | 0.3329 / 0.2784 / 0.2390 | 0.4049 / 0.2273 / 0.1980 | 4.51k / 5.79k / 8.34k | 124 / 78 / 34 |
| `Qwen2.5-VL-3B` $\to$ `+SVG-SFT` | 3B | 0.6936 $\to$ 0.7423 | 4.91 $\to$ 8.27 | 0.8365 $\to$ 0.8648 | 0.3170 $\to$ 0.3509 | 0.4998 $\to$ 0.3911 | 0.4540 $\to$ 0.4599 | 4.46k $\to$ 8.93k | 22 $\to$ 58 |
| `3B w/o Cold-Start` / `w/o Diff-Map` / `Direct RL` | 3B | 0.7894 / 0.8785 / 0.8720 | — | — | 0.6254 / 0.6596 / 0.6618 | 0.2127 / 0.2420 / 0.2438 | 0.0957 / 0.0744 / 0.0895 | 806 / 312 / 347 | — |
| **`RefineSVG-3B`（Full）** | **3B** | **0.8872** | **14.61** | **0.9171** | **0.6638** | **0.2399** | **0.0732** | **319** | **17** |
| `Qwen2.5-VL-7B` $\to$ `+SVG-SFT` | 7B | 0.7315 $\to$ 0.7725 | 6.64 $\to$ 10.14 | 0.8458 $\to$ 0.8794 | 0.3862 $\to$ 0.4097 | 0.4718 $\to$ 0.3496 | 0.3477 $\to$ 0.4121 | 3.97k $\to$ 8.91k | 34 $\to$ 100 |
| `7B w/o Cold-Start` / `w/o Diff-Map` / `Direct RL` | 7B | 0.8886 / 0.9022 / 0.8798 | — | — | 0.7097 / 0.6921 / 0.7022 | 0.1888 / 0.2038 / 0.1929 | 0.0691 / 0.0662 / 0.0715 | 526 / 464 / 427 | — |
| **`RefineSVG-7B`（Full）** | **7B** | <u>0.9207</u> | **15.86** | <u>0.9306</u> | **0.7114** | **0.1891** | **0.0603** | **634** | **27** |

*(注：在 `SVG-Emoji`、`MMSVGBench`、`MMSVG-Illustration` 三个 OOD 测试集上，`RefineSVG-7B` 的 PSNR/SSIM/LPIPS/MSE 同样全面超越所有 8B SVG 专用模型，§4.4。)*

---

## 4. 对我们 Qwen3.8-27B 三轨项目（特别是 Track 3 cad_inspect.py 与 Track 2 SVG/Canvas）的落地启发（推论）

1. **在有参考锚点的任务中，为 Track 2（`check_2d_v2.mjs`）与 Track 3（`cad_inspect.py`）接入 `YCbCr Diff-Map` 显式残差热力图**：
   - 实验表明**基座参数量越大（3B $\to$ 7B $\to$ 我们的 27B），利用空间残差热力图精准修代码的能力越强**。对于 CAD 工程三视图/参考 `STEP` 4 视角复刻或 2D 关键帧视觉对齐任务，在 Contact Sheet 中并入 `YCbCr` 梯度+色度加权残差图（$\gamma > \beta > \alpha$），零 API 成本即可引导 27B 做像素级局部定位修改。
2. **用“带通过滤 + 模块拓扑兼容”守住三轨外科手术式 `Edit` 冷启动质量**：
   - 构造“缺陷返修”多轮 SFT 数据时，绝不能拿结构崩坏的烂草稿配完美终稿（会逼 27B 养成整文件 `Write` 推倒重写的坏毛病）；必须筛选“多模块骨架已对齐、仅局部尺寸/干涉/图层有偏差”的 Band-Pass 初稿做局部 `Edit` 示范。
3. **直接复用 `Eq. 7` 余弦免罚区间效率奖励（$r_{\mathrm{tol}}=1.5, r_{\mathrm{max}}=3.0$）与 `Eq. 8` 崩溃覆写机制**：
   - 在 RL 阶段给 `1.5×` 合理代码长度免罚缓冲，避免为刷短代码而删减关键动效/倒角细节，同时在 `1.5×–3.0×` 区间用平滑余弦惩罚彻底压灭无意义重复图元堆叠。
