// A keyboard hit's timestamp comes from performance.now() (Stage 3's
// useKeyboardDrums); the exercise's own timeline is anchored to
// AudioContext.currentTime (Stage 2's ExercisePlaybackEngine). These are
// different clocks with a constant offset for the life of one AudioContext
// — captured once (`clockOffsetMs = performance.now() - audioContext.currentTime * 1000`,
// impure, stays inline where the AudioContext is created) and applied here
// to convert a hit's performance.now() timestamp into "ms since the
// exercise itself started" — the same zero point calculateEventTimeMs uses.
export function convertHitTimeToExerciseElapsedMs(
  hitTimeMs: number,
  clockOffsetMs: number,
  startAudioTimeSeconds: number,
  countInDurationMs: number,
): number {
  const audioClockMs = hitTimeMs - clockOffsetMs
  const exerciseStartAudioClockMs = startAudioTimeSeconds * 1000 + countInDurationMs
  return audioClockMs - exerciseStartAudioClockMs
}
