# DeepSeek 接入沙盒 Claude Code 教师链路实测报告

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

日期：2026-11-24 · 项目：`${WORKSPACE}/3d-animation-agent`  
教师模型：`deepseek-v4.1-flash-1017`（服务端回传 `deepseek-v4-1-flash-261017`，经 3D 专用 `.env.deepseek` 直连 PhanRouter）

## 1. 结论

**3D 专用 DeepSeek 已完整接入沙盒 Claude Code 教师环境，并打通「沙盒编码 → Chromium `file://` 渲染与多图自检 → 独立验收 → 完整 HTTP 抓包 → 27B Dense Swift Ready 多模态蒸馏格式」全链路。**

- 修复题 `repair-ferris-seam` 在 **110.5 秒** 内自然收敛（`exit=0`、`is_error=false`、`check_ok=true`），14/14 轮 HTTP 请求 100% 完整归档（`archived_all_observed=true`），经 `export_claude_streams.py --multimodal` → `qwen38_swift_normalize.py` → `build_ready_preserve_media.py` → `validate_claude_swift_batch.py`（真实 `ms-swift 4.5.2` + `qwen3_8` 模板）一次通过（`input_length=14,849`，`supervised_tokens=7,147`，`images=4`，`tool_calls=22`，0 错误）。
- 生成题 `gen-watermill-loop` 揭示出重要教师调参规律：DeepSeek 视觉精修意愿很强，未加收敛纪律时会在 82 轮/30 图/204K token 处超时；开启默认 `--teacher-guidance` 后，产物目录干净、内联 `file://` 验收通过、上下文压回 **112K / 11 图**，但从零生成题在批量采集时仍建议保留脚本默认 `--timeout 3600`（而非 900s/1200s），避免精修尾声被提前截断。

## 2. 沙盒加固改动

- **Node 20 自动注入**：run_claude_cases.py（本地附件未发布） 自动将 `${USER_HOME}/local/node20/bin` 置于 `PATH` 首位，防止非交互子壳误落回系统 `/usr/bin/node` v12。
- **默认开启 `--episode-capture` 中转全量抓包**：run_claude_cases.py（本地附件未发布） 与 run_claude_collection.py（本地附件未发布） 默认开启每 trial 独立 loopback relay（`--no-episode-capture` 仅作排障回退）；新增 export_episode_capture.py（本地附件未发布） 直接从 `episode/request-*` 导出带完整 `system`、OpenAI 格式 `tools` schema、compaction 边界切段与 `<image>` 占位的训练样本。
- **清理冗余交互入口**：按用户要求删除临时交互包装脚本 `scripts/claude-deepseek-3d`，统一收口至 3D 专用 `.env.deepseek` + `run_claude_cases.py` / `run_claude_collection.py` 教师采集链路。
- **单 trial 沙盒隔离（0 自动记忆污染）**：每个 trial 独立 `.claude-config` + `settings.json: {"autoMemoryEnabled": false}` + `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` + `--setting-sources ""` + `--disable-slash-commands` + `--strict-mcp-config`。实测自动记忆写入为 **0**。
- **DeepSeek 教师收敛纪律（`--teacher-guidance`，`--model deepseek` 默认开启）**：通过 `--append-system-prompt` 约束内联单文件 `file://` 验证、临时脚本放 `output/` 外、1–2 轮有界视觉返修，不改动 `OUTPUT_CONTRACT` 与 `prompt_sha256`，完全兼容既有导出脚本。
- **JSONL 行读取修复**：export_claude_streams.py（本地附件未发布） 与 run_claude_cases.py（本地附件未发布） 改用逐行迭代，规避 Unicode 行分隔符（如 `\x85`）被 `.splitlines()` 误拆行。

## 3. 四次 Canary 实测明细

| 题目 / Trial | 配置 | 耗时 | 退出 / 终态 | 交付与 `check_claude_case.mjs` | 请求 / 图片 / 末轮输入 token | 备注与画面复核 |
|---|---|---:|---|---|---|---|
| `gen-watermill-loop` / `trial-1` | `high`, 900s, 无 guidance | 916.8s | `143` (timeout) | `delivered=true`, **`check_ok=true`** | 41 req / 11 图 / 113K | 36 段思考 206K 字，0 自动记忆写；DeepSeek 看图核对 `t=0/0.822/5.226s` 确认水车旋转 ~100°/260°、水流变化、无遮挡穿模 |
| `gen-watermill-loop` / `trial-2` | `medium`, 1800s, 无 guidance | 1841.0s | `143` (timeout) | `delivered=true`, `check_ok=false` | 82 req / 30 图 / 205K | 走本地 HTTP 未内联导致 `file://` CORS 失败；无收敛约束致无限视觉精修 |
| `gen-watermill-loop` / `trial-3` | `medium`, 1200s, **`--teacher-guidance`** | 1211.7s | `143` (timeout) | `delivered=true`, **`check_ok=true`** | 51 req / 11 图 / 112K | `output/` 干净无杂文件、token 减半落入 27B 180K 上限内，仅多机位对比未在 1200s 内写完终答 |
| **`repair-ferris-seam` / `trial-1`** | `medium`, 1800s, **`--teacher-guidance`** | **110.5s** | **`0` (`is_error=false`)** | `delivered=true`, **`check_ok=true`** | **14 req / 4 图 / 14.8K (27B)** | **精准定位 `time > duration - .2` 接缝 bug 并修复；`episode_capture` 14/14 无错；DeepSeek 看图确认旋转明显且原几何完好；27B Swift Ready 1/1 全过** |

