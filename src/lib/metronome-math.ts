import type { Subdivision } from '../domain'

export const NOTES_PER_BEAT: Record<Subdivision, number> = {
  quarter: 1,
  eighth: 2,
  sixteenth: 4,
}

/** Seconds between successive metronome clicks at the given BPM/subdivision. */
export function subdivisionIntervalSeconds(bpm: number, subdivision: Subdivision): number {
  const beatIntervalSeconds = 60 / bpm
  return beatIntervalSeconds / NOTES_PER_BEAT[subdivision]
}

export function clampBpm(bpm: number, minBpm = 30, maxBpm = 240): number {
  return Math.min(maxBpm, Math.max(minBpm, Math.round(bpm)))
}

const TAP_TEMPO_MAX_TAPS = 5
// A gap this long between taps means the user paused/restarted tapping.
const TAP_TEMPO_MAX_INTERVAL_MS = 3000

/**
 * §16: "Tap Tempo לפי ממוצע ארבע ההקשות האחרונות" — averages the
 * intervals between the last up-to-5 tap timestamps (4 intervals).
 * Returns undefined when there aren't at least two usable taps.
 */
export function calculateTapTempoBpm(tapTimestampsMs: number[]): number | undefined {
  const recentTaps = tapTimestampsMs.slice(-TAP_TEMPO_MAX_TAPS)
  if (recentTaps.length < 2) return undefined

  const intervals: number[] = []
  for (let i = 1; i < recentTaps.length; i += 1) {
    const interval = recentTaps[i]! - recentTaps[i - 1]!
    if (interval > 0 && interval <= TAP_TEMPO_MAX_INTERVAL_MS) {
      intervals.push(interval)
    }
  }
  if (intervals.length === 0) return undefined

  const averageIntervalMs = intervals.reduce((sum, value) => sum + value, 0) / intervals.length
  return clampBpm(60000 / averageIntervalMs)
}
