# 3D Animation Agent 首版训练失败全因复盘、Round 2 避坑审查与 DAgger（arXiv:2605.12913）路线评估

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

日期：2026-11-25  
关联项目：`${WORKSPACE}/3d-animation-agent`  
核心依据：
- 首版训练与效率复盘：[27B Dense 提速矩阵与复盘](../3d-agent-training-efficiency-packing-parallelism-20261124/README.md)
- 旧集与新集双臂基线及根因取证：[线 A 总报告](../../3d-animation-agent/reports/round2-line-a-eval-20261124-001/REPORT.md) · [旧 dev 根因诊断](../../3d-animation-agent/reports/round2-line-a-eval-20261124-001/old-dev-failure-diagnosis.md)
- 首版数据与配比复盘：[数据构造复盘](../3d-agent-data-construction-retrospective-20261123/README.md) · [配比与权重复盘](../3d-agent-sft-mix-loss-20261123/README.md)
- Round 2 阶段 1 DeepSeek Canary 实测：[线 B Canary 报告](../../3d-animation-agent/reports/round2-canary-20261124-001/REPORT.md)
- 论文精读：[Revisiting DAgger in the Era of LLM-Agents（arXiv:2605.12913v1）](../arxiv-2605.12913/README.md)

---

## 一、首版训练（`first-sft-20261123-001` / `checkpoint-10946`）失败原因全景复盘

首版在双机 16×H800 上耗时 17h49m 训完 10,946 步，但实际行为收益微弱且引入了显著副作用：
- 旧 `holdout-v1` test：`1/48 → 3/48`（+4.2pp，44 题双方均败）；
- 新冻结 `evals/devtest-v2` 60 题（`technical_pass / pending_blind_review`）：dev `4/12 → 4/12`，test `8/48 → 11/48`（全集 `20.0% → 25.0%`，95% CI 跨 0）；
- 单轮 `Aodi xhigh` 30 题：`22/30 → 24/30`（单轮确有收益，但多轮 Agent 退化明显）。

复盘全部日志、源码与两套 60 题配对评测后，首版失败归结为 **8 大系统性根因**：

### 1. 数据能力结构严重偏科（真实修复 = 0）
- 249 条旧 Kimi ReAct 中，221 条为从零生成、23 条虽标 `repair` 但实为“健康场景保持原样”、仅 5 条局部编辑，**带真实缺陷的修复轨迹为 0 条**。
- 249 条仅覆盖 82 个来源内题族，且难度仅为 prompt 复杂度、并非学生实败难点；同时旧 Kimi 以 `medium` 档跑高难度题，161/211 条主候选按 `lowest_wall_seconds`（耗时最短）选出，天然偏向浅层短轨迹，未学到深度返修与高审美上限。

### 2. 交付契约歧义 + 验证脚本假阳性（旧集 45.8% 失败源）
- 旧集 120 条中有 **55 条（45.8%；原版 37/60，学生 18/60）** 死于 `broken_delivery_missing_workspace_file`。
- 取证确认 **55/55（100%）** 为 `<50KB` HTML 壳引用外置 `<script src=...>`，其中 **52/55（94.5%）** bundle 就躺在 `output/` 中、**54/55（98.2%）** 跑过 `capture.cjs`、**45/55（81.8%）** 读回过 PNG 截图并误判通过——根源是旧 `capture.cjs` 在原 `output/` 目录原地加载（不拷贝到空目录、不拦 `file://` 子请求），叠加 249 条 Kimi 训练数据中仍有 87 条残留 `esbuild --outfile=output/...js` 习惯。
- 新 `devtest-v2` 仅把离线单文件契约写清进题面后，该类失败立刻从 **45.8% 断崖跌至 3.3%（学生 0/60）**。

### 3. 旧采集流缺失请求级上下文与环境污染
- 旧 249 条由 Claude Code `stream-json` stdout 近似重建，缺失真实 **system prompt 全文（~6KB）、6 个工具 JSON `input_schema`、初始 user 题面、采样参数与 compaction 边界**。
- 首版入训 `train.jsonl` 中，全部 249 条 ReAct 的 `tools` 被强制置空为 `"[]"`、system 退化为 `"You are a helpful assistant."`，与推理期注入完整 `# Tools` 协议产生严重分布偏移。
- 采集沙盒未做隔离：**106/249 条混入 257 次自动记忆写入**，约 **66%（8,213/12,450）** 工具调用携带采集机绝对 case/trial 路径。

