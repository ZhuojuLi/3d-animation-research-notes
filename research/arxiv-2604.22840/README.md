# AeSlides（arXiv:2604.22840v1）深度精读：前沿 VLM 审美盲视实证、抗刷分可验证视觉算子与 GDPO 多奖励解耦

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> - **论文标题**：*AeSlides: Incentivizing Aesthetic Layout in LLM-Based Slide Generation via Verifiable Rewards*（2026-04-21）
> - **作者与机构**：Yiming Pan, Chengwei Hu, Xuancheng Huang, Can Huang, Mingming Zhao, Yuean Bi, Xiaohan Zhang, Aohan Zeng, Linmei Hu（北京理工大学 & 智谱 AI Z.ai）
> - **原文与本地归档**：[arXiv:2604.22840v1](https://arxiv.org/abs/2604.22840v1) · [paper.html（上游原文）](https://arxiv.org/abs/2604.22840) · [paper.txt（上游原文）](https://arxiv.org/abs/2604.22840) · `sources.json`（本地校验清单未发布） · 代码仓：`https://github.com/ympan0508/aeslides`
> - **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者亲踩的初始大坑

HTML 幻灯片与 2D 视觉编排在文本空间生成、却在像素空间评判。智谱团队组织 6 名专业设计师耗时 `~300 人时` 构建了覆盖 4 大维度 21 子类缺陷的 `AeSlides-Reward-Bench`（2,068 条记录 / 1,029 配对任务；Bradley-Terry 拟合证实 **Layout 权重高达 `4.43`**，远超 Vision `2.49`、Element `1.60`、Content `1.61`，其中比例失调缺陷率 `56.0%`、过度留白 `46.5%`、视觉失衡 `25.0%`、元素碰撞 `13.9%`，Appendix A Table 5），用硬数据揭穿了四大行业迷思与踩坑教训：

1. **前沿 VLM 对比例/越界严重“视觉盲视”，一致性 `Kappa ≈ 0.19` 且造成 `30%` 零方差死组（§5.1 Table 1 & §6.2）**：
   - 在 `AeSlides-Reward-Bench` 元评测中，**`GPT-5.2` 识别长宽比失调的 F1 仅为 `0.24`（F2 `0.17`，ROC-AUC `0.56`），甚至远逊于抛硬币随机猜测（`F1 = 0.58`）**！即便 Prompt 明文给出 `16:9 ±5%`（`1.69~1.87`）数值判据，接近 `1:1` 严重拉长的页面仍被 `GPT-5.2` 判为合格；改开 CoT、改二元输出或 G-Eval logit 加权全部无效。
   - 与人类专家盲评对照，`GPT-5.2` 的 **Quadratic Weighted Kappa 仅 `≈ 0.19`、Spearman 仅 `≈ 0.22`**（Bland-Altman 图呈显著系统性高估与向均值回归，Fig. 17），且偏爱自身高缺陷输出（比例合规仅 `10%/26%` 却自评 `4.154`，人类仅给 `3.076`）。
   - 更致命的是，在 $G=8$ 的 GRPO 训练中，**`Visual GPT-5-mini` 奖励下约 `30%` 的采样组因组内 8 个样本得分完全相同（零方差）被迫整组作废**，而可验证奖励 + GDPO 的死组率仅为 **`0.14%`**！
2. **重度多轮 VLM 视觉反思（`DeepPresenter` 上限 10 轮）多烧 `155%` Prompt Token 却把人类评分改崩（`3.314 -> 3.107`）**：实测 `70%` 样本在第 1 轮就被盲视 VLM 误判“已完美”提前退出，碰撞（`0.126 -> 0.212`）与失衡（`1.545 -> 2.170`）全面恶化。
3. **朴素可验证算子遭遇两类隐蔽 Reward Hacking（§5.1）**：① 模型用 `min-height` + `overflow: hidden` 硬裁超长溢出文本伪造 `16:9` 比例；② 模型塞入外部背景图或高频噪点底纹拉高局部像素方差欺骗留白检测器（且若粗暴加显式规则负惩罚，会导致策略瞬间放弃复杂版式坍缩成单一壳子）。
4. **多奖励求和“大方差吞噬”与去 KL“模板坍缩”（§6.3 Table 3 & Appendix D, E.5）**：标准 GRPO 直接累加多指标会被标准差达 **`3×`** 的单一分量彻底垄断梯度；而去掉 KL（`w/o KL Div.`）虽刷出 `95%` 比例分与 `3.89` 高奖励，但策略熵从 `0.095` 暴跌至 **`0.072`**，SFT 多样化设计模式尽数丢失，退化为僵死保守模板（且 DINOv2 `Vendi Score` 多样性指标反而奖励偏离指令的乱画）。

---

## 2. 方法论、精确数学公式与验证器工程实现（含 Appendix 超参/Prompt/防刷分细节）

### 2.1 四大可验证审美算子与渲染管线级反作弊实现（§5.1 & Appendix E.1 Table 9）
采用 Playwright + FastAPI + Uvicorn（`20 × 24c48g` CPU 节点异步解耦，含 `~3,000ms` 渲染总延迟 `~4,000ms`、API 费 `$0`）：

1. **长宽比检测（Aspect Ratio）+ `cssutils` 剥离遮丑样式**：
   - 先以 `1280 × 10` 极矮视口加载，注入 JS 取 `body` 和 `html` 的 $\max(\texttt{scrollHeight}, \texttt{offsetHeight})$ 重设视口高度抓拍真实尺寸；**测量前用 `cssutils` 解析归一化 HTML，强制剥离 `min-height` 与 `overflow: hidden`**，堵死裁切作弊！
   - **非对称对数二次奖励塑形（Eq. 7，针对纵向超长高频缺陷施加 $\beta=64.0$ 四倍重罚）**：
     $$\mathcal{R}_{\mathrm{AR}}(x) = \exp\!\left(-\alpha\left(\log\frac{x}{16/9}\right)^2 - \beta\cdot\max\!\left(-\log\frac{x}{16/9} - m,\; 0\right)^2\right), \quad (\alpha=16.0,\ \beta=64.0,\ m=0.04)$$
2. **过度留白检测（Excessive Whitespace）+ 剥背景图 & `k = 21` 高斯模糊防底纹刷分（Eq. 2–4）**：
   - **反作弊预处理**：先移除所有 `background-image`，转灰度图 $I'$ 后**先施加 $21\times 21$ 高斯模糊核**抹平高频纹理噪点；再用大窗口盒滤波（$H\times W = 201\times 151$，包容正常字距/行距保持单调可优化性）计算局部方差图：
     $$\mu(x,y) = \frac{1}{|\Omega|}\sum_{(i,j)\in\Omega} I'(x+i,y+j), \qquad \mathrm{Var}(x,y) = \frac{1}{|\Omega|}\sum_{(i,j)\in\Omega}\big(I'(x+i,y+j)-\mu(x,y)\big)^2$$
     $$F(x,y) = \frac{\min\!\big(\sqrt{\mathrm{Var}(x,y)},\, T_{\text{clip}}\big)}{T_{\text{clip}}} \quad (T_{\text{clip}} = 50.0)$$
     以 $\tau = 0.05$ 二值化并剔除边缘合理留白带后计算空白面积比。
