from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from app.pipeline.analyze import analyze_stems
from app.pipeline.beat_tracking import fit_beat_map
from app.pipeline.detection import detect_events
from app.pipeline.quantize import deduplicate_quantized
from app.pipeline.toms import classify_toms
from tests.conftest import make_click_track


def test_detect_events_finds_loud_sharp_bursts_near_their_true_time():
    onset_times = [0.5, 1.0, 1.5, 2.0]
    signal = make_click_track(onset_times, duration_s=3.0)

    events = detect_events("kick", signal)

    assert len(events) == len(onset_times)
    detected_times = sorted(e["time"] for e in events)
    for expected, actual in zip(onset_times, detected_times):
        # A synthetic white-noise burst doesn't have a real drum's sharp
        # transient shape, so refine_onset's local-energy search can land
        # a bit earlier within the burst than the burst's nominal start —
        # 100ms (comfortably inside the 40ms burst plus its refinement
        # window) proves "found near the right time", not exact-sample
        # timing, which real audio wouldn't need either.
        assert abs(expected - actual) < 0.1, (expected, actual)


def test_detect_events_returns_empty_for_silence():
    silence = np.zeros(int(2.0 * 22050), dtype=np.float32)
    assert detect_events("kick", silence) == []


def test_fit_beat_map_recovers_a_regular_click_period():
    # 100 BPM => 0.6s per beat, comfortably inside the 0.575-0.625s search range.
    beat_period = 0.6
    onsets = [i * beat_period for i in range(16)]
    events_by_name = {
        "kick": [{"time": t, "confidence": 0.9} for t in onsets],
        "snare": [], "toms": [], "crash": [],
    }

    beat_map = fit_beat_map(events_by_name, duration=16 * beat_period)

    assert abs(beat_map["constant_bpm"] - 100.0) < 2.0
    assert beat_map["fit_score"] > 0.5


def test_fit_beat_map_does_not_crash_with_no_events():
    beat_map = fit_beat_map({}, duration=4.0)
    assert beat_map["constant_bpm"] > 0


def test_classify_toms_separates_three_distinct_resonant_frequencies():
    # Three synthetic "toms" at clearly distinct low frequencies, each a
    # short decaying sine burst (tom_resonance looks 25-300ms after onset
    # in the 55-360Hz band for the dominant resonance).
    duration_s = 3.0
    sr = 22050
    y = np.zeros(int(duration_s * sr), dtype=np.float32)
    onsets = [0.5, 1.5, 2.5]
    freqs = [80.0, 150.0, 280.0]  # floor / mid / high
    for onset, freq in zip(onsets, freqs):
        start = int(onset * sr)
        length = int(0.25 * sr)
        t = np.arange(length) / sr
        envelope = np.exp(-t * 12)
        y[start:start + length] += (0.8 * envelope * np.sin(2 * np.pi * freq * t)).astype(np.float32)

    events = [{"time": t, "confidence": 0.8} for t in onsets]
    classified, centers = classify_toms(events, y)

    assert len(classified) == 3
    assert len(centers) == 3
    labels = {e["instrument"] for e in classified}
    assert labels == {"floor_tom", "mid_tom", "high_tom"}


def test_deduplicate_quantized_keeps_only_the_most_confident_per_slot_and_instrument():
    events = [
        {"instrument": "kick", "beat_position": 0.0, "confidence": 0.5, "time": 0.0, "velocity": 80},
        {"instrument": "kick", "beat_position": 0.02, "confidence": 0.9, "time": 0.005, "velocity": 90},
        {"instrument": "snare", "beat_position": 1.0, "confidence": 0.7, "time": 0.6, "velocity": 100},
    ]
    result = deduplicate_quantized(events)
    kicks = [e for e in result if e["instrument"] == "kick"]
    assert len(kicks) == 1
    assert kicks[0]["confidence"] == 0.9


def test_analyze_stems_end_to_end_with_synthetic_audio(monkeypatch):
    beat_period = 0.6  # 100 BPM
    bars = 4
    kick_onsets = [i * 4 * beat_period for i in range(bars)]
    snare_onsets = [i * 4 * beat_period + 2 * beat_period for i in range(bars)]
    duration = bars * 4 * beat_period + 1.0

    kick_signal = make_click_track(kick_onsets, duration)
    snare_signal = make_click_track(snare_onsets, duration)

    fake_audio = {"kick": kick_signal, "snare": snare_signal}

    def fake_decode(path: Path) -> np.ndarray:
        return fake_audio[path.stem]

    monkeypatch.setattr("app.pipeline.analyze.decode", fake_decode)

    stem_paths = {"kick": Path("kick.wav"), "snare": Path("snare.wav")}
    result = analyze_stems(stem_paths)

    assert result["schemaVersion"] == "1.0"
    assert result["events"], "expected at least some quantized events"
    instruments = {e["instrument"] for e in result["events"]}
    assert instruments <= {"kick", "snare"}
    assert result["detectedConstantBpm"] == pytest.approx(100.0, abs=3.0)
    assert result["eventCountsByInstrument"].get("kick", 0) > 0
    assert result["eventCountsByInstrument"].get("snare", 0) > 0
    # Every event must land on a valid sixteenth-note slot.
    for event in result["events"]:
        assert 0 <= event["subdivisionIndex"] <= 3
        assert event["measure"] >= 1


def test_analyze_stems_tolerates_a_single_stem_only(monkeypatch):
    duration = 3.0
    signal = make_click_track([0.5, 1.1, 1.7], duration)
    monkeypatch.setattr("app.pipeline.analyze.decode", lambda path: signal)

    result = analyze_stems({"kick": Path("kick.wav")})

    assert result["events"]
    assert set(result["eventCountsByInstrument"].keys()) <= {"kick"}