### 4. 配比极度失衡 + `gbs=1` 稀释 + 契约冲突
- 首版把 10,697 条 `aodi_answer_only`（0 `<think>`、0 `tools`、CDN + Three.js r160 单轮代码）全量灌入，与 249 条离线/r180/多轮 ReAct 混合：
  - 按加权监督 token，无思考无工具单轮占 **87.9%**；
  - 叠加 `global_batch_size=1` + `clip_grad=1.0`（日志 100% 步触发裁剪），ReAct 按更新步仅占 **2.27%**；
  - ReAct 内部又有 **57.3%** 有效标签是未经压缩的 Kimi 长思考（均条 36.2K），且 `Write.content` 长代码参数单独吃掉 ReAct 权重和的 **47.38%**，进一步挤压工具决策、视觉反馈与收尾监督。

### 5. 学生独有的早停空答与工具 XML 边界退化（权重级损伤）
- 在旧集（**9/60 vs 0/60**）与新 `devtest-v2`（**6/60 vs 0/60**）中，**100% 仅见于 `checkpoint-10946` 学生**出现“正常退出（`exit=0, is_error=false`）但终答为空、未闭合 `</think>` 即直接 EOS、甚至在思考内部吐出 `</parameter></function></tool_call>`”的退化；空参数 `tool_use` 达原版 **3.8×**（49 vs 13），`InputValidationError` 达原版 **5.1×**（91 vs 18）。
- **源码级精准核验（重要纠偏）**：线 A 报告曾怀疑 `swift-preprocess` 把单轮 assistant 拆成连续 2–3 条 `role="assistant"` 是直接元凶；经实查容器内 `ms-swift 4.5.2` 源码 `swift/template/base.py:1310-1320`，`template_backend='swift'` 实际会把连续 `assistant` 合并成**单一 `<|im_start|>assistant ... <|im_end|>` 轮次**并按 span 施加 `0.5/1.0/2.0` 权重，**并未在思考与工具间插入伪 `<|im_end|>`**。因此该退化的真正复合根因是：**`tools=[]` 协议失配 + 87.9% 无思考无工具单轮改写 EOS 分布 + 未清洗超长思考/代码段 + `gbs=1` 高方差裁剪更新**，叠加客户端对空文本 `end_turn` 静默判成功。

### 6. Overthinking 与无收敛纪律超时（`devtest-v2` 头号大敌：40.8%）
- 消除 `broken_delivery` 遮蔽后，`devtest-v2` 的第一大失败源浮出水面：**`other_timeout` 占 49/120（40.8%；原版 26、学生 23）**，其中 **43/49 已通过 `check_browser.mjs`、34/49 已 `repeat_exact=true`**。
- 首版评测中学生总观察 token（56.8M）是原版（27.5M）的 **2.07×**——模型并非做不出来，而是陷入无休止的看图/微调/重复验证，耗尽 3600 秒被强杀。

### 7. 训练工程效率低下导致无法做消融迭代
- `TP=4, PP=4, gbs=1` 产生 75% 流水线死气泡，无持久 `TRITON_CACHE_DIR` 导致 FLA #758 `causal_conv1d` 116 桶重编译耗去 2.25h，单轮耗时 17h49m（2,314 tok/s，MFU 2.36%）。

### 8. 评测验证与因果归因缺失
- 首版训练验证集只有 812 条 Aodi 单轮样本，没有 ReAct val loss，且没有同起点“纯单轮对照臂”，无法区分增益来自 1 万条单轮还是 249 条 ReAct。

---

## 二、Round 2（DeepSeek `high` + 阶段 1 Canary + 阶段 2 方案）逐条避坑审查

将上述 8 大旧错与阶段 1 实测暴露的新风险逐条核验：

