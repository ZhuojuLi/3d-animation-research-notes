> [!WARNING]
> **历史规划快照（已被 `2026-11-27` Revision 3 / Option 2 全面替代，SUPERSEDED）**：本文为 `2026-11-25` Round 3 早期单点打穿草案，其中“剔除 100% Blender (`0%` 混入)、删除 `compact_task`、只留 `180K / 262K` 不开 YaRN、`freeze_vit=true / freeze_aligner=true`、单文件 3D 输出及 CAD/2D `0%` 暂缓”等策略已于 `2026-11-27` 全面撤销并被 **Revision 3 / Option 2**（`Static YaRN 1.5×` 不切分硬训 `384K` XHS 全 401 分片 + `256K` 沙盒 `208000 / 80% / 32768 / 16384` + Blender/Three.js/CAD/2D 四子轨多轮混训）替代。现行口径以 `decisions.md`（本地附件未发布）、[XHS-UNIFIED-SFT-STANDARD.md](../XHS-UNIFIED-SFT-STANDARD.md) 及 Option 2 主方案（[CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md](../../../research/xhs-384k-to-200k-data-adaptation-20261127/CLEANROOM-4MODEL-VERDICT-384K-TRAIN-256K-SERVE.md)、[OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md](../../../research/xhs-384k-to-200k-data-adaptation-20261127/OPTION2-CAD-2D-DATA-EVAL-MIX-MASTER-PLAN.md)）为准。下文保留作 `2026-11-25` 历史审计归档。

# 3D Agent 全链路对齐改造与 Round 3 演进总计划（Big-Picture Plan）

> 公开整理版 · 2026-11-28。保留成文时点的记录；计划、文献结果和本地实测请分别理解。环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

> 制定日期：2026-11-25（已按确认收口为 **纯代码 Three.js 3D 动画单点打穿版**：剔除全部 Blender 数据，CadQuery 与 2D 动画暂缓，等 Three.js 3D 动画彻底打穿后再扩域）  
> 目标基座：`${MODEL_ROOT}/Qwen3.8-27B`（Dense 27B，BF16，16×H800 `ms-swift 4.5.2` Megatron SFT）  
> 核心指导思想：**单点打穿、不贪多嚼不烂。** 严格聚焦 **纯代码 Three.js (WebGL / HTML / JS) 3D 动画与高美感 3D 场景** 这一条主航道——从 Apache-2.0 `3DCodeFactory` 中**只提纯 Three.js 轨、100% 剔除 Blender (`bpy` / `mcp__blender`) 噪声**（论文 Table 2 已证实纯 Blender 数据反而拉低 27B 的 Three.js `P3D-Bench` `-1.94 ~ -2.87` 分），叠加我们自产的物理/数学连续动画、`repair/healthy` 纪律与通用抗遗忘底盘，集中全部火力先打穿 3D 动画！  
> 配套文档：[DATA-PLAYBOOK.md](../DATA-PLAYBOOK.md) · [STANDARD-PARAMS.md](../STANDARD-PARAMS.md) · [3DCodeFactory 一手精读](../../../research/arxiv-2611.28783/README.md) · [Round 2 冻结账本](../../reports/round2-phase2-curation-20261125/FREEZE-REPORT.md) · [Eval v3 历史重评](../../reports/eval-v3-devtest-v2-20261125-001/REPORT.md)

---

## 一、核心诊断：为什么我们必须立刻做一次“减法与对齐”？

翻完 `3DCodeFactory` 真实轨迹并对照我们自己的 `FREEZE-REPORT.md`、`run_claude_cases.py` 与 `launch_v3_node.sh`，4 处根本症结一目了然：

