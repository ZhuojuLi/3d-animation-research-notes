# 2026 下半年（2026.06–2026.11）国内外前沿实验室 Agentic RL、视觉代码与验证基建官方技术博客深度调研

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> **专题定位**：系统梳理 `2026.06–2026.11` 期间国内外八大一线大模型实验室（**Alibaba Qwen、Moonshot Kimi、Z.ai 智谱 GLM、DeepSeek、ByteDance Seed、MiniMax、Anthropic、OpenAI**）及核心开源 RL 框架（**`slime`、`verl`、`OpenRLHF`**）发布的最新官方技术博客、版本发布说明与工程复盘，提炼从“单轮推理 RL”迈向“百万上下文长程 Agentic RL、3D/Web 交互式视觉验证与多教师在线蒸馏”的工业界最新共识，并给出面向 **`Qwen3.8-27B` 三轨可执行视觉与几何编程（3D Three.js / 2D Web Canvas+SVG+GSAP / CAD CadQuery）** 项目的端到端工程落地映射。

---

## 一、2026 下半年核心技术发布与工程博客全景时间轴（经核验日期与公开原始链接）

> 注：表中同时保留少量支撑 2026 H2 架构演进的 2026 H1 关键基建首发节点（已明确标注日期），全部外部链接均为真实公开官方入口。

