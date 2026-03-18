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

## 2. 约束与范围

已确认约束（来自用户决策）：

1. 首批内置 provider 预设：`ollama` + `openai`
2. client 端支持“新增自定义 provider 配置”
3. provider 配置持久化：SQLite
4. API Key 允许落盘，但必须加密
5. 加密主密钥来自环境变量（`AI_EMOTION_PROVIDER_SECRET_KEY`）
6. LangChain 升级策略：直接升级到 `1.x`（一次性改动）

本期范围澄清：

1. “自定义 provider”在本期定义为：任意 OpenAI-Compatible Chat 接口（`base_url + headers + api_key + model`）
2. 非 OpenAI-Compatible 的全新协议 provider 不在本期
3. 本期允许系统处于“无 active provider”状态（服务可启动，分析任务返回明确错误）

## 3. 方案选择

候选方案：

1. Provider Registry + Adapter + OpenAI-Compatible 扩展
2. 透传参数到动态模型初始化
3. LangChain 与自研 HTTP 双轨

选择方案：**方案 1（推荐并已确认）**

## 4. 总体架构

### 4.1 分层

1. `Provider Config Layer`
- provider 配置 CRUD、激活、连通性测试
- SQLite 持久化
- 敏感字段加密/解密

2. `Provider Runtime Layer`
- 通过 adapter 统一构建 LangChain `BaseChatModel`
- `ProviderRegistry` 负责 `provider_type` 到 adapter 的分发

3. `Emotion Analysis Layer`
- 仅依赖 provider 抽象
- 负责 prompt 拼装、模型调用、结果解析

加解密职责边界（强约束）：

1. `ProviderRepository` 只处理存储模型，不接收或返回明文 secret
2. `ProviderService` 负责明文输入校验、调用 `crypto` 加密后再落库
3. `ProviderService` 负责读取密文并在内存中解密，传给 adapter 构建 model
4. `ProviderAdapter` 只消费运行时明文配置，不直接访问数据库

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

## 5. 接口契约

### 5.1 核心接口签名

```python
# server/app/providers/base.py
class ProviderAdapter(Protocol):
    provider_type: str

    def validate(self, config: ProviderRuntimeConfig) -> None: ...
    def create_model(self, config: ProviderRuntimeConfig) -> BaseChatModel: ...

# server/app/providers/storage.py
class ProviderRepository(Protocol):
    async def list(self) -> list[StoredProviderRecord]: ...
    async def get(self, provider_id: str) -> StoredProviderRecord | None: ...
    async def create(self, input: StoredProviderWrite) -> StoredProviderRecord: ...
    async def update(self, provider_id: str, patch: StoredProviderPatch) -> StoredProviderRecord: ...
    async def delete(self, provider_id: str) -> bool: ...
    async def set_active(self, provider_id: str) -> StoredProviderRecord: ...
    async def get_active(self) -> StoredProviderRecord | None: ...

# server/app/providers/service.py
class ProviderService:
    async def list_summaries(self) -> list[ProviderSummary]: ...
    async def create_provider(self, input: CreateProviderInput) -> ProviderSummary: ...
    async def update_provider(self, provider_id: str, patch: UpdateProviderInput) -> ProviderSummary: ...
    async def delete_provider(self, provider_id: str) -> None: ...
    async def activate_provider(self, provider_id: str) -> ProviderSummary: ...
    async def test_provider(self, provider_id: str) -> ProviderTestResult: ...
    async def get_active_chat_model(self) -> BaseChatModel: ...
    async def get_runtime_config(self, provider_id: str) -> ProviderRuntimeConfig: ...
```

### 5.2 数据模型合同（分层）

`StoredProviderRecord`（Repository 层，密文存储）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 配置 ID (uuid) |
| `name` | string | 展示名 |
| `provider_type` | enum | `ollama/openai/openai_compatible` |
| `provider_key` | string \| null | 自定义标识（仅 `openai_compatible` 必填） |
| `model` | string | 模型名 |
| `base_url` | string \| null | 供应商地址 |
| `headers_encrypted` | string \| null | 自定义请求头密文 |
| `api_key_encrypted` | string \| null | API Key 密文 |
| `temperature` | number \| null | 采样温度 |
| `is_active` | boolean | 是否生效 |

