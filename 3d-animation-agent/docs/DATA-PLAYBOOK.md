# 3D Agent 造数总守则与 `Qwen3.8-27B` 能力边界手册（Data Playbook）

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> 归档日期：2026-11-25  
> 目标基座：`${MODEL_ROOT}/Qwen3.8-27B`（Dense 27B，BF16，默认主测档位 `reasoning_effort=medium`）  
> 配套规范：[全链路统一参数与避坑规范](STANDARD-PARAMS.md) · [Eval v3 历史重评报告](../reports/eval-v3-devtest-v2-20261125-001/REPORT.md) · [CadQuery Phase 0 摸底报告](../reports/cad-print-seed-baseline-20261125-001/REPORT.md) · [CoT 压缩 NLL 审计](../reports/student-cot-projection-exp-20261125-001/COT-PRUNE-OFFPOLICY-ISSUE.md) · [3D/CAD 基准与数据集边界调研](../../research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md)

---

## 一、`Qwen3.8-27B` 原版基座的真实能力边界（全部基于实跑硬证据）

所有造数决策必须锚定 27B 原版的真实强项与断点——**既不灌 27B 早已稳过的简单题，也不硬灌超出 27B 空间容量天花板的超高难样本**。

### 1. Three.js 3D 动画与交互轨（`devtest-v2` 60 题 + `holdout-v1` test 48 题，Eval v3 实测）

| 能力区间 | 实测表现 | 代表性实测案例与证据 |
| --- | --- | --- |
| **强项（已具备扎实底座）** | • 数学与物理计算极强：数值通过 **`54/60 (90.0%)`**<br>• 单场景几何完整度扎实：`concept_and_geometry = 3.91 / 5.0`（可渲染 46/60）<br>• 可独立产出 88–96 分高质量作品，且 `0/120` 例空答早停 | `v2-collatz-repair` (**96**)、`v2-farey-build` (**92**)、`v2-pascal-build` (**88**)、`v2-crankslider-build/edit` (**88**)、`holdout-galton-repair` (**96**) |
| **核心短板 1：数对图废（最优先提分区）** | **视觉构图质感最低（`3.02 / 5.0`）、真实 3D 运动仅 `3.43 / 5.0`**：数学脚本跑通（`num=True`），但 3D 场景缺失、镜头过远、暗屏黑屏或运动断层，全集视觉通过仅 **`18/60 (30.0%)`**（均分 **`53.07`**） | `v2-ferris-edit` (**24 分**，缺 3D 摩天轮主体)、`v2-fibonacci-compare` (**32 分**，画面极暗主体过小)、`v2-domino-compare/repair` (**40 分**，细线模型/瞬间倒完)、`v2-euclid-repair` (**48 分**，镜头过远难辨) |
| **核心短板 2：长程收敛失控** | **68.3%（41/60）触发 3600s 超时**，但其中 **26 份**已产出可运行 HTML（含多部 84–92 分佳作）——典型“会做但不会看图后干脆收尾”，导致严格 `E2E Clean Pass` 仅 **`8/60 (13.3%)`** | `v2-restitution-build` (**92 分**被超时杀掉)、`v2-pascal-build` (**88 分**)、`v2-crankslider-edit` (**88 分**)、`v2-geartrain-edit` (**84 分**) |
| **核心短板 3：多对象对比与复杂编辑** | 多对象并排 `compare` 与多约束 `edit` 场景易出现构图拥挤、重叠、失焦或改坏原机制；单文件内联约束不稳（`holdout-v1` 27/48 误引用 `./bundle.js`） | `v2-fibonacci-compare`、`v2-domino-compare`、`devtest-v2` `edit` 视觉通过仅 `4/12` |
| **反面教训（Round 1 `ckpt-10946` 为什么退化）** | 首版用 87.9% 无思考 Aodi + `tools=[]` + 0 真实修复训练，在 `devtest-v2` 掉 **`-12.39 分`**（95% CI `[-22.56, -1.56]`），引入 `6/60` 空答早停且 `repair` 视觉通过腰斩（`6/18 → 3/18`） | [Eval v3 报告](../reports/eval-v3-devtest-v2-20261125-001/REPORT.md) |

