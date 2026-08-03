"""Beat/tempo tracking — ported verbatim (pure functions, no changes) from
the standalone script's weighted_circular_phase/fit_beat_map/time_to_beat/
beat_to_time. Fits a beat period in the 96-104 BPM range (0.575-0.625s per
beat) via circular-phase alignment against kick/snare/toms/crash onsets, then
builds a gently-smoothed per-measure tempo map.
"""

from __future__ import annotations

import math
from collections import defaultdict

import numpy as np
from scipy.signal import savgol_filter


def weighted_circular_phase(times, weights, period):
    angles = 2 * np.pi * times / period
    z = np.sum(weights * np.exp(1j * angles))
    return float((np.angle(z) % (2 * np.pi)) * period / (2 * np.pi))


def fit_beat_map(events_by_name: dict[str, list[dict]], duration: float):
    fit_names = ["kick", "snare", "toms", "crash"]
    times, weights, labels = [], [], []
    name_weight = {"kick": 1.2, "snare": 1.0, "toms": 0.75, "crash": 1.4}
    for name in fit_names:
        for e in events_by_name.get(name, []):
            times.append(e["time"])
            weights.append(name_weight[name] * (0.45 + 0.55 * e["confidence"]))
            labels.append(name)
    times = np.asarray(times)
    weights = np.asarray(weights)

    if len(times) == 0:
        # No fittable onsets at all (e.g. every stem silent/empty) — fall
        # back to a flat 120 BPM map rather than raising, so the API can
        # still return an (empty) result with a clear warning upstream.
        beat_period = 0.5
        return {
            "period": beat_period,
            "constant_bpm": 60.0 / beat_period,
            "fit_score": 0.0,
            "first_downbeat": 0.0,
            "beat_indices": np.array([0, 1], dtype=int),
            "beat_times": np.array([0.0, beat_period]),
            "local_bpm": np.array([60.0 / beat_period]),
            "downbeat_scores": [0.0, 0.0, 0.0, 0.0],
        }

    best = None
    for beat_period in np.linspace(0.575, 0.625, 501):
        subdivision = beat_period / 4.0
        phase = weighted_circular_phase(times, weights, subdivision)
        residual = ((times - phase + subdivision / 2) % subdivision) - subdivision / 2
        score = float(np.sum(weights * np.exp(-0.5 * (residual / 0.021) ** 2)) / np.sum(weights))
        if best is None or score > best[0]:
            best = (score, beat_period, phase)
    fit_score, beat_period, phase16 = best
    subdivision = beat_period / 4.0

    phase_scores = []
    for shift in range(4):
        total = 0.0
        for t, w, label in zip(times, weights, labels):
            slot = int(round((t - phase16) / subdivision))
            if slot % 4 == shift:
                total += w * (1.5 if label in {"kick", "crash"} else 1.0)
        phase_scores.append(total)
    beat_shift = int(np.argmax(phase_scores))
    beat_base = phase16 + beat_shift * subdivision
    beat_near_zero = beat_base + round(-beat_base / beat_period) * beat_period

    downbeat_scores = np.zeros(4)
    for name, factor in [("crash", 2.5), ("kick", 0.45), ("toms", 0.2)]:
        for e in events_by_name.get(name, []):
            pos = (e["time"] - beat_near_zero) / beat_period
            idx = int(round(pos))
            if abs(pos - idx) <= 0.12:
                downbeat_scores[idx % 4] += factor * (0.5 + 0.5 * e["confidence"])
    downbeat_remainder = int(np.argmax(downbeat_scores))
    candidate = beat_near_zero + downbeat_remainder * beat_period
    first_downbeat = candidate + round(-candidate / (4 * beat_period)) * 4 * beat_period

    n_min = int(math.floor((0 - first_downbeat) / beat_period)) - 2
    n_max = int(math.ceil((duration - first_downbeat) / beat_period)) + 3
    beat_indices = np.arange(n_min, n_max + 1)
    constant = first_downbeat + beat_indices * beat_period
    anchors = defaultdict(list)
    for name in ["kick", "snare", "toms", "crash", "hh"]:
        factor = {"kick": 1.1, "snare": 0.9, "toms": 0.55, "crash": 1.2, "hh": 0.25}[name]
        for e in events_by_name.get(name, []):
            beat_pos = (e["time"] - first_downbeat) / beat_period
            slot = int(round(beat_pos * 4))
            residual = e["time"] - (first_downbeat + slot * beat_period / 4)
            if abs(residual) <= 0.055:
                nearest_beat = int(round(slot / 4))
                anchors[nearest_beat].append((residual, factor * (0.4 + 0.6 * e["confidence"])))

    correction = np.full(len(beat_indices), np.nan)
    for i, beat_idx in enumerate(beat_indices):
        vals = anchors.get(int(beat_idx), [])
        if vals:
            ordered = sorted(vals)
            total = sum(w for _, w in ordered)
            running = 0.0
            for value, weight in ordered:
                running += weight
                if running >= total / 2:
                    correction[i] = value
                    break
    valid = np.flatnonzero(np.isfinite(correction))
    if len(valid) >= 2:
        correction = np.interp(np.arange(len(correction)), valid, correction[valid])
        window = min(41, len(correction) // 2 * 2 - 1)
        if window >= 7:
            correction = savgol_filter(correction, window, 2, mode="interp")
        correction = np.clip(correction, -0.035, 0.035)
    else:
        correction = np.zeros_like(constant)
    beat_times = constant + correction
    for i in range(1, len(beat_times)):
        beat_times[i] = max(beat_times[i], beat_times[i - 1] + 0.54)

    zero_at = int(np.argmin(np.abs(beat_times)))
    indexed_beats = beat_indices - beat_indices[zero_at]
    beat_times = beat_times - (beat_times[zero_at] - first_downbeat)
    first_downbeat = float(beat_times[zero_at])

    local_bpm = 60.0 / np.diff(beat_times)
    return {
        "period": float(beat_period),
        "constant_bpm": float(60 / beat_period),
        "fit_score": float(fit_score),
        "first_downbeat": first_downbeat,
        "beat_indices": indexed_beats.astype(int),
        "beat_times": beat_times,
        "local_bpm": local_bpm,
        "downbeat_scores": downbeat_scores.tolist(),
    }


def time_to_beat(t: float, beat_map: dict) -> float:
    times = beat_map["beat_times"]
    indices = beat_map["beat_indices"]
    return float(np.interp(t, times, indices))


def beat_to_time(beat: float, beat_map: dict) -> float:
    times = beat_map["beat_times"]
    indices = beat_map["beat_indices"]
    return float(np.interp(beat, indices, times))
