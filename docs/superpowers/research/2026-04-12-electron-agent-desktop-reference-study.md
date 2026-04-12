# Electron + Agent 桌面端参考架构调研

- 日期: 2026-04-12
- 范围: `resonote` 桌面架构工程化调研
- 目的: 把外部 GitHub 项目的架构经验沉淀成当前仓库可执行的设计结论

## 1. 参考项目清单

### 1.1 Witsy

- 仓库: <https://github.com/nbonamy/witsy>
- 定位: 桌面 AI assistant + 通用 MCP client
- 值得借鉴的点:
  - 以 Electron 桌面壳为主路径，Provider、MCP、转录、RAG、快捷唤起都围绕桌面产品组织
  - 虽然提供 localhost HTTP API 给外部集成，但 renderer 主路径不是靠 HTTP 回环自我通信
  - Provider / model / tool 都是显式配置能力，不是散落在 UI 里的隐式运行时状态

### 1.2 Alice

- 仓库: <https://github.com/pmbstyle/Alice>
- 定位: 语音优先的 Electron AI assistant
- 值得借鉴的点:
  - Electron 壳、AI backend、语音链路、持久化、工具权限边界清晰
  - 明显偏向 local-first：本地 DB、长期记忆、工具和 Provider 的本地配置
  - 对 shell / 文件 / 电脑使用能力采用显式批准模型，而不是默认放开系统权限

### 1.3 Electron LLM

- 仓库: <https://github.com/electron/llm>
- 定位: Electron 官方提供的本地 LLM 进程架构参考
- 值得借鉴的点:
  - 重型模型不跑在 renderer，也不直接跑在 `main`
  - 模型放到 utility process 中，通过 IPC 回传结果
  - 这类项目的核心价值不是“功能多”，而是把 Electron 进程边界设计清楚

### 1.4 Bytebot

- 仓库: <https://github.com/bytebot-ai/bytebot>
- 定位: 完整的桌面 agent 系统
- 值得借鉴的点:
  - 产品拆成执行环境、agent runtime、任务 UI、自动化接口等独立单元
  - 长任务是可观测的，UI 能持续看到执行进度，而不是同步阻塞式调用
  - 一旦产品从“单次推理”变成“多步 agent 任务”，运行环境与状态接管就会成为核心架构问题

## 2. 这些项目共同说明了什么

### 2.1 Electron 壳要薄，重运行时要独立

最稳的模式都是:

- `main` 负责生命周期、窗口、app-data 路径、IPC 注册、安全边界
- `preload` 只暴露窄而稳定的 typed bridge
- 重工作负载放到 worker / utility process / sidecar runtime

这是最关键的共同点。否则桌面应用很快就会演变成不可测试、不可替换、不可维护的单体主进程。

### 2.2 应按运行时领域拆分，而不是按传输方式拆分

好的桌面 agent 项目不会围绕 HTTP route、fetch helper、WebSocket URL 来组织系统，而是围绕领域能力拆分:

- 语音 / 转录
- Provider 管理
- Agent tooling / MCP / 自动化
- 持久化 / memory
- UI 呈现层

这种拆法更利于测试、演进和后续 agent 化。

### 2.3 Local-first 不是细节，而是产品前提

成熟桌面项目几乎都默认:

- 配置在 app data 下
- Provider / tool / model 状态长期持久化
- 敏感 secret 不以 renderer 普通状态长期保存
- 模型与工具元数据视为运行时资产，而不是浏览器临时缓存

这比延续浏览器时代的 env/localStorage 思路更符合桌面产品。

### 2.4 IPC 是默认主路径，HTTP 只能是可选适配层

最强的 Electron-native 方案不会为了“兼容旧系统”而继续让 renderer 依赖 localhost HTTP/WebSocket 自己绕一圈。如果存在 HTTP，通常只是给:

- 外部自动化
- CLI
- webhook / trigger
- 生态互通

也就是说，以后可以补 HTTP，但它应当架在桌面 runtime 之上，而不是作为 renderer 的基础通信层。

### 2.5 工具能力必须配套权限边界

一旦桌面 agent 能执行命令、访问文件、调用系统能力，权限模型就不再是附属问题，而是架构问题:

