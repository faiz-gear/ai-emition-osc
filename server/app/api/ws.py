from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect


router = APIRouter()


@router.websocket("/ws/events")
async def ws_events(websocket: WebSocket) -> None:
    hub = websocket.app.state.hub
    await websocket.accept()
    await hub.register(websocket)
    await hub.send_snapshot(websocket)

    try:
        while True:
            await websocket.receive()
    except WebSocketDisconnect:
        return
    finally:
        await hub.unregister(websocket)