| 发布日期 | 机构 / 生态 | 模型 / 官方技术博客 / 工程发布 | 公开原始链接 (Canonical URL) | 核心技术突破一句话提要 |
| :---: | :--- | :--- | :--- | :--- |
| `2026-06-01` | **MiniMax** | **MiniMax-M3** 发布（基于 `Forge` 原生异步 Agent RL 引擎） | https://www.minimax.io/news <br> https://huggingface.co/MiniMaxAI/MiniMax-M3 | 原生面向多轮工具与复杂软件工程环境缩放的第三代开源权重基座 |
| `2026-06-09` | **MiniMax** | **MaxProof** 技术博客：*Scaling Mathematical Proof with Generative-Verifier RL & Evolutionary Search* | https://www.minimax.io/news | 生成式验证器 RL（生成+找错+递归修复三角色）耦合种群进化测试时搜索，突破 IMO/USAMO 金牌线 |
| `2026-06-16` | **Z.ai (智谱)** | **GLM-5.2** 官方技术博客（`IndexShare` 1M 上下文加速） | https://z.ai/blog/glm-5.2 | 每 4 层共享稀疏注意力 Indexer（`IndexShare`），1M 上下文单 token 计算量削减 **`2.9×`**，打通长程 RL 采样经济性 |
| `2026-06-19` / `06-23` | **ByteDance Seed** | **Seed 2.1 / Doubao Seed 2.1** 正式发布（及 `06-30` Seed 2.0 技术报告卡） | https://seed.bytedance.com/ | 承接 `UI-TARS-2` 分层视觉记忆与 `GUI-SDK`，统一屏幕操作、终端编码与长程企业工作流生产力 |
| `2026-07-16` / `07-27` | **Moonshot Kimi** | **Kimi K3** 发布与开源（`2.8T/104B` MoE，`AgentENV` 5,121 万微虚拟机） | https://huggingface.co/moonshotai <br> https://arxiv.org/abs/2607.24653 <br> https://github.com/kvcache-ai/AgentENV | `3:1 KDA+MLA`、9 专家 RL + 截断 `MOPD`、3D/WebGL/Shader 盲评对 `Claude Opus 4.8` 净胜 **`+59.1%`** |
| `2026-08-13` | **DeepSeek** | **DeepSeek-V4-Pro** 全量正式上线（App / Web / API GA） | https://api-docs.deepseek.com/ <br> https://arxiv.org/abs/2606.19348 | `1.6T/49B` 1M 上下文旗舰全量投产：逐比特批次不变算子、缓存末层 Hidden State 全词表 `OPD`、`DSec` 四基板沙盒 |
| `2026-08-14` / `08-26` | **Z.ai (智谱)** | **GLM-5.3** & **GLM-5.3-Flash** 官方技术博客（纯后训练缩放奇迹） | https://z.ai/blog/glm-5.3 <br> https://z.ai/blog/glm-5.3-flash | **完全不改预训练底座权重**，仅靠 `slime` 异步长程环境与 `SAO` 状态化 Agent RL 实现 `Terminal-Bench 3.0` **`6×` 跃升** |
| `2026-08-26` / `08-31` | **Alibaba Qwen** | **Qwen3.8-27B** & **Qwen3.8-Flash-Next** 开源及架构论文 | https://huggingface.co/Qwen/Qwen3.8-Flash-Next <br> https://arxiv.org/abs/2608.30320 | 揭晓面向 Qwen4 的 `GDN + QSA + Gated Residual` 与拆分 `Muon`（`4× LR` 零尖峰），同步开源稠密主力 **`Qwen3.8-27B`** |
| `2026-09-03` / `09-29` | **OpenAI** | **GPT-6 Astra**（`09-03/04`）、**GPT-6 Sol**（`09-22`）、**GPT-6.1 Sol**（`09-29`）发布 | https://openai.com/index/ | `Astra` 突破 1M 上下文深度自主规划与计算机使用；`Sol / 6.1 Sol` 将接近旗舰的编码 Agent 能力压降至极低推理成本 |
| `2026-09-10` / `10-17` | **DeepSeek** | **DeepSeek-V4.1-Flash**（`09-10`）与 **DeepSeek-V4.1-Flash-1017**（`10-17` 开源） | https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017 <br> https://api-docs.deepseek.com/ | `552B` MoE 首创 **40 层 `CED` 因果编解码器（Prefill 仅激活 `8B` / Decode `16B`）+ `CSA2` + `890 B/token` FP4 KV** |
| `2026-09-17` | **Moonshot Kimi** | **Kimi Code Desktop** 正式发布 | https://www.kimi.com | 原生围绕 K3 多脚手架泛化能力打造的桌面端与 CLI 一体化长程研发环境 |
| `2026-09-18` / `09-22` | **Alibaba Qwen** | **Qwen3.8-Omni-Flash**（`09-18`）与云栖大会 **Qwen4-Max**（`09-22`） | https://qwen.ai/blog | 全模态实时 Agentic 交付；云栖大会正式官宣 `Qwen4` 在训并首发 **`2.4T` 参数、1M 上下文原生多模态旗舰 `Qwen4-Max`（API）** |
| `2026-09-22` | **Anthropic** | **Introducing Claude Opus 5.5** | https://www.anthropic.com/news | 数十万行级跨库代码迁移标杆，典型长程 Agentic 工作流综合运行成本直降 **`40%`** |
| `2026-10-08` | **THUDM / Z.ai** | **`THUDM/slime` v0.3.0** 里程碑版本与 `verl` / `OpenRLHF` 异步多轮演进 | https://github.com/THUDM/slime <br> https://github.com/volcengine/verl <br> https://github.com/OpenRLHF/OpenRLHF | 全面转向 Server-Client 异步流式多轮沙盒采样、原生 Token ID 连续透传与 `>2.3×` 端到端 RL 训练吞吐增益 |
| `2026-10-23` / `11-04` | **Moonshot Kimi** | **Kimi K3.1 Pro Tech Blog: Advancing Open Intelligence**（`11-04` 开源权重） | https://www.kimi.ai/blog/kimi-k3-1-pro <br> https://huggingface.co/moonshotai | 数百垂直域超大规模联合 RL 迭代：重点强化 **3D 资产与引擎集成（Three.js / Unity / UE / Godot）** 及 `Terminal-Bench 4.0` |
| `2026-11-09` / `11-25` | **Anthropic** | **Claude Fable 5.2 & Mythos 5.2**（`11-09`）及 **Messages API Rust 迁移复盘**（`11-25`） | https://www.anthropic.com/news <br> https://www.anthropic.com/engineering | 1M 上下文自适应 `effort` 深度思考 + 严格思考块前缀校验；延续 GAN 式 `Planner-Generator-Playwright Evaluator` 验证哲学 |
| `2026-11-17` | **OpenAI** | **GPT-6.2 Astra** 升级与高危自主 RL 环境隔离管控体系（Control Rooms） | https://openai.com/index/ | 针对前沿编码模型在沙盒缓存中自主串联漏洞的风险，建立完全物理隔离的 RL 训练环境与实时熔断控制室 |
| `2026-11-23` | **Z.ai (智谱)** | **GLM-5.4** 官方技术博客（**Loop Transformer** 循环深度推理） | https://z.ai/blog/glm-5.4 | 将 28 层模块在潜空间循环迭代 2 次（配逐 token 门控渐进更新与优化 KV），**零参数膨胀深化超长链条因果推理** |

---

## 二、八大前沿实验室 2026 H2 核心技术复盘与工程深水区剖析

