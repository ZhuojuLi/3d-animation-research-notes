# 首版 SFT 运行问题记录

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

更新时间：2026-11-23

## 已解决

### 末步与训练 loss 的记录间隔不对齐

训练每 10 步记录一次 loss，因此最后一条训练 loss 在 10,940 步。框架在第 10,946 步完成 812 条验证并写出最终检查点，两台训练机正常退出。监督脚本原先还要求最后一条训练 loss 出现在第 10,946 步，因而误报 `needs_attention`。已改为校验最终验证迭代号、有限的验证 loss、两节点退出码和对应检查点，再用原始运行记录复核。完成记录分别保留最后一次训练 loss 的步数和实际完成步数。训练日志（本地附件未发布） · 完成记录（本地附件未发布）

### 1. Smoke 数据的 `tools` 字段类型不一致

- **现象**：第一版 smoke 输入中，Aodi 行的 `tools` 是 JSON 数组，ReAct 行的 `tools` 是字符串 `"[]"`。Arrow JSON loader 报 `Column(/tools) changed from array to string`，随后触发 `ValueError: Trailing data`。
- **处理**：在 smoke 派生输入中统一空工具列表的序列化，生成 `train-v2.jsonl`，保留原始封版数据不改写。
- **结果**：第二次 smoke 成功读取最长样本，并完成三步训练。
- **证据**：`${SHARED_DATA}/3d-agent-smoke/megatron-smoke-20261123-001/attempt-01/`、`attempt-02/`。

### 2. CPU 模板审计容器缺少 UID 1002 的 passwd 记录

- **现象**：Swift 模板审计第一次在容器中调用 `getpass.getuser()` 时报告 `KeyError: getpwuid(): uid not found: 1002`。
- **处理**：为审计容器设置 `USER`、`LOGNAME`，并将 TorchInductor 缓存指向容器内目录。
- **结果**：后续审计进入模型加载阶段。
- **证据**：`template-audit.log`、`template-audit-v2.log`。

### 3. Swift 无法自动判断模型类型

- **现象**：模型目录同时匹配 `qwen3_5` 和 `ovis_ocr2`，自动匹配报告 `Multiple possible types found`。
- **处理**：模板审计显式传入 `model_type='qwen3_5'`。
- **结果**：全量 11,758 条 train/validation 行完成目标模板编码，0 个错误。
- **证据**：`template-audit-v3/summary.json`。

## 当前运行中的问题与限制

### 4. 长序列导致正式训练速度低

- **现象**：训练数据包含 167 条超过 64K、6 条超过 128K，最长 171,524 token。正式训练第 20 步的平均速度约 61.6 秒/步，实时估计剩余约 7 天 19 小时。
- **原因**：当前是 27B 全参数更新，TP=4、PP=4、16 张 H800，`micro_batch_size=1`、`global_batch_size=1`。PP=4 时只有一个 micro-batch，流水线气泡较大。长 ReAct 序列还包含工具调用和图片。
- **现状**：已启用 `padding_free=true`、Flash Attention、序列并行、全层重计算和融合交叉熵。padding 不是当前主要浪费来源。
- **后续选项**：提高 global batch 以增加梯度累积 micro-batch、等待更多 GPU 后扩展并行规模、对长样本单独分阶段或限制其曝光。任何会改变当前训练配方的操作都需要重新启动训练。
- **证据**：`start/output/args.json`、`start/output/logging.jsonl`、`STATUS.json`。

### 5. Transformer Engine 融合交叉熵有稳定性警告

- **现象**：正式日志提示 `cross entropy loss fusion has known stability issues`，当前配置使用 `cross_entropy_fusion_impl=te`。
- **现状**：smoke 三步中 loss、梯度和参数更新均有限且成功，正式训练前 20 步未出现 NaN、Inf 或 optimizer update failure。
- **后续选项**：如果出现非有限 loss 或梯度，恢复到最近检查点时改用 `cross_entropy_fusion_impl=native`，并记录为新的运行尝试。
- **证据**：`start/node-*/train.log`、`../megatron-smoke-20261123-001/acceptance.json`。

### 6. NCCL 进程组出现设备推断警告

- **现象**：日志提示 `Guessing device ID based on global rank`，并建议初始化进程组时显式设置 `device_id`。
- **现状**：NCCL 正常初始化，16 个 rank 的 smoke 和正式训练均已进入训练步骤，当前没有 hang 或通信错误。
- **证据**：`start/node-*/train.log`。

### 7. TorchDynamo 和 CUDA stream 警告

- **现象**：日志出现 lru-cache tracing 提示，以及 `AccumulateGrad node's stream does not match` 警告。
- **现状**：当前只作为运行时警告记录。smoke 的梯度范数有限，抽查参数在三步中均发生更新。
- **证据**：`start/node-*/train.log`、`../megatron-smoke-20261123-001/acceptance.json`。

## 运行状态

正式训练由 systemd 单元 `threejs-first-sft-20261123-001.service` 监督，当前状态、最新步数、日志路径和恢复次数写入 STATUS.json（本地附件未发布）。训练过程使用独立运行目录，原始封版数据和 smoke 现场均保留。
