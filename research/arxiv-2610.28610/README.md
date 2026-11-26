# InterWebCoder（arXiv:2610.28610v1）深度精读：故障归因修复造数、`<1%` 契约 Token 加权 SFT 与确定性测试驱动 RL

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> - **论文标题**：*InterWebCoder: Learning Interactive Webpage Generation from Executable Tests via Reinforcement Learning*（2026-10-20）
> - **作者与机构**：Jingyu Xiao, Dasen Dai, Yuxuan Wan, Jen-tse Huang, Yintong Huo, Hongyu Zhang, Michael R. Lyu（香港中文大学 CUHK、约翰斯·霍普金斯大学 JHU、新加坡管理大学 SMU、重庆大学）
> - **原文与本地归档**：[arXiv:2610.28610v1](https://arxiv.org/abs/2610.28610v1) · [paper.html（上游原文）](https://arxiv.org/abs/2610.28610) · [paper.txt（上游原文）](https://arxiv.org/abs/2610.28610) · `sources.json`（本地校验清单未发布）
> - **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者亲踩的初始大坑

多状态交互网页生成要求模型根据多步视觉原型 $\mathcal{S} = \{I_0 \xrightarrow{a_1} I_1 \dots \xrightarrow{a_T} I_T\}$ 同时还原每一步的界面外观与状态转移逻辑。作者在动手前通过真实开销测算与消融实验踩实了三大工程痛点：

1. **在线 GUI Agent 充当 RL 奖励验证器“耗时占四成、准确率不足三分之二”（§2.3 Fig. 2 实测硬数据）**：
   - 作者从 `InfiniteWeb` 抽样 102 个网站（平均每题 16 步交互），采用顶级闭源模型 **`GPT-5.6-Luna` + `Browser Use`** 作为在线 GUI-Agent 奖励验证器跑 RL。
   - **实测结果触目惊心**：**单样本奖励计算平均耗时高达 `214.0 秒`，独占整个 RL 训练总时长的 `39.9%`（压过 Rollout 与参数更新成为第一瓶颈），而 GUI Agent 自身的平均执行成功率仅有 `65.8%`**！高达 `34.2%` 的视觉定位与动作执行误判直接将海量假阴性噪声灌入策略梯度。
2. **无代码上下文盲写测试脚本（`15.66%` 通过率）与“网页+测试盲目双改”互相破坏（§4.3–4.4, Tables 3–4）**：
   - 真实网站源码混杂埋点、动态会话与第三方 API，必须离线合成“干净自包含网页 $\hat{W}$ + 可执行 Pytest 脚本 $\hat{P}$”。若仅凭截图生成测试（Vanilla $C_0$），249 题消融集上首次通过率仅 **`15.66%`**（爆发 210 次失败，含 40 次 `SCRIPT_DOM_MISMATCH`、50 次 `TARGET_DEFINITION_ERROR` 与 99 次 `BEHAVIORAL_MISMATCH`）；若报错后不定位责任方而把网页和测试推倒重来，极易把原本正确的一方改坏。
3. **标准交叉熵 SFT 淹没 `<1%` 的 `data-testid` 锚点 Token，且纯 SFT 反而拉低交互功能分（§5.1, §7.2 Table 5）**：
   - 用于测试脚本精确定位元素的属性（如 `data-testid="follow-button-salesforce"`）在整份网页代码中占比 **不足 `1%`**，等权 SFT 下极易漏写或写错（Base 完整 ID 覆盖率 **`0.00%`**，测试通过率 `0.75%`）。
   - 更关键的是，Table 5 显示 `InterWebCoder (SFT Only)` 虽然提升了视觉分（`IWR-Bench VFS: 34.06 -> 38.60`），但**交互功能分在双榜双双倒退**（`IWR-Bench IFS: 20.62 -> 15.77`，`Vision2Web FS: 42.19 -> 37.17`），证明纯 token 级模仿无法习得跨步可执行交互逻辑。

---

## 2. 方法论、精确数学公式与验证器工程实现（含 Appendix 超参/Prompt/防刷分细节）

### 2.1 TEDS 离线合成管线：代码上下文测试生成（CC-TSG）与故障归因修复（FAR）（§4.1–4.4）
1. **真实轨迹录制与规范化规约 $\mathcal{C}$**：由 4 名博士生在 15 大领域筛选 275 个代表性网站（社区 15.74%、媒体 10.64%、科技 10.59%、商业 8.16% 等，Table 1），合成 2,058 条用户目标指令（每站均 7.5 题）。GUI Agent 实跑录制轨迹 $\mathcal{T} = \{(s_t, a_t)\}_{t=1}^T$ 与状态图序列 $\mathcal{S}^{(1)} = \{s_0, \dots, s_T\}$（均 `10.8` 步、中位 `9` 步、长尾 `>60` 步；`click` `61.33%`、`fill` `22.79%`、`select` `10.54%`），转为测试规约 $\mathcal{C} = \{c_t = (o_t, z_t, v_t, \mathcal{A}_t)\}_{t=1}^T$（动作类型 $o_t$、规范化目标 ID $z_t$、输入值 $v_t$、预期可观测变化 $\mathcal{A}_t$）。
2. **`CC-TSG` 配对生成**：编码 Agent 剥离一切外链依赖生成自包含网页 $\hat{W} = f_{\mathrm{code}}(x, \mathcal{S}^{(1)}, \mathcal{C})$ 并写入规范 `data-testid`；随后抽取组件树、目标 ID 与事件处理器构成精简代码上下文 $\mathcal{G}(\hat{W})$，条件生成对齐 DOM 语义的 Pytest 脚本 $\hat{P} = f_{\mathrm{test}}(\mathcal{C}, \mathcal{G}(\hat{W}))$。
3. **Failure-Attributed Repair（FAR，Table 2 七类静态+运行时归因规则，最多迭代 $K=4$ 轮）**：严禁盲目双改，先用静态扫描与浏览器前缀回放定责，**仅对归属故障方做外科手术式修复**：

| 阶段 | 故障类型（Table 2） | 归属责任组件 | 触发判定证据 | 249 题消融降幅（Vanilla → CC-TSG+FAR） |
| --- | --- | :---: | --- | :---: |
| **静态期** | `TARGET_DEFINITION_ERROR` | **Webpage Code** | 规约要求的 `z_t` 在网页中缺失或被重复赋给多个元素 | `50 → 13` |
| **静态期** | `TARGET_REFERENCE_ERROR` | **Test Script** | 测试脚本漏引规约目标 ID，或引用了规约外野生 ID | `1 → 0` |
| **静态期** | `SCRIPT_DOM_MISMATCH` | **Test Script** | 测试 API 与源码 DOM 标签不兼容（如对非 `<select>` 调 `select`） | **`40 → 2`（CC-TSG 单项降至 13）** |
| **静态期** | `SCRIPT_SPECIFICATION_MISMATCH` | **Test Script** | 动作顺序、目标或断言目标违背测试规约 $\mathcal{C}$ | `3 → 2` |
| **运行期** | `TARGET_AVAILABILITY_ERROR` | **Webpage Code** | 前置已验证动作跑通后，目标元素意外消失、隐藏、`disabled` 或不可点 | `17 → 9` |
| **运行期** | `SCRIPT_RUNTIME_ERROR` | **Test Script** | 测试脚本语法、导包、pytest 收集或初始化在轨迹执行前报错 | 归零 |
| **运行期** | `BEHAVIORAL_MISMATCH` | **Uncertain → LLM 判责** | 动作/断言超时等模糊失败：交由 LLM 裁判结合运行 DOM 与截图定责单修 | **`99 → 0`（FAR 核心贡献！）** |

4. **全断言通过 + 多状态视觉相似度 $\ge 0.90$ 双闸准入（Eq. 2–4）**：重放测试得状态序列 $\mathcal{S}^{(2)} = \{\hat{s}_0, \dots, \hat{s}_T\}$，计算逐帧均值相似度（若测试全过但 $V < 0.90$，则定责于网页代码并喂入失配截图对继续修外观；修复曲线在 $K=4$ 轮趋于饱和，Fig. 7）：
   $$V = \frac{1}{T+1}\sum_{t=0}^{T} \operatorname{Sim}(s_t, \hat{s}_t), \qquad \operatorname{Keep} = \mathbb{I}\!\left[\exists r \le 4:\; R^{(r)} = \mathrm{all\text{-}pass} \;\land\; V^{(r)} \ge 0.90\right]$$
   最终从 2,058 题合成 **1,736 条验真样本（成功率 `84.35%`）**；消融集总失败数从 `210` 降至 `26`（**`-87.6%`**），通过率 `15.66% -> 91.16%`，单样本合成均价仅 `$0.0598`。

### 2.2 `<1%` Test-ID Token 加权 SFT（`ms-swift`）与测试驱动 GRPO（TDRL）（§5.1–5.2）
1. **Test-ID 加权语言建模损失（Eq. 5）**：对构成测试绑定标识符的 token 集 $\mathcal{T}_{\mathrm{id}}$ 赋权重 $w_i = \lambda$，其余代码 token $w_i = 1$：
   $$\mathcal{L}_{\mathrm{SFT}} = -\frac{1}{\sum_{i=1}^{N} w_i}\sum_{i=1}^{N} w_i \log p_\theta\!\left(y_i \mid \mathcal{S}, y_{<i}\right) \qquad (\text{实验寻优 }\lambda = 2)$$
   $\lambda = 2$ 在代码完整度、ID 覆盖率、测试通过率与 CLIP 四项指标上同步登顶；继续增大 $\lambda > 2$ 会过分挤压常规 JS/HTML 逻辑权重导致功能退化（§7.4.1 Fig. 9）。
2. **TDRL 确定性回放双奖励与 Clipped GRPO 目标（Eq. 6–8）**：RL 阶段仅向策略输入多状态视觉原型 $\mathcal{S}$ 采样 $G=32$ 个候选网页 $\{\hat{W}_i\}_{i=1}^G$（**测试规约 $\mathcal{C}$ 与 Pytest 脚本严格保密在验证器侧**），本地无头浏览器执行 $N$ 项功能检查并抓拍 $T+1$ 个回放状态截图算 CLIP 相似度：
   $$r_{\mathrm{pass}} = \frac{1}{N}\sum_{j=1}^{N} \mathbb{I}[\mathrm{test}_j = \mathrm{pass}], \qquad r_{\mathrm{vis}} = \frac{1}{T+1}\sum_{t=0}^{T} \operatorname{CLIPSim}(s_t, \hat{s}_t), \qquad r = \alpha_{\mathrm{pass}} r_{\mathrm{pass}} + \alpha_{\mathrm{vis}} r_{\mathrm{vis}}$$
   取 $(\alpha_{\mathrm{pass}}, \alpha_{\mathrm{vis}}) = (0.5, 0.5)$，经组内优势归一化 $A_i = \frac{r_i - \operatorname{mean}(\{r_j\})}{\operatorname{std}(\{r_j\}) + \epsilon}$ 后更新策略（冻结 SFT 模型为 $\pi_{\mathrm{ref}}$，奖励从 `0.45` 稳步收敛至 `0.89`、熵从 `0.7` 降至 `0.3`，Fig. 8）：
   $$\mathcal{J}_{\mathrm{GRPO}}(\theta) = \mathbb{E}\!\left[\frac{1}{G}\sum_{i=1}^{G}\frac{1}{L_i}\sum_{t=1}^{L_i} \min\!\Big(\rho_{i,t}(\theta)A_i,\; \operatorname{clip}\big(\rho_{i,t}(\theta), 1-\varepsilon, 1+\varepsilon\big)A_i\Big) - \beta D_{\mathrm{KL}}\!\left(\pi_\theta \,\|\, \pi_{\mathrm{ref}}\right)\right]$$

---

## 3. 实验口径、完整超参数表与主消融硬数据（事实）

### 3.1 `ms-swift` SFT + GRPO 完整训练超参数表（§6.5）

| 阶段 | 基座 / 框架 / 算力 | 样本数与步数 | 精确优化与采样超参 |
| --- | --- | --- | --- |
| **Test-ID SFT** | `Qwen3.5-9B` / **`ms-swift`** / `8× H100` (BF16) | `1,736` 条全量验真样本 × `5 epochs` | **Full-Param 全参**，`MAX_PIXELS = 1,003,520`，Max Seq `32,768`（Completion `16,384`），**$\lambda = 2$**，Global Batch `64`，Fused AdamW LR **`1e-6`**，wd `0.01`，Cosine + `5%` warmup，Grad Norm `1.0` |
| **TDRL (GRPO)** | 同上（$\pi_{\mathrm{ref}}$ 为冻结 SFT） | `1,100` 条样本，训练 **`500 steps`** | **LoRA（`r=32, α=64, dropout=0.05`）**，Group Size **`G = 32`**，采样 $T=0.8$，Max Seq `20,480`，LR **`1e-5`**，KL **$\beta = 0.04$**，$(\alpha_{\mathrm{pass}}, \alpha_{\mathrm{vis}})=(0.5, 0.5)$，Cosine + `3%` warmup |

### 3.2 全模型双基准主表（Table 5）、效率碾压表（Table 6）与步长分布消融表（Table 7）

> 榜单口径：`IWR-Bench`（113 真实网站视频任务 / 1,001 动作，`Final = 0.7 IFS + 0.3 VFS`，其中 `LFS = 0.5 OCR + 0.5 DINOv2`）；`Vision2Web`（193 任务 / 918 原型图 / 1,255 功能测试，`Final = 0.5 VS + 0.5 FS`）。

| 模型 / 方法 | IWR IFS ↑ | IWR LFS / HFS / VFS ↑ | **IWR Final ↑** | Vision2Web VS ↑ | Vision2Web FS ↑ | **Vision2Web Final ↑** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| *闭源*：`GPT-5.6-Luna` | 80.00 | 65.82 / 65.20 / 65.51 | **75.65** | 38.30 | 76.04 | **57.17** |
| *闭源*：`Claude-Sonnet-5` | 44.83 | 65.02 / 64.99 / 65.00 | 50.88 | 36.17 | 58.99 | 47.58 |
| *闭源*：`Gemini-3.7-Flash` | 38.48 | 62.69 / 63.38 / 63.03 | 45.85 | **50.01** | 36.02 | 43.01 |
| *30B 级开源*：**`Qwen3.8-27B`** | 42.19 | **68.82 / 69.57 / 69.19** | 50.29 | 30.27 | 42.31 | 36.29 |
| *30B 级开源*：`WebVIA (Qwen3.5-27B)` / `Qwen3.5-27B` | 33.02 / 30.65 | 57.99 / 59.37 (VFS) | 40.51 / 39.26 | 34.45 / 33.09 | 60.25 / 58.33 | 47.35 / 45.71 |
| *30B 级开源*：`Qwen3-VL-30B-A3B-Instruct` | 25.31 | 50.82 / 36.89 / 43.85 | 30.87 | 28.97 | 41.24 | 35.11 |
| *9B 开源基线*：`WebVIA (Qwen3.5-9B)` / `Qwen3.5-9B` | 22.45 / 20.62 | 43.78 / 34.06 (VFS) | 28.85 / 24.65 | 31.54 / 28.90 | 42.11 / 42.19 | 36.83 / 35.56 |
| *9B 开源基线*：`GLM-4.6V-Flash` / `Qwen3-VL-8B` | 12.74 / 9.38 | 43.10 / 22.60 (VFS) | 21.85 / 13.35 | 23.30 / 26.80 | 28.52 / 22.67 | 25.91 / 24.74 |
| *同行 RL（同训 9B）*：`WebGen-R1` / `WebGen-Agent` | 16.66 / 15.00 | 22.31 / 24.01 (VFS) | 18.36 / 17.70 | 14.12 / 13.62 | 35.28 / 29.31 | 24.70 / 21.47 |
| **Ours**：`InterWebCoder (SFT Only, 9B)` | 15.77 (−4.85) | 41.82 / 35.39 / 38.60 | 22.62 (−2.03) | 32.46 (+3.56) | 37.17 (−5.02) | 34.82 (−0.74) |
| **Ours**：`InterWebCoder (GRPO Only, 9B)` | 31.48 (+10.86) | 45.55 / 39.89 / 42.72 | 34.85 (+10.20) | 29.19 (+0.29) | 48.86 (+6.67) | 39.03 (+3.47) |
| **Ours**：**`InterWebCoder (SFT + GRPO, 9B)`** | **46.38 (+25.76)** | **60.73 / 46.47 / 53.60** | **48.54 (+23.89)** | **37.52 (+8.62)** | **59.31 (+17.12)** | **48.42 (+12.86)** |

- **RL 反馈耗时与外部 Token 对比（Table 6，同 9B 基座每样本均值）**：
  - `WebGen-Agent GRPO`：Reward **`130.01s (33.16%)`** | Update `139.60s` | Rollout `122.40s` | 总计 `392.01s` | 外耗 **`16,699` tok**；
  - `WebGen-R1 GRPO`：Reward **`92.40s (25.16%)`** | Update `142.00s` | Rollout `132.90s` | 总计 `367.30s` | 外耗 **`6,684` tok**；
  - **`InterWebCoder`**：Reward **`2.08s (0.74%，削减 >97.7%！)`** | Update `138.70s` | Rollout `140.40s` | 总计 `281.18s`（**`1.39×` 提速**）| 外耗 **`0` tok**！
- **SFT 交互步数范围消融（Table 7，各 200 题训 / 80 题测）**：`Base`（完整 ID 覆盖 `0.00%` / 通过率 `0.75%`）→ 单一区间 `Short(1–6)` `12.50%/6.62%`、`Medium(7–10)` `16.25%/7.59%`、`Long(11–14)` `12.50%/6.94%`、`Very Long(15–46)` `18.75%/10.47%` → **四档均衡混合 `Mix` 登顶 `22.50%` 完整覆盖率、`85.80%` 平均覆盖率与 `14.10%` 通过率（代码完整度 `93.75%`）**。

---

## 4. 对我们 Qwen3.8-27B 三轨项目（特别是 verify_xhs_output.cjs 与 check_2d_v2.mjs）的直接迁移方案（推论）

1. **在 `ms-swift 4.5.2` SFT 中精准定位“契约锚点 Token”并赋予 `loss_scale = 2.0`（$\lambda=2$）**：
   - Table 5 揭示了一个对我们极其关键的事实：原生 **`Qwen3.8-27B`** 在 `IWR-Bench` 上的视觉保真度 **`VFS = 69.19` 全场第一（甚至高过 `GPT-5.6-Luna` 的 `65.51` 和 `Claude-Sonnet-5` 的 `65.00`）**，其唯一短板是动态交互触发准确率（`Vision2Web FS = 42.31`）！
   - 我们在 `ms-swift 4.5.2` 训 `Qwen3.8-27B` 时，可直接对占比 `<1%` 的硬检契约绑定点——Track 2 的 `window.__SCENE_READY__`、`window.renderAt`、`window.__2D_STATE__`、`id="play"`/`id="pause"`/`id="scrub"`，Track 1 的 `window.__3D_STATE__`、`importmap`，Track 3 的 `DEFAULT_PARAMS`——设置 token 级 **`loss_scale = 2.0`**，用极小代价杜绝契约漏写导致的验证器秒挂。
2. **用 `CC-TSG + FAR`（$K=4$ 归因单边修）为 Track 1/2 高难题沉淀“专属 Playwright 断言脚本”**：
   - 现有 `check_2d_v2.mjs`（第 441–486 行）仅测通用时间轴按钮，`verify_xhs_output.cjs`（第 451–518 行）仅盲点前 2 个可见控件看全局 `pixelMad >= 1.5`，无法验证题目特定业务交互（如切换科学可视化图层、点击机关触发机械联动）。
   - 在 `kimi-k3.1-pro` 造数管线收尾时，提取最终通过代码的 DOM/状态上下文 $\mathcal{G}(\hat{W})$ 同步合成每题专属的 Playwright 断言子模块，并用 Table 2 的静态+运行时归因规则做最多 4 轮单边校准。一旦每道题沉淀出确定性可执行测试，后续对 `Qwen3.8-27B` 跑 $G=16\sim32$ 的 TDRL 时，单样本验证仅需 **`~2 秒`、0 VLM Token 消耗**！
3. **坚持跨交互深度 `Mix` 配比**：遵照 Table 7 结论，在 Track 2 与 CAD 首批 150–300 条精修样本中均衡覆盖短链（1–3 控件）、中链（多参数联动）与长链（分幕叙事+状态切换）交互，避免单一交互跨度偏科。

### 可直接移植的训练与验证代码片段（`ms-swift` 契约 Token $\lambda=2$ 加权 + FAR 静态归因器）

```python
# 1. ms-swift SFT 数据预处理：精准定位占比 <1% 的三轨必含契约锚点并赋 loss_scale = 2.0 (Eq. 5, lambda=2)
import re

CONTRACT_ANCHOR_RE = re.compile(
    r'(window\.__SCENE_READY__|window\.renderAt|window\.__2D_STATE__|window\.__3D_STATE__'
    r'|data-testid=["\'][^"\']+["\']|id=`"\'`（本地附件未发布）["\']'
    r'|DEFAULT_PARAMS|type=["\']importmap["\'])'
)