`ProviderRuntimeConfig`（Service->Adapter，运行时明文，仅内存态）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id/name/provider_type/provider_key/model/base_url/temperature/is_active` | 同上 | 非敏感配置 |
| `headers` | object \| null | 由 Service 解密得到，不落日志 |
| `api_key` | string \| null | 由 Service 解密得到，不落日志 |

`ProviderSummary`（API 返回，脱敏）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id,name,provider_type,provider_key,model,base_url,temperature,is_active,updated_at` | - | 基础信息 |
| `has_api_key` | boolean \| null | `null` 表示解密失败未知 |
| `headers_keys` | string[] \| null | `null` 表示解密失败未知 |
| `status` | `"ok"` \| `"degraded"` | 记录是否可用 |
| `error_code` | string \| null | 例如 `PROVIDER_SECRET_DECRYPT_FAILED` |

各 provider 校验规则：

1. `ollama`
- 必填：`model`
- 可选：`base_url`（默认 `http://127.0.0.1:11434`）、`temperature`
- `api_key` 忽略

2. `openai`
- 必填：`model`、`api_key`
- 可选：`base_url`（默认 OpenAI API）、`temperature`、`headers`

3. `openai_compatible`
- 必填：`provider_key`、`model`、`base_url`
- 可选：`api_key`、`headers`、`temperature`

更新语义（`PATCH`）：

1. 未传字段：保持原值
2. 显式传 `null`：清空字段（若校验允许）
3. `provider_type` 不可变；若需变更类型，必须新建配置并切换 active
4. 敏感字段更新后立即重加密覆盖

## 6. 数据层设计（SQLite）

### 6.1 配置与生命周期

1. DB 路径：环境变量 `AI_EMOTION_PROVIDER_DB_PATH`，默认 `server/data/providers.db`
2. 启动时创建目录与数据库文件
3. 数据访问实现：`aiosqlite`，每次操作短连接；写操作显式事务
4. 启动时执行：`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`
5. 并发策略：DB 约束兜底，`activate` 路径在 service 层加 `asyncio.Lock`

### 6.2 表结构

`provider_configs`:

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | TEXT PRIMARY KEY | provider 配置 ID |
| `name` | TEXT NOT NULL | 展示名 |
| `provider_type` | TEXT NOT NULL | `ollama/openai/openai_compatible` |
| `provider_key` | TEXT NULL | 自定义 provider key |
| `model` | TEXT NOT NULL | 模型名 |
| `base_url` | TEXT NULL | 可选 |
| `headers_encrypted` | TEXT NULL | headers 密文 |
| `api_key_encrypted` | TEXT NULL | API key 密文 |
| `temperature` | REAL NULL | 温度参数 |
| `is_active` | INTEGER NOT NULL DEFAULT 0 | 是否激活（0/1） |
| `created_at` | TEXT NOT NULL | ISO 时间 |
| `updated_at` | TEXT NOT NULL | ISO 时间 |

`app_meta`:

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | TEXT PRIMARY KEY | 元数据键 |
| `value` | TEXT NOT NULL | 元数据值 |

### 6.3 约束

1. `CREATE UNIQUE INDEX idx_provider_configs_name ON provider_configs(name);`
2. `CREATE UNIQUE INDEX idx_provider_configs_provider_key ON provider_configs(provider_key) WHERE provider_key IS NOT NULL;`
3. `CREATE UNIQUE INDEX idx_provider_configs_one_active ON provider_configs(is_active) WHERE is_active = 1;`
4. `CHECK (provider_type IN ('ollama','openai','openai_compatible'))`
5. `CHECK (is_active IN (0,1))`

### 6.4 Schema 版本策略

1. 当前 schema 版本常量：`PROVIDER_SCHEMA_VERSION=1`
2. `app_meta['provider_schema_version']` 存储当前库版本
3. 启动检查：
- 无表：初始化并写入版本 `1`
- 版本等于 `1`：继续启动
- 版本小于 `1`：执行内置迁移脚本后继续（本期无历史版本，预留机制）
- 版本大于 `1`：启动失败，提示应用版本过低

