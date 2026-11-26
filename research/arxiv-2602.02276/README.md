# Kimi K2.5: Visual Agentic Intelligence

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **arXiv**: [2602.02276v2](https://arxiv.org/abs/2602.02276)（v1 提交：`2026-02-02`，v2 更新：`2026-08-07`）
- **作者机构**: Kimi Team (Moonshot AI)
- **本地原文**: [paper.html（上游原文）](https://arxiv.org/abs/2602.02276) | [paper.txt（上游原文）](https://arxiv.org/abs/2602.02276) | `sources.json`（本地校验清单未发布）
- **代际演进坐标（`Kimi K2.5` $\to$ `Kimi K3` $\to$ `Kimi K3.1 Pro`）**:
  - 基于 `Kimi K2`（**1.04T 总参 / 32B 激活参** MoE，15T 视觉-文本混合预训练 tokens，`256K` 上下文）。
  - **视觉 Agentic RL 开山之作**：本文首次打通了 **“写前端/3D 代码 $\to$ 沙盒渲染截图/提取 DOM $\to$ 模型亲眼看图定位视觉缺陷并自修（Visual Self-Debugging Loop）”** 的原生闭环，提出了防长度过拟合的 **`Toggle` 双相交替预算控制算法**、局部逐 token 正则（Eq. 1）以及可训练编排器 **`PARL` Agent Swarm**——这四大核心原语在半年后的 `Kimi K3`（`2607.24653`）中全面演进为 `MoonViT-V2`、Partial Rollout 局部正则、$\tau \cdot b_0(x)$ 三档预算退火课程与 `Table 4` 3D/WebGL 赛道的统治级表现！

---

## 1. 原生多模态融合与“零人工视觉 CoT SFT + 结果导向视觉 RL”范式（§2, §4.2）

1. **早期低比例持续多模态融合胜过晚期高比例注入（§2.2, Table 2）**：
   - 受控消融对比发现：与其在预训练末期突然注入 `50:50` 高比例图文数据（易冲击语言主干表征），**从早期就开始维持 `10% 视觉 : 90% 文本` 的低比例长周期原生混合预训练**，能以相同总视觉词元预算取得全面占优的跨模态对齐与空间推理表现。
2. **反直觉重大发现：人工构造的视觉思维链 SFT 有害，纯文本 SFT + 视觉 Outcome RL 最强！（§4.1–§4.2）**：
   - 团队尝试用人工/合成标注的“看图分步描述 CoT”做视觉 SFT 冷启动，结果发现**模型被死板的人类看图套路束缚，泛化能力反而下降**！
   - **Zero-Vision SFT 冷启动配方**：SFT 阶段几乎只用高质量纯文本长思维链与 **IPython 编程式图像裁剪/缩放/增强工具调用语法**激活通用推理与工具使用骨架；随后直接进入**结果验证导向的视觉强化学习（Outcome-based Visual RL）**，让模型自己在奖励驱动下演化出何处该放大看细节、何处该写脚本量坐标。
   - **跨模态正向反哺纯文本推理**：经历高强度视觉空间与看图编程 RL 后，模型在完全不含图片的纯文本硬核基准上同步上涨：**`MMLU-Pro +1.7`、`GPQA-Diamond +2.1`、`LongBench-v2 +2.2`**！
3. **视觉看图自修闭环起源（Visual-to-Code Self-Inspection Loop, §4.2 & Qualitative Studies）**：
   - 在前端网页、交互动画、Canvas 游戏与 **Three.js / WebGL 3D 场景构建**中，K2.5 不再盲写代码一次性交卷，而是在多轮沙盒中自主调用浏览器工具启动页面、捕获多状态截图与控制台日志、**用原生视觉编码器审视渲染出的几何朝向/材质光照/UI 错位并多轮迭代改码**，奠定了后续 `Kimi K3` §4.2.7 Web/3D RL 的交互范式基础。

---

## 2. `Toggle` 两相交替 Token 预算控制算法：精确公式与超参（§4.4.2）

### 2.1 核心痛点：为什么固定长度惩罚会毁掉难题上限？
在长思维链与多轮 Agent RL 中，若全程施加硬性长度上限或线性长度惩罚，会导致严重的 **长度过拟合（Length-Overfitting）**：模型为了稳拿短长度奖励，习惯性截断深层反思与边界验证，彻底丧失在真正极难问题上拉长思考链条做 Test-Time Scaling 的能力。

### 2.2 `Toggle` 精确数学公式（§4.4.2 & Eq. 2）
`Toggle` 将 RL 训练按每 **$m$ 个迭代步（Iterations）** 为半周期，在 **Phase 0（预算受限压缩相）** 与 **Phase 1（无预算自由扩展相）** 之间周期性交替切换，且**仅对模型已经基本掌握的题目施加预算约束**：

1. **冷启动题目级自适应预算锚定（Eq. 2，训练启动时一次性估算并全程固定）**：
   对每道训练题 $x$，用初始策略采样 $K$ 条轨迹，提取其中所有**答对轨迹**的长度集合并取第 **$\rho$ 分位数**作为该题专属预算：
   $$\mathrm{budget}(x) = \mathrm{Percentile}\!\Big(\big\{|y_j| \;\big|\; r(x, y_j) = 1, \; j = 1, \dots, K\big\}, \; \rho\Big)$$
2. **双相交替修正奖励函数 $\tilde{r}(x, y_i)$**：
   设当前 RL 迭代步为 $t$，交替半周期步数为 $m$，组内平均通过率门控阈值为 $\lambda \in (0,1)$：
   $$\tilde{r}(x, y_i) = \begin{cases} r(x, y_i) \cdot \mathbb{I}\!\left\{ \dfrac{1}{K}\displaystyle\sum_{j=1}^{K} r(x, y_j) < \lambda \;\;\text{or}\;\; |y_i| \le \mathrm{budget}(x) \right\}, & \text{if } \lfloor t / m \rfloor \bmod 2 = 0 \quad \text{（Phase 0：预算受限相）} \\[12pt] r(x, y_i), & \text{if } \lfloor t / m \rfloor \bmod 2 = 1 \quad \text{（Phase 1：自由扩展相）} \end{cases}$$

### 2.3 算法精妙机制与实测收益
- **双重安全保护网**：
  - **组通过率门控 $\frac{1}{K}\sum r < \lambda$**：即使处于 Phase 0 压缩相，只要某道难题当前的组内平均正确率低于 $\lambda$（说明模型尚未掌握该难题），指示函数第一项自动为真，**完全豁免长度裁剪**，100% 保护难题长程探索！只有当正确率 $\ge \lambda$（已掌握题）且回复超长 $|y_i| > \mathrm{budget}(x)$ 时，才将奖励置零迫使模型精炼冗余废话。
  - **Phase 1 周期性松绑恢复**：每过 $m$ 步切回无长度约束的 Phase 1，让模型将在压缩相学到的高信息密度推理迁移回极难长尾题的深度扩展上。
- **实证效果**：在几乎**零准确率损失**的前提下，将输出 Token 消耗大幅削减 **`25%–30%`**，且仅在数学/代码 RL 上开启 `Toggle` 学到的简洁推理习惯，能**零样本泛化（Zero-shot Transfer）**至未做长度约束的 `GPQA` 与 `MMLU-Pro`！

---

## 3. 局部逐 Token 正则（Eq. 1）、`PARL` 并行智能体群与代际演进表（§3, §4.4.1, Appendix D–E）

### 3.1 面向异步/陈旧轨迹的逐 Token 对数比裁剪 + 二次惩罚（§4.4.1, Eq. 1）
为支撑 **100,000 协程级统一 Agentic RL 环境 + TITO `LLM Gateway`**（Appendix D）下的高并发部分异步更新，K2.5 在逐 token 策略梯度中同时施加对数概率比裁剪与系数为 $\tau$ 的平方惩罚项：
$$\mathcal{L}_{\text{RL}}(\theta) = \mathbb{E}\!\left[ \frac{1}{T}\sum_{t=1}^{T} \left( \mathrm{clip}(\dots) \, \hat{A}_t - \tau \left(\log \frac{\pi_\theta(y_t \mid x, y_{<t})}{\pi_{\text{old}}(y_t \mid x, y_{<t})}\right)^2 \right) \right]$$
抑制单个罕见 token 的极端概率漂移毁掉整条百轮长轨迹——这一稳定器在 `Kimi K3` §4.1.2 中被原封不动继承用于消化 Partial Rollout 跨轮暂停续写的陈旧性。

### 3.2 `PARL`（Parallel-Agent Reinforcement Learning / Agent Swarm, §3 & Appendix E.8）
- **架构解耦防信度分配爆炸**：仅训练顶层主编排器（Orchestrator，可自主调用 `create_subagent` 与 `assign_task` 动态定义子角色与拆分任务），而**并行执行的子智能体（Subagents）保持参数冻结**，规避多智能体联合更新的非平稳方差灾难。
- **关键路径步数约束（`CriticalSteps`）与退火防坍缩奖励**：
  - 按并行关键路径而非串行总步数计费：$\mathrm{CriticalSteps} = \sum_t \big(S_{\text{main}}^{(t)} + \max_i S_{\text{sub},i}^{(t)}\big)$，天然鼓励将独立子任务扇出并行处理并主动隔离局部子上下文（实测优于被动满窗后 `Discard-all`）。
  - 复合奖励 $r_{\text{PARL}} = \lambda_1 r_{\text{parallel}} + \lambda_2 r_{\text{finish}} + r_{\text{perf}}$：前期用 $\lambda_1, \lambda_2 > 0$ 防止退化回单线程串行（Serial Collapse），同时惩罚毫无意义的虚假拆分（Spurious Parallelism），中后期将 $\lambda_1, \lambda_2 \to 0$ 退火至纯粹优化终端任务质量 $r_{\text{perf}}$——令 `BrowseComp` 从 **`60.6%` 飙升至 `78.4%`**，`WideSearch` 端到端耗时缩短 **`3×–4.5×`**。

### 3.3 `Kimi K2.5` $\to$ `Kimi K3` 关键技术演进对照表

| 技术模块 | `Kimi K2.5`（`2602.02276`, 2026-02） | `Kimi K3`（`2607.24653`, 2026-07）演进升级 |
| :--- | :--- | :--- |
| **主干规模与注意力** | `1.04T / 32B` MLA MoE，`256K` 上下文 | `2.78T / 104B` `3:1 KDA + NoPE Gated MLA` + `Block AttnRes`，**`1M` 上下文** |
| **原生视觉编码器** | `MoonViT-3D`（基于 SigLIP 初始化，早期融合易有梯度尖峰） | **`MoonViT-V2`（401M 从零 NTP 联合预训练，彻底消灭 ViT 梯度尖峰，支持 $3584^2$）** |
| **长尾 Rollout 与正则** | 10 万协程 + TITO Gateway + 逐 token 对数比平方惩罚（Eq. 1） | **Partial Rollout（$\lambda$ 比例完成即暂停跨轮续跑）** + 同一局部逐 token 正则 + **5,121 万 Firecracker microVM (`AgentENV`)** |
| **Token 预算控制** | **`Toggle` 双相交替**（每 $m$ 步切换，答对长度 $\rho$ 分位 $\mathrm{budget}(x)$，通过率 $\ge \lambda$ 门控） | **三档预算专家 `{low, high, max}` + $\tau \cdot b_0(x)$ 分阶段退火课程（超限覆写 `-1`）+ GRM $\sigma\cdot\ell_0$ 冗长判负** |
| **视觉编程与 3D 闭环** | 确立 Zero-Vision SFT + 浏览器截图/DOM 视觉自修 RL 雏形 | 规模化 **Web/3D/WebGL/Shader 专项 RL**（报错/造假直接归零 + 交互 Judge，**3D 赛道盲评净胜 Opus 4.8 `+59.1%`**） |

---

## 4. 对本项目的工程映射（`Qwen3.8-27B` 三轨 Visual Coding & CAD Agent）

1. **在 Stage 2 三轨专项 RL 中直接植入 `Toggle` 双相交替预算门控（省 `25%–30%` Token 且不伤复杂场景上限！）**：
   - 在 `3D Three.js` 与 `CAD CadQuery` 中，简单几何件只需 2 轮即可写完，而复杂多连杆机械动画或高精度装配体确实需要 8–12 轮自检调优；若直接给全局步数/token 惩罚，模型会把复杂机械臂砍成三个方块。
   - **落地方案**：直接采用 K2.5 `Toggle` 公式——用 Stage 1 Checkpoint 预跑各 Prompt 统计正确解第 $\rho=50\text{th}/60\text{th}$ 分位 token 数作为 $\mathrm{budget}(x)$，每 $m=10$ 个 RL Step 交替开关预算限制，且**仅当某题组内 `Pass@G >= 0.5`（已掌握题）时才对超长轨迹置零奖励**，既榨干冗余复读、加速 `Claude Code` 384K 窗口周转，又 100% 保留复杂 3D 场景的深度精雕能力！
2. **SFT 切忌堆砌死板的人工“看图套话模板”，聚焦工具原语激活 + 把视觉审美/空间纠错留给 Outcome RL**：
   - 借鉴 K2.5 Zero-Vision SFT 经验，在引入多视角截图自修时，不要强行用套路化的合成图片描述污染 SFT，而是让策略在真实渲染反馈与几何探针奖励下自发演化出精准的空间纠错思维链。
