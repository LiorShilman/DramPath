import { describe, expect, it } from 'vitest'
import { CURRICULUM_STAGES } from './curriculum-stages'
import { CURRICULUM_PATTERNS } from './pattern-library'
import { subdivisionSchema } from '../../../domain'

const SUBDIVISIONS_PER_BEAT: Record<ReturnType<typeof subdivisionSchema.parse>, number> = {
  quarter: 1,
  eighth: 2,
  sixteenth: 4,
}

describe('CURRICULUM_PATTERNS', () => {
  it('has exactly 2 patterns for every stage', () => {
    for (const stage of CURRICULUM_STAGES) {
      expect(CURRICULUM_PATTERNS[stage.order]).toHaveLength(2)
    }
  })

  it('only uses instruments available at each pattern\'s stage', () => {
    for (const stage of CURRICULUM_STAGES) {
      const allowedInstruments = new Set(stage.instruments)
      for (const pattern of CURRICULUM_PATTERNS[stage.order] ?? []) {
        for (const step of pattern.steps) {
          expect(allowedInstruments.has(step.instrument)).toBe(true)
        }
      }
    }
  })

  it('keeps every step\'s subdivisionIndex in range for its stage\'s subdivision', () => {
    for (const stage of CURRICULUM_STAGES) {
      const maxIndex = SUBDIVISIONS_PER_BEAT[stage.subdivision]
      for (const pattern of CURRICULUM_PATTERNS[stage.order] ?? []) {
        for (const step of pattern.steps) {
          expect(step.subdivisionIndex).toBeGreaterThanOrEqual(0)
          expect(step.subdivisionIndex).toBeLessThan(maxIndex)
          expect(step.beat).toBeGreaterThanOrEqual(1)
          // Not hardcoded to 4 — stage 8's 3/4 meter only has beats 1-3.
          expect(step.beat).toBeLessThanOrEqual(stage.timeSignature.numerator)
        }
      }
    }
  })

  it('has no duplicate (beat, subdivisionIndex, instrument) triples within a pattern', () => {
    for (const patterns of Object.values(CURRICULUM_PATTERNS)) {
      for (const pattern of patterns) {
        const seen = new Set<string>()
        for (const step of pattern.steps) {
          const key = `${step.beat}-${step.subdivisionIndex}-${step.instrument}`
          expect(seen.has(key)).toBe(false)
          seen.add(key)
        }
      }
    }
  })

  it('gives every pattern at least one kick or snare hit', () => {
    for (const patterns of Object.values(CURRICULUM_PATTERNS)) {
      for (const pattern of patterns) {
        const hasKickOrSnare = pattern.steps.some((step) => step.instrument === 'kick' || step.instrument === 'snare')
        expect(hasKickOrSnare).toBe(true)
      }
    }
  })
})