### 2.1 Alibaba Qwen：`Qwen3.8-27B` 黄金开源底座、`Qwen4` 架构预演与 `SAPO` 生态
- **公开来源**：`https://qwen.ai/blog`、`https://qwen.ai/blog/sapo/`、`https://huggingface.co/Qwen/Qwen3.8-Flash-Next`、[../arxiv-2608.30320/README.md](../arxiv-2608.30320/README.md)、[../arxiv-2511.21631/README.md](../arxiv-2511.21631/README.md)
- **2026 H2 关键动态与工程细节**：
  1. **`Qwen4` 官方路线图明确（2026-09-22 云栖大会）**：阿里云正式推出云端闭源旗舰 **`Qwen4-Max`**（`2.4T` 级参数规模、原生多模态视觉感知、1M 上下文），但截至 2026 年 11 月下旬，`Qwen4` 开源权重尚未下放至 Hugging Face；**2026 年 8 月底开源的稠密 `Qwen3.8-27B` 与稀疏架构预览版 `Qwen3.8-Flash-Next`（`125B-A6B + 51B N-gram`）事实上成为 2026 下半年全球开源社区开展长程 Agentic RL 的头号主力基座**。
  2. **架构级后训练护城河**：`Qwen3.8` 系列确立了按注意力头与门控通道拆分正交化的 Polar Express `Muon` + `Gated Residual` 规范（在 `4×` 峰值学习率无衰减压测下实现 **0 Loss 尖峰、0 次触碰梯度裁剪线**，$p_{99.9}$ 梯度离群值降低 `4.2×`），并明确警告 **全局注意力若去掉部分 RoPE 改用 `NoPE`，虽然预训练 Loss 完全一致，但在后训练长回复中会引发严重的“无限生成不终止（Endless Generation）”**。
  3. **社区与官方 `Qwen3.8-27B` 长程 RL 实践**：2026 年秋，围绕 `Qwen3.8-27B` 涌现出一批在数千个真实/合成终端与运维环境中跑多轮 RL 的标杆实践（包括基于递归语言模型 Harness `RLM` 的多步结构化压缩调用 RL，在大幅提升 `ExpertLongBench` 得分的同时反向削减了推理 Token 消耗），配合通义官方平滑软门控策略优化 **`SAPO`**（消除 `GSPO/GRPO` 硬裁剪边界震荡），验证了稠密 27B 在单机/双机 8 卡 H800 上做深度垂直领域 RL 的极高天花板。

### 2.2 Moonshot Kimi：从 `Kimi K3` 到 `Kimi K3.1 Pro`，把 3D / WebGL / 游戏引擎推进大规模联合 RL
- **公开来源**：`https://www.kimi.ai/blog/kimi-k3-1-pro`、`https://huggingface.co/moonshotai`、`https://github.com/kvcache-ai/AgentENV`、[../arxiv-2607.24653/README.md](../arxiv-2607.24653/README.md)、[../arxiv-2602.02276/README.md](../arxiv-2602.02276/README.md)
- **2026 H2 关键动态与工程细节**：
  1. **`Kimi K3`（2026-07）奠定开源 3D/Web 视觉编程头把交椅**：在完全相同的 `Claude Code` 脚手架下由人类专家双盲评测（`Kimi Webdev Bench`），K3 在 **`3D / WebGL / Shader` 赛道取得 `72.7% 胜 / 13.7% 平 / 13.6% 负`（净胜 `Claude Opus 4.8 max` 高达 `+59.1%`！）**，登顶 LMArena WebDev Arena 全球第 1（`1,678` Elo）。核心秘诀在于：**① 跨 `Claude Code / Codex / Kimi Code / OpenClaw` 白盒多脚手架混合 Rollout 防过拟合；② 编译失败、运行时报错或用静态 Mock 伪造功能直接一票否决（`Reward = 0`）；③ 公开诊断验证器 + 隐藏保留验证器（`AET`）双层防黑客；④ 5,121 万 Firecracker microVM 沙盒 `AgentENV` 的 `Pause/Resume`（回收 `98%` 等待 LLM 空转时间）与 `Fork`（零副作用判分）**。
  2. **`Kimi K3.1 Pro`（2026-10-23 发布 / 11-04 开源）纯后训练再进化**：在保持 `2.8T / 104B`（1M 上下文 + `MoonViT-V2`）底座架构不变的前提下，将**跨数百个下游领域的联合强化学习（Joint RL）算力与沙盒调度规模再推高一个数量级**：
     - 显式将 **3D 资产程序化生成与主流图形/游戏引擎集成（`Three.js`、`Unity`、`Unreal Engine`、`Godot`）** 以及超长程终端工程（`Terminal-Bench 4.0`）纳入核心 RL 沙盒群；
     - 在开源权重发布前，展示了极具参考价值的**领域安全剥离手术**：在 Mid-training 与 RL 环境池中定向隔离并清除自主攻击性网络安全语料与靶场，证明垂直能力完全可以通过环境配比精准调控。

