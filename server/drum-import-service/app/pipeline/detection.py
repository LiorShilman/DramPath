"""Onset detection — ported verbatim (pure functions, no changes) from the
standalone script's stft_features/local_maxima/onset_delta/refine_onset/
detect_events.
"""

from __future__ import annotations

import numpy as np
from scipy.ndimage import uniform_filter1d
from scipy.signal import find_peaks, medfilt, stft

from .constants import BANDS, MIN_DISTANCE, NFFT, SR, THRESHOLDS


def stft_features(y: np.ndarray, band: tuple[int, int]):
    f, t, z = stft(
        y, SR, window="hann", nperseg=NFFT, noverlap=NFFT - 128,
        boundary=None, padded=False,
    )
    mag = np.abs(z)
    selected = (f >= band[0]) & (f <= band[1])
    log_mag = np.log1p(100 * mag[selected])
    flux = np.r_[0.0, np.maximum(0.0, np.diff(log_mag, axis=1)).sum(axis=0)]
    baseline = medfilt(flux, 173)
    onset = np.maximum(0.0, flux - baseline)
    win = np.hanning(5)
    onset = np.convolve(onset, win / win.sum(), mode="same")
    rms = np.sqrt(np.mean(mag**2, axis=0) + 1e-15)
    rms_db = 20 * np.log10(rms + 1e-12)
    return t, onset, rms_db


def local_maxima(x: np.ndarray, min_distance: int, prominence: float):
    return find_peaks(x, distance=min_distance, prominence=prominence)[0]


def onset_delta(y: np.ndarray) -> np.ndarray:
    energy = uniform_filter1d(y * y, size=64, mode="nearest")
    return energy - np.r_[np.repeat(energy[0], 128), energy[:-128]]


def refine_onset(delta: np.ndarray, estimate: float) -> float:
    center = int(estimate * SR)
    lo = max(0, center - int(0.035 * SR))
    hi = min(len(delta), center + int(0.025 * SR))
    if hi <= lo:
        return max(0.0, estimate)
    return float((lo + int(np.argmax(delta[lo:hi]))) / SR)


def detect_events(name: str, y: np.ndarray) -> list[dict]:
    """Detect onset events for one stem. `name` must be a key of BANDS/
    MIN_DISTANCE/THRESHOLDS (kick/snare/toms/hh/ride/crash/residual)."""
    t, onset, rms_db = stft_features(y, BANDS[name])
    positive = onset[onset > 0]
    prominence = max(0.02, float(np.percentile(positive, 50))) if positive.size else 0.02
    peaks = local_maxima(
        onset, max(1, int(MIN_DISTANCE[name] * SR / 128)), prominence,
    )
    onset_min, db_min = THRESHOLDS[name]
    peak_rows = []
    delta = onset_delta(y)
    for p in peaks:
        local_db = float(rms_db[max(0, p - 2):min(len(rms_db), p + 20)].max())
        score = float(onset[p])
        if score < onset_min or local_db < db_min:
            continue
        estimate = max(0.0, float(t[p] - NFFT / (2 * SR)))
        when = refine_onset(delta, estimate)
        peak_rows.append((when, score, local_db))

    if not peak_rows:
        return []

    peak_rows.sort()
    merged = []
    for row in peak_rows:
        if merged and row[0] - merged[-1][0] < MIN_DISTANCE[name] * 0.70:
            if row[1] > merged[-1][1]:
                merged[-1] = row
        else:
            merged.append(row)

    scores = np.array([r[1] for r in merged])
    levels = np.array([r[2] for r in merged])
    s_lo, s_hi = np.percentile(scores, [10, 90]) if len(scores) > 2 else (scores.min(), scores.max())
    l_lo, l_hi = np.percentile(levels, [10, 90]) if len(levels) > 2 else (levels.min(), levels.max())
    events = []
    for when, score, level in merged:
        score_norm = float(np.clip((score - s_lo) / (s_hi - s_lo + 1e-9), 0, 1))
        level_norm = float(np.clip((level - l_lo) / (l_hi - l_lo + 1e-9), 0, 1))
        confidence = 0.55 * score_norm + 0.45 * level_norm
        velocity = int(np.clip(round(45 + 75 * (0.35 * score_norm + 0.65 * level_norm)), 35, 120))
        events.append({
            "instrument": name,
            "time": when,
            "onset_score": score,
            "level_db": level,
            "confidence": confidence,
            "velocity": velocity,
        })
    return events
