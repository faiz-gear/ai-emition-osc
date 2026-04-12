# AI Emotion Desktop

本项目的迁移主方向是 **Electron 桌面应用 + Next.js renderer + typed IPC + 本地 Whisper ASR**。  
当前分支已经完成 renderer 到 preload/IPC 的主链路切换，不再依赖本地 HTTP / WebSocket 服务；Electron `main` 现在通过 `desktop/src/main/runtime/create-desktop-ipc-services.ts` 统一装配桌面服务，并引入显式 runtime mode。非测试环境默认走 desktop runtime，测试环境默认走 in-memory harness；`desktop/src/runtime` 下的 Whisper / Provider / OSC / 持久化模块已经接入默认装配路径，但完整桌面端到端 parity 仍需要在有 GUI、麦克风和可用 Provider 的环境里做手工 smoke。

补充的外部参考项目调研见 `docs/superpowers/research/2026-04-12-electron-agent-desktop-reference-study.md`。

## 当前架构

核心链路：

1. Electron `main` 进程注册 typed IPC 命令 / 事件，并创建桌面窗口
2. `preload` 通过 `contextBridge` 暴露 `window.desktopApi` 与采集桥接 API
3. Next.js renderer 使用 `client/lib/desktop/desktop-client.ts` 访问桌面能力
4. `desktop/src/main/runtime/create-desktop-ipc-services.ts` 作为 composition root，根据 runtime mode 装配 desktop runtime 或 in-memory harness
5. `desktop/src/runtime` 中已经实现 Whisper / Provider / OSC / 持久化相关模块，并由默认 desktop runtime 装配路径消费

### 当前接线状态

- renderer 与 settings 主链路已经通过 preload + typed IPC 工作
- Electron bootstrap 会先解析 runtime mode，再通过 composition root 装配服务；`AI_EMOTION_DESKTOP_RUNTIME_MODE=in-memory` 可强制切回 harness
- `desktop/src/runtime` 下的 SQLite、加密存储、Whisper 下载/管理、OSC 等模块已接入默认 desktop runtime 装配链路，但 README 下面提到的这些能力仍未完成真实人工验收
- 手工 smoke parity 仍待在有 GUI、麦克风和可用 Provider 的环境中验证

主工作区结构：

```text
ai-emotion/
├── client/              # Next.js renderer（静态导出后供 Electron 加载）
├── desktop/             # Electron main / preload / runtime / capture window
├── packages/contracts/  # renderer 与 desktop 共享的 IPC / domain 合同
└── docs/                # 设计说明与实现计划
```

### Electron 桌面分层

| 层 | 位置 | 责任 |
| --- | --- | --- |
| Contracts | `packages/contracts` | 定义 IPC 命令、运行时事件、ASR / Provider / domain 类型 |
| Main | `desktop/src/main` | Electron 窗口生命周期、IPC 注册、桌面 runtime 装配 |
| Preload | `desktop/src/preload` | 通过 `contextBridge` 暴露受控桌面 API，隔离 renderer 与原生 Electron |
| Runtime | `desktop/src/runtime` | 目标桌面 runtime 模块：Whisper ASR、模型下载、Provider 存储与加密、情绪推断、OSC 输出 |
| Renderer | `client` | 控制台与设置页面；通过 desktop client 订阅 snapshot / runtime events |

> 设计约束：桌面主路径不再提供 HTTP / WebSocket 兼容层；renderer 不应直接调用裸 Electron API。

### Runtime Mode

- `desktop`：默认桌面运行时；在 Electron user-data/runtime 下使用 app config、SQLite provider repository、provider secret key、model store 和 OSC service
- `in-memory`：测试 / 开发 harness；保留 IPC 合同验证和无副作用的 UI 流程验证能力
- 环境变量：`AI_EMOTION_DESKTOP_RUNTIME_MODE=desktop|in-memory`

## 环境要求

- Node.js 20+ 与 npm
- macOS 或 Windows（桌面端主路径）
- 可用麦克风设备
- 至少一个情绪推断 Provider（例如 Ollama、OpenAI 或 OpenAI-compatible）
- 若启用真实 provider 持久化/加密路径，需要设置 `AI_EMOTION_PROVIDER_SECRET_KEY`

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式

桌面开发模式需要同时启动 renderer 与 Electron：

终端 A：

```bash
cd client
npm run dev
```

终端 B：

```bash
npm run desktop:dev
```

说明：

- renderer 开发服务器默认运行在 `http://localhost:3000`
- `desktop:dev` 会启动 Electron main / preload 与 capture renderer
- 桌面主窗口通过 preload 暴露的 `window.desktopApi` 与运行时通信

### 3. 生产构建

构建完整桌面产物：

```bash
npm run build
```

这会依次：

1. 构建 `@ai-emotion/contracts`
2. 构建并静态导出 `client`
3. 将导出的 renderer 拷贝到 `client-dist/`
4. 构建 `desktop/out/` 下的 Electron main / preload / capture 产物

说明：

- desktop renderer 的生产构建应保持离线可构建，不依赖 `next/font/google` 这类外网拉取；否则在 CI、sandbox 或受限网络环境里会直接失败

如果只想单独构建桌面端：

```bash
npm run desktop:build
```

## 根工作区常用命令

| 命令 | 用途 |
| --- | --- |
| `npm install` | 安装根工作区依赖，并为 Electron 原生依赖执行本地编译 |
| `npm run test --workspace @ai-emotion/contracts` | 运行共享 contracts 测试 |
| `npm run test --workspace @ai-emotion/desktop` | 运行桌面 runtime / IPC / main 测试 |
| `npm run desktop:smoke` | 运行稳定的桌面 smoke 套件并构建 renderer + Electron 产物 |
| `cd client && npm run lint` | 运行 renderer ESLint |
| `cd client && npm run test:unit` | 运行 renderer 单元测试 |
| `cd client && npm run build` | 单独构建 Next.js renderer |
| `npm run desktop:build` | 构建 Electron 桌面产物 |
| `npm run build` | 执行完整 workspace 构建 |

