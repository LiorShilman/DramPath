# ADR 0001: Timestamps stored as ISO 8601 strings

## Status
Accepted — Stage 1.

## Context
SPEC.md doesn't specify whether `createdAt`/`updatedAt`/etc. should be stored as `Date` objects or strings. Dexie can store `Date` objects directly.

## Decision
Every timestamp field is a `string` validated by `z.iso.datetime()`, produced by `nowIso()` (`new Date().toISOString()`).

## Rationale
- JSON-safe: the §27 backup/export feature serializes the whole database to `data.json` inside a ZIP. `Date` objects don't round-trip through `JSON.stringify`/`parse` without custom logic; ISO strings do natively.
- Avoids timezone ambiguity — ISO 8601 with `Z` is unambiguous across devices/backups.
- Simplest option that satisfies every current requirement; can still be parsed into `Date` wherever display formatting needs it (later stages, `date-fns`).
