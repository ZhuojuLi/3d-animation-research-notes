# Kimi C4「晶潮」2,400 晶体群案例拆解

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

日期：2026-11-16

关联文档：[Kimi Harness 探针](kimi-harness-probes.md)、[C1 动力雕塑](kimi-case-01-kinetic.md)、[C2 模块化音箱](kimi-case-02-speaker.md)、[C3 滚动叙事](kimi-case-03-scroll.md)。

> **源码 ZIP 已收到并独立复验。** 本机安装、构建和真实 Chromium 检查完成，26 项中 **24 通过、2 失败**。失败为定格页显示未实测的 `60 FPS / 16.7 ms`，以及拖动后双击复位仍有相机偏差。详见 C4 独立复验报告（本地附件未发布）。

## 一句话结论

这是第四份返回的完整可见轨迹，对应 **Case 4：程序几何、固定随机种子与资源稳定性**。它支持“**固定种子生成静态实例参数 + GPU 纯时间着色器 + 少量共享资源 + 正常播放 soak**”这条路线，不需要为 2,400 个晶体创建 2,400 个 Mesh，也不需要通用场景 IR。

它比 C1/C2 更认真地处理了性能声明：最终明确承认 SwiftShader 只有约 5.47 FPS，不能冒充普通笔记本硬件实测。但独立复验仍发现两个界面/交互问题，说明**正确的架构和不夸大的文字，并不能替代对最终状态的逐帧、逐项验收。**

## 证据包与边界

原始材料位于 `references/kimi-probes/case-04-crystals/`：

| 文件 | 内容 |
|---|---|
| `source-message.txt` | 第四份用户消息完整原文，389,242 字节 |
| `brief.txt` | Case 4 原始需求，455 字节，保留原始换行 |
| `transcript.txt` | 388,667 字节、4269 行可见轨迹 |
| `provenance.json` | 原文/ZIP 哈希、来源、交付边界和独立复验结论 |
| `artifacts/晶潮源码.zip` | 用户原始 ZIP 的归档副本，35,056 字节 |
| `received/晶潮/` | 安全解压的 9 个原始文件，未修改 |
| `../reports/kimi-c4-independent/` | 本机构建、26 项浏览器检查、60 秒 soak、截图与复跑脚本 |

ZIP 的 SHA-256 为 `20910567ccb8c0705b1310a0bf99586ee4d500c2f71bf99f98b732a09ef6574a`。包内有源码、锁文件、README 和通用验证脚本，**没有 `dist/`、预览 PNG、原始截图二进制或版本卡**。轨迹报告网页版本 `192fac4`，本机未访问该版本服务。

轨迹中的 C1/C2/C3 文件、端口和进程属于共享工作区污染证据，不能算 C4 功能；其 `/mnt/agents` 等路径属于 Kimi 执行环境。

## 技术路线

### 1. 参数化几何与稳定布局

实际源码见 `references/kimi-probes/case-04-crystals/received/晶潮/src/scene.js`：

- `CRYSTAL_COUNT = 2400`，分为 5/6/7 边截面三族，各 800 个实例。
- 每族一个 `InstancedMesh`，共享一份晶体 `ShaderMaterial`。
- 另有一个地面 Mesh 和一个包含 2,400 实例的接触阴影网格。
- 使用固定种子 `0x07a31` 的 Mulberry32；没有未种子化 `Math.random()`。
- 位置以黄金角 + 面积均匀径向分布为基础，叠加固定 jitter。
- 高度、宽度、yaw、tilt、phase、颜色均按固定顺序生成。
- 暴露 `layoutHash=691efe56` 和前 8 个参数样本；本机刷新前后哈希和截图均一致。

注意：`layoutHash` 是量化后的 FNV 诊断值，并未覆盖 tilt、aRadial、aSeed 等所有字段，也不是防碰撞承诺。真正更强的本机证据是同一视口、同一时刻刷新前后 PNG 字节完全相同。

### 2. 10 秒径向波浪在 GPU 中求值

顶点着色器的核心为：

```glsl
float cycle = uTime * 0.1;
float travel = fract(cycle - aRadial);
float wrapped = min(travel, 1.0 - travel);
float wave = exp(-wrapped * wrapped * 240.0);
float breath = 0.5 + 0.5 * sin(6.28318530718 * cycle + aPhase);
```

`wave` 同时影响晶体的横向尺度、高度、位移、发光和边缘光；`aPhase` 给每枚晶体稳定的呼吸相位差。地面 shader 使用同一个 `uTime` 计算向外移动的亮环。

所有视觉状态由时间和不可变实例参数计算，不需要逐帧更新 2,400 份 CPU 矩阵，也不需要 fixed timestep。固定种子只证明布局可复现，不自动证明波浪构图或接缝速度合理。

### 3. 正常播放、capture 与鼠标