1. **我们自己给教师戴了“紧箍咒”**：`run_claude_cases.py`（本地附件未发布） 把 `healthy_control` 的“零改动停手”和 `generation` 的“高质量精雕”塞进了同一个 `TEACHER_CONVERGENCE_PROMPT`，明文限制 **`at most 8 screenshots`、`at most ONE focused visual repair pass`、`HARD STOP RULE`**。结果同一个 `DeepSeek-V4.1-Flash-1017`，在对方那里主动写 Playwright + `PIL.crop` 做 26–45 轮全景+局部特写精修，在我们这里被催着刚过线就交卷。
2. **Round 2 仍有 65.8% 是单轮静态/直出监督**：Round 2 `v2-full`（95.1M 输入 tok，73.75M 监督 `U`）里，`Pool 3` 无思考 Aodi（37.6%）+ `Pool 2a/2b/5a` 单轮直出（28.1%）合占 **`65.8%`**，真实多轮视觉闭环（`Pool 1 + Pool 5b` 仅 371 条）只占 **`22.4%`**。而 `3DCodeFactory` 在同款 `Qwen3.8-27B` 上已用硬消融证明：203 万条单轮静态数据在 Three.js 上反跌 `-0.63`，多轮视觉迭代过程本身独占 `+11.75` 分。
3. **思维链过度干预的弯路**：我们曾对 `<think>` 做摘要改写引入 Markdown 方案书腔（27B `think_nll` 恶化 `+49.8%`）；实查 `3DCodeFactory` 证明，保留 DeepSeek 原始简短第一人称 `<think>` + 仅屏蔽故障轮，27B 就能直接反超 `Qwen3.8-Max (2.4T)`。
4. **但 `3DCodeFactory` 也有 4 个我们必须避开的坑**：
   - ① **完全未测通用抗遗忘**（纯 3D 裸训 1 epoch，直接上 ModelForge 风险极高）；
   - ② **数据极长且夹杂 40% 摘要样本**：6 分片实查显示 39.7% 是只训最后 1 轮交接总结的 `compact_task`，且 83% 有效轨迹落在 `262K–384K`（硬吃需 YaRN 1.5×，且会推高推理耗时至中位 160 轮 / 374K tok）；
   - ③ **交付形态差异**：均为 `/workspace/output` 多文件相对路径 + `vendor/`，且无连续物理/数学动画、无 CadQuery 工程公差、无显式 `healthy` 防乱改与脏代码定向修复；
   - ④ **原始分片含模板脏字段**：每轮插有中途 `<total_tokens>` `system` 标签且 `loss_mask` 极性与 `ms-swift` 相反。

---

## 二、支柱 1：现成数据复用——`3DCodeFactory`（Apache-2.0）分级清洗与筛选方案

当前正以**纯直连 `hf-mirror.com`（0 字节走 `7890`）**全量落盘 `${WORKSPACE}/datasets/3dcodefactory/`（已 SHA256 验通 24/401 分片、18.97 GB、0 损坏，持续自动续传）。**绝不整库硬灌，严格执行“6 步清洗 + 按现有硬件窗口分层选用”**（工具：`inspect_and_clean_3dcodefactory.py`（本地附件未发布），已对前 21 个就绪分片完成首轮实扫并 100% 通过 `ms-swift 4.5.2` 逐 token 审计）：

> **21 分片实扫关键发现（`${WORKSPACE}/datasets/3dcodefactory/threejs-pilot-scan/`）**：
> - 21 分片共 `1,630` 条记录：`blender: 1,048`（64.3%，**100% 剔除**），`threejs: 582`（35.7%，对应 `114` 道独立 Three.js 任务，外推全库约 `2,175` 道，与官网公布 `2,125` 吻合）。
> - 去 `compact_task` 后保留 `348` 条有效 Three.js 段，按 `--min-turns 15 --min-images 3 --max-est-tokens 262144` 洗出 **`54` 条零拒收**（Tier 1 `<=180K`: **27 条**；Tier 2 `180K–262K`: **27 条**；外推全库 `<=180K` 约 **515 条**、`<=262K` 约 **1,030 条**），同步提取 **`114` 条去重中英 Three.js 题面种子**（`en: 62`, `zh: 52`）。
> - **极其关键的结构发现**：由于原库设了 384K 压缩窗，**所有 `<=262K` 的 Three.js 段全部是 `compact_recovery`**（以 Claude Code 压缩摘要接续开头，专练**多轮看图 → PIL 特写裁剪 → 模块精修 → 干净交付**，而非空目录从零起稿）。因此 **HF Three.js 池 = 最强“视觉精修与美学打磨”弹药**，必须与 **我们自产的“空目录从零生成 + 连续动画 + 单文件内联”轨** 互补配比，绝不能单靠 HF `compact_recovery` 替代从零起稿训练！

