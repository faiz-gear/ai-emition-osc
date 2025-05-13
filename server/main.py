import os
import uvicorn

if __name__ == "__main__":
    # Get configuration from environment variables or use defaults
    host = os.environ.get("AI_EMOTION_HOST", "0.0.0.0")
    port = int(os.environ.get("AI_EMOTION_PORT", "8000"))
    reload = os.environ.get("AI_EMOTION_RELOAD", "true").lower() == "true"

    print(f"Starting AI Emotion Analysis API server on {host}:{port}")
    uvicorn.run("app.main:app", host=host, port=port, reload=reload)
