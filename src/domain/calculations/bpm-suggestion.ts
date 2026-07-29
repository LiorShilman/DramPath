export interface BpmSuggestionInput {
  currentBpm: number
  cleanStreak: number
  needsWorkStreak: number
  minBpm: number
  maxBpm: number
  bpmStep: number
}

export interface BpmSuggestion {
  direction: 'up' | 'down' | 'none'
  suggestedBpm: number
}

/**
 * §13 BPM algorithm (steps 2-5):
 * - 3 clean reps in the same session → suggest +bpmStep.
 * - 2 "needs work" marks → suggest -bpmStep.
 * - Never exceeds the exercise's minBpm/maxBpm.
 * - This only produces a suggestion — applying it requires explicit user
 *   confirmation elsewhere (§13: "אין שינוי אוטומטי ללא אישור המשתמש").
 */
export function suggestBpmChange(input: BpmSuggestionInput): BpmSuggestion {
  const { currentBpm, cleanStreak, needsWorkStreak, minBpm, maxBpm, bpmStep } = input

  if (cleanStreak >= 3) {
    const suggestedBpm = Math.min(currentBpm + bpmStep, maxBpm)
    if (suggestedBpm > currentBpm) {
      return { direction: 'up', suggestedBpm }
    }
  }

  if (needsWorkStreak >= 2) {
    const suggestedBpm = Math.max(currentBpm - bpmStep, minBpm)
    if (suggestedBpm < currentBpm) {
      return { direction: 'down', suggestedBpm }
    }
  }

  return { direction: 'none', suggestedBpm: currentBpm }
}