| 编号 | 首版失败根因 / 风险点 | Round 2 当前状态 | 核查证据 / 阶段 2 放量前必补动作 |
|---|---|---|---|
| 1 | 真实修复 = 0、题族偏窄、Kimi 产物天花板不足 | **✅ 已避开** | 全面切换 `deepseek-v4.1-flash-1017 (effort=high)`，彻底弃用旧 Kimi 249 条；`evals/round2-train-v1` 已落地 24 新题族（45% 真实缺陷修复+断链恢复、25% 高审美生成、20% 局部编辑、10% 健康对照），`max_sim=0.1159` 零重叠；Canary 7 帧视觉抽检 4 件达博物馆/高 PBR 级。 |
| 2 | 交付契约歧义 + 外置 `<script src>` 假阳性 | **✅ 已避开** | 所有新多轮与 One-Shot 题面及检查器均统一强制离线单文件 Three.js r180 + 空目录 `file://` 冷加载 0 外链门禁；Canary `cycloidarch` 断链恢复 100% 过关，One-Shot 5/5 esbuild 离线内联 0 外链。 |
| 3 | 旧 `stream-json` 缺 `system`/`tools`/compaction + 自动记忆/路径噪声 | **⚠️ 基本解决，放量前需统一至方案 A** | 沙盒已彻底关闭自动记忆（0 写入），线 B Canary 4/4 `system_prompt_available=true`、`tools_count=6`、`history_thinking_preserved=true`。**放量前收口动作**：按用户确认的**方案 A**，将多轮 ReAct 与离线 One-Shot 全部统一到 `${WORKSPACE}/repos-logging-proxy`（加轻量 per-trial 动态端口/目录封装 + `logging_proxy_to_swift.py` 桥接），不再分叉维护两套代理。 |
| 4 | 87.9% 无思考 Aodi 淹没 + `gbs=1` 稀释 ReAct | **✅ 已避开** | 四合一池按有效监督 token 控配比（ReAct 22–25% + 离线带思考 One-Shot 24–28% + 分层精选 Aodi 2,250 条 36–42% [显式单轮 system 隔离] + SWE 回放 10–13%）；改用 `M7` `binpack@65K + gbs=8`，每步打包混合不再按步稀释。 |
| 5 | `empty_think_only_end_turn` 与 XML 工具边界退化 | **⚠️ 关键项已修，放量前补 2 项硬核验** | 已补齐真实 `tools`（6 工具 schema）、大幅压缩无思考 Aodi 占比、并用 `prune_react_cot.py` 把超长思考压回 `<=8K`（且非思考字段 SHA-256 100% 逐字节不变）。**放量前补做**：① 入库自动拒绝未闭合 `</think>`、思考内泄漏 `</tool_call>` 或空参异常轮；② 对最终 `ready.jsonl` 抽样做**真实 27B tokenizer 逐 token decode 审计**，100% 核对渲染格式与 vLLM 推理期 `chat_template.jinja` 完全一致。 |
| 6 | **40.8% `other_timeout` 与 DeepSeek `high` 110 轮死循环** | **❌ 尚未完全封口（阶段 2 前 P0 必改！）** | 线 B Canary 中 `r2-keplersector-gen` 在 `high` 档无轮数硬上限时跑到 110 轮/57 图超时，直接复现了线 A 在 `devtest-v2` 看到的 40.8% 纯超时问题！**放量前必改**：① 给 `run_claude_cases.py` 增加透传 `--max-turns` 硬护栏（修复/编辑/健康 `<=28`、从零生成 `<=40` + `--timeout 3600`）；② 在 `TEACHER_CONVERGENCE_PROMPT` 强化“验通即立即收尾交付，禁止二次返工微调”；③ 仅收录自然收敛（`exit=0`）且轮数克制的轨迹，直接把“会及时收尾”教给学生。 |
| 7 | 训练效率低（18h/epoch） | **✅ 已彻底解决** | 锁定 `M7` 冠军配置（`TP4·PP2·DP2 + binpack@65536 + gbs=8 + CUDA causal_conv1d`），实测提速 **2.88×–3.27×**；Round 2 ~65M tok 盘子训 2–3 epoch 仅约 **8 小时**。 |
| 8 | 缺分轨验证与因果消融 | **✅ 已避开** | 新建分轨验证集（Aodi val + ReAct val + One-Shot val），并安排同起点 `v2-full`（~8h）vs `v2-oneshot-only`（~5h）单变量对照，在零泄漏 `devtest-v2` 上同台验收。 |
| 9 | 题面断言命名假阴性 & One-Shot 混合推理空思考 | **⚠️ 阶段 2 前小修补** | ① 在 `round2-train-v1` 题面显式声明 `window.__3D_STATE__` 被断言字段名（消除 `cycloidarch` 类假阴性），并把题库按同样零重叠标准扩充到支撑 300–400 通过 ReAct & 500–800 通过 One-Shot；② 批量采集 One-Shot 时统计自发空思考占比（Canary 2/5），确保至少 70%+ 样本带有效结构化 CoT。 |

