# 3DCodeVerse：训练方法与 Agent Harness 调研记录

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> 仅本地研究记录；没有修改 `${WORKSPACE}/3d-animation-agent` 的代码、提示词、工具或 cases，也没有启动新的作者模型运行。
>
> 项目观察均基于已归档实验批次。调研期间发现现有代码正由其他 AI 并发演进；本笔记不声称描述最新实现，也不回退这些改动。
>
> 论文结果均未在本机复现。下文区分论文、当前官方仓库、数据卡和本项目推论。

## 1. 来源与版本

- 论文：**3DCodeVerse: Exploring 3D Worlds as Code**，Yipeng Gao 等。
- arXiv：`2610.22341v1`，提交于 2026-10-15；34 页。
- DOI：<https://doi.org/10.48550/arXiv.2610.22341>
- 官方项目：<https://3dcodeverse.com/>
- 官方代码：<https://github.com/gaoypeng/3dcodeverse>
- 本次读取代码 main 固定为 `69c1cb98035cf947fabf5e14c69cf6fa5f367242`。
- 数据集：<https://huggingface.co/datasets/3dcodeverse/3dcodeverse-2m>；本次 API 元数据 revision 为 `1d3935d94760922ef7a55f4a1a3e19a3b90ec702`，lastModified 2026-11-16。
- 本地正文：`paper.txt`；原始 PDF：`3dcodeverse-paper.pdf`；官方文档原文：`upstream/`。

## 2. 一句话结论

论文的核心不是单纯训练一个更会写 3D 代码的模型，而是形成两层系统：

1. **推理期 Harness**：规划 → 编码 DAG → 执行 → 空间测量 → 确定性 gate → 多视图/多帧渲染 → 独立 VLM judge → 定向返修 → 选版交付。
2. **训练期数据引擎**：用执行验证过的程序做 SFT，用同题多个 completion 的执行、几何和终止差异构造 DPO 偏好对。

它**没有报告 PPO/在线 RL**，也不是把完整多轮工具调用轨迹原样训练成 Agent 策略。主训练格式仍是 system + user request + assistant 完整 fenced program。

## 3. 任务定义

论文 §3 将 3D coding 定义为：在声明环境 `e` 中编写 standalone program `f`，执行后得到 artifact 与日志。仅有可执行性不够，还要用参考几何、空间测量或渲染评价内容质量。

覆盖四类 track：

- 静态对象：Blender Python、CadQuery、Three.js；
- 关节对象：Blender 建模 link + URDF；
- 场景：Three.js / Blender；
- 程序图形：GLSL / moderngl。

这与 3D Web Animation 的关系很直接：Three.js scene 与 graphics 都强调**真实执行、确定性渲染、运动/曝光/帧统计和图像评价**，不是静态代码评分。

## 4. Harness 架构

### 4.1 三种角色与 DAG（论文 §4、§A.1–A.2）

| 角色 | 职责 |
|---|---|
| Planner | 将请求变成 schema-validated 结构计划：部件、尺寸、材料、空间/运动关系、验收清单 |
| Coding agents | 按 DAG 和文件所有权并行/串行编写源码，再由 assembly 任务集成 |
| VLM judge | 在独立上下文中读取验收清单、测量、gate、标记后的渲染图，输出缺陷与评分依据 |

计划中的每个验收项绑定证据方式：measurement / visual inspection / probe / joint sweep，以及 must / should 优先级。

复杂对象达到 8 个以上顶层部件时，按附着子树拆成不超过 3 个部件的 scoped session，再组装。返修任务按文件不相交分组，限制上下文并减少跨部件回归。

**这不是我们当前简单动画题需要立即照搬的多 Agent 复杂度；更重要的是结构化验收、证据分离和有界上下文。**

### 4.2 每轮固定验证链（§A.5）

```text
code synthesis
  → build（失败最多 3 次定向修复）
  → geometric measurement
  → deterministic gates
  → multi-view / multi-frame rendering
  → VLM judgment
  → Git archival
```