### 1. 必做的 6 步标准化清洗（`--backend threejs` 纯代码定向提纯）
1. **100% 剔除 Blender 与 `compact_task`**：流式过滤仅保留 `--backend threejs`（直接跳过占比 ~67% 的 Blender `bpy` 轨迹与 40% 的 `compact_task` 摘要记录，**不落盘任何 Blender 截图**，彻底杜绝 `bpy` / `mcp__blender` 噪声污染纯代码 WebGL 分布）。
2. **剔除过短残尾段**：过滤 `assistant_turns < 15` 或 `image_count < 3` 的尾部收尾碎片（确保每条都是扎实的 Three.js 视觉闭环精修）。
3. **剔除超长段（脚踏实地对齐当前 16×H800 窗口，不一步硬上 384K）**：
   - **Tier 1（立即可用 · 零改训练配置）**：真实 `Qwen3.8` token **`<= 180,224`**（直接匹配当前 `launch_v3_node.sh`（本地附件未发布） `--max_length 180224`！外推全库约 **600–800 条** 纯 Three.js 多轮精修轨迹）。
   - **Tier 2（原生 256K 窗口 · 无需 YaRN）**：`180K < tokens <= 262,144`（Qwen3.8 原生支持 262K，16×H800 开 `CP=2` 即可稳定吃下，把纯 Three.js 精修池扩至 ~1,000+ 条）。
   - **Tier 3（`262K–384K`，先存档暂不硬上）**：待 Round 3 在原生窗口验证显著涨点后，再决定是否做 Phase 3b 开 YaRN 1.5× `384K` 吃满。
4. **模板消毒**：剥离全部 `<total_tokens>` 中途 `system` 标签，合并起始 `system`，确保全对话仅 index 0 一条 `system`。
5. **反极性保掩码**：将 HF `loss_mask=True` 转为 `ms-swift` 的 `"loss": False`，叠加已落地的 P0-1 轮级异常掩码，丢弃终轮异常记录保 EOS 监督。
6. **图片去重外置 + 全量 `ms-swift 4.5.2` 逐 token 审计**：base64 转 `<image>` 落盘去重，100% 跑过 `convert_and_validate_swift_ready.py` 才准入训池。

### 2. 零成本高价值副产品：抽取“去污染中英 Three.js 题库矿”
- 同步从已下载分片中提取去重后的全部中英 Three.js `USER REQUEST` 需求（经 56 叶节点分布对齐 + 四大榜单去污染），直接作为我们自产“单文件内联 + 动态动画 / 图生 3D”的现成高美感种子题库。

---

## 三、支柱 2：Round 3 纯 Three.js 聚焦配比与训练策略对齐

### 1. Round 3 五本账目标配比（纯代码 Three.js 3D 动画单点打穿，CadQuery 与 2D 暂缓）

