# 35B-A3B 本地模型与官方下载核查

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../PROVENANCE.md)。

2026-11-24。仅做只读检索、官方元数据和小型 `config.json` 探针；未下载大权重，未启动模型服务。

**后续确认：用户说明此前可能记错型号，实际目标是 Qwen3.6-35B-A3B MoE。以下 3.8 搜索仅保留为排查过程；当前可直接复用第 3 项的本地 3.6 原版，无需下载。**

## 结论

1. **当前没有发现本地 Qwen3.8-35B-A3B 原版。** 有界缓存脚本扫描 60,000 个目录项、2,507 个目录，无匹配；扫描受深度、权限和时间限制，不是整盘绝对不存在的证明。随后人工检查了 `${MODEL_ROOT}`、个人模型目录、Aodi 模型目录、Ceph 用户目录和常见本地盘路径，仍无 3.8-35B。
2. **当前官方公开渠道不能下载 Qwen3.8-35B-A3B 原版。** ModelScope 搜索结果存在原版/FP8 占位页，但 SDK 对原版、FP8、Instruct 均返回模型不存在；原版 `config.json` 探针失败。Qwen 官方 Hugging Face 的 Qwen3.8 列表目前只有：
   - `Qwen/Qwen3.8-27B`
   - `Qwen/Qwen3.8-Flash-Next`
   - `Qwen/Qwen3.8-2.4T-A95B`
   - 上述三个对应 FP8

   精确查询 `Qwen/Qwen3.8-35B-A3B` 返回 401，而 Qwen3.6 对照返回 200。占位页不能视为已经发布可下载权重，也不应改下 FP8 或其他尺寸冒充原版。

   证据：[官方 HF Qwen3.8 列表](https://huggingface.co/api/models?author=Qwen&search=Qwen3.8&limit=100)、保存的列表（本地附件未发布）、[ModelScope 占位页](https://modelscope.cn/models/Qwen/Qwen3.8-35B-A3B)。

3. **本地已经有可复用的 Qwen3.6-35B-A3B 原版 BF16：**

   ```text
   /mnt/contest_ceph/i-upstream-ref/model/Qwen3.6-35B-A3B
   ```

   - `Qwen3_5MoeForConditionalGeneration` / `qwen3_5_moe`；BF16。
   - 40 层，256 个专家，每 token 选择 8 个专家，最大位置长度 262,144。
   - 26 个 safetensors 分片，索引张量字节 71,903,645,408；含分片头/元数据的文件总字节 71,903,776,776。
   - 26 个文件名和大小全部与官方 HF manifest 一致；`config.json` 与 ModelScope 官方探针逐字节一致。
   - tokenizer、processor、chat template 均存在，无 `.incomplete` 或 `.aria2`。
   - 官方 HF revision：`345d467b117d1fd5eda9b879a5988de9ae5f47a7`。

   证据：本地完整性与配置核验（本地附件未发布） · [官方 Qwen3.6 模型](https://huggingface.co/Qwen/Qwen3.6-35B-A3B) · [ModelScope Qwen3.6](https://www.modelscope.cn/models/Qwen/Qwen3.6-35B-A3B)。

## 边界与建议

- 尚未对全部约 71.9 GB 权重做 SHA-256，也未进行推理加载；“完整可用候选”依据的是官方分片清单、文件大小、配置和必要组件，不是完整字节哈希或运行验收。
- Qwen3.8-27B 原版已存在于 `${MODEL_ROOT}/Qwen3.8-27B`，继续作为当前 27B 对照，不需要重复下载。
- 若实验目的是 35B-A3B，可直接优先评估本地 3.6 原版，并明确标注它是 3.6 而不是 3.8。若必须严格使用 3.8-35B-A3B，则需等待官方实际发布可下载权重，不能根据占位页开始下载。
