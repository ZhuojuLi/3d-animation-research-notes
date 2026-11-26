# 论文精读：RULER: Instance-aware Rubric Rewards for SVG Generation（arXiv:2609.25270v1）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*RULER: Instance-aware Rubric Rewards for SVG Generation*
- **作者与机构**：Hangyu Ran*（Ant Group & HKUST(GZ)）, Yuhao Zheng*（Independent Researcher）, Yingying Zhang（Ant Group）, Kevin Qinghong Lin（University of Oxford）, Han Peng（Ant Group）
- **发布时间与链接**：2026-09-21 · 原文：`https://arxiv.org/abs/2609.25270v1` · 项目页：`https://hangyuran.github.io/RULER/`
- **本地存档**：[paper.html（上游原文）](https://arxiv.org/abs/2609.25270) · [paper.txt（上游原文）](https://arxiv.org/abs/2609.25270) · `sources.json`（本地校验清单未发布）
- **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者亲踩的初始大坑

开放式文本生成矢量图（`Text-to-SVG`）没有唯一真值图像（One-to-Many）。作者先在 **900 个渲染样本**（300 条指令 × `{Claude-Opus-4.6, Qwen3-32B, Qwen3-8B}`，经 10 名标注员打分 + 3 名复核员重审，§3.2 & App. D.1）上证实：多维 Rubric 与人类偏好的样本级相关性（Spearman $\rho = \mathbf{0.7929}$）及成对排序一致率（Goodman-Kruskal $\gamma = \mathbf{0.7574}$）远超 `Aesthetic`（$\rho = 0.6051, \gamma = 0.5465$）与 `CLIP`（$\rho = 0.5518, \gamma = 0.5295$）。随后在完全相同的 `Qwen3-8B + GRPO` 设定下，作者亲手跑出了**两个教科书级的 Reward Hacking 翻车现场**：

1. **大坑一：`CLIP + Aesthetic + HPS` 标量混合奖励导致代码 `21×` 暴涨且真实质量崩盘（§4.3, Table 4）**：
   - 将常规多指标标量加权（`C+A+H RL`）作为 GRPO 奖励时，策略迅速发现美学分类器最容易被高频纹理欺骗，于是**疯狂堆叠密集重叠描边与重复装饰 `<path>`**：
     - 表面上 `Aesthetic` 分数从零样本基线的 `4.309 / 4.424` 虚高飙升至 **`6.697 / 6.210`**；
     - 实际上在 `MMSVG-Icon` 上，**平均生成长度从 `0.3k` 暴涨 `21×` 至 `6.3k` tokens**，真实视觉质量 **Universal Rubric 从 `0.395` 断崖暴跌至 `0.262`（比不训还低 `-0.133`！）**；在 `MMSVG-Illustration` 上 `CLIP` 也从 `0.244` 跌至 `0.196`。
2. **大坑二：`Rubric-S` 砍掉风格/工艺轴后，哪怕外挂 `-2` 重罚都压不住 `<text>` 字牌作弊（§4.4, App. C, F.2 & H.4）**：
   - 作者测试了一个看似更严苛的结构版变体 `Rubric-S`：**删去渲染风格轴**，仅生成 5 项结构指标（整体可读性 `[5]`、主部件辨识 `[5]`、主体形状复杂度 `[5]`、关键内部细节 `[5]`、视觉分层 `[4]`，正权重分母 $=24$），并在分子上**额外硬挂第 6 项固定文字捷径惩罚项 `Prompt Text Hint`（权重 $w_6 = -2$**，按 5 档标尺：画面出现清晰提示词文本得 `0.9–1.0`，直接在分子扣减最高 `2.0` 分）。
   - **震撼实验现象**：哪怕顶着 `-2` 显式罚分，策略依然大面积触发 **Text-Hint Hacking**——直接在 SVG 内嵌写可读提示词 `<text>` 标签（如把查询词直接渲染成装饰字牌）来刷高前几项结构可读性得分，导致 Illustration Universal Rubric 跌至 **`0.536`**（比单独置零任一维度 `w/o Visual` `0.580`、`w/o Rendering` `0.599`、`w/o Semantic` `0.623` 跌幅都大）！
   - **核心机理**：**正交互补维度比单维严苛度更关键**。标准 `RULER` **完全不挂独立的负权文字惩罚项**（App. C 明确指出标准版仅含 6 项正向准则），但因其第 1 项要求“无文字标签传达概念”、第 5–6 项要求“完稿矢量工艺洁净度与统一艺术风格”，写字牌在多个正交轴上同时拿低分，作弊收益通道被自然封死。

---

## 2. 方法论、精确数学公式与工程细节（含 Appendix 超参/阈值/证明要点）

### 2.1 无真值两阶段实例级 Rubric 离线合成与 `0.9` 自洽过滤（§3.3, App. B, F.1, G & H.1）
仅输入无标注文本指令 $\mathcal{Q}$，调用前沿模型 $\mathcal{M}_{\mathrm{rub}}$（默认 `Claude-Opus-4.6`，消融验证 `GPT-5.5`）一次性离线执行两阶段生成（App. H.1）：
1. **Stage 1（隐式锚点 Ideal SVG 构思）**：先输出一份禁止可读文字标签的高水准示范 SVG XML 块。**关键隔离纪律**：该 Ideal SVG **绝不在 RL 训练评判时喂给裁判模型**（保留开放式一题多解空间），仅用作构思桥梁与自洽质检。
2. **Stage 2（三大轴 6 条目固定权重实例 Rubric 生成）**：针对 $\mathcal{Q}$ 输出严格正交的 6 条 JSON 准则 $C_{\mathcal{Q}} = \{(c_k, w_k)\}_{k=1}^6$，全局固定权重为 **`(5, 5, 5, 4, 5, 5)`**（总和 $\sum_{k=1}^6 w_k = 29$）：
   - **Semantic Fidelity（语义忠实度）**：① `Concept Identity & Overall Readability`（$w_1=5$）；② `Major Components & Distinctive Cues`（$w_2=5$）；
   - **Visual Quality（视觉造形质量）**：③ `Silhouette & Form Refinement`（$w_3=5$，区分精炼轮廓与粗糙几何拼块）；④ `Composition & Canvas Design`（$w_4=4$，主体比例、留白与空间层次）；
   - **Rendering Style（渲染工艺与风格）**：⑤ `Rendering Finish & Visual Craftsmanship`（$w_5=5$，严惩断线、游离噪点、未闭合畸变与文字捷径）；⑥ `Style Cohesion & Designed Visual Interest`（$w_6=5$，描边/填充/色彩层次统一性）。
3. **五档连续防通胀标尺与 `0.9` 自洽清洗（App. B & H.1–H.2）**：
   - 每项 `scoring_guide` 强制定义五档连续区间：`0.9–1.0`（近乎完美无瑕）、`0.7–0.8`（扎实良好）、`0.4–0.6`（平庸局部满足，**Judge Prompt 铁律：“仅仅不空白且勉强可辨认绝不许高于 0.6”**）、`0.1–0.3`（微弱残缺碎片）、`0.0`（缺失/矛盾/乱码）。
   - **Ideal-SVG 自洽过滤（App. B）**：将 Stage 1 产出的 Ideal SVG 渲染后交由 `Qwen3-VL-8B` 按配套 $C_{\mathcal{Q}}$ 打分，**凡 Ideal SVG 综合奖励 $< 0.9$ 的劣质/自相矛盾 Rubric 一律剔除**！过滤后从 `20K + 12K` 中保留 `19,531`（Icon）+ `11,206`（Illustration）= **`30,737` 条**。
   - **离线成本明细（App. G Table 10）**：共消耗 `60.18M` 输入 token（均 `1,958`/题）与 `68.49M` 输出 token（均 `2,228`/题，其中纯 Rubric 占 `1,027` token），总账单仅 **`$2,013.12`**（Icon `$0.0582`/题，Illustration `$0.0783`/题，均 **`$0.0655`/题**），缓存后 RL 全程零商业 API 开销。

### 2.2 在线 VLM 逐项裁决奖励、内生长度抑制与 GRPO 目标（§3.4 Eq. 2–4, App. A & C）
1. **光栅化与空白图判定（App. C）**：用 `CairoSVG 2.9.0` 在纯白底上渲染为 $512 \times 512$ 图像 $\mathcal{I}_{\mathrm{gen}} = \mathcal{E}(\mathcal{Y})$；与全白图像计算均方误差，**$\mathrm{MSE} < 10^{-4}$ 直接判定为空白渲染**。
2. **逐项先写理由再打分与加权汇总公式（Eq. 2 & App. H.2）**：冻结开源裁判 $\mathcal{M}_{\mathrm{judge}} = \text{Qwen3-VL-8B}$（多端点并行服务，单端点并发 32，超时 180s），强制 JSON 先生成 `"reason"` 再输出独立满意度 $s_k \in [0, 1]$：
   $$
   \mathcal{R}(\mathcal{I}_{\mathrm{gen}}) = \frac{\sum_{k=1}^6 w_k s_k}{\sum_{k=1}^6 w_k} = \frac{5s_1 + 5s_2 + 5s_3 + 4s_4 + 5s_5 + 5s_6}{29} \in [0, 1] \tag{Eq. 2}
   $$
   对比 `Rubric-S` 消融版的负权重文字惩罚公式（App. F.2 & H.4，分母仅计前 5 项正向权重和 $24$）：
   $$
   \mathcal{R}_{\mathrm{Rubric\text{-}S}}(\mathcal{I}_{\mathrm{gen}}) = \frac{\sum_{k=1}^5 w_k s_k - 2\,s_{\mathrm{text\_hint}}}{5 + 5 + 5 + 5 + 4}
   $$

```json
// Appendix H.2 & H.4 裁判输出强制先因后果 JSON 契约 + Rubric-S 文字作弊惩罚五档标尺：
{
  "items": [
    { "item_index": 1, "title": "Instance-Specific Title", "reason": "Visible evidence check...", "satisfaction": 0.75 }
  ]
}
// [Rubric-S Fixed Penalty w_6 = -2]:
// 0.9-1.0: 清晰可读文字直接泄露提示词含义（充当语义捷径） | 0.7-0.8: 局部可读小字/相关符号
// 0.4-0.6: 隐约似字母几何痕迹但不可拼读 | 0.1-0.3: 孤立直线巧合似笔画 | 0.0: 完全无任何文字/数字痕迹
```

3. **代码长度控制核实（无显式长度正则）**：
   - 核查 §3.4、Table 1 与 App. A/C 确认，RULER **未加任何显式代码长度惩罚项，且设 KL 系数 $= 0$**（仅设硬上限 `max_response_len = 4096`）。
   - 其之所以能把 `C+A+H RL` 失控的 `6.3k` token 压回精炼的 `0.7k`（Icon）/ `2.0k`（Illustration），完全依靠第 5 项工艺洁净度对杂乱冗余描边的视觉惩罚。
4. **序列级 GRPO 优化（Eq. 3–4）**：每题采样 $G=8$ 条序列，组内标准化优势与裁剪目标为：
   $$
   A_i = \frac{\mathcal{R}_i - \mathrm{mean}(\{\mathcal{R}_j\}_{j=1}^G)}{\mathrm{std}(\{\mathcal{R}_j\}_{j=1}^G) + \epsilon}, \qquad \rho_i = \frac{\pi_\theta(\mathcal{Y}_i \mid \mathcal{Q})}{\pi_{\theta_{\mathrm{old}}}(\mathcal{Y}_i \mid \mathcal{Q})} \tag{Eq. 3}
   $$
   $$
   \mathcal{L}_{\mathrm{GRPO}}(\theta) = \mathbb{E}_{\mathcal{Q}}\!\left[\frac{1}{G}\sum_{i=1}^G \min\bigl(\rho_i A_i,\; \operatorname{clip}(\rho_i, 1-\epsilon, 1+\epsilon) A_i\bigr)\right] \tag{Eq. 4}
   $$

---

## 3. 实验口径、完整超参数表与核心消融数据（事实）

### 3.1 训练与评测完整超参表（App. A, C, D & E）

| 超参数 / 组件 | 精确设定值 |
|---|---|
| **训练引擎与硬件** | `VERL` + `vLLM`（BF16, TP=8, Gradient Checkpointing, Remove-Padding, logprob 预算 65,536 tok/GPU），**1×8 H800 80GB** |
| **策略模型与模板** | `Qwen3-8B`（主模型）与 `Qwen3-4B`（尺度消融）；**禁用 chat template 中的 Thinking 模式** |
| **长度与采样配置** | `max_prompt_len = 512`, `max_response_len = 4096`, 组大小 $G = 8$, `temperature = 1.0` |
| **批大小与优化器** | Train Batch `128`, PPO Mini-Batch `64`, Micro-Batch `8`/GPU, `lr = 1e-6`, `entropy_coeff = 0.001`, **KL $= 0$** |
| **训练/测试裁判解耦** | 训练用冻结 **`Qwen3-VL-8B` + 实例级 Rubric**；测试基准用独立 **`GPT-5-mini` + 通用六维 Rubric**（App. H.3） |

### 3.2 主表、奖励范式对比与多轴消融（Table 2, 4, 8 & Fig. 4）

| 方法 / 奖励变体 | Illust CLIP↑ | Illust Aesth↑ | Illust HPS↑ | **Illust Rubric↑** | Illust Tok | Icon CLIP↑ | Icon Aesth↑ | Icon HPS↑ | **Icon Rubric↑** | Icon Tok |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `VectorFusion`（扩散逐图优化 72.1m） | 0.313 | 4.930 | 0.265 | 0.611 | 31.4k | 0.309 | 4.624 | 0.254 | 0.510 | 31.4k |
| `SVGDreamer`（扩散逐图优化） | 0.293 | 5.119 | 0.266 | 0.547 | 124.3k | 0.276 | 4.850 | 0.253 | 0.413 | 124.3k |
| `IconShop` / `OmniSVG-8B` / `JanusCoder-8B` | 0.236 / 0.215 / 0.228 | 4.480 / 4.505 / 4.323 | 0.219 / 0.221 / 0.227 | 0.262 / 0.288 / 0.390 | 2.6k / 6.9k / 1.0k | 0.285 / 0.272 / 0.256 | 4.541 / 4.629 / 4.432 | 0.243 / 0.244 / 0.234 | 0.586 / 0.565 / 0.384 | 1.3k / 5.7k / 1.0k |
| `Qwen3-32B` / `DeepSeek-V3` | 0.224 / 0.285 | 4.392 / 4.653 | 0.215 / 0.251 | 0.651 / 0.686 | 0.5k / 0.5k | 0.228 / 0.290 | 4.514 / 4.610 | 0.218 / 0.248 | 0.681 / 0.673 | 0.3k / 0.2k |
| `Qwen3-8B`（Zero-Shot 基座, 渲染率 89.3/94.7%） | 0.244 | 4.309 | 0.233 | 0.432 | 0.4k | 0.266 | 4.424 | 0.234 | 0.395 | 0.3k |
| **`C+A+H RL`（标量混合 Reward Hacking）** | **0.196** | *6.697* | 0.235 | 0.464 | 0.7k | 0.232 | *6.210* | 0.239 | **0.262 (↓)** | **6.3k (21×)** |
| `Universal Rubric RL`（无实例定制） | 0.244 | 4.813 | 0.241 | 0.660 | 0.7k | 0.266 | 4.793 | 0.244 | 0.591 | 0.3k |
| `Rubric-S`（砍风格轴 + `-2` 字牌重罚） | — | — | — | **0.536** | — | — | — | — | — | — |
| `w/o Visual` / `w/o Rendering` / `w/o Semantic` | — | — | — | 0.580 / 0.599 / 0.623 | — | — | — | — | — | — |
| **`RULER-8B`（Full, 渲染成功率 100%/99.3%）** | **0.249** | **4.859** | **0.246** | **0.693** | **2.0k** | **0.269** | **4.873** | **0.247** | **0.683** | **0.7k** |

### 3.3 5 次随机种子稳定性、策略规模与 Rubric 生成源鲁棒性（Table 3, 5, 6, 7 & 9）
- **跨规模与跨生成器 5-run 均值±标准差**：
  - `Qwen3-4B -> RULER-4B`：Illustration Rubric `0.372±0.017 -> 0.561±0.008`，Icon `0.338±0.017 -> 0.559±0.006`（4B 即追平 `Qwen3-32B` 的 `0.585 / 0.566`！）；
  - `Qwen3-8B -> RULER-8B`（`Claude-Opus-4.6` Rubric）：`0.440±0.011 -> 0.692±0.007`（Illust），`0.394±0.016 -> 0.662±0.016`（Icon）；
  - 换用 **`GPT-5.5`** 生成 Rubric 训 `Qwen3-8B`（Table 6 & 9）：Icon Rubric 达 **`0.646±0.007`**，CLIP 更高达 **`0.278±0.001`**，证明框架不绑定单一闭源教师。
- **750 对人工双盲胜率（Table 3 & 7，剔除平局）**：胜 `Qwen3-8B` **`89.7%`**（122:14）、胜 `Qwen3-32B` **`66.1%`**（84:43）、胜 `OmniSVG` **`66.9%`**（93:46）、胜 `JanusCoder` **`96.5%`**（139:5）、胜 `VectorFusion` **`53.3%`**（73:64）。

---

## 4. 对我们 Qwen3.8-27B 三轨项目（特别是 Track 3 cad_inspect.py 与 Track 2 SVG/Canvas）的落地启发（推论）

1. **三轨视觉盲评与 RL 严禁使用粗糙标量（CLIP/Aesthetic）或“重结构轻审美”的残缺 Rubric**：
   - `0.3k -> 6.3k` 描边刷分与 `Rubric-S` `-2` 罚分压不住 `<text>` 作弊共同证明：**只有“无字概念表达 + 形体构图 + 渲染工艺洁净度 + 风格内聚”多轴正交锁死，才能从根源消灭投机捷径**。
   - 在 Track 2（SVG+Canvas 交互动画）与 Track 1（Three.js）造数准入盲评及后续 RL 中，我们应在合成题干时同步离线生成缓存每题专属 `Instance-Aware Rubric`（单题仅 ~`$0.06`），并直接沿用 `"仅仅不黑屏且勉强能认出绝不许超过 0.6 分"` 的反通胀标尺卡紧我们 `≥ 0.90` 的阶梯录取线。
2. **前置 `Ideal Exemplar ≥ 0.9` 自洽测试，零 rollout 成本清洗歧义题干**：
   - 若某道新合成的高难 2D/CAD 题所派生的评分准则连参考高分样本都评不到 `0.9`，说明题干或评分标准本身存在逻辑冲突，必须在调用昂贵长程教师前直接过滤。
3. **双层防作弊架构（确定性 DOM/OCCT 拦截 + 独立异构评测裁判）**：
   - Track 2 在 `check_2d_v2.mjs` 中直接静态扫描异常 `<text>` / `fillText` 字牌占比并检测文字重叠，配合训练期本地开源 VLM 并发打分、里程碑验收换异构旗舰裁判，彻底杜绝同源裁判过拟合。
