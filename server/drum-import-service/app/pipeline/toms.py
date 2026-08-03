"""Tom classification by resonant frequency clustering — ported verbatim
(pure functions, no changes) from the standalone script's tom_resonance/
classify_toms. Clusters detected tom onsets into 3 groups (floor/mid/high)
by log2(resonant frequency), confidence per DRUM_AUDIO_IMPORT_AND_
TRANSCRIPTION_SPEC (2).md §20's formula (0.45*clusterMargin +
0.35*spectralClarity + 0.20*detectionConfidence, uncertain below 0.62).
"""

from __future__ import annotations

import numpy as np

from .constants import SR


def tom_resonance(y: np.ndarray, when: float) -> tuple[float, float]:
    lo = int((when + 0.025) * SR)
    hi = min(len(y), int((when + 0.30) * SR))
    segment = y[max(0, lo):hi]
    if len(segment) < 256:
        return 0.0, 0.0
    segment = segment - np.mean(segment)
    window = np.hanning(len(segment))
    nfft = 1 << max(13, (len(segment) - 1).bit_length())
    spectrum = np.abs(np.fft.rfft(segment * window, n=nfft))
    freqs = np.fft.rfftfreq(nfft, 1 / SR)
    mask = (freqs >= 55) & (freqs <= 360)
    vals = spectrum[mask]
    fvals = freqs[mask]
    if not len(vals) or vals.max() <= 0:
        return 0.0, 0.0
    weighted = vals / np.sqrt(np.maximum(fvals, 1))
    idx = int(np.argmax(weighted))
    frequency = float(fvals[idx])
    clarity = float(np.clip((weighted[idx] / (np.median(weighted) + 1e-9) - 2) / 18, 0, 1))
    return frequency, clarity


def classify_toms(events: list[dict], y: np.ndarray) -> tuple[list[dict], list[float]]:
    if not events:
        return [], []
    freqs, clarities = [], []
    for e in events:
        freq, clarity = tom_resonance(y, e["time"])
        freqs.append(freq)
        clarities.append(clarity)
    logf = np.log2(np.maximum(freqs, 1))
    centers = np.quantile(logf, [0.18, 0.50, 0.82])
    for _ in range(40):
        assignment = np.argmin(np.abs(logf[:, None] - centers[None, :]), axis=1)
        updated = centers.copy()
        for k in range(3):
            if np.any(assignment == k):
                updated[k] = np.median(logf[assignment == k])
        if np.max(np.abs(updated - centers)) < 1e-5:
            break
        centers = updated
    order = np.argsort(centers)
    label_for_cluster = {int(order[0]): "floor_tom", int(order[1]): "mid_tom", int(order[2]): "high_tom"}
    center_hz = [float(2 ** centers[k]) for k in order]
    result = []
    for e, lf, freq, clarity in zip(events, logf, freqs, clarities):
        distances = np.abs(lf - centers)
        cluster = int(np.argmin(distances))
        sorted_dist = np.sort(distances)
        margin = float(np.clip((sorted_dist[1] - sorted_dist[0]) / 0.40, 0, 1))
        confidence = float(np.clip(0.45 * margin + 0.35 * clarity + 0.20 * e["confidence"], 0, 1))
        row = dict(e)
        row.update({
            "instrument": label_for_cluster[cluster],
            "source_instrument": "toms",
            "tom_frequency_hz": freq,
            "tom_clarity": clarity,
            "tom_confidence": confidence,
            "tom_uncertain": confidence < 0.62,
        })
        result.append(row)
    return result, center_hz
