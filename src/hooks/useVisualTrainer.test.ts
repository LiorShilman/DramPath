import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/dom'
import { useVisualTrainer } from './useVisualTrainer'
import type { NotationStatePayload, PlaybackStatusPayload } from './useRemoteDrumInput'
import type { RemoteSession } from '../features/visual-trainer/remote-host-context'
import { ExercisePlaybackEngine } from '../lib/visual-trainer/exercise-playback-engine'
import { ACCENT_VELOCITY_MARGIN } from '../domain/calculations/hit-matcher'
import { createId, nowIso } from '../domain'
import type { DrumNoteEvent, InteractiveExercise } from '../domain'
import type { NoteHighwayHandle } from '../components/visual-trainer/NoteHighway'

// useVisualTrainer no longer owns the phone-relay WebSocket connection
// itself (moved to RemoteHostProvider, see remote-host-context.tsx) — it
// consumes useRemoteHost() instead. Mocked here with real React state (via
// dynamic import inside the factory, since vi.mock's factory runs before
// this file's own top-level code — see vi.hoisted below for the same
// reason spies/captured state live there too) so togglePhoneControl still
// genuinely re-renders, while registerSession/sendNotationState/
// sendPlaybackStatus are plain spies a test can inspect directly instead of
// needing a real WebSocket wire round-trip.
const remoteHostMocks = vi.hoisted(() => ({
  sendNotationState: vi.fn(),
  sendPlaybackStatus: vi.fn(),
  registerSession: vi.fn(),
  capturedSessionHolder: { current: undefined as RemoteSession | undefined },
}))

vi.mock('../features/visual-trainer/remote-host-context', async () => {
  const React = await import('react')
  return {
    useRemoteHost: () => {
      const [isEnabled, setIsEnabled] = React.useState(false)
      // toggleEnabled/registerSession MUST be stable (useCallback, matching
      // the real RemoteHostProvider) — useVisualTrainer's registration
      // effect depends on registerSession's identity, so a fresh function
      // every render here would re-fire that effect on every unrelated
      // re-render (e.g. every tick() state update), re-registering and
      // re-sending an 'idle' playback_status that drowns out real ones.
      const toggleEnabled = React.useCallback(() => setIsEnabled((prev: boolean) => !prev), [])
      const registerSession = React.useCallback((session: RemoteSession) => {
        remoteHostMocks.capturedSessionHolder.current = session
        remoteHostMocks.registerSession(session)
        return () => {
          if (remoteHostMocks.capturedSessionHolder.current === session) {
            remoteHostMocks.capturedSessionHolder.current = undefined
          }
        }
      }, [])
      return {
        status: isEnabled ? 'connecting' : 'disabled',
        isEnabled,
        toggleEnabled,
        sendNotationState: remoteHostMocks.sendNotationState,
        sendPlaybackStatus: remoteHostMocks.sendPlaybackStatus,
        registerSession,
      }
    },
  }
})

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

// Recording (render/encode/save) is real Web-Audio + lamejs work with its
// own dedicated unit tests (render-recording.test.ts, encode-mp3.test.ts,
// recording-hits.test.ts) — mocked here so this file only has to verify
// useVisualTrainer calls them correctly on a finished run, not re-exercise
// their own internals through jsdom's fake AudioContext.
const recordingMocks = vi.hoisted(() => ({
  renderRecording: vi.fn().mockResolvedValue({} as AudioBuffer),
  encodeMp3: vi.fn().mockReturnValue(new Blob(['fake-mp3'], { type: 'audio/mp3' })),
  createRecording: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../lib/visual-trainer/render-recording', () => ({
  renderRecording: recordingMocks.renderRecording,
}))
vi.mock('../lib/visual-trainer/encode-mp3', () => ({
  encodeMp3: recordingMocks.encodeMp3,
}))
vi.mock('../data/repositories', () => ({
  practiceRecordingRepository: { create: recordingMocks.createRecording },
}))

// Same hand-rolled test doubles as useMidiDrumInput.test.ts.
class FakeMIDIInput {
  onmidimessage: ((event: { data: Uint8Array }) => void) | null = null

  simulateMessage(bytes: number[]) {
    this.onmidimessage?.({ data: new Uint8Array(bytes) })
  }
}

class FakeMIDIAccess {
  inputs: Map<string, FakeMIDIInput>
  onstatechange: (() => void) | null = null

  constructor(inputs: FakeMIDIInput[] = []) {
    this.inputs = new Map(inputs.map((input, index) => [String(index), input]))
  }
}

