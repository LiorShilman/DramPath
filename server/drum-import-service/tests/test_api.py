from __future__ import annotations

import io

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import make_click_track


def test_health_endpoint_reports_status():
    client = TestClient(app)
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "ffmpegAvailable" in body


def test_analyze_requires_at_least_one_stem():
    client = TestClient(app)
    response = client.post("/api/v1/analyze", files={})
    assert response.status_code == 400


def test_analyze_returns_a_valid_response_for_synthetic_stems(monkeypatch):
    # Bypass ffmpeg/decode entirely and the health check: this test proves
    # the HTTP plumbing (multipart parsing, temp-file writing, response
    # validation) works, independent of whether ffmpeg is installed on the
    # machine running the test suite.
    monkeypatch.setattr("app.main.ffmpeg_available", lambda: (True, "fake-ffmpeg"))

    duration = 3.0
    kick = make_click_track([0.5, 1.1, 1.7, 2.3], duration)

    def fake_decode(path):
        return kick

    monkeypatch.setattr("app.pipeline.analyze.decode", fake_decode)

    client = TestClient(app)
    files = {"kick": ("kick.wav", io.BytesIO(b"not-real-audio-bytes-but-decode-is-mocked"), "audio/wav")}
    response = client.post("/api/v1/analyze", files=files)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["schemaVersion"] == "1.0"
    assert len(body["events"]) > 0
    assert all(0 <= e["subdivisionIndex"] <= 3 for e in body["events"])