### 2. CadQuery 参数化 / 3D 打印建模轨（`evals/print-seed-v1` 12 题配对实测）

| 能力区间 | 实测表现 | 代表性实测案例与证据 |
| --- | --- | --- |
| **已饱和区（不必再大量灌水）** | 6–15 面基础单/双件题总通过率 **`9/12 (75.0%)`**，与 DeepSeek 教师打平；`healthy` **`3/3`**（4 轮/68s 零改动停手）、`parametric_edit` **`3/3`**（5–6 轮/63–95s 稳过） | `print-clip-latch-healthy`、`print-heatsink-fin-healthy`、`print-rail-stop-healthy`、`print-enclosure-vent-edit`、`print-gear-hub-edit`、`print-rail-dovetail-edit` |
| **真实短板 1：API 与 OCCT 报错导致轮数爆炸** | 工具报错 **`21 次`（教师的 3.0×）**，集中爆发在 `build`（16 次）与重修复（5 次），`build` 耗时暴涨 **8×–14×**（693–882s），2 题耗光轮数来不及执行 `Read views_grid.png` | `print-bracket-l-build`（25 轮 / 882s / **11 err** / `img=0`）、`print-gear-spur-build`（22 轮 / 693s / **4 err**）、`print-heatsink-mount-repair`（19 轮 / **5 err** / `img=0`） |
| **真实短板 2：3D 坐标平面错位 + 视觉盲区** | 跨工作平面空间推理薄弱，且**看 4 视图渲染图后仍识别不出画反** | `print-clip-cable-repair`（XZ 水平卡鞍画成 XY 竖直圆管，看图未察觉）、`print-enclosure-box-build`（下伸内唇反向挖成盖底凹槽，体积跌至 `38.5K` vs `[43K, 48.5K]`） |
| **27B 甜点区 vs 超纲区** | • **甜点提分区**：**10–40 B-rep 面、1–3 个配合件、含倒角/圆角/抽壳/阵列/非平凡多平面切换**（对应 `BenchCAD` 中等复杂度与 `Zero-To-CAD-100k` 筛选区间）<br>• **明确超纲区（勿硬灌 SFT）**：`>60` 面大型工业装配体、复杂 NURBS/Loft 自由曲面、无参照单步凭空写千行脚本 | [3D/CAD 基准与数据集边界调研](../../research/3d-and-cad-benchmarks-datasets-27b-boundaries-20261125/README.md) |

### 3. 跨家族蒸馏的 Token 级学习边界（27B NLL 实测）

- **代码与工具调用天然贴合**：DeepSeek `1017` 的 HTML/JS/工具调用在 27B 下的 `code/tool_nll` 仅 **`0.14–0.29`**（`NLL > 5` 尾巴仅 `0.10%–0.62%`），属于高质量可迁移监督信号。
- **Off-Policy 风险集中在 `<think>` 槽位**：`<think>` 的 NLL 是代码/工具的 **5×–8×**（原始 `0.70–1.18`）；若用 DeepSeek `content` 改写塞入 Markdown 标题/方案书腔，One-Shot `think_nll` 恶化 **`+49.8%`（`0.70 → 1.05`）**、`NLL > 5` 尾巴飙升 **`2.41×`（`1.60% → 3.86%`）**。

---

## 二、3D Agent 造数八大守则（强约束，全轨通用）

