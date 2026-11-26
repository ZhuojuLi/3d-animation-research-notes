# 论文精读：WorldCraft: Photo-Realistic 3D World Creation and Customization via LLM Agents（arXiv:2502.15601v2）

> 公开整理版 · 2026-11-27。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

- **标题**：*WorldCraft: Photo-Realistic 3D World Creation and Customization via LLM Agents*（ACM TOG）
- **作者**：Xinhang Liu, Chi-Keung Tang, Yu-Wing Tai（HKUST & Dartmouth College）
- **原文**：`https://arxiv.org/html/2502.15601v2` · 本地原件：[paper.html（上游原文）](https://arxiv.org/abs/2502.15601) · 纯文本：[paper.txt（上游原文）](https://arxiv.org/abs/2502.15601) · 元数据与校验：`sources.json`（本地校验清单未发布）
- **整理日期**：2026-11-27 · 关联总报告：[SFT 后强化学习与自蒸馏总报告 v2.0](../3d-agent-post-sft-rl-survey-20261127/README.md) · [2026 同源踩坑避坑大全](../visual-3d-agent-rl-pitfalls-and-lab-lessons-20261127/README.md)

> **文献核验勘误说明**：部分外部二手检索摘要曾将 `arXiv:2502.15601` 误标为 `BlenderFORGE`；经本地拉取 arXiv 官方元数据与全文 HTML（SHA-256 已核验）确认，`2502.15601v2` 实为发表于 ACM TOG 的 **WorldCraft**。本笔记严格按原文真实内容归档，不做张冠李戴。

---

## 1. 核心问题与系统架构

`WorldCraft` 并非训练权重更新类的梯度 RL 论文，而是程序化 3D 世界生成与相机动画领域具代表性的**闭环验证与分层约束求解（Test-Time Critic Auto-Verification + Hierarchical Layout Optimization）**多智能体系统。其针对纯 LLM 直出 Blender/Infinigen 程序化 3D 代码时的两大顽疾——**API 参数语义幻觉**与**三维空间穿模/人机工程学失调**——设计了四个核心模块：

1. **Coordinator Agent**：统筹自然语言需求，拆解为单物体资产定制、场景级空间排布与相机轨迹动画；
2. **`ForgeIt`（带自验证进化手册的资产生成 Critic 闭环）**：
   - 面对未文档化或反直觉的程序化生成参数（如改变某个浮点数到底拉长桌腿还是加厚桌面），`ForgeIt` 通过“受控单参数扰动渲染 $\to$ 多模态 Critic 视觉比对验证 $\to$ 自动沉淀可执行参数手册（Auto-Verified Skill Manual）”闭环消除几何定制幻觉；
3. **`ArrangeIt`（分层空间约束优化器）**：
   - 不让 LLM 凭空瞎猜三维绝对坐标 $(x,y,z,\theta)$，而是让 LLM 输出**高层拓扑与功能约束关系**（靠墙、面向中心、安全间距、支撑从属、视线无遮挡），底层转化为可微/分层数值约束优化问题求解无碰撞精确位姿；
4. **Trajectory Control Agent**：将自然语言运镜指令转化为平滑受控的 3D 相机运动轨迹与动态场景演出。

---

## 2. 实验表现与边界

- 在单物体细粒度几何定制、室内外大规模写实场景布局及相机运镜评测中，显著降低了纯 LLM 直写坐标常见的浮空、相互穿插与尺度失调问题，并在用户偏好盲评中大幅优于无自验证手册与无约束求解的基线 Agent。
- **边界**：属于推理期重型多智能体 + Blender/Infinigen 渲染管线（单场景耗时较长，不更新底座权重）。

---

## 3. 对我们三轨 27B Agent（训练期验证器与沙盒工具）的启发

虽然 `WorldCraft` 本身不做策略梯度更新，但它的 **`ArrangeIt` 约束公式化** 与 **`ForgeIt` 受控视觉差分验证** 对我们设计 **RL 确定性验证器（Verifier）与防瞎猜坐标护栏** 有两点直接工程启发：
1. **用确定性空间关系探针替代纯 VLM 肉眼抓穿模**：LLM 肉眼看单张透视图极难发现背面穿模或浮空 `5mm`。正如我们在 CAD 轨用 `cad_inspect.py` 做精确布尔交集 `0.0 mm³` 检测，在 Three.js 轨的 `verify_xhs_output.cjs` 中同样可以在 Headless 页面内遍历 `THREE.Box3().setFromObject(mesh)` 导出场景级包围盒树，为 RL 的 **$L_1$ 几何硬门禁**提供零 API 成本的地面穿透/严重重叠/越界散件自动检测！
2. **相机运镜与交互的差分验证（Differential Verification）**：借鉴 `ForgeIt` 的前/后受控扰动比对思想，在评判 `s_func / R_func` 时，固定在动作触发前后截取配对帧并计算局部区域像素/包围盒状态差，杜绝“UI 按钮点了没报错但三维物体纹丝不动”的假交互骗过 RL 奖励。