正常模式：

```text
clockOrigin = performance.now() - simTime × 1000
time = ((rafTimestamp - clockOrigin) / 1000) % 10
```

- 鼠标由 OrbitControls 接管；禁用 pan 和 zoom，只允许拖动观察方向。
- 双击调用 `controls.reset()`，不主动修改动画时钟。
- `?t=秒` 和 `window.__seek(t)` 进入/执行定格 seek，停止正常 RAF。
- 页面隐藏时取消 RAF，重新可见后按绝对时间继续；不是把隐藏期间累积成物理模拟。
- reduced-motion 下停在 `t=2.5`，仍有真实 WebGL canvas。

本机验证了正常播放、真实 pointer 拖动、滚轮不缩放、时钟原点不变和 A→B→A。**双击复位的相机精度未通过，见下文。**

### 4. 渲染预算与自适应降级

最终资源设计：

- 晶体本体 57,600 triangles；加地面和实例阴影为 62,402。
- EffectComposer + RenderPass + UnrealBloomPass + OutputPass。
- 完整帧在 bloom 开启时为 19 calls / 62,416 triangles；关闭后为 6 / 62,403。
- `renderer.info.autoReset=false`，每个组合帧开头手动 `reset()`，因此读数包含后处理，而不是只剩最后一个 fullscreen pass。
- 高通 bloom 入口增加 NaN/Inf 清理和 HDR 上限。
- 桌面 DPR 上限 1.25；慢帧时先降到 0.85，仍慢则关闭 bloom，保留自发光。
- 晶体几何、材质和渲染目标只在初始化创建；有 `dispose()`，但单页正常流程不反复创建场景。

“热循环不创建晶体对象、矩阵、材质或纹理”是合理表述，但不能扩大成“零 JS 分配”：`onFrame({time,duration})`、DOM 字符串和定期 `getState()` 仍会产生可回收对象。

## 原轨迹的关键失败与返修

| 问题 | 轨迹证据与处理 | 应吸收的机制 |
|---|---|---|
| 无头 Chromium 无法创建 WebGL | 通用验证最初 2 fail/2 warn，见 `transcript.txt:1818-1848`；后续用 Xvfb + SwiftShader 获得真实 WebGL | CSS/错误页不能算 3D 通过；验证环境本身是产物证据的一部分 |
| 初始构建成功但样式没入口 | 后续给 `main.js` 加 `import './style.css'`，并加 data favicon | 构建成功不等于 CSS 被加载；必须看全屏实际截图 |
| 共享目录和端口被其他 case 占用/覆盖 | 页面一度回到远行星降，源码也被覆盖，见 `:2733-2939`；改用 `/mnt/agents/.tmp/crystal-work` 隔离 | 一题一 workspace、专用端口、最终源码/发布哈希绑定已是硬性要求 |
| 波峰过曝、晶体群贴边 | 降低 wave emission、waveCore、bloom，拉远相机，再截图，见 `:3100-3129` | 亮度与构图要由实际帧驱动返修，不能只看资源数字 |
| 移动端过近 | 提高窄屏相机 distanceScale，并隐藏移动 telemetry | DOM 无 overflow 不代表世界空间构图完整；需分别记录 |
| FPS EMA 高估 | 第一轮平均只有 3.28 FPS，但 HUD 样本显示约 20–49 FPS，见 `:3461-3600`；随后把长帧过滤从 250ms 放宽到 1000ms | 同时报告帧数/墙钟平均与 EMA，不能用初始值或被过滤样本美化性能 |
| 软件渲染仍然很慢 | 最终增加关闭 bloom 的降级，原轨迹 60 秒平均 5.47 FPS | 降级是实测返修，不应伪称普通笔记本已流畅 |
| 静态 favicon 检查误报 | SVG namespace 中的 `http://` 被静态 grep 命中，随后 URL 编码 | 区分工具误报与真实外部请求；最终以浏览器网络记录复核 |

## 原轨迹性能证据：应保留，也应限定

原轨迹最终记录见 `transcript.txt:3743-3914`：

- Chromium 151 + SwiftShader，1440×900。
- 名义 60 秒、实际墙钟 67.948 秒，平均 5.4748 FPS。
- 6 geometries、13 textures、12 programs 全程不变。
- DPR 1→0.85，随后 bloom 关闭；calls 19→6。
- 30→60 秒 GC 后 JS 堆只增加 7,832 B。
- 拖动前后 clockOrigin 相同，相位误差约 0.046 秒。
- 最终明确写出没有普通笔记本硬件实测，也没有直接读取物理显存字节。

这是比“稳定 60fps”更可信的交付口径。不过 ZIP 没有包含产生这些数字的自定义 Playwright 脚本，只有通用 `verify-content.mjs`；原始数据 JSON 和截图也未随包提供。因此它们仍标记为**原轨迹证据**，不是本机复现值。

