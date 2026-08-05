"""Local WebSocket relay letting a phone (the "controller") send drum hits
to a desktop browser tab (the "host") over the same LAN, live, while the
desktop's VisualTrainerPage runs a graded practice session. See
docs/adr/0007-remote-drum-relay-local-lan-boundary.md in the DrumPath repo
for the architectural boundary this serves.

Run with (note --host 0.0.0.0 — unlike drum-import-service, this service
MUST be LAN-reachable by design, not just localhost):

    uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

from this directory, after `pip install -r requirements.txt`. See README.md
for the full LAN-reachability checklist (Vite --host, Windows Firewall, how
to find the desktop's LAN IP).
"""

from __future__ import annotations

import json
import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from .schemas import ControllerStatusMessage, HealthResponse, HitMessage, HostStatusMessage

RELAY_VERSION = "1.0"
# WS close code for "a second host connected and took over this one" — the
# host-side hook must treat this specific code as "don't auto-reconnect"
# (see ADR 0007) to avoid two open desktop tabs endlessly kicking each other
# off. Any other close code is an ordinary disconnect and does retry.
SUPERSEDED_CLOSE_CODE = 4001

app = FastAPI(title="DrumPath Remote Drum Relay", version=RELAY_VERSION)

# NOTE: Starlette's CORSMiddleware only processes HTTP requests — it does
# NOT apply to WebSocket connections at all. This gives /api/v1/health the
# same origin-restriction consistency as the sibling drum-import-service,
# but it is NOT access control for /ws/host or /ws/controller. This relay's
# actual trust model is "same LAN, no auth" — see the README.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("ALLOWED_ORIGIN", "http://localhost:5173")],
    allow_methods=["GET"],
    allow_headers=["*"],
)


class RelayState:
    """Single global host, any number of controllers — a deliberate v1
    simplification (personal/single-household tool, not multi-tenant): no
    pairing codes/rooms, no auth. See ADR 0007."""

    def __init__(self) -> None:
        self.host: WebSocket | None = None
        self.controllers: set[WebSocket] = set()


state = RelayState()


async def broadcast_to_controllers(message: HostStatusMessage) -> None:
    payload = message.model_dump()
    for controller in list(state.controllers):
        try:
            await controller.send_json(payload)
        except Exception:
            # A stale/broken controller socket shouldn't stop the others
            # from getting the update — its own receive loop's finally
            # block is what removes it from state.controllers.
            pass


async def notify_host_of_controller_count() -> None:
    if state.host is None:
        return
    try:
        await state.host.send_json(ControllerStatusMessage(type="controller_status", count=len(state.controllers)).model_dump())
    except Exception:
        pass


@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", version=RELAY_VERSION)


@app.websocket("/ws/host")
async def ws_host(websocket: WebSocket) -> None:
    await websocket.accept()
    previous_host = state.host
    state.host = websocket
    if previous_host is not None:
        # Assign the new host BEFORE closing the old one, so there's never a
        # window where state.host is None mid-swap (a controller message
        # arriving in that gap would otherwise be silently dropped).
        await previous_host.close(code=SUPERSEDED_CLOSE_CODE, reason="replaced-by-new-host")
    await broadcast_to_controllers(HostStatusMessage(type="host_status", connected=True))
    await notify_host_of_controller_count()

    try:
        while True:
            # The host never sends anything meaningful in v1 — this loop
            # exists purely to detect WebSocketDisconnect.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        # Only clear state.host if this socket is STILL the current host —
        # otherwise a just-replaced old socket's disconnect (which fires
        # asynchronously after being closed above) would incorrectly clear
        # the NEW host that already took its place.
        if state.host is websocket:
            state.host = None
            await broadcast_to_controllers(HostStatusMessage(type="host_status", connected=False))


@app.websocket("/ws/controller")
async def ws_controller(websocket: WebSocket) -> None:
    await websocket.accept()
    state.controllers.add(websocket)
    await websocket.send_json(HostStatusMessage(type="host_status", connected=state.host is not None).model_dump())
    await notify_host_of_controller_count()

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                hit = HitMessage.model_validate(json.loads(raw))
            except (ValidationError, json.JSONDecodeError):
                # Malformed input never crashes the loop — just ignore it
                # and keep listening for the next message.
                continue
            if state.host is not None:
                try:
                    await state.host.send_json(hit.model_dump())
                except Exception:
                    # A stale host socket shouldn't take the controller's
                    # own loop down — its disconnect is handled by /ws/host's
                    # own finally block.
                    pass
    except WebSocketDisconnect:
        pass
    finally:
        state.controllers.discard(websocket)
        await notify_host_of_controller_count()
