> [!WARNING]
> **历史规划快照（已被 `2026-11-27` Revision 3 / Option 2 全面替代，SUPERSEDED）**：本文为 `2026-11-24` Round 2 早期规划文档，其中关于 `deepseek-v4.1-flash-1017`（L17, L33, L45；旧 `.env.deepseek` 额度已耗尽停用）、CoT 改写提纯与 `65K` 切包（`scripts/prune_oneshot_cot.py` / `prune_react_cot.py`，L18, L33, L44–49）、Round 2 四合一池与旧 val 口径（L19, L26–38）、`thinking=0.5 / content=1.0 / tool_calls=2.0` 权重（L50）及 `M7` `TP4·PP2·DP2 + binpack@65536 + gbs=8` 单文件 Three.js 训练（L74–75）均已被 **Revision 3 / Option 2**（`Qwen3.8-27B` `Static YaRN 1.5×` 不切分硬训 `384K` [`MAX_LENGTH=PACK_LEN=393216`、`(tok<=393216, img<=80)`、`32×H100` `[8,20,20,16]`、`--is_binary_loss_scale false`、空 `<think>` `0.0 / w_ch` 拆分、`validation.jsonl` `loss_scale=1.0`、严禁改写活跃区 `<think>`] + `256K` 沙盒 `208000 / 80% / 32768 / 16384` + `80–85% kimi + 15–20% opus`）替代。现行唯一标准参见 `decisions.md`（本地附件未发布）、[XHS-UNIFIED-SFT-STANDARD.md](../XHS-UNIFIED-SFT-STANDARD.md)、[STANDARD-PARAMS.md](../STANDARD-PARAMS.md) 及 Option 2 主方案（[CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md](../../../research/xhs-384k-to-200k-data-adaptation-20261127/CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md)、[OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md](../../../research/xhs-384k-to-200k-data-adaptation-20261127/OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md)）。下文原样保留供历史审计对照。

# Round 2：27B Dense 3D 动画数据制造、消融训练与三轨准备方案

> 公开整理版 · 2026-11-28。保留成文时点的记录；计划、文献结果和本地实测请分别理解。环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

日期：2026-11-24（经 `/grill-me` 与用户逐层对齐确认）  
目标基座：`Qwen3.8-27B` Dense BF16（`${MODEL_ROOT}/Qwen3.8-27B`，`model_type=qwen3_5`，`template=qwen3_8`）  
训练配置基线：`M7` 实测冠军方案（[27B 提速矩阵报告](../../../research/3d-agent-training-efficiency-packing-parallelism-20261124/README.md)）

---

## 1. 已对齐的核心决策（7 项定盘）

| 维度 | Round 2 确认方案 | 依据 / 排除项 |
|---|---|---|
| **1. 轨道范围** | 训练主攻 **3D 动画打穿**（拉升 `devtest-v2` `Accepted@1`）；**2D 动画与 3D 打印**仅并行建冻结种子评测集，不混入 Round 2 训练 | 避免在 2D/打印无独立冻结评测集时盲训；符合 `decisions.md` 分轨独立报数口径 |
| **2. 教师模型** | **全面切换 `deepseek-v4.1-flash-1017`**（3D 专用 `.env.deepseek`，`effort=high` 保产出品天花板） | 弃用旧 Kimi `medium` 数据；学生中心快照纠偏（B 线浏览器恢复）留待 Round 3（`v2` 站稳交付与基础修复后再做） |
| **3. 思维链（CoT）提纯策略** | **保真提纯（Preserve-and-Prune）**：One-Shot 思考压至 **3K–8K tok**（上限 ≤12K）；多轮 ReAct 仅局部压缩 >3K 的超长单段至 **2K–6K**（硬帽 ≤8K），**严禁改写实际 `tool_calls`/代码/观察** | 消除 RL 教师尾部犹豫与死循环，防止 27B overthinking；完美对齐 65K packing 甜区 |
| **4. 四合一干净数据池** | 彻底弃用旧 Kimi 249 条，新建四池（目标总计 **~65M 监督 tokens**，见第 2 节） | 彻底消除旧 `stream-json` 缺上下文、自动记忆污染与 CDN/离线契约互打 |
| **5. 质检门禁与选优** | **先保量再精选**：100% 过全自动确定性技术检查（`file://` 离线零报错 + 11 类浏览器/数值硬检查）+ **10% 视觉抽检**（DeepSeek 18790 看图 / Astra）；多采样按检查全过与收敛干净度选优（禁止 `lowest_wall_seconds` 盲选） | 兼顾高质底线与 1–2 天造数吞吐 |
| **6. 训练与消融** | 用 `M7` 冠军模板训 **`v2-full`**（2–3 epochs，~8h）+ **1 组去 ReAct 单轮对照组 `v2-oneshot-only`**（~5h），同起点同预算坐实多轮 ReAct 独立增量 | 解决首版无法归因给 Aodi 还是 ReAct 的遗留缺口 |
| **7. 启动节奏** | **三线并行**：线 A（GPU 跑 `devtest-v2` 基线 + 查清旧 dev 缺 HTML 根因）∥ 线 B（独立训练题库 → 10 题 canary → 四池造数）∥ 线 C（2D/3D 打印种子评测集） | API+CPU 造数与 GPU 评测零资源冲突 |

