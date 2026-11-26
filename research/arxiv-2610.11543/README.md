# WebLoop（arXiv:2610.11543v1）深度精读：同策略三角色联合闭环 RL、两阶段 Critic 归因与防拷贝伪改机制

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> - **论文标题**：*Learning the Loop, Not Just the Page: Execution-Grounded Loop Learning for Web Generation*（2026-10-08）
> - **作者与机构**：Yuxin Meng, Ruixu Zhang, Junjie Wang, Yuhan Suo, Yuhan Sun, Ruining Hu, Yiyao Yu, Yubin Wang, Shouwei Ruan, Bin Wang, Yue Liao, Yuxiang Zhang, Yujiu Yang（清华大学、华为诺亚方舟实验室、华东师大、同济大学、北航、新加坡国立大学 NUS）
> - **原文与本地归档**：[arXiv:2610.11543v1](https://arxiv.org/abs/2610.11543v1) · [paper.html（上游原文）](https://arxiv.org/abs/2610.11543) · [paper.txt（上游原文）](https://arxiv.org/abs/2610.11543) · `sources.json`（本地校验清单未发布） · 代码仓：`https://github.com/IIGROUP/WebLoop`
> - **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者亲踩的初始大坑

现有可执行网页强化学习大多只优化终态页面（Generation-Only RL），却忽视了“如何仅读源码诊断隐式边界缺陷并驱动精准返修”这一完整工程闭环。作者在 `Qwen3.5-9B/27B` 共享策略中联合训练 `Generator → Critic → Refiner` 时，踩透了四个极易导致闭环崩盘的大坑：

1. **非对称奖励可观测性导致“第 0 步直训下游有用性（Helpfulness）”把模型训崩（§5.2 Table 4）**：
   - Generator 与 Refiner 产出可执行网页，直接拿浏览器奖励 $r_{\mathrm{web}}$；而中间 Critic 推理时**不跑浏览器（Execution-Free）**，自身无直接执行结果。
   - 若从头只用下游净提分 $H(c_j)$ 训 Critic（`Helpfulness Only`），早期尚未成型的 Refiner 会把精准诊断改坏（吃负分）、把胡乱诊断碰巧改对（吃正分），导致首轮 `Gen` 在 `WebGen-Bench` 跌至 `22.7%`（低于 Base `23.5%`）；从头混合 `H + λD`（`Mixed from Start`）仍比两阶段课程低 **`-5.7` 个点（`33.2% vs 38.9%`）**；外部教师版 `Critique-GRPO` 甚至从 `23.5%` 训崩至 **`17.6%`**（Table 1）！
2. **分阶段割裂训练（`Gen -> Critic+Refine`）丢失首轮能力内化（§5.1 Table 3）**：
   - 先训完 Generator 再冻结/切阶段训 Critic+Refiner（`Staged Training`），其首轮直出 `Gen` 在 `WebGen-Bench` 上比三角色同步联合训练低 **`-7.9` 个点（`26.3% vs 34.2%`）**，证明共享权重同步更新才能把“红队找隐式 bug 的直觉”反向蒸馏进第一遍写代码过程。
3. **Refiner 极强的“自回归拷贝先验（Copy Prior）”与近似重复伪改零增益机制（Appendix A.2 & D Fig. 16）**：
   - 若提示词把旧网页 `{prev_html}` 放在前面、把 `{critique}` 放在末尾，Refiner 极易受拷贝先验支配而照抄旧代码、无视批评做表面微调。
   - 在奖励机制上，由于 $H(c_j) = \widehat{U}(c_j) - r_{\mathrm{web}}(y_b)$ 严格度量浏览器契约断言的**净跃迁增益**，任何未能把真实测试项从 `FAIL` 翻转为 `PASS` 的近似重复/表面伪改其增益**严格归零（$\Delta r_{\mathrm{web}} = 0$）**（注：论文正文与 HTML 原文通过净执行差值归零 + Prompt 缺陷前置根治伪改，未额外设字面编辑距离阈值；对无法解析出合法需求 JSON 的坏 Critique 则直接打最低惩罚分 `-1` 并**熔断不展开下游 Refiner 分支**）。
4. **“判对需求未满足”绝不等于“定准代码病灶”**：Appendix C.4（Fig. 8–13）实证拆解了闭环断裂的 **6 类微观失败模式**（见 §2.3）。

---

## 2. 方法论、精确数学公式与验证器工程实现（含 Appendix 超参/Prompt/防刷分细节）

### 2.1 显隐需求交互契约图（ICG）、三模型交叉验真与 `3 + 3 + 9` 分支采样（§3.1, §3.4 & Appendix A.2, B）
1. **隐式需求占 `53.9%` 的可执行题库与三模型可解性硬门槛（Appendix B Eq. 21–24）**：
   - 覆盖 21 个领域、1,442 场景共 **2,880 道任务**，每题平均 `11.87` 条需求 = `5.47` 条显式功能入口 + **`6.39` 条隐式行为约束（占 `53.9%`：状态一致性、操作顺序、空/负/越界输入边界、可逆重置）**，编译为交互契约图 $\mathcal{G}_x$（平均 `10.64` 状态、`11.40` 转移、`28.15` 条可执行断言）。
   - **防废题交叉过滤（Eq. 24）**：独立用 `Kimi-K2.6`、`Claude Opus 5`、`GPT-5` 生成参考实现跑浏览器，**仅当三模型转移有效率同时满足 $T_m \ge 0.60$** 且通过双人五维审计才准入库。在 300 个交互案例上，自动评测器与两名独立人类评审一致率达 **`88.0% / 90.0%`、Pearson `0.902 / 0.898`、Cohen's $\kappa = 0.758 / 0.799$**（逼近人类间 $\kappa = 0.838$，Table 5）。
2. **页面执行奖励与中位残缺草稿分支（Eq. 1–3, 12–13）**：
   $$r_{\mathrm{web}}(y) = 0.50\,T(y) + 0.25\,R_{\mathrm{e}}(y) + 0.25\,R_{\mathrm{i}}(y) \in [0, 1]$$
   每题先由 Generator 采 $n_g=3$ 个初始页 $\{y_i^{(1)}\}_{i=1}^3$，筛选合法但未满分的残缺集 $\mathcal{Y}_x^- = \{y_i^{(1)} \mid y_i^{(1)}\text{ valid},\; r_{\mathrm{web}}(y_i^{(1)}) < 1\}$，取中位数候选作唯一共享草稿 $y_b = \operatorname{Median}_{r_{\mathrm{web}}}(\mathcal{Y}_x^-)$（若 $\mathcal{Y}_x^- = \varnothing$ 则不展开后续分支）；在**完全屏蔽浏览器结果与报错日志**的前提下采样 $n_c=3$ 条免执行诊断 $c_j$，每条诊断再驱动 $n_r=3$ 个独立修订页 $y_{j,k}^{(2)}$——单题共 **`3 Gen + 3 Crit + 9 Ref = 15` 条输出（`12` 个可执行网页）**。

### 2.2 免执行 Critic 的两阶段奖励公式与同境角色分组 GRPO（§3.2–3.3 & Appendix A.2）
1. **均衡类别诊断区分度 `Discriminability`（Youden's $J$，Eq. 14–16）**：记草稿 $y_b$ 上真实失败显式需求集 $\mathcal{F}=\{q: z_q=0\}$、通过集 $\mathcal{P}=\{q: z_q=1\}$，Critic 预测 $\hat{z}_{j,q}\in\{0,1\}$：
   $$a_{\mathrm{fail}}(c_j) = \frac{1}{|\mathcal{F}|}\sum_{q\in\mathcal{F}}\mathbb{I}[\hat{z}_{j,q}=0], \qquad a_{\mathrm{pass}}(c_j) = \frac{1}{|\mathcal{P}|}\sum_{q\in\mathcal{P}}\mathbb{I}[\hat{z}_{j,q}=1]$$
   $$D(c_j) = \begin{cases} a_{\mathrm{fail}}(c_j) + a_{\mathrm{pass}}(c_j) - 1, & |\mathcal{F}|>0,\ |\mathcal{P}|>0 \\ 2a_{\mathrm{fail}}(c_j) - 1, & |\mathcal{F}|>0,\ |\mathcal{P}|=0 \\ 2a_{\mathrm{pass}}(c_j) - 1, & |\mathcal{F}|=0,\ |\mathcal{P}|>0 \\ 0, & Q_x = 0 \end{cases} \;\in [-1, 1]$$
2. **回溯性下游有用性 `Helpfulness` 与 15 步两阶段切换公式（Eq. 7, 17–19）**：
   $$H(c_j) = \frac{1}{n_r}\sum_{k=1}^{n_r} r_{\mathrm{web}}\!\left(y_{j,k}^{(2)}\right) - r_{\mathrm{web}}(y_b), \qquad r_{\mathrm{crit}}^{(m)}(c_j) = \begin{cases} D(c_j), & m \le 15 \;\text{（约前 1K 样本诊断暖机）} \\ H(c_j) + \lambda D(c_j), & m > 15 \;\text{（主实验 }\lambda = 0.2\text{）} \end{cases}$$
3. **角色专属同境分组归一化 + 单批联合 GRPO（Eq. 8–11）**：严格划分为 $G_{\mathrm{gen}}(x)$（3 条）、$G_{\mathrm{crit}}(x,y_b)$（3 条）、$\{G_{\mathrm{ref},j}(x,y_b,c_j)\}_{j=1}^3$（各 3 条）共 5 个局部同境组独立算 $A_o = \frac{r(o)-\mu_{g(o)}}{\sigma_{g(o)}+\epsilon_{\mathrm{norm}}}$，再合入单一总批次 $\mathcal{O}$ 做 Token-Mean 裁剪更新（无显式 KL 项）：
   $$\mathcal{L}_{\mathrm{GRPO}}(\theta) = -\frac{1}{N_{\mathrm{tok}}}\sum_{o\in\mathcal{O}}\sum_{t=1}^{|o|} \min\!\Big(\rho_{o,t}(\theta)A_o,\; \operatorname{clip}\big(\rho_{o,t}(\theta), 1-\epsilon_{\mathrm{clip}}, 1+\epsilon_{\mathrm{clip}}\big)A_o\Big)$$

### 2.3 Appendix C 六类闭环失败模式（Fig. 7–13）与 Appendix D 三角色 Prompt 铁律
| 案例图号 | 闭环成败类型 | 真实代码病理与执行断言结果（WebRise 实例） |
| --- | --- | --- |
| **Fig. 6–7** | **精准诊断并修复成功** | 投票结果提前泄露+缺 `data-post-id`（Fig. 6）；清空文件大小过滤框后空串解析为 **`NaN`** 误筛全部 12 个文件（Fig. 7），补空值守卫后 `FAIL -> PASS`。 |
| **Fig. 8** | ① Critic 假阳性误报 | 可见消息选中态由 CSS 类与 ID Set 正确控制（已 PASS），Critic 误抓未同步的隐藏 checkbox；Refiner 顺手同步未破坏原功能。 |
| **Fig. 9** | ② 判对 FAIL 但病灶跑偏 | 判对分类标签计数未满足，但 `fix` 只让修类型匹配而漏提渲染计数标签，Refiner 照改后目标断言仍 FAIL。 |
| **Fig. 10** | ③ 同分 $D=0.75$ 定位分叉 | 两份 Critique 需求判别完全相同，仅定位到“弹窗打开态与已签署态混用”的 A 救活页面（`FAIL -> PASS`），改关窗逻辑的 B 仍 FAIL。 |
| **Fig. 11** | ④ 指导正确但漏共因缺陷 | 正确指出缺事件监听且 Refiner 已补上，但漏查另一处选择器拼写错误导致表头全选框仍被清空，断言仍 FAIL。 |
| **Fig. 12** | ⑤ Refiner 漏执行明确指令 | 同一份正确指出缺事件绑定的 Critique 下，一条采样补上绑定 PASS，另一条漏写绑定 FAIL（纯执行失真）。 |
| **Fig. 13** | ⑥ Refiner 修 A 坏 B 回归 | 修“点赞高亮反馈缺失”时，把当前用户点赞布尔态与总点赞计数器混写，导致原本 PASS 的计数断言倒退为 **`PASS -> FAIL`**！ |

- **Appendix D Prompt 工程精髓（Fig. 14–16）**：
  - **Critic（Fig. 15 红队 QA）**：“假定每条需求都坏了，除非 JS 源码证明其无懈可击；漂亮 UI 不是证据”，强制逐条推导 **5 类隐式攻击面**（非法/空/负/非数值输入、保存与重绘持久化、过滤/排序激活态一致性、增删开关可逆性、重复/乱序点击 DOM 稳健性）；**防解析崩溃死规矩**：严禁在 `fix` 字符串内出现反引号 `` ` `` 或反斜杠 `\`，严禁泄露需求 ID，思考极度精炼不循环。
  - **Refiner（Fig. 16 缺陷前置重写）**：输入顺序刻意排为 **`{critique} → {input_text} → {prev_html}`**（破除复读旧代码的先验），并明令：**“对每个被标坏的功能，彻底删除旧实现并从零重写其 JS 与 DOM 逻辑，严禁小修小补；未标坏功能原样不动！”**

---

## 3. 实验口径、完整超参数表与主消融硬数据（事实）

### 3.1 `verl` 训练超参数表（Appendix A.1）
- **系统与超参**：`Qwen3.5-9B` & `Qwen3.5-27B`（三角色全共享参数） / `verl`（FSDP2 Actor + 异步 vLLM 每步同步权重）+ **72 并发浏览器**（硬超时 `2,400s`）；`2,880` 题，Task Batch **`64`**，LR **`1e-6`**，**KL = `0`**，采样 $T=0.7, p=1.0$，Prompt/Response 上限各 `16,384` tok；Critic 暖机 `15` 步后切 $H + 0.2D$。

### 3.2 主榜、角色/奖励消融与细粒度分类全表（Tables 1, 3, 4, 6）

| 模型 / 方案（`WebGen-Bench` 设 `autoSelectTemplate=false` 空仓起手） | WebRise $T$ / $R_e$ / $R_i$ ↑ | **WebRise Overall ↑** | WebGen Start-Fail ↓ | **WebGen Acc (%) ↑** | WebGen 细项：功能测试 / 数据展示 / 设计验证 ↑ |
| --- | :---: | :---: | :---: | :---: | :---: |
| *前沿参考*：`GPT-6 Astra` / `Claude Opus 4.7` / `Gemini 3.1 Pro` | 62.5/78.9/57.7 · 48.8/57.6/45.8 · 50.7/61.1/47.5 | **66.4** / 50.7 / 53.1 | 1.4 / 1.2 / 0.3 | 43.2 / **55.3** / 46.4 | 30.5/51.1/66.4 · **41.3/69.1/73.4**（Opus） |
| *超大开源*：`Qwen3.5-397B-A17B` / `Kimi-K2.6 (1T)` / `GLM-5.3` | 45.7/57.2/42.8 · 44.6/54.2/41.8 · 59.5/77.1/54.9 | 48.6 / 46.9 / 63.8 | 4.8 / 7.9 / 0.0 | 20.6 / 31.2 / 26.5 | 11.5/24.5/40.2 · 20.9/37.9/49.6（K2.6） |
| **`Qwen3.5-9B` Base** / `Gen-Crit-Refine (w/o RL)` | 23.2/45.3/22.1 · 25.8/47.9/24.6 | 30.2 / 32.8 | 4.3 / 4.9 | 23.5 / 31.1 | 15.5 / 25.0 / 43.4（Base） |
| *同行闭环*：`Critique-GRPO (9B)` / `Critique-RL (9B)` | 27.6/50.0/26.2 · 26.9/48.8/25.6 | 34.6 / 33.8 | 1.5 / 5.1 | **17.6（崩）** / 28.5 | 11.1/16.9/36.9 · 19.5/30.4/50.8 |
| *角色消融*：`Generation Only` / `Refine w/o Critique (Refine)` | 29.5/54.1/27.3 · 32.9/57.3/29.7 | 36.9 / 40.0 | 3.9 / 0.0 | 23.0 / 26.7 | — |
| *阶段消融*：`Staged (Gen -> Crit+Ref)` 首轮 / 精修后 | 27.6/52.0/25.9 · 32.9/56.4/30.9 | 35.2 / 40.1 | 2.2 / 2.2 | 26.3 / 36.1 | — |
| *Critic 奖励消融*：`D Only` / `H Only` / `Mixed from Start`（精修） | 33.4/57.3/30.7 · 31.3/54.1/28.7 · 32.7/56.5/29.4 | 40.5 / 38.0 / 39.5 | 2.2 / 2.6 / 3.2 | 33.2 / 34.6 / 33.2 | — |
| **`WebLoop (9B)` 首轮 `Gen` / 闭环 `Refine`** | **31.7/55.4/30.0** · **34.6/57.9/32.0** | **39.1 / 41.5 (+11.3)** | 3.6 / 5.6 | **34.2 / 38.9 (+15.4)** | **27.3 (+11.8) / 47.0 (+22.0) / 58.6** |
| **`Qwen3.5-27B` Base** / `Gen-Crit-Refine (w/o RL)` | 36.3/47.3/34.3 · 40.5/63.1/37.6 | 39.3 / 47.1 | 2.6 / 2.6 | 29.8 / 38.1 | 17.1 / 39.5 / 50.0（Base） |
| **`WebLoop (27B)` 首轮 `Gen` / 闭环 `Refine`** | **43.8/66.6/40.1** · **46.1/68.0/42.7** | **50.2 / 52.2 (+12.9)** | **0.2 / 0.2** | **32.5 / 42.8 (+13.0)** | **29.5 (+12.4) / 51.3 (+11.8) / 66.8** |

> 跨检查点交叉配对（Fig. 4b `step 20/30/45`）证实 Generator 与 Critic 双向协同进化（`38.4 -> 41.5`）；纯文本训练零样本泛化至 `Text/Markdown/Sketch/Image/Video` 五模态均分 `31.9 -> 40.1`（Table 2）。

---

## 4. 对我们 Qwen3.8-27B 三轨项目（特别是 verify_xhs_output.cjs 与 check_2d_v2.mjs）的直接迁移方案（推论）

1. **立刻复用“红队 5 类隐式攻击面 + 缺陷前置防拷贝顺序”重构我方多轮精修提示词**：
   - 在 Track 2 多文件动画与 Track 3 参数化 CAD 的自检轮中，植入 Fig. 15 红队准则：主动追查 `renderAt(t)` 逆序跳转未清画布残影、滑块推至极值 `0/NaN` 崩溃、`DEFAULT_PARAMS` 改参引发布尔求交退化等隐式边界；
   - 局部返修提示词强制按 **`{具体缺陷与重写方案} → {任务规格契约} → {待修模块源码}`** 排列，要求对报错/假动模块彻底重写逻辑而非微调凑合。
2. **基于 `check_2d_v2.mjs` 与 `verify_xhs_output.cjs` 现成二元断言向量零成本落地 `WebLoop` 同策略闭环 RL**：
   - `check_2d_v2.mjs` 原生输出 8 个正交二元判定项（`target_not_visible`、`static_stage_or_hud_only_motion`、`svg_uncoupled_css_or_smil_clock`、`out_of_order_seek_mismatch`、`loop_discontinuity`、`seam_velocity_jump`、`scrub/play/pause`、`text_or_hud_overlap`），`verify_xhs_output.cjs` 原生输出 `L1/L2/L3/L3_plus_ui_control_effect` 四级布尔真值 $\mathbf{z}(y)$！
   - 在 `Qwen3.8-27B` SFT 后 RL 中，可直接用这些零成本真值向量算 Youden's $J$ 诊断分 $D(c_j)$，前 15 步先训准免执行/看图诊断，15 步后切入 $H(c_j) + 0.2 D(c_j)$，严惩 Fig. 13 式的“修好 `#scrub` 却把 `text_or_hud_overlap` 从 PASS 改崩为 FAIL”回归，并让诊断能力反向拉升首轮生成质量！
3. **造数前置执行“多教师交叉可解率 $T_m \ge 0.60$”过滤**：对新编高难 2D/CAD 题，若多个强教师均在某条验证断言上集体卡死，说明题干漏写了隐含契约，须在扩产前修正题面而非硬塞脏轨迹。

### 可直接移植的闭环 RL 算子实现（`check_2d_v2.mjs` 向量映射 + 两阶段 Critic 奖励与同境分组归一化）

```python
# 对齐 WebLoop Appendix A.2 (Eq. 8-9, 14-20)：基于 check_2d_v2.mjs / verify_xhs_output.cjs 二元结果的闭环奖励
import numpy as np

CHECK2D_KEYS = [
    "target_not_visible", "static_stage_or_hud_only_motion", "svg_uncoupled_css_or_smil_clock",
    "out_of_order_seek_mismatch", "loop_discontinuity", "seam_velocity_jump",
    "scrub_mismatch", "text_or_hud_overlap",
]

def extract_z_from_check2d(report_json: dict) -> np.ndarray:
    """将 check_2d_v2.mjs 的 issues 列表转为显隐需求真值向量 z in {0, 1}^8 (1=PASS, 0=FAIL)"""
    issues = set(report_json.get("issues", []))
    return np.array([0 if k in issues else 1 for k in CHECK2D_KEYS], dtype=np.int32)

def critic_discriminability(z_true: np.ndarray, z_pred: np.ndarray | None) -> float:
    """Eq. 14-16 完整均衡类别区分度 Youden's J in [-1, 1]；JSON 解析失败直接判最低分 -1.0"""
    if z_pred is None or len(z_pred) != len(z_true):
        return -1.0
    if len(z_true) == 0:
        return 0.0
    fail_mask, pass_mask = (z_true == 0), (z_true == 1)
    has_f, has_p = fail_mask.any(), pass_mask.any()
    a_fail = float((z_pred[fail_mask] == 0).mean()) if has_f else 0.0
    a_pass = float((z_pred[pass_mask] == 1).mean()) if has_p else 0.0
    if has_f and has_p:
        return a_fail + a_pass - 1.0
    return (2.0 * a_fail - 1.0) if has_f else (2.0 * a_pass - 1.0)

def compute_webloop_group_advantages(r_gen, z_base, r_base, z_preds, r_refs_matrix, step: int, lam: float = 0.2):
    """
    r_gen: [n_g=3], z_preds: list of n_c=3 arrays, r_refs_matrix: [n_c=3, n_r=3]
    返回严格按同境角色分组独立归一化后的优势 (G_gen, G_crit, G_ref_0..2)
    """
    def norm(arr):
        arr = np.asarray(arr, dtype=np.float64)
        return (arr - arr.mean()) / (arr.std() + 1e-6)

    adv_gen = norm(r_gen)
    d_scores = np.array([critic_discriminability(z_base, zp) for zp in z_preds])
    h_scores = r_refs_matrix.mean(axis=1) - r_base                     # Eq. 19 净跃迁增益（伪改原样拷贝 -> 0）
    r_crit = d_scores if step <= 15 else (h_scores + lam * d_scores)   # Eq. 7 前 15 步纯诊断暖机
    adv_crit = norm(r_crit)
    adv_refs = [norm(r_refs_matrix[j]) for j in range(len(z_preds))]   # 每份 Critique 下的 Refiner 独立成组
    return adv_gen, adv_crit, adv_refs
```

