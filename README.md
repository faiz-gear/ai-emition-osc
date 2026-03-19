# AI 中文语音情绪分析系统（前后端分离版）

本项目提供一个**后端 FastAPI 服务** + **前端 Next.js 监控台**，用于实时中文语音识别与情绪分析的**可视化、跟踪与监控**。

核心链路：
1) 后端采集**本机麦克风**音频（sounddevice）→ Vosk 实时识别  
2) 将识别文本发送给 LLM（Ollama / LangChain）进行 Plutchik 8 维情绪分析  
3) 结果通过 WebSocket 实时推送到前端，同时可通过 OSC 输出给外部应用（如 TouchDesigner）

## 目录结构

```
ai-emotion/
├── server/                 # FastAPI 后端服务
├── client/                 # Next.js 前端监控台
├── start.bat               # Windows 一键启动（生产式）
├── dev.bat                 # Windows 一键启动（开发模式）
├── prompt_template.txt     # 情绪分析提示词模板（LLM 输出 JSON）
├── .env.example            # 环境变量示例
└── vosk-model-small-cn/    # Vosk 中文模型（下载脚本自动获取）
```

## 快速开始（Windows，一键启动）

前置条件：
- Python 3.10+
- Node.js 18+（含 npm）
- Ollama 已安装并运行（并确保 `AI_EMOTION_LLM_MODEL` 对应模型已下载）

步骤：
1) 双击 `start.bat`
2) 浏览器会自动打开 `http://localhost:3000`
3) 对着麦克风说话，前端将实时展示：
   - ASR 实时字幕（partial/final）
   - Plutchik 8 维情绪雷达图 + dominant + brief explanation
   - 监控指标（吞吐/延迟/错误数/连接状态等）

开发模式：双击 `dev.bat`（后端 `--reload` + 前端 `next dev`）

## 手动启动（可选）

后端：
```bash
python -m venv .venv
source .venv/bin/activate  # Windows 用 .venv\\Scripts\\activate.bat
pip install -r server/requirements.txt
python server/scripts/download_vosk_model.py
python -m uvicorn server.app.main:app --reload --host 127.0.0.1 --port 8000
```

前端：
```bash
cd client
npm install
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000 \
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8000/ws/events \
npm run dev
```

### 前端控制台（Linear Light Dense）

`/client` 已升级为轻色高密度实时调试台，核心区域包括：
- `ControlRail`：顶部粘性 Start/Stop、连接状态、Listening 状态、错误入口
- `LiveTranscriptStage`：实时字幕主舞台，处理中 shimmer 效果 + LIVE/IDLE/STALE 新鲜度
- `RealtimeOpsStack`：紧凑运维指标卡
- `UtteranceStreamPanel`：按时间倒序列表、Follow latest 开关、长文本 Expand/Collapse
- `EmotionDetailPanel`：选中 utterance 的情绪详情 + 雷达图
- `ProviderAdvancedPanel`：默认折叠的高级 Provider 管理，展开状态本地持久化

前端质量门禁（本地）：
```bash
cd client
npm run lint
npm run test:unit
npm run build
```

## 后端 API

- `GET /healthz`：健康检查
- `GET /api/status`：后端状态 + metrics + 配置摘要
- `POST /api/listening/start`：启动麦克风监听（幂等）
- `POST /api/listening/stop`：停止麦克风监听（幂等）
- `GET /api/utterances?limit=200`：获取最近识别记录
- `WS /ws/events`：事件流（连接后先推送 `snapshot`，随后增量推送）

### Provider 管理 API

- `GET /api/providers`：列出 provider（支持 degraded 标识）
- `POST /api/providers`：创建 provider
- `PATCH /api/providers/{id}`：更新 provider（`provider_type` 不可变）
- `DELETE /api/providers/{id}`：删除 provider（允许删除 active）
- `POST /api/providers/{id}/activate`：激活 provider
- `POST /api/providers/{id}/test`：测试 provider 配置
- `GET /api/providers/active`：获取当前 active provider（无 active 时返回 `PROVIDER_ACTIVE_NOT_SET`）

## 配置

复制 `.env.example` 为 `.env` 并按需修改。后端启动时会自动读取 `.env`（若系统环境变量已存在同名键，则系统环境变量优先）。重点变量：
- `AI_EMOTION_VOSK_MODEL`：Vosk 模型目录（默认 `vosk-model-small-cn`）
- `AI_EMOTION_LLM_MODEL`：Ollama 模型名（默认 `qwen2.5:3b`）
- `AI_EMOTION_PROVIDER_DB_PATH`：provider SQLite 路径（默认 `server/data/providers.db`）
- `AI_EMOTION_PROVIDER_SECRET_KEY`：provider secret 加密主密钥（必填；建议 32 字节随机串）
- `AI_EMOTION_OSC_IP` / `AI_EMOTION_OSC_PORT`：OSC 目标地址
- `AI_EMOTION_EVENT_BUFFER_SIZE`：内存保留最近 N 条（默认 200）

## 提示词模板

`prompt_template.txt` 要求 LLM **只输出 JSON**，格式为：
```json
{
  "dimensions": { "joy": 0.0, "trust": 0.0, "fear": 0.0, "surprise": 0.0, "sadness": 0.0, "disgust": 0.0, "anger": 0.0, "anticipation": 0.0 },
  "dominant_emotion": "neutral",
  "brief_explanation": ""
}
```
