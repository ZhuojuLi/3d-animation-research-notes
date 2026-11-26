# 论文精读：cadrille: Multimodal CAD Reconstruction with Reinforcement Learning（arXiv:2505.22914v3, ICLR Oral）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*cadrille: Multimodal CAD Reconstruction with Reinforcement Learning*
- **作者与机构**：Maksim Kolodiazhnyi*, Denis Tarasov*, Dmitrii Zhemchuzhnikov, Alexander Nikulin, Ilya Zisman, Anna Vorontsova, Anton Konushin, Vladislav Kurenkov, Danila Rukhovich†（MSU, ETH Zurich, AIRI, Innopolis Univ., Institute of Mechanics Armenia）
- **发表状态与链接**：ICLR Oral（v3 更新于 2026-02-17）· 原文：`https://arxiv.org/abs/2505.22914v3` · 代码：`https://github.com/col14m/cadrille`
- **本地存档**：[paper.html（上游原文）](https://arxiv.org/abs/2505.22914) · [paper.txt（上游原文）](https://arxiv.org/abs/2505.22914) · `sources.json`（本地校验清单未发布）
- **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者亲踩的初始大坑

`cadrille` 基于仅 **2B 参数** 的 `Qwen2-VL-2B`，在单一模型内同时处理**三维点云、多视角图像、自然语言文本**三种输入模态并输出可执行 `CadQuery` Python 脚本，一举刷新 4 大数据集共 **10 项基准 SOTA**。作者在打通“百万级程序化合成 SFT $\to$ 无代码手工/真实网格在线 RL”时，实证踩出了 CAD 代码训练中最致命的**三大工程大坑**：

1. **大坑一：直接用手工 CAD 库 SFT 掉 `-10% IoU`，异构 CAD 代码库（`CAD-Recode + DeepCAD`）混训 SFT 反而全线倒退（§4.3, §5.2, Table 2 & 3）**：
   - 在手工库 `DeepCAD` 上直接 SFT 比在程序化库 `CAD-Recode`（~1M 脚本）上低约 **`-10% IoU`**（DeepCAD 点云 `79.4%` vs `87.1%`；Fusion360 点云 `63.7%` vs `79.8%`，差 `-16.1%`，Table 1 & 5）。
   - **反直觉混训灾难**：将 `CAD-Recode` 与 `DeepCAD` 直接拼在一起做 SFT（`R_pi + D_pi`），不仅没涨分，反而在**所有三个测试集、两种模态上全面下跌**：
     - 多视图图像（Table 2）：`DeepCAD / Fusion360 / 真实扫描 CC3D` IoU 从 `86.1 / 77.6 / 56.1` **跌至 `85.6 / 75.2 (-2.4) / 53.1 (-3.0)`**（CC3D 中位 CD 从 `0.81` 恶化至 `1.17`）；
     - 三维点云（Table 3）：IoU 从 `87.1 / 79.8 / 61.8` **跌至 `86.6 / 76.5 (-3.3) / 58.7 (-3.1)`**！
   - **根因（一对多建模语法冲突）**：同一几何体可由截然不同的建模序列生成；`DeepCAD` 含对称拉伸（symmetric extrusion）、拉伸切除（extruded cut）等操作，而 `CAD-Recode` 统一使用 `sketch + extrude + union`（App. E Fig. 10）。逐 token 交叉熵强迫模型在两套异构代码风格间硬取平均，直接撕裂生成一致性。
2. **大坑二：离线迭代 DPO 只降报错率、涨不动几何精度（§4.4, §5.2, Table 2, 3 & 10）**：
   - 每题采样 $K=5$ 条训 `10+10` 轮迭代 DPO（第 10 轮刷新参考策略 $\pi_{\theta_r}$），虽然把失效率 `IR` 砍半，但 IoU 基本停滞（CC3D 图像 `56.1% -> 56.0%`，点云 `61.8% -> 61.3%`），且 $K=2$ 时极不稳定（App. C Table 10），因为离线 DPO 无法突破静态采样池的最佳样本上限。
3. **大坑三：不做难例挖掘直接跑在线 OCCT 几何 RL，时间与显存开销不可行（§4.4 & App. C Table 12）**：
   - SFT 在简单零件上已具备高 IoU，若全量无差别采样执行 Python 沙盒与网格求交，算力将被大量已解决样本拖垮。

---

## 2. 方法论、精确数学公式与工程细节（含 Appendix 超参/阈值/证明要点）

### 2.1 三模态统一轻量架构与 `2×2` Contact Sheet 视觉编码（§4.1 & App. D）
在 `Qwen2-VL-2B` 上构建零冗余输入接口：
- **多视图图像（Bounded Contact Sheet）**：固定 4 个正交视角渲染三角网格，拼成单张 **`268 × 268 px` 的 `2×2` 宫格图**，经原生 Qwen ViT 编码为恒定 **`400` 个视觉输入 token**（单卡 H100 单题推理仅 `2.0s`）；
- **三维点云**：从物体表面做最远点采样（FPS）提取 **`256` 个无序三维点（不使用法向量）**，仅经**单层可训练线性投影层**直接射入 LLM 词嵌入空间（单题推理 `2.0s`）；
- **自然语言文本**：采用 `Text2CAD` 多级几何描述，走原生文本嵌入层（因描述较长，单题推理 `3.9s`，Table 9）。

### 2.2 无真值代码在线三维奖励与 SFT 难例挖掘阈值 $R_{\mathrm{th}} = 7.5$（§4.4 & App. C）
1. **彻底解耦真值代码（Mesh-Only RL）**：RL 阶段**完全不需要任何配对 Python 代码**，只需归一化至 $[-0.5, 0.5]^3$ 的目标三维网格 $M_{\mathrm{gt}}$。这使原本因缺乏 Python 序列而无法用于 SFT 的复杂手工库 `Fusion360` 训练集（`6,900` 个模型，记作 $\mathrm{F}^{--}$）与去代码 `DeepCAD`（$\mathrm{D}^{--}$）直接进入 RL 训练，从根本上消灭了异构代码冲突！
2. **精确三维 IoU + 失效重罚奖励函数（§4.4）**：执行预测代码 $\tau$ 得到网格 $M(\tau)$：
   $$
   R(\tau) = r_{\mathrm{IoU}}(\tau) + r_{\mathrm{invalid}}(\tau) = \begin{cases} 10 \times \operatorname{IoU}\bigl(M(\tau), M_{\mathrm{gt}}\bigr) \in [0, 10], & \text{若 }\tau\text{ 成功生成合法 CAD 实体} \\[4pt] -10, & \text{若 }\tau\text{ 语法报错或生成非法实体} \end{cases}
   $$
3. **SFT 难例挖掘（Hard Example Mining）**：对每个训练样本 $q$，先用 SFT 模型独立采样 **3 次** 求平均奖励 $\bar{R}_{\mathrm{SFT}}(q)$，**仅保留满足 $\bar{R}_{\mathrm{SFT}}(q) < R_{\mathrm{th}} = 7.5$ 的难例**（即平均 $\mathrm{IoU} < 75\%$ 或混有报错样本，最终筛出 `50k DeepCAD + 3k Fusion360`）。

### 2.3 在线 `Dr. CPPO` 目标函数：去长度/标准差偏置 + Top-$N$ 强信号剪枝（§4.4 & App. D Table 14）
融合 **Dr. GRPO**（Liu et al., 2025b）与 **CPPO**（Lin et al., 2025）构建 **`Dr. CPPO`**：
1. **Dr. GRPO 去偏与省显存**：① **完全移除参考策略与 KL 正则项（$\beta = 0$）**；② **移除序列长度 $1/|\tau|$ 归一化偏置与组标准差 $\sigma$ 除法**，对每题采样的 $G = 16$ 条序列（温度 $T = 1.0$）直接用组均值中心化：
   $$
   A_g = r_g - \operatorname{mean}\bigl(\{r_i\}_{i=1}^G\bigr), \qquad g = 1, \dots, G
   $$
2. **CPPO Top-$N(|A_g|)$ 强信号精选**：每组 16 条样本中**仅保留优势绝对值 $|A_g|$ 最大的前 $N = 4$ 条样本**组成训练批 $\mathcal{B}$（直接省去 `75%` 弱信号样本的反向传播开销！），最大化裁剪代理目标（Table 14 采用对称裁剪 $\epsilon = 0.1$，每批更新 `3` 次）：
   $$
   \mathcal{J}_{\mathrm{Dr.CPPO}}(\theta) = \mathbb{E}_{\{\tau_g\} \sim \mathcal{B}_{\mathrm{top}\text{-}N(|A_g|)}}\!\left[\min\!\left(\frac{\pi_{\theta_t}(\tau_g \mid q)}{\pi_{\theta_{\mathrm{old}}}(\tau_g \mid q)} A_g,\;\; \operatorname{clip}\!\left(\frac{\pi_{\theta_t}(\tau_g \mid q)}{\pi_{\theta_{\mathrm{old}}}(\tau_g \mid q)},\; 1-\epsilon,\; 1+\epsilon\right) A_g\right)\right]
   $$

```python
# Appendix E Fig. 10 cadrille 生成的标准同构 CadQuery 范式（sketch 内布尔减 mode='s' + 多工作平面 union）：
import cadquery as cq
w0 = cq.Workplane('YZ', origin=(-63, 0, 0))
r = (w0.sketch().circle(33).circle(27, mode='s').finalize().extrude(-37)
     .union(w0.sketch().segment((-55,-67),(55,-67)).arc((87,0),(55,66)).segment((-55,67)).arc((-87,1),(-55,-67))
            .assemble().push([(-53,-39)]).circle(12, mode='s').finalize().extrude(21)))
```

---

## 3. 实验口径、完整超参数表与核心消融数据（事实）

### 3.1 SFT / DPO / Dr. CPPO 完整超参数对照表（App. D Table 13 & 14）

| 训练阶段 | 硬件与训练规模 | 优化器 / 学习率 / 批大小 / 核心算法超参 |
|---|---|---|
| **Stage 1: 多模态 SFT** | 1× H100 · `120k steps`（`CAD-Recode` ~1M） | `Qwen2-VL-2B`, AdamW, `lr = 2e-4`, `bs = 8 × 4 (accum) = 32` |
| **对比: 离线迭代 DPO** | 8× H100 · `10 + 10 = 20 epochs` | Adam, `lr = 1e-5`, `bs = 160`, KL $\beta = 0.3$, 采样数 $K = 5$ |
| **Stage 2: 在线 `Dr. CPPO`** | 8× H100 · `20 epochs`（仅在图像集 $\mathrm{D}_i^{--}+\mathrm{F}_i^{--}$ 上训） | Adam, `lr = 3e-5`, `bs = 128`, `updates/batch = 3`, $\epsilon = 0.1$, **$G = 16 \to N = 4$**, $R_{\mathrm{th}} = 7.5$, **KL $= 0$** |

### 3.2 三模态主表与无真值代码在线 RL 全基准结果（Table 1, 2, 3, 4, 6 & 8；主表 CD 为中位数 $\times 10^3$，8192 点）

| 模态与方法 | 训练数据 (SFT $\to$ RL) | DeepCAD CD↓ | **DeepCAD IoU↑** | DeepCAD IR↓ | Fusion360 CD↓ | **Fusion360 IoU↑** | Fusion360 IR↓ | 真实扫描 CC3D CD↓ | **CC3D IoU↑** | CC3D IR↓ |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **[文本]** `Text2CAD` / `CAD-Coder` / `Text-to-CQ` | `D_t` | 0.37 / 0.33 / 0.22 | 71.5 / — / — | 3.7 / 5.3 / 1.3 | — | — | — | — | — | — |
| **[文本]** **`cadrille` SFT** *(Mean CD 26.4$\to$**3.95**)* | `R_pi + D_t` | **0.20** | **82.1** | **1.4%** | — | — | — | — | — | — |
| **[图像]** `GPT-o4-mini`（4 视图+ICP, Tab. 8） | Zero-shot | 2.37 | 60.4 | 15.9% | — | — | — | — | — | — |
| **[图像]** `LRM -> CAD-Recode` | `R_p` | 0.53 | 69.8 | 14.3% | 0.62 | 62.5 | 18.7% | 1.19 | 50.1 | 20.1% |
| **[图像]** `cadrille` SFT | `R_pi` | 0.18 | 86.1 | 1.5% | 0.20 | 77.6 | 3.2% | 0.81 | 56.1 | 7.7% |
| **[图像]** `cadrille` **异构混训 SFT (踩坑)** | `R_pi + D_pi` | 0.19 | **85.6 (↓)** | 0.6% | 0.23 | **75.2 (↓)** | 2.6% | 1.17 | **53.1 (↓)** | 6.0% |
| **[图像]** `cadrille + DPO` | `R_pi` $\to \mathrm{D}_i^{--}\!+\!\mathrm{F}_i^{--}$ | 0.18 | 86.9 | 1.8% | 0.20 | 78.5 | 1.7% | 0.89 | 56.0 | 3.9% |
| **[图像]** **`cadrille + Dr. CPPO`** | `R_pi` $\to \mathrm{D}_i^{--}\!+\!\mathrm{F}_i^{--}$ | **0.17** | **92.2** | **0.0%** | **0.17** | **84.6** | **0.0%** | **0.57** | **65.0** | **0.1%** |
| **[点云]** `CAD-SIGNet` / `CAD-Recode` | `D_p` / `R_p` | 0.29 / 0.18 | 77.3 / 87.1 | 5.0 / 3.1% | 0.70 / 0.19 | 58.4 / 79.1 | 9.3 / 5.0% | 4.42 / 0.54 | 39.1 / 60.5 | 15.5 / 9.8% |
| **[点云]** `cadrille` **异构混训 SFT (踩坑)** | `R_pi + D_pi` | 0.19 | **86.6 (↓)** | 0.9% | 0.22 | **76.5 (↓)** | 2.0% | 0.79 | **58.7 (↓)** | 4.1% |
| **[点云·零样本跨模态增益]** **`cadrille + Dr. CPPO`** | `R_pi` $\to \mathrm{D}_i^{--}\!+\!\mathrm{F}_i^{--}$ | **0.17** | **90.2** | **0.0%** | **0.17** | **85.0** | **0.2%** | **0.47** | **67.9** | **0.2%** |

### 3.3 Appendix B `Mean CD` 全景表（Table 6，随机采样理论下界为 `0.16 / 0.13 / 0.15`）

| 方法 | DeepCAD 点云 | DeepCAD 图像 | DeepCAD 文本 | Fusion360 点云 | Fusion360 图像 | CC3D 点云 | CC3D 图像 |
|---|---:|---:|---:|---:|---:|---:|---:|
| `CAD-Recode` (`R_p` SFT) / `LRM->CAD-Recode` | 0.83 / — | — / 3.36 | — | 1.21 / — | — / 4.33 | 3.21 / — | — / 4.75 |
| `Text2CAD` / `Text-to-CadQuery` / `CAD-Coder GRPO` | — | — | 26.4 / 11.8 / 6.54 | — | — | — | — |
| `cadrille` SFT (`R_pi + D_t`) | 0.76 | 0.81 | **3.95** | 1.10 | 1.13 | 2.32 | 3.50 |
| `cadrille + DPO` (`D--_i + F--_i`) | 0.61 | 1.35 | — | 0.84 | 1.27 | 2.32 | 3.33 |
| **`cadrille + Dr. CPPO` (`D--_i + F--_i`)** | **0.57** | **0.43** | — | **0.58** | **0.64** | **1.86** | **2.68** |

### 3.4 Appendix B & C 关键消融：难例阈值 $R_{\mathrm{th}}$、Test-Time Best-of-$k$ 与 `Omni-CAD` 27K
1. **难例阈值 $R_{\mathrm{th}}$ 扫描（App. C Table 12，多视图图像）**：
   - $R_{\mathrm{th}} = 1$（`10k+0.7k` 题）：DeepCAD / Fusion360 / CC3D IoU = `89.0 / 81.0 / 59.8`，CC3D IR = `6.3%`；
   - $R_{\mathrm{th}} = 3 \to 5 \to 6.2$（`21.4k -> 32k -> 42.5k` 题）：CC3D IoU 稳步升至 `62.4 -> 62.3 -> 63.3`，IR 降至 `4.0% -> 0.9% -> 0.7%`；
   - **$R_{\mathrm{th}} = 7.5$（`50k+3k` 题）**：达到最优 **`92.2 / 84.6 / 65.0`**，IR 全线压至 **`0.0% / 0.0% / 0.1%`**！
2. **单次推理胜过 10 次采样（App. C Table 11）**：`cadrille` 1-sample 在 CC3D 上的 `IR = 0.2%` 优于 `CAD-Recode` 10-sample `Best-of-10`（`IR = 0.3%`，慢 `10×`）；当 `cadrille` 也开 10-sample 时 IoU 进一步达 `93.1 / 89.1 / 74.7`。
3. **`Omni-CAD` 27K 跨库零样本评测（App. B Table 4）**：未见任何 `Omni-CAD` 训练样本，`cadrille + RL` 点云 / 图像 IoU 达 **`84.2% (IR 0.6%) / 84.8% (IR 0.0%)`**，点云 Mean CD `0.77` 远超在该库本域训练的 `CAD-MLLM`（`18.5`）。
4. **DPO 采样数 $K$ 敏感度与真实单图重建管线（App. A Fig. 7–8 & App. C Table 10）**：
   - DPO 采样 $K=2$ 时严重不稳（DeepCAD / Fusion360 / CC3D IoU 仅 `77.3 / 70.0 / 49.7`），$K=3$（`86.2 / 77.8 / 55.6`）至 $K=5$（`86.9 / 78.5 / 56.0`）即基本饱和（差 `<1%`）；
   - 单张真实照片（In-the-wild Single Image）重建测试：先过 `InstantMesh` 转网格 $\to$ 采 256 点云或渲染 4 正交视图喂给 `cadrille`，无需微调即可恢复规整参数化实体（Fig. 7–8）。

---

## 4. 对我们 Qwen3.8-27B 三轨项目（特别是 Track 3 cad_inspect.py 与 Track 2 SVG/Canvas）的落地启发（推论）

1. **严守 SFT 代码同构性红线：绝不把外部单轮异构 CadQuery 脚本（`Zero-To-CAD` / `CADEvolve` 源码）混入我们 SFT 主集！**
   - `R_pi + D_pi` 全线掉分从实验上彻底坐实：不同建模习惯的代码混做 token 级 SFT 必伤模型！对于外部开源高复杂单件（20–45 面），**只取其真值 `STEP` 实体与 4 视角拼图**——要么喂给 `kimi-k3.1-pro` 按我方统一 `params.py + parts/*.py + assembly.py` 规范重打长程 SFT 轨迹，要么直接作为 **无参考代码的在线 RL 真值锚点（`cad_inspect.py` 算 `Voxel IoU`）**。
2. **直接落地“本地 27B 难例闸（$\bar{R}_{\mathrm{SFT}} < R_{\mathrm{th}}$）+ CPPO Top-$N(|A_g|)$ 强信号反向传播”**：
   - 先用本地 `Qwen3.8-27B` 免费跑 3 次过筛，砍掉平均已高分过关的简单题；在线 RL 采样 $G=8\text{–}16$ 条后，仅取 $|A_g|$ 最大的前 `25%` 轨迹算梯度更新，立省 `75%` 长上下文反向传播显存与时间；且多视图图像 RL 的几何推理增益会自动跨模态反哺纯文本参数化建模。
3. **低分辨率 `2×2` Contact Sheet 视觉效率标杆**：`268×268` 四视图仅 `400` 视觉 token 即支撑 `92.2%` IoU，验证我们 `MAX_PIXELS = 401408` 拼图预算完全足够看清三维几何结构。
