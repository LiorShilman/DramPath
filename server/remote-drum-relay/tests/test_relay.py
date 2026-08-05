"""In-process WebSocket relay tests via Starlette's TestClient — no real
sockets, no separate server process."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import main
from app.main import RelayState, app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_relay_state():
    # main.state is a module-level singleton; each test gets a clean slate
    # so tests don't leak host/controller connections into each other.
    main.state = RelayState()
    yield


def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_hit_forwards_to_current_host():
    with client.websocket_connect("/ws/host") as host_ws:
        host_ws.receive_json()  # controller_status on connect (count=0)
        with client.websocket_connect("/ws/controller") as controller_ws:
            controller_ws.receive_json()  # host_status: connected=True
            host_ws.receive_json()  # controller_status: count=1

            controller_ws.send_json({"type": "hit", "instrument": "snare"})
            forwarded = host_ws.receive_json()
            assert forwarded == {"type": "hit", "instrument": "snare"}


def test_hit_with_no_host_is_dropped_without_error():
    with client.websocket_connect("/ws/controller") as controller_ws:
        controller_ws.receive_json()  # host_status: connected=False
        # Should not raise, crash the loop, or hang — just silently dropped.
        controller_ws.send_json({"type": "hit", "instrument": "kick"})
        # Connection should still be alive: prove it by sending a second hit
        # (a real host that connects afterward would receive this one).
        with client.websocket_connect("/ws/host") as host_ws:
            host_ws.receive_json()  # controller_status: count=1
            controller_ws.receive_json()  # host's connect broadcasts host_status: connected=True to controller
            controller_ws.send_json({"type": "hit", "instrument": "ride"})
            assert host_ws.receive_json() == {"type": "hit", "instrument": "ride"}


def test_malformed_controller_message_does_not_crash_the_loop():
    with client.websocket_connect("/ws/host") as host_ws:
        host_ws.receive_json()  # controller_status count=0
        with client.websocket_connect("/ws/controller") as controller_ws:
            controller_ws.receive_json()  # host_status connected=True
            host_ws.receive_json()  # controller_status count=1

            controller_ws.send_text("not json at all")
            controller_ws.send_json({"type": "hit"})  # missing instrument
            controller_ws.send_json({"type": "hit", "instrument": "not_a_real_instrument"})
            # The loop must still be alive and correctly forwarding after
            # three consecutive malformed messages.
            controller_ws.send_json({"type": "hit", "instrument": "crash"})
            assert host_ws.receive_json() == {"type": "hit", "instrument": "crash"}


def test_second_host_supersedes_first_with_close_code_4001():
    with client.websocket_connect("/ws/host") as first_host:
        first_host.receive_json()  # controller_status count=0
        with client.websocket_connect("/ws/host") as second_host:
            second_host.receive_json()  # controller_status count=0

            from starlette.websockets import WebSocketDisconnect

            with pytest.raises(WebSocketDisconnect) as excinfo:
                first_host.receive_text()
            assert excinfo.value.code == main.SUPERSEDED_CLOSE_CODE

            # The new host is the one that now actually receives hits.
            with client.websocket_connect("/ws/controller") as controller_ws:
                controller_ws.receive_json()  # host_status connected=True
                second_host.receive_json()  # controller_status count=1
                controller_ws.send_json({"type": "hit", "instrument": "hihat_closed"})
                assert second_host.receive_json() == {"type": "hit", "instrument": "hihat_closed"}


def test_controller_receives_host_status_and_updates_on_host_disconnect():
    with client.websocket_connect("/ws/controller") as controller_ws:
        assert controller_ws.receive_json() == {"type": "host_status", "connected": False}

        with client.websocket_connect("/ws/host"):
            assert controller_ws.receive_json() == {"type": "host_status", "connected": True}

        # Host's `with` block exited (disconnected) — controller should be
        # notified.
        assert controller_ws.receive_json() == {"type": "host_status", "connected": False}
