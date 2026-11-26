# WebGen-R1（arXiv:2604.20398v1）深度精读：脚手架约束多页生成、三级级联多模态奖励与冷启动 CoT 消融

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> - **论文标题**：*WebGen-R1: Incentivizing Large Language Models to Generate Functional and Aesthetic Websites with Reinforcement Learning*（2026-04-22）
> - **作者与机构**：Juyong Jiang, Chenglin Cai, Chansung Park, Jiasi Shen, Sunghun Kim, Jianguo Li, Yue Wang（香港科技大学 / 港科大广州、阿里巴巴通义实验室 Tongyi Lab、韩国 ETRI、蚂蚁集团）
> - **原文与本地归档**：[arXiv:2604.20398v1](https://arxiv.org/abs/2604.20398v1) · [paper.html（上游原文）](https://arxiv.org/abs/2604.20398) · [paper.txt（上游原文）](https://arxiv.org/abs/2604.20398) · `sources.json`（本地校验清单未发布） · 代码仓：`https://github.com/juyongjiang/WebGen-R1`
> - **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者亲踩的初始大坑

从单函数脚本跃升至包含多页路由、状态管理与响应式 UI 的**完整前端应用（Project-Level Multi-Page Website）**，开源小模型在端到端生成中面临依赖断链与奖励失衡双重死结。作者在 `Qwen2.5-Coder-7B-Instruct` 上通过系统对照踩实了四大工程陷阱：

1. **无脚手架约束的多文件自由生成引发“一处断链、全盘白屏”（§1, §4.2 Table 1）**：
   - 在多文件工程直出场景下，`Qwen2.5-Coder-7B-Instruct` 的有效渲染率（`VRR`）仅 **`30.56%`**、交互功能成功率（`FSR`）仅 **`1.59%`**；即便是大模型 `Qwen2.5-72B-Instruct` 与 `DeepSeek-R1 (671B)`，`VRR` 也分别低至 **`8.86%`** 与 **`42.86%`**！
   - 同时，强耦合 `Bolt.diy` 多轮轨迹微调的 `WebGen-LM` 一旦脱离其专用 Agent 壳子，在端到端生成设定下几乎 100% 产出无法运行的代码（§4.1）。
2. **跳过冷启动 CoT SFT 直接跑 `R1-Zero`（`RL-only`）导致有效渲染率不升反降（§4.3 Table 3）**：
   - 不经结构化架构规划冷启动直接在 7B 基座上跑 GRPO，`VRR` 从基座的 `30.56%` **倒退至 `26.82%`**（`FSR` 停在 `18.23%`）；
   - 反过来，单纯 `SFT-only` 虽然把 `FSR` 拉升至 `20.08%`，`VRR` 却几乎纹丝不动（`30.69%`）——唯有 **`600 条分层 CoT SFT 冷启动 + 级联 RL`** 协同，才能实现 **`VRR 30.56% -> 95.89%`** 的跨越！
3. **稀疏二元功能/格式奖励权重 $\gamma$ 偏大（$\ge 0.5$）触发“减配保平安”刷分（§4.3 Fig. 8）**：
   - 在标量化网格搜索 $(\gamma, \lambda) \in \{0, 0.1, 0.5, 1.0\}^2$ 中，运行零报错分 $s_{\text{func}}\in\{0,1\}$ 与思考格式分 $s_{\text{cot}}\in\{0,1\}$ 是稀疏二元阶跃信号，而视觉审美分 $s_{\text{vis}}\in[0,5]$ 是稠密连续信号；
   - 当 $\gamma$ 设得过大（尤其 $\lambda$ 较小时），策略会通过**删减复杂交互逻辑与页面元素来确保 0 控制台报错**，导致 `FSR` 与 `AAS` 双双退化！
4. **训练期与评测期验证成本错配**：在线 GUI Agent 多轮点击验证延迟极高且噪声大，因此必须用“静态/构建秒杀前置门控 + 训练期控制台零错与多路由视觉评估 + 评测期动态 WebVoyager 测试”分层解耦。

---

## 2. 方法论、精确数学公式与验证器工程实现（含 Appendix 超参/Prompt/防刷分细节）

### 2.1 模板流形约束生成范式（Template-Constrained Scaffold Generation，§3.1 & Appendix B, C.1）

将合法多页网站定义为有向依赖图与文件内容的二元组 $W = \langle \mathcal{G}=(\mathcal{V},\mathcal{E}), \Phi \rangle$。引入预验证不变子图脚手架 $\mathcal{T}$（`vite-react-typescript-starter`），限制策略 $\pi_\theta$ 仅自回归生成可变业务组件增量 $\Delta = W \setminus \mathcal{T}$ 并注入预定义槽位（Eq. 1–2）：

$$
W_{\text{gen}} = \mathcal{T} \oplus \pi_\theta(\Delta \mid \mathcal{S}, x, \mathcal{T}), \qquad \pi_\theta(\Delta \mid \mathcal{S}, x, \mathcal{T}) = \prod_{k=1}^{K}\prod_{t=1}^{T_k} P(y_{k,t} \mid \mathcal{S}, x, \mathcal{T}, \Delta_{<k}, y_{k,<t})
$$

- **Appendix B & Prompt C.1 防构建雪崩六大硬约束**：
  1. **核心底座锁死**：`React 18.3`（函数组件 + Hooks）+ `TypeScript 5.5`（`strict: true`）+ `Vite 5.4` + `Tailwind CSS 3.4` + `React Router DOM v6`（WebContainer 纯浏览器 Node 环境，禁原生二进制/pip/g++）；
  2. **UI 组件库与图表库严格白名单**：复杂 UI 强制用 **`antd`（Ant Design，严格区分 v4 引 `antd.css` 与 v5 引 `reset.css`）**，**明令封禁 `shadcn/ui`、`shadcn-ui`、`shadcnui`**（杜绝漏生底层组件断链）；图表**唯一允许 `Recharts`**；持久化**唯一允许 `SQLite/libsql`**；
  3. **单一全局样式表铁律**：全工程只允许使用 `src/index.css`，**严禁创建 `global.css`、`app.module.css` 或任何组件级 `.css` 文件**，且严禁将第三方库样式拷入 `src/index.css`；
  4. **11 个必含核心清单与 1:1 导入闭合**：`<webArtifact>` XML 内必须完整输出 `package.json`、`vite.config.ts`、`tailwind.config.js`、`postcss.config.js`、`eslint.config.js`、`tsconfig*.json`（3 个）、`index.html`、`src/main.tsx`、`src/App.tsx`、`src/index.css`、`src/vite-env.d.ts` 及所有 `src/components/`、`src/pages/` 业务文件，**任意 `import` 语句必须与生成文件清单严格 1:1 对应**；
  5. **强制 8 步前置 `<think>` 架构规划**：在 `<answer>` 前依次推理：① 需求拆解 → ② 入口与 import 闭合检查 → ③ 依赖规划 → ④ TS 严格类型核验 → ⑤ ESLint 规范 → ⑥ UX 交互反馈（加载态/禁用态/ARIA） → ⑦ 响应式排版 → ⑧ 外部 API 本地 Mock 兜底。

### 2.2 两阶段验证渲染管线与三级级联多模态奖励公式（§3.2–3.4 & Appendix C.2）

1. **Phase I 静态合规秒杀门控（Eq. 3）**：对生成清单验证结构、必含文件、启动命令与 `package.json`/导出规范四类约束 $\mathcal{C} = \{c_{\text{structure}}, c_{\text{files}}, c_{\text{commands}}, c_{\text{content}}\}$：

$$
\mathbb{I}_{\text{static}}(W_{\text{gen}}) = \prod_{c\in\mathcal{C}} \mathbbm{1}\!\left[c(W_{\text{gen}})\text{ is satisfied}\right]
$$

   一旦 $\mathbb{I}_{\text{static}} = 0$，**立即早停终止**，免除高昂的依赖安装、打包与 VLM 推理开销。
2. **Phase II 确定性构建与多路由无头抓拍（Eq. 4–5）**：静态全过工程依次经装包 $\mathcal{I}_{\text{install}}$、Vite 打包 $\mathcal{B}_{\text{bundler}}$、本地起服 $\mathcal{L}_{\text{serve}}$ 与无头浏览器跨路由抓拍 $\mathcal{R}_{\text{render}}$，产出各路由截图集与双端日志：

$$
o = \mathcal{R}_{\text{render}}\!\left(\mathcal{L}_{\text{serve}}\!\left(\mathcal{B}_{\text{bundler}}\!\left(\mathcal{I}_{\text{install}}(W_{\text{gen}})\right)\right)\right) = \left\langle \{I_p\}_{p\in\mathcal{P}},\; \Lambda_{\text{runtime}},\; \Lambda_{\text{console}} \right\rangle
$$

3. **三级级联多模态奖励（Eq. 6–7）**：

$$
R(y) = R(W_{\text{gen}}, o, x) = \begin{cases} \psi_{\text{static}}(W_{\text{gen}}) = 0, & \text{if }\mathbb{I}_{\text{static}}(W_{\text{gen}}) = 0 \\ \psi_{\text{build}}(\Lambda_{\text{runtime}}) = 0, & \text{if build fails} \\ s_{\text{vis}} + \gamma\cdot s_{\text{func}} + \lambda\cdot s_{\text{cot}}, & \text{otherwise} \end{cases}
$$

   - **$s_{\text{vis}} \in [0, 5]$（VLM 审美与视觉功能线索分）**：由 `GPT-4o-11-20` 对照题干与多路由截图 `{I_p}` 按渲染完整度、功能控件可见线索（表单/搜索栏/下拉菜单合理摆放）、布局和谐度与现代美感打 `0–5` 整数分（Prompt C.2；在 101 个网站上与 3 名资深前端开发者评分达 **Pearson $r = 0.762$、Spearman $\rho = 0.734$**，Fig. 7）；
   - **$s_{\text{func}} = \mathbbm{1}[N_{\text{err}} = 0] \in \{0, 1\}$（运行零报错分）**：$\Lambda_{\text{runtime}}$ 与 $\Lambda_{\text{console}}$ 总错误数 $N_{\text{err}}=0$ 得 `1`，否则 `0`；
   - **$s_{\text{cot}} = \mathbbm{1}[\text{valid }\texttt{<think>...</think>}] \in \{0, 1\}$**；网格寻优锁定最优权重 **`γ = 0.1, λ = 0.1`**。
4. **GRPO 目标与动态 WebVoyager 评测解耦（Eq. 8–9 & Appendix D）**：组内标准差归一化优势 $\hat{A}_{i,t} = \frac{R(y_i)-\operatorname{mean}(\{R(y_j)\})}{\operatorname{std}(\{R(y_j)\})}$，带冻结 SFT 参考模型 KL 正则（$\beta=0.01$）。离线评测时采用 **`WebVoyager`（`GPT-4o-11-20` 驱动）** 在浏览器中执行点击、填表、滚动与跨页导航（Tables 12–14），逐条验证 `WebGen-Bench` 的 647 个交互测试点统计 `FSR`。

---

## 3. 实验口径、完整超参数表与主消融硬数据（事实）

### 3.1 数据集统计（Appendix A Table 5）与两阶段训练完整超参表（§4.1）

| 阶段 / 数据集 | 规模与长度分布 | 精确训练 / 评测配置 |
| --- | --- | --- |
| **冷启动 CoT SFT** | 从 `WebGen-Instruct`（6,667 题）按 `application_type` 分层抽 **`600` 题**；`GPT-4.1-04-14`（$T=0.6, p=0.95$, max `8,192`）蒸馏银标 | 基座 `Qwen2.5-Coder-7B-Instruct`；`8× H100 (80GB)`，`2 epochs`，Batch `32`，LR **`1.0e-5`**，Max Seq **`32,768`**，Warmup `0.03` |
| **级联 GRPO (`TRL`)** | `WebGen-Instruct` 任务流，优化 **`400` 步** | Global Batch **`256`**，默认 Group **`G = 16`**（消融测 `2..32`），LR **`5e-6`**，Clip $\epsilon=0.2$，KL **$\beta=0.01$**，$\gamma=0.1, \lambda=0.1$，Prompt `4,096` / Output `8,192`；推理 $T=0.7, p=0.95$ |
| **双测试基准** | `WebGen-Bench`：101 题（中位 `84` tok，647 测试用例，13 场景）<br>`WebDev-Arena`（OOD）：LLM 筛出 119 题（中位仅 `20` tok，11 开放主题） | 统一由 `GPT-4o-11-20` 驱动 `WebVoyager` 测 `FSR` + 评 `AAS` + 统计 `VRR` 与 ESLint/依赖通过率 `LDPR` |

### 3.2 `WebGen-Bench` 主榜（Tables 1–2）、冷启动消融（Table 3）与组大小 $G$ 扩展全表（Table 4）

| 模型 / 训练策略消融 / GRPO 组大小 $G$ | 功能成功率 FSR (%) ↑ | 美学对齐 AAS (0–5) ↑ | 有效渲染率 VRR (%) ↑ | 细项 FSR：内容展示 / 用户交互 / 数据管理 / 功能测试 / 设计验证 ↑ |
| --- | :---: | :---: | :---: | :---: |
| *闭源*：`Claude-3.7-Sonnet` / `Claude-Sonnet-4` | **57.72** / 46.13 | 3.90 / 3.86 | 84.00 / 86.05 | 66.67 / 43.40 / 64.29 / 46.48 / 62.86（3.7-Sonnet） |
| *闭源*：`GPT-5` / `GPT-4.1` / `o3` / `Gemini-2.5-Pro` | 46.53 / 43.91 / 42.86 / 36.31 | 3.34 / 3.78 / 3.55 / 3.89 | 90.43 / 82.09 / 81.08 / 83.33 | 55.29 / 46.21 / 36.81 / 36.93 / 62.73（GPT-5） |
| *开源旗舰*：`DeepSeek-R1 (671B)` | 30.25 | 3.67 | 42.86 | 31.11 / 20.45 / 58.62 / 24.69 / 33.33 |
| *开源对照*：`Qwen2.5-72B` / `Qwen3-32B` / `Qwen3-Coder-30B-A3B` | 2.54 / 18.69 / 6.06 | 3.14 / 3.39 / 2.90 | 8.86 / 59.42 / 32.81 | 24.81 / 17.02 / 14.41 / 11.42 / 32.47（Qwen3-32B） |
| **`Qwen2.5-Coder-7B-Instruct`（Base）** | 1.59 | 2.73 | 30.56 | 0.00 / 3.17 / 3.12 / 0.00 / 0.00 |
| *策略消融*：`SFT Only`（600 条 × 2 epochs） | 20.08 | ~3.24 (+18.68%) | 30.69 | 建立多文件骨架，但构建容错未突破 |
| *策略消融*：`RL Only`（R1-Zero 无冷启动） | 18.23 | ~3.06 (+12.09%) | **26.82（倒退）** | 无脚手架先验导致随机探索大量构建报错 |
| **`WebGen-R1-7B`（`SFT + RL`, 默认 $G=16$）** | **29.21 (+27.62)** | **3.94 (+44.32%，全场第 1）** | **95.89 (+65.33%，全场第 1）** | **35.29 / 27.25 / 26.88 / 15.90 / 54.92** |
| **组大小扩展 $G = 2 \to 4 \to 8 \to 16 \to \mathbf{32}$** | 22.39→22.92→24.99→29.21→**34.79** | 随 $G$ 持续单调提升 | 90.98→91.07→93.52→95.89→**98.27** | **$G=32$ 一举超越 `DeepSeek-R1 (30.25%)`！** |

---

## 4. 对我们 Qwen3.8-27B 三轨项目（特别是 verify_xhs_output.cjs 与 check_2d_v2.mjs）的直接迁移方案（推论）

1. **给 `verify_xhs_output.cjs` 与 `check_2d_v2.mjs` 增加毫秒级 Phase I 静态导入闭合预检（对齐三级级联秒杀）**：
   - 目前 `verify_xhs_output.cjs`（第 264–328 行）静态阶段仅检查 `has_index_html` 和外链正则，随后立即拉起无头 Chromium（每次冷启动+SwiftShader WebGL 初始化需 2–3s）；`check_2d_v2.mjs` 同样直接进浏览器等 10s `waitForFunction`。
   - **直接移植 Eq. 3 静态早停**：在拉起 Playwright 前，用纯 Node 正则/AST 校验 `index.html` 的 `<script type="importmap">` 及 `src/*.js` 中所有 `import ... from './xxx.js'` 目标文件是否 **100% 物理存在于 `output/` 且非 0 字节**（杜绝幽灵导入），并静态核查 Track 2 是否含 `renderAt` 定义——不满足者 5ms 内直接判 `0` 分早停，节省大批量 RL Rollout 的浏览器容器算力。
2. **严守三轨本地依赖库白名单与单一职责目录约定**：
   - 正如 `WebGen-R1` 靠“锁死 `antd` + `Recharts`、禁 `shadcn/ui`、单一 `src/index.css`”把 7B 渲染率拉到 `98.27%`，我方 Track 1（`Three.js r180` + 本地 `vendor/`）、Track 2（Canvas 2D + SVG + 本地固定版 `GSAP`）、Track 3（`CadQuery 2.6.1`）必须在提示词与验收器中封禁未预装野生包与多余样式文件分裂，从源头消灭模块解析报错。
3. **Post-SFT RL 坚持“小权重二元约束（$\gamma=\lambda=0.1$）+ 大组探索（$G \ge 16\sim32$）”**：
   - 融合五维视觉盲评分（`0–5` 或 `0–1`）与二元零报错/格式奖励时，严格控制稀疏二元项系数在 `0.1` 量级，防止重演 $\gamma \ge 0.5$ 时模型通过“少画零件/砍掉交互”来博取零报错分的退化；同时利用确定性硬检的高吞吐优势将 GRPO 组大小扩至 $G=16\sim32$。

### 可直接移植的毫秒级静态导入闭合预检与三级级联奖励代码片段

```javascript
// 1. verify_xhs_output.cjs / check_2d_v2.mjs 前置秒杀门控 (Eq. 3)：零浏览器开销拦截幽灵导入与缺失契约
import fs from 'node:fs';
import path from 'node:path';

export function checkStaticProjectClosure(outputDir, { requireRenderAt = false } = {}) {
  const indexHtml = path.join(outputDir, 'index.html');
  if (!fs.existsSync(indexHtml) || fs.statSync(indexHtml).size === 0) {
    return { ok: false, reason: 'missing_or_empty_index_html' };
  }
  const html = fs.readFileSync(indexHtml, 'utf8');
  let importMap = {};
  const mapMatch = html.match(/<script[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i);
  if (mapMatch) {
    try { importMap = JSON.parse(mapMatch[1]).imports || {}; }
    catch { return { ok: false, reason: 'malformed_importmap_json' }; }
  }
  const queue = [indexHtml], visited = new Set(), allCode = [html];
  const importRe = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?`"'`（本地附件未发布）["']|<script[^>]*src=`"'`（本地附件未发布）["']/g;
  while (queue.length > 0) {
    const cur = queue.pop();
    if (visited.has(cur)) continue;
    visited.add(cur);
    const src = cur === indexHtml ? html : fs.readFileSync(cur, 'utf8');
    if (cur !== indexHtml) allCode.push(src);
    for (const m of src.matchAll(importRe)) {
      const rawSpec = m[1] || m[2];
      if (!rawSpec) continue;
      if (/^https?:\/\//i.test(rawSpec)) return { ok: false, reason: `external_cdn_forbidden:${rawSpec}` };
      const mapped = importMap[rawSpec] || rawSpec;
      const resolved = mapped.startsWith('.') ? path.resolve(path.dirname(cur), mapped) : path.resolve(outputDir, mapped.replace(/^\/+/, ''));
      if (!resolved.startsWith(path.resolve(outputDir)) || !fs.existsSync(resolved) || fs.statSync(resolved).size === 0) {
        return { ok: false, reason: `unresolved_module_import:${rawSpec}` }; // 5ms 内直接判 0 分早停，免拉起 Chromium
      }
      if (/\.(?:m?js|cjs)$/i.test(resolved)) queue.push(resolved);
    }
  }
  if (requireRenderAt && !allCode.some(c => c.includes('renderAt'))) {
    return { ok: false, reason: 'missing_renderAt_contract' };
  }
  return { ok: true, checkedModules: visited.size };
}
```

```python
# 2. 三级级联多模态奖励计算器 (Eq. 6-7，锁定最优黄金配比 gamma=0.1, lambda=0.1)
def cascaded_webgen_reward(static_ok: bool, build_and_render_ok: bool, s_vis_0_to_5: float,
                           n_runtime_console_err: int, has_valid_think_tag: bool,
                           gamma: float = 0.1, lam: float = 0.1) -> float:
    if not static_ok or not build_and_render_ok:
        return 0.0                                      # Phase I / II 失败直接归零，不触发 VLM 调用
    s_func = 1.0 if n_runtime_console_err == 0 else 0.0
    s_cot = 1.0 if has_valid_think_tag else 0.0
    return float(s_vis_0_to_5) + gamma * s_func + lam * s_cot
```