## 4. 27B Dense 蒸馏链路实测产物

### 4.1 升级后中转直出链路（`episode/request-*` → `export_episode_capture.py` → Swift 4.5.2 Ready，推荐主链路）

| 样本 | 来源 Episode | `verify_episode_capture` | 输出目录 | `input_length` / `supervised` | `system` + `tools` | 图片 / 工具调用 | Ready SHA-256（前 8 位） |
|---|---|---|---|---:|---|---:|---|
| DeepSeek `repair-ferris-seam/trial-1` | `deepseek/repair-ferris-seam/trial-1/episode` | **passed**（14/14） | `episode-distill-repair-ferris/` | **18,881** / **7,147** | 4,682 字 + 6 工具（10,328 字） | 4 图 / 22 调用 | `ef20b259` |
| Kimi `capture-canary-cube/trial-1` | `proxy-capture-20261124-001/run1/.../episode` | **passed**（11/11） | `episode-distill-kimi-canary/` | **10,957** / **4,547** | 5,757 字 + 6 工具（10,328 字） | 1 图 / 12 调用 | `74cc69f5` |

- 两条样本在真实 `ms-swift 4.5.2` + `qwen3_8` 模板均一次通过（`batch_ready_loader_and_template_passed`，`system_prompt_and_tools_present_in_all_records: true`，`errors: []`）。对比同条 DeepSeek 样本的 `stream-json` 导出（14,849 token），中转直出多补齐了 **+4,032 token 的真实 Claude Code 系统提示词与 6 工具 JSON schema**，且监督目标一致（`supervised_tokens=7,147`）。
- 导出器自动剥离每轮动态变化的 `x-anthropic-billing-header`、兼容 Claude Code 对 `Bash` 历史中冗余 `cd <cwd> &&` 的规范化改写（记入 `client_tool_input_rewrites`，避免误触发 compaction 切段），并在真正发生上下文压缩时按段拆分。

### 4.2 早期 `stream-json` 烟测产物（`legacy_approx` 对照保留）

目录：`reports/deepseek-teacher-canary-20261124-001/distill-smoke-repair-ferris/`

- 多模态导出：`openai.jsonl`、`exchange.jsonl`、`native-swift.jsonl`、`images/image-000..003.png`、`provenance.json`
- Swift Ready 与模板验收：`normalized.swift.jsonl`、`ready.jsonl`（SHA-256 `b56aa91f...`）、`ready-stats.json`、`swift-validation.json`（`input_length=14,849`，`supervised_tokens=7,147`，`images=4`，`tool_calls=22`，缺 `system` 与 `tools` schema）

## 5. 批量采集与中转导出推荐命令

```bash
cd ${WORKSPACE}/3d-animation-agent

# 单题测试（已默认开启 --episode-capture 与 --teacher-guidance，保留 --timeout 3600）
python3 scripts/run_claude_cases.py \
  --model deepseek --case repair-ferris-seam \
  --run-root reports/<new-run-root> \
  --concurrency 1 --effort medium --timeout 3600

# 批量教师采集（默认读取 .env.deepseek，默认开启 --episode-capture 与 --teacher-guidance）
python3 scripts/run_claude_collection.py \
  --cases-file evals/collection-v1/cases.json \
  --model deepseek --run-root reports/<new-collection-root> \
  --samples 3 --concurrency 8 --effort medium --timeout 3600

# 中转完整性验收 + 直出 27B OpenAI / Native-Swift 数据
python3 scripts/verify_episode_capture.py reports/<new-run-root>/deepseek/repair-ferris-seam/trial-1/episode
python3 scripts/export_episode_capture.py reports/<new-run-root>/deepseek/repair-ferris-seam/trial-1 \
  --output-dir reports/<new-export-dir> --multimodal
```
