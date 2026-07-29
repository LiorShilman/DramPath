# ADR 0002: PracticeSession entries are normalized, not embedded

## Status
Accepted — Stage 1.

## Context
SPEC.md §18 lists `entries: PracticeEntry[]` as a field on the Session entity. But §23.1's suggested Dexie schema defines a separate `practiceEntries` store indexed by `sessionId, exerciseId, result, bpm, startedAt` — i.e. entries as their own indexed table, not an array embedded on the session record. These two parts of the spec are inconsistent with each other.

## Decision
`practiceSessionSchema` (the stored record) has no `entries` field. `PracticeEntry` rows live in their own Dexie store keyed by `sessionId`. `practiceSessionRepository.getSessionWithEntries(id)` composes a `SessionWithEntries` view by querying `practiceEntries` on read.

## Rationale
- The Dexie schema is the concrete storage design; it wins over the looser entity-field table when the two disagree.
- Keeps `practiceEntries` independently indexable/queryable by `exerciseId`, `result`, `bpm` — needed later for the analytics stage (§21: BPM progress per exercise, time by category) without scanning every session's embedded array.
- Avoids IndexedDB's general anti-pattern of unbounded arrays growing inside a single record as a session accumulates entries over time.
