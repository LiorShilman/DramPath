# ADR 0005: Seed data distribution for grouped weeks and mixed-topic lesson ranges

## Status
Accepted — Stage 1.

## Context
SPEC.md §9's 12-week table groups several weeks together under one combined lesson range and one focus description (e.g. weeks 4-5 share lessons 10-16, focus "קריאה ומקצבי שמיניות" — two topics). It doesn't specify how many of those lessons belong to which individual week, or where the category boundary falls within a mixed-topic row. Seed data is explicitly structural/placeholder and user-editable (§24), so this only needs a reasonable, documented default.

## Decision
In `src/data/seed/course-seed.ts`: for a grouped row, its lesson count is split as evenly as possible across its weeks (front-loaded by one when it doesn't divide evenly — e.g. 7 lessons over weeks 4-5 → 4 then 3). When a row's focus names two topics, its `LessonCategory` is likewise split into two halves across the lesson range in written order (e.g. weeks 4-5: first half `reading`, second half `groove`).

## Rationale
- Simplest rule that produces a plausible, evenly-paced seed course without inventing specific lesson content.
- Deterministic and easy to verify in tests (exact counts per category/week are computable from the same rule).
- The user edits lesson week/category assignment freely after seeding, so this default only needs to be reasonable, not exact.
