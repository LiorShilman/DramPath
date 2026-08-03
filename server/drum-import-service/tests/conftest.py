from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

# Allow `from app...` imports when pytest is run from this directory without
# the package being installed.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

SR = 22050


def make_click_track(onset_times: list[float], duration_s: float, burst_ms: float = 40, amplitude: float = 0.9) -> np.ndarray:
    """A short white-noise burst at each onset time, silence elsewhere —
    loud, broadband, and sharply-attacked enough to clear detect_events'
    onset-score/level thresholds (tuned for real drum hits, which share
    that same "sudden broadband energy" signature) without needing any
    real audio fixture or ffmpeg."""
    rng = np.random.default_rng(seed=0)
    signal = np.zeros(int(duration_s * SR), dtype=np.float32)
    burst_len = int(burst_ms / 1000 * SR)
    for onset in onset_times:
        start = int(onset * SR)
        end = min(len(signal), start + burst_len)
        if start >= len(signal):
            continue
        signal[start:end] += (amplitude * rng.standard_normal(end - start)).astype(np.float32)
    return signal