### 6.5 初始化策略

1. 若 `provider_configs` 为空：根据 `AI_EMOTION_LLM_MODEL` 写入默认 `ollama` 记录并置为 active
2. 若非空：保持现有配置
3. “无 active provider”仅会在运行期用户删除 active 后出现，不作为首次启动默认态

## 7. API 合同

### 7.1 统一错误响应

```json
{
  "code": "PROVIDER_NOT_FOUND",
  "message": "Provider does not exist",
  "details": {}
}
```

字段定义：

1. `code`: 稳定错误码（供前端分支判断）
2. `message`: 可读文本
3. `details`: 可选上下文

### 7.2 资源模型

`ProviderSummary`:

- `id`, `name`, `provider_type`, `provider_key`, `model`, `base_url`, `temperature`, `is_active`, `updated_at`
- `has_api_key: boolean | null`
- `headers_keys: string[] | null`
- `status: "ok" | "degraded"`
- `error_code?: "PROVIDER_SECRET_DECRYPT_FAILED" | null`
- `error_message?: string | null`

降级规则（仅列表接口）：

1. 若某记录 secret 解密失败，该记录仍返回
2. `status="degraded"`，`error_code="PROVIDER_SECRET_DECRYPT_FAILED"`
3. `has_api_key=null`, `headers_keys=null`
4. 其余非敏感字段照常返回，便于定位并删除坏记录

### 7.3 Endpoint Matrix

请求 DTO（规范）：

`CreateProviderRequest`:

- `name: string`（必填，长度 1-64）
- `provider_type: "ollama" | "openai" | "openai_compatible"`（必填）
- `provider_key?: string | null`（`openai_compatible` 必填，其他类型必须为空）
- `model: string`（必填，长度 1-128）
- `base_url?: string | null`（URL；`openai_compatible` 必填）
- `temperature?: number | null`（范围 0-2）
- `api_key?: string | null`（`openai` 必填，`ollama` 忽略）
- `headers?: object | null`（`Record<string, string>`）

`PatchProviderRequest`:

- 字段集合与 `CreateProviderRequest` 相同，但全部可选
- 不允许包含 `provider_type`；若出现，返回 `409 PROVIDER_TYPE_IMMUTABLE`
- `null` 仅允许用于可清空字段（`base_url`, `temperature`, `api_key`, `headers`, `provider_key`）

1. `GET /api/providers`
- 200: `ProviderSummary[]`

2. `POST /api/providers`
- 201: `ProviderSummary`
- 422 + `PROVIDER_VALIDATION_FAILED`
- 409 + `PROVIDER_CONFLICT`

3. `PATCH /api/providers/{id}`
- 200: `ProviderSummary`
- 404 + `PROVIDER_NOT_FOUND`
- 409 + `PROVIDER_TYPE_IMMUTABLE`
- 422 + `PROVIDER_VALIDATION_FAILED`

4. `DELETE /api/providers/{id}`
- 204: 删除成功
- 404 + `PROVIDER_NOT_FOUND`
- 行为：允许删除 active；若删除后无 active，系统进入“无 active provider”状态

5. `POST /api/providers/{id}/activate`
- 200: `ProviderSummary`
- 404 + `PROVIDER_NOT_FOUND`
- 422 + `PROVIDER_VALIDATION_FAILED`

6. `POST /api/providers/{id}/test`
- 200: `{ "ok": true, "latency_ms": number }`
- 404 + `PROVIDER_NOT_FOUND`
- 401/403 + `PROVIDER_AUTH_FAILED`
- 429 + `PROVIDER_RATE_LIMITED`
- 502 + `PROVIDER_UPSTREAM_UNAVAILABLE`

7. `GET /api/providers/active`
- 200: `ProviderSummary`
- 404 + `PROVIDER_ACTIVE_NOT_SET`
- 500 + `PROVIDER_SECRET_DECRYPT_FAILED`（active 记录不可解密）

`GET /api/status` 扩展：

1. `config.active_provider: string | null`
2. `config.active_model: string | null`

