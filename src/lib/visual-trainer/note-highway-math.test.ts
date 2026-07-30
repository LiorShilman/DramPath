import { describe, expect, it } from 'vitest'
import { calculateNoteProgress, isNoteVisible } from './note-highway-math'

describe('calculateNoteProgress', () => {
  it('is 0 when the note just enters the lookahead window', () => {
    expect(calculateNoteProgress(2000, 0, 2000)).toBe(0)
  })

  it('is 1 exactly at the hit line', () => {
    expect(calculateNoteProgress(2000, 2000, 2000)).toBe(1)
  })

  it('is 0.5 halfway through the approach', () => {
    expect(calculateNoteProgress(2000, 1000, 2000)).toBe(0.5)
  })

  it('exceeds 1 once the note has passed the hit line', () => {
    expect(calculateNoteProgress(2000, 2200, 2000)).toBeCloseTo(1.1, 5)
  })
})

describe('isNoteVisible', () => {
  it('is visible at the hit line', () => {
    expect(isNoteVisible(1)).toBe(true)
  })

  it('is visible just before entering the lookahead window', () => {
    expect(isNoteVisible(-0.05)).toBe(true)
  })

  it('is not visible well before the lookahead window', () => {
    expect(isNoteVisible(-0.5)).toBe(false)
  })

  it('lingers briefly past the hit line', () => {
    expect(isNoteVisible(1.2)).toBe(true)
  })

  it('disappears well past the hit line', () => {
    expect(isNoteVisible(2)).toBe(false)
  })
})
