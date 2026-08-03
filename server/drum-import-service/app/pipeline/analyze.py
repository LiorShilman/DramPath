"""New orchestration (not in the standalone script, which hardcodes exactly
7 fixed file paths in a module-level main()) — mirrors main()'s pipeline
(decode -> detect -> classify toms -> fit beat map -> quantize) but accepts
a partial stem set and returns a plain dict ready for the API's Pydantic
response model, instead of writing MIDI/MusicXML/PDF files to disk.
"""

from __future__ import annotations

import math
from collections import defaultdict
from pathlib import Path

import numpy as np

from .beat_tracking import fit_beat_map, time_to_beat
from .constants import ALGORITHM_VERSION, MIDI_NOTES
from .decode import decode
from .detection import detect_events
from .quantize import deduplicate_quantized
from .toms import classify_toms

# Wire-format instrument names differ slightly from the pipeline's own
# internal stem/tom names (see constants.MIDI_NOTES keys) — "hh" on the wire
# is called "hihat" (matches DrumPath's own naming closer), everything else
# is identical.
_WIRE_INSTRUMENT = {
    "kick": "kick",
    "snare": "snare",
    "floor_tom": "tom_floor",
    "mid_tom": "tom_mid",
    "high_tom": "tom_high",
    "hh": "hihat",
    "ride": "ride",
    "crash": "crash",
    "residual": "residual",
}


def analyze_stems(stem_paths: dict[str, Path]) -> dict:
    """stem_paths keys: subset of kick/snare/toms/hh/ride/crash/residual.
    Returns a plain dict matching schemas.AnalyzeResponse."""
    warnings: list[str] = []

    audio = {name: decode(path) for name, path in stem_paths.items()}
    duration = max((len(y) for y in audio.values()), default=0) / 22050
    events_by_name = {name: detect_events(name, y) for name, y in audio.items() if name != "toms"}

    if "ride" in audio and float(np.max(np.abs(audio["ride"]))) < 0.003:
        events_by_name["ride"] = []
        warnings.append("ride stem was effectively silent; omitted")

    beat_map = fit_beat_map(events_by_name, duration)
    if beat_map["fit_score"] == 0.0:
        warnings.append("no strong kick/snare/toms/crash onsets found; tempo could not be fit reliably")

    tom_source = audio.get("toms")
    tom_events, tom_centers = (
        classify_toms(detect_events("toms", tom_source), tom_source)
        if tom_source is not None
        else ([], [])
    )

    all_events = [row for rows in events_by_name.values() for row in rows]
    all_events.extend(tom_events)
    all_events.sort(key=lambda e: e["time"])

    for e in all_events:
        e["beat_position"] = time_to_beat(e["time"], beat_map)
    quantized = deduplicate_quantized(all_events)

    last_beat = max((e["beat_position"] for e in all_events), default=0)
    total_measures = max(1, int(math.ceil((last_beat + 0.25) / 4)))

    events_out = []
    counts: dict[str, int] = defaultdict(int)
    uncertain_tom_count = 0
    for e in quantized:
        if e["slot"] < 0:
            # A hit landing before the detected beat-0 downbeat (e.g. a
            # pickup, or beat-map phase choosing a downbeat slightly after
            # the true first hit) has no valid bar/beat position — the
            # original script's own write_musicxml has the identical
            # `if slot < 0: continue` guard for the same reason.
            continue
        wire_instrument = _WIRE_INSTRUMENT[e["instrument"]]
        counts[wire_instrument] += 1
        is_uncertain = bool(e.get("tom_uncertain", False))
        if is_uncertain:
            uncertain_tom_count += 1
        measure = e["slot"] // 16 + 1
        beat_in_measure = (e["slot"] % 16) / 4 + 1
        events_out.append({
            "instrument": wire_instrument,
            "midiNote": MIDI_NOTES[e["instrument"]],
            "sourceTimeMs": round(e["time"] * 1000, 3),
            "absoluteSlot": e["slot"],
            "measure": measure,
            "beatInMeasure": round(beat_in_measure, 4),
            "subdivisionIndex": e["slot"] % 4,
            "velocity": int(e["velocity"]),
            "detectionConfidence": round(float(e["confidence"]), 4),
            "classificationConfidence": (
                round(float(e["tom_confidence"]), 4) if "tom_confidence" in e else None
            ),
            "isUncertain": is_uncertain,
        })

    return {
        "schemaVersion": "1.0",
        "algorithmVersion": ALGORITHM_VERSION,
        "sourceDurationMs": round(duration * 1000, 3),
        "detectedConstantBpm": round(beat_map["constant_bpm"], 4),
        "beatFitScore": round(beat_map["fit_score"], 4),
        "firstDownbeatMs": round(beat_map["first_downbeat"] * 1000, 4),
        "measures": total_measures,
        "tomResonanceCentersHz": (
            [round(v, 2) for v in tom_centers] if len(tom_centers) == 3 else None
        ),
        "events": events_out,
        "eventCountsByInstrument": dict(counts),
        "uncertainTomHitCount": uncertain_tom_count,
        "warnings": warnings,
    }
