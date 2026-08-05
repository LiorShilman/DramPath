import { describe, expect, it } from 'vitest'
import { CURRICULUM_STAGES } from './curriculum-stages'

const SUBDIVISION_ORDER = ['quarter', 'eighth', 'sixteenth']

describe('CURRICULUM_STAGES', () => {
  it('has internally consistent BPM ranges', () => {
    for (const stage of CURRICULUM_STAGES) {
      expect(stage.bpm.min).toBeLessThanOrEqual(stage.bpm.target)
      expect(stage.bpm.target).toBeLessThanOrEqual(stage.bpm.max)
    }
  })

  it('never decreases BPM across the progression', () => {
    for (let i = 1; i < CURRICULUM_STAGES.length; i += 1) {
      const previous = CURRICULUM_STAGES[i - 1]!
      const current = CURRICULUM_STAGES[i]!
      expect(current.bpm.min).toBeGreaterThanOrEqual(previous.bpm.min)
      expect(current.bpm.target).toBeGreaterThanOrEqual(previous.bpm.target)
      expect(current.bpm.max).toBeGreaterThanOrEqual(previous.bpm.max)
    }
  })

  it('only ever progresses subdivision forward (quarter -> eighth -> sixteenth)', () => {
    for (let i = 1; i < CURRICULUM_STAGES.length; i += 1) {
      const previousIndex = SUBDIVISION_ORDER.indexOf(CURRICULUM_STAGES[i - 1]!.subdivision)
      const currentIndex = SUBDIVISION_ORDER.indexOf(CURRICULUM_STAGES[i]!.subdivision)
      expect(currentIndex).toBeGreaterThanOrEqual(previousIndex)
    }
  })

  it('only ever grows the instrument set across the progression', () => {
    for (let i = 1; i < CURRICULUM_STAGES.length; i += 1) {
      const previousSet = new Set(CURRICULUM_STAGES[i - 1]!.instruments)
      const currentSet = new Set(CURRICULUM_STAGES[i]!.instruments)
      for (const instrument of previousSet) {
        expect(currentSet.has(instrument)).toBe(true)
      }
    }
  })

  it('orders stages sequentially starting at 1', () => {
    expect(CURRICULUM_STAGES.map((stage) => stage.order)).toEqual(
      CURRICULUM_STAGES.map((_, index) => index + 1),
    )
  })
})