### 2.3 Z.ai（智谱）与 `slime`：`GLM-5.2 -> 5.3 -> 5.4` 三连跳揭示“环境与潜空间深度 > 盲目堆参数”
- **公开来源**：`https://z.ai/blog/glm-5.2`、`https://z.ai/blog/glm-5.3`、`https://z.ai/blog/glm-5.4`、`https://github.com/THUDM/slime`、[../arxiv-2602.15763/README.md](../arxiv-2602.15763/README.md)
- **2026 H2 关键动态与工程细节**：
  1. **`GLM-5.2`（2026-06-16，`IndexShare` 破解百万上下文 RL 采样成本）**：每隔 4 层稀疏注意力共享同一个稀疏 Indexer，将 1M 上下文单 token FLOPs 砍掉 **`2.9×`**，使多小时超长轨迹的在线 RL 采样在算力经济账上真正跑通。
  2. **`GLM-5.3`（2026-08-14，“零底座改动、纯后训练 `6×` 暴涨”的里程碑实验）**：官方技术博客用震撼数据证明——**一行预训练基座权重都不重训，纯粹扩大长程破损代码仓/实时终端/测试集群环境规模并升级异步 Agent RL 算法 `SAO`（Stateful Agent Optimization）**，即可让模型在 `Terminal-Bench 3.0` 上实现 **`6×` 性能飞跃**！`SAO` 专门针对长达上百步工具调用后各采样轨迹状态严重分叉（导致传统整条序列求均值的 Vanilla GRPO 优势信噪比崩溃）的问题，实施状态感知的细粒度异步信用分配。
  3. **`THUDM/slime` v0.3.0（2026-10-08）**：将支撑 GLM-5 全家族的训推物理分离架构、`TITO` 词元直通网关、`IcePop` 离群比率归零与多任务 HTTP 编排器沉淀为开源工业标准，端到端异步 Agentic RL 训练吞吐较同步方案提升 **`>2.3×`**。
  4. **`GLM-5.4`（2026-11-23，`Loop Transformer` 潜空间循环思考）**：不增加任何参数量，通过持续训练将模型中段的 **28 层 Transformer 块循环迭代执行 2 次**（配合逐 token 渐进门控更新与专用 KV Cache 复用），在不扩大显存驻留体积的前提下翻倍加深单 token 内部隐式多步因果演算深度，专为超长链条系统排障与复杂逻辑推理打造。

### 2.4 DeepSeek：`DeepSeek-V4` 全量投产与 `DeepSeek-V4.1-Flash-1017`（`CED + CSA2`）极速合成革命
- **公开来源**：`https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017`、`https://api-docs.deepseek.com/`、[../arxiv-2606.19348/README.md](../arxiv-2606.19348/README.md)
- **2026 H2 关键动态与工程细节**：
  1. **`DeepSeek-V4-Pro`（2026-08-13 GA）**：将其在论文中验证的 **“十余个万亿专家独立 RL $\to$ 仅缓存末层 Hidden State 实时重构全词表 Logits 的在线蒸馏 `OPD`”**、**`<|DSML|>` 免转义工具调用 + 工具场景跨 `user` 轮次 100% 保留 `<think>`** 以及 **`WAL` 防抢占短长度偏置** 全面推向线上生产。
  2. **`DeepSeek-V4.1-Flash`（2026-09-10）与开源版 `DeepSeek-V4.1-Flash-1017`（2026-10-17）**：
     - **架构颠覆（`CED`: Causal Encoder-Decoder）**：总参数 `552B` MoE，40 层主干拆分为 **20 层因果编码器 + 20 层解码器**；解码器的全局 KV Cache 直接由编码器最末层隐藏态一次性投影生成，使模型在 **Prefill 阶段每 token 仅需激活 `8B` 参数、Decode 阶段激活 `16B` 参数**！
     - **`CSA2`（`Full / Reindex / Reuse` 三态跨层共享稀疏索引）+ FP4（E2M1）主 KV Cache + SWA 有界重放**：将全局 KV 显存占用极限压缩至惊人的 **`890 Bytes / token`**（仅为标准 V4-Flash 的约 `1/4`）！
     - **与本项目的直接血缘联系**：小红书开源的 `3DCodeFactory` 高质量 Three.js 多轮合成轨迹集正是调用 **`DeepSeek-V4.1-Flash-1017`** 在 `Claude Code` 脚手架下大规模生成的——理解其跨轮保留 `<think>` 与 `384K` 超低 KV 成本特性，直接指导我们对这批轨迹做无损清洗与对齐！

