# 论文精读：PhyCAD: Physics-Aware Text-to-CAD Generation via Hierarchical Reinforcement Learning（arXiv:2611.09401v1）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*PhyCAD: Physics-Aware Text-to-CAD Generation via Hierarchical Reinforcement Learning*
- **作者与机构**：Yuxin Cui, Weijie Zheng, Zhengyang Li, Han Wang, Wenjie Feng, Qiyu Kang†（中国科学技术大学 USTC）
- **发布时间与链接**：2026-11-06 · 原文：`https://arxiv.org/abs/2611.09401v1` · 代码：`https://github.com/PhysAGI/PhyCAD`
- **本地存档**：[paper.html（上游原文）](https://arxiv.org/abs/2611.09401) · [paper.txt（上游原文）](https://arxiv.org/abs/2611.09401) · `sources.json`（本地校验清单未发布）
- **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者亲踩的初始大坑

工程级参数化 `Text-to-CAD` 不仅要求输出可编译的 `CadQuery` 脚本，还必须在容许包络空间内同时满足几何拓扑规格与受载物理极限（位移、等效应力、质量上限），并在可行集 $\mathcal{F}(q)$ 内最小化质量目标：
$$
o^* \in \underset{o \in \mathcal{F}(q)}{\arg\min}\; m(o; q) \tag{Eq. 1}
$$

作者在 `3,373` 道带有限元（FEM）边界条件的逆向设计测试题上，实测踩出了**三个极具警示意义的硬核大坑**：

1. **闭源旗舰大模型零样本直出全面溃败（Table 1）**：
   - `Claude Opus 5`、`GPT-5.6 Sol`、`DeepSeek-V4-Flash-Ascend` 直出合法 CAD 比例虽有 `73.82% / 62.41% / 63.33%`，
   - 但几何+物理联合可行率（Joint Feasibility）分别低至 **`7.29%`、`15.51%`、`9.28%`**——模型不懂壁厚、截面惯性矩与 `100 kN` 拉力间的力学耦合，一跑有限元即屈服或大挠度失效。
2. **大坑一：平面线性加权（Non-Hierarchical Flat GRPO）使联合可行率比 SFT 倒退 `-2.96 pp`（§4.5 Table 2）**：
   - 在 `Qwen2.5-3B` 消融母体上，将“代码合法 + 包络接近 + 应力/位移接近 + 质量更轻”平铺加权喂给 GRPO：
   - 模型迅速学会钻空子：先把 `Valid CAD` 刷到 `98.40%`，同时把零件削薄刷高“轻量化”得分去补偿“包络越界（`65.16% -> 60.90%`）”与“应力超标断裂（`25.32% -> 23.40%`）”，导致 **Joint Feasibility 从 SFT 的 `21.76%` 倒退跌至 `18.80%`**（Fig. 1C 直观展示了这种轻但断裂的废品）。
3. **大坑二：单维奖励顾此失彼，三阶段串行课程 RL 性价比低（Table 2）**：
   - 只优化几何或只优化物理奖励，Joint 仅停在 `22.86% / 27.63%`；
   - 分三阶段串行训练（`Geometry GRPO -> Physics GRPO -> Hierarchical GRPO`）虽可达 `42.01%`，但比单阶段直训 `HBA-GRPO`（`39.49%`）仅多 `+2.52 pp`，却付出数倍仿真与训练开销。

---

## 2. 方法论、精确数学公式与工程细节（含 Appendix 超参/阈值/证明要点）

### 2.1 Appendix A：自动化 CAD–CAE 有限元标注与逆向设计脱敏管线
从 `Text-to-CadQuery`（约 `110k` 程序）出发，仅保留生成**单一连通合法 B-rep 实体**且全链路 FEM 成功的 **`77,067` 个设计**，严格切分为互不重叠的 **`11,024` SFT 对 + `62,670` 无代码 GRPO 题 + `3,373` 留出测试题**：

1. **材料常数与 3D 线弹性有限元标准（App. A.1）**：
   - 统一采用 SI 单位制各向同性结构钢：杨氏模量 $E = 2.1 \times 10^{11}\,\mathrm{Pa}$，泊松比 $\nu = 0.3$，密度 $\rho = 7850\,\mathrm{kg/m^3}$。
2. **全自动功能主轴与端面边界组判定算法（App. A.1）**：
   - 计算所有 B-rep 曲面的几何形心，选取欧氏距离最大的一对形心连线作为归一化功能分析主轴 $\hat{u}$；
   - 将全部曲面形心投影至 $\hat{u}$，位于投影总跨度两端 **`5%` 以内** 的曲面分别归入负端组与正端组（稳健兼容共面或碎裂端面）；
   - **边界与载荷**：负端组全自由度固支（$u_x = u_y = u_z = 0$），正端组施加沿 $+\hat{u}$ 方向面积分合力恒为 **`100 kN`** 的均匀面牵引力；
   - 提取最大节点位移 $\delta_{\max}$、消除网格尖角应力奇异性的**体积加权第 99 百分位单元 von Mises 应力 $\sigma_{\mathrm{P99}}$** 与总质量 $m$。
3. **逆向设计数值脱敏与相邻 2 的幂次包络区间（App. A.2–A.3, Eq. 7 & Table 3）**：
   - 彻底抹去原描述中所有显式尺寸、角度、带单位数值及英文数字单词，同时静态解析 CadQuery AST 提取无参数拓扑语义（App. A Table 3 全映射）：
     - `box` $\to$ `rectangular-prismatic feature`；`cylinder` $\to$ `cylindrical feature`；
     - `polygonal / curved sketch + extrude` $\to$ `polygonal-prismatic / curved-profile feature`；
     - `revolve` $\to$ `revolved feature`；`cut` $\to$ `material-removal relation`；`hole` $\to$ `hole or through-feature`；
     - `fillet` $\to$ `rounded-edge feature`；`shell` $\to$ `hollow or shell construction`；`union` $\to$ `part-composition relation`。
   - 对三轴包络盒真值跨度 $e$，仅向模型暴露相邻 2 的幂次闭区间：
     $$
     B(e) = \Bigl[2^{\lfloor \log_2 e \rfloor},\; 2^{\lfloor \log_2 e \rfloor + 1}\Bigr] \tag{Eq. 7}
     $$
   - 对参考测量值 $(\delta_{\max}, \sigma_{\mathrm{P99}}, m)$ 分别乘以 **`1.10` 容差系数并向上取整至 2 位有效数字** 作为约束上限 $(\bar{\delta}, \bar{\sigma}, \bar{m})$。

### 2.2 四层离散验证状态 $L_i$ 与同层同侪排序 `PeerRank`（§3.2–3.3 Eq. 2–4 & Fig. 3）
确定性 CAD–CAE 验证器对同组 $G$ 个采样程序依次执行三级硬检，映射为离散状态层 $L_i \in \{0, 1, 2, 3\}$（Eq. 2）：
- **$L_i = 0$（CAD 构建失败）**：按输出完整性、纯代码格式、语法合法、安全调用、实体构造、`STEP` 导出并经 OCCT 内核重导入共 6 项进度细分子分；
- **$L_i = 1$（CAD 合法但几何不达标）**：以等权重 $(0.5, 0.5)$ 评估三轴包络区间接近度与上述无量纲几何特征召回率；
- **$L_i = 2$（几何达标但 CAE 失败或物理超限）**：以等权重 $(1/3, 1/3, 1/3)$ 评估应力、位移、质量上限接近度；对测量值 $v$ 与上限 $\bar{v}$，定义分段封顶得分：
  $$
  s(v; \bar{v}) = \begin{cases} 1, & v \le \bar{v} \\ \bar{v} / v, & v > \bar{v} \\ 0, & \text{CAE 失败无读数} \end{cases}
  $$
  *(关键防作弊设计：一旦单项满足 $v \le \bar{v}$ 立即封顶为 $1$，绝不允许靠进一步压低已达标质量来替超标应力凑分！)*
- **$L_i = 3$（全部硬约束通过，联合可行）**：以等权重 $(1/3, 1/3, 1/3)$ 评估**质量效率 $1 - m_i/\bar{m}$**、应力安全裕度与位移安全裕度——其中**应力与位移安全裕度在达到 `10%` 后封顶不再涨分**，引导可行解专注减重而不紧贴失效边界。

**带并列平局修正的同层居中排名 `PeerRank`（Eq. 4）**：令同处第 $\ell$ 层的样本集为 $\mathcal{I}_\ell = \{j \in \{1,\dots,G\} : L_j = \ell\}$。对第 $k \in \{1,\dots,K_\ell\}$ 个子目标分 $s_{ik}$，仅在 $\mathcal{I}_\ell$ 内求居中排名 $r_{ik} \in [-1, 1]$（**绝对分差 $< 10^{-3}$ 判定为平局 Tie 共享均值排名**），加权（$\sum_{k=1}^{K_\ell} w_{\ell k} = 1$）得同层优势：
$$
\widetilde{A}_i = \begin{cases} \displaystyle\sum_{k=1}^{K_{L_i}} w_{L_i k}\, r_{ik} \in [-1, 1], & |\mathcal{I}_{L_i}| > 1, \\[6pt] 0, & |\mathcal{I}_{L_i}| = 1. \end{cases} \tag{Eq. 4}
$$

### 2.3 `HBA` 严格跨层保序数学证明与 Appendix B 完整算法流程（§3.3 Eq. 3, 5–6 & Alg. 1）
定义层间相对优势 $A_i^{\mathrm{level}} = L_i - \frac{1}{G}\sum_{j=1}^G L_j$（Eq. 3），合成总优势：
$$
A_i = \lambda_L A_i^{\mathrm{level}} + \lambda_w \widetilde{A}_i \tag{Eq. 5}
$$
- **严格跨层保序证明**：对同组内任意满足 $L_i > L_j$（故整数差 $L_i - L_j \ge 1$）的两个候选 $i, j$，组均值 $\bar{L}$ 相消，且因 $|\widetilde{A}_i| \le 1, |\widetilde{A}_j| \le 1 \implies \widetilde{A}_i - \widetilde{A}_j \ge -2$，必有：
  $$
  A_i - A_j = \lambda_L (L_i - L_j) + \lambda_w (\widetilde{A}_i - \widetilde{A}_j) \ge \lambda_L - 2\lambda_w
  $$
  故**当且仅当取 $\lambda_L > 2\lambda_w$**（论文取 **$\lambda_L = 1.0,\; \lambda_w = 0.25 \implies A_i - A_j \ge +0.5 > 0$**）时，高层级候选的总优势在任何情况下恒严格大于低层级候选；而当全组处于同一层（$A_i^{\mathrm{level}}=0$）时，$\lambda_w \widetilde{A}_i$ 自动提供无量纲细粒度排序梯度！
- **Appendix B `Algorithm 1` 核心循环**：每步抽 $|\mathcal{B}|=4$ 个 prompt $\to$ 每题采 $G=4$ 个程序 $\to$ 串行过 CAD–CAE 判 $L_i$ 与 $\{s_{ik}\}$ $\to$ 算 $A_i^{\mathrm{level}}$ 与按层分组 Tie-Aware `PeerRank` $\widetilde{A}_i$ $\to$ 按 **DAPO token-level 批均损失 + KL 正则**更新：
  $$
  \mathcal{L} = \mathcal{L}_{\mathrm{DAPO}}(\theta; \mathbf{A}) + \beta D_{\mathrm{KL}}(\pi_\theta \,\|\, \pi_{\mathrm{ref}}), \qquad \beta = 0.01 \tag{Eq. 6}
  $$

---

## 3. 实验口径、完整超参数表与核心消融数据（事实）

### 3.1 训练配置与完整超参数表（§4.2）
- **硬件与采样**：单张 NVIDIA H800 GPU；Prompt Batch $= 4$，组大小 $G = 4$（每批 `16` 条 rollout）；`lr = 5e-7`，`temperature = 0.9`，`top-p = 0.95`；
- **HBA 参数**：$\lambda_L = 1.0,\; \lambda_w = 0.25$，平局容差 $10^{-3}$，DAPO token-level 损失聚合，KL 权重 $\beta = 0.01$；推理期单轮直出，无需仿真循环。

### 3.2 全量测试集（`3,373` 题）跨模型主表（Table 1）与分层消融全表（Table 2）

| 模型 / 训练策略 | 阶段 | Valid CAD↑ | BBox↑ | CAE↑ | Disp.↑ | Stress↑ | Physics↑ | **Joint↑** | Tokens↓ |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `Claude Opus 5` | Direct | 73.82 | 42.31 | 70.71 | 46.52 | 49.87 | 8.42 | 7.29 | — |
| `GPT-5.6 Sol` | Direct | 62.41 | 35.61 | 56.69 | 46.58 | 35.75 | 16.87 | 15.51 | — |
| `DeepSeek-V4-Flash-Ascend` | Direct | 63.33 | 50.52 | 60.45 | 39.79 | 38.36 | 10.85 | 9.28 | — |
| `Ministral-3-3B` | Zero / SFT / **GRPO** | 1.27 / 95.55 / **98.99** | 0.62 / 78.33 / **94.22** | 1.07 / 92.68 / **97.45** | 0.68 / 64.63 / **84.32** | 0.65 / 66.50 / **81.20** | 0.24 / 40.50 / **59.29** | 0.12 / 37.36 / **58.05** | — |
| `Qwen3-4B` | Zero / SFT / **GRPO** | 18.56 / 94.25 / **99.14** | 11.41 / 77.73 / **91.25** | 17.55 / 91.49 / **96.92** | 12.24 / 63.09 / **84.44** | 13.93 / 63.27 / **81.83** | 1.22 / 39.19 / **57.40** | 0.74 / 36.64 / **55.71** | — |
| `SmolLM3-3B` | Zero / SFT / **GRPO** | 6.91 / 93.92 / **98.99** | 2.91 / 74.98 / **91.31** | 6.55 / 90.31 / **96.80** | 5.37 / 58.85 / **77.47** | 5.90 / 60.72 / **76.28** | 0.65 / 31.28 / **45.75** | 0.18 / 28.73 / **44.56** | — |
| `StarCoder2-3B` | Zero / SFT / **GRPO** | 10.94 / 93.74 / **98.96** | 3.91 / 74.50 / **92.05** | 10.29 / 90.16 / **97.15** | 8.81 / 56.95 / **76.67** | 8.98 / 58.43 / **74.12** | 1.04 / 28.94 / **43.14** | 0.56 / 26.33 / **41.65** | — |
| **`Qwen2.5-3B`（Table 2 消融）** | Zero-shot | 1.45 | 0.47 | 1.36 | 1.01 | 0.95 | 0.21 | 0.00 | 1002.41 |
| `Qwen2.5-3B` | SFT 基线 | 90.07 | 65.16 | 86.45 | 55.68 | 57.75 | 25.32 | 21.76 | 201.06 |
| `Qwen2.5-3B` | **Non-hierarchical Flat GRPO** | 98.40 | 60.90 | 83.60 | — | — | 23.40 | **18.80 (-2.96!)** | 199.78 |
| **`Qwen2.5-3B`** | **Direct HBA-GRPO** | **98.55** | **88.50** | **96.32** | **74.47** | **70.53** | **40.94** | **39.49 (+17.73)** | **195.46** |
| `Qwen2.5-3B`（串行三阶段） | `-> Geom -> Phys -> HBA` | 95.3 $\to$ 94.7 $\to$ **99.23** | 72.4 $\to$ 75.3 $\to$ **92.05** | 91.6 $\to$ 91.4 $\to$ **97.45** | — | — | 25.9 $\to$ 30.3 $\to$ **43.34** | 22.9 $\to$ 27.6 $\to$ **42.01** | 191.6 $\to$ **184.85** |

---

## 4. 对我们 Qwen3.8-27B 三轨项目（特别是 Track 3 cad_inspect.py 与 Track 2 SVG/Canvas）的落地启发（推论）

1. **`HBA`（$\lambda_L = 1.0, \lambda_w = 0.25$）是我们三轨“确定性硬检金字塔 + 视觉盲评”合成 RL 优势函数的首选数学骨架**：
   - **绝对禁止将语法/几何硬门禁与 VLM 美学分做线性加权！** 直接将 `cad_inspect.py`（Track 3）与 `check_2d_v2.mjs`（Track 2）映射为严格四层：
     - **$L=0$**：AST 违禁调用、运行报错、缺四格式导出（`STEP/3MF/STL/GLB`）或 OCCT 独立回读失败（2D 为控制台报错或 `__SCENE_READY__` 超时）；
     - **$L=1$**：非水密 2-流形、连通体数不匹配、包络盒越界（2D 为双分辨率文字/HUD 重叠裁切）；
     - **$L=2$**：**多零件两两布尔交集体积 $> \mathrm{tol}$ 发生干涉**，或修改 `DEFAULT_PARAMS` 探针几何不联动（2D 为逆序 `renderAt(t)` 不一致、纯主体零帧差假动或循环接缝跳变）；
     - **$L=3$**：全部确定性硬门禁 100% 通关——**仅对进入 $L=3$ 的同层样本触发 VLM Contact Sheet 盲评**，并用 Tie-Aware `PeerRank`（$10^{-3}$ 容差）对剖视图/爆炸图配合合理性、美学与代码精炼度做无量纲同侪排序！既根绝越级刷分，又省掉全部 $L < 3$ 失败 rollout 的 VLM 费用。
2. **复用 $L=2$ 单项封顶 $\min(1, \bar{v}/v)$ 与无参数特征脱敏造数法**：
   - 在构造多零件功能装配题（齿轮啮合、滑轨卡扣）时，抹掉参考源码硬编码常数、仅给拓扑配合语义与粗包络范围，逼 `Qwen3.8-27B` 在 `params.py` 中写出真正的参数化耦合公式。
