"""Pydantic models mirroring src/features/drum-import/domain/analyze-response.ts
(the Zod schema on the DrumPath side) — keep both in sync by hand; there is
no shared-schema codegen in this scoped-down stage."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

DrumHitInstrument = Literal[
    "kick", "snare", "tom_floor", "tom_mid", "tom_high", "hihat", "ride", "crash", "residual",
]


class QuantizedDrumHit(BaseModel):
    instrument: DrumHitInstrument
    midiNote: int
    sourceTimeMs: float = Field(ge=0)
    absoluteSlot: int = Field(ge=0)
    measure: int = Field(ge=1)
    beatInMeasure: float = Field(gt=0)
    subdivisionIndex: int = Field(ge=0, le=3)
    velocity: int = Field(ge=0, le=127)
    detectionConfidence: float = Field(ge=0, le=1)
    classificationConfidence: float | None = Field(default=None, ge=0, le=1)
    isUncertain: bool


class AnalyzeResponse(BaseModel):
    schemaVersion: Literal["1.0"]
    algorithmVersion: str
    sourceDurationMs: float = Field(ge=0)
    detectedConstantBpm: float = Field(gt=0)
    beatFitScore: float
    firstDownbeatMs: float
    measures: int = Field(ge=1)
    tomResonanceCentersHz: tuple[float, float, float] | None = None
    events: list[QuantizedDrumHit]
    eventCountsByInstrument: dict[str, int]
    uncertainTomHitCount: int = Field(ge=0)
    warnings: list[str]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    ffmpegAvailable: bool
    ffmpegPath: str | None
    version: str


class ErrorResponse(BaseModel):
    detail: str