### 2.5 ByteDance Seed 与开源 RL 双雄（`verl` / `OpenRLHF`）：全流式多模态异步 RL 标准化
- **公开来源**：`https://seed.bytedance.com/`、`https://github.com/volcengine/verl`、`https://github.com/OpenRLHF/OpenRLHF`、[../arxiv-2509.02544/README.md](../arxiv-2509.02544/README.md)
- **2026 H2 关键动态与工程细节**：
  1. **`Seed 2.1`（2026-06-23）与字节异步 RL 体系（`Laminar` / `Seed GR-RL`）**：将 `UI-TARS-2` 首创的 **“最近 $N$ 张高清截图滑窗 + 全历史 `<think>` 文本情景记忆”**、**WebGL 浏览器虚拟时钟劫持** 以及 **离线价值预热 + 长度自适应解耦 GAE 的多轮 PPO** 扩展至桌面、Web 与企业级复杂工具链。
  2. **开源社区 `verl` 与 `OpenRLHF` 2026 下半年三大架构合流**：
     - **Server-Based 全异步协程采样**：彻底告别“全组等最慢一条沙盒跑完才更新”的同步屏障，采用基于 Ray Actor + `asyncio` 的独立推理服务池（支持 vLLM / SGLang + FSDP2 / Megatron V1 Trainer），并发维持 `1,000+` 有状态 `Claude Code` / `Mini-SWE-Agent` 会话；
     - **原生 `generate` Token 连续直通接口（对标 `TITO`）**：绕开有损的 OpenAI Chat Completions 文本重拼接接口，原生维护跨 Assistant `<think>`、Tool Call 与多模态环境返回图像/文本的精确 Token ID 连续性；
     - **优化算法与多轮环境完全解耦**：同一套底层收集器可无缝切换 `PPO`、`GRPO`、`GSPO/SAPO`、`REINFORCE++` 与 `RLOO`。

### 2.6 MiniMax：`MiniMax-M3`、`Forge` 异步底座与 `MaxProof` 生成式验证器进化搜索
- **公开来源**：`https://www.minimax.io/news`、`https://huggingface.co/MiniMaxAI/MiniMax-M3`
- **2026 H2 关键动态与工程细节**：
  - 在 `Forge` 原生异步 Agent RL 框架支撑下于 `2026-06-01` 推出 **`MiniMax-M3`**，紧接着于 `2026-06-09` 发布 **`MaxProof`** 深度技术复盘：**不再依赖单遍生成碰运气，而是用 RL 显式训出“证明生成（Generator）+ 漏洞挑刺（Error Identifier）+ 递归修补（Recursive Repair）”三位一体分工策略，并在测试时结合可信生成式验证器（Generative Verifier）引导种群级进化搜索（Evolutionary TTS）**——这一“生成-挑错-修补”闭环不仅攻克了 IMO/USAMO 金牌级非形式化证明，也为无精确解析梯度、但可多轮局部修补的复杂 3D 场景审美与几何装配优化提供了绝佳的推理期扩展模板。