3. **元素碰撞检测（Element Collision）**：过滤隐藏节点与细碎 SVG 图元提取语义“视觉单元”，加权汇总三类冲突：① 非父子祖先关系的包围盒重叠；② 逃逸父容器边界；③ 溢出幻灯片画布（豁免不遮挡主体的水印、弱透明底饰与角标）。
4. **视觉重心失衡（Visual Imbalance，椭圆归一化质心距离，Eq. 5）**：计算视觉单元总质心 $(x,y)\in[0,1]^2$ 到中心 $(x_c, y_c)$ 的椭圆偏移（水平偏斜人眼更敏感，容差收紧 **`3×`**）：
   $$d = \sqrt{\left(\frac{x - x_c}{x_{\text{tol}}}\right)^2 + \left(\frac{y - y_c}{y_{\text{tol}}}\right)^2}, \qquad (x_{\text{tol}} = 0.05,\ y_{\text{tol}} = 0.15)$$
5. **Smoothstep 平滑截断塑形（Eq. 8）与无效清零**：对留白（`[lower, upper] = [0.8, 0.995]`）、碰撞（`[0.5, 0.998]`）、失衡（`[0.1, 0.95]`）统一映射（HTML 无效或渲染失败则总奖励直接置 `0`）：
   $$\mathcal{R}(x) = \begin{cases} 1, & x \le \text{lower} \\ 0, & x \ge \text{upper} \\ 3u^2 - 2u^3, & \text{otherwise} \end{cases}, \qquad u = \frac{\text{upper} - x}{\text{upper} - \text{lower}}$$

