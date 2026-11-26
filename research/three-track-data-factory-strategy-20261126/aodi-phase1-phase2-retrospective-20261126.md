# Aodi（Code2Video）Phase 1 / Phase 2 实验与我方三轨实测并表复盘

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

> 记录日期：2026-11-26  
> 复盘对象：
> - Aodi 复盘原文：`${REFERENCE_DATA}/code2video/docs/sft-lora-data-and-lessons-summary.md`（本地附件未发布）
> - Aodi `3DCodeFactory` 转换源码：`${REFERENCE_DATA}/code2video/tools/qa_and_pack/prepare_3dcodefactory_swift.py`（本地附件未发布）
> - 对照我方证据：[三轨数据工厂与分类树联合审核汇总](README.md) · [Astra 独立审核](astra-report.md) · `Round 2 / 9B 实证总汇报`（本地附件未发布） · [3DCodeFactory 一手精读](../arxiv-2611.28783/README.md) · [3DCodeVerse 精读](../arxiv-2610.22341/README.md)
>
> 边界声明：本记录为纯文档与源码复盘，未运行额外训练、推理或下载；涉及对方 Phase 2 风险的判断结合了源码逐行核查与我方 9B 消融/Astra 217 分片实扫结果。

---

## 一、Aodi Phase 1 实验最值得吸收的 4 项硬成果

| 维度 | Aodi 实测结果与做法 | 对我方三轨计划的直接复用价值 |
| --- | --- | --- |
| **1. 高秩 LoRA (`r=64`) 2.5h 刷新单轮新高** | 单机 `gpu57`（8×H100）仅训 **2h 30m 11s**（`r=64, α=128, dropout=0.05, all-linear`, `lr=5e-5→5e-6`, `GBS=16`, `2.0 ep`；`1,687` 视觉精洗垂直 + `750` 通用锚点）：<br>• Classic-30 浏览器技术通过率达 **`28/30 (93.3%)`**（超越我方 Round 2 全参 `26/30`、Round 1 `24/30`、Base 无上限 `22/30`、旧全参 `step-900` `21/30`、官方 `3DCodeVerse-LoRA` `23/30`）；<br>• `xhigh` 平均输出从 Base `59.75K` 暴压 **85%** 至 **`8.76K tok/题`**，42 题 **100% 闭合零截断**；<br>• 分布外 **`2d_anim` 4/4 全零报错 + 全动效**，VLM 均分 **`5.83 → 7.10 (+1.27)`**。 | 证明 27B 扩展 2D 动画收益极高；验证高质精洗 + 短思考在单轮底盘上的极高性价比。 |
| **2. 第一人称零泄漏 `<think>` 压缩** | 严禁 `reference / original / provided / copy / rewrite` 等泄露词，压至 ~1,600–4,200 词第一人称独白，消除 24K/40K 截断且无画风污染。 | 与我方此前“Markdown 报告腔改写致 27B `think_nll +49.8%`”形成鲜明对照；可直接用于我方 **≤7% `U` One-Shot 锚点池**（多轮 ReAct 仍保留原生简短 `<think>`）。 |
| **3. 单机 8 卡 27B LoRA 的 GDN 并行铁律** | 源码与实测确认 `mcore-bridge 1.6.2` 下 `qwen3_5` GDN 开 LoRA **必须 `TP=1`**（`TP>1` 必因 `in_proj_qkv` 2560 维度冲突崩溃），且 `gated_delta_net.py` 原生完整支持 Ulysses **`CP>1`**（单机 8×H100 40K 用 `TP1/PP2/DP4`；128K 多模态用 `TP1/PP2/CP4`）。 | 让我方 Step 5 **「小规模三轨干扰探针」** 可以直接在单机 `gpu57`（8×H100）用 `r=64` LoRA 几小时跑完 27B 快速排雷，不必每次等 16×H800 全参。 |
| **4. 现成可共享数据与工具资产** | ① `phase1-general-anchor-v1`（750 train + 40 val，覆盖 `coding 180 / agent_swe 150 / math 230 / json 35 / qa 195`）：在 `r=64` 2ep 下守住通用 `10/12 strict · 11/12 tolerant`（与 Base 持平，0/20 HTML 污染）；<br>② 自产 1,556 条磁盘完整保留 `turn1/scene.html → turn1/render/{mid,strip}.png → VLM 缺陷反馈 → turn2/scene.html`；<br>③ 已拉完 `bespoke-manim`（1,000 条渲染验证动画）、`CodePen-25k`、`CCORE-Web-Designs`、`third_party/{P3D-Bench, BlenderWorld, 3DCodeBench}`；<br>④ `claude -p --bare` + vLLM 修复模板（`effort: "max" → xhigh`）。 | ① 直接参考/复用 5 域均衡通用锚点补齐我方通用池，防 ModelForge 偏科；<br>② 回收 `turn1→render→turn2` 自修轨迹，并借 `bespoke-manim` / `CodePen-25k` 作 2D 动画树题源灵感；<br>③ 复用 `P3D-Bench` / `BlenderWorld` 公开评测代码库。 |

