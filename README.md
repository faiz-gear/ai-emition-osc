# AI Emotion Desktop

本项目的主路径已经切换为 **Electron 桌面应用 + Next.js renderer + typed IPC + 本地 Whisper ASR**。  
当前的桌面运行时负责麦克风采集、语音识别、情绪推断、Provider 管理与 OSC 输出；renderer 只通过 preload 暴露的桌面客户端访问运行时，不再依赖本地 HTTP / WebSocket 服务。

## 当前架构

核心链路：

1. Electron `main` 进程启动桌面运行时，并注册 typed IPC 命令 / 事件
2. `preload` 通过 `contextBridge` 暴露 `window.desktopApi` 与采集桥接 API
3. Next.js renderer 使用 `client/lib/desktop/desktop-client.ts` 访问桌面能力
4. ASR 通过本地 Whisper 模型完成转写；情绪推断通过可配置 Provider 执行
5. 最终转写、情绪结果、运行时指标通过 IPC 事件流回传到 dashboard，同时可通过 OSC 输出给外部应用

主工作区结构：

```text
ai-emotion/
├── client/              # Next.js renderer（静态导出后供 Electron 加载）
├── desktop/             # Electron main / preload / runtime / capture window
├── packages/contracts/  # renderer 与 desktop 共享的 IPC / domain 合同
├── client-dist/         # 生产构建后拷贝出的 renderer 静态资源
├── server/              # 旧版 Python/FastAPI 运行时（deprecated）
├── main.py              # 旧版 Python CLI 入口（deprecated）
├── speech_recognizer.py # 旧版 Vosk 识别链路（deprecated）
├── voice_processor.py   # 旧版 Python 情绪处理链路（deprecated）
├── start.bat            # 旧版 Windows 启动脚本（deprecated）
└── dev.bat              # 旧版 Windows 开发脚本（deprecated）
```

### Electron 桌面分层

| 层 | 位置 | 责任 |
| --- | --- | --- |
| Contracts | `packages/contracts` | 定义 IPC 命令、运行时事件、ASR / Provider / domain 类型 |
| Main | `desktop/src/main` | Electron 窗口生命周期、IPC 注册、桌面 runtime 装配 |
| Preload | `desktop/src/preload` | 通过 `contextBridge` 暴露受控桌面 API，隔离 renderer 与原生 Electron |
| Runtime | `desktop/src/runtime` | Whisper ASR、模型下载、Provider 存储与加密、情绪推断、OSC 输出 |
| Renderer | `client` | 控制台与设置页面；通过 desktop client 订阅 snapshot / runtime events |

> 设计约束：桌面主路径不再提供 HTTP / WebSocket 兼容层；renderer 不应直接调用裸 Electron API。

## 环境要求

- Node.js 20+ 与 npm
- macOS 或 Windows（桌面端主路径）
- 可用麦克风设备
- 至少一个情绪推断 Provider（例如 Ollama、OpenAI 或 OpenAI-compatible）

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
cd client
npm run lint
npm run test:unit
npm run build
cd ..
npm run desktop:build
```

## ASR 模型下载与识别策略

桌面主路径使用 **本地 Whisper 模型**，当前模型目录由 Electron user-data 下的 runtime 路径管理（`asr-models`）。

当前内置模型目录：

- `whisper-tiny`
- `whisper-base`（推荐默认）
- `whisper-small`

行为说明：

- 首次启动时如果没有已安装模型，用户需要先到 **Settings → ASR Models** 下载至少一个模型
- 模型下载会通过运行时事件持续回传 `queued / downloading / verifying / ready / failed` 状态和进度
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

`/settings` 当前主要包含：

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

- Provider 配置存储在桌面 runtime 的 SQLite 数据库中
- 敏感字段会先加密，再持久化到 SQLite（encrypted at rest）
- 情绪推断结果会在 dashboard 中展示，并可通过 OSC 输出到外部应用
- 默认 OSC 配置为 `127.0.0.1:9000`

## Legacy Python / Vosk 路径（Deprecated）

以下内容目前仅为临时保留，不再是主运行路径：

- `server/`
- `main.py`
- `speech_recognizer.py`
- `voice_processor.py`
- `start.bat`
- `dev.bat`

这些旧入口对应的是 **Python + FastAPI + Vosk + HTTP/WebSocket** 方案。  
Electron 桌面路径完成实机 parity 验证前，它们会暂时共存；在 parity 被确认后，应继续移除或归档这些 legacy 入口。

> 新功能与后续维护默认应落在 Electron 桌面主路径，不要再为旧版 Python/Vosk 主链路扩展能力。

## 手工 Smoke 验证清单

在有图形界面、麦克风与可用 Provider 的环境中，建议按以下顺序验证：

1. 空模型状态是否引导用户先下载模型
2. 模型下载是否显示实时进度
3. 模型激活是否仅在 idle 状态允许
4. Start / Stop listening 是否工作
5. Final transcript 是否出现在 dashboard
6. Emotion inference result 是否出现
7. Provider 管理是否工作
8. OSC 输出是否发出

如果要退休 legacy Python 路径，请先完成上述 parity 验证。