Task 13 验证命令：

```bash
npm install
npm run test --workspace @ai-emotion/contracts
npm run test --workspace @ai-emotion/desktop
AI_EMOTION_PROVIDER_SECRET_KEY=<32-byte-secret> npm run desktop:smoke
cd client
npm run lint
npm run test:unit
npm run build
cd ..
npm run desktop:build
```

## ASR 模型下载与识别策略

桌面 runtime 目标路径使用 **本地 Whisper 模型**，对应模型目录设计为 Electron user-data 下的 runtime 路径（`asr-models`）。

当前内置模型目录：

- `whisper-tiny`
- `whisper-base`（推荐默认）
- `whisper-small`

目标行为说明：

- 在真实 desktop runtime 接线完成后，首次启动若没有已安装模型，用户应先到 **Settings → ASR Models** 下载至少一个模型
- 下载流程设计为通过运行时事件回传 `queued / downloading / verifying / ready / failed` 状态和进度
- 第一个完成下载的模型会成为可用模型；激活中的模型不能删除
- 开始监听前必须存在一个 ready 的模型，否则运行时会返回 `ASR_MODEL_NOT_INSTALLED`
- 模型切换与识别策略变更只允许在 **idle / 未监听** 状态下执行

### 识别策略

设置页支持两种识别策略：

- `auto`：自动检测
- `fixed`：固定语言

固定语言当前只支持：

- `zh`
- `en`

Phase 1 不要求 live partial transcript；dashboard 以 finalized transcript 为主。

## 桌面设置面板

`/settings` 当前已经暴露这些桌面设置入口：

1. **Language**  
   切换 UI 本地化语言（`en` / `zh`）

2. **ASR Models**  
   下载、查看进度、激活、删除本地 Whisper 模型；监听中会阻止切换和删除

3. **Recognition Strategy**  
   在自动检测与固定语言之间切换；监听中会阻止修改

4. **Providers**  
   管理情绪推断 Provider（创建 / 更新 / 测试 / 激活 / 删除）

桌面路径下，renderer 不再要求用户配置本地 API / WebSocket endpoint。

## Provider、持久化与 OSC

以下是 `desktop/src/runtime` 已实现的目标能力：

- Provider 配置目标存储为桌面 runtime 的 SQLite 数据库
- 敏感字段目标行为是先加密，再持久化到 SQLite（encrypted at rest）
- 情绪推断结果目标行为是在 dashboard 中展示，并可通过 OSC 输出到外部应用
- 默认 OSC 配置设计为 `127.0.0.1:9000`

这些能力在代码中已经存在，但本分支尚未通过真实桌面 smoke 验证证明“默认 bootstrap 已完整接线并可端到端使用”。

### Provider Secret Rotation

真实 provider 路径要求启动进程提供 `AI_EMOTION_PROVIDER_SECRET_KEY`，用于解密 SQLite 中的 provider secrets。

当需要轮换主密钥时，使用：

```bash
AI_EMOTION_PROVIDER_SECRET_KEY_OLD=<old-secret> \
AI_EMOTION_PROVIDER_SECRET_KEY_NEW=<new-secret> \
npm run provider:rotate-secrets -- --db-path /path/to/providers.sqlite3
```

行为约束：

- 轮换期间会写入 `provider_rotation_lock=1`，阻止 provider create/update/delete/activate/test 以及运行时获取 active chat model
- `providers:list` / active summary 仍允许读取，便于观测与排障
- 任一步骤失败时会回滚事务，并在退出前清除 rotation lock

### Headless Smoke / CI

仓库现在提供 `npm run desktop:smoke` 作为稳定的 headless 验证入口，覆盖：

- `@ai-emotion/contracts` 合同测试
- Electron main / IPC / config / provider runtime 的稳定桌面测试
- renderer 静态导出与 Electron 构建

`.github/workflows/desktop-smoke.yml` 会在 PR 和 `main` push 上执行这条 smoke 路径。GUI、麦克风和真实 provider 的实机验证仍保留在下面的手工 smoke 清单中。

## 手工 Smoke 验证清单

当前状态：自动化验证已完成；下面这组 GUI / 设备相关验证仍待人工执行并记录结果。

在有图形界面、麦克风与可用 Provider 的环境中，建议按以下顺序验证：

1. 空模型状态是否引导用户先下载模型
2. 模型下载是否显示实时进度
3. 模型激活是否仅在 idle 状态允许
4. Start / Stop listening 是否工作
5. Final transcript 是否出现在 dashboard
6. Emotion inference result 是否出现
7. Provider 管理是否工作
8. OSC 输出是否发出

这组清单仍然适合作为桌面主路径的实机 smoke 验证基线。

## 生产级桌面架构设计

为避免当前 Electron 主路径长期停留在 in-memory bootstrap，本仓库新增了针对生产级桌面架构的设计与实施文档：

1. 设计文档：`docs/superpowers/specs/2026-04-12-resonote-production-desktop-architecture-design.md`
2. 实施计划：`docs/superpowers/plans/2026-04-12-resonote-production-desktop-architecture-implementation.md`

这组文档聚焦以下收敛方向：

1. 引入显式 composition root 与 runtime mode，避免 `registerIpc()` 和 Electron bootstrap 隐式依赖 in-memory services
2. 将“真实 desktop runtime”设为默认 shipped 路径，把 in-memory harness 降级为 dev/test 专用
3. 逐步补齐 runtime-core、agent-core、diagnostics、packaging/smoke verification 的生产级边界
