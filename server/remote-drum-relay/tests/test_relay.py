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


def test_host_message_broadcasts_verbatim_to_all_connected_controllers():
    with client.websocket_connect("/ws/host") as host_ws:
        host_ws.receive_json()  # controller_status count=0
        with client.websocket_connect("/ws/controller") as controller_a, client.websocket_connect("/ws/controller") as controller_b:
            controller_a.receive_json()  # host_status connected=True
            controller_b.receive_json()  # host_status connected=True
            host_ws.receive_json()  # controller_status count=1 (from controller_a connecting)
            host_ws.receive_json()  # controller_status count=2 (from controller_b connecting)

            notation = {"type": "notation_state", "paused": False, "playbackProgress": {"bpm": 100, "sessionId": 1}}
            host_ws.send_json(notation)

            assert controller_a.receive_json() == notation
            assert controller_b.receive_json() == notation


def test_malformed_host_message_does_not_crash_the_loop():
    with client.websocket_connect("/ws/host") as host_ws:
        host_ws.receive_json()  # controller_status count=0
        with client.websocket_connect("/ws/controller") as controller_ws:
            controller_ws.receive_json()  # host_status connected=True
            host_ws.receive_json()  # controller_status count=1

            host_ws.send_text("not json at all")
            # The loop must still be alive after the malformed frame.
            host_ws.send_json({"type": "notation_clear"})
            assert controller_ws.receive_json() == {"type": "notation_clear"}


@pytest.mark.parametrize(
    "message",
    [
        {"type": "request_exercise_list"},
        {"type": "select_exercise", "exerciseId": "ex-1"},
        {"type": "select_routine", "routineId": "routine-1"},
        {"type": "transport_command", "action": "pause"},
        {"type": "transport_command", "action": "skip"},
    ],
)
def test_full_remote_control_messages_relay_verbatim_to_the_host(message):
    # request_exercise_list/select_exercise/select_routine/transport_command
    # relay
    # verbatim, same as host->controller — no server-side shape validation
    # beyond "is this JSON at all" (see send_raw_to_host's own doc comment),
    # unlike 'hit' which keeps its separate Pydantic-validated path.
    with client.websocket_connect("/ws/host") as host_ws:
        host_ws.receive_json()  # controller_status count=0
        with client.websocket_connect("/ws/controller") as controller_ws:
            controller_ws.receive_json()  # host_status connected=True
            host_ws.receive_json()  # controller_status count=1

            controller_ws.send_json(message)
            assert host_ws.receive_json() == message


def test_full_remote_control_message_with_no_host_is_dropped_without_error():
    with client.websocket_connect("/ws/controller") as controller_ws:
        controller_ws.receive_json()  # host_status connected=False
        # Should not raise, crash the loop, or hang.
        controller_ws.send_json({"type": "request_exercise_list"})
        # Connection should still be alive — prove it with a real forward.
        with client.websocket_connect("/ws/host") as host_ws:
            host_ws.receive_json()  # controller_status count=1
            controller_ws.receive_json()  # host_status connected=True
            controller_ws.send_json({"type": "select_exercise", "exerciseId": "ex-1"})
            assert host_ws.receive_json() == {"type": "select_exercise", "exerciseId": "ex-1"}


def test_an_unknown_controller_message_type_is_silently_dropped():
    with client.websocket_connect("/ws/host") as host_ws:
        host_ws.receive_json()  # controller_status count=0
        with client.websocket_connect("/ws/controller") as controller_ws:
            controller_ws.receive_json()  # host_status connected=True
            host_ws.receive_json()  # controller_status count=1

            controller_ws.send_json({"type": "something_unrecognized"})
            # The loop must still be alive and correctly forwarding
            # afterward.
            controller_ws.send_json({"type": "hit", "instrument": "crash"})
            assert host_ws.receive_json() == {"type": "hit", "instrument": "crash"}


@pytest.mark.parametrize("raw", ["\"hello\"", "42", "[1, 2, 3]"])
def test_a_non_object_json_controller_message_does_not_crash_the_loop(raw):
    # A syntactically-valid-but-non-dict JSON frame ("hello", 42, [1,2,3])
    # must not raise AttributeError on parsed.get("type") — see the
    # isinstance(parsed, dict) guard in ws_controller.
    with client.websocket_connect("/ws/host") as host_ws:
        host_ws.receive_json()  # controller_status count=0
        with client.websocket_connect("/ws/controller") as controller_ws:
            controller_ws.receive_json()  # host_status connected=True
            host_ws.receive_json()  # controller_status count=1

            controller_ws.send_text(raw)
            # The loop must still be alive and correctly forwarding
            # afterward.
            controller_ws.send_json({"type": "hit", "instrument": "crash"})
            assert host_ws.receive_json() == {"type": "hit", "instrument": "crash"}


def test_a_controller_connecting_after_a_host_message_was_sent_does_not_retroactively_receive_it():
    # No message queueing (matches the existing hit-direction stance, see
    # ADR 0007) — a controller that connects late simply waits for the
    # host's next push, it never sees anything sent before it joined.
    with client.websocket_connect("/ws/host") as host_ws:
        host_ws.receive_json()  # controller_status count=0
        host_ws.send_json({"type": "notation_clear"})

        with client.websocket_connect("/ws/controller") as controller_ws:
            assert controller_ws.receive_json() == {"type": "host_status", "connected": True}
            host_ws.receive_json()  # controller_status count=1

            # Confirms the connection is genuinely alive and forwarding —
            # just nothing from before it joined.
            host_ws.send_json({"type": "notation_clear"})
            assert controller_ws.receive_json() == {"type": "notation_clear"}
