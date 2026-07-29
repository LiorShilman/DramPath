# ADR 0004: UserSettings is a single row in the generic `settings` store

## Status
Accepted — Stage 1.

## Context
SPEC.md §23's entity table calls `UserSettings` a "singleton". §23.1's Dexie schema defines `settings: 'key'` — a generic key-value store, not a dedicated `userSettings` table. The spec doesn't say how the singleton maps onto the key-value shape.

## Decision
`UserSettings` is stored as one row in the `settings` table, primary key `key: 'user-settings'` (a Zod `z.literal('user-settings')`), holding the whole structured settings object (theme, metronome defaults, practice rules, inactivity timeout, max resource size) as the record's other fields. `settingsRepository.getSettings()` returns `defaultUserSettings` (from `src/domain/user-settings.ts`) when the row doesn't exist yet; `updateSettings(patch)` merges and re-validates.

## Rationale
- Matches "singleton" from §23 directly — exactly one settings row exists.
- Still uses the flexible `settings` key-value store shape from §23.1, so if a second independent setting is ever needed later, it can get its own `key` without a schema migration.
- Simplest option: no separate `userSettings` table/version bump needed, no code needs to distinguish "settings not yet initialized" from an error state (defaults are computed, not stored, until the first write).
