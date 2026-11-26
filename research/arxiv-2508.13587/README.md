# 论文精读：Breaking the SFT Plateau: Multimodal Structured Reinforcement Learning for Chart-to-Code Generation（MSRL, arXiv:2508.13587v2）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*Breaking the SFT Plateau: Multimodal Structured Reinforcement Learning for Chart-to-Code Generation*（简称 **MSRL**）
- **作者与机构**：Lei Chen, Xuanle Zhao, Zhixiong Zeng†（Project Leader）, Jing Huang, Liming Zheng, Yufeng Zhong, Lin Ma*（Meituan 美团）
- **发布时间与链接**：2025-08-19（v2 更新于 2026-03-16）· 原文：`https://arxiv.org/abs/2508.13587v2` · 代码：`https://github.com/DocTron-hub/MSRL`
- **本地存档**：[paper.html（上游原文）](https://arxiv.org/abs/2508.13587) · [paper.txt（上游原文）](https://arxiv.org/abs/2508.13587) · `sources.json`（本地校验清单未发布）
- **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者亲踩的初始大坑

美团团队围绕高信息密度 2D 可视化代码生成（`Chart-to-Code`），从 2023 年及以前的 arXiv 论文真实表格出发，用 `Gemini-2.5-Flash` 合成并经沙盒执行过滤构建了迄今最大规模的 **300 万对** 真实分布数据集（覆盖 **24 类图表**与 **1,555 种** Matplotlib API，远超 `ChartCoder` 的 187 种 API，Table 1），并在系统性实验中踩出了**四个关键平台期与奖励设计大坑**：

1. **大坑一：大规模 SFT 在 `1.6M–2.0M` 后彻底撞上“平台期死墙”（§3.2, §4.2, Fig. 1 & Fig. 4）**：
   - 作者将语料切分为 **`200k, 400k, 800k, 1.6M, 2.0M, 2.8M`** 六档规模微调 `Qwen2.5-VL-7B-Instruct`：
     - `200k -> 400k`：性能陡峭拉升；
     - `400k -> 1.6M`：增速明显放缓；
     - **`2.0M -> 2.8M`：曲线完全水平饱和，继续堆入 85 万条同分布真实数据几乎零收益！**
   - **本质原因（§3.3）**：SFT 的逐 token 等权负对数似然把绝大部分梯度耗散在高频样板代码（如 `plt.plot`, `plt.subplots`）上，而真正决定图表成败的稀疏 token（具体数值序列、多子图网格坐标、十六进制配色、图例文本）权重被严重稀释（如定性分析 App. D Fig. E/F 所示，饱和 SFT 仍会把折线图误判为散点图、搞错三子图语法导致只显示最后一个子图）。
2. **大坑二：跳过 SFT 直接在基座上硬跑 RL 惨败（§4.3 Table 4）**：
   - 在未微调 `Qwen2.5-VL-7B` 上直接跑 `RL-only`，虽然 `R_exec` 把代码可执行率推高到 `93.83%`，但 `ChartMimic` Low-Level / High-Level 仅 `65.60 / 62.29`，远低于饱和 `SFT-only`（`73.02 / 77.61`）；只有在饱和 SFT 之上接力 RL，才能冲破天花板跃升至 `97.00% / 78.06 / 82.69`。
3. **大坑三：用纯视觉编码器（DINOv2/InternViT）或 7B 小 VLM 当视觉裁判会严重失准（App. C Fig. A & Table B）**：
   - 在 200 条人工金标准打分对比中，`Qwen2.5-VL-7B` 裁判与人类分数的 Pearson 相关性最差、分布严重畸变；纯特征模型 `InternViT`（High-Level `78.1`）与 `DINOv2-L`（`79.8`）只看粗粒度全局相似，抓不住文字重叠与图例错位，显著落后于 `Qwen2.5-VL-72B` 裁判（单开视觉项即达 `81.9`）。
4. **大坑四：离线属性扰动 DPO 收益极微，而全程开 72B 视觉 GRPO 算力爆表（Table 5 & App. C Table C）**：
   - 仿照 `Chart2Code` 用 `GPT-4.1` 随机扰动 2–3 个图表属性构造负样本跑 `DPO`，仅比 SFT 微涨 `+1.0 / +1.3` 分（`74.0 / 78.9` vs GRPO `78.6 / 83.8`）；但若在 `22k` 样本上全程开 72B 视觉奖励跑单阶段 GRPO，则需消耗 **`1,344` H800 GPU 小时**。

---

## 2. 方法论、精确数学公式与工程细节（含 Appendix 超参/阈值/证明要点）

### 2.1 SFT/RL 数据集物理隔离与三级精筛漏斗（§3.1, App. A Table A & App. E）
为避免模型在已拟合的 SFT 数据上丧失探索能力，作者将 **`2,853,505` 条** 划归 SFT，另切出 `130k` 独立候选池经三级漏斗精筛出 **`33k`（App. A Table A 精确汇总为 `34,356` 条）** 高质量 RL 集：
1. **多子图语法树解析与可抽提数据结构过滤（`130k -> 45k`）**：
   - 利用树结构解析器逐层识别复合多图（Multi-chart / Multi-axes）类型；
   - **剔除不适合规则抽取比对的 `Graph`（SFT 108,150 条 $\to$ RL `0` 条）与 `Funnel`（SFT 1,152 条 $\to$ RL `0` 条）两类图**；
   - 保留其余 **22 类图表**均衡分布（如 `Bar_num` 2,757、`Line` 2,743、`Bar` 2,669、`Scatter` 2,639、`ErrorPoint` 2,277、`Heatmap` 1,984、`Density` 1,899、`Quiver` 1,700、`3D` 1,699、`Multi-axes` 1,691 等，App. A Table A）；
   - 数据格式过滤：**仅保留数据定义为 1D 数组或非嵌套字典**的代码，确保 RL 阶段可 100% 无歧义解析数值。
2. **`GPT-4.1-mini` 视觉预审剔除重叠脏图（`45k -> 33k`）**：
   - 使用专用质检 Prompt（App. E Fig. C）过滤原图自带文字/图元越界重叠的坏样本（人工抽检 100 条 0 分淘汰样本，人机一致率 `>90%`）；
   - 同时在数据合成 Prompt（App. E Fig. B）中硬性规定 `Pie / Ring / Treemap` 必须在画面上打印真实数值而非仅百分比，否则模型无法从纯图像恢复真实量纲。

### 2.2 代码规范化 + 双层三路结构化奖励精确权重（§3.3 Eq. 1 & App. B）
对每条采样代码先执行**规范化映射（Canonical Code Normalization）**消除命名与调用语法差异，再按 Eq. 1 合成总奖励：
$$
R = w_t R_{\mathrm{text}} + w_v R_{\mathrm{vis}} + w_e R_{\mathrm{exec}} \tag{Eq. 1}
$$
1. **五维规则文本结构奖励 $R_{\mathrm{text}} \in [0, 1]$（App. B 给出精确子权重，总和为 $1.0$）**：
   $$
   R_{\mathrm{text}} = 0.4\,R_{\mathrm{data}} + 0.3\,R_{\mathrm{chart}} + 0.1\,R_{\mathrm{layout}} + 0.1\,R_{\mathrm{title}} + 0.1\,R_{\mathrm{label}}
   $$
   - **数据数值软匹配（$w_d = 0.4$）**：允许 **$\pm 5\%$ 相对误差容差**（Soft Value Matching）；
   - **图表类型硬匹配（$w_c = 0.3$）**：基于树解析器的绘图函数类型精确字符串匹配；
   - **子图网格布局硬匹配（$w_l = 0.1$）**：行列布局参数精确数值匹配；
   - **标题与轴/图例标签（$w_t = 0.1,\; w_{\mathrm{lbl}} = 0.1$）**：字符串编辑距离（Edit Distance）相似度。
2. **代码执行硬门禁 $R_{\mathrm{exec}} \in \{0, 1\}$**：Python 解释器无报错执行得 `1`，否则得 `0`。
3. **72B 六维渲染视觉奖励 $R_{\mathrm{vis}} \in [0, 1]$（§3.3, App. B & E Fig. D）**：
   - 将代码渲染为图像（**渲染失败直接硬置 $R_{\mathrm{vis}} = 0$**）；
   - 部署冻结 **`Qwen2.5-VL-72B-Instruct`**（`max_model_len = 12,288`），遵循 `ChartMimic` 协议对照真值图从 **6 个结构维度（`chart type, layout, text content, data, style, clarity`）** 联合评分并归一化至 $[0, 1]$。

### 2.3 两阶段课程 GRPO：先纯规则破冰，后半量图文混训省 `57%` 算力（§3.3, §4.2–4.3 & App. B）
基于 `MM-EUREKA` 框架运行无 KL 惩罚（$\beta = 0$）的在线 `GRPO`（$G=8, T=1.0$），两阶段精确权重切换：
$$
(w_t,\, w_v,\, w_e) = \begin{cases} (1.0,\; 0.0,\; 0.5), & \text{RL Stage 1（前 22k 样本，纯规则破冰，240 GPUh）} \\[4pt] (0.5,\; 0.5,\; 0.5), & \text{RL Stage 2（后 5.5k / 11k 样本，图文混训，累计 576 / 912 GPUh）} \end{cases}
$$
- **RL Stage 1（纯文本规则阶段，`22k` 样本）**：设 **$(w_t, w_v, w_e) = (1.0,\; 0.0,\; 0.5)$**。零图像渲染与零 72B 评估开销，仅用 **`240` H800 GPUh** 即打破 SFT 平台期实现约 **`+5%`** 跃升，并在 `22k` 样本处触达第一阶段收敛拐点（Fig. 4）。
- **RL Stage 2（图文混合精调阶段，仅用 `5.5k` 样本 [50% 子集] 或 `11k` 全集）**：切换权重为 **$(w_t, w_v, w_e) = (0.5,\; 0.5,\; 0.5)$**。仅用 `5.5k` 样本（总计 **`576` GPUh**，比纯视觉 RL `1,344` GPUh **节省 `57.1%` 算力**）即再涨 `+1.14` High-Level 分，追平全量混合开销！

---

## 3. 实验口径、完整超参数表与核心消融数据（事实）

### 3.1 全阶段训练超参数与资源明细表（App. B）

| 阶段 | 框架与硬件集群 | 样本数 / 轮数 | 核心超参数与权重配置 |
|---|---|---|---|
| **MSRL-SFT** | `LLaMA-Factory` · 16× H800（60h = `960` GPUh） | `2.85M` · `1 epoch` | 基座 `Qwen2.5-VL-7B-Instruct`, `lr = 1e-5`, `batch_size = 32` |
| **RL Stage 1** | `MM-EUREKA` GRPO · 24× H800（10h = `240` GPUh） | `22k` · `1 epoch` | `lr = 1e-6`, `bs = 128`, $G=8$, `temp=1.0`, **KL $=0$**；$(w_t,w_v,w_e)=(1.0, 0.0, 0.5)$ |
| **RL Stage 2** | `MM-EUREKA` GRPO · 24× H800（14h/24h = `576`/`912` 累计 GPUh） | `5.5k`（主表）/ `11k` · `1 epoch` | 同上 + 冻结 `Qwen2.5-VL-72B` 裁判（`max_len=12288`）；$(w_t,w_v,w_e)=(0.5, 0.5, 0.5)$ |

### 3.2 主表、细粒度四子项、视觉裁判与课程消融（Table 2, 3, 4, 5, 6 & App. C Table B–D）

| 模型 / 消融变体 | ChartMimic Exec↑ | CM Low-Level↑<br>*(Text / Layout / Type / Color)* | **CM High-Level↑** | ReachQA Exec↑ | RQ Low-Level↑<br>*(Text / Layout / Type / Color)* | **RQ High-Level↑** | RL GPUh↓ |
|---|---:|---:|---:|---:|---:|---:|---:|
| `GPT-4o`（闭源旗舰） | 93.2 | 79.0 *(81.5 / 89.8 / 77.3 / 67.2)* | 83.5 | 92.8 | 81.8 *(84.4 / 91.2 / 81.3 / 70.5)* | 84.0 | — |
| `Qwen2.5-VL-7B`（基座） | 73.16 | 44.58 *(37.7 / 65.6 / 42.6 / 32.4)* | 41.55 | 62.2 | 36.9 *(29.6 / 40.9 / 44.2 / 32.8)* | 37.6 | 0 |
| `RL-Only`（无 SFT 直训规则 RL, Tab. 4） | 93.83 | 65.60 | 62.29 | — | — | — | — |
| `ChartCoder-7B`（前开源 SOTA） | 91.4 | 72.5 *(65.9 / 85.4 / 72.3 / 66.4)* | 74.0 | 83.8 | 67.9 *(58.2 / 80.0 / 70.4 / 63.2)* | 69.4 | — |
| `MSRL-SFT`（2.8M 饱和平台期） | 93.17 | 73.02 | 77.61 | 92.2 | 78.6 | 80.0 | 0 |
| `+ DPO`（属性扰动离线偏好, Tab. C） | — | 74.0 | 78.9 | — | — | — | — |
| `+ 仅视觉裁判 InternViT / DINOv2-L / 72B` | — | 75.1 / 75.5 / 77.8 | 78.1 / 79.8 / 81.9 | — | — | — | — |
| `+ Stage 1 Only (T, 22k)` | 97.00 | 78.06 | 82.69 | — | — | — | **240** |
| `+ Single-Stage Visual (V, 22k)` | 97.37 | 79.13 | **84.01** | — | — | — | 1344 |
| `+ Two-Stage Full (T 22k -> T+V 11k)` | **97.50** | **79.50** | 83.81 | — | — | — | 912 |
| **`MSRL 主表 (T 22k -> T+V 5.5k)`** | **96.50** | **78.62** *(78.0 / **93.0** / 75.3 / **68.2**)* | **83.83 (+6.2)** | **98.2** | **86.1** *(**87.5 / 96.6 / 83.1 / 77.2**)* | **89.9 (+9.9)** | **576** |

- **跨数据与跨绘图库 OOD 泛化事实**：
  - 在 `ChartCoder` 旧合成库 vs 本文真实表格库对照中（App. C Table D），SFT 阶段 High-Level 从 `68.0 -> 77.6`，RL 阶段从 `81.2 -> 83.8`；
  - 零样本迁移至训练集完全未见的 **`Seaborn`（107 题）** 与 **`Plotly`（150 题）** 视觉样式（Table 6）：执行率分别从 `69.2% -> 85.1%`、`62.7% -> 90.0%`，High-Level 从 `25.7 -> 30.5`、`22.6 -> 35.9`（`+13.3`）。

```text
# Appendix D & E 三套核心 Prompt 分工与残余边界案例（Fig. B–F）：
- Fig. B (造数 Prompt) : 输入真实 arXiv 表格 + 24 类模板示例 -> 强制 Pie/Ring/Treemap 标注绝对数值而非仅百分比
- Fig. C (预筛 Prompt) : GPT-4.1-mini 筛除原图自带文字遮挡/越界的脏样本（0 分样本人工核验 >90% 一致）
- Fig. D (RL 裁判 Prompt): Qwen2.5-VL-72B 按 ChartMimic 6 维（类型/布局/文本/数据/风格/清晰度）打归一化视觉分
- Fig. E/F (定性余留问题): 修复了 SFT 的折线误作散点与三子图漏画两个子图，但在极密复杂多子图布局比例上仍有微瑕
```

---

## 4. 对我们 Qwen3.8-27B 三轨项目（特别是 Track 3 cad_inspect.py 与 Track 2 SVG/Canvas）的落地启发（推论）

1. **SFT 平台期铁律要求我们“严格隔离 SFT 与 RL 题池，把 RL 火力集中在稀疏高杠杆参数上”**：
   - 无论 SFT 数据扩到多大，样板代码（Three.js 场景初始化、Canvas 循环架子、CadQuery 导入与导出样板）都会稀释关键几何尺寸、装配间隙与时间轴缓动参数的梯度。我们必须将 SFT 示范题集与后续在线 RL 探索题池完全解耦。
2. **直接复用“Stage 1 纯确定性代码/几何规则零成本跑量 $\to$ Stage 2 小比例样本开大号 VLM 视觉混训”省一半以上 GPU 小时**：
   - **Stage 1（零 VLM 开销）**：Track 3 直接用 `cad_inspect.py`（AST 规范化参数核对 $\pm 5\%$ 容差 + 水密流形 + 零布尔干涉 + 孔轴探针），Track 2 直接用 `check_2d_v2.mjs`（`renderAt(t)` 逆序一致性 + 零文字重叠 + 714 类确定性时空断言），以极高吞吐先把执行率与结构硬指标推上 `97%+`；
   - **Stage 2（25% 精选高难题）**：再打开 `72B+` 级强 VLM Contact Sheet 审美/布局混合奖励（权重 `0.5 : 0.5 : 0.5`），砍掉近 60% 视觉裁判算力而不掉丝毫最终质量。
3. **坚决抵制用 7B 小 VLM 或纯 DINOv2 给复杂 2D 排版与 CAD 工程图打分**：必须使用 `72B+` 大多模态裁判配合明确的多维子项规约。
