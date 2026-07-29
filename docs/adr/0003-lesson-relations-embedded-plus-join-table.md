# ADR 0003: Lesson keeps embedded relation arrays *and* a maintained join table

## Status
Accepted — Stage 1.

## Context
SPEC.md §14's Lesson field table has `resourceIds: UUID[]` and `exerciseIds: UUID[]` embedded directly on the Lesson record. But §23.1's Dexie schema also defines a separate `lessonExercises` join table (`'[lessonId+exerciseId], lessonId, exerciseId'`). Both are present in the spec; neither is marked as replacing the other.

## Decision
`Lesson.exerciseIds` (and `resourceIds`) stay as embedded arrays on the Lesson record — they're small, ordered, and a lesson's own page always needs them together with the lesson. `lesson-repository.ts` additionally maintains the `lessonExercises` join table as a derived index: every `create`/`patch`/`remove` call syncs it from `exerciseIds`. No other code writes to `lessonExercises` directly.

## Rationale
- `Lesson.exerciseIds` is the source of truth (order matters for display; a lesson has few exercises).
- The join table exists purely to answer the reverse query cheaply — "which lessons use exercise X" (needed by the exercise detail page in a later stage) — without a full table scan over `lessons`.
- Keeping the sync logic in one place (the repository) means UI/domain code never needs to know the join table exists, matching the layering rule in §22.5 (repository owns queries; only it touches Dexie).
