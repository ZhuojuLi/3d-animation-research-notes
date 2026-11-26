# 论文精读：BlenderFORGE: Framework for Optimizing Reactive 3D-Graphics Editing Ability of MLLMs（arXiv:2611.10768v1）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*BlenderFORGE: Framework for Optimizing Reactive 3D-Graphics Editing Ability of MLLMs*（2026-11-07）
- **作者与机构**：Zilin Guo\*, Tianrui Zhang\*, Yi Rong\*（香港科技大学 HKUST）；Yichen Liu, Yuxin Guo, Jingcheng Ni, Lewei Lu, Zehuan Wu（商汤研究院 SenseTime Research）；Dan Xu（HKUST）
- **原文与代码**：`https://arxiv.org/abs/2611.10768v1` · 主页：`https://sensetime-fvg.github.io/BlenderFORGE/` · 代码仓：`https://github.com/SenseTime-FVG/BlenderFORGE`
- **本地归档**：[paper.html（上游原文）](https://arxiv.org/abs/2611.10768) · [paper.txt（上游原文）](https://arxiv.org/abs/2611.10768) · `sources.json`（本地校验清单未发布）
- **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者发现的真实痛点

现有程序化 3D 图形编辑系统（如 `BlenderAlchemy`、`BlenderGym`、`SceneCraft`）普遍依赖闭源大模型在推理期做多轮采样搜索（Test-Time Scaling），缺乏确定性、状态可验证的闭环沙盒将交互经验内化进开源权重。作者横评 9 款闭源旗舰与 6 款开源 MLLM（Table 1 & Appendix C.1 Fig. 6）后，揭示了零样本 3D 编辑智能体普遍倒退（多项指标甚至**差于不改代码的 `w/o change` 基线**）的两大核心病灶：

1. **跨视角 3D 空间接地失效（Inaccurate Multi-View 3D Grounding）**：
   - 模型无法将对齐相机下的起止渲染差异准确换算到 Blender 全局静态世界坐标系（而非相机局部视角坐标系）。
   - 典型失败（Appendix C.1 Fig. 6）：`Gemini-3.0` 只抓最显眼的旋转却漏掉平移，甚至在同一轮计划中自相矛盾地“一边显示物体局部坐标轴一边旋转 180°”；即便最强的 `GPT-5.2` 也只能靠多轮盲猜试错（Trial-and-Error）逼近目标位姿。
2. **长上下文交互漂移与“未渲染先脑补”幻觉（Interaction-Context Drift）**：
   - 随着工具回执与预览图堆积，模型在仍有明显几何残差时提前终止，或遗忘初始目标；
   - 严重工具幻觉：**`Gemini-3.0` 在根本未调用 `blender_preview_renderer` 的情况下，直接在推理中假装已看到最新预览图并据此继续瞎改**（Appendix C.1）。

---

## 2. 方法论、数学公式与沙盒/验证器工程细节（含 Appendix 关键配置与 Prompt 要点）

### 2.1 四大状态可验证扰动造数管线与相机几何约束（Sec 3.1–3.2 & Appendix B.2）
将编辑形式化为最小化起止相对变换残差 $\min_{\{a_k\}_{k=0}^{K-1}} d\!\left(\mathcal{T}(s_s, x_K),\, \mathcal{T}(s_s, s_g)\right)$，构建 **9,000 训练 + 800 测试** 样本（Placement / Lighting / Material 按唯一资产 ID 严格 Train/Test 隔离；Shape-Key 存在部分基础网格跨集共享）：

| 任务族（训练 / 测试题数） | 底层资产与扰动参数范围 | 相机布置公式与可见性/确定性过滤规则（Appendix B.2） |
| --- | --- | --- |
| **Object Placement**（`3,000 / 200`，Table 6） | 1,000 个 `3D-FRONT` 场景；水平平移比 $[0.05, 0.3]$，竖直 $[0.0, 0.3]$，偏航角 $[0, \pi)$；移动 `1` 或 `≤2` 物体 × `2–5` 视角（6 组混合复杂度） | **双态可行域求交** $\Omega_i = \Omega_i^s \cap \Omega_i^g$（移动前后均可见且无碰撞，高度比 $0.3\text{–}0.8$）；贪心覆盖 $\max_{|V|=N_v}\sum_{i\in\mathcal{M}}\mathbb{I}[\mathrm{cov}(i,V)\ge\eta]+\lambda\,\mathrm{div}(V)$；**死锁 $\mathrm{FOV}=\frac{7\pi}{18}$（$70^\circ$）禁放宽广角** |
| **Shape-Key Editing**（`2,000 / 200`，Table 8） | 54 个资产（409 可变键），`Qwen3-14B` 重命名扩增 $>4,000$ 变体；修改键最小变化量固定 $\ge 0.5$ | 预定义机位；按 `{1, ≤2} 实际修改键 × {≤3, ≤6} Prompt 暴露键` 分 4 组（各 500 训 / 50 测）；光度可见性过滤 $\mathrm{PL}\ge \tau_0=10^{-3}$ |
| **Lighting Adjustment**（`2,000 / 200`，Table 9） | 226 个 `Infinigen` 场景；最多改 3 盏灯：纯色通道偏移 $0.9$（1,000/100）+ 能量倍率 $[10, 100]\times$（1,000/100） | 固定 3 视角，距离比 $[0.05, 0.3]D$、高度比 $[0.1, 0.9]$；分层贪心 $S(c\mid V)=w_1\mathrm{cov}(c,\mathcal{L}_\Delta)+w_2\mathrm{cov}(c,\mathcal{L})+w_3\mathrm{dist}(c,V)$（$w_1\gg w_2\gg w_3$）；FOV 允许沿 $[\frac{7\pi}{18},\frac{\pi}{2},\dots,\frac{7\pi}{9}]$ 阶梯放宽 |
| **Material Modification**（`2,000 / 200`，Table 7） | 固化随机参数的 28 类 `Infinigen` 材质（1,500/150：单参 1000 / 多参 500）+ `Principled BSDF`（500/50：单参 250 / 多参 250） | 除 $\tau_0=10^{-3}$ 可见性过滤外，**额外执行重复渲染确定性校验 $\tau_1 = 5\times 10^{-4}$**，直接剔除含着色器随机噪点的不稳定样本 |

### 2.2 实例隔离 `Blender Sandbox` 防崩架构与 Prompt 规范（Appendix A & B.1）
- **双层 Client-Server 与四态崩溃自愈（Fig. 5）**：外层 `Sandbox Manager` 守护协程维护 `Inactive → Running → Killing → Reinitializing → Running` 状态机，Agent 写出恶意/非法 `bpy` 触发 Blender 段错误（Segfault）或超时时自动杀进程重拉，保障连续 10 天 RL 零人工值守中断。
- **渲染子进程硬隔离 + 正则过滤（Tables 4–5）**：
  - 内层 `BlenderHTTP` 提供 `POST /exec`（主线程执行 `bpy` + **正则安全过滤器拦截场景重置与私自渲染**）、`POST /preview` 与 `GET /scene_info`（导出位姿/灯光/形态键/材质 JSON）；
  - `/preview` 先将实时场景存为临时文件，再拉起**独立无头 Blender 子进程**按死锁参数渲染（`Cycles GPU`、128 samples / 8 bounces、Adaptive `0.2`、禁反射/折射焦散、开降噪、`$512\times 512$` 8-bit PNG）——**既防渲染崩溃污染主会话状态，又彻底封死 Agent 篡改渲染配置刷奖励的漏洞**。
- **评估与训练统一 Prompt 模板要点（Appendix B.1）**：
  ```xml
  <!-- System: 限定仅通过 blender_code_executor / blender_preview_renderer 修改目标属性，输出 <think> + Hermes XML -->
  <tool_call>
  {"name": "<function-name>", "arguments": <args-json-object>}
  </tool_call>
  <!-- User: [initial scene JSON；特例：Material 任务因 Infinigen API 超出预训练知识，直接传入构建初始场景的完整 bpy 脚本！]
       随后对每个可用相机 [CameraName] 成对交替给出 starting scene <image> 与同机位 goal scene <image> -->
  ```

### 2.3 部件感知距离、进度归一化奖励与 `SFT (36:1 锚点) + AgentLoop-RL (GSPO)`（Sec 3.4–3.5）
每场景通过插件采样 30,000 表面点计算部件感知倒角距离 `P-CD`（防止大体积家具淹没小部件误差），并对负向劣化编辑截断归零：
$$
\text{P-CD}(s_i, s_j) = \frac{1}{|\mathcal{P}|}\sum_{k=1}^{|\mathcal{P}|}\text{CD}(s_i^k, s_j^k), \qquad
\mathrm{PS}_D(s_m;\, s_s, s_g) = \mathrm{clip}\!\left(\frac{D(s_s,s_g)-D(s_m,s_g)}{\max(D(s_s,s_g),\epsilon)},\, 0,\, 1\right)
$$
1. **Stage 1 冷启动 SFT**：
   - 冻结视觉编码器与多模态 Projector，仅微调语言模型；
   - 先在 `GPT-5.2` 教师采集并按任务奖励指标过滤的四族混合轨迹上训 `Trajectory-SFT`；
   - 随后按 **`36 : 1`（通用数据 : 轨迹数据）** 混合续训 **240 步 `General-SFT`**，包含三类防遗忘锚点：① 辅助状态进度判别 VQA $\mathbb{I}(D(s_c,s_g)<D(s_s,s_g))$、② 函数调用格式样本、③ 通用编程题。
2. **Stage 2 `AgentLoop-RL`（`GSPO` 序列级策略优化）**：
   - 将含推理与工具调用的整轮输出视为宏动作，终态标量奖励结合任务进度 $r_{\mathrm{prog}}(s_m)$ 与有界可执行性探索信号 $\mathcal{A}(\tau)\in[0,1]$（有效调工具且产生可测状态迁移才给分）：
$$
r(\tau) = (1 - \lambda_{\mathrm{act}})\, r_{\mathrm{prog}}(s_m) + \lambda_{\mathrm{act}}\, \mathcal{A}(\tau), \qquad 0 \le \lambda_{\mathrm{act}} \ll 1
$$
   - 各族绑定最高信噪比验证信号：Placement 用几何进度（`P-CD`），Shape-Key 用 `scene-state + visual`，Lighting 与 Material 用多视角视觉进度（`PL / N-CLIP`）。

---

## 3. 实验设置、完整超参数表与核心结果/负向消融（严格区分论文事实与分母）

> **分母与统计口径核查（论文事实）**：每族 200 题（共 800 题）。Table 1 中**因 API 超时或服务端报错中断的 episode 同时从分子与分母剔除**（部分闭源模型实评数 $<200$），但模型写错 `bpy` 代码允许在轮次内自修；Table 2 消融表严格固定每行 $N=200$。`PL` 与 `N-CLIP` 单位均为 $\times 10^{-3}$（越低越好）。

### 3.1 训练超参数与算力账单（Sec 4.1 & Appendix G Table 15）

| 阶段 | 框架与硬件分配 | 学习率 / 正则 | Batch / 序列与轮数上限 | 耗时与算力账单（8B 实测） |
| --- | --- | --- | --- | --- |
| **数据生成** | 2× RTX 5090 (32G) + 16 核 / 256G RAM | — | 9,000 训 + 800 测（中间文件约 2TB） | 24 小时（`48` GPU-hours） |
| **Stage 1: SFT** | `ms-swift`，8× RTX 5090 + 64 核 / 1TB RAM | `LR = 1e-5` | `BS = 64`；`General-SFT` `240` steps (`36:1`) | 8 小时（`64` GPU-hours） |
| **Stage 2: RL** | `VeRL/HybridFlow` + **`GSPO`**，8×5090 训 + ≤8×5090 沙盒渲染 | `LR = 1e-6`, **`KL = 0`** | `BS = 2`, `max_ctx = 32,768`, 最大交互 **$T = 8$ 轮** | **10 天**（`1,920` 训练 + `≤1,920` 沙盒 GPU-h） |

### 3.2 主实验结果完整对照表（Table 1 核心模型）

| 模型 | Placement PL↓ / N-CLIP↓ | Placement SR@.1 / .3 / **.5**↑ / Med↓ | Shape PL↓ / SR@.5↑ / Med↓ | Lighting PL↓ / N-CLIP↓ | Material PL↓ / N-CLIP↓ |
| --- | :---: | :---: | :---: | :---: | :---: |
| *w/o change（零操作基线）* | 6.4 / 23.5 | 0.00 / 0.00 / **0.00** / 1.00 | 5.2 / 0.00 / 1.00 | 43.8 / 38.2 | 16.0 / 76.0 |
| *GPT-5.2（闭源榜首 & 教师）* | **4.4 / 15.9** | **27.06 / 50.43 / 62.76 / 0.39** | **3.2 / 39.27 / 0.71** | **6.6 / 16.3** | 7.1 / 34.1 |
| *Claude-Sonnet-4.6* | 5.9 / 21.8 | 10.00 / 25.00 / **32.50** / 0.91 | 3.6 / 35.00 / 0.87 | 6.9 / 18.3 | **4.6** / 35.2 |
| *Gemini-3-Pro* | 6.4 / 23.6 | 9.53 / 25.02 / **36.69** / 0.83 | 4.4 / 27.50 / 1.18 | 15.3 / 23.8 | 29.2 / 46.0 |
| *Gemini-3-Flash* | 5.8 / 22.1 | 6.00 / 21.50 / **35.50** / 0.96 | 3.6 / 36.50 / 0.85 | 12.7 / 25.8 | 24.4 / 49.4 |
| *Qwen3.5-Plus* | 6.0 / 23.7 | 5.78 / 16.40 / **25.48** / 1.47 | 4.3 / 30.50 / 0.99 | 20.6 / 31.1 | 9.9 / 44.3 |
| *GLM-4.6V (106B 开源)* | 9.6 / 29.9 | 2.00 / 7.00 / **9.50** / 2.63 | 5.5 / 24.00 / 1.12 | 30.4 / 31.6 | 8.1 / 44.0 |
| *Llama4-Maverick (400B 开源)* | 11.0 / 32.6 | 0.50 / 1.00 / **1.00** / 1.18 | 5.3 / 9.60 / 1.00 | 48.4 / 43.3 | 23.2 / 82.9 |
| `Qwen3-VL-8B-Thinking` (Base) | 18.8 / 57.1 | 0.00 / 1.50 / **1.50** / 21.31 | 6.1 / 12.00 / 1.31 | 43.0 / 37.7 | 23.9 / 70.5 |
| **`Qwen3-VL-8B` (BlenderFORGE)** | **6.1 / 22.5** | **8.50 / 24.00 / 36.00 / 0.78** | **4.7 / 20.00 / 1.07** | **17.1 / 25.4** | **12.7 / 53.6** |
| `Qwen3.5-9B` (Base) | 7.8 / 30.0 | 0.50 / 1.50 / **3.00** / 1.00 | 8.4 / 6.00 / 1.00 | 36.1 / 39.9 | 16.9 / 54.8 |
| **`Qwen3.5-9B` (BlenderFORGE)** | **5.7 / 20.5** | **15.50 / 29.50 / 40.00 / 0.73** | **5.1 / 27.50 / 1.00** | **7.3 / 19.8** | **7.8 / 34.0** |

### 3.3 关键阶段消融与负向发现（Table 2：`Qwen3-VL-8B` Placement，$N=200$）

| 训练阶段配置 | PL↓ | N-CLIP↓ | SR@.1↑ | SR@.3↑ | **SR@.5↑** | Med↓ | 平均交互轮数 | 论文现象与负向归因 |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | --- |
| Base（未微调） | 18.8 | 57.1 | 0.00 | 1.50 | **1.50** | 21.31 | 9.29 | 乱改崩溃，中位残差恶化至 `21.31` |
| 仅 `AgentLoop-RL`（跳过 SFT） | 10.6 | 33.3 | 2.00 | 5.00 | **8.50** | 1.64 | 10.08 | 缺代码编辑先验，探索停留在低水平 |
| 仅 `Trajectory-SFT` | 6.5 | 24.1 | 4.50 | 13.00 | **24.00** | 1.00 | 8.01 | 建立多轮看图改 `bpy` 基础闭环 |
| `Traj-SFT` + `General-SFT` | 6.9 | 24.0 | 6.50 | 17.50 | **25.50** | 1.01 | **5.76** | 通用锚点压缩 `-28%` 无效试错轮数 |
| ⚠️ **`Traj-SFT` + `RL`（砍掉 General-SFT）** | 6.5 | 24.9 | 3.00 | 14.00 | **21.00** | 1.03 | **10.63** | **倒退 `-3.0 pp`！轮数暴涨至 `10.63`，指令与进度判断漂移引发刷轮** |
| **`Traj-SFT` + `General-SFT` + `RL`（全量）** | **6.1** | **22.5** | **8.50** | **24.00** | **36.00** | **0.78** | 6.49 | **跃升 `+10.5 pp`，精准高效收敛** |

### 3.4 Appendix 跨榜迁移、全才 vs 专才与指标效度核验（Tables 3, 10, 11, 13, 14）

| 评估维度（Appendix 出处） | 核心定量对比数据 | 工程含义 |
| --- | --- | --- |
| **`BlenderGym` 零样本迁移**（`Qwen3.5-9B`，Table 3） | Placement `SR@.5`: `20.00% → 36.00%`；Shape-Key `SR@.5`: `10.26% → 17.95%`；Lighting `PL`: `52.6 → 19.0` | 真实迁移（Material 因旧版 `bpy` API 不兼容排除） |
| **四族混训全才 vs 单族专才**（`Qwen3.5-9B`，Table 11） | **11/16 项指标全才胜出**（Placement `40.00% vs 38.50%`，Shape `27.50% vs 20.50%`）；仅 Material 专才更强（`PL 4.9 vs 7.8`） | 跨族几何与视觉接地正迁移，仅私有着色器需专项强化 |
| **`Imagine-OOD` 盲评偏好**（`GPT-5.5` 双向盲评，Table 13） | 160 对总计：**SFT+RL 胜 `108` : Base 胜 `18` : 平 `34`（6:1 碾压）**；Placement `T+I` 达 `17 : 0 : 3` | 人工自然语言指令 + 生成参考图下语义满足度显著跃升 |
| **纯文本相机重取景 OOD**（20 题 × 3 次，Table 10） | 合法率 `13.3% → 35.0%`（8B）、`10.0% → 35.0%`（9B），但平均光轴角误差仍达 `142.8° / 143.0°` | 无目标渲染图锚定的纯文本自由运镜仍是未解硬骨头 |
| **指标与 `GPT-5.5` 评分相关性**（$N=800$，Table 14） | Placement 上 **`P-CD` $\rho=-0.504$，而像素 `PL` 仅 $\rho=-0.186$**；Shape `N-CLIP` $\rho=-0.605$；Material `N-CLIP` $\rho=-0.669$ | **铁证为何几何位移任务绝不能用像素 MSE 当主 RL 奖励** |

---

## 4. 作者踩坑复盘与对我们 Qwen3.8-27B 三轨项目的落地启发（明确标注工程推论）

1. **【论文实证大坑 → 窄域轨迹 SFT 后裸上 `KL=0` RL 必退化，必须配通用与进度判别锚点】**：
   - 论文事实：Table 2 实锤砍掉 `General-SFT` 会让 RL 掉点 `-3.0 pp` 且轮数膨胀至 `10.63`。
   - *【我方工程推论】*：我们在 `Qwen3.8-27B` 上衔接小红书 `3DCodeFactory` SFT 底座做后续 RL 时，**严禁只用纯 3D/CAD 轨迹微调后直接裸跑零 KL 强化学习**；必须按五本账保留通用编码/工具格式锚点，并利用多轮轨迹中间截图免费构造“状态 $s_c$ 是否比初态 $s_s$ 更接近目标”的对比 VQA 守住视觉自检能力。
2. **【论文实证机制 → 预览渲染子进程隔离 + 死锁渲染参数防 Reward Hacking】**：
   - 论文事实：`/preview` 独立子进程 + `/exec` 正则禁重置，封死了 Agent 靠改相机/曝光刷低像素误差的后门。
   - *【我方工程推论】*：直接对齐我方 Track 1（Three.js）与 Track 2（2D Web `renderAt(t)`）验收沙盒——**所有评测截图与帧差计算必须在只读挂载产物的外部独立无头浏览器中按固定视口/时间戳执行**，绝不采信工作区自存图片。
3. **【论文实证指标效度 → 几何任务用部件级 3D 距离，外观任务用感知距离】**：
   - 论文事实：Placement 上 `PL` 相关性仅 `-0.186` 而部件感知 `P-CD` 达 `-0.504`。
   - *【我方工程推论】*：我方 Track 3（CadQuery 2.6.1 多零件装配）的 RL 奖励与 Best-of-2 筛选必须以 **按零件 `parts/*.py` 拆分的 `STEP` 体素 IoU、质心/孔轴探针与两两布尔交集零干涉** 为主信号，避免大外壳体积掩盖小卡扣/齿轮的致命错位。
