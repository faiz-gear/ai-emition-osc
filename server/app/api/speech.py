from fastapi import APIRouter, WebSocket, WebSocketDisconnect, BackgroundTasks, Depends
from pydantic import BaseModel
import asyncio
from typing import Optional

from app.services.speech_service import SpeechService
from app.services.emotion_service import EmotionService

router = APIRouter()

# Shared instances of services
speech_service = None
emotion_service = EmotionService()


class SpeechSettings(BaseModel):
    """Settings for speech recognition"""

    model_path: Optional[str] = None
    sample_rate: int = 16000


@router.websocket("/listen")
async def speech_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time speech recognition and emotion analysis
    """
    await websocket.accept()

    # Initialize speech service if not already initialized
    global speech_service
    if not speech_service:
        speech_service = SpeechService()

    # Define callback for recognized text
    async def on_text_recognized(text: str):
        print(f"Speech recognized: {text}")
        try:
            # Analyze emotions in the recognized text
            emotion_result = await emotion_service.analyze_text(text)

            # Send results to WebSocket client
            await websocket.send_json({"text": text, "emotion": emotion_result.dict()})
        except Exception as e:
            print(f"Error processing text from speech: {str(e)}")
            await websocket.send_json({"error": str(e)})

    # Set callback
    speech_service.on_text_callback = on_text_recognized

    # Start speech recognition in background
    recognition_task = None
    try:
        # Start speech recognition
        recognition_task = asyncio.create_task(speech_service.start())

        # Keep connection alive and handle client commands
        while True:
            data = await websocket.receive_text()
            if data.lower() == "stop":
                break
    except WebSocketDisconnect:
        print("Client disconnected from speech recognition")
    except Exception as e:
        print(f"Error in speech WebSocket: {str(e)}")
    finally:
        # Stop speech recognition
        if speech_service._is_running:
            await speech_service.stop()

        # Cancel the task if it's still running
        if recognition_task and not recognition_task.done():
            recognition_task.cancel()
            try:
                await recognition_task
            except asyncio.CancelledError:
                pass

        # Close the websocket if it's still open
        if not websocket.client_state.DISCONNECTED:
            await websocket.close()
