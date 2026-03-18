from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from ..models.events import StatusResponse, Utterance


router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict[str, bool]:
    return {"ok": True}


@router.get("/api/status", response_model=StatusResponse)
async def get_status(request: Request) -> StatusResponse:
    hub = request.app.state.hub
    return await hub.get_status_response()


@router.post("/api/listening/start", response_model=StatusResponse)
async def start_listening(request: Request) -> StatusResponse:
    hub = request.app.state.hub
    asr_service = request.app.state.asr_service

    try:
        await asr_service.start()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    await hub.set_listening(True)
    await hub.publish_status()
    return await hub.get_status_response()


@router.post("/api/listening/stop", response_model=StatusResponse)
async def stop_listening(request: Request) -> StatusResponse:
    hub = request.app.state.hub
    asr_service = request.app.state.asr_service

    try:
        await asr_service.stop()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    await hub.set_listening(False)
    await hub.publish_status()
    return await hub.get_status_response()


@router.get("/api/utterances", response_model=list[Utterance])
async def get_utterances(request: Request, limit: int = 200) -> list[Utterance]:
    hub = request.app.state.hub
    return await hub.get_utterances(limit=limit)

