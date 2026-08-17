import { describe, expect, it } from 'vitest'
import { buildRecordingHits } from './recording-hits'
import type { ExtraHitEvent, HitResult } from '../hit-result'

function hitResult(overrides: Partial<HitResult> & Pick<HitResult, 'id' | 'expectedEventId' | 'instrument' | 'expectedTimeMs' | 'grade'>): HitResult {
  return overrides
}

describe('buildRecordingHits', () => {
  it('includes a matched hit with its real actual time and velocity', () => {
    const hits = buildRecordingHits(
      [
        hitResult({
          id: 'a',
          expectedEventId: 'e1',
          instrument: 'kick',
          expectedTimeMs: 1000,
          actualTimeMs: 1010,
          actualVelocity: 80,
          grade: 'perfect',
        }),
      ],
      [],
    )
    expect(hits).toEqual([{ instrument: 'kick', timeMs: 1010, velocity: 80 }])
  })

  it('excludes a miss (no actualTimeMs — it never made a sound)', () => {
    const hits = buildRecordingHits(
      [hitResult({ id: 'a', expectedEventId: 'e1', instrument: 'kick', expectedTimeMs: 1000, grade: 'miss' })],
      [],
    )
    expect(hits).toEqual([])
  })

  it('falls back to the flat default velocity for a keyboard/phone hit with no real velocity', () => {
    const hits = buildRecordingHits(
      [
        hitResult({
          id: 'a',
          expectedEventId: 'e1',
          instrument: 'snare',
          expectedTimeMs: 1000,
          actualTimeMs: 1000,
          grade: 'perfect',
        }),
      ],
      [],
    )
    expect(hits[0]?.velocity).toBe(100)
  })

  it('includes extra hits, falling back to the default velocity when none was recorded', () => {
    const extraHit: ExtraHitEvent = { id: 'x', instrument: 'hihat_closed', hitTimeMs: 500 }
    const hits = buildRecordingHits([], [extraHit])
    expect(hits).toEqual([{ instrument: 'hihat_closed', timeMs: 500, velocity: 100 }])
  })

  it('carries a real velocity through for an extra hit that has one', () => {
    const extraHit: ExtraHitEvent = { id: 'x', instrument: 'hihat_closed', hitTimeMs: 500, velocity: 60 }
    const hits = buildRecordingHits([], [extraHit])
    expect(hits[0]?.velocity).toBe(60)
  })

  it('sorts matched hits and extra hits together into chronological order', () => {
    const hits = buildRecordingHits(
      [
        hitResult({
          id: 'a',
          expectedEventId: 'e1',
          instrument: 'kick',
          expectedTimeMs: 2000,
          actualTimeMs: 2000,
          grade: 'perfect',
        }),
      ],
      [{ id: 'x', instrument: 'hihat_closed', hitTimeMs: 500 }],
    )
    expect(hits.map((hit) => hit.instrument)).toEqual(['hihat_closed', 'kick'])
  })
})
