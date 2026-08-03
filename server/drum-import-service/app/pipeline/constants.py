"""Ported verbatim from the user's own working script,
C:\\Users\\LiorS\\Downloads\\generate_drum_trial.py (kept as their standalone
reference tool, untouched). These values are the "trial-v1" preset referenced
in DRUM_AUDIO_IMPORT_AND_TRANSCRIPTION_SPEC (2).md §17 — tuned against one
song's separated stems, calibrated to favor precision over recall so the
score doesn't invent soft hits from separator bleed. Recalibrate if the
onset-score algorithm ever changes.
"""

from __future__ import annotations

SR = 22050
HOP = 128
NFFT = 1024

DrumStemKind = str  # "kick" | "snare" | "toms" | "hh" | "ride" | "crash" | "residual"

BANDS: dict[str, tuple[int, int]] = {
    "kick": (30, 300),
    "snare": (120, 7000),
    "toms": (40, 2500),
    "hh": (2500, 10000),
    "ride": (1200, 10000),
    "crash": (800, 10000),
    "residual": (40, 10000),
}

MIN_DISTANCE: dict[str, float] = {
    "kick": 0.075,
    "snare": 0.065,
    "toms": 0.065,
    "hh": 0.035,
    "ride": 0.085,
    "crash": 0.20,
    "residual": 0.065,
}

# (min_onset_score, min_level_db) per stem.
THRESHOLDS: dict[str, tuple[float, float]] = {
    "kick": (2.5, -50),
    "snare": (15.0, -50),
    "toms": (2.5, -58),
    "hh": (0.8, -70),
    "ride": (0.15, -90),
    "crash": (3.0, -62),
    "residual": (10.0, -60),
}

# General MIDI drum-map note numbers, matching the standalone script.
MIDI_NOTES: dict[str, int] = {
    "kick": 36,
    "snare": 38,
    "floor_tom": 41,
    "mid_tom": 45,
    "high_tom": 48,
    "hh": 42,
    "ride": 51,
    "crash": 49,
    "residual": 56,
}

ALGORITHM_VERSION = "drum-import-service-0.1.0"