---

## 2. 四合一干净训练数据池规格（标准闭环档，总计 ~65M 监督 tokens）

所有新多轮样本强制经 `--episode-capture` 完整 HTTP 抓包、隔离 `.claude-config`（`autoMemoryEnabled=false`）、中性工作目录，并与冻结评测集 `evals/devtest-v2/`（60 题 / 18 族）及历史 holdout 做题族与文本相似度隔离校验（`max_sim < 0.5`）。

| 数据池 | 目标条数 | 估算监督 Token | 占比 | 关键构造成分与硬约束 |
|---|---:|---:|---:|---|
| **池 1：DeepSeek `high` 多轮 ReAct 主池** | **300–400 条** | ~12–16M | ~22–25% | 全独立新训练题族（严禁触碰 `devtest-v2`）：<br>• **真实缺陷修复 + 断链恢复（45%）**：注入 `visual-agent-v2` 11 类故障（`broken_delivery` 外部文件缺失、定帧失败、回拖残影、循环接缝、机构约束漂移、遮挡/出框等），训练“发现问题→改代码→空目录 `file://` 复验→交付”闭环<br>• **高审美从零生成 + 自检（25%）**：离线单文件 Three.js r180 + 程序化 CanvasTexture/PBR + 明确终态收尾纪律<br>• **局部编辑与非目标保持（20%）**：参数/部件定向修改，附带非目标断言<br>• **健康对照不误改（10%）**：输入合格场景，验证后原样交付 |
| **池 2：DeepSeek `high` 离线高审美 One-Shot（CoT 提纯）** | **500–800 条** | ~12–20M | ~24–28% | `reasoning_effort=high, max_tokens=98304` 生成博物馆/电影级离线单文件 Three.js r180 作品（禁用低模积木风、要求程序化 PBR 纹理与无悬空装配）→ 无头 Chromium `file://` 零报错+动效硬检 → 正向规划视角 CoT 提纯至 **3K–8K tok**（单条总长 20K–32K，2 条正好打满 65K pack） |
| **池 3：分层精选 Aodi 单轮底座** | **2,000–2,500 条** | ~24–30M | ~36–42% | 按 `source (Scenes-v1/v2/GLB) × domain × level × 来源内部长度分位数` 分层抽样，GLB 同标题簇降权；**使用独立显式 system prompt** 标明单轮模式，与离线 Agent 契约明确分离 |
| **池 4：通用 SWE 多轮防遗忘回放** | **600–800 条** | ~6–10M | ~10–13% | 直接按前缀嵌套序列取已验通的 `swe-replay-27b-v1`（`<=48K`，`max_single_thinking_tokens=8192`，`tool_calls=2.0`） |

- **验证集同步升级**：不再只用 Aodi 812 条单轮 val；新建分轨验证集（**Aodi val 256 条 + 独立 ReAct val 30 条 + 离线高审美 One-Shot val 40 条**），分别跟踪 loss 曲线。
- **训练账本要求**：封版时按 `research/3d-agent-sft-mix-loss-20261123` 规范输出完整分母账本（记录数、输入 token、监督标签 `U`、加权和 `W`、`Write.content` 占比、各池每步实际曝光分布）。

---

## 3. CoT 保真提纯与入训转换规范

1. **One-Shot CoT 提纯（`scripts/prune_oneshot_cot.py`，待新建）**：
   - 仅在原始 `reasoning_tokens > 8,192` 时触发；以 DeepSeek 1017（`temperature=0.4`）将超长思考压缩为结构化正向规划（**目标 3K–8K tok，硬上限 12K**），涵盖：美术构图与 PBR 纹理方案 → 部件层级与无悬空尺寸 → 运动方程/循环与镜头 → 离线单文件自查；严禁泄露“给定代码/反推”字样。
