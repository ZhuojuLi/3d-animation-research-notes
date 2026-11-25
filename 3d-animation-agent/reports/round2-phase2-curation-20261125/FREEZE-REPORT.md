# Round 2 27B SFT Frozen Dataset (`round2-sft-27b-v3`)

> 公开整理版 · 2026-11-25。保留成文时点的记录；计划、文献结果和本地实测请分别理解。 环境路径已泛化，未收录的附件已标注；发布范围见 [整理说明](../../../PROVENANCE.md)。

- Created: `2026-11-25T06:47:12.575936+00:00`
- Staged Directory (Shared JuiceFS): `${SHARED_DATA}/3d-animation-reports/round2-sft-27b-v3`
- Teacher: `deepseek-v4.1-flash-1017 (effort=high, unified repos-logging-proxy)` (Legacy Kimi 249 completely retired)
- Staged Self-Contained Media: **4536** unique verified PNGs (`460.3 MiB` in `media/`)

## Five-Ledger Accounting (`train-v2-full.ready.jsonl`)

| Pool | Records | Images | Input Tokens | Supervised `U` | Weighted `W` | Share of `U` | Share of `W` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Pool 1: DeepSeek ReAct (Multimodal) | 325 | 3,153 | 20,016,887 | 12,977,490 | 17,280,898 | 17.60% | 22.37% |
| Pool 2a: DeepSeek Offline r180 One-Shot | 573 | 0 | 14,099,030 | 13,780,624 | 12,422,121 | 18.68% | 16.08% |
| Pool 2b: Aodi DeepSeek Tier S/A 3D (Visual-Refined) | 226 | 0 | 4,777,071 | 4,644,587 | 4,036,788 | 6.30% | 5.23% |
| Pool 3: Aodi Stratified Base | 2,250 | 0 | 28,027,920 | 27,751,514 | 27,751,514 | 37.63% | 35.93% |
| Pool 4: SWE Multi-Turn Replay | 700 | 0 | 20,968,104 | 8,717,360 | 9,092,438 | 11.82% | 11.77% |
| Pool 5a: DeepSeek Image-to-3D Single-Turn (Dual Contract) | 158 | 158 | 2,477,391 | 2,326,840 | 1,999,591 | 3.15% | 2.59% |
| Pool 5b: DeepSeek Image-to-3D ReAct (Visual Compare) | 46 | 1,013 | 4,790,158 | 3,555,209 | 4,657,388 | 4.82% | 6.03% |
| **Total (`v2-full`)** | **4,278** | **4,324** | **95,156,561** | **73,753,624** | **77,240,738** | **100.00%** | **100.00%** |
| **Ablation (`v2-oneshot-only`)** | **3,907** | **158** | **70,349,516** | **57,220,925** | **55,302,452** | — | — |

- Pool 1 `Write.content` tokens: `4,246,752` (`33.47%` of Pool 1 assistant tokens, `5.76%` of total `v2-full` supervised `U` — zero Round 1 bloat).

## Multi-Track Validation Sets

- `val-react.ready.jsonl`: **17** trajectories (162 images, `8/8` val families)
- `val-oneshot.ready.jsonl`: **32** offline Three.js r180 scenes (all 8 categories)
- `val-aodi.ready.jsonl`: **256** stratified Aodi validation scenes (`0` UUID overlap with train)
- `val-combined.ready.jsonl`: **324** combined validation records

## Staged Artifact SHA-256 Checksums

