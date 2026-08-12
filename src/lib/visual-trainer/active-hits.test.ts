import { describe, expect, it } from 'vitest'
import { markHit } from './active-hits'

describe('markHit', () => {
  it('adds a new instrument entry', () => {
    const next = markHit({}, 'kick', 'a')
    expect(next).toEqual({ kick: 'a' })
  })

  it('updates an existing instrument entry to the new token', () => {
    const next = markHit({ kick: 'a' }, 'kick', 'b')
    expect(next).toEqual({ kick: 'b' })
  })

  it('moves the hit instrument to the end of iteration order, even if it already existed', () => {
    // hihat_closed inserted first, hihat_open second — without markHit's
    // delete+reassign, re-hitting hihat_closed again would leave it stuck
    // in first position forever, and a consumer that resolves "last entry
    // wins" (DrumKit's shared-piece logic) would keep picking hihat_open
    // even though hihat_closed was hit more recently.
    const afterFirstHits = markHit(markHit({}, 'hihat_closed', 'a'), 'hihat_open', 'b')
    expect(Object.keys(afterFirstHits)).toEqual(['hihat_closed', 'hihat_open'])

    const afterReHittingClosed = markHit(afterFirstHits, 'hihat_closed', 'c')
    expect(Object.keys(afterReHittingClosed)).toEqual(['hihat_open', 'hihat_closed'])
    expect(afterReHittingClosed).toEqual({ hihat_open: 'b', hihat_closed: 'c' })
  })

  it('leaves other instruments untouched', () => {
    const next = markHit({ snare: 'x' }, 'kick', 'a')
    expect(next).toEqual({ snare: 'x', kick: 'a' })
  })
})
