# UI-TARS-2 Technical Report: Advancing GUI Agent with Multi-Turn Reinforcement Learning

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **arXiv**: [2509.02544v2](https://arxiv.org/abs/2509.02544)（提交日期：`2025-09-02`）
- **作者机构**: ByteDance Seed Team
- **本地原文**: [paper.html（上游原文）](https://arxiv.org/abs/2509.02544) | [paper.txt（上游原文）](https://arxiv.org/abs/2509.02544) | `sources.json`（本地校验清单未发布）
- **代际演进坐标（`UI-TARS-2` $\to$ `ByteDance Seed 2.0 / 2.1`）**:
  - 基于 `Seed-thinking-1.6`（**532M ViT 视觉塔 + 230B 总参 / 23B 激活参 MoE**）。
  - **字节系多模态长程 Agentic RL 奠基工程报告**：本文系统解决了多轮视觉交互中**高清截图撑爆上下文**、**RFT+RL 数据飞轮冷启动**、**WebGL/HTML5 浏览器时间加速沙盒**以及**长程多轮 PPO vs GRPO 稳定性对决**等核心工程难题，并通过 `GUI-SDK` 首次将纯屏幕点击扩展至“GUI + Bash 终端 + 文件编辑 + MCP 工具”统一动作空间——直接奠定了 **2026 年 `ByteDance Seed 2.0`（`2026-02`）与 `Seed 2.1`（`2026-06`）** 原生多模态通用生产力 Agent 的后训练架构底座！

---

## 1. 最近 $N$ 张高清截图滑窗 + 全程保留 `<think>` 分层记忆（§2.1, §2.5.2）

> **核心矛盾**：在长达数十至上百步的视觉交互（操作复杂软件、调试网页/游戏、多轮视觉排障）中，每张高分辨率截图动辄消耗数千个视觉 Token；若保留全部历史截图，不出 15 轮就会打爆显存与延迟上限；但若粗暴截断整个历史窗口，Agent 会立刻遗忘早期探索过的死胡同与全局任务分解计划。

UI-TARS-2 采用严格解耦的**双层状态记忆表示 $\mathcal{M}_t = (\mathcal{W}_t, \mathcal{E}_t)$**：
1. **工作视觉滑窗 $\mathcal{W}_t$（Sliding-Window High-Fidelity Screenshots，最近 $N$ 帧）**：
   - 仅保留**最近 $N$ 步（例如在环境与生成式 ORM 评判器中取 $N=5$）**的原始高分辨率屏幕截图，确保模型能看清当前界面细小图标、像素级对齐变化以及最近几步动作前后的即时视觉差分（Visual Diff）。
2. **完整情景推理记忆 $\mathcal{E}_t$（Full-Horizon `<think>` & Action History）**：
   - 对更早的历史轮次 $1, \dots, t-N$，**自动剥离旧截图视觉 Token，但 100% 完整保留从第 1 轮至今每一轮的 `<think>` 内部思维链文本与历史动作摘要**！
   - 这一设计迫使模型在每一步的 `<think>` 中主动把关键视觉观测转译沉淀为紧凑的符号化状态记录，以线性极小文本开销支撑跨越百步的长程一致性规划。

---

## 2. 零浪费 `RFT + RL` 闭环数据飞轮与在线交互人工干预（§2.3–§2.4）

1. **原位有声思维采集（In-Situ Think-Aloud Annotation）**：
   - 冷启动阶段不让标注员事后看录像补写生硬的假 CoT，而是要求标注员在操作真实软件/网页的同时**实时口述思考过程（录音转写时间轴对齐动作时间戳）**；且同时采集“专家高效路径”与“新手试错后自我纠正路径”，赋予模型宝贵的错误恢复先验。
2. **在线 Rollout 实时人工接管（On-Policy Interactive Human Intervention）**：
   - 当当前策略在某类难样本上卡死陷入局部循环时，标注平台直接挂载在**模型自己的真实 On-Policy 采样状态断点**上由人类纠偏接管数步——采集到的修复样本 100% 贴合当前策略自身的状态分布，彻底消除传统离线专家示范的 Covariate Shift（分布偏移）！
3. **成功与失败全量分流复用飞轮（Zero-Waste Flywheel）**：
   每一轮大规模沙盒 RL Rollout 产出的海量轨迹经验证器 $V(s) \in \{0, 1\}$ 判定后绝不丢弃：
   - **$V(s) = 1$（高质通关轨迹）** $\to$ 经去重清洗流入下一代指令/拒绝采样微调池 **$D_{\text{SFT}}^{(t+1)}$（RFT）**，固化新探索出的高阶技巧；
   - **$V(s) = 0$（失败探索轨迹，含环境真实交互序列与报错状态）** $\to$ 流入持续预训练/状态建模池 **$D_{\text{CT}}^{(t+1)}$**，持续增强基座对长尾软件界面动态转移规律（World Modeling）的理解，再反哺下一轮 RL！

---

## 3. 硬件加速 HTML5/WebGL 浏览器沙盒（重写 `Window` 时间 API！）与流式池（§2.2, §2.5.1）

本文在构建大规模 Web 图形与交互游戏（15 款复杂 HTML5/WebGL 交互环境）RL 沙盒时，披露了两项极其实用的前端/WebGL 工程黑科技：
1. **重写浏览器 `Window` 计时与帧循环 API 实现确定性暂停与倍速快进**：
   - 真实 HTML5 Canvas / WebGL 动画依赖 `window.requestAnimationFrame`、`setTimeout`、`setInterval` 与 `Date.now() / performance.now()`；若按真实物理墙钟流逝，LLM 每思考 5 秒画面就已经跑飞或角色死亡，且等待加载动画极慢。
   - 团队在沙盒浏览器注入层**完整劫持重写了 `Window` 时间控制 API**：① 环境启动加载完自动冻结虚拟时钟（Startup Pause），保证每次观测帧严格停在确定性时刻；② 在不需要交互的过场动画期间开启**确定性虚拟时间倍速推进（Time Acceleration）**，大幅压缩单轮交互耗时；③ 直接挂载 JS 运行时探针读取引擎内部真实状态变量作为精准无噪奖励（优于易产生幻觉的纯截图 VLM 打分）。
2. **流式部分填充异步 Rollout 缓冲池（Streaming Partially-Filled Rollout Pool, §2.5.3）**：
   - 针对不同环境Episode长度相差十倍以上的长尾拖慢问题，异步收集器一旦凑满训练所需样本条数即流式切出训练 Batch，未跑完的长轨迹留在沙盒池内继续演进，最大化 GPU 集群有效吞吐。

---

## 4. 长程多轮 RL 算法对决：为什么四项改进后的 `PPO` 击败了 `GRPO`？（§2.5.4, §3.3, Fig. 12）

在单轮数学/代码生成中 `GRPO` 凭借免 Critic 显存优势广受欢迎，但在**高随机环境反馈、长达数十轮且步骤间强异构的多模态交互任务**中，团队通过严格对比实验（Fig. 12）发现标准 `GRPO` 在后期容易出现训练震荡与信用分配粗糙，而经过**四项关键稳定化改造的 Multi-Turn PPO** 在训练稳定性与最终上限上显著胜出：

1. **离线价值网络预热（Offline Value Pretraining，$\lambda = 1.0$ MC 回报收敛）**：
   - 若用随机初始化的 Value Head 直接共同起步训 PPO，初期价值估计与真实回报甚至呈**负相关**，错误优势信号在最初几十步就会把策略带崩；因此必须先冻结 Actor，用 $\lambda=1.0$ 蒙特卡洛真实回报把 Critic 单独训至收敛再开启联合更新！
2. **解耦广义优势估计（Decoupled-GAE，$\lambda_{\text{policy}} \ne \lambda_{\text{critic}}$）**：为策略梯度与价值回归分别设置独立的方差-偏差权衡系数。
3. **长度自适应 GAE（Length-Adaptive GAE）**：
   $$\lambda_{\text{policy}}(l) = 1 - \frac{1}{0.05 \cdot l}$$
   针对不同长度 $l$ 的轨迹动态调节时序差分衰减步长，确保超长多轮轨迹的远端终端奖励不会在指数衰减中消失殆尽。
4. **`Clip-Higher` 非对称裁剪上界**：放宽正优势稀有探索词元的裁剪上界，防止策略过早丧失探索多样性。

### 关键实验现象与多专家线性模式连接融合（§3.3–§3.5）
- **交互式 RL 的熵上升定律**：不同于纯文本数学 RL 熵单调下降，在 GUI/WebGL 交互 RL 中，**策略输出熵随训练推进稳步温和上升**——模型学会在面对陌生 UI/状态时主动保持多假设探索！同时随课程难度阶梯切换，`<think>` 平均长度呈现“遇新难关自动拉长 $\to$ 熟练掌握后自动缩短”的周期性呼吸波。
- **`GUI-SDK` 混合工具正向迁移**：引入 Bash 终端、文件读写与 MCP 工具联合 RL 后，即使在评测时禁用 SDK 退回纯 GUI 模式，成绩依然超越纯 GUI 训练模型（`OSWorld 47.5%`、`Online-Mind2Web 88.2%`、`AndroidWorld 73.3%`、15 款游戏人类归一化均分 `59.8%`）。
- **垂直领域 RL 专家线性参数插值融合（Linear Mode Connectivity, §3.1）**：源自同一冷启动底座的 GUI 专家与 Game/Web 专家满足线性模式连通性，直接做权重加权平均 $\theta^{(\text{merge})} = \sum_k \alpha_k \theta^{(k)}$ 即可在不损失单域峰值的前提下获得跨领域协同泛化！

---

## 5. 对本项目的工程映射（`Qwen3.8-27B` 三轨 Visual Coding & CAD Agent）

1. **多轮渲染视觉自修直接采用“最近 $N=3\sim 5$ 次渲染截图滑窗 + 全量保留历史 `<think>` 与代码 Diff”**：
   - 无论在未来接入多模态主干还是在当前 `Claude Code` 多轮视觉反馈闭环中，切勿把第 1 轮到第 10 轮的全部高分辩率多机位截图一直堆在上下文里触发过早 `auto-compact`；只保留最近 $N=3$ 次渲染帧对比图，将早期轮次的几何缺陷诊断沉淀在保留的 `<think>` 文本中，可节省 `70%+` 上下文预算！
2. **我们的 `window.renderAt(t)` 契约与 UI-TARS-2 重写 `Window` 时间 API 异曲同工，应进一步劫持全局随机种子与时钟**：
   - 在 `Track 1 (Three.js)` 与 `Track 2 (2D GSAP/Canvas)` 验证沙盒页面初始化脚本中，除了调用 `window.renderAt(t)`，还应统一劫持固定 `Math.random` 种子、`performance.now()` 与 `requestAnimationFrame` 虚拟时钟，彻底消灭粒子系统或帧率抖动带来的奖励评估随机噪声！
3. **Stage 1（`AggreVaTe` 在线纠偏）与 Stage 4（权重插值 Warm-Start + 多教师 OPD）双印证**：
   - UI-TARS-2 的“在 On-Policy 卡死断点介入纠偏”直接印证了我们 Stage 1 用强教师在 `Qwen3.8-27B` 自身出错状态上续写修复（`AggreVaTe`）的必要性；而三轨专家模型源于同一 Stage 1 Checkpoint，在进入 Stage 4 多教师 OPD 前，可先用 **线性权重平均 $\sum \alpha_k \theta^{(k)}$ 作为学生初始化起点**，再跑几百步 OPD 精细对齐，收敛速度将成倍提升！
