# AI Emotion Analysis Server

FastAPI backend for the AI Emotion Analysis system, providing real-time emotion analysis using Plutchik's emotion wheel.

## Features

- Text-based emotion analysis via REST API
- Real-time text analysis via WebSocket
- Real-time speech recognition with emotion analysis
- Integration with OSC for external applications (like TouchDesigner)

## Prerequisites

- Python 3.9+
- Ollama - for running local LLMs
- Required Python packages (see requirements.txt)
- Vosk model for speech recognition

## Installation

1. Clone the repository
2. Install the required dependencies:

```bash
pip install -r requirements.txt
```

3. Download the Vosk model:

   - For Chinese: https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip
   - For English: https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip

4. Extract the model to a directory (e.g., `vosk-model-small-cn`)

## Environment Variables

Create a `.env` file with the following variables:

```
AI_EMOTION_HOST=0.0.0.0
AI_EMOTION_PORT=8000
AI_EMOTION_RELOAD=true
AI_EMOTION_OSC_IP=127.0.0.1
AI_EMOTION_OSC_PORT=7000
AI_EMOTION_OSC_ENABLED=true
AI_EMOTION_LLM_MODEL=deepseek-r1:1.5b
AI_EMOTION_LLM_TEMPERATURE=0.6
AI_EMOTION_PROMPT_TEMPLATE=prompt_template.txt
AI_EMOTION_VOSK_MODEL=vosk-model-small-cn
AI_EMOTION_SILENCE_THRESHOLD=500
AI_EMOTION_MIN_SPEECH_DURATION=0.3
AI_EMOTION_MAX_SILENCE_DURATION=0.5
AI_EMOTION_BLOCKSIZE=2000
```

## Running the Server

Start the server with:

```bash
python main.py
```

The API will be available at http://localhost:8000

## API Endpoints

### Text Analysis

- `POST /api/analyze` - Analyze emotions in text

  Request body:

  ```json
  {
    "text": "Your text to analyze"
  }
  ```

### WebSockets

- `WebSocket /api/ws` - Real-time text analysis
- `WebSocket /api/speech/listen` - Real-time speech recognition with emotion analysis

### Health Check

- `GET /api/health` - Server health check

## Docker

Build the Docker image:

```bash
docker build -t ai-emotion-server .
```

Run the container:

```bash
docker run -p 8000:8000 ai-emotion-server
```

## License

This project is licensed under the MIT License.
