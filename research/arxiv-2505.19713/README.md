# 论文精读：CAD-Coder: Text-to-CAD Generation with Chain-of-Thought and Geometric Reward（arXiv:2505.19713v3, NeurIPS 2025）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*CAD-Coder: Text-to-CAD Generation with Chain-of-Thought and Geometric Reward*
- **作者与机构**：Yandong Guan, Xilin Wang, Ximing Xing, Jing Zhang, Qian Yu†（北京航空航天大学软件学院 Beihang University）, Dong Xu（香港大学 The University of Hong Kong）
- **发表会议与链接**：NeurIPS 2025（v3 更新于 2025-10-21）· 原文：`https://arxiv.org/abs/2505.19713v3`
- **本地存档**：[paper.html（上游原文）](https://arxiv.org/abs/2505.19713) · [paper.txt（上游原文）](https://arxiv.org/abs/2505.19713) · `sources.json`（本地校验清单未发布）
- **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者亲踩的初始大坑

> **同名论文编号权威消歧（核实事实）**：2025 年 5 月 arXiv 同期出现了**三篇互不隶属的同名 `CAD-Coder` 论文**，旧 `PAPERS.md` 极易张冠李戴：
> 1. **`arXiv:2505.19713`（本文，北航 Qian Yu 组 + 港大 Dong Xu，NeurIPS 2025）**：`Text-to-CadQuery`，提出 `8K` 严苛清洗 SFT + `1.5K` 六步工程 `<think>` CoT + `Chamfer + Format` 双奖励 GRPO；
> 2. `arXiv:2505.14646`（MIT Faez Ahmed 组，Anna C. Doris et al.）：单视图图像生成 CadQuery 的开源 VLM SFT 工作（无 RL）；
> 3. `arXiv:2505.08686`（Changqi He et al.）：文本引导 CAD 文件代码生成。本笔记严格对应 **`2505.19713v3`**。

作者将 `Text-to-CAD` 重构为生成可直接由 OpenCascade 内核编译校验的 Python `CadQuery` 脚本，并在 `Qwen2.5-7B-Instruct` 全参训练与附录消融中亲踩了**四个极具实战价值的工程大坑**：

1. **通用旗舰大模型零样本写 CadQuery 几乎不可用（Table 1）**：
   - 未经微调直出时，`GPT-4o` 代码失效率（`IR`）高达 **`93.00%`**，`Qwen2.5-72B` 达 **`82.64%`**，`Qwen2.5-7B` 达 **`98.83%`**，即便 `Claude-3.7-Sonnet` 与 `DeepSeek-V3` 也有 **`47.03%` 与 `51.96%`** 无法编译出合法实体（高频幻觉如凭空调用不存在的 `Workplane.scale()` 方法，App. C Stage 6）。
2. **大坑一：SFT 数据“贪多必失”——`8K` 严苛精品集全面反杀 `8.75×` 更大的 `70K` 数据集（§4, §5.2 Table 3）**：
   - 自动化合成管线共得到 `110K` 可执行代码三元组。若用 `70K` 中等精度集（$\mathrm{CD}_{\mathrm{gt}} < 10^{-3}$）做 Stage 1 SFT 再跑相同 CoT+GRPO，最终测试集 `Mean CD = 9.89`、`IR = 3.21%`；
   - 反之**狠心砍掉近 90% 样本，仅用 `8K` 极高精度集（$\mathrm{CD}_{\mathrm{gt}} < 10^{-4}$）做 SFT**，`Mean CD` 大幅压降至 **`6.54`（降低 `-33.9%`）**，`IR` 砍半至 **`1.45%`**！因为参数化建模中微小的坐标偏移或拉伸方向瑕疵会严重毒化 LLM 的空间坐标映射先验。
3. **大坑二（Appendix B 崩溃实录）：只给纯几何 Chamfer 奖励、不挂格式护栏，GRPO 在 `~200 步` 彻底瘫痪！**
   - Appendix B 专门记录了一次训练事故：关掉格式奖励 $R^{\mathrm{fmt}}$，仅保留 `Chamfer Distance` 几何奖励跑 GRPO。结果**训练仅约 `200` 步后，模型开始偏离代码块格式并大量吐出非法 CadQuery 语法**；由于 `CD` 必须靠脚本成功编译出网格才能计算，一旦组内采样全部执行失败，奖励全为 `0`、组内优势方差归零，RL 学习信号彻底断流停摆！
4. **大坑三（Appendix F Fig. S4 失败剖析）：表面点云稀疏采样在“薄壁与内部空腔”上诱发 Reward Hacking**：
   - 均匀表面点云采样的 `CD` 对极薄壁特征与内部封闭腔体（Fig. S4c）采样稀疏，模型会利用点云盲区钻空子；此外在多子件空间拼接错位（Fig. S4a）与拉伸/布尔切除符号混淆（Fig. S4b `extrude` vs `cut`）上仍存在明显短板。

---

## 2. 方法论、精确数学公式与工程细节（含 Appendix 超参/阈值/证明要点）

### 2.1 `110K` 自动化几何校验合成管线与三级精度分层（§4 & Fig. 4）
针对 `Text2CAD` 只有 `178K` `(描述 L, 命令序列 S, 真值网格 M_gt)` 而无 Python 代码的痛点，作者用 `DeepSeek-V3` 对每条 $(L, S)$ 采样多份候选 `CadQuery` 代码，在 `CadQuery 2.3.1` 中编译过滤并选取与 $M_{\mathrm{gt}}$ 点云 `CD` 最小者，构建 **`110K` 合法三元组**，按几何误差严格分三档：
- **高精黄金档（`8K` 条，$\mathrm{CD}_{\mathrm{gt}} < 1 \times 10^{-4}$）**：几乎与真值网格严丝合缝（Fig. 5 第三行），作为唯一 Stage 1 SFT 主训练集；
- **中等精度档（`70K` 条，$\mathrm{CD}_{\mathrm{gt}} < 1 \times 10^{-3}$）**：存在轻微局部几何偏差（Fig. 5 第二行），消融证实混入 SFT 有害；
- **高难硬骨头档（`32K` 条，$\mathrm{CD}_{\mathrm{gt}} > 1 \times 10^{-3}$）**：专门作为复杂几何题源，提示 `DeepSeek-V3` 生成带 `<think>` 规划的代码，经 `CD` 严筛后再**逐条人工修正**，精炼出 **`1.5K` 高质量 CoT 冷启动样本**。

### 2.2 六步工程师空间规划 `<think>` 模板与防 API 幻觉硬约束（§3.2 & App. C）
在 SFT 与 GRPO 之间加入 `1.5K` CoT 冷启动，Prompt 强制每步思考不超过 `50` 词，并在 `<think>...</think>` 内严格执行 **6 步工程拆解**（App. C 原文模板）：
1. **Stage 1（部件拆解）**：拆分子部件，识别局部坐标系、欧拉角旋转（如 `[-90, 0, -90]`）与平移向量；
2. **Stage 2（坐标系规划）**：解析局部到全局坐标变换顺序（`.rotate()` 与 `.translate()`）；
3. **Stage 3（2D 草图策略）**：规划闭合线段/圆弧回路（`moveTo / lineTo / close`）与缩放因子；
4. **Stage 4（拉伸与布尔规划）**：明确正/反法向拉伸深度（如 `-0.375` vs `+0.375`）及新建或 `.union()` 合并；
5. **Stage 5（代码组织）**：规划可读的模块化变量序列（`part1`, `part2`, 最终结果必须赋给变量 `r`）；
6. **Stage 6（CadQuery 缩放防幻觉铁律）**：*“Directly scale the size, define a scaling factor variable, and apply directly to all coordinates and dimensions. Don't try to use a non-existent `.scale()` method on Workplane objects.”*

```python
# Appendix C CAD-Coder 真实多子件欧拉旋转+平移合成代码范式（严禁 .scale()，直接预乘缩放坐标）：
import cadquery as cq
part1 = (cq.Workplane("XY").moveTo(0.0, 0.0).lineTo(0.375, 0.0).lineTo(0.375, 0.375)
         .lineTo(0.0, 0.375).close().extrude(-0.375).rotate((0,0,0), (1,0,0), 90).translate((0.0, 0.0, 0.0)))
part2 = (cq.Workplane("XY").moveTo(0.0, 0.0).lineTo(0.25, 0.0).lineTo(0.25, 0.25)
         .close().extrude(0.375).rotate((0,0,0), (1,0,0), 90).rotate((0,0,0), (0,0,1), 90).translate((0.375, 0.125, 0.0)))
r = part1.union(part2)
```

### 2.3 分段线性 Chamfer 几何奖励 + 正则格式护栏公式（§3.2 Eq. 2–3）
在 Stage 2 GRPO 中，直接使用 `Text2CAD` 全量 **`150K` 训练描述与真值网格 $M_{\mathrm{gt}}$**（无需配对代码！），每题采样 $k = 8$ 个候选 $\{C_1, \dots, C_k\}$：
1. **双向平方 Chamfer Distance（Eq. 2）**：对归一化真值网格与预测网格均匀采样稠密点云 $Q, P$（遵循 `Text2CAD` 归一化协议，App. A 指出 `CAD-LLaMA` 与 `CAD-Translator` 因未开源归一化细节导致 CD 数值量级相差 10 倍，不可直接横比）：
   $$
   \mathrm{CD}(P, Q) = \frac{1}{|P|}\sum_{x \in P} \min_{y \in Q} \|x - y\|_2^2 + \frac{1}{|Q|}\sum_{y \in Q} \min_{x \in P} \|x - y\|_2^2 \tag{Eq. 2}
   $$
2. **分段连续几何奖励 $R_i^{\mathrm{geo}} \in [0, 1]$（§3.2）**：
   $$
   R_i^{\mathrm{geo}} = \begin{cases} 1.0, & \text{编译成功且 } \mathrm{CD} < 1 \times 10^{-5} \\[5pt] 0.01 + 0.99 \times \dfrac{0.5 - \mathrm{CD}}{0.5 - 10^{-5}}, & \text{编译成功且 } 1 \times 10^{-5} \le \mathrm{CD} \le 0.5 \\[6pt] 0, & \text{编译执行失败 或 } \mathrm{CD} > 0.5 \end{cases}
   $$
   - **三区间几何物理含义（§5.2 Fig. 5）**：
     - $\mathrm{CD} > 10^{-1}$：拓扑或尺寸严重失真；
     - $10^{-4} < \mathrm{CD} \le 10^{-1}$：主体结构近似但局部孔位/厚度偏移（Stage 2 连续线性奖励重点拉升区）；
     - $\mathrm{CD} \le 10^{-4}$：几何几乎与真值完全重合（也是 `8K` SFT 准入红线）。
3. **正则格式护栏 $R_i^{\mathrm{fmt}} \in \{0, 1\}$**：正则校验输出是否同时包含 `<think>...</think>` 推理块与 ```` ```python ... ``` ```` 纯代码块，齐备得 `1`，否则得 `0`（彻底根治 App. B 的 200 步崩盘）。
4. **合成奖励与 Token 级 GRPO 损失（Eq. 3）**：由 $R_i = \lambda_{\mathrm{geo}} R_i^{\mathrm{geo}} + \lambda_{\mathrm{fmt}} R_i^{\mathrm{fmt}}$ 计算组内相对优势 $\hat{A}_{i,t}$：
   $$
   \mathcal{L}_{\mathrm{GRPO}}(\theta) = \mathbb{E}\!\left[\frac{1}{k}\sum_{i=1}^k \frac{1}{|C_i|}\sum_{t=1}^{|C_i|} \min\bigl(r_{i,t}(\theta)\hat{A}_{i,t},\; \operatorname{clip}(r_{i,t}(\theta), 1-\varepsilon, 1+\varepsilon)\hat{A}_{i,t}\bigr) - \beta D_{\mathrm{KL}}(\pi_\theta \parallel \pi_{\mathrm{ref}})\right] \tag{Eq. 3}
   $$

---

## 3. 实验口径、完整超参数表与核心消融数据（事实）

### 3.1 全阶段训练超参数与硬件时长表（§5 & App. A）

| 阶段 | 数据规模与来源 | 硬件集群与框架（`Qwen2.5-7B-Instruct` 全参微调） | 关键超参数与训练时长 |
|---|---|---|---|
| **Stage 1a: SFT** | `8K` 高精集（$\mathrm{CD}_{\mathrm{gt}} < 10^{-4}$） | 8× NVIDIA A800 (80GB) · DeepSpeed ZeRO-2 | AdamW, `3 epochs`, `bs = 64`, `lr = 1e-5` · **7 小时** |
| **Stage 1b: CoT 冷启** | `1.5K` 人工精修六步 CoT | 同上 | 全参微调 `2 epochs`, `batch_size = 384` |
| **Stage 2: CAD-GRPO** | `150K` `Text2CAD` `(L, M_gt)` | 8× A800 · `verl` + `vLLM` + Ray + `CadQuery 2.3.1` | `1 epoch`, `bs = 384`, 组采样 $k = 8$, **KL $\beta = 0.001$** · **146 小时** |

### 3.2 主表、组件消融与 `8K vs 70K` 数据质量对决（Table 1, 2 & 3，CD 指标均 $\times 10^3$）

| 模型 / 训练配置 | Mean CD ($\times 10^3$) ↓ | Median CD ($\times 10^3$) ↓ | 代码失效率 IR (%) ↓ | 实验发现 |
|---|---:|---:|---:|---|
| `Claude-3.7-Sonnet` | 186.53 | 134.16 | 47.03% | 闭源强模型近半数脚本语法/几何编译报错 |
| `GPT-4o` | 133.52 | 45.91 | 93.00% | 93% 无法执行出合法 CadQuery 实体 |
| `DeepSeek-V3` | 186.69 | 107.57 | 51.96% | 合成教师本身零样本直出也有超半数报错，必须多采样+沙盒过滤 |
| `Qwen2.5-72B` / `Qwen2.5-7B` | 209.41 / 202.35 | 153.81 / 169.86 | 82.64% / 98.83% | 基座零样本几乎全军覆没 |
| `Text2CAD`（专用命令序列模型） | 29.29 | 0.37 | 3.75% | 仅支持简单草图拉伸，复杂件长尾均值误差大 |
| `SFT Only`（仅 8K SFT） | 74.55 | 0.33 | 5.33% | 掌握基本语法，但多部件空间组合频出大误差（$\mathrm{CD}>0.1$） |
| `Ours w/o SFT`（无 SFT 直训） | 76.20 | 0.95 | 5.33% | 缺失 CadQuery 语法先验，中位误差恶化 `5.6×` |
| `Ours w/o CoT`（8K SFT + GRPO） | 17.34 | 0.20 | 4.95% | 几何奖励将 Mean CD 砍掉 `76.7%`，但无规划失效率仍近 5% |
| `Ours w/ 70K SFT`（宽松 70K + CoT + GRPO） | 9.89 | 0.18 | 3.21% | **反面铁证：8.75× 更大但含轻微几何偏差的数据拖累最终上限** |
| **`CAD-Coder Full`（8K SFT + 1.5K CoT + GRPO）** | **6.54** | **0.17** | **1.45%** | **严苛小数据 SFT + 工程规划 CoT + 双奖励 GRPO 全面最优** |

*(补充事实：Appendix E Fig. S3 证实训练后的模型虽未训过编辑数据，已涌现出按自然语言修改尺寸、移除部件、调整位姿的指令级 CAD 编辑能力。)*

---

## 4. 对我们 Qwen3.8-27B 三轨项目（特别是 Track 3 cad_inspect.py 与 Track 2 SVG/Canvas）的落地启发（推论）

1. **`8K` 完胜 `70K` 直接验证我们“宁缺毋滥、绝不拿中低质轨迹凑数量”的造数铁律**：
   - 在参数化 CAD 与精密 2D 动效中，“能跑但尺寸/位置差一点”的亚健康 SFT 样本会直接污染 27B 权重的空间坐标直觉，导致后续 RL 都救不回来（`Mean CD 9.89 vs 6.54`，`IR 3.21% vs 1.45%`）。所有自产轨迹必须严卡硬检 100% 全过 + 盲评高分准入。
2. **用 `cad_inspect.py` 的实体布尔内核与剖视/爆炸图彻底攻克 Appendix F 三大死穴**：
   - CAD-Coder 暴露的三大失败模式——**多子件装配错位（Fig. S4a）、`extrude/cut` 混淆（S4b）、薄壁/内腔点云稀疏刷分（S4c）**——恰恰是表面点云 `CD` 的盲区！我们的 `cad_inspect.py` 通过 **OCCT 精确体积/包络比对 + `Voxel IoU` + 孔轴贯穿探针 + 多零件两两布尔交集零干涉硬检 + `section_view.png`（直接切开看内腔壁厚！）/ `exploded_view.png` 视觉自检**，从内核与视觉双通道彻底封死这三类漏洞。
3. **常驻协议格式护栏 + 前置封杀高频 API 幻觉**：
   - 谨记 Appendix B `~200` 步死锁教训，任何 RL 阶段必须保留格式/工具协议合规奖励以维持非零梯度方差；
   - 同时把 `Workplane.scale()` 等高频不存在 API 直接写入 AST 静态检查器与系统提示词前置拦截。
4. **借鉴六步 `<think>` 空间变换纪律，强化多模块 `assembly.py` 位姿自检**：
   - 针对 Fig. S4a 暴露的多部件欧拉旋转与平移拼接错位，我们在采集 `kimi-k3.1-pro` 长程轨迹时应保留其原生第一人称局部-全局坐标推导 `<think>`，并强制在首轮装配后查看 `views_grid.png + exploded_view.png` 做小步 `Edit` 对齐微调。
