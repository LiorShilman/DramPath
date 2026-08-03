import { createId } from '../../../domain'
import type { DrumInstrument, DrumNoteEvent } from '../../../domain'
import type { AnalyzeResponse, DrumHitInstrument } from '../domain/analyze-response'

// The wire format has no open/closed hi-hat distinction (matches the
// original script's own limitation — see ADR 0006) — every "hihat" hit
// becomes hihat_closed. "residual" (unclassified noise) has no equivalent
// in DrumInstrument and is dropped entirely, counted separately.
const INSTRUMENT_MAP: Partial<Record<DrumHitInstrument, DrumInstrument>> = {
  kick: 'kick',
  snare: 'snare',
  tom_floor: 'tom_floor',
  tom_mid: 'tom_mid',
  tom_high: 'tom_high',
  hihat: 'hihat_closed',
  ride: 'ride',
  crash: 'crash',
}

export interface AdaptedDrumImport {
  events: DrumNoteEvent[]
  excludedResidualCount: number
}

// measure/beatInMeasure/subdivisionIndex come from the service's sixteenth-
// note slot grid (analyze.py: measure = slot//16 + 1, beatInMeasure =
// (slot%16)/4 + 1, subdivisionIndex = slot%4) — beatInMeasure's fractional
// part duplicates subdivisionIndex, so the integer beat is its floor.
export function analyzeResponseToDrumNoteEvents(response: AnalyzeResponse): AdaptedDrumImport {
  const events: DrumNoteEvent[] = []
  let excludedResidualCount = 0

  for (const hit of response.events) {
    const instrument = INSTRUMENT_MAP[hit.instrument]
    if (!instrument) {
      excludedResidualCount += 1
      continue
    }
    events.push({
      id: createId(),
      bar: hit.measure,
      beat: Math.floor(hit.beatInMeasure),
      subdivisionIndex: hit.subdivisionIndex,
      instrument,
      velocity: hit.velocity,
    })
  }

  return { events, excludedResidualCount }
}