**总体审查结论**：Round 2 方案已精准避开首版 8 大病根中的 6 项，剩下的 3 个关键封口（**`--max-turns` 治超时 + 方案 A 统一 `repos-logging-proxy` + 题库扩容与 token decode 审计**）均明确可控、改动极小，补完后即可安心放量阶段 2！

---

## 三、`arXiv:2605.12913`（DAgger for LLM-Agents）冷静评估与路线衔接

### 1. 为什么你“先造好 Round 2 干净数据，暂不上学生-教师混合训练”的判断完全正确？
1. **论文自身的第一步就是纯教师 SFT（$\beta_1 = 1.0$）**：DAgger 算法第 1 轮迭代设定 $\beta_1 = 1.0$（100% 纯教师轨迹冷启动），等学生具备基本工具纪律和交付能力后，第 2 轮起才降到 $\beta_2 = 0.8 \to 0.6$。我们当前的 `checkpoint-10946` 仍存在 10% 空答早停与 40% 超时死循环，**直接拿它做学生采样前缀只会制造大量低质死胡同状态**；先把 Round 2 干净数据训成扎实的 `v2`（即严谨的 **Iteration 1, $\beta_1=1.0$**）是最高效、风险最低的必经之路。
2. **轮级 DAgger（Turn-level）工程复杂度与成本高**：学生执行轮 $b_t=0$ 仍需额外调用教师产生反事实动作 $\tilde{a}_t$，既增加 $(1-\beta_i)$ 倍 DeepSeek 费用，又引入**分叉树形样本**（实际执行 $a_t$ 而训练监督 $\tilde{a}_t$），在 Megatron-SWIFT + 多模态视觉截屏环境下必须单写分支 packing 与 mask 验证，且论文尚未在多模态视觉 Agent 上实测过。

### 2. 这篇论文给我们的 3 条高价值启发（无缝衔接 Round 2 → Round 3）
1. **直接印证 Round 2 阶段 2 的两条核心做法**：
   - 论文 §4.5 发现纯 SFT 工具/语法错最高、OPD 死循环高达 44.3%、剩余失败 57.5% 是 64K 溢出——与我们在 `devtest-v2` 看到的 **40.8% 纯超时死循环 + 5.1× 工具报错** 高度吻合，说明阶段 2 狠抓 **“完整 `tools` schema + `--max-turns` 收敛纪律 + CoT 提纯控在 65K 内”** 打在了最关键的命门上；
   - 论文 Table 5 证明：不必过度苛求完美 100 分单测才保留样本，**只要满足“合法交付 + 基础确定性硬检通过”就能大幅提升数据利用率**——完全支持我们已定的“全自动硬检全过 + 10% 视觉抽检、先保量再精选”策略。
2. **Round 2 统一 `repos-logging-proxy` 是在免费为 Round 3 铺地基**：
   - 只要阶段 2 所有采集统一走 `repos-logging-proxy` 留存完整 `/v1/messages` 请求状态 $s_t$（含 system、tools、多轮历史与 sha256 图片），Round 3 启动混合训练时**零重写采集层**。
3. **Round 3 零风险渐进路线（先 AggreVaTe，再视收益决定是否上轮级 DAgger）**：
   - 等 Round 2 训出 `v2-full` 并在 `devtest-v2` 看到明确跃升后，Round 3 **不必一上来就写复杂的轮级反事实分支 DAgger**，而是先做论文里的 **AggreVaTe 省算力版**：
     - 让 `v2-full` 学生在独立新训练题上自主跑前 $\kappa$ 轮（或跑到首个报错/坏交付状态）；
     - 从同一工作区与 `repos-logging-proxy` 精确记录的前缀切换 DeepSeek 1017 接管修好并交付；
     - 训练时把学生前 $\kappa$ 轮设为 `loss=False`，**只对 DeepSeek 接管段算标准交叉熵 loss**——**零反事实分叉、零额外 API 浪费、直接复用现有 `M7` 训练管道**，先把论文验证过的“消除部署态协变量偏移（KL 降 ~20%）”红利稳稳拿到手，证明在 `devtest-v2` 有净增益后再考虑进阶轮级 DAgger（$\beta \in \{0.8, 0.6\}$）。