返修任务优先级：

1. gate error 与数值修复提示；
2. 未验证的 mandatory acceptance；
3. judge 的视觉改进建议。

每轮最多 6 个任务；只截断视觉建议，不丢 gate error 和 mandatory 项。标准 profile 最多 4 个 refinement rounds、60 分钟；全部验证任务解决、无代码变化或预算耗尽时提前停止。

**输出选择不是简单取最新版**：按 composite score 排序，平局看更少 gate error、再较早 round；接近时可用双向 pairwise judge。最后从所选 round 的 Git commit 打包，不用未绑定的新源码覆盖它。

### 4.3 三类反馈

1. **Execution**：构建/运行日志；执行失败时只反馈这一类，不伪造图像评价。
2. **Measured**：尺寸、接触、碰撞、关节、放置等，给出部件级数值修复提示。
3. **Visual**：VLM 看多视图/多帧 montage，对照 brief 和 acceptance checklist。

数值提示会映射回 authoring frame；例如同一垂直修复在 Blender Z-up 与 Three.js Y-up 中给出不同坐标，避免模型自行换算出错。

### 4.4 Judge 与 gate 的关系（§A.4）

- Judge 不看源码，也不看 generator reasoning。
- 接收 brief、plan digest、验收清单、测量、gate、telemetry、最多 5 个标记 montage，以及按需 detail/cross-section。
- 严格 JSON；先写 evidence / strengths / issues / defect votes / acceptance，再给 criterion scores 和最多 6 条改进。
- 分数由代码计算，不让模型直接决定最终 arithmetic。
- Gate 通过可以 veto 与之矛盾的视觉结构缺陷；gate error 和未满足 must 项会 cap 分数。
- Pairwise 评价在两种展示顺序一致时才判胜，降低位置偏差。
- 论文报告 Gemini 3.1 Pro 在固定 artifact 重评中的 score std 为 0.030（shuffled montage），但这只是论文的 judge 校准结果。

### 4.5 Verdict 与 transport 分离（§A.3、Table 17）

这是与我们工具可靠性最相关的机制：

- 检测到碰撞、构建失败等是**正常、有效的 FAIL observation**，不是传输异常。
- 只有工具内部崩溃、缺产物、坏参数等才设置 protocol/transport error。
- 文本、诊断图片和分辨率有界；论文 Figure 9 给出的边界为文本 ≤6000 chars、图片 ≤1024px / ≤400kB，工具 timeout 600s。

论文 Table 17 报告：

| 机制 | 指标 | Without → With |
|---|---|---|
| verdict/transport 分离 | redundant retries，3,677 calls | 26.6% → 1.3% |
| 加 bounded payloads | uncached tokens/request，5,194 requests | 38,521 → 13,480（-65%） |
| 同上 | median cost/round，142 rounds | $1.572 → $0.950（-40%） |
| scoped session horizon | 减半 turn depth | cumulative tokens -68%，net API cost -55% |

论文还报告 per-turn input 随深度线性增长，cumulative session tokens 约按 `n^1.60` 增长。这直接支持我们当前需要处理重复上下文，而不是只提高 step 上限。

### 4.6 Scene / graphics 中可迁移的检查

- Scene：grounding、placement/collision、console cleanliness、曝光、取景、动画运动、asset 利用率、draw-call 预算。
- Graphics：固定时刻帧、亮度分布、色彩、边缘密度、帧间运动、像素有效性；NaN/全黑/过曝为 hard error，static/flicker 为 cap warning。
- Scene staging 在消耗 55% 墙钟预算后切换到快速单稿路径，避免复杂前置阶段吃掉全部时间。这个具体比例不能直接搬到我们的动画，但**预算应按阶段分配**的思想成立。

### 4.7 Skills 路由

论文 §A.9：17 个模块化 bundle，每个 ≤350 行、约 2500 tokens；28 条 routing rule，按 track/language/role/feature 以及上一轮 gate finding，每 session 最多选 5 个。

