# 3D Agent 夜间采集与初审最终报告

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

日期：2026-11-22。本文对应 `reports/overnight-data-composition-20261122.json`。**所有计划位置均有处置记录，主候选实际画面初审已完成；当前仍不是可训练数据集，未启动正式 SFT。**

## 1. 最终处置与主候选

| 队列 | 计划与处置 | 技术候选 | 主候选及实际画面初审 |
|---|---:|---:|---|
| Qwen BF16 27B baseline | 4/4 有终态 | 0 | 3 条时间预算耗尽、1 条断言失败；不是完整 320 题 baseline |
| 规模化 Kimi ReAct | 960 个位置：959 条正常终态 + 1 条用户暂停后人工恢复 | 831 | 211 条；207 条稳定证据、4 条明确警告、0 条待审 |
| Aodi 三源 Kimi ReAct | 576/576 正常终态 | 88 | 43 条；34 条稳定证据、9 条警告、0 条待审 |
| 最后任务人工恢复 | 独立完成 1 个任务 | 不计入原 Kimi 技术候选 | 独立交付与浏览器验收，不计独立教师样本 |

规模化原始计划为 320 case × 3 = 960 条，使用 Kimi `kimi-k3`、medium，同题固定三次采样，安全切换后单队列 32 并发。Aodi 为 192 case × 3 = 576 条。原始流、产物、图片、失败记录和备选均保留。

最后一条 `edit-gen-geneva-indexer-station-window/trial-3` 在用户暂停时停止，未完成工作区与原始流保持不变。人工恢复在独立目录完成，不伪造正常 Kimi summary，不增加 831 条原技术候选数，也不把原 Kimi 数量写成 960/960。

主候选仍需完整语义、连续视频、重放和训练标签验证。`pass@3` 不等于 `Accepted@1`，没有合格备选的题不强行递补。

## 2. 最终数据组成

### 通用代码底座

Aodi 全量 train 有 10,697 条 answer-only 记录，约 127,463,249 token。原始 reasoning 约 145,518,196 token，不混入 answer-only profile。已有 one-shot 训练结果作为对照，不重复启动同一版 SFT。

### ReAct 主候选

| 来源 | 主候选 | thinking | 正文 | 工具参数 | 可见 assistant 合计 | 工具结果图片 |
|---|---:|---:|---:|---:|---:|---:|
| 规模化 | 211 | 7,680,752 | 247,806 | 5,118,290 | 13,046,848 | 2,033 |
| Aodi | 43 | 1,575,780 | 43,365 | 1,174,214 | 2,793,359 | 560 |
| 合计 | 254 | 9,256,532 | 291,171 | 6,292,504 | 15,840,207 | 2,593 |

以 answer-only 底座计算，ReAct 可见 assistant 文本自然占比约 **11.05%**。正文加工具参数的 answer-only 估算为 6,583,675 token，自然占比约 **4.91%**。

这些是可用文本的估计，不含完整 system、工具 schemas、工具结果、角色模板、EOS 与视觉 token，**不是最终训练标签比例**。服务返回的 thinking 不称为完整隐藏思维链；工具参数包含代码字符串，图片单独计数。

### 计划题目与实际主候选

| 维度 | 计划 case | 最终主候选 | 可见 assistant token |
|---|---:|---:|---:|
| hard | 128 | 91 | 6,134,263 |
| medium | 96 | 53 | 3,369,672 |
| simple | 48 | 44 | 3,060,547 |
| health_control | 48 | 23 | 482,366 |
| generation | 256 | 183 | 12,399,517 |
| repair | 52 | 23 | 482,366 |
| local_edit | 12 | 5 | 164,965 |
| Aodi generation | 192 | 43 | 2,793,359 |

难度和任务类型是两个独立统计维度，不能跨行相加。计划配比不等于通过初审后的自然配比；Aodi 只有 prompt 复杂度标签，不冒充学生实测难度。

### 独立覆盖与交付去重

两队列共有 254 个不同 case 身份，对应 242 个不同交付 HTML 哈希。规模化有 199 个不同交付，Aodi 有 43 个；跨队列共享交付组为 0。

12 条共享交付只扣减画面多样性，不删除不同审计任务的轨迹身份。相同 HTML 不会被视为多个独立画面。

## 3. 最后四条直接审核

用户明确授权主 Agent 直接审核，未调用 Astra 或其他替代模型。实际打开 15 张图片，并核对报告、源码、原始工具流、交付哈希与同预算备选。