## 本机独立复验：24/26

完整结果见 C4 独立复验报告（本地附件未发布）。本机构建成功，产物文件名和大小与轨迹最终构建相同；但因 ZIP 不含原 dist，不能做交付构建逐字节对比。

本机 60 秒窗口的实际墙钟为 64.8074 秒，平均 **9.4279 FPS**；资源计数仍为 6/13/12，30→60 秒 GC 后堆差为 **+60,824 B**。这些数字与原轨迹不同，不能解释为版本变快或变慢，只能说明软件测试环境不同。

### 新发现 1：定格页仍显示伪 60 FPS

最终源码仍初始化：

```text
fps = 60
frameMs = 16.67
```

`?t=2.5` 下 `running=false、frames=2`，但 HUD 显示 `60 / 16.7`。原轨迹最后还讨论过是否改为 `—`，实际没有修改。这是一个真实交付缺陷：**正文诚实，不代表预览图里的仪表也诚实。**

### 新发现 2：双击复位受阻尼残量影响

本机用真实 pointer 拖动后，相机改变、clockOrigin 不变，均符合要求；但双击后 300ms 的相机位置与初始位置误差约 1.5694，时钟仍正确。

`OrbitControls.reset()` 内部还会 `update()`，而启用 damping 时 `_sphericalDelta` 没有因 reset 自动清空。当前证据只断言本次观察窗内未精确复位；修复后应清空残量并重测，不应把该问题写成普通性能误差。

## 不能过度解读

1. **不是普通笔记本性能通过。** 原轨迹和本机都只有 SwiftShader；本机约 9.43 FPS 也不流畅。
2. **不是物理显存字节证明。** 只有 renderer 资源计数，浏览器没有直接 VRAM 读数。
3. **不是长期无泄漏证明。** 一分钟和 GC 后的两个点不能覆盖小时级运行；本机后半程仍有约 59.4 KiB 差值。
4. **不是对象/材质全量动态计数。** 资源计数与固定源码强支持不增长，但没有逐帧枚举 scene objects/materials。
5. **不是完整接缝运动学。** 0/10 像素一致、A→B→A 和非静态证据很强，仍不等于接缝附近速度与视觉连续性全通过。
6. **不是全参数哈希。** FNV 摘要未覆盖所有实例字段，且有量化；需与实际截图一起使用。
7. **不是独立审美通过。** 本机已看图，中心波峰仍很亮；不把机械通过当成艺术评分。
8. **不是完整原始交付包。** 缺 dist、Kimi 原始截图、预览 PNG、版本卡和性能脚本。

## 对本机 3D Animation Agent 的直接影响

### P0：增加“性能与资源证据”契约

- 同时采集 `instanceCount`、几何体、纹理、程序、draw calls、triangles、DPR、质量档位和 JS heap；说明每项能证明什么。
- 使用 `renderer.info.autoReset=false + 每组合帧 reset()`，避免后处理把计数覆盖成最后一道 pass。
- FPS 至少分两种：EMA 瞬时读数和 `Δframes / ΔwallTime`；长帧过滤必须显式披露。
- 未测量、暂停、静态、reduced-motion 时显示 `—`，不能使用 60/16.67 占位。
- 记录预热后、质量切换前后、30/60 秒等阶段；质量降级不能导致资源数持续增加。
- 真实 GPU、软件渲染、普通笔记本结论分栏，禁止互相外推。

### P0：交互不只测“相机变了”

- 拖动前后同时比较相机、时钟原点、墙钟预期相位和 RAF 数量。
- 对“复位”检查目标位置误差，而不只检查按钮事件触发。
- OrbitControls damping 与 reset 的组合需要专门测试；先清残量再复位。
- 滚轮禁用、双击、触摸和正常播放分别走真实输入，capture 下静止不能替代正常模式。

### P1：固定题集加入 C4 类型

建议最小检查序列：

```text
capture 2.5 → 记录布局/截图
0 → 10 → 5 → 9.9833 → 0.0167 → 2.5
刷新 2.5 → 比较哈希和 PNG
正常播放 → 真实拖动 → 双击复位 → 继续运行
60 秒 soak → 质量降级 → 资源/堆读回
```

C4 不需要物理引擎、通用 IR 或多 Agent；需要的是可靠的渲染计数、时间/输入验证和诚实的性能证据。

## 后续归档待办

- 若补充 Kimi 原始 `dist/`、`晶潮预览.png`、版本卡或性能 JSON/脚本，放入对应档案并另做一致性比较。
- C1/C2 的 ZIP 已由用户补充并分别完成独立复验：C1 21/21（本地附件未发布）、C2 22/22（本地附件未发布）；C5 仍应在 C2 原会话后执行。
- 当前只归档和复验参考实现，没有修改本机 Agent 业务代码。