重点不是增加 Skill 数量，而是**按需加载与缺陷驱动路由**，避免所有参考始终占用上下文。

## 5. 当前官方仓库与论文系统的版本边界

当前 `harness/` 是 Claude Code、Codex、Antigravity 插件：host agent 驱动，插件提供 skills、judge subagent 和 `3dcode` instruments。

当前架构文档的关键实现：

- `src/` 是事实来源，每轮 Git commit/tag；
- `3dcode init/validate-plan/build/check/judge/score`；
- `FAIL` 仍 exit 0，工具无法运行才 non-zero；
- judge subagent 只读 `judge/rNN/brief.md` 与图片；
- score 由 rubric、penalty、floor、gate cap 计算。

但必须注意：

- 当前插件 README 默认一轮，judge/refine 按需触发；不是论文标准 profile 的自动 4 rounds。
- 当前插件架构文档明确说自身不保存 run record/cost/telemetry；`flywheel/` 读取旧 v0.0.x runs。
- 因而**论文完整 DAG 数据引擎、当前插件默认交互和历史 flywheel 记录格式不能视为同一版本的同一行为**。
- 官方仓库支持 Claude Code，不表示我们的实验使用了 Claude Code；我们的 full/generic 是自研 Python Agent 通过 18790 调用模型。

## 6. 数据集：三个计数口径不能混用

### 6.1 Catalogue

- **269,597 个 unique executable programs**，9 个主要 collection。
- 主要来自 DeepCAD→CadQuery 128,201、Shadertoy GLSL 119,961，另有 Articraft、Bioinspired3D、Thingiverse、3DCodeBench、agent-written Three.js/Blender 等。
- 保存源码、运行环境、三种 caption、renders、来源/license/verification metadata；不同来源验证覆盖不同，不是所有程序都有相同 gate/judge 深度。

### 6.2 Benchmark training pairs

- **768,596 pairs / 891M tokens**（论文 §B.1 与仓库实验日志）。
- 严格排除全部 212 个 3DCodeBench procedural factories、3,904 个 re-seeded instances 和各语言 evaluation split。
- 论文还特别清理了 DeepCAD 上游 train/test 之间 3,230 组重复几何，降低跨 split 泄漏。

### 6.3 Unified text export

- **2,028,286 rows / 342 shards**，不是 2.03M 个不同程序。
- 包含 native-format 891,788、standardized text export 848,819、pass-flattened shader 287,679。
- 同一程序可对应 instruction、visual description、construction recipe，也可把 multi-pass shader 拆成 pass-level rows。
- 数据卡另有 `finetune/` 约 784k SFT pairs 的快照口径；不要与上述数字强行对齐。

## 7. SFT 方法

### 7.1 样本格式（§C.1）

ShareGPT 形式：

```text
system：目标语言/方言与输出契约
user：自然语言需求
assistant：完整、可执行、fenced program
```

超过 context window 的样本直接排除，不截断，以保留语法闭合。

这意味着主 SFT 并不是训练完整工具调用 trace，而是训练**完整程序 completion**。Harness 产出的执行验证、质量层级和 bootstrap program 用于改善这些样本。

### 7.2 主训练配置（§C.1）

- LLaMA-Factory；4×H100 80GB；bf16；gradient checkpointing；sequence packing。
- SFT LoRA：rank 64、alpha 128、dropout 0.05、all linear projections。
- LoRA LR `1e-4`；论文另列 full-parameter ZeRO-3 LR `1e-5`。
- cosine schedule，5% warm-up；per-device batch 1；gradient accumulation 8，27B 为 4。
- context：9B 8192、27B 4096。
- 数据尺度实验 §C.2 使用另一组 rank16/alpha32、1 epoch、LR5e-5、3% warm-up；不要与主 SFT recipe 混用。
- 论文报告 27B LoRA 用普通 DDP 约 6.2K tokens/s，避免 ZeRO-3 参数 all-gather；9B 270K/293M-token mixture 约 4h46m。