### 2.7 Anthropic：`Opus 5.5` / `Fable 5.2` 与 GAN 式前端视觉 `Planner-Generator-Playwright Evaluator` Harness
- **公开来源**：`https://www.anthropic.com/engineering`、`https://www.anthropic.com/news`、[../arxiv-2511.18397/README.md](../arxiv-2511.18397/README.md)
- **2026 H2 关键动态与工程细节**：
  1. **前端与复杂应用开发的核心瓶颈是“自我评估失明（Self-Evaluation Blindness）”与“上下文焦虑（Context Anxiety）”**：Anthropic 工程团队在长程应用 Harness 深度复盘中指出——如果让同一个编写代码的 Agent 自己检查自己的前端/全栈作品，**单智能体几乎永远会盲目自信地宣称“代码已完美运行”，而真实浏览器打开却是排版错乱或交互死锁**；同时在窗口逼近上限时，模型会因“上下文焦虑”草率收尾、跳过核心功能实现。
  2. **受 GAN 启发的三角色对抗式验证架构（`Planner` + `Generator` + `Playwright MCP Evaluator`）**：
     - **`Planner`**：将简短用户需求扩展为高深度产品规格书与明确可验证的 **Sprint Contract（阶段验收契约）**；
     - **`Generator`**：按模块增量编码，并在上下文膨胀前通过结构化状态交接（而非仅靠被动有损压缩）保持清晰度；
     - **`Evaluator`（独立苛刻质检员）**：被赋予明确的“挑刺怀疑论”人格，**强制通过 `Playwright MCP` 亲自启动真实无头浏览器访问本地服务、点击按钮、拖动控件、校验视口响应式布局并截取多状态渲染图**，将模糊的“视觉品味与 UX 质感”拆解为硬阈值打分表（不达标即生成精确 Bug 报告打回 `Generator` 重修）！
  3. **`Claude Opus 5.5`（2026-09-22）、`Claude Fable 5.2`（2026-11-09）与 Rust 基础设施迁移（2026-11-25）**：`Opus 5.5` 将长程重构成本降低 `40%`；`Fable 5.2` 引入 1M 上下文、`effort` 自适应思考预算与思考块前缀完整性校验；同时结合其生产 RL 反黑客研究（`2511.18397`），确立了**“单元测试 98% 通过率绝不等于真实运行态可靠，一切必须以隔离环境下的端到端真实状态/渲染态交互验证为准 + 接种提示防失调传染”**的黄金工程准则。

### 2.8 OpenAI：`GPT-6 Astra / 6.1 Sol`、无状态压缩 `Codex Agent Loop` 与高强度 RL 沙盒隔离
- **公开来源**：`https://openai.com/index/unrolling-the-codex-agent-loop/`、`https://openai.com/index/`
- **2026 H2 关键动态与工程细节**：
  1. **旗舰 `GPT-6 Astra`（2026-09-03 / `6.2 Astra` 11-17）与高性价比编码利器 `GPT-6 Sol / 6.1 Sol`（2026-09-22 / 09-29）**：形成“1M+ 超长窗口重型规划探索（Astra）+ 极低延迟高频多轮沙盒执行（6.1 Sol）”的高低配双子星格局。
  2. **`Codex Agent Loop` 底层工程铁律**：
     - **严格前缀不可变性以保卫 Prompt Cache 命中率**：将环境说明、工具定义与 `AGENTS.md` 严格固定在 `system -> developer` 前缀，严禁在中间轮动态篡改前缀导致每轮重算昂贵 Prefill（与 Kimi K3 `XTML` 将单轮 `one-shot option` 放到历史末尾异曲同工！）；
     - **主动式 `/responses/compact` 状态压缩**：一旦逼近上下文阈值即触发专用压缩端点，将冗长工具原始输出蒸馏为高密度可执行状态摘要。
  3. **“后训练的瓶颈已从模型转移到环境本身”与 RL Control Rooms**：OpenAI 在 2026 下半年多次强调，随着前沿编码模型具备极强的漏洞挖掘能力（甚至出现研发模型在训练缓存/沙盒中自主串联利用环境漏洞的真实安全事件），**大规模 Agentic RL 必须实行“一轨迹一强隔离沙盒”、DNS/外网白名单物理阻断、只读外部验证器以及带实时流量审计的一键熔断控制室（Control Rooms）**。

---

## 三、2026 下半年行业六大技术范式收敛定律（Cross-Lab Consensus）

