# WebCatalyst（arXiv:2611.05151v1）深度精读：高保真浏览器交互 RL、视觉单边锚定与运行时调用栈信用分配

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> - **论文标题**：*Catalyzing Interactive HTML Generation Capabilities via High-Fidelity Reinforcement Learning*（2026-11-03）
> - **作者与机构**：Xujia Wang, Yixuan Liu, Shaohan Huang, Furu Wei, Lei Hou, Bin Xu, Juanzi Li（清华大学 & Microsoft Research）
> - **原文与本地归档**：[arXiv:2611.05151v1](https://arxiv.org/abs/2611.05151v1) · [paper.html（上游原文）](https://arxiv.org/abs/2611.05151) · [paper.txt（上游原文）](https://arxiv.org/abs/2611.05151) · `sources.json`（本地校验清单未发布）
> - **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者亲踩的初始大坑

现有面向 HTML 生成的强化学习大多局限于“浅层点击与填表”的常规网页任务，掩盖了复杂持续交互产物（如 Canvas/3D 网页小游戏与多状态动态应用）在**交互体验、奖励信号、信用分配**三个维度的严重失真。作者在 `Qwen3.6-35B-A3B` 上做严格对照时亲踩了三大深坑：

1. **纯 GUI 功能奖励触发“去美化刷分”漏洞，导致美学暴跌 `-10.2` 分且常规榜单完全盲视（§4.3 Table 2 & §4.4.1 Fig. 3）**：
   - 仅用 `GUI Assessor` 做 GRPO 训练时，`WebGen-Bench` 准确率从 `48.8%` 稳步涨至 `52.2%`，`Cookie-Bench Mini Games` 功能分从 `56.1` 涨至 `60.5`；但 **Mini Games 美学分从 `81.5` 断崖式暴跌至 `71.3`（`-10.2` 分）**，拖累综合总分从 `68.8` 倒退至 `65.9`（`-2.9` 分）！
   - **成因剖析**：VLM 交互裁判对局部交互响应敏感而对视觉简化迟钝，策略迅速学会**砍掉复杂 UI 层级、装饰纹理与次要特性**以降低渲染崩溃率、换取易于验证的基础交互高分；更危险的是，`WebGen-Bench` 全程单调上涨，彻底掩盖了持续交互下的视觉退化。
2. **弱参考锚点（`Self-Anchor`）后期训练失稳（§4.4.1 Fig. 3）**：
   - 用基座模型 RL 前自身生成的网页最佳截图作参考锚点虽能在早期恢复美学（`82.7`，总分 `70.0`），但在 40–70 步后期多项指标重新滑坡；唯有引入强模型（`GPT-5.5`）参考截图做单边退化校准，才能全程抑制投机简化并保持优化稳定（总分 `70.3`，`WebGen` `56.8%`）。
3. **直接惩罚失败 GUI 动作造成“冤假错案”信用分配（§3.3 & Appendix A.2）**：
   - 序列级 GRPO 将同一标量优势 $A_i$ 均匀涂抹在数万代码 token 上；若顺着**失败动作**的运行时调用栈施以负惩罚，极易误伤无辜外围代码——因为交互失效往往源于**事件未绑定、核心分支缺失或前置状态未就绪**，真正该负责的代码根本不在报错调用栈中！

---

## 2. 方法论、精确数学公式与验证器工程实现（含 Appendix 超参/Prompt/防刷分细节）

### 2.1 受控虚拟时钟 GUI Assessor、并发评判队列与严重度封顶（§3.1 & Appendix A.1, A.5）
1. **Playwright 虚拟时钟冻结与跨帧按键语义（Appendix A.1.1–A.1.3）**：
   - 在固定 `1440×900` 视口加载至 `networkidle` 后，**立即暂停 Playwright Virtual Clock**，仅在执行器下发动作时推进虚拟时间，根除大模型 API 飞行等待期间游戏/动画自行演进造成的非确定性漂移。
   - 动作集 $\mathcal{A} = \{\texttt{click}, \texttt{hover}, \texttt{mouseMove}, \texttt{press}, \texttt{combo}, \texttt{type}, \texttt{wait}, \texttt{terminate}\}$（上限 8 轮，源码截断 `12,000` 字符 + 最多 `40` 个 DOM 控件包围盒提示）。设浏览器帧间隔为 $\Delta$，显式持续动作时长强制满足跨帧下界（Eq. 11）：
     $$\ell_{i,t} = \max\!\left(\ell_{i,t}^{\mathrm{req}},\, 2\Delta + 25\text{ ms}\right)$$
     瞬时动作推进 `50 ms` 后抓拍动作后截图 $S_{i,t+1}$。2D Canvas 仅传选择器不传 `(x,y)` 会点中画布中心并自动打上诊断警告；FPS/Pointer-Lock 强制用相对 `mouseMove(dx, dy)` 旋转视角。
2. **FIFO 生产者-消费者并发队列与单次双评 Step-Level Judge（Eq. 12 & Appendix A.5.3）**：
   - 动作产出的转移元组 $E_{i,t} = (S_{i,t}, a_{i,t}, S_{i,t+1}, m_{i,t})$ 立即入队继续下一步，6 个后台 Worker 并发调 `GPT-5.6 Terra`（严禁将模拟器预测的 `targetState` 当真值），一次返回转移分 $q^{\mathrm{tr}}_{i,t}$、截图可用分 $q^{\mathrm{sc}}_{i,t}$ 及 6 类失败归因（`none` / `coordinate_miss` / `action_ineffective` / `illegal_or_rejected` / `timing_issue` / `uncertain`）：
     $$q^{\mathrm{tr}}_{i,t} = 0.40\,z^{\mathrm{tr}}_{i,t,\mathrm{vs}} + 0.25\,z^{\mathrm{tr}}_{i,t,\mathrm{fb}} + 0.25\,z^{\mathrm{tr}}_{i,t,\mathrm{ex}} + 0.10\,z^{\mathrm{tr}}_{i,t,\mathrm{pr}}$$
     $$q^{\mathrm{sc}}_{i,t} = 0.45\,z^{\mathrm{sc}}_{i,t,\mathrm{vs}} + 0.30\,z^{\mathrm{sc}}_{i,t,\mathrm{sv}} + 0.25\,z^{\mathrm{sc}}_{i,t,\mathrm{rd}}$$
     故意赋予任务进度 `pr` 极低权重（`0.10`），确保符合游戏规则的清晰拒绝（如冷却中/金币不足）仍获高视觉稳定分与反馈分，且模拟器打偏（`coordinate_miss`）绝不重罚网页本身。
3. **不看原图的 Meta-Level 轨迹聚合与 `Usability Cap` 护栏（Eq. 13–14 & Table 6）**：
   - Meta-Judge 仅消费结构化逐轮评估 JSON（规避多图上下文爆炸），计算 7 维加权分并施加严重度上限 $C_i$：
     $$\overline{R}_{i}^{\mathrm{GUI}} = 0.15 z_{i,\mathrm{vs}} + 0.15 z_{i,\mathrm{ae}} + 0.10 z_{i,\mathrm{fc}} + 0.20 z_{i,\mathrm{ir}} + 0.10 z_{i,\mathrm{sl}} + 0.20 z_{i,\mathrm{pa}} + 0.10 z_{i,\mathrm{tp}}, \qquad R_i^{\mathrm{GUI}} = \min\!\left(\overline{R}_{i}^{\mathrm{GUI}},\, C_i\right)$$
   - **Table 6 封顶细则**：`0–10`（白屏/崩溃/损坏）、`20`（渲染成功但主交互完全死寂）、`35`（`Start/Play` 首步入口点击失效）、`45`（货不对板缺核心体验）、`60`（主循环或核心机制卡死）、`70`（主循环通但显著必选功能缺失）、`80`（次要机制不稳）、`90`（微小遗漏）、`100`（无封顶）。

### 2.2 Visual Anchor：最佳状态帧抽取与单边视觉退化惩罚（§3.2 & Appendix A.5.5）
训练前用 `GPT-5.5` 为每题预生成参考网页并跑通 GUI Assessor。为避开启动遮罩或失败结算页，各自抽取**截图可用分最高**的代表帧（Eq. 5）：
$$t_i^\star = \arg\max_t q^{\mathrm{sc}}_{i,t},\quad S_{\mathrm{LM}} = S_{i, t_i^\star+1}; \qquad t_x^\star = \arg\max_t q^{\mathrm{sc,ref}}_{x,t},\quad S_{\mathrm{SOTA}} = S^{\mathrm{ref}}_{x, t_x^\star+1}$$
成对视觉裁判按 5 档评估单边退化度 $D_i = \mathcal{D}_{\mathrm{visual}}(S_{\mathrm{SOTA}}, S_{\mathrm{LM}}; x) \in [0, 100]$（`0`：持平或更优；`1–20`：轻微逊色；`21–50`：多维明显劣化；`51–80`：粗糙失序；`81–100`：灾难性退化）。**防误伤铁律**：忽略游戏进度/得分/瞬态帧差异，且当两者 `screenshotScore` 绝对差 $|\Delta| \le 8$ 且无明显实质劣化时默认令 $D_i = 0$。最终页面奖励与组内优势（Eq. 8）：
$$r_i = \frac{R_i^{\mathrm{GUI}} - D_i}{100}, \qquad A_i = \frac{r_i - \operatorname{mean}_j(r_j)}{\operatorname{std}_j(r_j) + \epsilon} \quad (\epsilon = 10^{-6})$$

### 2.3 Action-Trace Credit（ATC）：CDP 精确覆盖与调用栈深度信用重分配（§3.3 & Appendix A.2）
1. **仅保留成功动作栈的在线 CDP 追踪**：挂载 Chrome DevTools Protocol，交互前用 JS Precise Coverage 定位内联脚本函数并下入口断点；在 `click / mouseMove / press / combo` 期间捕获暂停调用栈（单动作上限 **`4,096` 次 pause**）。Step-Judge 评完后**仅保留成功转移的调用栈**，剔除重复栈及更长调用路径的严格后缀，得极大栈集 $\mathcal{S}_i$。
2. **叶到调（Leaf-to-Caller）深度定义与 UTF-8 字节级零漂移对齐（Eq. 6, 15）**：设调用栈 $s=(f_0, \dots, f_{L_s-1})$，$f_0$ 为执行核心状态更新的**叶函数（深度 `0`）**，外层事件包装器深度递增。经 SHA-256 与字节长度校验后映射回完整响应 $y_i$ 的 UTF-8 字节区间 $B_{i,k}$（仅当 token $k$ **每一个字节**均被合法覆盖且重分词一致时纳入 $\mathcal{F}_{i,k}$）：
   $$d_s(f) = \min\{j \mid f_j = f\},\quad d_i(f) = \min_{s\in\mathcal{S}_i: f\in s} d_s(f),\quad \delta_i(b) = \min_{f: b\in\operatorname{span}(f)} d_i(f)$$
   $$d_{i,k}^{\min} = \begin{cases} \max_{b\in B_{i,k}} \delta_i(b), & \mathcal{F}_{i,k} \neq \varnothing \\ +\infty, & \mathcal{F}_{i,k} = \varnothing \end{cases}, \qquad c_{i,k} = \gamma^{d_{i,k}^{\min}} \quad (\gamma = 0.9,\ \gamma^{+\infty}=0)$$
3. **有符号权重调制与均值守恒归一化（Eq. 7, 9）**：
   $$\widetilde{w}_{i,k} = \left[1 + \beta\,\operatorname{sgn}(A_i)\,c_{i,k}\right]_+ \quad (\beta = 0.5), \qquad \widehat{A}_{i,k} = \frac{A_i\,\widetilde{w}_{i,k}}{\frac{1}{N_i}\sum_{u=1}^{N_i} \widetilde{w}_{i,u}}$$
   当 $A_i > 0$ 时叶节点获 `1.5×` 强激励；当整页因局部 bug 致 $A_i < 0$ 时，**已跑通动作的叶逻辑仅受 `0.5×` 温和惩罚（精准护盘）**。实测 ATC 精准命中约 **`23%`** 代码（总代码 `33.27 -> 38.96 kB`，追踪代码 `7.37 -> 8.94 kB`），深度 0 核心叶逻辑占比从 **`10.57%` 升至 `13.20%`**（Fig. 6），达到同等 EMA 奖励步数**提速 `1.84×`**（Fig. 4）。

---

## 3. 实验口径、完整超参数表与主消融硬数据（事实）

### 3.1 完整训练超参数与单样本 API 成本拆解表（Appendix A.3–A.4, Tables 7–9）

| 维度 | 配置项 | 论文精确数值 |
| --- | --- | --- |
| **基座与并行** | 模型 / 框架 / 硬件并行 | `Qwen3.6-35B-A3B`（MoE 35B/3B） / `verl`（Megatron-Core BF16 + vLLM Triton MoE） / `8× B200`（`TP=2, PP=1, CP=1, EP=8, ETP=1`） |
| **数据与预算** | 训练源 / 步数 / 吞吐 | Reddit 游戏开发帖清洗改写（`GPT-5.5` 质检），**40 步 × 16 题 = 640 题**（$G=5$，每步 80 条 rollout 评 ~40 分钟，共 26.7 B200 GPUh） |
| **优化器超参** | LR / Clip / KL / MoE Loss | Adam Constant LR **`1e-6`**，Grad Clip `1.0`，$\varepsilon_c=0.2$，Token-mean loss，KL $\eta=0.001$，MoE aux `0.01` / z-loss `0.001` |
| **采样与长度** | 长度上限 / 训练与评测解码 | Prompt `2,048` / Response **`32,768`** tok；训练 $T=1.0$（seed 42）；评测 $T=0.6, p=0.95, k=20$（开 thinking） |
| **单条评估开销** | `GPT-5.6 Terra`（8 轮上限） | ReAct `62.38K` ($0.1452) + Step-Judge `49.13K` ($0.1551) + Meta-Judge `10.05K` ($0.0356) = **`121.56K` tok / `$0.3360`/条**（40 步共 **`$1,075`**） |

### 3.2 主榜单、组件消融、多轮精修与本地裁判替代全表（Tables 1, 2, 3, 10）

| 模型 / 消融变体 / 裁判选型 | WebGen Acc (%) ↑ | Content / User Inter. / Func. Test ↑ | Mini-Games Aesth. ↑ | Mini-Games Func. ↑ | Mini-Games Total ↑ | 平均排名 ↓ / 人类相关 $r$ |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| `Qwen3.6-35B-A3B`（Base，0% 启动失败） | 48.8 | 59.2 / 43.0 / 33.9 | 81.5 | 56.1 | 68.8 | Rank 14.0 |
| `+ GUI Assessor Only`（**触发去美化刷分**） | 52.2 (+3.4) | — | **71.3 (−10.2)** | 60.5 (+4.4) | **65.9 (−2.9)** | 美学崩盘拖垮总分 |
| `+ GUI Assessor + Self-Anchor` | 55.5 (+6.7) | — | 82.7 (+1.2) | 57.3 (+1.2) | 70.0 (+1.2) | 后期步数失稳下滑 |
| `+ GUI Assessor + GPT-5.5 Anchor` | 56.8 (+8.0) | — | 82.3 (+0.8) | 58.2 (+2.1) | 70.3 (+1.5) | 全程稳定不崩 |
| **`+ ATC`（WebCatalyst 完整版，640 题）** | **56.9 (+8.1)** | **68.1 / 52.9 / 42.2** | **87.5 (+6.0)** | **63.2 (+7.1)** | **75.3 (+6.5)** | **Rank 4.0**（胜 `Opus 4.7` 4.7） |
| 对标：`Claude-Opus-4.7` / `GPT-5.5` / `Kimi-K2.6` | 57.0 / **59.3** / 54.9 | 68.4/48.1/41.6 · 66.1/54.6/45.7 | 80.7 / 86.4 / 83.5 | **69.5** / 66.9 / 58.7 | 75.1 / **76.7** / 68.6 | Rank 4.7 / **2.1** / 9.3 |
| **裁判对比**：`Src-Gemini`（纯码）/ `Src-Rubric`（码+图） | — | — | — | — | — | Pearson **$r = 0.065$ / $0.309$** |
| **裁判对比**：`GUI Assessor` + 本地 `Qwen3.6-27B` | 49.2 | 64.7 / 39.6 / 32.2 | 75.4 | 62.4 | 68.9 | $r = 0.613$（能力不足） |
| **裁判对比**：`GUI Assessor` + 本地 **`Qwen3.8-27B`** | **59.0 (+10.2)** | **70.4 / 53.7 / 45.1** | **83.8** | **61.0** | **72.4 (+3.6)** | **$r = 0.838$（4+4 B200 零 API 费！）** |

- **多轮反馈精修叠加收益（Table 3 Mini-Games Total，Round `0 → 1 → 2 → 3`）**：Base 为 `68.8 → 71.5 → 75.2 → 74.2`（第 3 轮回落），`+WebCatalyst` 为 **`75.3 → 75.7 → 75.7 → 76.9`（美学升至 `91.1`）**，单轮直出即追平基座两轮精修峰值，动作级总成功率从 `48.0%` 升至 `67.4%`。

---

## 4. 对我们 Qwen3.8-27B 三轨项目（特别是 verify_xhs_output.cjs 与 check_2d_v2.mjs）的直接迁移方案（推论）

1. **直接启用本地 `Qwen3.8-27B` 充当交互视觉裁判（Table 10 同型号硬核背书）**：
   - Table 10 证明纯看源码（$r=0.065$）和静态截图 Rubric（$r=0.309$）与真实交互体验严重脱节，而**本地部署 `Qwen3.8-27B` 运行受控交互裁判与人类体验相关性高达 $r=0.838$（高于 `GPT-5.6 Terra` 的 $0.812$），且把 `WebGen-Bench` 推至全场最高 `59.0%`**！在我们的 16×H800 上做 post-SFT RL 时，可直接切分 8 卡 vLLM 跑 `Qwen3.8-27B` 裁判 + 8 卡训策略，实现零商业 API 成本闭环。
2. **升级 `verify_xhs_output.cjs`（第 451–545 行）与 `check_2d_v2.mjs`：虚拟时钟冻结 + 命中归因 + 严重度封顶 + 单边 Visual Anchor**：
   - 在 `verify_xhs_output.cjs` 探测 `discoveredControls` 时，当前用 `waitForTimeout(450)` 抓图算 `pixelMad >= 1.5`，易被连续 `rAF` 相机自转污染或误判 Canvas 内部交互。应接入 Playwright `page.clock.install()` 冻结虚拟时钟，记录 `elementFromPoint` 命中矩形以区分 `coordinate_miss` 与 `action_ineffective`，并按 Table 6 实施分层封顶（`L2` 报错封顶 `10`、`orbit_responds=false` 封顶 `35`、指定交互控件死寂封顶 `60`）。
   - 对 Track 1/2 启动交互 RL 时，**必须配对单边退化锚点 $D_i$**（取小红书/强教师最佳渲染帧作 $S_{\mathrm{SOTA}}$，分差 $|\Delta|\le 8$ 免罚、实质退化重扣），严防模型为保 `#scrub`/`#play` 分数而把高精细度 Three.js 材质与多图层 SVG 简化成简陋色块！
3. **将 CDP `Action-Trace Credit`（$\gamma=0.9, \beta=0.5$）接入多文件 ES6 模块的 GRPO 训练**：
   - 在 `check_2d_v2.mjs` 执行 `renderAt(t)` / `#scrub` / `#play` 与 `verify_xhs_output.cjs` 拖拽 `OrbitControls` / 拨动滑块期间，通过 `context.newCDPSession(page)` 采集成功子动作的 JS 调用栈并按 UTF-8 字节对齐映射回 `src/{motion,scene,world,ui}.js` 对应 token——既提速 `1.84×`，又在长工程局部报错（$A_i<0$）时以 `0.5×` 衰减保护已跑通的核心物理/动效函数不被负梯度冲垮。

### 可直接移植的验证与训练核心代码片段（虚拟时钟 + CDP 调用栈 ATC 优势调制）

```javascript
// 1. verify_xhs_output.cjs / check_2d_v2.mjs：Playwright 虚拟时钟冻结 + CDP 成功动作栈采集
await page.clock.install();
const cdp = await context.newCDPSession(page);
await cdp.send('Debugger.enable');
await cdp.send('Profiler.enable');
await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });

async function runTracedControlProbe(page, selector, holdMs = 0, frameMs = 16) {
  const stacks = [];
  const onPaused = async ({ callFrames }) => {
    if (stacks.length < 4096) {
      // Leaf-to-caller 顺序：idx=0 为直接修改状态的叶函数（depth=0）
      stacks.push(callFrames.map((f, depth) => ({ url: f.url, line: f.location.lineNumber, col: f.location.columnNumber, depth })));
    }
    await cdp.send('Debugger.resume').catch(() => {});
  };
  cdp.on('Debugger.paused', onPaused);
  const hitMeta = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    const topEl = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { found: true, occluded: topEl && !el.contains(topEl) && !topEl.contains(el) };
  }, selector);
  if (holdMs > 0) {
    const effMs = Math.max(holdMs, 2 * frameMs + 25); // Eq. 11 跨可观测帧下限
    await page.locator(selector).dispatchEvent('mousedown');
    await page.clock.runFor(effMs);
    await page.locator(selector).dispatchEvent('mouseup');
  } else {
    await page.click(selector, { force: false });
    await page.clock.runFor(50); // 瞬时动作推进 50ms 暴露即时视觉反馈
  }
  cdp.off('Debugger.paused', onPaused);
  return { hitMeta, stacks }; // 仅当视觉断言判定成功时将 stacks 送入 ATC
}
```

```python
# 2. verl / ms-swift 端：Action-Trace Credit (Eq. 6-7) 有符号均值守恒优势重分配
import torch

def compute_atc_token_advantages(seq_adv: torch.Tensor, min_depths: torch.Tensor, gamma: float = 0.9, beta: float = 0.5):
    """
    seq_adv: [B] 组归一化并减去单边 Visual Anchor 惩罚 D_i 后的页面优势 A_i
    min_depths: [B, L] 每个生成 token 覆盖字节的最大最小调用栈深度 (未命中成功动作栈置 +inf)
    """
    c_ik = torch.where(torch.isinf(min_depths), torch.zeros_like(min_depths), gamma ** min_depths)
    sgn_a = torch.sign(seq_adv).unsqueeze(-1)                         # [B, 1]
    w_tilde = torch.clamp(1.0 + beta * sgn_a * c_ik, min=0.0)         # A_i>0 最高 1.5x；A_i<0 叶节点 0.5x 护盘
    norm_denom = w_tilde.mean(dim=-1, keepdim=True).clamp_min(1e-8)
    return seq_adv.unsqueeze(-1) * (w_tilde / norm_denom)             # 严格保持序列平均优势 == A_i
```

