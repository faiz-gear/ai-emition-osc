FROM python:3.10-slim

WORKDIR /app

# 安装依赖包
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        portaudio19-dev \
        wget \
        unzip \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 复制项目文件
COPY . .

# 下载中文语音模型
RUN python setup.py

# 设置环境变量
ENV AI_EMOTION_INPUT_DIR=/data/input \
    AI_EMOTION_OSC_IP=127.0.0.1 \
    AI_EMOTION_OSC_PORT=7000 \
    AI_EMOTION_POLL_INTERVAL=1 \
    AI_EMOTION_LLM_MODEL=deepseek-r1:1.5b \
    AI_EMOTION_LLM_TEMPERATURE=0.6 \
    AI_EMOTION_PROMPT_TEMPLATE=/app/prompt_template.txt \
    AI_EMOTION_VOSK_MODEL=/app/vosk-model-small-cn \
    AI_EMOTION_SAMPLE_RATE=16000 \
    AI_EMOTION_BLOCKSIZE=2000 \
    AI_EMOTION_SILENCE_THRESHOLD=500 \
    AI_EMOTION_MIN_SPEECH_DURATION=0.3 \
    AI_EMOTION_MAX_SILENCE_DURATION=0.5

# 创建数据目录
RUN mkdir -p /data/input && \
    chmod -R 777 /data

# 运行应用
CMD ["python", "main.py"] 