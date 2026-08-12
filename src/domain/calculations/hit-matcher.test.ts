import { describe, expect, it } from 'vitest'
import { ACCENT_VELOCITY_MARGIN, GRADING_THRESHOLDS, detectMissedEvents, findMatchingEvent, gradeDynamics, gradeTimingError } from './hit-matcher'
import type { PendingDrumEvent } from './hit-matcher'

const INTERMEDIATE = GRADING_THRESHOLDS.intermediate

// velocity/accent default to the same "flat, unaccented" baseline every
// real caller (ExerciseBuilderPage's NOTE_VELOCITY) uses — most of these
// tests are purely about timing and don't care about either field.
function pendingEvent(overrides: Partial<PendingDrumEvent> & Pick<PendingDrumEvent, 'eventId' | 'instrument' | 'expectedTimeMs'>): PendingDrumEvent {
  return { velocity: 100, accent: false, ...overrides }
}

describe('findMatchingEvent', () => {
  it('matches the nearest pending event for the same instrument', () => {
    const pending: PendingDrumEvent[] = [
      pendingEvent({ eventId: 'a', instrument: 'kick', expectedTimeMs: 1000 }),
      pendingEvent({ eventId: 'b', instrument: 'kick', expectedTimeMs: 2000 }),
    ]
    const result = findMatchingEvent(pending, 'kick', 1050, INTERMEDIATE)
    expect(result).toEqual({ eventId: 'a', timingErrorMs: 50, velocity: 100, accent: false })
  })

  it('ignores a pending event of the wrong instrument even if it is closer in time', () => {
    const pending: PendingDrumEvent[] = [
      pendingEvent({ eventId: 'snare-close', instrument: 'snare', expectedTimeMs: 1000 }),
      pendingEvent({ eventId: 'kick-far', instrument: 'kick', expectedTimeMs: 1030 }),
    ]
    const result = findMatchingEvent(pending, 'kick', 1000, INTERMEDIATE)
    expect(result?.eventId).toBe('kick-far')
  })

  it('returns undefined (extra hit) when the nearest candidate is outside the hit window', () => {
    const pending: PendingDrumEvent[] = [pendingEvent({ eventId: 'a', instrument: 'kick', expectedTimeMs: 1000 })]
    const result = findMatchingEvent(pending, 'kick', 1000 + INTERMEDIATE.hitMs + 1, INTERMEDIATE)
    expect(result).toBeUndefined()
  })

  it('returns undefined when there is no pending event for the instrument at all', () => {
    const pending: PendingDrumEvent[] = [pendingEvent({ eventId: 'a', instrument: 'snare', expectedTimeMs: 1000 })]
    expect(findMatchingEvent(pending, 'kick', 1000, INTERMEDIATE)).toBeUndefined()
  })

  it('breaks a tie between two equidistant candidates in favor of the earlier one', () => {
    // Both candidates are 25ms from the hit — well inside INTERMEDIATE's
    // 90ms hit window, so this is a real tie, not two out-of-range misses.
    const pending: PendingDrumEvent[] = [
      pendingEvent({ eventId: 'later', instrument: 'kick', expectedTimeMs: 1050 }),
      pendingEvent({ eventId: 'earlier', instrument: 'kick', expectedTimeMs: 1000 }),
    ]
    const result = findMatchingEvent(pending, 'kick', 1025, INTERMEDIATE)
    expect(result?.eventId).toBe('earlier')
  })

  it('carries the matched event own velocity/accent through to the result', () => {
    const pending: PendingDrumEvent[] = [pendingEvent({ eventId: 'a', instrument: 'kick', expectedTimeMs: 1000, velocity: 80, accent: true })]
    const result = findMatchingEvent(pending, 'kick', 1000, INTERMEDIATE)
    expect(result?.velocity).toBe(80)
    expect(result?.accent).toBe(true)
  })
})

describe('gradeTimingError', () => {
  it('grades a perfectly-timed hit as perfect', () => {
    expect(gradeTimingError(0, INTERMEDIATE)).toBe('perfect')
  })

  it('grades exactly at the perfect-window boundary as perfect (inclusive)', () => {
    expect(gradeTimingError(INTERMEDIATE.perfectMs, INTERMEDIATE)).toBe('perfect')
    expect(gradeTimingError(-INTERMEDIATE.perfectMs, INTERMEDIATE)).toBe('perfect')
  })

  it('grades a negative error just past the perfect window as early', () => {
    expect(gradeTimingError(-(INTERMEDIATE.perfectMs + 1), INTERMEDIATE)).toBe('early')
  })

  it('grades a positive error just past the perfect window as late', () => {
    expect(gradeTimingError(INTERMEDIATE.perfectMs + 1, INTERMEDIATE)).toBe('late')
  })

  it('grades exactly at the hit-window boundary as early/late, not miss', () => {
    expect(gradeTimingError(-INTERMEDIATE.hitMs, INTERMEDIATE)).toBe('early')
    expect(gradeTimingError(INTERMEDIATE.hitMs, INTERMEDIATE)).toBe('late')
  })
})

describe('detectMissedEvents', () => {
  it('does not mark an event missed while still inside the hit window', () => {
    const pending: PendingDrumEvent[] = [pendingEvent({ eventId: 'a', instrument: 'kick', expectedTimeMs: 1000 })]
    expect(detectMissedEvents(pending, 1000 + INTERMEDIATE.hitMs, INTERMEDIATE)).toEqual([])
  })

  it('marks an event missed once the hit window has fully elapsed', () => {
    const pending: PendingDrumEvent[] = [pendingEvent({ eventId: 'a', instrument: 'kick', expectedTimeMs: 1000 })]
    const result = detectMissedEvents(pending, 1000 + INTERMEDIATE.hitMs + 1, INTERMEDIATE)
    expect(result).toEqual(pending)
  })
})

describe('gradeDynamics', () => {
  it('grades exactly at the margin boundary as correct (inclusive)', () => {
    expect(gradeDynamics(100, 100 + ACCENT_VELOCITY_MARGIN)).toBe('correct')
  })

  it('grades one below the margin as too-soft', () => {
    expect(gradeDynamics(100, 100 + ACCENT_VELOCITY_MARGIN - 1)).toBe('too-soft')
  })

  it('grades well above the margin as correct', () => {
    expect(gradeDynamics(100, 127)).toBe('correct')
  })

  it('grades no boost at all (same velocity as the note itself) as too-soft', () => {
    expect(gradeDynamics(100, 100)).toBe('too-soft')
  })
})
