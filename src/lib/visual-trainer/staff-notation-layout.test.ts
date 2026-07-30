import { describe, expect, it } from 'vitest'
import { STAFF_POSITION, staffPositionToOffsetPx } from './staff-notation-layout'

describe('STAFF_POSITION', () => {
  it('places kick in the bottom space with a filled notehead', () => {
    expect(STAFF_POSITION.kick).toEqual({ position: 1, notehead: 'normal' })
  })

  it('places snare on the 2nd line from the top', () => {
    expect(STAFF_POSITION.snare).toEqual({ position: 6, notehead: 'normal' })
  })

  it('places tom_high and ride on the same top-line position but with different noteheads', () => {
    expect(STAFF_POSITION.tom_high.position).toBe(8)
    expect(STAFF_POSITION.ride.position).toBe(8)
    expect(STAFF_POSITION.tom_high.notehead).toBe('normal')
    expect(STAFF_POSITION.ride.notehead).toBe('x')
  })

  it('gives hihat_closed and hihat_open the same position and notehead (no distinct mark)', () => {
    expect(STAFF_POSITION.hihat_closed).toEqual(STAFF_POSITION.hihat_open)
    expect(STAFF_POSITION.hihat_closed.notehead).toBe('x')
    expect(STAFF_POSITION.hihat_closed.ledger).toBeUndefined()
  })

  it('places crash above the staff with a ledger line, higher than hihat', () => {
    expect(STAFF_POSITION.crash.position).toBeGreaterThan(STAFF_POSITION.hihat_closed.position)
    expect(STAFF_POSITION.crash.ledger).toBe(true)
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
