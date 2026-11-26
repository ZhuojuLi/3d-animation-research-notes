# 论文精读：IterCAD: An Iterative Multimodal Agent for Visually-Grounded CAD Generation and Editing（arXiv:2606.13368v3）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*IterCAD: An Iterative Multimodal Agent for Visually-Grounded CAD Generation and Editing*
- **作者**：Tao Hu, Jiaxin Ai, Licheng Wen, Xueheng Li, ..., Botian Shi, Xuemeng Yang（Shanghai AI Lab, USTC, SII 等）
- **原文**：`https://arxiv.org/html/2606.13368v3` · 本地原件：[paper.html（上游原文）](https://arxiv.org/abs/2606.13368) · 纯文本：[paper.txt（上游原文）](https://arxiv.org/abs/2606.13368) · 元数据与校验：`sources.json`（本地校验清单未发布）
- **整理日期**：2026-11-27 · 关联总报告：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

---

## 1. 核心痛点与“Look and Loop”闭环协议（§1–§3.1 & Appendix F）

`IterCAD` 面向工业参数化 **CadQuery** 代码的多轮生成与编辑（涵盖工程图转代码 `Drawing-to-Code`、文本转代码 `Text-to-Code`、局部指令编辑 `Interactive Editing` 三类任务，与我方 **Track 2/3 CAD 赛道**完全同构），直击三大后训练瓶颈：
1. **浅层反馈致盲搜**：纯编译器报错看不见拓扑与尺寸错误，纯全局点云距离无法定位具体草图参数。`IterCAD` 沙盒调用 **OCCT 内核**将每轮生成的三维实体实时投影为**带线性外包尺寸与圆弧半径标注的标准正交多视图**作为多模态观察 $\mathcal{F}_t$（Appendix D Table 7 证实：在 RL rollout 中拔掉多视图反馈会使 Mean CD 从 `5.09` 恶化至 `8.42`！）。
2. **纠错 SFT 几何精度反退化，而朴素多轮 RL 诱发“一轮早停偷懒”**（Table 5 & Fig. 8）：加入教师纠偏轨迹虽能把报错率压到 `0.80%`，但 Mean CD 从 `10.55` 反升至 `12.44`；直接上序列级 GSPO 又会因后期改坏连坐早期好前缀，逼得模型平均轮数从 `3.08` 坍缩至 `2.51`。
3. **评测幸存者偏差**：传统只统计可编译子集的 Mean CD，使高崩溃率模型虚高；作者提出全集分母的 **`CD-TR` 曲线与 `AUC-TR`**（Appendix C.5：编译失败记 `final_cd = -1` 恒计 0 召回，在 $x = -\log_{10}\tau \in [1, 5]$ 即 $\tau \in [10^{-5}, 10^{-1}]$ 取 `401` 个对数等距点梯形积分并除以区间长 `4` 归一化至 $[0,1]$）。

### Appendix F 原始训练与评测 System Prompt 拆解（Fig. 14）
```text
Role: You are an expert CAD engineer and Python programmer specialized in CadQuery...
Output Format: Always start with <thinking> and output one of the following:
1. Structure <thinking> strictly based on inputs:
   - If no feedback (initial turn): [Requirement Analysis] -> [Plan: origin, workplanes, sketch sequence, Booleans, dimensions]
   - If feedback/errors provided:   [Feedback Analysis: compilation errors / missing geometry] -> [Modification Plan: targeted local edits + what existing code MUST be preserved]
   - Always conclude <thinking> with: [Precision Check: verify numerical values and confirm all 2D profiles are closed before extrusion]
   Then output </thinking> followed by ```python import cadquery as cq ... r = ... ```
2. If feedback explicitly confirms the 3D model is correct with no remaining issues: <thinking>...</thinking> then <DONE>.
Hard Rules: Assign final solid to `r`; NEVER use `.scale()` (multiply dimensions explicitly); close all 2D profiles; NO `show_object()`; preserve unaffected geometry on local edits.
```

---

## 2. 二阶段渐进纠错造数 + GSPO + 几何可行前缀掩码（GVPM）

### 2.1 二阶段渐进式 SFT 数据构造细节（§3.2–§3.3 & Appendix B, C.1）
- **底层三类种子对**：① `Drawing-Code`：从基础草图挤出 $\mathcal{P}_{\mathrm{base}}$ 与工业高阶特征 $\mathcal{P}_{\mathrm{adv}}$（`fillet / chamfer / shell / array`）随机采样算子子集约束 `GPT-5` 写 CadQuery，经无头沙盒去自交与非流形后导出 `STEP`，再用 **SolidWorks COM 接口**自动渲染带标注工程三视图 $\mathcal{V}_{\mathrm{ref}}$；② `Text-Code`：规范化 `Text2CAD` 描述并筛 $CD < 10^{-5}$；③ `Edit-Code`：对正确脚本施加受控退化（参数微扰、顶点偏移、特征替换）构造 $(\mathcal{C}_{\mathrm{src}}, \mathcal{T}_{\mathrm{ref}}, \mathcal{C}_{\mathrm{tgt}})$（测试集 `IterCAD-Edit` 200 题则由 Fusion 360 建模历史提取，且全集与训练集最小归一化 $CD \ge 1.10$ 零泄漏）。
- **Stage 1 专家冷启动库 $\mathcal{D}_{S1}$（`20K` 条）**：用 `Qwen3-VL-235B-A22B-Instruct` 在沙盒内多轮交互直至 `<DONE>`，过三道硬筛：① 严格 `<thinking>+代码块/<DONE>` 格式；② **`GPT-5` 逻辑一致性过滤**（剔除思考链与实际代码/反馈矛盾的伪推理）；③ 终态 $CD < 10^{-5}$。
- **Stage 2 在线错例教师接管库 $\mathcal{D}_{S2}$（`8K` 条）**：先训出 $\pi_{\theta_{S1}}$ 在沙盒真实 rollout，暴露学生自身的语法崩坏、未闭合轮廓与尺寸偏差，再由强教师在原报错/偏差状态上接管生成局部修复轮，合并 $\mathcal{D}_{S1}\cup\mathcal{D}_{S2}$（共 `28K`）合训。

### 2.2 复合几何奖励与 GVPM 算法细节（§3.3 Eq. 2–6）
在 `2K` 道高难 `Drawing-to-Code` 题上运行序列级长度归一化 **GSPO**（非对称裁剪 $\mathrm{clip}(\rho_g(\theta), 1-\epsilon_l, 1+\epsilon_h), \epsilon_l < \epsilon_h$）：
1. **三项复合奖励（Eq. 4–5）**：$R(y) = R_{\mathrm{CD}}(y) + \lambda_f R_{\mathrm{fmt}}(y) + \lambda_p R_{\mathrm{prog}}(y)$，其中 $\lambda_f = 0.5, \lambda_p = 0.2$：
   - $R_{\mathrm{CD}} \in [0,1]$：$CD \le \delta_{\min}$ 得 `1`，$(\delta_{\min}, \delta_{\max})$ 内线性插值 $\frac{\delta_{\max}-CD}{\delta_{\max}-\delta_{\min}}$，$CD \ge \delta_{\max}$ 或报错得 `0`；
   - $R_{\mathrm{fmt}} \in \{0,1\}$：每轮严格含 `<thinking>` + 可解析代码块且以 `<DONE>` 正常收尾得 `1`；
   - $R_{\mathrm{prog}} \in \{0,1\}$（防刷分进展奖）：须**同时满足** ① 至少 2 个可执行轮、② 首轮即产出合法实体、③ 跨轮 $CD$ **严格单调下降**并收敛至质量门限 $\eta$ 以下。
2. **几何可行前缀掩码（GVPM，Eq. 6）**：扫描轨迹轮次 $\tau \in \{1, \dots, T\}$，定位最早退化边界 $f = \min(f_{\mathrm{exec}}, f_{\mathrm{stall}})$（窗口 $K=2$）：
   - **执行级联崩溃 $f_{\mathrm{exec}}$**：首次出现连续 $K=2$ 轮沙盒运行/编译异常的起始轮；
   - **几何停滞打转 $f_{\mathrm{stall}}$**：首次出现连续 $K=2$ 轮代码合法但 $CD$ 未严格下降（且仍 $>\eta$）的停滞轮。
   - **双重信用保护**：① 对 $\tau(u) \ge f$ 的后缀模型 token 置零损失掩码 $m_u = \mathbb{1}[\tau(u) < f]$；② 若触发了后缀截断且存在合法前缀（$1 < f \le T$），将该轨迹组相对优势**单侧非负截断** $\hat{A}_g \leftarrow \max(\hat{A}_g, 0)$，确保早期正确建模基座可被正向激励、绝不因后续倒角/抽壳失手而遭负梯度误杀！

---

## 3. `ms-swift` 训练配置、全量消融与高难败因剖析（§4 & Appendix C–D）

### 3.1 `ms-swift` 训练配置表（严格区分原文披露值与框架标准补齐项）

| 配置维度 | 原文明确披露值（§3.3, §4.1, Appendix C.2） | 原文未显式写出项 / 对接我方 `ms-swift` 标准值 |
|---|---|---|
| **基座与基础设施** | `Qwen3.5-4B` 原生多模态，**`ms-swift`** 框架，`8 × NVIDIA A100` | 我方统一为 `Qwen3.8-27B` BF16 全参（`--model_type qwen3_5 --template qwen3_8`，默认放开 LLM / 冻结或低 LR ViT，`MAX_PIXELS=401408`） |
| **渐进式 SFT 阶段** | $\mathcal{D}_{S1}(20\text{K}) \cup \mathcal{D}_{S2}(8\text{K}) = 28\text{K}$，`lr = 1e-5`，`3 epochs` | 我方 27B 严守 **`1 Epoch`**（防 2+ Epoch 过拟合退化）+ 5 规则轮级 `"loss": False` |
| **GSPO + GVPM 阶段** | `2K` Hard Drawing 题，$G = 8$，最大轮数 $T = 5$，`lr = 1e-6`，$\lambda_f=0.5, \lambda_p=0.2$，$K=2$ | 原文仅写 $\epsilon_l < \epsilon_h$ 未给具体常数；按 `ms-swift` GSPO 原论文（`2507.18071`）序列级标准取 $\epsilon_l = 3\times 10^{-4}, \epsilon_h = 4\times 10^{-4}$，采样 `temp=1.0` |

### 3.2 核心消融与难度分层全表（Table 1, 5, 6, 7；`IterCAD-Draw` 采用 Pass@2 口径，CD $\times 10^3$）

| 模型 / 消融变体 | 全集 IR (%) ↓ | 全集 AUC-TR ↑ | 全集 Mean CD ↓ | 平均轮数 | Hard 子集 IR ↓ / AUC-TR ↑ |
|---|---:|---:|---:|---:|---:|
| `GPT-5`（闭源前沿，5 轮沙盒闭环对照） | 5.30 | 0.51 | 8.68 | 3.35 | 9.40% / 0.38 |
| `Qwen3.5-4B` Base（单轮直出 / 5 轮闭环） | 95.30 / 64.60 | 0.03 / 0.24 | 9.22 / 10.48 | 1.00 / 4.56 | 90.40% / 0.05（闭环） |
| `+ SFT_1`（仅 `20K` 专家轨迹 $\mathcal{D}_{S1}$） | 7.50 | 0.52 | 10.55 | 2.23 | — |
| `+ SFT_2`（`28K` 含学生错例纠偏 $\mathcal{D}_{S1}\cup\mathcal{D}_{S2}$） | 0.80 | 0.52 | **12.44**（精度反退化） | 3.08 | — |
| `+ GSPO`（无 GVPM 保护） | **1.30**（反弹） | 0.58 | 8.00 | **2.51**（偷懒早停） | — |
| **`+ GSPO + GVPM`（完整 IterCAD）** | **0.30** | **0.61** | **5.09** | **2.97** | **0.40% / 0.47**（大胜 GPT-5） |
| $\quad -$ 拔掉 RL rollout 多视图渲染（Table 7） | 0.90 | 0.57 | **8.42** | — | 证实在训期间必须看图闭环 |

- **Appendix D 500 道 Hard 题残余败因拆解（$CD > 0.01$ 占 `17.2%` = `86/500`）**：倒角（失败率 **`0%`**）、抽壳（`4.2%`）、圆角（`5.3%`）均非瓶颈！真正的硬骨头集中在两处：① **多实体布尔合并/切除坍缩（`~37%`）**：含 `union` 题失败率达 `24.3%`（无 `union` 仅 `14.1%`），且 2/3 含孔槽失败样本干脆漏写 `cut` 退化成单次挤出；② **高密度草图轮廓失真（`~30%`）**：当 `lineTo > 4` 或含多段 `threePointArc` 时失败率从 `11.7%` 飙至 `>30%`。这直接指导我方 Track 3 重点强化多零件装配布尔与复杂草图探针！

---

## 4. `GVPM` 失效轮 $f$ 判定与 `ms-swift` 序列级 GSPO 落地伪代码

在我方开放式多零件装配（[XHS-TASK-AND-RUBRIC-SPEC.md](../../3d-animation-agent/docs/XHS-TASK-AND-RUBRIC-SPEC.md)，无单一 GT 网格算 CD）中，只需把每轮标量误差 $e_\tau$ 替换为 **`cad_inspect.py` / `check_2d_v2.mjs` 确定性几何/违例赤字分**（如非水密破面数 + 干涉体积 + 包围盒相对误差），即可 1:1 激活 `GVPM`：

```python
# GVPM 失效边界检测 + ms-swift 序列级 GSPO 掩码与非负优势截断实现
import torch

def detect_gvpm_boundary(turn_exec_ok: list[bool], turn_defect_err: list[float], K: int = 2, eta: float = 0.05) -> int:
    """
    输入每轮沙盒执行状态 turn_exec_ok[0..T-1] 与几何/硬检误差 turn_defect_err[0..T-1]（越小越好，<=eta 为达标）
    返回 0-indexed 失效起始轮 f（若全程健康则返回 T，即不掩码任何轮）
    """
    T = len(turn_exec_ok)
    f_exec, consec_err = T, 0
    for t in range(T):
        consec_err = 0 if turn_exec_ok[t] else (consec_err + 1)
        if consec_err >= K:
            f_exec = t - K + 1                                      # 定位连续 K=2 轮报错的起始轮
            break

    f_stall, stall_streak, prev_valid_err = T, 0, None
    for t in range(T):
        if not turn_exec_ok[t]:
            stall_streak, prev_valid_err = 0, None
            continue
        cur_err = turn_defect_err[t]
        if prev_valid_err is not None and cur_err > eta and cur_err >= prev_valid_err - 1e-6:
            stall_streak += 1                                       # 代码可跑但几何误差未严格下降且未过门限 eta
            if stall_streak >= K - 1:                               # 跨 K=2 个相邻合法轮停滞（例如第 t-1 与第 t 轮）
                f_stall = t
                break
        else:
            stall_streak = 0
        prev_valid_err = cur_err

    return min(f_exec, f_stall)

def gspo_gvpm_step_loss(group_trajs, eps_l=3e-4, eps_h=4e-4):
    # 1. 计算原始组相对优势 A_g = (R_g - mean) / (std + 1e-6)
    rewards = torch.tensor([tr.composite_reward for tr in group_trajs], dtype=torch.float32)
    raw_adv = (rewards - rewards.mean()) / (rewards.std(unbiased=False) + 1e-6)

    losses = []
    for g, tr in enumerate(group_trajs):
        f = detect_gvpm_boundary(tr.turn_exec_ok, tr.turn_defect_err, K=2, eta=0.05)
        # token_turn_id[u] 记录每个 token 所属轮次（环境/system token 为 -1）
        viable_mask = (tr.assistant_mask > 0) & (tr.token_turn_id < f)
        n_viable = viable_mask.sum().clamp(min=1)

        adv_g = raw_adv[g]
        # 2. GVPM 核心：若存在早期合法前缀（f > 0）但后缀触发了截断（f < T），单侧截断为非负优势，绝不惩罚好前缀！
        if 0 < f < len(tr.turn_exec_ok):
            adv_g = torch.clamp(adv_g, min=0.0)

        # 3. 序列级长度归一化重要性比 s_g(theta) = exp( (1/|y_viable|) * sum_{u < f} (logp_new - logp_old) )
        seq_log_ratio = ((tr.logp_new - tr.logp_old) * viable_mask).sum() / n_viable
        rho_g = torch.exp(seq_log_ratio)
        rho_clip = torch.clamp(rho_g, 1.0 - eps_l, 1.0 + eps_h)
        losses.append(-torch.minimum(rho_g * adv_g, rho_clip * adv_g))

    return torch.stack(losses).mean()
```
