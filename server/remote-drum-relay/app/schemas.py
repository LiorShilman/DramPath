"""Pydantic models for the relay's WebSocket message protocol. DrumInstrument
mirrors src/domain/interactive-exercise.ts's drumInstrumentSchema — keep both
in sync by hand, same accepted trade-off as drum-import-service/app/schemas.py
documents for its own TS/Python duplication."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

DrumInstrument = Literal[
    "kick", "snare", "hihat_closed", "hihat_open", "ride", "crash", "tom_high", "tom_mid", "tom_floor",
]


class HitMessage(BaseModel):
    type: Literal["hit"]
    instrument: DrumInstrument


class HostStatusMessage(BaseModel):
    type: Literal["host_status"]
    connected: bool


class ControllerStatusMessage(BaseModel):
    type: Literal["controller_status"]
    count: int


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str