### 守则 1：全量走真实执行沙盒与 `repos-logging-proxy` 抓包，零宿主污染
- **必须**在干净隔离的 Claude Code / 工具沙盒中由教师真实执行“写代码 → 运行渲染 → 看图自检 → 修正 → 收尾”，全量经 `repos-logging-proxy` 落盘，100% 保留真实 `system` prompt、完整工具 schema（绝不 `tools=[]`）与多模态视觉轮次。
- **0 宿主机路径泄漏**：工作区工具脚本与运行回溯严禁包含 `/mnt/disk1`、`${USER_HOME}` 等宿主机路径；导出前强制跑静态与轨迹扫描断言（参考 test_cad_pipeline.py（本地附件未发布） `test_workspace_tools_contain_zero_host_paths`）。

### 守则 2：以 27B 真实能力甜点区定题，拒绝“太水”与“超纲”两头浪费
- **砍掉已饱和简单题**：如 6–15 面基础单件 CadQuery 草图+拉伸、纯基础无动效 Three.js 几何体。
- **拦截超纲题**：单文件复杂到连高思考 DeepSeek 都低通过率、或超 60 B-rep 面的大型 CAD 装配体，不作为 SFT 冷启动主料。
- **精准打击 27B 痛点**：Three.js 聚焦“视觉质感 + 镜头构图 + 真实连贯 3D 运动 + 复杂编辑/修复 + 按时收尾”；CadQuery 聚焦“多平面坐标切换（XY/XZ/YZ）+ 壳体/内唇/倒角/圆角 + OCCT 报错根因修复 + 看 4 视图揪出轴向画反”。

### 守则 3：所有轨迹必须具备“视觉闭环 + 真实缺陷修复 + 健康对照”三元配比
- **真视觉闭环**：轨迹中必须真实调用看图工具观察渲染产物并做出针对性画面/构图/方向修正，杜绝“盲写盲交”。
- **真缺陷修复（Anti-Overfit）**：禁止“全是从零生成”，必须配足从真实故障起步的 `repair`（几何穿模/浮空/黑屏/假动/开口非水密/工作面画反）和 `edit`（局部增改不破坏原功能）轨迹。
- **健康对照样本（Anti-Over-Editing）**：固定保留约 `10%–15%` 已完全健康的样本，训练“检查验证通过后零改动直接收尾”的纪律，防止 SFT 把模型训成“强迫症乱改机器”。

### 守则 4：严格区分“静态规则检查”与“多维视觉盲评”，杜绝假 PASS 与假 WARN
- **不唯脆弱规则**：禁止用极易误杀的脆弱规则（如未写清契约却强查打包方式、或无视纯 WebGL 帧差只看 HUD 变化）一刀切判生死。
- **视觉验收强制硬门控**：入训样本必须通过 [STANDARD-PARAMS.md](STANDARD-PARAMS.md) 定义的视觉与运动验收（DeepSeek `1017`，`reasoning_effort=low`，`max_tokens ≥ 12000`；`ERROR` 独立重试绝不伪装成 `WARN`；明确区分 `PASS` / `real WARN` / `FAIL`，确认 `FAIL` 一律剔除）。
- **题面契约零歧义**：凡依赖自动几何/数值探针的题面，必须显式写清坐标基准（如 `Z=0` 底面）、精确部件命名、离线单文件要求与关键副尺寸，避免误杀正确解法。

### 守则 5：严控单条轨迹收敛性与长度，防止长程发散与超窗截断
- **轮数硬护栏**：教师造数统一使用 [STANDARD-PARAMS.md](STANDARD-PARAMS.md) 轮数上限（Three.js 生成 `≤36`、修/改/健康 `≤24`；CadQuery 生成 `≤24`、修/改 `≤18`、健康 `≤12`），验通后立即收尾。
- **单轮与总长守门**：教师与学生单轮 `max_tokens = 32768`（严禁 `8192` 截断大 HTML）；导出后经 CPU 版 `ms-swift 4.5.2` 全量模板与逐 token 审计（`misplaced_im_end_total == 0`、`labels/loss_scales` 对齐、核查 `>65K / >131K` 长尾）。