| Artifact | Rows | Size (MiB) | SHA-256 |
| --- | ---: | ---: | --- |
| `pool1-react-train.ready.jsonl` | 325 | 60.57 | `ec34c17ebd5ff1d4cae1061e74fbebc30aa2d591d818b83802b8c985578add8e` |
| `pool2-oneshot-train.ready.jsonl` | 573 | 38.40 | `988a9e1e7573c3c4850ab0f187fe1fee1d69c053816f329a17f0d06e0ecf3936` |
| `pool3-aodi-train.ready.jsonl` | 2,250 | 83.98 | `40907de6c4ffff18d4fda3311c679f7d3dec5f02f5cc174318d0513ca46702b5` |
| `pool4-swe-train.ready.jsonl` | 700 | 77.20 | `f7acc3a18cfae256c8b77f7215f837f7f85851a50c4b19767c397ae8ffca7ad2` |
| `train-v2-full.ready.jsonl` | 4,278 | 294.37 | `81f15cd47d6cf07e602d6d784945d1d9648aaf66a2ff2702afb7eeff1e55f483` |
| `train-v2-oneshot-only.ready.jsonl` | 3,907 | 220.02 | `733769d7fe7bd165b8061607f15b0792b3a36e760663b3ad26e5554aec276d75` |
| `val-react.ready.jsonl` | 17 | 3.03 | `747e61fdd923c5a495100df131ae1ed0ff51e7f0c8182b3e99080f1d65c84cb7` |
| `val-oneshot.ready.jsonl` | 32 | 2.15 | `21a81060eb8570e80286bedd0cd0c395fceb09774a58be9c9f3dedac9de2f57d` |
| `val-aodi.ready.jsonl` | 256 | 9.27 | `1b7bede955df71a1cdbc221ca1821434c48cc09edada6144cb17f93d9b62d933` |
| `val-combined.ready.jsonl` | 324 | 16.34 | `9de2b3b1746daf7f50caf463c7606840e097541dd7851fb05775b9f5be8033ae` |
| `pool2b-aodi-tierSA-3d-train.ready.jsonl` | 226 | 13.50 | `e49acfd908ad8bea8ba04607ae0fd3c79dc10b30a72bd87246f2cf12c837b563` |
| `pool5a-img23d-oneshot-train.ready.jsonl` | 158 | 6.94 | `aaf9b927be64eedf240f741f9b1afe96205df5fc0c5a9653e9b05ee833113a90` |
| `val-img23d-oneshot.ready.jsonl` | 15 | 0.70 | `30bfe50633f555f1e45f4c6f2bb6bb8f9e761328be9c7151c3a80174972c2781` |
| `pool5b-img23d-react-train.ready.jsonl` | 46 | 13.79 | `6fc869658d4f35b0cc834311dd3e00c68588f26e84057f03909bf164ef249936` |
| `val-img23d-react.ready.jsonl` | 4 | 1.19 | `dca100beb9558f0a2f9b1798b239dd7c7eb922a1720954b4a64117fe65b2bb2e` |
| `pool1-react-train.clean.openai.jsonl` | 325 | 60.26 | `5f7d8f3740db3559f41df4290f5e9415c94034bda50564692e23cf7352f9e9fb` |
| `pool1-react-val.pruned.openai.jsonl` | 17 | 3.01 | `eb52b13b575a6f775b7d24a1593ba2c3a33b4f4a3c7f3add5edf069b37b3a717` |
| `pool2-oneshot-train.clean.openai.jsonl` | 573 | 38.41 | `c790b610b7706d2d34518da6ce6bd87109a524b97912725512808156a578fada` |
| `pool2-oneshot-val.pruned.openai.jsonl` | 32 | 2.15 | `5954f1002508a4f9561aae86541c20a11d28728d3034d5cab3fc53ef07b8a62f` |
| `pool2b-aodi-tierSA-3d.clean.openai.jsonl` | 226 | 13.50 | `03cc118ced8861900f18018742705f86fce2a9fa56ddd700a59989ace24d3c41` |
| `pool5a-img23d-oneshot-train.clean.openai.jsonl` | 158 | 6.94 | `78a64c75229cd10afea11aff7fd3027cc35021d6feb385c0b221d3662b77c15f` |
| `pool5a-img23d-oneshot-val.clean.openai.jsonl` | 15 | 0.70 | `ae6a609f8fe1f4b64318fe1f2b7dd3e8d1fb9c580db3370d7122050171216184` |
| `pool5b-img23d-react-train.clean.openai.jsonl` | 46 | 13.77 | `16c2fd31ca6015075a044c8543e01459f06475e1fa7c123f16870d4b8aa9647d` |
| `pool5b-img23d-react-val.clean.openai.jsonl` | 4 | 1.19 | `3070963cf56f36e25df5986115cf086d5ffd51fe04bf53b348393c9e514f0854` |