| 数据模块 | Round 2 占比 (`U`) | **Round 3 目标占比 (`U`)** | 核心定位与作用 |
| --- | :---: | :---: | --- |
| **A. 清洗精选 `3DCodeFactory` 纯 Three.js 多轮视觉闭环池**（**0% Blender**） | 0% | **35%–40%** | 专攻 27B 最大短板：**`visual_craft` 美感、构图曝光、局部特写精修、中英双语 & 图生 Three.js** |
| **B. 自产纯代码 Three.js 差异化多轮 ReAct 池**（连续物理/数学 3D 动画 + 真实 `repair` + `10%–15% healthy` 零改动止损） | 22.4% | **35%–40%** | 守住对方完全空白的护城河：**连续物理/数学仿真、单文件内联交付、脏代码定向修复、健康零改动止损** |
| **C. 精简单轮离线内联 Three.js 锚点**（只留视觉全 `PASS` + 原生思考精品；**大幅砍除无思考 Aodi Pool 3**） | 65.8% | **10%** | 仅作单文件内联语法与直出兜底，彻底消除单轮静态稀释 |
| **D. 通用多轮编码 + 推理抗遗忘池**（SWE Replay + 通用推理保底） | 11.8% | **15%** | **避开 `3DCodeFactory` 最大盲区**，守住 ModelForge 全域通用能力不掉点 |
| *(暂缓)* CadQuery 精密建模 & 2D 动画轨 | 0% | **0%（待 3D 动画打穿后再并轨）** | 保持阶段单点突破，避免多领域同时摊薄数据质量与归因清晰度 |

### 2. 训练超参 & 工程技巧 5 项对齐（基于现有 16×H800 `launch_v3_node.sh`）
1. **保持已对齐的稳健底座**：继续全参 LLM 微调（`--freeze_vit true --freeze_aligner true`）、BF16、`AdamW (0.9, 0.95, wd=0.1, clip_grad=1.0)`、Cosine 衰减、`per_token_loss=true`、分段 `loss_scale`（`0.5/1.0/2.0` + 坏轮 `loss=False`）。
2. **坚持 `1 epoch` 原则防记忆与遗忘**：对齐 `3DCodeFactory`（1 epoch 训完即止），配合更稳的有效 batch size（`global_batch_size 16–32`，LR `5e-6 ~ 1e-5` 消融）。
3. **窗口分步走**：Round 3a 直接用现有 `180K`（或原生 `262K` + `CP=2`，零 YaRN 风险）快速验证大涨点；Round 3b 再评估是否扩 YaRN `384K`。
4. **保留原生 `<think>`，停掉 Markdown 改写**：多轮 ReAct 100% 保留原生第一人称思考 + P0-1 轮级掩坏轮；仅对极少数 `>32K` 超长单轮思考做 27B 原生投影（`student_project_cot.py`（本地附件未发布））并过 NLL 审计。
5. **交付契约显式分桶，避免多文件/单文件互相打架**：`3DCodeFactory` 题面明文要求 `/workspace/output` 多文件，自产动画题面明文要求单文件内联 `output/index.html`——二者按指令各司其职；导出交付一律合入 `chat_template.compat.jinja`（`high -> xhigh`）。

---

## 四、支柱 3：自产造数管线与提示词“化繁为简”改造

**核心原则：拆开互相打架的要求，前端极简放权，后端严格筛选。**

### 1. 提示词彻底解耦为两套极简模板（改造 `run_claude_cases.py`（本地附件未发布））
- **模板 A · 放权精雕轨（用于 `generation`、`img23d`、`cad-build`）**：
  - **彻底删掉 `at most 8 screenshots`、`at most ONE visual repair pass` 和 `HARD STOP RULE`！**
  - 只保留 3 件事：① 干净的离线环境与极简 `TOOLS.md`（零宿主机路径）；② 允许开发期在 `output/src/` 模块化精雕，最后一步执行打包内联出单文件 `output/index.html`；③ 显式点透高质量视觉闭环习惯：**先看全景查曝光/构图/遮挡 → 再用 `PIL.crop` 或拉近镜头查核心机构/材质/文字/轴向特写 → 持续精修到美感、物理运动与几何无硬伤再提交**（软上限放宽至 `45–60` 轮，使单条自然落在 `65K–131K` 黄金窗口，不触发 384K 压缩）。
- **模板 B · 精准维护轨（仅用于 `healthy_control`、`repair`、`local_edit`）**：
  - 保留简洁的“健康对照零改动即停 / 定向修复不改坏原功能”纪律（`16–24` 轮上限），绝不外溢污染生成轨。

