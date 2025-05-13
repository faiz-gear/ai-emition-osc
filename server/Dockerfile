FROM python:3.11-slim

WORKDIR /app

# Install system dependencies, including audio-related libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libasound2-dev \
    portaudio19-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy resources (prompt template and Vosk model)
COPY resources/ /app/resources/

# Copy application code
COPY app/ /app/app/
COPY main.py .

# Expose port
EXPOSE 8000

# Set environment variables
ENV AI_EMOTION_HOST=0.0.0.0
ENV AI_EMOTION_PORT=8000
ENV AI_EMOTION_RELOAD=false
ENV AI_EMOTION_PROMPT_TEMPLATE=/app/resources/prompt_template.txt
ENV AI_EMOTION_VOSK_MODEL=/app/resources/vosk-model-small-cn

# Run the application
CMD ["python", "main.py"] 