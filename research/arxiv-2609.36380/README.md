# 论文精读：LEGO-Anything: Coding Agents for 3D Scene Reconstruction（arXiv:2609.36380v1）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*LEGO-Anything: Coding Agents for 3D Scene Reconstruction*（2026-09-28）
- **作者与机构**：Xirui Li（马里兰大学 UMD College Park & AWS）；Peng Shi, Mingwen Dong, Sheng Zhang, Zhuoyan Xu, Dongkyu Lee, Shuaichen Chang, Yi Xiang, Lin Pan, Jiarong Jiang（AWS）
- **原文与主页**：`https://arxiv.org/abs/2609.36380v1` · 项目主页：`https://lego-anything.com`
- **本地归档**：[paper.html（上游原文）](https://arxiv.org/abs/2609.36380) · [paper.txt（上游原文）](https://arxiv.org/abs/2609.36380) · `sources.json`（本地校验清单未发布）
- **关联总报告**：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心问题与作者发现的真实痛点

作者将单图 3D 场景重建定义为 `Image-to-Code` 闭环编码问题，并在基于 `LychSim` 仿真器构建的 **`LEGO-Bench`（8 大环境、17 主题、104 逻辑场景、208 张自然风格 RGB 输入、443 个合规注册资产）** 上系统解剖了 6 款 `GPT-5.6 / GPT-6` 编码智能体（`Codex` Harness + `Blender 5.0.1` + `Blender-MCP`）的完整构建轨迹，用详实数据揭示了多轮视觉编码 Agent 的 **三大结构性病灶**：

1. **“文件合法交付”与“几何/关节真实还原”鸿沟巨大**：
   - 6 款编码 Agent 的产物合法率 `Validity` 均达 **`97.0%–100.0%`**，但最强 `GPT-6-astra` 室内/室外总分仅 **`53.4% / 39.6%`**，`GPT-5.6` 系列仅 **`11.5%–15.4%`**；
   - 在评测场景级可动关节还原（Articulation Pilot，14 个可动目标 + 12 个静态对照，Appendix B.4）时，**得分直接为 `0.0`**！
2. **轨迹高度非单调退化——`29.6%` 的中间编辑在倒扣分！（Sec 5.1 & Appendix B.2）**：
   - 重评轨迹中每一个可渲染检查点发现，`GPT-5.6-sol` 耗费约 `1/5` 预算才建出首个可评场景（`GPT-6-astra` 仅需 `1/10`），留给视觉精修的预算被严重挤压；
   - 后续编辑频繁破坏已有几何、相机或灯光：**`GPT-5.6-sol` 有 `29.6%` 的编辑步导致分数下降，最终提交版比自身轨迹中的历史最佳中间态倒退 `3.2` 分**；连最强 `GPT-6-astra` 在复杂卧室场景末期也会发生断崖式劣化（Appendix Fig. 12）。
3. **VLM 自评与互评在 3D 几何上全线低于随机瞎猜（`45.8% vs 45.4%` < `50%`！）**：
   - 在 6 款模型两两组成的 **`36` 组 Builder–Judge 矩阵（`360` 对检查点、`2,160` 次盲评，Table 8）** 上，**自评对几何 `Reconstruction` 涨跌方向的一致率仅为 `45.8%`，跨模型互评仅为 `45.4%`**（外观 `Appearance` 为 `62.2%` vs `63.9%`），证明通用 VLM 凭肉眼对比渲染图根本无法可靠判断 3D 几何进退！

---

## 2. 方法论、数学公式与沙盒/验证器工程细节（含 Appendix 关键配置与 Prompt 要点）

### 2.1 `LEGO-Bench` 三轴分离评测与关节诊断精确数学公式（Sec 4.2, Appendix B.4, D & E）
仿真坐标经 $\mathbf{p}_B=\mathbf{D}\mathbf{p}_U/100,\;\mathbf{R}_B=\mathbf{D}\mathbf{R}_U\mathbf{D}$ 转为右手系 $+Z$ 向上米制（$\mathbf{D}=\mathrm{diag}(1,-1,1)$），同族场景满足嵌套难度 $\mathcal{O}_E\subset\mathcal{O}_M\subset\mathcal{O}_H$（建筑/相机/灯光与共享物体变换严格锁死）：
- **产物级合法性 $V_i \in \{0, 1\}$（Appendix E.1）**：**只验磁盘产物，不信进程退出码**——须同时交付含至少 1 个网格与活动相机的可重载 `scene.blend`、非空 `scene.glb`、可解码非退化 `final.png` 且完成主指标评估（超时但留下合法产物仍计有效；干净退出但缺件记 `0`）。
- **零配准可见表面几何重建分 $R_i$（`No-Alignment Per-Object F@5%`，Eq. 2 & Appendix E.2）**：**不做任何 ICP 配准、尺度拟合或匈牙利匹配**——在提交活动相机下光栅化可见表面（上限 `100,000` 点）投回参考像素平面，直接按**私有真值实例掩码 $M_o$** 切分预测点集 $P_o$ 与真值深度反投影点集 $G_o$，采用深度比例容差 $\tau(g)=0.05\,z(g)$（变体 `F@2%` / `F@10%`），记 $g^\star(p)=\arg\min_{g\in G_o}\|p-g\|_2$：
$$
\mathrm{Rec}_o = \frac{1}{|G_o|}\sum_{g\in G_o}\mathbf{1}\!\left[\min_{p\in P_o}\|g-p\|_2 \le 0.05\,z(g)\right], \qquad
\mathrm{Prec}_o = \frac{1}{|P_o|}\sum_{p\in P_o}\mathbf{1}\!\left[\|p - g^\star(p)\|_2 \le 0.05\,z(g^\star(p))\right]
$$
$$
F_{i,o} = \frac{2\,\mathrm{Prec}_{i,o}\,\mathrm{Rec}_{i,o}}{\mathrm{Prec}_{i,o}+\mathrm{Rec}_{i,o}}, \qquad
R_i = \frac{1}{|\mathcal{O}_i|}\sum_{o\in\mathcal{O}_i} F_{i,o}
$$
- **评测器重渲染外观分 $A_i$、总分 $S$ 与关节诊断公式（Eqs. 3–4, 6）**：**弃用 Agent 自交的 `final.png`**，固定引擎与分辨率重渲染 `scene.blend` 得 8-bit sRGB 图 $\hat{I}_i$，取三通道最大绝对误差 $\le \delta = 30$（`0–255`）的像素占比（240 样本 / 960 区域双盲人评在 $\varepsilon=0.05$ 平局阈值下兼容一致率达 **`83.7%`**）；关节真值（Table 7）经 15 轮人工审核覆盖全部 443 资产（368 静态 + 75 可动 / 327 关节：75 连续、55 旋转、197 移动）：
$$
A_i = \frac{1}{|\Omega_i|}\sum_{u\in\Omega_i}\mathbf{1}\!\left[\left\|\hat{I}_i(u) - I_i(u)\right\|_\infty \le 30\right], \quad
S = \frac{1}{N}\sum_{i=1}^N \frac{1}{2}(R_i + A_i)\cdot V_i, \quad
S_{\mathrm{Art}}^{\mathrm{pilot}} = \frac{2C}{2C + O + P + J + 2W + E}
$$

### 2.2 `LEGO-Plugin` 免训练三大模块、12 项确定性残差与事务回滚逻辑（Sec 5.2 & Appendix G.1–G.6）
插件仅读取公开单张输入图（**零私有真值泄漏**），与 `Blender-MCP` 并行挂载：
1. **Enhanced Initialization（`VGGT` 几何初始化，Appendix G.3）**：由 `VGGT` 估计重力对齐 $+Z$ 向上曼哈顿房间框与相机并装入验证过的房间壳体；输出含每个可见物体**归一化投影质心、投影跨度、相对/序数深度与可见性标记**的构建计划（主动规避不可靠的单目绝对米制尺度）。
2. **Grounded Refinement（`SAM 3` + `Depth Anything V2` 确定性残差核验，Appendix G.5）**：对命名对象返回 `pass / fail / unknown`，核验 **12 项显式残差**：存在性、变换与尺寸合法性、支撑、包含、碰撞、朝向、重复布局、相机可见性、**投影质心与跨度（对照 `SAM 3` 掩码）**、**参考相对深度与深度前后序（对照 `Depth Anything V2`）**、渲染亮度。**防过期机制**：后续任何场景改动立即使旧核验报告失效（`stale`）！
3. **Transactional Version Control（事务写保护与强制回滚状态机，Appendix G.4 & G.6）**：
   - **前置快照与写保护**：每次编辑须开启事务，声明 `可编辑实体`、`受保护实体`、`允许变更类型` 与 `硬性准入要求`，自动快照变换/网格/材质/层级/可见性/相机/渲染配置；**凡改动受保护或未声明实体当场拒绝**！
   - **提交与回滚判定**：仅当产生非空允许变更且**所有硬性要求全部返回 `pass`**（`fail` 或缺证据 `unknown` 均拦截）时才提交；单候选最多给 **2 轮修正机会**，否则**删除新增实体并完整恢复快照回滚**。单题硬上限：**最多 8 个事务、最多 2 次回滚**；运行时 Hook 在存在过期核验、未决事务或未审阅渲染图时**强行拦截结束动作**。
- **盲评裁判 Prompt 模板（Appendix F.3）**：
  ```text
  You are a blind evaluator of a rendered 3D reconstruction. Image 1 is the original reference. Image 2 is candidate A (left) and image 3 is candidate B (right)...
  Reconstruction: Which candidate better matches the reference geometry? Judge camera/viewpoint, object presence, layout, scale, shape, silhouette, and occlusion. Ignore color, material, texture, and lighting as much as possible.
  Appearance: Which candidate better matches the reference appearance? ... Choose exactly one of: left, right, tie, or both_bad.
  ```

---

## 3. 实验设置、完整超参数表与核心结果/负向消融（严格区分论文事实与分母）

> **分母与部署核查（论文事实）**：① 主实验在隔离 `Harbor` Docker 环境（`Blender 5.0.1` + `Xvfb` + `Blender-MCP`，`model_provider=amazon-bedrock`）每配置独立跑 **3 次报均值(标准差)**，**一切崩溃或评估失败尝试均留在分母记 `0` 分**；② 难度分层表（Table 4）剔除了无配对的 10 张 NYC 鸟瞰压力图；③ `LEGO-World`（Tables 5 & 9）因冻结场景无检测置信度，统一赋**等置信度 `1.0`** 保持 100 图官方分母计算 AP。

### 3.1 `LEGO-Bench` 全模型主榜（Table 3）、鸟瞰 `F@2%` 压力集（Table 6）与 `LEGO-Plugin` 增益

| 模型 / 基线系统 | Indoor `V`↑ | Indoor `R`↑ | Indoor `A`↑ | **Indoor `S`↑** | Outdoor `V`↑ | Outdoor `R`↑ | Outdoor `A`↑ | **Outdoor `S`↑** | Bird's-Eye `S` (`F@2%`) | Office `+LEGO-Plugin` 相对增益 |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | --- |
| **`GPT-6-astra` + Codex** | **100.0** *(0.0)* | 52.4 *(1.1)* | **54.4** *(0.7)* | **53.4** *(0.8)* | 98.0 *(1.0)* | 34.0 *(1.5)* | **45.5** *(0.5)* | **39.6** *(0.8)* | **35.3** (`R=24.0`) | **`+2.1%`** *(Low→XHigh: `32.3→61.8`)* |
| `GPT-6-sol` + Codex | 99.4 *(1.1)* | 22.2 *(2.4)* | 42.5 *(0.3)* | 32.3 *(1.0)* | **99.7** *(0.6)* | 19.8 *(1.0)* | 28.7 *(0.5)* | 24.2 *(0.4)* | 28.9 (`R=17.8`) | **`+12.1%`** *(Low→XHigh: `21.3→39.7`)* |
| `GPT-6-luna` + Codex | 99.7 *(0.5)* | 15.8 *(1.2)* | 30.5 *(0.3)* | 23.2 *(0.7)* | **99.7** *(0.6)* | 13.2 *(0.6)* | 21.4 *(0.5)* | 17.3 *(0.5)* | 20.0 (`R=6.7`) | **`+27.5%`** *(Low→XHigh: `14.4→21.2`)* |
| `GPT-5.6-sol` + Codex | 97.8 *(2.3)* | 9.8 *(2.1)* | 19.8 *(0.6)* | 14.8 *(1.0)* | 98.7 *(0.6)* | 12.8 *(1.8)* | 17.7 *(0.4)* | 15.3 *(0.8)* | 16.4 (`R=11.2`) | **`+55%–62.7%`** *(如 `0.109→0.278`)* |
| `GPT-5.6-terra` + Codex | 99.7 *(0.5)* | 9.5 *(1.0)* | 21.3 *(0.5)* | 15.4 *(0.6)* | 98.0 *(1.7)* | 8.1 *(0.7)* | 15.0 *(0.9)* | 11.5 *(0.4)* | 10.7 (`R=0.9`) | **`+55%–62.7%`** *(推理强度无单调增益)* |
| `GPT-5.6-luna` + Codex | 99.1 *(0.0)* | 10.2 *(2.1)* | 18.0 *(0.7)* | 14.1 *(1.3)* | 97.0 *(1.0)* | 7.8 *(1.5)* | 16.6 *(0.8)* | 12.1 *(1.0)* | 11.4 (`R=7.6`) | **`+55%–62.7%`** *(绝对涨 `+7~8` 分)* |
| `VIGA` / `SceneConductor` | 100.0 / 12.3 | 10.8 / 5.0 | 20.3 / 0.0 | 15.6 / 0.3 | 100.0 / — | 8.0 / — | 17.1 / — | 12.6 / — | — | 专用 Agent 泛化与交付稳定性受限 |
| `Gen3DSR` | 92.0 *(1.1)* | **65.4** *(0.7)* | 0.0 *(0.0)* | 30.1 *(0.4)* | 80.0 *(1.0)* | **35.0** *(0.5)* | 0.0 *(0.0)* | 14.0 *(0.1)* | — | 固定网格输出，`A=0` 且不可编程编辑 |
| `3D-RE-GEN` / `REST3D` / `SceneGen` | 100 / 77.5 / 71.6 | 1.2 / 7.2 / 9.7 | 11.3 / 0.0 / 0.0 | 6.3 / 2.8 / 3.4 | — / — / 38.7 | — / — / 2.6 | — / — / 0.0 | — / — / 0.5 | — | 传统管线跨场景泛化极弱 |

### 3.2 `36` 组自评/互评完整矩阵（Appendix F.3 Table 8，每格 60 对，`R% / A%`，对角线加粗为自评）

| 构建者 \ 裁判 | `GPT-6-astra` | `GPT-6-sol` | `GPT-6-luna` | `GPT-5.6-sol` | `GPT-5.6-terra` | `GPT-5.6-luna` |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| `GPT-6-astra` | **61.7 / 76.7** | 51.7 / 78.3 | 50.0 / 83.3 | 58.3 / 86.7 | 51.7 / 76.7 | 53.3 / 78.3 |
| `GPT-6-sol` | 45.0 / 75.0 | **45.0 / 78.3** | 46.7 / 76.7 | 43.3 / 75.0 | 48.3 / 81.7 | 45.0 / 63.3 |
| `GPT-6-luna` | 51.7 / 71.7 | 56.7 / 76.7 | **43.3 / 66.7** | 46.7 / 71.7 | 41.7 / 70.0 | 41.7 / 65.0 |
| `GPT-5.6-sol` | 41.7 / 48.3 | 45.0 / 60.0 | 38.3 / 53.3 | **46.7 / 48.3** | 46.7 / 55.0 | 46.7 / 46.7 |
| `GPT-5.6-terra` | 45.0 / 58.3 | 40.0 / 66.7 | 36.7 / 56.7 | 40.0 / 70.0 | **43.3 / 65.0** | 43.3 / 55.0 |
| `GPT-5.6-luna` | 41.7 / 51.7 | 43.3 / 46.7 | 45.0 / 35.0 | 35.0 / 43.3 | 41.7 / 41.7 | **35.0 / 38.3** |

### 3.3 复杂度分层（Table 4）、关节零分诊断（Appendix B.4）与 `LEGO-World` 视觉读出（Tables 5 & 9）

| 评估专题 | 关键定量数据（含显式分母） | 核心结论 |
| --- | --- | --- |
| **复杂度分层**（Easy → Med → Hard，Table 4） | 全模型均 `V=99.5%` 不变；Indoor `R`: `23.3 → 19.7 → 18.8`，Outdoor `R`: **`18.4 → 14.2 → 12.7`** | 物体增多不伤代码合法率，但室外远景几何召回急剧衰减 |
| **场景级可动关节试点**（Office 14 可动 + 12 静态，Appendix B.4） | 补齐 100% 人工验证 URDF 真值后，冻结提交得分仍为 **`S_Art^pilot = 0.0`** | 现有编码 Agent 只会拼静态外观，完全未恢复功能性关节结构 |
| **`LEGO-World` 自然图读出**（`GPT-6-astra` 无插件，Tables 5 & 9） | COCO 框 `AP`: **`30.14`** vs `DINO` `59.88` *(94/100 产出, 93 配对)*；LVIS 掩码 `AP`: **`14.75`** vs `SAM 3` `53.96` *(94/100)*；ETH3D `AbsRel`↓: **`0.1554`** vs `DA3` `0.0785` *(99/100)* | 零训练支持三大视觉读出（达专用检测器一半 AP），但几何精度仍差一倍 |

---

## 4. 作者踩坑复盘与对我们 Qwen3.8-27B 三轨项目的落地启发（明确标注工程推论）

1. **【论文实证头号铁律 → 严禁靠 VLM 肉眼对比渲染图做 3D 几何进退裁判（`45.8%` 低于抛硬币！）】**：
   - 论文事实：Table 8 横扫 6 款 GPT 模型的 2,160 次盲评铁证，VLM 看外观尚有 `62%–64%` 方向感，看 3D 几何纯属瞎猜。
   - *【我方工程推论】*：在我方 Track 3（CadQuery 2.6.1 参数化与装配体）与 Track 1（Three.js 图生 3D）中，**所有几何与空间对齐反馈必须由确定性探针产出数值残差**（如 `STEP` 包络尺寸/体积差、两两布尔干涉体积、`SAM/Depth` 2D 投影质心与跨度残差），VLM 裁判只审美学风格、材质光影与语义完整性！
2. **【论文实证工程神技 → 免训练“事务级写保护 + 硬检不过自动回滚 + 禁过期收工 Hook”根治 `29.6%` 降分编辑】**：
   - 论文事实：`LEGO-Plugin` 对弱模型暴涨 `+62.7%` 的核心秘密在于锁死已完成的房间/相机/合格零件不被后续 `Edit` 改坏。
   - *【我方工程推论】*：我们的 `Qwen3.8-27B` 学生在跑 50–150 轮多文件工程（`src/*.js` / `parts/*.py`）时同样面临后期越改越崩的风险——**直接在推理与采样脚手架加一层轻量事务快照与收工拦截 Hook**：每次 `Edit` 后跑毫秒级硬检，破坏已锁定模块或硬检连续 2 轮不过立即回滚快照；只要代码改动后尚未重新截图/硬检（`stale`），Hook 直接拒绝 EOS 结束！
3. **【论文实证空白区 → 可动关节功能装配（Articulation `0.0` 分）正是我方差异化王牌】**：
   - *【我方工程推论】*：通用 Agent 在场景级关节还原拿 `0` 分，恰恰凸显我方 Track 1（暴露 `__3D_STATE__` 与 `renderAt(t)` 真实关节运动）与 Track 3（2–6 件带显式配合间隙的齿轮/铰链/滑块功能装配体）的高壁垒价值。
