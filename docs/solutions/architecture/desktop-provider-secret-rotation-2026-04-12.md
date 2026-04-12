# Desktop Provider Secret Rotation

Created: 2026-04-12

## Context

Electron desktop runtime 已经把 provider 配置落到 SQLite，并对敏感字段做加密存储，但此前缺少一个明确的密钥轮换协议，也没有在轮换期间阻止会读写 provider secrets 的运行时路径。

## Guidance

桌面 runtime 采用两层约束：

1. `provider_rotation_lock`
   - 存在于 `app_meta`
   - provider create/update/delete/activate/test 以及 `getActiveChatModel()` 会在 lock 打开时直接拒绝，返回 `PROVIDER_ROTATION_IN_PROGRESS`
   - `listSummaries()` 仍允许读取，方便 UI/运维观察当前状态
2. 原地重加密
   - 使用 OLD key 解密 `provider_configs.api_key_encrypted` / `headers_encrypted`
   - 在同一事务里使用 NEW key 重新加密写回
   - 任何一条记录失败都会让整个事务回滚

## Why This Matters

- 没有 rotation lock 时，运行中的 provider test/activate/emotion access 可能会在半轮换状态下读取 secrets，导致间歇性解密失败
- 没有事务性重加密时，部分记录成功、部分记录失败会把桌面 runtime 带进更难恢复的混合密钥状态
- 把这条路径收敛成显式的 CLI 和 smoke 验证后，后续 CI/运维不需要靠手工约定记忆流程

## When To Apply

- 需要轮换 `AI_EMOTION_PROVIDER_SECRET_KEY`
- 把 in-memory provider harness 切向真实 desktop runtime 之前
- 为桌面打包/发布补上更强的运行时运维约束时

## Examples

运行密钥轮换：

```bash
AI_EMOTION_PROVIDER_SECRET_KEY_OLD=<old-secret> \
AI_EMOTION_PROVIDER_SECRET_KEY_NEW=<new-secret> \
npm run provider:rotate-secrets -- --db-path /path/to/providers.sqlite3
```

运行稳定的 headless smoke：

```bash
AI_EMOTION_PROVIDER_SECRET_KEY=<32-byte-secret> npm run desktop:smoke
```
