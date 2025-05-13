from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.services.emotion_service import EmotionService
from app.models.emotion import EmotionAnalysis, TextRequest
from app.api import speech

router = APIRouter()
emotion_service = EmotionService()


class HealthResponse(BaseModel):
    status: str
    version: str


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(status="ok", version="1.0.0")


@router.post("/analyze", response_model=EmotionAnalysis)
async def analyze_text(request: TextRequest):
    """
    Analyze emotions in a text input
    """
    try:
        result = await emotion_service.analyze_text(request.text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time emotion analysis
    """
    await websocket.accept()
    try:
        while True:
            text = await websocket.receive_text()
            if not text:
                continue

            result = await emotion_service.analyze_text(text)
            await websocket.send_json(result.dict())
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket error: {str(e)}")
        await websocket.close()


# Include speech router
router.include_router(speech.router, prefix="/speech", tags=["speech"])