## 8. 运行时行为

### 8.1 启动

1. 加载配置并校验 `AI_EMOTION_PROVIDER_SECRET_KEY`（必填，缺失即启动失败）
2. 初始化 provider DB（schema/version/init）
3. 初始化 `ProviderService`
4. 无 active provider 时服务可启动

### 8.2 分析链路

1. ASR final 文本入队
2. `EmotionService` 调 `ProviderService.get_active_chat_model()`
3. 无 active provider：抛业务错误并记录 `hub.record_error("未配置可用 provider")`
4. 有 active provider：执行 LangChain 调用并解析结果

### 8.3 密钥/解密失败行为

1. 启动阶段密钥缺失：直接 fail-fast
2. 运行阶段解密失败（数据损坏/密钥变更未轮换）：
- `GET /api/providers`：坏记录降级返回，附 `error_code=PROVIDER_SECRET_DECRYPT_FAILED`
- `GET /api/providers/active`：若 active 记录解密失败，返回 500 + `PROVIDER_SECRET_DECRYPT_FAILED`
- `activate/test/analyze`：目标记录解密失败时返回 500 + `PROVIDER_SECRET_DECRYPT_FAILED`
- 提供修复路径：`DELETE /api/providers/{id}` 可删除坏记录（无需解密）

### 8.4 provider 切换

1. `activate` 在事务内执行（清空旧 active，再设置新 active）
2. 后续 utterance 使用新 provider
3. 正在处理中的任务不强制中断
4. 并发语义（确定性）：
- 同进程内通过 `asyncio.Lock` 串行化，按到达顺序执行，后到请求可覆盖先到请求（last-write-wins）
- 多进程极端并发下若触发唯一索引冲突：service 自动重试一次；仍冲突则返回 `409 PROVIDER_ACTIVATION_CONFLICT`

## 9. 安全设计

1. 敏感字段仅在写入时接收，数据库中仅保存密文
2. API 永不返回明文 secret
3. 日志对 provider 配置全量脱敏

密文封装格式（JSON string）：

```json
{
  "v": 1,
  "alg": "AES-256-GCM",
  "kid": "default",
  "nonce_b64": "...",
  "ciphertext_b64": "...",
  "tag_b64": "..."
}
```

密钥轮换流程（明确 old/new key 合同）：

1. 轮换脚本读取 `AI_EMOTION_PROVIDER_SECRET_KEY_OLD` 与 `AI_EMOTION_PROVIDER_SECRET_KEY_NEW`
2. 脚本执行前写入 `app_meta['provider_rotation_lock']='1'`
3. 使用 OLD 解密、NEW 重加密，逐条提交
4. 全量成功后将运行环境主密钥切换为 NEW（`AI_EMOTION_PROVIDER_SECRET_KEY=...NEW...`）
5. 清除 `provider_rotation_lock`（置回 `0`）并删除 OLD key
6. 任一步骤失败则回滚当前事务，保持旧密文与旧主密钥不变

rotation lock 行为矩阵：

1. `GET /api/providers`：允许，按降级规则返回
2. `GET /api/providers/active`：允许
3. `POST /api/providers`：拒绝，503 `PROVIDER_ROTATION_IN_PROGRESS`
4. `PATCH /api/providers/{id}`：拒绝，503 `PROVIDER_ROTATION_IN_PROGRESS`
5. `DELETE /api/providers/{id}`：拒绝，503 `PROVIDER_ROTATION_IN_PROGRESS`
6. `POST /api/providers/{id}/activate`：拒绝，503 `PROVIDER_ROTATION_IN_PROGRESS`
7. `POST /api/providers/{id}/test`：拒绝，503 `PROVIDER_ROTATION_IN_PROGRESS`
8. emotion worker `analyze`：拒绝执行本次情绪分析，记录 `PROVIDER_ROTATION_IN_PROGRESS`

## 10. LangChain 1.x 迁移设计

### 10.1 依赖变更

1. `langchain>=1.0,<2.0`
2. `langchain-core>=1.0,<2.0`
3. 保留 `langchain-ollama`
4. 新增 `langchain-openai`
5. 新增 `aiosqlite`

