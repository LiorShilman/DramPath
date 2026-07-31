import { describe, expect, it } from 'vitest'
import { STAFF_POSITION, staffPositionToOffsetPx } from './staff-notation-layout'

describe('STAFF_POSITION', () => {
  it('places kick in the bottom space with a filled notehead', () => {
    expect(STAFF_POSITION.kick).toEqual({ position: 1, notehead: 'normal' })
  })

  it('places snare in the 2nd space from the top', () => {
    expect(STAFF_POSITION.snare).toEqual({ position: 5, notehead: 'normal' })
  })

  it('places ride on the top line, one step below tom_high in the top space', () => {
    expect(STAFF_POSITION.tom_high.position).toBe(7)
    expect(STAFF_POSITION.ride.position).toBe(8)
    expect(STAFF_POSITION.tom_high.notehead).toBe('normal')
    expect(STAFF_POSITION.ride.notehead).toBe('x')
  })

  it('gives hihat_closed and hihat_open the same position and notehead (no distinct mark)', () => {
    expect(STAFF_POSITION.hihat_closed).toEqual(STAFF_POSITION.hihat_open)
    expect(STAFF_POSITION.hihat_closed.notehead).toBe('x')
    expect(STAFF_POSITION.hihat_closed.ledger).toBeUndefined()
  })

  it('places crash at the same height as hihat, distinguished only by the ledger line', () => {
    expect(STAFF_POSITION.crash.position).toBe(STAFF_POSITION.hihat_closed.position)
    expect(STAFF_POSITION.crash.ledger).toBe(true)
    expect(STAFF_POSITION.hihat_closed.ledger).toBeUndefined()
  })
})

describe('staffPositionToOffsetPx', () => {
  it('maps position 0 to a zero offset', () => {
    expect(staffPositionToOffsetPx(0, 10)).toBe(0)
  })

  it('maps each position step to half a line-spacing', () => {
    expect(staffPositionToOffsetPx(8, 10)).toBe(40) // top line, 8 steps * 5px
  })
})