def build_contract_weighted_segments(code_text: str, lambda_id: float = 2.0):
    """将 assistant 代码拆分为 ms-swift 支持的分段 loss_scale 列表，普通 token=1.0，契约锚点=2.0"""
    segments, last = [], 0
    for m in CONTRACT_ANCHOR_RE.finditer(code_text):
        if m.start() > last:
            segments.append({"text": code_text[last:m.start()], "loss_scale": 1.0})
        segments.append({"text": m.group(0), "loss_scale": lambda_id})
        last = m.end()
    if last < len(code_text):
        segments.append({"text": code_text[last:], "loss_scale": 1.0})
    return segments
```

```javascript
// 2. check_2d_v2.mjs / TEDS 造数端：Table 2 静态期故障归因前置定责器（严禁盲目同时重写代码与测试！）
export function attributeStaticFailure(specTargets, htmlAndJsSource, testScriptSource) {
  for (const targetId of specTargets) {
    const defMatches = htmlAndJsSource.match(new RegExp(`(?:id|data-testid)=["']${targetId}["']`, 'g')) || [];
    if (defMatches.length !== 1) {
      // 缺失或重复定义 -> 100% 归责于生成的网页代码，严禁改动测试脚本
      return { fault: 'TARGET_DEFINITION_ERROR', component: 'WEBPAGE_CODE', targetId, count: defMatches.length };
    }
    if (!testScriptSource.includes(targetId)) {
      // 网页已唯一定位但测试漏引 -> 100% 归责于测试脚本
      return { fault: 'TARGET_REFERENCE_ERROR', component: 'TEST_SCRIPT', targetId };
    }
  }
  // 检查 selectOption 是否误用于非 <select> 标签
  const selectCalls = [...testScriptSource.matchAll(/selectOption\(["']#([a-zA-Z0-9_-]+)["']/g)];
  for (const [, id] of selectCalls) {
    const isSelectTag = new RegExp(`<select[^>]*id=["']${id}["']`, 'i').test(htmlAndJsSource);
    if (!isSelectTag) return { fault: 'SCRIPT_DOM_MISMATCH', component: 'TEST_SCRIPT', targetId: id };
  }
  return { fault: null, component: null };
}
```