### 10.2 代码触点

1. `server/app/services/emotion_service.py`
- 移除 `ChatOllama` 直依赖
- 依赖 `ProviderService` 返回的 `BaseChatModel`
- 使用 1.x 结构化输出优先，JSON 兜底保留

2. `server/app/main.py`
- 注入 `ProviderService`
- 在 lifespan 中初始化 provider DB

3. `server/app/core/config.py`
- 新增 `provider_db_path`, `provider_secret_key`

4. `server/app/models/events.py` + `server/app/services/hub.py`
- 扩展 status config 字段：`active_provider/active_model`

5. `server/app/api/http.py`
- 注册 providers 新路由

### 10.3 兼容策略

1. 不做 `0.3` 与 `1.x` 双栈兼容
2. 一次性切换到 `1.x`
3. 通过测试覆盖保障行为一致

### 10.4 结构化输出与回退规则

1. 首选 `model.with_structured_output(EmotionResultSchema)` 调用
2. 若出现 `ValidationError` 或模型返回非结构化文本，执行 JSON 抽取兜底
3. JSON 兜底仍失败时，判定为 `emotion_status=error` 并记录原始响应摘要

## 11. 错误处理映射

HTTP 层：

1. 404: `PROVIDER_NOT_FOUND`, `PROVIDER_ACTIVE_NOT_SET`
2. 409: `PROVIDER_CONFLICT`, `PROVIDER_TYPE_IMMUTABLE`, `PROVIDER_ACTIVATION_CONFLICT`
3. 401/403: `PROVIDER_AUTH_FAILED`
4. 429: `PROVIDER_RATE_LIMITED`
5. 422: `PROVIDER_VALIDATION_FAILED`
6. 500: `PROVIDER_SECRET_DECRYPT_FAILED`, `PROVIDER_DB_SCHEMA_ERROR`
7. 502: `PROVIDER_UPSTREAM_UNAVAILABLE`
8. 503: `PROVIDER_ROTATION_IN_PROGRESS`

Worker 层：

1. 无 active provider -> `emotion_status=error`
2. provider 调用失败 -> `emotion_status=error` + 结构化错误消息

## 12. 测试策略

### 12.1 单元测试

1. `crypto`: 加解密回环、错误密钥、坏密文
2. `adapters`: 校验规则与 model 构建
3. `service`: CRUD、activate 原子性、provider_type 不可变
4. `storage`: unique/partial index 行为

### 12.2 集成测试

1. provider API 全流程（create/update/activate/test/delete）
2. active 删除后系统进入无 active 状态
3. 空库初始化默认 active 记录
4. worker 在 provider 切换前后行为正确
5. 并发 activate：同进程双请求按顺序生效（last-write-wins）；跨进程冲突映射为 `PROVIDER_ACTIVATION_CONFLICT`

### 12.3 回归测试

1. ASR -> emotion -> WS 主链路可用
2. `/api/status` 新字段对前端兼容
3. LangChain 1.x 升级后解析行为不回退

## 13. 非目标

1. 多租户 provider 隔离
2. provider 负载均衡/路由策略
3. 非 OpenAI-Compatible 协议 adapter
4. 完整迁移框架（Alembic）引入

## 14. 验收标准

1. 支持 `ollama/openai/openai_compatible` 配置与持久化
2. `api_key/headers` 明文不出现在数据库与响应
3. 任意时刻至多一个 active provider（DB + service 双保险）
4. 允许无 active provider 且系统可启动
5. LangChain 升级到 `1.x` 并通过回归

## 15. 风险与缓解

1. secret 丢失或轮换不完整
- 缓解：启动强校验 + 轮换脚本 + 明确错误码

2. 自定义 provider 参数质量波动
- 缓解：严格 schema 校验 + `test` 前置

3. SQLite 写并发冲突
- 缓解：事务 + unique index + service 锁

## 16. 实施顺序（高层）

1. provider DB + schema/version/init
2. crypto + repository + adapters + registry + service
3. providers API + status 扩展
4. emotion service 改造为 provider 抽象
5. LangChain 1.x 依赖与调用迁移
6. 测试与回归
