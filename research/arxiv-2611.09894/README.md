# 论文精读：Video-Coder: Reinforcing Agentic Coding for Video Generation（arXiv:2611.09894v1）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*Video-Coder: Reinforcing Agentic Coding for Video Generation*（2026-11-06）
- **作者与机构**：Chaoyang Wang, Kunyang Li, Yuzhang Shang\*（University of Central Florida）；Sicheng Gao, Radu Timofte（University of Würzburg）；Junan Hu（Microsoft Research）；Dongyang Chen（清华大学）；Yiyang Zhou, Huaxiu Yao（UNC-Chapel Hill）；Yong Jae Lee（UW–Madison）
- **原文与代码**：`https://arxiv.org/abs/2611.09894v1` · 代码仓：`https://github.com/CYWang735/Video-Coder` · HF：`https://huggingface.co/Video-Coder`
- **本地归档**：[paper.html（上游原文）](https://arxiv.org/abs/2611.09894) · [paper.txt（上游原文）](https://arxiv.org/abs/2611.09894) · `sources.json`（本地校验清单未发布）
- **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者发现的真实痛点

1. **像素扩散视频模型缺乏显式 3D 物理世界表征**：
   - Sora、Kling、Wan、HunyuanVideo、`MiniMax-H3` 等模型直接在像素或潜空间拟合分布，面对精确多物体计数（如“三个球从不同高度同时下落”）、遮挡关系、刚体碰撞反弹与指定运镜时频繁出现物体凭空消失、粘连变形或违反力学规律；
   - 先前代码辅助工作（如 `GPT4Motion`、`Video-CoCo`）仅在冻结闭源模型上做单轮或固定管线提示，从未针对下游终态视频质量对多模态编码 Agent 做端到端强化学习优化。
2. **代码动画 RL 的“早期全崩稀疏奖励”与“后期保守刷执行分”死结**：
   - 若只用终态视频质量奖励 $R_{\text{video}}$ 做 RL，早期策略频繁写出语法或相机缺失错误导致奖励全为 0，训练完全停滞（Table 3 实证 RL 零增益）；
   - 但若将代码可执行奖励 $R_{\text{exe}}$ 与 $R_{\text{video}}$ **固定权重相加**，策略会过度投机 $R_{\text{exe}}=1$ 的保底高分——**退化为编写极度保守、简单但稳妥不报错的平庸代码**，掩盖了 $R_{\text{video}}$ 的细粒度动态与构图梯度（Table 3 实证掉点 `-0.02`）。
3. **长轮次沙盒工作区残留作弊隐患**：
   - 在最多 100 轮的 Shell + 脚本交互中，Agent 极易依赖前序轮次遗留在目录中的缓存资产、旧视频文件或中间状态“凑”出通过假象，导致终稿脚本本身无法独立复现。

---

## 2. 方法论、数学公式与沙盒/验证器工程细节（含 Appendix 关键配置与 Prompt 要点）

### 2.1 “无纹理灰白泥模草稿视频（Clay Draft Video）”结构-外观解耦范式（Sec 3.1–3.2）
给定文本指令 $c$，编码 Agent $\pi$ 在多轮写-跑-改循环中生成动态 3D 场景程序 $f^{(t)}$：
$$
(v, \ell) = \mathcal{E}(f), \qquad
f^{(t)} = \pi\!\left(c,\, \big\{f^{(\tau)}, \ell^{(\tau)}, v^{(\tau)}\big\}_{\tau < t}\right)
$$
沙盒强制采用统一渲染标准：**无纹理灰白泥模着色（Untextured Gray Clay Shading）+ 固定分辨率 + 固定帧率**。产出的白模草稿视频 $v^{(T)}$ 仅编码精确的 **3D 几何结构、物体数量、物理/关键帧运动轨迹与相机运镜**，再将 $(c, v^{(T)})$ 送入冻结的下游视频生成模型（`MiniMax-H3` 或 `OmniWeaving`）合成逼真纹理光影。

### 2.2 四阶段造数管线与 `Video-Coder Harness` 三层反馈 + 防作弊重跑闸（Sec 3.1–3.2）

| 模块 / 阶段 | 核心工具与工程实现细节 | 确定性硬检与防作弊拦截规则 |
| --- | --- | --- |
| **1. Prompt 场景化清洗** | 从 `InternVid`、`OpenVid-1M`、`MiraData` 提取字幕，用 LLM 改写为显式规定**物体类别与数量、空间布局、运动过程、相机行为**的场景描述 | **源头剔除**依赖人物微表情、精细表面纹理等无法用 3D 几何原语 + 关键帧建模的题目 |
| **2. 教师轨迹 + GT 合成** | **`Gemini 3.8 Flash`** 接入 Harness 多轮迭代至匹配 Prompt（上限 $T_{\max}$ 轮），再将白模视频+Prompt 喂入 `MiniMax-H3` 合成参考真值视频 | 三级清洗：① 必渲染成功且无越界预算/坏工具调用；② 剔除静止/空帧/出画/退化视角；③ **`Seed2.0`** 评语义一致性达标 |
| **3. Harness 工具与三层反馈** | Shell 编辑脚本 + 两个验证工具：`check_script`（快速静态检查）与 `run_blender`（执行渲染白模视频） | ① **执行反馈**（语法/缺相机/缺渲染调用/Traceback）；② **内容硬检**（查格式、空帧、近似静止、主体移出视锥 + 场景摘要）；③ **视觉反馈**（回传**均匀间隔采样的多张视频帧图像**） |
| **4. 干净目录重跑验收闸** | Agent 提交终稿或触达上限时触发终验（Verification and Acceptance） | **绝不直接信任工作区已有输出**：将终稿脚本拷入**全新干净目录（Clean Directory）从头独立重跑**，仅当重跑再次 100% 通过全部静态、运行与内容硬检时才接收并导出 $v^{(T)}$ |

### 2.3 双重奖励时间步指数退火精确公式与 `GRPO` 目标（Sec 3.3 & Appendix A–B）
- **双重奖励精确定义**：
  - **执行奖励 $R_{\text{exe}} \in \{0, 1\}$**：当且仅当整条轨迹**所有工具调用格式正确**，且最终脚本经干净目录重跑成功渲染并通过全部内容硬检时赋 `1`，否则赋 `0`。
  - **视频质量奖励 $R_{\text{video}} \in [0, 1]$**（Appendix B Figs. 8–9）：RL rollout 时由 16 张 H100 上的 `MiniMax-H3` 实时生成成品视频，交由 **`Qwen3.8-omni-flash`** 对照 `(Text Prompt, Reference Video, Generated Video)` 从 **物体类别（Object Categories）、空间布局（Spatial Layout）、运动动力学（Motion Dynamics）、相机行为（Camera Behavior）** 四维打分并归一化至 $[0, 1]$。*（注：`paper.html` 中 Appendix A Figs. 5–7 系统 Prompt 与 Appendix B Figs. 8–9 裁判 Prompt 以外部 `.svg` 矢量图引用，正文与图注完整披露了三阶段共用同一 System Prompt 及上述四维评分契约。）*
- **时间步指数退火总奖励公式（Eq. 3）与组相对策略优化 `GRPO`（Eqs. 4–5）**：
$$
R = \alpha \cdot R_{\text{video}} + e^{-\frac{\texttt{steps}}{T}} \cdot R_{\text{exe}} \quad (\alpha = 0.5), \qquad
A_i = \frac{R_i - \mathrm{mean}(\{R_j\}_{j=1}^G)}{\mathrm{std}(\{R_j\}_{j=1}^G)}
$$
  其中 $\texttt{steps}$ 为当前全局训练步数，$T$ 为总训练步数（使 $R_{\text{exe}}$ 权重从初态 $1.0$ 平滑指数衰减至末态 $e^{-1} \approx 0.368$）；优化带 Clipped 比率与 $\beta_{\text{KL}} D_{\text{KL}}(\pi_\theta \| \pi_{\text{ref}})$ 的标准 GRPO 目标，并遵循 `DAPO` **对未完成（unfinished）rollout 置 Loss Mask 屏蔽梯度**。

---

## 3. 实验设置、完整超参数表与核心结果/负向消融（严格区分论文事实与分母）

> **手稿内部数据量前后不一致核查（事实勘误）**：论文在 Abstract、Sec 1、Sec 3.1 与 Sec 3.3 中均写明清洗后数据集为 **`Video-Coder-SFT-6k`（6k 条）与 `Video-Coder-RL-2k`（2k 条）**；但在 Sec 4.1（第 616–617 行）与 Sec 5 Conclusion（第 759 行）却写成 **`Video-Coder-SFT-10k` 与 `Video-Coder-RL-4k`**（疑为过滤前原始池命名残留）。引用时务必区分说明。

### 3.1 训练超参数与算力部署表（Sec 4.1）

| 配置维度 | Stage 1: SFT | Stage 2: Harness-Native Agentic RL (`GRPO`) |
| --- | --- | --- |
| **基座与优化器** | `Qwen3.5-9B` · `AdamW` | 初始化自 SFT Checkpoint · `AdamW` |
| **学习率 & Batch Size** | `LR = 1e-5` · `BS = 8` | `LR = 1e-6` · `BS = 8` · **Group Size $G = 8$** |
| **长程预算与截断处理** | 完整多轮教师轨迹（共用同一 System Prompt） | **最大交互轮数 `100` 轮** · **最大上下文 `120K` tokens** · Mask 未完成 rollout |
| **硬件集群与训练耗时** | 8× NVIDIA H100 | **8× H100 训策略 + 16× H100 部署 `MiniMax-H3` 支撑实时 rollout 合成**（全程约 **3 天**） |

### 3.2 `PhyGenBench` 完整 16 模型对比表（Table 1，`GPT-4o` 物理常识评分 $\in [0,1]$）

| 方法 | Mechanics↑ | Optics↑ | Thermal↑ | Material↑ | **Average↑** |
| --- | :---: | :---: | :---: | :---: | :---: |
| `HunyuanVideo` | 0.33 | 0.39 | 0.26 | 0.30 | 0.33 |
| `Cosmos-Predict2.5` | 0.30 | 0.33 | 0.41 | 0.39 | 0.35 |
| `LaVie` | 0.30 | 0.44 | 0.38 | 0.32 | 0.36 |
| `Pika` / `Open-Sora V1.2` | 0.35 / 0.43 | 0.56 / 0.50 | 0.43 / 0.44 | 0.39 / 0.37 | 0.44 / 0.44 |
| `CogVideoX` / `Vchitect-2.0` | 0.39 / 0.41 | 0.55 / 0.56 | 0.40 / 0.44 | 0.42 / 0.37 | 0.45 / 0.45 |
| `Kling` | 0.45 | 0.58 | 0.50 | 0.40 | 0.49 |
| `Gen-3` | 0.45 | 0.57 | 0.49 | 0.51 | 0.51 |
| `LTX-Video-2B` | 0.51 | 0.58 | 0.48 | 0.45 | 0.51 |
| `Video-CoCo`（代码作 CoT 基线） | 0.51 | 0.58 | 0.48 | 0.45 | 0.51 |
| `Wan2.2-TI2V-5B` | 0.55 | 0.58 | 0.53 | 0.50 | 0.54 |
| `OmniWeaving`（原版基线 A） | 0.48 | 0.56 | 0.43 | 0.39 | 0.48 |
| **`Video-Coder-9B` + `OmniWeaving`（零样本跨生成器迁移）** | **0.52** | **0.58** | **0.52** | **0.44** | **0.51 (+0.03)** |
| `MiniMax-H3`（原版基线 B） | 0.61 | 0.73 | 0.52 | 0.55 | 0.61 |
| **`Video-Coder-9B` + `MiniMax-H3`（全量）** | **0.68** | **0.79** | **0.60** | **0.61** | **0.67 (+0.06)** |

### 3.3 `VBench-2.0` 物理维度全表（Table 2）与奖励消融全表（Table 3）

| `VBench-2.0` 模型 | Mechanics↑ | Thermotics↑ | Material↑ | **Average↑** | `PhyGenBench` 消融变体（接 `MiniMax-H3`） | **Avg↑** | 负向机制归因 |
| --- | :---: | :---: | :---: | :---: | --- | :---: | --- |
| `Sora` | 62.22% | 43.36% | 64.94% | 56.84% | 1. Vanilla `MiniMax-H3` | 0.61 | 无显式 3D 结构与运动控制 |
| `Kling 1.6` | 65.55% | 59.46% | 68.00% | 64.34% | 2. `+ Video-Coder-SFT` | 0.63 | 仅模仿教师轨迹，自修泛化受限 |
| `HunyuanVideo` | 76.09% | 56.52% | 64.37% | 65.66% | 3. ⚠️ `+ RL w/o execution reward` | **0.63** | **RL 零增益：早期脚本崩盘拿不到 $R_{\text{video}}$** |
| `MiniMax-H3` | 67.59% | 47.22% | 48.94% | 54.58% | 4. `+ RL w/o video reward` | 0.64 | 仅保渲染不崩，缺运动与镜头细粒度优化 |
| `CogVideoX-1.5` | 80.80% | 67.13% | **83.19%** | 77.04% | 5. ⚠️ `+ RL w/o annealing`（固定权重） | **0.65** | **掉 `-0.02`：写保守平庸代码吃满 $R_{\text{exe}}=1$** |
| **`Video-Coder + H3`** | **88.67%** | **70.88%** | 75.02% | **78.19%** | 6. **`+ Video-Coder`（含退火）** | **0.67** | $\alpha \in \{0.5, 0.6\}$ 最优（Fig. 4）；0.4 欠拟合视频、0.7 伤早期稳定性 |

---

## 4. 作者踩坑复盘与对我们 Qwen3.8-27B 三轨项目的落地启发（明确标注工程推论）

1. **【论文实证大坑 → 固定权重“可执行保底分 + 视觉质量分”必诱发保守偷懒（Conservative Reward Hacking）】**：
   - 论文事实：Table 3 第 5 行直接证明，固定给 $R_{\text{exe}}=1$ 会让策略写出极简平庸但永不报错的场景来吃保底优势。
   - *【我方工程推论】*：我方后续在 `Qwen3.8-27B` 上做三轨强化学习时，**绝不能将“零报错/水密流形通过”作为高额固定加项贯穿全程**——应采用 **硬门控乘法奖励**（硬检不过直接判 $0$ 或 `-1`，过关后梯度 100% 由五维美学/几何精度差决定）或本文的 $e^{-\text{steps}/T}$ 退火调度。
2. **【论文实证防作弊 → 终稿必须拷入“全新干净目录”从零重跑验收】**：
   - 论文事实：Harness 在提交时忽略当前工作区视频，强制将终稿脚本放入空目录从零重跑重过硬检。
   - *【我方工程推论】*：多文件前端与 CAD 工程在 50–150 轮交互中极易残留旧轮导出的 `.step / .glb`、未清理缓存或死模块；我方三轨验收器必须在 EOS 后**仅将源码拷入全新只读隔离 `/tmp` 目录重新拉起本地 HTTP / `CadQuery` 从头构建导出**，彻底封死靠历史残留产物混过硬检的路径。
3. **【论文实证边界纪律 → 源头砍掉“代码原语不可表达题” + 确定性防静止/防出画秒杀】**：
   - 论文事实：`VBench-2.0` 的 `Material` 落后 `CogVideoX-1.5`（`75.02% vs 83.19%`）而 `Mechanics` 狂飙至 `88.67%`，清晰界定程序化代码的绝对主场在**精确几何结构、物体计数与力学时序**而非精细材质纹理。
   - *【我方工程推论】*：完全契合我方三轨不越界声明，且 `run_blender` 的相机视锥出画/空帧/静止检测可直接强化我方 Three.js 与 2D `renderAt(t)` 前置硬检。