### 守则 6：`<think>` 槽位保“学生原生独白风格”，严禁 Markdown 方案书腔
- **禁止污染 `<think>`**：绝不允许把带 `# / ##` 标题、斜体修辞、审阅报告腔的摘要正文塞进 `<think>...</think>`。
- **压缩目标区间**：One-Shot `<think>` 控制在 `3K–8K tokens`（留足复杂题思考容量，不要压死到 `<1K`）；ReAct 仅压缩超长冗余轮次，保留 100% 原始代码与工具调用（SHA-256 逐字节校验）。
- **放量前必跑 NLL 体检**：新批次 CoT 改写/投影（优先 `scripts/student_project_cot.py` 27B 原生投影）放量前必跑 `scripts/audit_student_nll.py`，确认 `think_nll` 与 `think_gt5` 未异常飙升。

### 守则 7：全链路对齐 `Qwen3.8-27B` 的 `medium` 模板分布与 ModelForge 兼容
- SFT 样本默认采用无 `Reasoning effort` 前缀的 `medium` 原生分布（与 `ms-swift` 分段权重 `think=0.5 / content=1.0 / tool_call=2.0 / empty_think=False` 匹配）。
- 导出交付与评测前，统一合入 `chat_template.compat.jinja`（兼容 `low / medium / xhigh / high(=xhigh)`），跑满模板回归测试，避免 ModelForge 400 事故。

### 守则 8：严守数据卫生与“五本账”反遗忘原则
- **Eval 零污染**：`devtest-v2`、`holdout-v1`、`print-seed-v1` 及任何公开 OOD 测评子集（如 `BenchCAD`、`BlenderWorld`、`P3D-Bench`）严禁以任何形式进入训练集，入库前做题面与代码去重。
- **配比看五本账**：调整域内/通用混合比例时，不能只看记录条数，必须核对“记录数、输入 token、监督位置 U、加权和 W、实际 loss reduction”（见 [配比与 loss 五本账](../../research/3d-agent-sft-mix-loss-20261123/README.md)），并保留高质量通用/推理数据防能力遗忘。
- **大数据集存储纪律**：外部大数据集一律落盘 `${WORKSPACE}/datasets/`（2.8T 可用），严禁写入 `/` 或 `/tmp`。

---

## 三、分轨道现阶段造数与迭代路线

| 轨道 | 当前状态 | 下一阶段最高性价比动作 |
| --- | --- | --- |
| **Three.js 3D 动画主轨** | Round 2 `round2-sft-27b-v3` 正在训练；`Eval v3` 已就位 | 1. 训完后第一时间跑 `Eval v3` 对比 `Base vs Round 1 vs Round 2` 四轨成绩单；<br>2. 针对 Round 2 仍丢分的 3D 视觉质感、多对象 `compare/edit` 和高难 `repair` 做定向教师扩产 + `student_project_cot` 提纯；<br>3. 随后切入 **学生访问状态纠偏（DAgger）+ 视觉/可验证奖励 RL** |
| **图生 3D / 参考图驱动建模轨** | 已在 Round 2 池 2 纳入首轮视觉驱动样本 | 吸收参考图锚点 + 隐式多维 Rubric 验证范式，扩产高保真图生 Three.js/Blender 程序化重建与多轮看图自纠错轨迹 |
| **CadQuery 参数化建模轨** | Phase 0 闭环已打通、工具 0 宿主机路径泄漏已修净 | 1. 用 `BenchCAD` 20–30 题（15–35 面，纯 OOD 不入训）+ `print-eval-v2` 二次标定 27B 真实掉分区；<br>2. 基于 Apache-2.0 `Zero-To-CAD-100k` 筛选多样性种子，精造 300–500 条“多平面/抽壳/倒角/视觉自查修反”高纯度 ReAct 轨迹 |
| **2D 动画辅助轨** | 保持轻量复用既有数据与验证流水线 | 控制在低占比防稀释，核心算力聚焦 3D 视觉质感、多轮自纠错与收敛性提分 |