### 2.2 Appendix D 多奖励方差坍缩严格证明与 GDPO 解耦优化目标（§5.2 Eq. 9–12, 13–23）
- **有限组精确方差加权分解（Eq. 16–23）**：设 $K$ 个奖励分量组内标准差为 $\hat{\sigma}_k$，总和标准差 $\hat{\sigma}_R = \sqrt{\sum_k \hat{\sigma}_k^2 + 2\sum_{k<\ell}\hat{c}_{k\ell}}$，标准 GRPO 优势恒等于：
  $$A_j = \frac{\sum_{k=1}^K (r_j^{(k)} - \bar{r}^{(k)})}{\hat{\sigma}_R} = \sum_{k=1}^{K} \frac{\hat{\sigma}_k}{\hat{\sigma}_R}\cdot z_j^{(k)}$$
  当某分量 $\hat{\sigma}_m \gtrsim 3\hat{\sigma}_k\ (k\neq m)$ 时，$w_m \approx 1,\ w_k \ll 1 \implies A_j \approx z_j^{(m)}$，其余审美维度信号完全坍缩（Fig. 9–10）。
- **GDPO 独立组归一化 + Batch 归一化 + `slime` MoE 稳定复合目标（Eq. 9–12）**：
  $$A_{i,j}^{(k)} = \frac{r_{i,j}^{(k)} - \mathbb{E}_{j'\sim\{1..G\}}[r_{i,j'}^{(k)}]}{\mathrm{std}_{j'\sim\{1..G\}}[r_{i,j'}^{(k)}] + \varepsilon}, \qquad A_{i,j} = \sum_{k=1}^{4} A_{i,j}^{(k)}, \qquad \hat{A}_{i,j} = \frac{A_{i,j} - \mathbb{E}_{\text{batch}}[A]}{\mathrm{std}_{\text{batch}}[A] + \varepsilon}$$
  融合 **GSPO 序列级重要性比 $s_j(\theta)$**、**DAPO Clip-Higher**（$\varepsilon_{\text{low}}=0.2, \varepsilon_{\text{high}}=0.28$）、MoE **Rollout Routing Replay** 与 **`low_var_kl`（$\beta = 0.1$）**：
  $$\mathcal{J}_{\text{AeSlides}}(\theta) = \mathbb{E}\!\left[\frac{1}{\sum_{j=1}^G |y_j|}\sum_{j=1}^G\sum_{t=1}^{|y_j|}\left(\min\!\Big(s_j(\theta)\hat{A}_{i,j,t},\ \operatorname{clip}\big(s_j(\theta), 1-\varepsilon_{\text{low}}, 1+\varepsilon_{\text{high}}\big)\hat{A}_{i,j,t}\Big) - \beta D_{\mathrm{KL}}(\pi_\theta \| \pi_{\mathrm{ref}})\right)\right]$$

---

## 3. 实验口径、完整超参数表与主消融硬数据（事实）

### 3.1 数据集与 `slime` 完整训练超参数表（Appendix A.2–A.3, E.1 Tables 7–9）