function stubMidiAccess(input: FakeMIDIInput) {
  vi.stubGlobal('navigator', { ...navigator, requestMIDIAccess: vi.fn().mockResolvedValue(new FakeMIDIAccess([input])) })
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
    localStorage.clear()
    remoteHostMocks.sendNotationState.mockClear()
    remoteHostMocks.sendPlaybackStatus.mockClear()
    remoteHostMocks.registerSession.mockClear()
    remoteHostMocks.capturedSessionHolder.current = undefined
    recordingMocks.renderRecording.mockClear()
    recordingMocks.encodeMp3.mockClear()
    recordingMocks.createRecording.mockClear()
  })

  it('starts idle with empty scoring', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    expect(result.current.phase).toBe('idle')
    // Nothing has resolved yet — "nothing wrong so far", not "doing badly".
    expect(result.current.scoring.accuracyPercent).toBe(100)
  })

  it('moves from count-in to running after start', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.start())
    expect(result.current.phase).toBe('count-in')

    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })
  })

  it('advances the beat pulse during count-in instead of freezing on beat 1 for the whole count-in bar', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.start())
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

    await act(() => result.current.start())
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
    // hitTimingByEventId is set the instant this hit is graded (same render
    // as lastGrade above), not deferred until the run finishes — explicit
    // user request: the hit-position marker needs to appear live, mid-run.
    expect(result.current.hitTimingByEventId.get(exercise.events[0]!.id)).toBeGreaterThanOrEqual(0)
  })

  it('an unmatched hit is recorded in extraHits, and restart() clears it', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    // KeyK = tom_floor (keyboard-map.ts) — not in this exercise, so it
    // never matches anything and always grades 'extra'.
    act(() => {
      fireEvent.keyDown(window, { code: 'KeyK' })
    })

    await waitFor(() => expect(result.current.lastGrade).toBe('extra'))
    expect(result.current.extraHits).toHaveLength(1)
    expect(result.current.extraHits[0]).toMatchObject({ instrument: 'tom_floor' })

    act(() => result.current.restart())

    await waitFor(() => expect(result.current.extraHits).toHaveLength(0))
  })

  it('records a miss and finishes when no key is pressed', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.start())

    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })
    expect(result.current.lastGrade).toBe('miss')
    expect(result.current.scoring.accuracyPercent).toBe(0)
  })

  it('renders, encodes, and saves a recording when a real run finishes with at least one real hit', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })
    act(() => {
      fireEvent.keyDown(window, { code: 'KeyJ' })
    })

    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })

    await waitFor(() => expect(recordingMocks.createRecording).toHaveBeenCalledTimes(1))
    expect(recordingMocks.renderRecording).toHaveBeenCalledWith(
      [expect.objectContaining({ instrument: 'kick' })],
      expect.any(Number),
    )
    expect(recordingMocks.encodeMp3).toHaveBeenCalledTimes(1)
    expect(recordingMocks.createRecording).toHaveBeenCalledWith(
      expect.objectContaining({ exerciseId: exercise.id, exerciseTitle: exercise.title }),
    )
  })

  it('does not save a recording for a demo run — nothing was actually played', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.startDemo())
    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })

    expect(recordingMocks.createRecording).not.toHaveBeenCalled()
  })

  it('does not save a recording when every note was missed — nothing audible happened', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })

    expect(recordingMocks.createRecording).not.toHaveBeenCalled()
  })

  it('stops the playback engine as soon as the exercise finishes, instead of letting its metronome click schedule run out on its own', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const stopSpy = vi.spyOn(ExercisePlaybackEngine.prototype, 'stop')
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.start())
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

    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    act(() => result.current.pause())
    expect(result.current.phase).toBe('paused')

    act(() => result.current.resume())
    expect(result.current.phase).toBe('running')
  })

  it('startDemo auto-resolves every event as a perfect hit with no keypress, and sets isDemo', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    expect(result.current.isDemo).toBe(false)
    await act(() => result.current.startDemo())
    expect(result.current.isDemo).toBe(true)

    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })
    expect(result.current.lastGrade).toBe('perfect')
    expect(result.current.scoring.accuracyPercent).toBe(100)
    expect(result.current.gradeCounts.miss).toBe(0)
  })

  it('a plain start() after a previous demo run clears isDemo back to false', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.startDemo())
    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })
    expect(result.current.isDemo).toBe(true)

    await act(() => result.current.start())
    expect(result.current.isDemo).toBe(false)
  })

  it('seekDemo jumps straight into a demo run, skipping count-in and dropping events before the seek point', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    // bpm 240 -> 250ms/beat, 1000ms/bar. Seeking to 400ms lands between the
    // two events (0ms and 750ms) — only the one after the seek point should
    // ever be counted.
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
      { id: createId(), bar: 1, beat: 4, subdivisionIndex: 0, instrument: 'snare', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.seekDemo(400))

    // No count-in when seeking — straight to 'running', not 'count-in'.
    expect(result.current.phase).toBe('running')
    expect(result.current.isDemo).toBe(true)

    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })
    // Only the post-seek event (beat 4) counted — the skipped beat-1 event
    // must not silently auto-hit in a burst on the very first tick just
    // because its expectedTimeMs is already behind the seeked position.
    expect(result.current.scoring.accuracyPercent).toBe(100)
    expect(result.current.gradeCounts.perfect).toBe(1)
    expect(result.current.gradeCounts.miss).toBe(0)
  })

  it('returns to idle on exit', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 4, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    act(() => result.current.exit())
    expect(result.current.phase).toBe('idle')
  })

  it('phone control is off by default, and togglePhoneControl turns it on', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    expect(result.current.isPhoneControlEnabled).toBe(false)
    expect(result.current.remoteStatus).toBe('disabled')

    act(() => result.current.togglePhoneControl())

    expect(result.current.isPhoneControlEnabled).toBe(true)
    expect(result.current.remoteStatus).toBe('connecting')
  })

  it('registers as RemoteHostProvider\'s active session on mount, and reports an initial idle playback_status', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    expect(remoteHostMocks.registerSession).toHaveBeenCalledTimes(1)
    expect(remoteHostMocks.capturedSessionHolder.current).toBeDefined()
    expect(remoteHostMocks.sendPlaybackStatus).toHaveBeenCalledWith({
      exerciseId: exercise.id,
      title: exercise.title,
      bpm: exercise.bpm,
      phase: 'idle',
    })
  })

  it('practice-routine options: onSkip/onPrevious are exposed as the registered session\'s skip/previous, and routineProgress rides on every sendPlaybackStatus call', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const onSkip = vi.fn()
    const onPrevious = vi.fn()
    const routineProgress = { stepIndex: 1, stepCount: 3 }
    renderHook(() => useVisualTrainer(exercise, noHighwayRef, undefined, { onSkip, onPrevious, routineProgress }))

    expect(remoteHostMocks.capturedSessionHolder.current?.skip).toBe(onSkip)
    expect(remoteHostMocks.capturedSessionHolder.current?.previous).toBe(onPrevious)
    expect(remoteHostMocks.sendPlaybackStatus).toHaveBeenCalledWith({
      exerciseId: exercise.id,
      title: exercise.title,
      bpm: exercise.bpm,
      phase: 'idle',
      routineProgress,
    })
  })

  it('a plain (non-routine) hook exposes no skip/previous on the registered session', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    expect(remoteHostMocks.capturedSessionHolder.current?.skip).toBeUndefined()
    expect(remoteHostMocks.capturedSessionHolder.current?.previous).toBeUndefined()
  })

  it('sends a resultsSummary (accuracy + grade counts) alongside the finished playback_status', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    // No key ever pressed -> the single event misses and the run finishes.
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })

    expect(remoteHostMocks.sendPlaybackStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'finished',
        resultsSummary: { accuracyPercent: 0, gradeCounts: { perfect: 0, early: 0, late: 0, miss: 1, extra: 0 } },
      }),
    )
  })

  it('a hit forwarded from the registered session during running scores identically to a keyboard hit', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    act(() => remoteHostMocks.capturedSessionHolder.current?.handleHit('kick', performance.now()))

    await waitFor(() => expect(result.current.lastGrade).not.toBeUndefined())
    expect(result.current.lastGrade).not.toBe('miss')
    expect(result.current.lastGrade).not.toBe('extra')
    expect(result.current.scoring.accuracyPercent).toBe(100)
  })

  it('drops a hit forwarded before start() (idle phase) — no scoring change, no crash', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => remoteHostMocks.capturedSessionHolder.current?.handleHit('kick', performance.now()))

    expect(result.current.phase).toBe('idle')
    expect(result.current.lastGrade).toBeUndefined()
    expect(result.current.scoring.accuracyPercent).toBe(100)
  })

  it('drops a hit forwarded during a demo run — demo notes auto-resolve, real hits never count', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.startDemo())
    expect(result.current.isDemo).toBe(true)

    act(() => remoteHostMocks.capturedSessionHolder.current?.handleHit('kick', performance.now()))

    // The demo's own auto-hit already grades everything 'perfect' — a
    // real remote hit arriving mid-demo must not double-count or otherwise
    // disturb that, i.e. accuracy stays 100 either way. The real assertion
    // here is that nothing throws when a remote hit arrives during isDemo.
    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })
    expect(result.current.scoring.accuracyPercent).toBe(100)
  })

  it('start/pause/resume/exit each report the matching playback_status', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 4, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })
    expect(remoteHostMocks.sendPlaybackStatus.mock.calls.at(-1)?.[0]).toMatchObject({ phase: 'running' })

    act(() => result.current.pause())
    expect(remoteHostMocks.sendPlaybackStatus.mock.calls.at(-1)?.[0]).toMatchObject({ phase: 'paused' })

    act(() => result.current.resume())
    expect(remoteHostMocks.sendPlaybackStatus.mock.calls.at(-1)?.[0]).toMatchObject({ phase: 'running' })

    act(() => result.current.exit())
    expect(remoteHostMocks.sendPlaybackStatus.mock.calls.at(-1)?.[0]).toEqual({
      exerciseId: null,
      title: null,
      bpm: null,
      phase: 'none',
    } satisfies PlaybackStatusPayload)
  })

  it('a MIDI hit on an accented event grades dynamics as correct when struck hard enough', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100, accent: true },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await waitFor(() => expect(result.current.midiStatus).toBe('connected'))
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    // Note 36 = kick (midi-drum-map.ts). Right at the margin boundary —
    // gradeDynamics treats this as inclusive-correct.
    act(() => input.simulateMessage([0x99, 36, 100 + ACCENT_VELOCITY_MARGIN]))

    await waitFor(() => expect(result.current.lastDynamicsGrade).toBe('correct'))
  })

  it('a MIDI hit on an accented event grades dynamics as too-soft when not struck hard enough', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100, accent: true },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await waitFor(() => expect(result.current.midiStatus).toBe('connected'))
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    act(() => input.simulateMessage([0x99, 36, 100 + ACCENT_VELOCITY_MARGIN - 1]))

    await waitFor(() => expect(result.current.lastDynamicsGrade).toBe('too-soft'))
  })

  it('a MIDI hit on a non-accented event sets actualVelocity but leaves dynamicsGrade undefined', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await waitFor(() => expect(result.current.midiStatus).toBe('connected'))
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    act(() => input.simulateMessage([0x99, 36, 127]))

    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })
    expect(result.current.lastDynamicsGrade).toBeUndefined()
    expect(result.current.dynamicsSummary.points).toEqual([{ hitId: expect.any(String), actualVelocity: 127, dynamicsGrade: undefined }])
  })

  it('a keyboard hit on an accented event leaves both actualVelocity and lastDynamicsGrade undefined — no special-casing needed for non-MIDI sources', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100, accent: true },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    act(() => {
      fireEvent.keyDown(window, { code: 'KeyJ' })
    })

    await waitFor(() => expect(result.current.lastGrade).not.toBeUndefined())
    expect(result.current.lastDynamicsGrade).toBeUndefined()
    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })
    expect(result.current.dynamicsSummary.points).toEqual([])
  })

  it('demo auto-hits never populate dynamicsSummary, even for an accented event', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100, accent: true },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.startDemo())
    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })

    expect(result.current.dynamicsSummary.points).toEqual([])
  })

  it('restart() after a MIDI-graded run resets lastDynamicsGrade and dynamicsSummary back to empty', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100, accent: true },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await waitFor(() => expect(result.current.midiStatus).toBe('connected'))
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })
    act(() => input.simulateMessage([0x99, 36, 127]))
    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })
    expect(result.current.dynamicsSummary.points.length).toBeGreaterThan(0)

    act(() => result.current.restart())

    await waitFor(() => expect(result.current.dynamicsSummary.points).toEqual([]))
    expect(result.current.lastDynamicsGrade).toBeUndefined()
  })

  // Explicit user request: hands stay on the real kit, so a kick hit while
  // idle/finished starts/restarts the exercise, same as pressing Play.
  it('a kick MIDI hit while idle starts the exercise, same as pressing Play', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await waitFor(() => expect(result.current.midiStatus).toBe('connected'))
    expect(result.current.phase).toBe('idle')

    // Note 36 = kick (midi-drum-map.ts).
    act(() => input.simulateMessage([0x99, 36, 100]))

    await waitFor(() => expect(result.current.phase).toBe('count-in'), { timeout: 3000 })
  })

  it('a kick-triggered start schedules a one-shot delayed catch-up resend to the phone, on top of the initial send', async () => {
    // Direct user report: kicking to start fires the instant the pedal is
    // hit (no network round trip, unlike a phone-driven Play press) — a
    // fresh session's own async startup work occasionally hadn't settled
    // yet, leaving the phone's first notation_state/playback_status stuck
    // stale even though the exercise played correctly on the desktop. This
    // locks in the fix: a delayed resend fires shortly after the
    // kick-triggered start, independent of whatever the initial send did.
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    // The note sits far in the future (bar 1000) — this run must still be
    // mid-count-in when the assertion window closes, so a MISSED-note send
    // (runGradingTick's own detectMissedEvents path, also calls
    // sendNotationState) can't be what satisfies this test instead of the
    // catch-up resend it's actually meant to verify.
    const exercise = {
      ...makeExercise([{ id: createId(), bar: 1000, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }]),
      displayMode: 'staff_cursor' as const,
    }
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await waitFor(() => expect(result.current.midiStatus).toBe('connected'))
    expect(result.current.phase).toBe('idle')

    act(() => input.simulateMessage([0x99, 36, 100]))
    await waitFor(() => expect(result.current.phase).toBe('count-in'), { timeout: 3000 })

    remoteHostMocks.sendNotationState.mockClear()
    remoteHostMocks.sendPlaybackStatus.mockClear()

    await waitFor(
      () => {
        expect(remoteHostMocks.sendNotationState).toHaveBeenCalled()
        expect(remoteHostMocks.sendPlaybackStatus).toHaveBeenCalled()
      },
      { timeout: 1500 },
    )
    // Confirms the run is still genuinely mid-flight (not finished) when the
    // above resolves — the only thing that could have sent is the catch-up
    // resend or the natural count-in->running transition, never a miss.
    expect(result.current.phase).not.toBe('finished')
  })

  it('two kick hits landing before beginPlayback catches up only start the exercise once (no re-entrant double-start)', async () => {
    // Direct user report: a fast double-kick used to START (not restart) an
    // idle exercise sometimes broke the phone's sync. beginPlayback is
    // async (awaits audioContext.resume()), so phaseRef.current can still
    // read 'idle' for a brief window after the 1st kick already triggered
    // it — firing both kicks synchronously, in the same act(), reproduces
    // that window deterministically (a promise never resolves within the
    // same synchronous turn that created it). playSessionId incrementing by
    // exactly 1 (not 2) confirms the 2nd kick was ignored, not re-entrant.
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await waitFor(() => expect(result.current.midiStatus).toBe('connected'))
    expect(result.current.phase).toBe('idle')
    const playSessionIdBefore = result.current.playSessionId

    act(() => {
      input.simulateMessage([0x99, 36, 100])
      input.simulateMessage([0x99, 36, 100])
    })

    await waitFor(() => expect(result.current.phase).toBe('count-in'), { timeout: 3000 })
    expect(result.current.playSessionId).toBe(playSessionIdBefore + 1)
  })

  it('a kick MIDI hit after a run finishes restarts the exercise', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await waitFor(() => expect(result.current.midiStatus).toBe('connected'))
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })
    act(() => input.simulateMessage([0x99, 36, 127]))
    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })

    act(() => input.simulateMessage([0x99, 36, 127]))

    await waitFor(() => expect(result.current.phase).toBe('count-in'), { timeout: 3000 })
  })

  it('a stray extra kick from the run that just finished cannot leak into a fresh kick-started run and trigger an unwanted second restart', async () => {
    // Direct user report: after a full lesson finished, restarting via the
    // kick sometimes left the phone with no markings at all. Root cause: an
    // 'extra'-graded kick during the run left a recent timestamp in
    // lastExtraKickAtRef; the idle/finished single-kick start path (below)
    // never touched that ref, so it survived into the fresh run. A kick
    // landing during that fresh run's own earliest count-in — still within
    // the double-click window of the *stale* timestamp — read as a second
    // "double-kick restart" and fired a fully re-entrant restart while the
    // first one was still resolving. Fixed by resetting lastExtraKickAtRef
    // at the top of every beginPlayback().
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'snare', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await waitFor(() => expect(result.current.midiStatus).toBe('connected'))
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    // Note 36 = kick — never matches this snare-only exercise, so this
    // grades 'extra' and leaves a fresh timestamp in lastExtraKickAtRef.
    act(() => input.simulateMessage([0x99, 36, 100]))
    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })
    const playSessionIdAfterFirstRun = result.current.playSessionId

    // One kick restarts it from 'finished' (the idle/finished path).
    act(() => input.simulateMessage([0x99, 36, 100]))
    await waitFor(() => expect(result.current.phase).toBe('count-in'), { timeout: 3000 })
    expect(result.current.playSessionId).toBe(playSessionIdAfterFirstRun + 1)

    // A kick landing right as the fresh run begins (still snare-only, so
    // this one grades 'extra' too) must NOT read the stray timestamp from
    // the previous run as a double-kick and restart a second time.
    act(() => input.simulateMessage([0x99, 36, 100]))
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(result.current.playSessionId).toBe(playSessionIdAfterFirstRun + 1)
  })

  it('a non-kick MIDI hit while idle does nothing', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'snare', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await waitFor(() => expect(result.current.midiStatus).toBe('connected'))

    // Note 38 = snare (midi-drum-map.ts).
    act(() => input.simulateMessage([0x99, 38, 100]))

    expect(result.current.phase).toBe('idle')
  })

  it('a kick MIDI hit while paused does not restart the exercise', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await waitFor(() => expect(result.current.midiStatus).toBe('connected'))
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })
    act(() => result.current.pause())
    expect(result.current.phase).toBe('paused')

    act(() => input.simulateMessage([0x99, 36, 100]))

    expect(result.current.phase).toBe('paused')
  })

  // "Jump to start" mid-run: two kick hits that both miss the pattern
  // (graded 'extra') land close together — an exercise with no kick events
  // at all means every kick hit during the run is guaranteed 'extra',
  // regardless of exact timing, so these tests don't need to line up with
  // real note-grading windows.
  it('two rapid extra kick hits during a run restart the exercise (jump to start)', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'snare', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await waitFor(() => expect(result.current.midiStatus).toBe('connected'))
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    // Note 36 = kick (midi-drum-map.ts) — never matches this snare-only
    // exercise, so both hits grade 'extra'.
    act(() => input.simulateMessage([0x99, 36, 100]))
    act(() => input.simulateMessage([0x99, 36, 100]))

    await waitFor(() => expect(result.current.phase).toBe('count-in'), { timeout: 3000 })
  })

  it('a double-kick restart also schedules a delayed catch-up resend to the phone', async () => {
    // Same reasoning/fix as the kick-to-start catch-up resend test above —
    // direct user report that this reproduced on a double-kick restart too,
    // not just the very first kick-to-start. The note is far in the future
    // (bar 1000) for the same reason as that test: nothing else must be able
    // to send within the assertion window, or a coincidental miss-detection
    // send could pass this even with the catch-up resend itself broken —
    // exactly what happened before this test was tightened (confirmed
    // directly: the original version of this test passed even when the
    // resend's own setTimeout was silently cancelled by beginPlayback's
    // clearStickClickTimeouts(), because the snare note at bar 1/beat 1 got
    // marked missed within the same window and sent on its own).
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    const exercise = {
      ...makeExercise([{ id: createId(), bar: 1000, beat: 1, subdivisionIndex: 0, instrument: 'snare', velocity: 100 }]),
      displayMode: 'staff_cursor' as const,
    }
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await waitFor(() => expect(result.current.midiStatus).toBe('connected'))
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    act(() => input.simulateMessage([0x99, 36, 100]))
    act(() => input.simulateMessage([0x99, 36, 100]))
    await waitFor(() => expect(result.current.phase).toBe('count-in'), { timeout: 3000 })

    remoteHostMocks.sendNotationState.mockClear()
    remoteHostMocks.sendPlaybackStatus.mockClear()

    await waitFor(
      () => {
        expect(remoteHostMocks.sendNotationState).toHaveBeenCalled()
        expect(remoteHostMocks.sendPlaybackStatus).toHaveBeenCalled()
      },
      { timeout: 1500 },
    )
    expect(result.current.phase).not.toBe('finished')
  })

  it('two extra kick hits further apart than the double-click window do not restart the exercise', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'snare', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await waitFor(() => expect(result.current.midiStatus).toBe('connected'))
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    act(() => input.simulateMessage([0x99, 36, 100]))
    // Longer than DOUBLE_KICK_RESTART_WINDOW_MS (350ms in useVisualTrainer.ts).
    await new Promise((resolve) => setTimeout(resolve, 500))
    act(() => input.simulateMessage([0x99, 36, 100]))

    expect(result.current.phase).not.toBe('count-in')
  })

  it('two rapid extra hits on a non-kick pad do not restart the exercise', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    const exercise = makeExercise([
      { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
    ])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await waitFor(() => expect(result.current.midiStatus).toBe('connected'))
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    // Note 49 = crash (midi-drum-map.ts) — never matches this kick-only
    // exercise, so both hits grade 'extra', but only kick drives the gesture.
    act(() => input.simulateMessage([0x99, 49, 100]))
    act(() => input.simulateMessage([0x99, 49, 100]))

    expect(result.current.phase).not.toBe('count-in')
  })

  // notation-mirroring to the phone (ADR 0007's host->controller direction)
  // — gated purely on the isMidiControlEnabled *toggle*, not on an actual
  // MIDI device being present, so these tests don't need the FakeMIDIInput
  // doubles above. Asserts directly on the sendNotationState spy's call
  // args (a NotationStatePayload or null) — the wire-format round trip
  // itself (payload -> JSON -> notation_state/notation_clear frame) is
  // covered by remote-host-context.test.tsx instead, since that's the one
  // place a real WebSocket is still involved after this refactor.
  function latestNotationCall(): NotationStatePayload | null | undefined {
    const calls = remoteHostMocks.sendNotationState.mock.calls
    return calls.length > 0 ? (calls.at(-1)![0] as NotationStatePayload | null) : undefined
  }

  it('starting a staff_cursor run with MIDI enabled calls sendNotationState with the exercise and a negative startOffsetMs (count-in)', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = {
      ...makeExercise([{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }]),
      displayMode: 'staff_cursor' as const,
    }
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('count-in'))

    expect(remoteHostMocks.sendNotationState).toHaveBeenCalledTimes(1)
    const payload = latestNotationCall()
    expect(payload).toMatchObject({ paused: false })
    expect((payload as NotationStatePayload).exercise.id).toBe(exercise.id)
    // A count-in bar means the real audio hasn't reached bar 1 yet — the
    // same negative-startOffsetMs-as-positive-delay convention already
    // established for the desktop's own ExerciseNotationSheet.
    expect((payload as NotationStatePayload).playbackProgress.startOffsetMs).toBeLessThan(0)
    expect((payload as NotationStatePayload).gradedEventIds).toEqual({})
    // Nothing has resolved yet — "nothing wrong so far", not "doing badly".
    expect((payload as NotationStatePayload).liveAccuracyPercent).toBe(100)
  })

  it('a graded hit updates liveAccuracyPercent, and a subsequent extra hit lowers it — mirrored live, not just at finish', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = {
      ...makeExercise([
        { id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
        { id: createId(), bar: 1, beat: 4, subdivisionIndex: 0, instrument: 'snare', velocity: 100 },
      ]),
      displayMode: 'staff_cursor' as const,
    }
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    // A well-timed kick hit matches the exercise's own 1st event — stays
    // 100% (a correct hit never moves this number; only a miss or extra hit
    // does — see calculateAccuracy's own doc comment).
    act(() => {
      fireEvent.keyDown(window, { code: 'KeyJ' })
    })
    await waitFor(() => expect(result.current.lastGrade).not.toBeUndefined())
    expect((latestNotationCall() as NotationStatePayload).liveAccuracyPercent).toBe(100)

    // An extra (unmatched) hit widens the denominator (2 total + 1 extra)
    // without touching the numerator (2 total - 0 misses) — 66.67%.
    act(() => {
      fireEvent.keyDown(window, { code: 'KeyK' })
    })
    await waitFor(() => expect(result.current.lastGrade).toBe('extra'))
    expect((latestNotationCall() as NotationStatePayload).liveAccuracyPercent).toBeCloseTo(66.67, 1)
  })

  it('a graded hit during a mirrored staff_cursor+MIDI run pushes an updated gradedEventIds', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const eventId = createId()
    // A 2nd event (late in the bar) keeps the run alive after the 1st is
    // graded — with only one event, grading it also finishes the run in the
    // same tick, and the resulting sendNotationState(null) (correct, real
    // behavior) would race the assertion below.
    const exercise = {
      ...makeExercise([
        { id: eventId, bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
        { id: createId(), bar: 1, beat: 4, subdivisionIndex: 0, instrument: 'snare', velocity: 100 },
      ]),
      displayMode: 'staff_cursor' as const,
    }
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    act(() => {
      fireEvent.keyDown(window, { code: 'KeyJ' })
    })
    await waitFor(() => expect(result.current.lastGrade).not.toBeUndefined())

    const payload = latestNotationCall()
    expect(payload).not.toBeNull()
    expect((payload as NotationStatePayload).gradedEventIds[eventId]).not.toBe('miss')
    expect((payload as NotationStatePayload).gradedEventIds[eventId]).toBeDefined()
  })

  it('a missed event during a mirrored staff_cursor+MIDI run pushes an updated gradedEventIds', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const eventId = createId()
    // A 2nd event (late in the bar) keeps the run alive after the 1st is
    // missed, same reasoning as the hit-mirror test above.
    const exercise = {
      ...makeExercise([
        { id: eventId, bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 },
        { id: createId(), bar: 1, beat: 4, subdivisionIndex: 0, instrument: 'snare', velocity: 100 },
      ]),
      displayMode: 'staff_cursor' as const,
    }
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    // No key ever pressed for the 1st event — let its hit window elapse.
    await waitFor(
      () => expect((latestNotationCall() as NotationStatePayload | null)?.gradedEventIds[eventId]).toBe('miss'),
      { timeout: 3000 },
    )
  })

  it('starting a note_highway run with MIDI enabled also mirrors notation to the phone', async () => {
    // Explicit user request: the phone's own rows-of-notation view (and its
    // "coming up" hint) is a generic display for any exercise, not just
    // staff_cursor ones — only the *desktop's* own on-screen choice between
    // NoteHighway and ExerciseNotationSheet stays displayMode-gated.
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = makeExercise([{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }])
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('count-in'))

    const payload = latestNotationCall()
    expect(payload).not.toBeNull()
    expect((payload as NotationStatePayload).exercise.id).toBe(exercise.id)
  })

  it('starting a staff_cursor run WITHOUT MIDI enabled (keyboard only) calls sendNotationState(null)', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = {
      ...makeExercise([{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }]),
      displayMode: 'staff_cursor' as const,
    }
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('count-in'))

    expect(latestNotationCall()).toBeNull()
  })

  it('pause/resume resend the same notation payload with only `paused` flipped', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = {
      ...makeExercise([{ id: createId(), bar: 1, beat: 4, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }]),
      displayMode: 'staff_cursor' as const,
    }
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    act(() => result.current.pause())
    expect(latestNotationCall()).toMatchObject({ paused: true })

    act(() => result.current.resume())
    expect(latestNotationCall()).toMatchObject({ paused: false })
  })

  it("resendStatus() re-sends both playback_status AND the current notation payload — a controller (re)connecting needs a full resync, not just the phase", async () => {
    // Direct user report: a phone that drops and reconnects mid-run had no
    // way to learn the desktop's current state (including which notes were
    // already graded) until the next unrelated thing changed it.
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = {
      ...makeExercise([{ id: createId(), bar: 1, beat: 4, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }]),
      displayMode: 'staff_cursor' as const,
    }
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    remoteHostMocks.sendPlaybackStatus.mockClear()
    remoteHostMocks.sendNotationState.mockClear()

    act(() => remoteHostMocks.capturedSessionHolder.current?.resendStatus())

    expect(remoteHostMocks.sendPlaybackStatus).toHaveBeenCalledWith(expect.objectContaining({ phase: 'running' }))
    expect(remoteHostMocks.sendNotationState).toHaveBeenCalledTimes(1)
    expect((latestNotationCall() as NotationStatePayload).exercise.id).toBe(exercise.id)
  })

  it(
    'periodically resends the current notation and playback status while running — self-heals a dropped WS message',
    async () => {
      vi.stubGlobal('AudioContext', FakeAudioContext)
      // The only event sits on bar 3's own beat 4 (2750ms in, at the
      // default 240bpm) — keeps this run 'running' well past the heartbeat
      // window below, instead of finishing (and clearing notation) before
      // it's observed. Default bpm (not slowed down) keeps the count-in
      // itself short, so reaching 'running' stays comfortably inside the
      // first waitFor's own timeout.
      const exercise = {
        ...makeExercise([{ id: createId(), bar: 3, beat: 4, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }]),
        bars: 3,
        displayMode: 'staff_cursor' as const,
      }
      const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

      act(() => result.current.toggleMidiControl())
      await act(() => result.current.start())
      await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

      remoteHostMocks.sendNotationState.mockClear()
      remoteHostMocks.sendPlaybackStatus.mockClear()

      // REMOTE_HEARTBEAT_INTERVAL_TICKS * BAR_UPDATE_INTERVAL_MS = 2000ms.
      await waitFor(
        () => {
          expect(remoteHostMocks.sendNotationState).toHaveBeenCalled()
          expect(remoteHostMocks.sendPlaybackStatus).toHaveBeenCalledWith(expect.objectContaining({ phase: 'running' }))
        },
        { timeout: 3000 },
      )
    },
    8000,
  )

  it('finishing a staff_cursor+MIDI run keeps the last graded notation visible (not cleared)', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const eventId = createId()
    const exercise = {
      ...makeExercise([{ id: eventId, bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }]),
      displayMode: 'staff_cursor' as const,
    }
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await act(() => result.current.start())
    // No key ever pressed -> the single event misses and the run finishes.
    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })

    // Explicit user request: results (including the graded notation itself)
    // stay visible on the phone as long as the run hasn't been superseded
    // by a new one — the last real payload is still what's mirrored, not
    // a clearing null.
    const payload = latestNotationCall()
    expect(payload).not.toBeNull()
    expect((payload as NotationStatePayload).gradedEventIds[eventId]).toBe('miss')
  })

  it('starting a fresh run after finishing supersedes the previous run\'s notation with a clean one', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = {
      ...makeExercise([{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }]),
      displayMode: 'staff_cursor' as const,
    }
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('finished'), { timeout: 3000 })

    await act(() => result.current.restart())

    const payload = latestNotationCall()
    expect(payload).not.toBeNull()
    expect((payload as NotationStatePayload).gradedEventIds).toEqual({})
  })

  it('exiting a staff_cursor+MIDI run calls sendNotationState(null)', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const exercise = {
      ...makeExercise([{ id: createId(), bar: 1, beat: 4, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }]),
      displayMode: 'staff_cursor' as const,
    }
    const { result } = renderHook(() => useVisualTrainer(exercise, noHighwayRef))

    act(() => result.current.toggleMidiControl())
    await act(() => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('running'), { timeout: 3000 })

    act(() => result.current.exit())

    expect(latestNotationCall()).toBeNull()
  })
})