### 2. 前置出题 + 后置质检两道关口（轻量复刻 `3DCodeFactory` 最值钱的环节）
- **前置 `P07` 零隐藏考纲审计**：所有自建新题（Three.js 动画 / 图生 3D / CadQuery `print-eval-v2`）在批量调用 DeepSeek 前，先跑一道轻量审计：核查评测器/Rubric 考的每一条硬约束（底面 `Z=0`、部件名、副尺寸、单文件内联、动画循环）是否已 100% 明文写进题面，且补足光影/色调/构图/质感描述。
- **后置 `Best-of-2` 优中选优（复用 `Eval v3`）**：高价值自产生成题按 `N_max=3~4` 收集 2 条通过硬校验的轨迹，用我们自己的 `eval_3d_v3.py`（本地附件未发布）（纯 WebGL 防假动 + 匿名五维评，`effort=low, max_tokens≥12000`）择优取高分那条入库，直接淘汰及格线凑数样本。

---

## 五、分阶段脚踏实地落地路线图（Phase 0 → Phase 3）

| 阶段 | 时间窗口 | 核心动作（只做最高杠杆的事） | 硬验收出口标准（Go/No-Go） |
| --- | :---: | --- | --- |
| **Phase 0（已完成 ✅）** | 今日已完 | ① P0-1 轮级异常掩码上线并过 `ms-swift` 核验；<br>② `Eval v3` 历史重评就位；<br>③ `3DCodeFactory` 纯直连全量下载启动（已验通 13/401 分片）+ 清洗脚本 4/4 过 `ms-swift 4.5.2` | 21+2 单测全绿；真实样本 `misplaced_im_end=0`、`422/422` 轮合规 |
| **Phase 1（立刻启动）** | 24–48h | ① Round 2 训完第一时间 5 分钟跑出 **`Eval v3` 三臂总榜（`Base vs R1 vs R2`）** 摸清底盘；<br>② 给 `inspect_and_clean_3dcodefactory.py` 加 `--min-turns 15 --min-images 3` + 真实 token 统计 + 中英题库提取，先扫已下完分片产出首批 Tier 1 (`<=180K`) 池；<br>③ 改造 `run_claude_cases.py` 拆开“放权精雕”与“健康止损”两套极简提示词，跑 **5 题 DeepSeek 小试**对比 `Eval v3` 分数变化 | ① 拿到 Round 2 真实四轨基线分；<br>② 5 题放权精雕小试在 `Eval v3` 的 `visual_craft` 与总分明显高于旧紧箍咒版，且单条稳控在 `≤131K` |
| **Phase 2（备齐 Round 3 弹药）** | 3–5 天 | ① 按 `3DCodeFactory` 下载进度（达 100–401 分片）批量洗出 **纯 Three.js Tier 1 (`<=180K`) / Tier 2 (`<=256K`)** 池（**0% Blender**）；<br>② 用放权精雕模板 + `P07` 审计 + Best-of-2，集中精造 **200–400 条**纯 Three.js 物理/数学连续动画与复杂 `repair`/`healthy` 多轮轨迹；<br>③ 冻结 **Round 3 纯 Three.js 五本账训练集**（砍除静态 Aodi 稀释，守住 15% 通用抗遗忘）并过全量 `ms-swift 4.5.2` 逐 token 审计 | 全量 `ready.jsonl` 0 Blender 混入、0 宿主机路径泄漏、0 非首条 `system`、0 `misplaced_im_end`、五本账配比落表锁定 |
| **Phase 3（Round 3 训验闭环）** | 1 周后 | ① 16×H800 启动 **Round 3**（原生 `180K` / `262K` 窗口 1 epoch，不冒进改 YaRN）；<br>② 跑满全维验收：`Eval v3`（`devtest-v2` 60 + `holdout-v1` 48）+ ModelForge 通用防遗忘与模板兼容回归；<br>③ **3D 动画彻底打穿后再开启下一阶段**（按需扩展 CadQuery / 2D 动画 / YaRN `384K` / DAgger & RL） | `devtest-v2` 均分与视觉通过率大幅超越 Base 与 Round 2、盲评对战显著占优、ModelForge 通用门控无退化、请求报错率 `0%` |