2. **多轮 ReAct 局部 CoT 提纯（`scripts/prune_react_cot.py`，待新建）**：
   - 保持每轮 `user` / `tool_result` / 图片引用 / `assistant.tool_calls` / `assistant.content` **逐字节不变**；
   - 仅对单段 `thinking > 3,000 tok` 的轮次做**同轮局部提纯**（压缩至 **2K–6K tok，硬帽 8,192 tok**），严格保留当轮观测依据（报错行号/截图瑕疵）到该轮具体 tool call 的因果链；
   - 采集端加强 `--teacher-guidance` 的轮数与截图硬边界（如修复 ≤15 轮、生成 ≤25 轮、截图读取 ≤10 张），从源头切断 50–80 轮死循环。
3. **权重配置**：沿用已验通的 `thinking=0.5 / content=1.0 / tool_calls=2.0`（保留 `Write.content` 权重对照为后续窄消融选项），全量逐条经 `validate_claude_swift_batch.py`（真实 `ms-swift 4.5.2 + qwen3_8`）通过后方可入训。

---

## 4. 三线并行执行计划

### 阶段 1：基线、诊断与 Canary 验通（Day 0.5）
- **线 A（GPU 评测与诊断）**：
  1. 在旧 dev 复现 `checkpoint-10946` 3 条“正常结束却空答缺 HTML”与 18 条“引用工作区文件”轨迹，定位根因并补入教师/学生公开自检流程；
  2. 补做 `devtest-v2` 与 Aodi 10,697 题面的近重复查重，冻结盲评与容差口径；
  3. 用空闲 GPU 在冻结的 `evals/devtest-v2`（60 题）跑通 **`Qwen3.8-27B 原版` vs `checkpoint-10946` 首次配对基线**，跑完即释卡并留凭据。
- **线 B（新题库 + 10 题 Canary）**：
  1. 构建独立 3D 训练题库（覆盖 4 类 ReAct 任务 + 多题材高审美 One-Shot 题库），跑隔离校验确认与 `devtest-v2` / 旧 holdout 零重叠；
  2. 跑 **10 题 DeepSeek `high` Canary**（5 ReAct + 5 One-Shot），验证：收尾收敛率、离线 `file://` + 11 类检查通过率、CoT 提纯前后长度与结构质量、27B Swift Ready loader 全通；确认无坑后再放开高并发批量生产。
- **线 C（2D / 3D 打印种子评测集）**：
  1. 2D 动画：基于 `evals/visual-agent-v2/fixtures/2d-bounce.html` 确定性时钟与 `check_browser.mjs` 建 10–15 题冻结种子集（`evals/2d-seed-v1/`）；
  2. 3D 打印：基于 CadQuery 参数化 + GLB/3MF 尺寸/水密回读建 10–15 题冻结种子集（`evals/print-seed-v1/`，OpenSCAD 明确标 `N/A`）。

### 阶段 2：批量造数、硬检与封版（Day 1–2）
- 高并发批量跑完池 1（300–400 条通过 ReAct）与池 2（500–800 条通过 One-Shot）；
- 全量自动硬检（`file://` 零报错 + 11 类浏览器/数值检查 + `verify_episode_capture.py` 抓包完整性）+ **10% 随机视觉抽检**（DeepSeek 18790 看图 / Astra 复核）；
- 执行 CoT 提纯、池 3 分层抽样、池 4 前缀合并、分轨 val 切分与 27B Ready 全量模板验收，冻结 `round2-sft-27b-v1` manifest。

### 阶段 3：双臂训练（`M7` 冠军配置）与 `devtest-v2` 终验（Day 2.5–3）
- **主臂 `v2-full`**（四合一全池，~65M tok）：使用 `M7`（`TP4·PP2·DP2 + binpack@65536 + gbs=8 + CUDA causal_conv1d`，`mcore_gdn_cuda_conv1d_plugin.py`（本地附件未发布）），从原版 `Qwen3.8-27B` 训 2–3 epochs（~350–400 步，约 8h），保存 epoch 1 / 2 / 3 ckpt；
- **消融臂 `v2-oneshot-only`**（去掉池 1 ReAct，保留同池 2+3+4 与同超参，约 5h）：直接测量多轮 ReAct 的独立净增量；
- **统一验收**：在 `evals/devtest-v2`（60 题）与 `Aodi 单轮 30 题` 上对比 `原版 27B` / `ckpt-10946` / `v2-oneshot-only` / `v2-full`：
  - 主报 `Accepted@1（3D 动画）`（拆生成/修复/编辑/健康误改率）；
  - 重点核对 `broken_delivery` 与 `no_delivery_html` 失败占比是否断崖式下降，以及单次成功 token/耗时是否收敛。
- 训练与评测结束后按约定核验全部 GPU 清零释放并归档凭据。
