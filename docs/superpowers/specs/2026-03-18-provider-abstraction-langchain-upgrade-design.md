# Provider 抽象层 + LangChain 1.x 升级设计

- 日期: 2026-03-18
- 状态: Draft (已完成用户确认，待 spec review)
- 目标仓库: `ai-emotion`

## 1. 背景与目标

当前后端情绪分析链路在 `EmotionService` 中直接依赖 `ChatOllama`，导致：

1. provider 不可扩展（绑定 Ollama）
2. client 无法自定义 provider
3. 无 provider 配置持久化能力
4. LangChain 仍在 `0.3.x` 体系，未升级到 `1.x` LTS

本设计目标：

1. 设计 `providers` 抽象层，隔离业务与具体模型供应商
2. 支持 client 端新增/编辑/激活 provider
3. provider 配置持久化到 SQLite
4. 对敏感字段（API Key、Headers）进行应用层加密后入库
5. 升级到 LangChain `1.x` 及对应推荐语法

## 2. 约束与确认项

已确认约束（来自用户决策）：

1. 首批内置 provider：`ollama` + `openai`
2. client 端支持“可新增任意 provider 配置”（不是仅内置下拉）
3. provider 配置持久化：SQLite
4. API Key 允许落盘，但必须加密
5. 加密主密钥来自环境变量（`AI_EMOTION_PROVIDER_SECRET_KEY`）
6. LangChain 升级策略：直接升级到 `1.x`（一次性改动）

## 3. 方案选择

候选方案：

1. Provider Registry + Adapter + OpenAI-Compatible 扩展
2. 透传参数到动态模型初始化
3. LangChain 与自研 HTTP 双轨

选择方案：**方案 1（推荐并已确认）**

选择理由：

1. provider 扩展边界清晰
2. 安全能力集中治理（加密、脱敏、日志）
3. 与“client 可自定义 provider + SQLite 落盘”的要求最匹配
4. 便于后续继续增加 provider 类型

## 4. 总体架构

### 4.1 分层

1. `Provider Config Layer`
- 负责 provider 配置 CRUD、激活、连通性测试
- 持久化 SQLite
- 敏感字段加密/解密

2. `Provider Runtime Layer`
- 通过统一 adapter 接口构建 LangChain chat model
- `ProviderRegistry` 负责 provider_type 到 adapter 的分发

3. `Emotion Analysis Layer`
- 仅依赖 provider 抽象，不依赖具体厂商 SDK
- 负责 prompt 拼装、模型调用、结构化结果解析

### 4.2 目录建议

```text
server/app/
  providers/
    __init__.py
    base.py
    registry.py
    crypto.py
    storage.py
    service.py
    adapters/
      __init__.py
      ollama.py
      openai.py
      openai_compatible.py
```

## 5. 组件设计

### 5.1 ProviderAdapter（统一接口）

职责：将标准化 provider 配置映射成 `BaseChatModel`。

核心能力：

1. `validate(config)`：校验必填项与格式
2. `create_model(config)`：构建 LangChain model 实例
3. `redact(config)`：返回可安全暴露的摘要

### 5.2 ProviderRegistry

职责：管理 provider_type 与 adapter 的注册关系。

行为：

1. 根据 `provider_type` 返回 adapter
2. 对未知类型抛显式错误
3. 支持后续新增 provider 类型

### 5.3 ProviderService

职责：上层业务入口。

行为：

1. provider CRUD
2. 设置 active provider（事务保证唯一活跃）
3. 测试 provider 连通性
4. 获取当前 active provider 的 `BaseChatModel`
5. 返回脱敏配置给 API

### 5.4 Encryption Service

职责：敏感字段应用层加密。

行为：

1. 主密钥从 `AI_EMOTION_PROVIDER_SECRET_KEY` 读取
2. 使用对称加密（AES-GCM）进行加/解密
3. 密钥缺失时对含密文字段操作直接失败，避免误读/误写

## 6. 数据模型（SQLite）

表：`provider_configs`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | TEXT PK | provider 配置 ID |
| `name` | TEXT UNIQUE | 展示名 |
| `provider_type` | TEXT | `ollama/openai/openai_compatible` |
| `model` | TEXT | 模型名 |
| `base_url` | TEXT NULL | 可选 |
| `headers_encrypted` | TEXT NULL | headers 密文 |
| `api_key_encrypted` | TEXT NULL | API key 密文 |
| `temperature` | REAL NULL | 温度参数 |
| `is_active` | INTEGER | 是否激活（0/1） |
| `created_at` | TEXT | ISO 时间 |
| `updated_at` | TEXT | ISO 时间 |