## 8. DPO：三类可验证偏好信号

DPO 从 merged SFT checkpoint 初始化；rank16、alpha32、2 epochs、sigmoid loss、beta0.1、LR5e-6（§C.1）。

**通用构造原则（§C.4）：同一训练 prompt 采样多个 completions，再按可验证结果配对。不是让 VLM 随意给所有 pair 打分。**

| 信号 | chosen / rejected | 论文证据与边界 |
|---|---|---|
| Execution | 同题能运行 completion / 失败 completion | 9B 5.2K base 两轮 2,590 + 587 pairs，greedy 3DCodeBench 从 75–82.1% 到 93.9% 再到 96.2%；pass@4 91.0%→99.1% |
| Geometry | 同题最高 / 最低 F@0.05，且 ΔF≥0.15 | 9B 270K base 2,357 pairs；conditional F 0.387→0.403，但 execution 90.1%→88.2%，保真提升不等于执行率同时提升 |
| Termination | 同题 non-terminating greedy rollout / 最短有效 completion | 两轮 1,779 + 478 pairs；OpenSCAD 平均输出 30,163→2,884 tokens，greedy exec 8%→86%；3DCodeBench 79.2%→84.9% |

27B 104K flagship 的 execution DPO 只有 756 pairs；Table 2 的 27B 主结果为 SFT+DPO：3DCodeBench 51.9→92.9、Three.js 72.5→92.5。论文同时指出强 base 上执行 DPO 的各套件收益取决于 pair 覆盖，并非所有指标都升。

**对我们当前 finalization 的启示仅作为研究线索**：termination DPO 针对的是代码生成不终止，不会自动学会在 Agent 中调用 deliver，也不能替代 Harness 的预算/状态机修复。

## 9. 主要结果（论文报告，未本地复现）

### 9.1 微调执行率（Table 2，805 个固定任务）

| 模型 | 训练 | 3DCodeBench | Blender | CadQuery | OpenSCAD | GLSL | Three.js |
|---|---|---:|---:|---:|---:|---:|---:|
| Qwen3.5-9B | SFT | 0.0→84.9 | 1.9→90.3 | 10.5→98.5 | 50→86 | 33→56 | 72.5→74.5 |
| Qwen3.8-27B | SFT+DPO | 51.9→92.9 | 74.8→93.2 | 65.5→98.5 | 80→90 | 57→71.5 | 72.5→92.5 |

评估为同一 request、无 examples、T=0.7、一个 seed、pinned runtime；失败程序 fidelity 记 0。主评估是 standalone model 输出程序后统一执行，不是微调模型在完整多 Agent Harness 中的端到端分数。

### 9.2 Harness（Figure 4、Tables 14–16）

- 3D objects：同 backbone 下 human preference 69–89%，judge score 提升 11–25 分。
- Claude Opus 5.5：Claude Code native 77.2 → 3DCodeVerse 88.5；human preference 21%→79%。
- 与 Claude Design 对比，双方均 Opus 5.5：3DCodeVerse human win 90%，judge 87.7 vs 37.4。
- Table 15 hard/mixed prompts：相对 one-shot paired score gain +15.5 至 +52.3；这是论文的特定设置，不是我们对 one-shot 的验证。
- Table 16 同时显示成本：GPT-6 Sol Harness $6.72/run vs one-shot $0.29/run。**质量提升伴随显著推理成本，不能只记录胜率。**

论文的 alternating development loop 先固定 generator、重评同一批 artifact 来调 judge，再固定 judge 调 Harness；这比同时改变两者更容易归因。

## 10. 官方仓库实验日志中的额外教训

以下来自 `upstream/llm_finetune_exps.md`，属于官方实验记录，不与论文主表的模型快照/解码口径混算：