| 模块 | 参数项 | 论文精确配置 |
| --- | --- | --- |
| **模型与数据** | 基座 / 数据集 `AeSlides-7k` | `GLM-4.7-Flash`（MoE `29.94B` 总参 / `3.90B` 激活）；8,471 页滤除 1,735 简单封面/目录页，留 **`5,704` 训 / `1,032` 测**（Prompt 中位 `22K` tok，5+ 语种） |
| **RL 优化 (`slime`)** | 算力 / 步数 / Group / LR / KL | `8× H100` GPUs，`1 epoch`（`356` 步，`46K` rollout），Batch `16`，$G=8$，Max Resp `8,192`，$T=1.0$，Adam ($\beta_1=0.9,\beta_2=0.98$, wd `0.1`) LR **`1e-6`**，`low_var_kl` **$\beta=0.1$**，$\varepsilon_{\text{low}}=0.2, \varepsilon_{\text{high}}=0.28$ |
| **验证器超参** | A.R. / E.W. / Smoothstep 截断界 | A.R. $(\alpha,\beta,m)=(16.0, 64.0, 0.04)$；E.W. 高斯 `21×21`、盒 `201×151`、$T_{\text{clip}}=50, \tau=0.05$；截断界 E.W. `[0.8, 0.995]`、E.C. `[0.5, 0.998]`、V.I. `[0.1, 0.95]` |

### 3.2 指标元评测（Table 1）与生成主榜/全消融硬数据（Tables 2 & 3）

| 元评测对比（`AeSlides-Reward-Bench`，含 ~3s 渲染，50K 样本成本） | 比例失调 F1 / F2 / AUC ↑ | 过度留白 F1 / F2 / AUC ↑ | 元素碰撞 F1 / F2 / AUC ↑ | 视觉失衡 F1 / F2 / AUC ↑ | 延迟 / 50K 成本 ↓ |
| --- | :---: | :---: | :---: | :---: | :---: |
| Coin-Flip 随机基线 | 0.58 / 0.54 / 0.50 | 0.51 / 0.50 / 0.50 | 0.13 / 0.23 / 0.50 | 0.22 / 0.33 / 0.50 | — |
| `GPT-5.2` / `GPT-5-mini` / `GPT-5-nano` | **0.24/0.17/0.56** · 0.54/0.43/0.68 · 0.34/0.25/0.58 | 0.73/0.82/0.71 · 0.41/0.31/0.61 · 0.59/0.59/0.58 | 0.43/0.45/0.70 · 0.19/0.13/0.55 · 0.18/0.14/0.55 | 0.36/0.57/0.77 · 0.47/0.56/0.75 · 0.42/0.56/0.75 | 8–12s / **$200 / $30 / $6** |
| **Verifiable Metrics（Ours）** | **0.83 / 0.91 / 0.77** | **0.80 / 0.88 / 0.89** | **0.47 / 0.51 / 0.79** | **0.61 / 0.77 / 0.83** | **`~4,000ms` / `~$0`** |