约束与规则：

1. 同一时刻仅允许一个 `is_active=1`
2. 激活操作必须在事务内：先清零其他，再置目标为 1
3. API 层永不返回 `*_encrypted` 明文解密值

## 7. API 设计

新增 HTTP API：

1. `GET /api/providers`
- 返回 provider 列表（脱敏）

2. `POST /api/providers`
- 创建 provider 配置

3. `PUT /api/providers/{id}`
- 更新 provider 配置

4. `DELETE /api/providers/{id}`
- 删除 provider（active provider 删除需先切换或阻止）

5. `POST /api/providers/{id}/activate`
- 激活 provider

6. `POST /api/providers/{id}/test`
- 测试连通性（不入业务主链）

7. `GET /api/providers/active`
- 返回当前生效 provider 摘要

对现有 `GET /api/status` 的扩展：

1. 增加 `active_provider`
2. 增加 `active_model`

## 8. 运行时数据流

### 8.1 启动

1. 应用启动时初始化 `ProviderService`
2. 读取 active provider
3. 无 active provider 时：系统可启动，但 emotion 分析在执行时返回明确错误

### 8.2 分析链路

1. ASR final 文本进入 emotion queue
2. `EmotionService` 调用 `ProviderService.get_active_chat_model()`
3. 使用 LangChain 1.x 模型调用
4. 优先结构化输出；失败时回退 JSON 抽取
5. 成功结果写入 Hub 并广播

### 8.3 provider 切换

1. client 请求 activate
2. 服务端更新 active provider
3. 后续 utterance 使用新 provider
4. 处理中任务不强制中断

## 9. 安全设计

1. 敏感字段（`api_key`, `headers`）仅在写入时接收，保存为密文
2. API 响应只返回摘要字段（如 `has_api_key`, `headers_keys`）
3. 日志禁止输出明文配置
4. 解密失败/密钥缺失使用明确错误码，避免 silent fallback

## 10. LangChain 升级设计（1.x）

### 10.1 依赖

Python 依赖目标：

1. `langchain>=1.0,<2.0`
2. `langchain-core>=1.0,<2.0`
3. 保留 `langchain-ollama`
4. 新增 `langchain-openai`

### 10.2 语法迁移原则

1. provider 层输出统一 `BaseChatModel`
2. EmotionService 不感知具体 SDK
3. 模型调用使用 1.x 推荐模式
4. 保留现有 JSON 兜底解析逻辑，降低回归风险

## 11. 错误处理

1. 配置错误：请求参数非法返回 422
2. provider 不存在/不支持：返回 404/422
3. 无 active provider：emotion 任务标记错误并写入 hub
4. 上游模型错误（401/429/timeout）：统一包装并可观测
5. DB schema 不匹配：启动失败并给出迁移提示

## 12. 测试策略

### 12.1 单元测试

1. `crypto`：加解密回环、错误密钥、非法密文
2. `adapters`：参数校验与 model 构建
3. `provider service`：CRUD、激活原子性、脱敏输出

### 12.2 集成测试

1. provider API 全流程（创建/测试/激活）
2. emotion worker 在 provider 切换前后行为正确
3. 无 active provider 时错误路径可观测

### 12.3 回归测试

1. ASR -> emotion -> WS 主链路可用
2. 现有监控面板状态展示兼容

## 13. 非目标（本次不做）

1. 多租户 provider 配置隔离
2. provider 并行路由/负载均衡
3. keyring 集成
4. 自动迁移框架（如 Alembic）全量接入

## 14. 验收标准

1. 可从 client 新增任意 provider 配置并落 SQLite
2. `api_key/headers` 明文不出现在数据库
3. 可在 `ollama/openai/openai_compatible` 间切换并生效
4. 情绪分析链路在切换后可连续工作
5. LangChain 依赖与调用完成到 `1.x` 体系
6. 回归测试通过

## 15. 风险与缓解

1. 旧配置兼容风险
- 缓解：首次启动做默认 provider 初始化（可选）或给出清晰引导

2. 自定义 provider 参数不规范风险
- 缓解：强校验 + `test` API 前置验证

3. 密钥管理风险
- 缓解：强制环境变量注入 + 启动期校验

## 16. 实施顺序（高层）

1. 增加 provider 数据层与加密层
2. 增加 provider service + adapters + registry
3. 接入 HTTP API 与 status 扩展
4. 改造 EmotionService 使用 provider 抽象
5. 升级 LangChain 依赖与调用语法
6. 增加测试并回归