- `edit-gen-excavator-cycle-truck-scale/trial-3`：从 LIFT、有土回到 IDLE、空载，真实定帧漂移；排除。
- `audit-gen-geneva-indexer-wheel-angle/trial-3`：分度盘、站位和驱动状态在等待后继续变化，原健康 fixture 保持；排除。
- `fix-terminal-inventory-gen-factory-cells/trial-3`：6/6 与三箱各两件功能正确，且完全稳定，但 640 视口左面板遮住 A 工位、红箱和接触区；按可读性排除。
- `edit-gen-geneva-indexer-station-window/trial-2`：确认读取 trial-1 的源码与结果截图，同时存在真实定帧漂移；排除独立轨迹资格。

四条均只影响主候选，不删除技术候选或原始证据。工厂题的功能成功证据保留，不因画面排除而否定修复本身。

规模化质量排除最终为 366 条：

- `render_at_wallclock_contract_failure` 209 条；
- `viewport_readability_failure` 136 条；
- `cross_trial_result_access` 15 条；
- `cross_trial_solution_copy` 5 条；
- `cross_trial_audit_artifact_access` 1 条。

排除回流为 0，主候选缺证据项为 0。

## 4. 最后任务人工恢复

人工恢复新增物理检视窗，`window_station` 根据指针与数字窗格的实际坐标计算，不是直接复制 `station_index`。项目检查器全部公开断言通过，12 个基线样本、乱序复现、正常播放和外部定帧均通过。

实际看图确认 640 与 1280 像素下数字与指针可读，销轮未被遮挡。最终交付 SHA-256 为 `22b9d8bff6433c86dc85a637ef1ee774a89b62d335d9f165755949109d157364`。

交付与证据：`reports/manual-recovery-edit-gen-geneva-indexer-station-window-001/`。它不计入原 Kimi 的独立教师样本。

## 5. one-shot 对 ReAct 的结论

一万级 one-shot 代码底座仍应保留。ReAct 的主要增量是实际观察、工具操作、定向修改和复验，不保证每个场景都优于原版。

原始 192 个 HTML 中 189 个在既定静态协议下可运行，原始 GLB 有效导出 62/64。ReAct 的 192 个 GLB 试次另行完成本地 HTTP 导出和加载，但 Godot 导入与完整语义未验证。原始 `file://` 的 480 条模块/CORS 失败单列，不能与原版静态通过率直接比较。

现有 26 个唯一 case 有实际配对画面。蚂蚁地下通道等体现看图修复价值；浮动起重机、冰川和巴松管等原版呈现更好。市政地图和滨水交互通过独立严格操作验收，说明 ReAct 的交互复验有实际意义，不能只看轨迹长度。

完整对照见 `reports/aodi-one-shot-vs-react-final-20261122.md`。

## 6. 最终完整性与验证

- 最终独立性扫描覆盖 831 个技术候选，27 条命中均有审核证据，未处理命中为 0。新增命中正是直接审核的检视窗 trial-2。
- 831 条规模化与 88 条 Aodi 技术候选的交付和必需文件齐全；366+39 条排除无缺失证据或身份错配。
- 主候选原始流审计：规模化 211/211、Aodi 43/43 通过。
- 最终全量测试：**113 项 Python 测试通过，4 项 Node 测试通过**。
- 本任务后台采集、监视与审核进程均已停止。

证据：`reports/scale-collection-20261122-001/cross-trial-access-final-summary.json`、`reports/scale-collection-20261122-001/quality-evidence-integrity-002.json`、`reports/aodi-react-comparison-20261122-001/quality-evidence-integrity-002.json`、`reports/tooling-validation-20261122-004.json`。

## 7. 尚未完成的训练准入边界

- 完整语义与连续视频验收；
- OpenAI/Swift 标签、模板、loss mask 和实际 loader 验收；
- 完整 system、工具 schemas 与逐次请求捕获，精确重放尚未建立；
- GLB 的 Godot 导入验证；
- 独立 dev/test holdout，当前 512 个 case 都是 train，没有虚构评估集；
- 完整 320 题学生 baseline，当前只有四题。

因此，本轮完成的是**采集处置、技术候选、主候选画面初审、组成与对照汇总**，不是正式训练集批准或 SFT 完成。若进入训练，应先完成训练标签验收和独立评估设计，不直接把当前候选全部灌入。
