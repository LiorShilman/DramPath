import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/dom'
import { useVisualTrainer } from './useVisualTrainer'
import { ExercisePlaybackEngine } from '../lib/visual-trainer/exercise-playback-engine'
import { createId, nowIso } from '../domain'
import type { DrumNoteEvent, InteractiveExercise } from '../domain'
import type { NoteHighwayHandle } from '../components/visual-trainer/NoteHighway'

// Same FakeAudioContext technique already established for Web-Audio-adjacent
// tests in this codebase (see PracticeSessionPage.test.tsx), extended with
// the extra node types drum-synth.ts needs. currentTime tracks real
// performance.now() (offset ~0) so the hook's real-timer-driven rAF loop
// produces genuinely correct elapsed-time math without needing to fake
// browser timers.
class FakeAudioContext {
  get currentTime() {
    return performance.now() / 1000
  }
  destination = {}
  sampleRate = 44100
  createOscillator() {
    return {
      type: '',
      frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      start() {},
      stop() {},
    }
  }
  createGain() {
    return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }
  }
  createBufferSource() {
    return { buffer: null, connect() {}, start() {}, stop() {} }
  }
  createBiquadFilter() {
    return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(1) }
  }
  resume() {
    return Promise.resolve()
  }
  suspend() {
    return Promise.resolve()
  }
  close() {
    return Promise.resolve()
  }
}

const noHighwayRef = { current: null as NoteHighwayHandle | null }

function makeExercise(events: DrumNoteEvent[]): InteractiveExercise {
  const now = nowIso()
  return {
    id: createId(),
    title: 'test exercise',
    difficulty: 'beginner',
    bpm: 240,
    minBpm: 60,
    maxBpm: 300,
    timeSignature: { numerator: 4, denominator: 4 },
    subdivision: 'quarter',
    bars: 1,
    loopCount: 1,
    displayMode: 'note_highway',
    events,
    createdAt: now,
    updatedAt: now,
  }
}

describe('useVisualTrainer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts idle with empty scoring', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    expect(result.current.phase).toBe('idle')
    expect(result.current.scoring.accuracyPercent).toBe(0)
  })

  it('moves from count-in to running after start', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.start())
    expect(result.current.phase).toBe('count-in')

    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })
  })

  it('advances the beat pulse during count-in instead of freezing on beat 1 for the whole count-in bar', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.start())
    expect(result.current.phase).toBe('count-in')

    // 240bpm/4-4 = a 250ms beat, 1000ms count-in bar — plenty of time for
    // the beat to move off 1 while still inside count-in.
    await waitFor(() => expect(result.current.currentBeat).toBeGreaterThan(1), { timeout: 3000 })
    expect(result.current.phase).toBe('count-in')
  })

  it('grades a well-timed hit as a non-miss and updates accuracy', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    // The exercise's only event is at bar1/beat1 (elapsedMs 0) — 'running'
    // is first observed right as elapsedMs crosses 0, so firing immediately
    // lands comfortably inside beginner's ±130ms hit window.
    act(() => {
      fireEvent.keyDown(window, { code: 'KeyJ' })
    })

    await waitFor(() => expect(result.current.lastGrade).not.toBeUndefined())
    expect(result.current.lastGrade).not.toBe('miss')
    expect(result.current.lastGrade).not.toBe('extra')
    expect(result.current.scoring.accuracyPercent).toBe(100)
  })

  it('records a miss and finishes when no key is pressed', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.start())

    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })
    expect(result.current.lastGrade).toBe('miss')
    expect(result.current.scoring.accuracyPercent).toBe(0)
  })

  it('stops the playback engine as soon as the exercise finishes, instead of letting its metronome click schedule run out on its own', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const stopSpy = vi.spyOn(ExercisePlaybackEngine.prototype, 'stop')
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })

    expect(stopSpy).toHaveBeenCalled()
    stopSpy.mockRestore()
  })

  it('pauses and resumes without losing phase', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 4, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    act(() => result.current.pause())
    expect(result.current.phase).toBe('paused')

    act(() => result.current.resume())
    expect(result.current.phase).toBe('running')
  })

  it('returns to idle on exit', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 4, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    act(() => result.current.exit())
    expect(result.current.phase).toBe('idle')
  })
})