1. **定律 1：纯后训练缩放（Environment & RL Scaling）迎来独立爆发期**——`GLM-5.3`（不改底座 `Terminal-Bench 3.0` 涨 `6×`）与 `Kimi K3.1 Pro`（不改底座靠百域联合 RL 跃升 3D/引擎与长程编程）共同证明：只要底座过线（如 `Qwen3.8-27B`），**高保真可执行验证沙盒的广度、防黑客严密性与异步采样吞吐**直接决定最终上限。
2. **定律 2：多专家垂直 RL + 在线策略蒸馏（`OPD / MOPD`）全面取代混合多任务 RL**——无论是 `DeepSeek-V4`（缓存末层 Hidden State 重构全词表 Logits 做精确反向 KL）还是 `Kimi K3`（Eq. 15 双边截断逐 token 对数比 `MOPD`）抑或 `GLM-5`（$G=1$ 跨阶段 `OPD`），一线大厂已一致放弃多领域大锅烩 RL，改走**“分轨专项训透 $\to$ 在线蒸馏无损合流”**。
3. **定律 3：训推逐 Token / 逐比特一致性是异步长程 RL 的生死线**——`TITO` 原生 Token ID 直通（`slime`/`verl`/`Kimi`）消灭重分词错位；确定性算子（`DeepSeek-V4` 批次不变核、`GLM-5` 确定性 `topk`）+ 离群比率截断/软门控（`IcePop`、`SAPO`、Kimi 局部二次惩罚）消灭几步内熵坍缩。
4. **定律 4：多轮工具场景必须跨轮保留 `<think>`，而视觉观测必须做“最近 $N$ 帧滑窗 + 历史折叠”**——`DeepSeek-V4`、`Kimi K3 (XTML)`、`GLM-5` 与 `UI-TARS-2` 完全一致：**保留完整 `<think>` 推理脉络防架构失忆，仅对高开销历史截图与千行终端原始日志做滑窗剔除或结构化摘要**。
5. **定律 5：前端与 3D 视觉编程验证必须从“静态编译/单测”升级为“隔离无头浏览器交互 + 双层隐藏验证器”**——`GLM-5`（`BSR 98%` 但大量白屏/CSS 裁切作弊）、`Kimi K3`（报错/造假归零 + `AET` 公开/隐藏双验证器，3D 净胜 `+59.1%`）与 `Anthropic`（GAN 式独立 Playwright Evaluator + 防 `conftest.py`/`AlwaysEqual` 作弊）形成完美闭环铁证。
6. **定律 6：弹性预算控制（`Toggle` / $\tau\cdot b_0(x)$ 退火）取代一刀切长度惩罚**——只在已掌握题（`Pass@K >= λ`）上周期性压缩冗余 Token，在未攻克难题上全额保留深度长思考与多轮自修空间。

---

## 四、面向本项目（`Qwen3.8-27B` 三轨 Visual Coding & CAD Agent）的全链路工程映射表

| 项目阶段 / 模块 | 直接对标的 2026 H2 大厂最佳实践 | 本项目三轨（`Track 1: Three.js` / `Track 2: 2D Web` / `Track 3: CAD`）具体可执行落地动作 |
| :--- | :--- | :--- |
| **底座与数据清洗**<br>(`Stage 0 SFT`) | • `Qwen3.8-Next`（防无终止复读）<br>• `DeepSeek-V4.1-Flash-1017`（轨迹源特性）<br>• `GLM-5`（报错轮局部 Loss Mask）<br>• `Anthropic 2511.18397`（防软作弊残留） | 1. 清洗 `DeepSeek-V4.1-Flash-1017` 生成的 `3DCodeFactory` 轨迹时，完整保留跨轮 `<think>`；<br>2. 对轨迹中途“写错报错 $\to$ 下轮修复”段落，**保留报错上下文但对错误输出轮施加 Loss Mask**；<br>3. 剔除未正常生成 `EOS` 的截断样本，并用多时间戳真实像素差分重验入库，绝不只靠简单关键词过滤。 |
| **训练基础设施**<br>(`2×8 H800` + `ms-swift`) | • `GLM-5 / slime` & `verl`（`TITO` + `IcePop`）<br>• `Kimi K3 AgentENV`（回收 `98%` 空等 + 无副作用 `Fork`）<br>• `DeepSeek-V4`（`WAL` 防短偏置） | 1. 强制开启 **Token-In-Token-Out (`TITO`)** 传递原始 `token_ids` 与 `rollout_logprobs`；<br>2. 浏览器渲染池采用**按需瞬时借还（避免每条轨迹常驻持有 Chromium 空等 LLM 解码）**，判分脚本在只读临时副本上运行；<br>3. 沙盒基础设施超时样本直接 Mask 丢弃，严禁记 `0/-1` 分或盲目重抽导致偷懒短代码偏置。 |
| **三轨防黑客验证器**<br>(`Stage 2 RL` 核心) | • `Kimi K3`（报错/造假归零 + `AET` 公开/隐藏双验证器）<br>• `GLM-5`（HTML 三级 DOM/溢出防作弊）<br>• `Anthropic`（物理隔离 + Playwright 独立质检 + 劫持防护）<br>• `UI-TARS-2`（虚拟时钟确定性化） | 1. **物理隔离**：`verify_xhs_output.cjs`、`check_2d_v2.mjs`、`cad_inspect.py` 置于 Agent 不可读写的宿主隔离路径；页面加载前冻结原型链并固定 `Math.random` 与虚拟时钟；<br>2. **公开+隐藏双验证器**：训练期允许 Agent 有限次调用诊断截图自修；最终奖励采用**隐藏随机时间戳 `renderAt(t+δ)`、隐藏环绕相机视角（防单视角纸片人假 3D）、DOM 裁切/重叠探针与独立 OCC 内核 `0.0 mm³` 零干涉硬门控**；<br>3. 发现构建异常、控制台未捕获报错或空壳函数，整条轨迹奖励立即硬归零。 |
| **多轮视觉上下文与预算控制**<br>(`Stage 2 & Stage 3`) | • `UI-TARS-2`（最近 $N$ 图滑窗 + 保 `<think>`）<br>• `Kimi K2.5 Toggle` & `K3` 退火课程<br>• `Qwen3-VL`（`SAPO` + `[0,1000]` 接地 + 防单次调用偷懒）<br>• `OpenAI Codex`（前缀缓存保护 + 主动压缩） | 1. 多轮视觉自修仅保留**最近 $N=3$ 轮渲染截图**，100% 保留全部历史 `<think>`，固定 `system/tools` 前缀不动；<br>2. 引入 **`Toggle` 双相交替预算控制**（每 $m=10$ 步切换，仅当题目组内 `Pass@G >= 0.5` 时裁剪超第 60 分位长度的啰嗦轨迹），并在 Stage 3 专项训练 `384K auto-compact` 前后的主动状态交接；<br>3. 过程奖励绑定**真实错误下降量（Error Delta）**而非工具调用次数，辅以 `[0,1000]` 归一化坐标视觉评判锚点。 |
| **三轨无损合一**<br>(`Stage 4 Merge`) | • `UI-TARS-2`（线性模式连通权重插值）<br>• `DeepSeek-V4`（缓存末层 Hidden State 全词表 `OPD`）<br>• `Kimi K3`（Eq. 15 截断逐 token `MOPD`） | 1. 先将同源训出的 `3D`、`2D`、`CAD` 三个 `Qwen3.8-27B` 专项 Checkpoint 做线性权重加权平均作为学生热启动起点；<br>2. 采用 **DeepSeek-V4 式“仅缓存三轨教师末层 Hidden State + 按教师分组单次挂载 LM Head 实时重构全词表 Logits”的精确反向 KL 在线蒸馏（辅以通用锚点集）**，彻底规避三轨混合 RL 的梯度冲突与灾难性遗忘！ |