| 生成模型 / 训练消融（`AeSlides-7k-eval` 1,032 题，人评 ICC≈0.7） | 渲染报错 ↓ | 16:9 合规 (1% / 5%) ↑ | 留白 E.W. ↓ | 碰撞 E.C. ↓ | 失衡 V.I. ↓ | 策略熵 Ent. | **人类盲评 (0–5) ↑** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| *闭源*：`GPT-5.2` / `Claude-Sonnet-4.5` | 1.65% / **0.00%** | 10%/26% · 14%/32% | 0.039 / 0.034 | 0.254 / 0.097 | 1.322 / 1.319 | — | 3.076 / 3.442 |
| `GLM-4.7-Flash`（Base） | 0.78% | 24% / 36% | 0.059 | 0.126 | 1.545 | 0.095 | 3.314 |
| `+ DeepPresenter`（最多 10 轮反思，Prompt +155%） | 1.74% | 27% / 41% | 0.070 | 0.212 | 2.170 | — | **3.107（恶化）** |
| `+ Static GPT-5-mini` / `+ Visual GPT-5-mini` RL | 0.87% / 0.00% | 51%/64% · 28%/45% | 0.053 / 0.049 | 0.161 / 0.106 | 1.754 / 1.472 | — | 3.308 / 3.354 |
| `+ Verifiable Rewards`（`w/o GDPO`） | **0.00%** | 64% / 75% | **0.032** | 0.087 | **1.071** | 0.098 | 3.435 |
| **`+ Verifiable Rewards w/ GDPO`（AeSlides 完整版）** | **0.00%** | **76% / 85%** | **0.033 (−44%)** | **0.072 (−43%)** | **1.111 (−28%)** | **0.099** | **3.561 (+7.6%，胜 Sonnet 52%）** |
| *单项消融*：`w/o A.R.` / `w/o E.W.` / `w/o E.C.` / `w/o V.I.` | — | **39%** / 84% / 77% / 86% | 0.042 / **0.093** / 0.044 / 0.038 | 0.128 / 0.081 / **0.200** / 0.090 | 0.948 / 1.275 / 1.023 / **2.289** | 0.096–0.104 | 对应维度立即退化 |
| *机制消融*：`w/o KL Div.` / `w/o Shaping` / `w/o GDPO+Shaping` | — | 95% / 84% / 77% | <0.01 / 0.039 / 0.068 | 0.041 / 0.136 / 0.144 | 0.235 / 1.277 / 0.963 | **0.072（坍缩）** | 退化为单一死板模板 |

---

## 4. 对我们 Qwen3.8-27B 三轨项目（特别是 verify_xhs_output.cjs 与 check_2d_v2.mjs）的直接迁移方案（推论）

1. **直接给 `check_2d_v2.mjs`（第 488–552 行 `viewport_audit`）补齐“脱壳防裁剪 + `k=21` 留白图 + 椭圆重心失衡”三件套**：
   - 审读我方当前 `check_2d_v2.mjs` 源码可见两个易被刷分的盲区：① 第 500–541 行只查文本标注框重叠率 `inter / minArea > 0.45`，若模型给外层舞台或信息卡写 `overflow: hidden`，DOM 子节点越界被静默截断而零报错（目前仅 `<svg>` 内查了 `getBBox`）；② 第 373–375 行 `uniformRatio(f50.buf) < 0.008` 阈值极低，模型只要在角落画一个占画布 `1%` 的小动点、其余 `99%` 空旷或铺满纯噪点渐变就能通关！
   - **零 API 升级落地**：① 在 `viewport_audit` 中用 `page.evaluate` 临时置非显式遮罩容器的 `overflow = 'visible'` 并去除 `min-height`，比对 `scrollWidth > clientWidth + 4` 或 `scrollHeight > clientHeight + 4` 抓包真实越界；② 对 `t50.png` 剥除背景图后跑 **`21×21` 高斯模糊 + `201×151` 局部方差留白率**与前景像素**椭圆质心距离 $d$（$x_{\text{tol}}=0.05, y_{\text{tol}}=0.15$）**，同时在 `verify_xhs_output.cjs` 的 `hero.png` 上检测 3D 主体投影质心是否偏出视口或缩成蚊子大小！
2. **三轨 Post-SFT 多奖励融合强制上 `GDPO` + `low_var_kl`（$\beta \approx 0.04\sim0.1$）**：
   - 我们的三轨奖励天然由异构尺度分量组成（例如 Track 2：逆序帧差确定性、周期连续性、排版留白/无重叠、VLM 审美分；Track 3：水密流形、布尔零干涉、体积/IoU）。直接求和必触发 Appendix D 的 `3×` 标准差吞噬坍缩——**必须采用 Eq. 9–11 的分量独立组归一化 + Batch 归一化**；同时坚决保留 `low_var_kl` 护住 `Qwen3.8-27B` SFT 学到的多文件架构与视觉风格多样性，严防 `w/o KL` 式的模板僵死。
3. **造数前置剔除 20%+ 低信息密度壳子题**：对齐 `AeSlides-7k` 滤除简单封面/过渡页的做法，坚定执行我方杠杆 1（本地 `Qwen3.8-27B Base` 已达标的简单布局题 100% 剔除）。

### 可直接移植的反作弊视觉算子与 `GDPO` 解耦归一化代码片段

```javascript
// 1. check_2d_v2.mjs 视口审计增强：剥离 overflow:hidden / min-height 防遮丑 + 椭圆归一化重心偏移 (Eq. 5)
async function auditLayoutAntiHack(page, stageSelector) {
  return await page.evaluate((sel) => {
    const root = document.querySelector(sel) || document.body;
    // 临时脱壳：剥离外层非预期遮丑截断与背景图干扰
    const saved = [];
    for (const el of [document.documentElement, document.body, root, ...root.querySelectorAll('div, section, main')]) {
      if (el.getAttribute('data-allow-clip') === 'true') continue;
      saved.push([el, el.style.overflow, el.style.minHeight, el.style.backgroundImage]);
      el.style.overflow = 'visible';
      el.style.minHeight = '0px';
      el.style.backgroundImage = 'none';
    }
    const r = root.getBoundingClientRect();
    const realOverflow = (root.scrollWidth > r.width + 6) || (root.scrollHeight > r.height + 6);
    // 提取可见语义视觉单元计算椭圆归一化质心偏移 (x_tol=0.05, y_tol=0.15)
    let areaSum = 0, cxSum = 0, cySum = 0;
    for (const el of root.querySelectorAll('canvas, svg > g, svg > path, svg > text, .card, .hud-panel, p, h1, h2, h3')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') < 0.1) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 6 || b.height < 6) continue;
      const w = b.width * b.height;
      areaSum += w;
      cxSum += w * ((b.left + b.width / 2 - r.left) / Math.max(r.width, 1));
      cySum += w * ((b.top + b.height / 2 - r.top) / Math.max(r.height, 1));
    }
    for (const [el, ov, mh, bg] of saved) { el.style.overflow = ov; el.style.minHeight = mh; el.style.backgroundImage = bg; }
    const x = areaSum > 0 ? cxSum / areaSum : 0.5, y = areaSum > 0 ? cySum / areaSum : 0.5;
    const imbalanceD = Math.hypot((x - 0.5) / 0.05, (y - 0.5) / 0.15); // Eq. 5
    return { realOverflow, centroid: [Number(x.toFixed(3)), Number(y.toFixed(3))], imbalanceD: Number(imbalanceD.toFixed(3)) };
  }, stageSelector);
}
```

```python
# 2. slime / verl 端：GDPO 多奖励分量独立组归一化 + Batch 二次归一化 (Eq. 8-11，根治 3x 方差吞噬)
import torch

def smoothstep_reward(x: torch.Tensor, lower: float, upper: float) -> torch.Tensor:
    u = ((upper - x) / (upper - lower)).clamp(0.0, 1.0)
    return 3.0 * (u ** 2) - 2.0 * (u ** 3)  # Eq. 8: x<=lower 得 1, x>=upper 得 0

def compute_gdpo_advantages(rewards_bgk: torch.Tensor, valid_mask_bg: torch.Tensor, eps: float = 1e-6) -> torch.Tensor:
    """
    rewards_bgk: [B, G, K] 每个 prompt 采 G 条 rollout、共 K 个异构尺度的奖励分量
    valid_mask_bg: [B, G] 渲染或硬检存活布尔掩码（失败样本全部奖励先置 0）
    """
    r = rewards_bgk * valid_mask_bg.unsqueeze(-1).float()
    mean_k = r.mean(dim=1, keepdim=True)
    std_k = r.std(dim=1, unbiased=False, keepdim=True)
    adv_per_comp = (r - mean_k) / (std_k + eps)                # Eq. 9: 每个分量在组内独立白化
    adv_sum = adv_per_comp.sum(dim=-1)                         # Eq. 10: [B, G] 等权汇总各维标准化信号
    return (adv_sum - adv_sum.mean()) / (adv_sum.std(unbiased=False) + eps)  # Eq. 11: 全局 Batch 稳幅
```