---

## 二、双方实验并表后共同印证的 3 条铁律

1. **纯单轮盲写 3D 存在硬物理天花板**：
   - Aodi `ckpt-305` 把技术通过推到 **`28/30 (93.3%)`**，但 3D 复杂场景 VLM 均分仍停在 **`5.3–6.1`**，肉眼仍常见部件悬空/穿模/构图瑕疵；
   - 我方 Round 2 `v3_e2` 刷到 `26/30 (86.7%)`，却因单轮占 `65.8% × 2ep` 把多轮拖成首轮空想 6.7 万字符超时；
   - 两边从完全不同路线共同复现了 `3DCodeFactory` Table S8 结论：**单轮只能解决“跑通语法”，空间几何、防穿模与审美精修必须靠多轮看图自修闭环。**
2. **Three.js 运行契约的隐式默认习惯极易引发跨栈翻车**：
   - Aodi 踩到：测试 Prompt 未提 `importmap` 时，模型直链 `OrbitControls.js` 内部裸 `from 'three'` 导致 `3d_anim` 3/4 挂掉；
   - 我方踩到：混入小红书 `importmap + http.server` 导致 `9B-3DCF-Mix` 离线内联率 `20/30 → 7/30`、硬检查 `5/30 → 0/30`；
   - 本质一致：CDN `importmap`、本地多文件 `http.server`、离线单文件 `esbuild` 三种交付契约必须在训练与无标签测试中显式对齐或隔离。
3. **通用防遗忘必须做多域分层锚点，而非只靠单一 SWE**：
   - Aodi 的 5 域分层（`coding / agent_swe / math / json / qa`，占比 ~30.8%）在 2 epoch 高秩 LoRA 下证明了通用 0 退化；我方 Round 4 三轨联训的通用回放池应从纯 SWE 升级为同款多域均衡池。

---

## 三、我方实测帮 Aodi Phase 2 提前排出的 4 个高危暗坑（建议同步对齐）

经逐行核查 `prepare_3dcodefactory_swift.py`（本地附件未发布） 并对照我方 `9B-Ctrl vs 9B-3DCF-Mix`（30 题最终成绩）与 Astra 217 分片全扫结果，Aodi 的 Phase 2 计划存在 **4 个高危隐患**：

### 1. 最高危：`prepare_3dcodefactory_swift.py` Mode B 滑窗切分会制造“无 EOS 截断 + 上下文断层幻觉”
- **源码实据（L321–L360）**：默认 `--window-chars 260000` / `--max-images-per-window 24`，把一条 300K+ 轨迹硬切成 `w0, w1, w2...`，每窗仅保留开头 `anchor_user` 就直接拼入中后段 `Edit` 与看图。
- **双重风险**：
  1. **非末尾窗（`w0, w1...`）全部无自然 EOS 收尾**：与我方 `9B-3DCF-Mix`（93.9% 无尾 prefix 切片）导致**超时率 `7/30 → 11/30 (36.7%)`、硬检查 `5/30 → 0/30`** 为同一机理；
  2. **中间窗（`w1, w2...`）丢失前几十轮已建文件历史**：模型看到“刚拿到原题 → 凭空 `Edit` 从未在上下文出现的文件和行号”，形成非自洽上下文，易诱导幻觉编辑。
- **叠加事实**：Astra 对 217 分片全量 tokenizer 实扫已证实，未切完整 Three.js 主轨迹仅 3 条且仅文本就 **302K–350K tok**（180K/262K 窗内为 **0 条**）。
- **建议替代**：优先采用 **L2 路线**（直接抽取小红书 217 分片里的 **`1,128` Three.js 题面 + `944` 张唯一参考图**，在我方/Aodi 统一沙盒中用 2–3 轮拼图硬停重造 40K–130K **完整从零到自然 EOS** 轨迹），并回收 Aodi 已落盘的 1,556 条完整 `turn1→render→turn2` 短视觉自修闭环。