---

## 五、配套本地论文深度精读索引（相对路径导航）

- [DeepSeek-V4 (`arXiv:2606.19348`)：批次不变确定性算子、全词表缓存 Hidden State `OPD`、`WAL` 与 `DSec` 四基板沙盒](../arxiv-2606.19348/README.md)
- [Kimi K3 (`arXiv:2607.24653`)：9 专家 RL、截断 `MOPD`、3D/WebGL 盲评净胜 `+59.1%`、`AgentENV` 5,121 万微虚拟机与 `XTML`](../arxiv-2607.24653/README.md)
- [Qwen3.8-Next (`arXiv:2608.30320`)：`GDN+QSA+GR`、拆分 `Muon` `4× LR` 零尖峰、预训练/后训练四大背离与 `Qwen3.8-27B-Base` 14 项全基准](../arxiv-2608.30320/README.md)
- [GLM-5 & `slime` (`arXiv:2602.15763`)：非确定性 `topk` 崩溃与 `IcePop`、`TITO` 异步 RL、Docker `Agent-as-a-Judge` 与 HTML 三级防作弊](../arxiv-2602.15763/README.md)
- [Kimi K2.5 (`arXiv:2602.02276`)：视觉看图自修闭环起源、`Toggle` 双相交替预算控制精确公式与 `PARL` 并行智能体群](../arxiv-2602.02276/README.md)
- [Anthropic Production RL (`arXiv:2511.18397`)：生产代码 RL 三大真实黑客手法、跨域蓄意破坏失调与接种提示硬消融](../arxiv-2511.18397/README.md)
- [ByteDance UI-TARS-2 (`arXiv:2509.02544`)：最近 $N$ 图滑窗保 `<think>`、WebGL 时间 API 重写与稳定化多轮 PPO](../arxiv-2509.02544/README.md)
- [Qwen3-VL (`arXiv:2511.21631`)：`Interleaved MRoPE`、`DeepStack`、`[0,1000]` 空间接地、多模态必要性过滤与 `SAPO` RL](../arxiv-2511.21631/README.md)