- 权限要显式授权
- 授权要可撤销
- 设置面板要能看见启用能力
- 最好能审计或最少可追踪

否则系统很容易走向不可控的“临时脚本拼接”。

### 2.6 长任务必须事件化

下载模型、语音识别、推理、工具执行、agent 多步任务都不适合阻塞式 request/response。成熟实现普遍会通过 event bus / progress stream / runtime status 持续把状态抛给 UI。

## 3. 对 `resonote` 的直接结论

当前仓库方向总体是对的，外部调研实际上强化了以下判断。

### 3.1 现在已经做对的部分

1. 桌面主路径使用 typed IPC。
   - `packages/contracts`
   - `desktop/src/preload/desktop-api.ts`
   - `client/lib/desktop/desktop-client.ts`

2. renderer 没有直接依赖裸 Electron API。
   - 当前 settings / dashboard 都是通过 desktop client 抽象访问桌面能力。

3. Provider 管理被收敛成独立 runtime 子系统。
   - `desktop/src/runtime/providers/provider-service.ts`
   - SQLite + secret 加密 + adapter 分发，这个形状是正确的。

4. ASR 与 provider / emotion 被拆成不同运行时模块。
   - `desktop/src/runtime/asr/*`
   - `desktop/src/runtime/emotion/*`

### 3.2 明确不应该走回去的路

1. 不要把 localhost HTTP/WebSocket 重新引回 renderer 主路径。
2. 不要让 React 组件直接碰 Electron 内部对象。
3. 不要把 ASR、provider、OSC、emotion inference 又揉成一个大 service。

### 3.3 最高杠杆的下一步

1. 用真正的 production runtime 装配替换默认 in-memory bootstrap。
   - 当前默认仍接在 `desktop/src/main/ipc/in-memory-desktop-ipc-services.ts`
   - 这适合做合同验证和 UI 验证，但不该长期充当 shipped runtime 的默认装配点

2. 增加明确的 runtime composition 边界。
   - 最好有一个唯一入口工厂，负责装配 app config store、provider repository、crypto、ASR runtime、emotion service、OSC service
   - 这样后续要替换实现、做 smoke、做 packaging 都会容易很多

3. 如果未来要加 HTTP，只能作为外部适配层。
   - 比如给 CLI、自动化触发器、第三方集成使用
   - 不要再让 renderer 状态流依赖它

4. 如果产品往更强 agent 能力走，必须先补权限模型。
   - 可以参考 Alice / Witsy 的做法
   - 先有批准边界，再开放文件、命令、系统自动化能力

5. 清理浏览器时代遗留的 transport 代码。
   - 当前桌面主路径已经不依赖 endpoint settings
   - `client/lib/config.ts`
   - `client/lib/useEventStream.ts`
   - `client/components/settings/SettingsEndpointSection.tsx`
   - 这些都应视为待确认的清理候选，除非浏览器模式仍是明确保留的产品形态

## 4. 当前分支应该如何表述

为了避免对进度表述过头，当前分支更准确的说法应该是:

- 已落地:
  - Electron + preload + typed IPC 主链路
  - 桌面 contracts 包
  - ASR settings UI 和事件驱动更新
  - provider runtime 模块，以及 SQLite 持久化和 secret 加密
- 尚未证明已具备 shipped runtime parity:
  - 默认 bootstrap 已切到真实 production runtime 栈
  - 在真实 GUI / 麦克风 / Provider / OSC 环境下完成 smoke 验证
  - `desktop/src/runtime` 下的模块已经是默认运行路径，而不只是目标实现路径

这点非常重要。仓库现在的架构方向是对的，但从“设计正确”到“默认运行时真正接线并可出货”，中间还差 runtime composition 和实机 smoke 这两步。

## 5. 总结建议

如果目标是把项目继续做得更工程化，`resonote` 应坚持这条架构主线:

1. Electron shell
2. typed preload bridge
3. 按 ASR / provider / emotion / OSC 分层的 runtime services
4. app data 下的 local-first 持久化
5. 外部集成能力作为上层 adapter，而不是底层依赖

这条路线和这次调研到的优质 Electron + agent 桌面端项目是基本一致的。