### 2. `--tracks threejs,blender` 默认混入 64.5% Blender 数据 + 弱关键词轨道分类
- 若 Phase 2 目标是 Three.js / 2D 网页动效，混入 64.5% Blender `bpy` 会吃掉近 2/3 训练预算，且与 WebGL/CadQuery 栈无关；
- `classify_track()`（L45–L63）仅扫描前 35 条消息的 `"three"/"index.html"/".js"` 关键词，按我方 P0-5 审计经验，易把含 `TOOLS.md` 的 Blender 记录或 `main-agent` 审图子任务误放进 `threejs` 池，需先硬排除 `bpy`/`blender-mcp`/审图子任务。

### 3. Phase 2 再度大比例混入单轮，易重演我方 Round 2 `v3_e2` 的“单轮涨、多轮空想超时”
- Aodi 计划把 3,826 条旧 Legacy 头部 + 精选高工艺单轮与多轮轨迹混训。我方 Round 2 `v3_e2`（65.8% 单轮 × 2ep）已实测证明：单轮虽涨到 `26/30`，但多轮 `dev-12` 出现首轮不调工具空想 6.7 万字符、`0/10` 干净 EOS、10/10 超时。
- **建议**：Phase 2 若目标是多轮 Agent，单轮占比必须按**有效监督 token `U`**（而非条数）压至 `≤10%`，且优先验证 `1 epoch`。

### 4. 合规边界与 300 GB 重复下载浪费
- **许可合规**：Aodi 计划在 Visual-DPO 混入 `3DCodeVerse-2M-finetune`（含 2,357 对 CadQuery 几何 DPO），但据 [3DCodeVerse 精读](../arxiv-2610.22341/README.md) 核实，其数据卡为 **CC BY-NC-SA 4.0（非商业研究）**，对外商用/上线模型须审慎排除；
- **合并共享 401 分片**：我方 `${WORKSPACE}/datasets/3dcodefactory/` 已校验 `217/401` 片（167.5 GB），Aodi 侧 `${REFERENCE_DATA}/code2video/datasets/3DCodeFactory-qwen-sft-6414/` 已下 `180+/401` 片，双方完全可以按 `SHA256SUMS` 互补合并共享一份，立省一半下载时间与近 300 GB 存储。

---

## 四、对我方三轨总方案的 3 项即时增量升级与协作分工

1. **Step 5 干扰探针降本提速**：除 9B 排协议错外，直接使用 Aodi 已验通的 **`gpu57` 单机 8×H100 + `r=64` LoRA (`TP1/PP2/CP4`, 128K)** 在 27B 上几小时跑完小规模三轨干扰探针，过门禁后再上 16×H800 全参（叠加我方 `M7/M2+` + CUDA `causal_conv1d` 插件）。
2. **通用防遗忘与 2D 素材借力**：我方候选五本账中的 **`13% U` 通用锚点**参考/复用 Aodi 的 5 域均衡池（`phase1-general-anchor-v1`）；2D 动画树参考 Aodi 已落盘的 `bespoke-manim`、`CodePen-25k` 及 `turn1→render→turn2` 自修素材；**`7% U` 单轮锚点**采用 Aodi 验证通过的零泄漏第一人称 `<think>` 压缩。
3. **团队互补分工建议**：
   - **Aodi 侧优势**：高审美 Three.js 场景 + 单轮 `28/30` 保底 + 2D 视觉自修 + Visual-DPO + `gpu57` 高秩 LoRA 快验；
   - **我方侧优势**：连续物理/机械 3D 动画 + CadQuery 3D 打印树（12 核心族 + BenchCAD OOD）+ 2D 确定性验收器（Canvas+SVG）+ 已过 Astra 联检的 `P07 / Best-of-2 / 轮级坏轮掩码` 管线 + 16×H800 全参效率基线；
   - **统一收口**：共享同一份 401 分片与 L2 抽出的 `944` 图 + `1,128` 题矿，最后按五本账统一合训并在 `devtest-v2 / P3D-Bench / BlenderWorld / BenchCAD / 2D / ModelForge` 上同口径联合验收。
