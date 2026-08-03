"""Quantization dedup — ported verbatim from the standalone script's
deduplicate_quantized. Snaps every event to its nearest sixteenth-note slot
(beat_position * 4, rounded) and keeps only the most confident hit per
(slot, instrument) pair.
"""

from __future__ import annotations

from .constants import MIDI_NOTES


def deduplicate_quantized(events: list[dict]) -> list[dict]:
    chosen: dict[tuple[int, str], dict] = {}
    for e in events:
        slot = int(round(e["beat_position"] * 4))
        key = (slot, e["instrument"])
        if key not in chosen or e["confidence"] > chosen[key]["confidence"]:
            row = dict(e)
            row["slot"] = slot
            chosen[key] = row
    return sorted(chosen.values(), key=lambda e: (e["slot"], MIDI_NOTES[e["instrument"]]))
