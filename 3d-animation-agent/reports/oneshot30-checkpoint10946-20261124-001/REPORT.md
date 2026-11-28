# checkpoint-10946 的 30 题单轮 Three.js 补测

> 公开整理版 · 2026-11-28。保留成文时点的记录；计划、文献结果和本地实测请分别理解。环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

逐题复用了历史请求体，运行原生成器和浏览器评分器。每题采样一次，thinking 开启，输出上限 24,576 token。浏览器在完整 HTML 中检查 JavaScript、依赖和实际 WebGL 绘制。

**思考档位口径**：本轮请求只传了 `chat_template_kwargs.enable_thinking=true`，没有传 `reasoning_effort`，因此不能把本轮称为 medium 或 xhigh。首版 Agent dev 的服务端默认是 medium。历史的 `xhigh-uncapped` 实验显式传了 `reasoning_effort=xhigh`，并使用 262,144 上下文、无 24,576 输出上限。下面的 14/30 只与同样采用 24,576 上限的旧 one-shot 诊断作有限对照，不与历史 xhigh 结果直接比较。

| 模型 | 完整 HTML | 基础几何 | 多部件 | 空间场景 | 技术通过 | 空终答 |
|---|---:|---:|---:|---:|---:|---:|
| base | 2/30 | 2/10 | 0/10 | 0/10 | 2/30 | 22 |
| step-900 | 24/30 | 7/10 | 5/10 | 9/10 | 21/30 | 6 |
| step-2591 | 22/30 | 5/10 | 8/10 | 7/10 | 20/30 | 8 |
| **checkpoint-10946（本轮未指定档位）** | 16/30 | 6/10 | 3/10 | 5/10 | **14/30** | 10 |

生成及浏览器原始结果见`comparison.json`（本地附件未发布），截图和 HTML 见`gallery.html`（本地附件未发布）。

使用原生分词器、原历史镜像、单张 A100、BF16、32,768 上下文、8 并发、temperature 0.7、top-p 0.95、top-k 20、seed 42。30 题的题面和采样参数已和旧的 24K 诊断逐题比对，但本轮没有显式指定思考档位。此表报告技术通过；画面细节以逐题截图为准。

## 失分分布

30 题中，14 题缺完整 HTML，其中 14 题达到输出上限。全部请求中，10 题最终正文为空，14 题达到上限。

| 评分状态 | 题数 |
|---|---:|
| 采集失败 | 2 |
| 技术通过 | 14 |
| HTML 不完整 | 14 |

## 同题结果变化

| 历史模型 | 仅 checkpoint-10946 通过 | 仅历史模型通过 |
|---|---|---|
| base | basic_02, basic_03, basic_04, basic_07, basic_08, complex_04, complex_05, complex_09, spatial_01, spatial_03, spatial_06, spatial_09, spatial_10 | basic_06 |
| step-900 | basic_07, complex_04, complex_09 | basic_05, basic_06, complex_03, complex_07, complex_08, complex_10, spatial_02, spatial_04, spatial_07, spatial_08 |
| step-2591 | basic_02, basic_07, spatial_09 | basic_06, complex_02, complex_06, complex_07, complex_08, complex_10, spatial_02, spatial_07, spatial_08 |

## 首帧抽查

- 交叠的结形、圆形底座与主体轮廓清楚。受光面接近白色，黄铜拉丝纹理在亮部不易辨认。 `preview.png`（本地附件未发布）
- 黄铜主镜筒、细寻星镜、带齿调节旋钮和三根木色脚架均可辨认，底座到镜筒完整入画。 `preview.png`（本地附件未发布）
- 机首青色光晕和机顶高光遮住部分外壳与推进器细节。两根背部天线和侧置推进器仍可辨认。 `preview.png`（本地附件未发布）
- 圆形底座、关节、两段带弹簧的灯臂和锥形罩均清楚可见，罩下桌面有暖色光斑。 `preview.png`（本地附件未发布）
- 中央太阳、倾斜轨道和右下的带环行星均完整入画。受光较弱的小行星和卫星在暗背景上较难辨认。 `preview.png`（本地附件未发布）

用全部 30 条完整提示词检查了本轮 10,946 条训练记录中的用户消息。在统一大小写、空白和 Unicode 后，全句匹配为零。题材或改写题面的近似程度未经检验。`prompt-overlap.json`（本地附件未发布）

历史 `xhigh-uncapped` 记录中的 step-900 结果是 21/30，使用显式 xhigh、262,144 上下文且没有 24,576 输出上限。这是另一种推理预算，不能拿来和本轮 14/30 做模型优劣结论。要回答当前 checkpoint 在 xhigh 下的表现，需要另跑一组显式 xhigh 的同题实验。


本次生成使用的 A100 已释放。`gpu-before.txt`（本地附件未发布）与`gpu-after.txt`（本地附件未发布）的显存和计算进程可对照核查。