- 更多**不同代码**比重复 caption/upsampling 更有价值；caption augmentation 在 equal token budget 下出现明显退化。
- 少量 Three.js SFT 在 base 已会 Three.js 时反而降低执行率；论文 §C.4 将长 multi-part 小样本训练与 context/non-termination 问题联系起来。
- 更多 epoch、full-parameter FT 不一定优于 LoRA；目标语言比例和 15.7K execution-verified bootstrap 很重要。
- 官方 Qwen 实验中，thinking 在 12k output 下大量截断；32k 可恢复部分执行率但成本显著增加。这与我们观察到的 length/token 压力相呼应，但模型和任务不同，不能直接套数值。
- 代码 extractor 会处理无 fence、多 block、未闭合 fence，并按语法/方言 marker 排名；这说明评测协议本身的提取规则也会显著影响结果。

## 11. 对我们当前 3D Web Animation 的启示（仅记录，不实施）

| 论文机制 | 我们当前观察 | 可保留的研究结论 |
|---|---|---|
| 固定验证链、每轮归档、预算内选版交付 | full/generic 都 0/3 正式交付，候选/ dist 存在却未收口 | **finalization 应是显式状态与受保护预算，不靠模型最后自觉** |
| Git commit 绑定当前源码与证据 | full 候选链完整；generic 出现 src/dist/shots 脱节 | full 的版本绑定值得保留，不能为简化而删除 |
| Verdict/transport 分离 | 自写检查失败与通道失败需要不同处理 | 正常 FAIL 应进入修复，不应触发盲目传输重试；我们现有 dict 工具已有部分此性质 |
| Bounded payload / scoped context | full/generic 均出现高 token 或长墙钟 | 优先压缩旧源码/reasoning/工具输出，按当前缺陷加载参考，不只扩大预算 |
| 独立 judge，observations before scores | 当前 full 是同模型 self-review，generic 自行判断 | 将来若加独立 judge，应在 finalization 修复后验证，不先扩多 Agent |
| Acceptance checklist 绑定证据类型 | 我们已有通用技术检查，但每题验收主要依赖提示词 | 可研究每题生成简短 must/should + evidence 映射，而非新增无目标 detector |
| 最优 round 选版 | 当前 full 只交付 current candidate | 可研究保留最佳合格版本，但不能让自动审美分掩盖技术回退 |
| Termination DPO | Fable/DeepSeek 有 length/不终止现象 | 仅是未来训练线索；当前应先修 Harness，且 Agent deliver 终止需要专门数据，不等于代码终止 |
| 多 Agent DAG | 当前动画单体场景较简单 | 暂不引入多 Agent、通用 IR 或大规模对象流水线 |

## 12. 数据与合规边界

- 代码和数据集许可不同；数据卡明确 **CC BY-NC-SA 4.0、非商业研究**。
- 每个来源保留自己的 license；冲突时采用更严格条款。Shadertoy、Thingiverse、Animation2Code 等还有 item-level 条款。
- 数据卡明确保留 `compiles=False` 等记录，使用前必须筛选；不能假设所有 row 都已执行通过。
- 若未来使用，需按 source/subset/license/verification/split 建立谱系，并继续保持 benchmark factories、seeded instances 和 evaluation suites 完全隔离。
- 本调研不恢复训练/蒸馏工作，也不改变 BenchCAD Core/Public 禁止训练、微调、蒸馏和 RL 的既有边界；不能用 3DCodeVerse 绕过其他数据集条款。
- 本次只保存公开论文、文档和笔记，未下载 1.25TB 数据集或模型权重。

## 13. 可复现性限制

1. 论文 v1 与当前仓库插件默认行为不同，不能直接复现论文分数。
2. 当前 finetune README 说明部分原始 workstation registry/data 和 DPO 历史生成/编排脚本不再随 checkout 分发；需要匹配数据与 registry。
3. 论文、仓库日志和数据卡存在快照/解码/提取口径差异，本笔记不将数字强行合并。
4. 所有论文成绩均是作者报告；本机没有运行其 Harness、训练或评测。
5. 对我们的映射是研究推论，不能替代新的 full/generic 同期多 trial。
