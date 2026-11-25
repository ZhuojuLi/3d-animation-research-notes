# Kimi → Qwen3.8-27B 的纯代码 3D 动画数据

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../PROVENANCE.md)。

2026 年 11 月 21 日更新。任务从文字需求或已有源码开始，用 **JavaScript / Three.js** 创建几何、材质、相机、动作与交互，用 Chromium 预览和验收，交付离线 HTML 与可编辑源码。首批优先筛选场景几何和动作都由 JavaScript 创建的例子。固定本地 Three.js r180，保留项目已有的 `renderAt(t)` 和浏览器检查，并沿用同一批 Kimi 交付做 one-shot 与多轮 SFT 对照。项目入口（本地附件未发布） · [首轮计划](../3d-animation-agent/docs/plans/2026-11-21-sandbox-distillation-pilot.md)

**优先从 CCORE Scenes-v2 取已有源码，从 VibeVideoBench 挑动画委托，从 OCTAVE 和 WorldCoder 补交互与模拟题。** 其中 VibeVideoBench 的 W0063 已经把单 HTML、Three.js、程序生成素材和随机访问 `renderAt(t)` 写入原要求。公开集提供代码或题目，正式 SFT 样本取同一目标沙盒的经独立验收 Kimi 运行。[CCORE](https://huggingface.co/datasets/ccore/ThreeJS-3D-Scenes-v2) · [W0063 原题](https://huggingface.co/datasets/diaomuxi/vibevideobench/blob/main/tasks/W0063/task.json) · [OCTAVE](https://huggingface.co/datasets/rezonalab/game-benchmark) · [WorldCoder](https://huggingface.co/datasets/shuolucs/WorldCoder-Bench)

Qwen3.8-27B 的官方仓库在 2026-08-13 上传 18 个权重分片，08-14 补充许可证和模型卡。发布日期按 UTC。晚于 8 月中旬代表公开发布物更新。训练与评测仍按原场景、来源视频及任务家族划分。对来源已有的公开题和相近变体，共用一次划分。[权重提交](https://huggingface.co/Qwen/Qwen3.8-27B/tree/72a217afab8029b39e4af1c7273a829995a3dbaf) · [提交历史](https://huggingface.co/Qwen/Qwen3.8-27B/commits/main)

## 优先用的数据

| 来源 | 实际提供的内容 | 怎么接进当前沙盒 |
| --- | --- | --- |
| **CCORE ThreeJS-3D-Scenes-v2** · 11-17，MIT，已在本地 | 3,445 条自然语言与 HTML/JS 对，含 76 条 `Characters Animation` 域，也有仿真、机械和互动场景。源程序默认用 r160。规则扫描筛出 3,394 条未检测到素材加载器、素材 URL 等明显依赖的候选。 | 用程序化场景做修复和局部编辑。筛主体轨迹、关节、变形或明确时序要求。按下文实测选第一批种子，将运行库本地化，并适配项目的 `renderAt(t)`。[固定数据版本](https://huggingface.co/datasets/ccore/ThreeJS-3D-Scenes-v2/tree/370b2cf95727666a3ac570f7fdb3f63f4552d382) · 本地数据盘点（本地附件未发布） |
| **OCTAVE** · 11-13 论文，任务 CC BY 4.0，代码 MIT | 官方 JSON 中 180 个 HTML5 任务，89 个标为 3D，89 条的 `attachment` 均为空。3D 中 71 条的基本要求带 `C3` Animation/Rendering 标记。给出双语规格和检查清单。 | 抽旋转灯塔 `v3_survival_crafting_3d_090` 的光束速度和半径，或 `expert_sandbox_open_world_3d_005` 的机械臂与负载运动，缩成可播放的纯代码动画委托。自行加浏览器断言，原评测使用源码评阅。已有游戏题按机制抽象，场景与视觉采用原创实现。[论文](https://arxiv.org/abs/2611.17681) · [数据](https://huggingface.co/datasets/rezonalab/game-benchmark) · [仓库](https://github.com/rezona-ai/octave-bench) |
| **GameASG-Bench** · 09-18，Apache-2.0，已在本地 | 47 道浏览器游戏题，14 道 Three.js 3D。14 道均要求单 HTML。公开规格和 L1/L2 检查器，L2 由 Chromium 执行。 | 复用材质/几何程序生成、碰撞、运动反馈和交互验收。项目交付时用本地依赖。留一批完整题做独立评估，其余只抽机制并写新任务。公开包提供任务和检查器，Kimi 交付由项目采集。[仓库](https://github.com/areal-project/GameASG-Bench) · 本地核验（本地附件未发布） |
| **WorldCoder-Bench** · 6 月公开，11-06 论文 v3，NeurIPS 2026 | 公开包 205 个 Core 题，实查 38 条 `assets=[]`，剔除一条仍要求加载 GLB 的题后有 37 条可优先筛选。任务 CC BY 4.0。 | 推荐 `P19` 用 `THREE.Bone` 构造人物层级和姿态验证，`P199` 耦合摆，`P10` 陀螺进动，`P26` 波干涉，`P181` 细胞分裂。状态契约可用来设计验收。公开包仍是 6 月的数据，论文 v3 的题量与公开包分开计。[论文](https://arxiv.org/abs/2606.01869) · [数据](https://huggingface.co/datasets/shuolucs/WorldCoder-Bench) |
| **Code2Video-Compass** · 11 月全量发布，数据 CC BY-NC 4.0 | 2,104 条任务中，`3D Motion` 有 354 条、142 个不同 `sample_id`。其中纯文本输入 108 条，另有图片和视频输入。发布 brief、时序信息和 QA 清单。 | 非商业研究可取纯文本子集出题，筛出能用 JavaScript 和数学几何实现的 brief，覆盖程序模拟、产品演示和场景变化。`all/` 和 `train/` 是同一批记录，按 `sample_id` 合并跨模态变体。用项目自己的 Kimi 轨迹和运行结果作标签。[论文](https://arxiv.org/abs/2610.28416) · [任务表](https://huggingface.co/datasets/code2video-compass/Code2Video-Compass) |
| **VibeVideoBench** · 10-26 论文，数据 CC BY-NC-SA 4.0 | 239 个代码驱动视频任务，发布 brief、可观察结果的逐项 rubric 和交付文件检查。任务覆盖 2D、3D 与音频。已核对 `W0063` 明确要求单 HTML、Three.js、程序生成素材和确定性 `renderAt(t)`。 | 非商业研究可先用 `W0063` 八秒循环测乱序采样一致性，取 `W0048` 四冲程剖面测程序几何、活塞与曲轴相位，`W0111` 光学组件测可逆爆炸分解。用项目固定的 r180 与本地依赖重新采集。[论文](https://arxiv.org/abs/2610.35864) · [W0063 原题](https://huggingface.co/datasets/diaomuxi/vibevideobench/blob/main/tasks/W0063/task.json) · [W0048 原题](https://huggingface.co/datasets/diaomuxi/vibevideobench/blob/main/tasks/W0048/task.json) |
| **TKCAM / RealEstate10K-Cap** · 10-23，NeurIPS 2026 | 25,000 条文字与相机轨迹，含时间戳、位置、旋转和内参。标注与衍生轨迹 CC BY 4.0。 | 专项补运镜时取镜头文字和数值，在代码生成的场景中添加相机，验证方向、速度、投影边距和主体可见性。按 `youtube_video_id` 划分。发布物提供数值和描述，像素由当前沙盒自行渲染。[论文](https://arxiv.org/abs/2610.11105) · [固定数据版本](https://huggingface.co/datasets/yhz-linearalgebra/RealEstate10K-Cap/tree/96e7a803a515ab03335262263c647fb7f785b83b) |

**CCORE 浏览器抽查。** 在 Chromium 中把示例的 r160 CDN 请求映射到本地 r180，拦截其他网络请求。抽查 7 条官方训练样例，7 条均渲染成功，无额外请求或页面错误。时间分开的两次观测都取得不同的画布像素和网格世界矩阵，6 条相机保持固定。样例 ID 后缀为 `3181` 分流门、`3182` 传送带排队、`3686` 行走停下拾取、`3690` 跳跃与落地、`3710` 搬长凳转弯、`3722` 三足步态、`3742` 机器人限位取物，完整 ID 前缀均为 `scene-expansion-`。抽查验证了实际程序化运动。任务叙事、接触和 `renderAt(t)` 仍需单题验收。全量 3,394 条来自静态筛选。[源数据](https://huggingface.co/datasets/ccore/ThreeJS-3D-Scenes-v2/tree/370b2cf95727666a3ac570f7fdb3f63f4552d382)

## 保留的外部评测和经典参照

- **InteractScience** 是 ICML 2026 收录的浏览器科学仿真基准。150 道任务要求单 HTML 内嵌 CSS 和 JavaScript，包含 779 项程序化功能测试与 590 项视觉测试。发布数据 Apache-2.0，含参考画面、实现计划和单测。适合经典纯代码基线，按 2D 与 3D 题型分别报告。[论文](https://proceedings.mlr.press/v306/chen26cf.html) · [公开数据](https://huggingface.co/datasets/internlm/InteractScience)
- **WorldBench**（10-07）用一个大型体素岛任务、26 组模型产物及浏览器评分测长期压力。**Design Bench** 本地有黑洞、环状行星、木星 3 个原始视觉主题和各模型产物、视频。用它们测复杂场景、动态画面和正式交付。模型输出数与独立题数分别报告。[WorldBench](https://github.com/KrishBakshi/worldbench) · [Design Bench](https://github.com/jdmnk/design-benchmark) · 本地规模核验（本地附件未发布）
- **3DCodeVerse**（10-15 论文）取 Three.js 子集看程序化建模、部件代码和单轮生成。已下载的两份 680 行分片共享 340 个不同 ID，以 ID 去重。40 道公开 Three.js 子题侧重单物体和截图，可配合新动画题跟踪建模回归。数据卡 CC BY-NC-SA 4.0，源许可另外适用。[数据卡](https://huggingface.co/datasets/3dcodeverse/3dcodeverse-2m) · [本地抽核](3d-agent-sandbox-distillation-20261120.md)
- **Ox-Alpha Three.js Eval**（08-21）公开了三个程序化场景的 HTML、运行日志和截图，主题是引力透镜、体积云和 GPU 流体。可参考其载入与 WebGL 检查。发布页未标注复用许可，黑洞题与 Design Bench 主题有重叠。[发布文件](https://huggingface.co/datasets/suvadityamuk/ox-alpha-threejs-eval/tree/4a7cc1711ea221f4a2c17285e6bd75f762cfc75a)
- **Three.js 官方示例**用于动画 API 小题，例如 `misc_animation_keys` 的 keyframe track 与 mixer，以及 `webgl_instancing_dynamic` 的实例变换。可用几何体和程序化颜色提取最小正确解，再用项目固定的 r180 做回归。官方在线示例随上游更新。[关键帧示例](https://threejs.org/examples/misc_animation_keys.html) · [动态实例示例](https://threejs.org/examples/webgl_instancing_dynamic.html) · [MIT 源码许可](https://github.com/mrdoob/three.js/blob/r180/LICENSE)
- **AnimWeb-Bench** 有 124 道视频还原网页动画，主要是 DOM/CSS，可参考节奏与编辑评测。**Animation2Code** 1,069 个视频与 HTML 中，本地验过 5 例用 Three.js，官方测试中为 0。**MotionGraphicsBench** 用 Qwen3.8-27B 在 2D SVG 上做了逐项可执行验收，项目页仍列数据与代码待发布。[AnimWeb](https://huggingface.co/datasets/starry1001/AnimWeb-Bench) · Animation2Code 核验（本地附件未发布） · [MotionGraphicsBench](https://motion-graphics-bench.github.io/)

## 12 题试跑怎么用这些来源

项目已有 4 道生成、4 道修复、4 道局部编辑题及初始源码。先沿用这套采集协议。以下是可以填入后续新增题的来源，公开评测题和同家族变体保留在同一侧。本地题单（本地附件未发布）

| 题型 | 纯代码题例 | 可以独立读取的状态 |
| --- | --- | --- |
| 生成 | 三分流传送带、双摆或耦合摆、代码构建的关节模型、移动主体跟拍 | 物件过门顺序、摆长和相位、父子节点世界位姿、主体在屏幕的边距 |
| 修复 | 从已运行代码派生循环接缝、错枢轴、镜头裁切和暂停/拖动不同步 | 真实 `renderAt(t)` 在同一时间点的对象变换、投影、播放器状态，修复后重复抽样 |
| 局部编辑 | 改一个机构的启动时刻、调运镜、延长角色停顿、改曲线路径 | 目标参数变化，其他节点的位置和相位保持，回到同一时刻得到一致状态 |

把需求、初始源码、同一版本的浏览器证据、正式交付和实际工具调用一起登记。Kimi 合格运行的最终源码供 one-shot，原始可见反馈和对应操作供多轮 SFT。先按原场景家族划分，再派生故障和改写。两组用同一初始工作区、同一 Kimi 运行和同一隐藏验收。主指标用正式交付与全部必要断言同时通过的比例，另报返修成功和连续视频盲评。[首轮实验计划](../3d-animation-agent/docs/plans/2026-11-21-sandbox-distillation-pilot.md)
