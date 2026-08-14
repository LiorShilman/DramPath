import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { RoutinePlayerPage } from './RoutinePlayerPage'
import { practiceRoutineRepository, interactiveExerciseRepository } from '../../data/repositories'
import { createId } from '../../domain'
import type { DrumNoteEvent, InteractiveExercise } from '../../domain'

// Same FakeAudioContext technique already established in useVisualTrainer.test.ts
// / FreeNotationPracticePage.test.tsx, extended with an instance counter — the
// whole point of this file's "no remount per step" test is to prove exactly
// ONE AudioContext gets created across a multi-step run, not one per step.
let audioContextInstanceCount = 0
class FakeAudioContext {
  constructor() {
    audioContextInstanceCount += 1
  }
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

// This file cares about routine mechanics (bulk resolution, not-found
// handling, no-remount-across-steps), not phone-relay behavior — mocked
// with plain stubs rather than the fuller stateful mock useVisualTrainer.test.ts
// uses for its own phone-specific assertions. registerSession DOES capture
// the session (unlike a no-op stub) so the remote 'previous' step-back test
// below can invoke it directly, exactly as RemoteHostProvider would.
const capturedSessionHolder: { current: { previous?: () => void } | undefined } = { current: undefined }
vi.mock('./remote-host-context', () => ({
  useRemoteHost: () => ({
    status: 'disabled',
    isEnabled: false,
    toggleEnabled: vi.fn(),
    sendNotationState: vi.fn(),
    sendPlaybackStatus: vi.fn(),
    registerSession: vi.fn((session: { previous?: () => void }) => {
      capturedSessionHolder.current = session
      return () => {}
    }),
  }),
}))

function makeExerciseInput(
  title: string,
  events: DrumNoteEvent[],
): Omit<InteractiveExercise, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title,
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
  }
}

function renderPage(routineId: string) {
  return render(
    <MemoryRouter initialEntries={[`/practice/visual/routines/${routineId}/play`]}>
      <Routes>
        <Route path="/practice/visual/routines/:routineId/play" element={<RoutinePlayerPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RoutinePlayerPage', () => {
  beforeEach(() => {
    audioContextInstanceCount = 0
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    const exercises = await interactiveExerciseRepository.getAll()
    await Promise.all(exercises.map((exercise) => interactiveExerciseRepository.remove(exercise.id)))
    const routines = await practiceRoutineRepository.getAll()
    await Promise.all(routines.map((routine) => practiceRoutineRepository.remove(routine.id)))
  })

  it('shows a not-found message for an unknown routine id', async () => {
    renderPage('does-not-exist')
    await waitFor(() => expect(screen.getByText('הרצף המבוקש לא קיים.')).toBeInTheDocument())
  })

  it('shows a warning (not a crash) for a step whose exercise was deleted, with a skip button when more steps remain', async () => {
    const exerciseA = await interactiveExerciseRepository.create(
      makeExerciseInput('Step A', [{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }]),
    )
    const exerciseB = await interactiveExerciseRepository.create(
      makeExerciseInput('Step B', [{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }]),
    )
    const routine = await practiceRoutineRepository.create({ title: 'Routine', exerciseIds: [exerciseA.id, exerciseB.id] })
    // Deleted since the routine was built — no cascade cleanup exists for
    // this anywhere in the app (same accepted gap Lesson/Song.exerciseIds
    // already lives with).
    await interactiveExerciseRepository.remove(exerciseA.id)

    renderPage(routine.id)

    await waitFor(() => expect(screen.getByText('התרגיל בשלב זה נמחק ואינו זמין עוד.')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'דילוג לתרגיל הבא' })).toBeInTheDocument()
  })

  it('shows a "back to routines" button (not skip) when the LAST step is the one that was deleted', async () => {
    const exerciseA = await interactiveExerciseRepository.create(
      makeExerciseInput('Step A', [{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }]),
    )
    const routine = await practiceRoutineRepository.create({ title: 'Routine', exerciseIds: [exerciseA.id] })
    await interactiveExerciseRepository.remove(exerciseA.id)

    renderPage(routine.id)

    await waitFor(() => expect(screen.getByText('התרגיל בשלב זה נמחק ואינו זמין עוד.')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'חזרה לרצפים' })).toBeInTheDocument()
  })

  it('runs a 2-step routine end to end without creating a second AudioContext for step 2', async () => {
    const exerciseA = await interactiveExerciseRepository.create(
      makeExerciseInput('Step A', [{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }]),
    )
    const exerciseB = await interactiveExerciseRepository.create(
      makeExerciseInput('Step B', [{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'snare', velocity: 100 }]),
    )
    const routine = await practiceRoutineRepository.create({ title: 'Routine', exerciseIds: [exerciseA.id, exerciseB.id] })

    renderPage(routine.id)

    // Step 1 loads idle — the first step always needs an explicit press,
    // never auto-starts.
    const startButton = await screen.findByRole('button', { name: 'התחל' })
    fireEvent.click(startButton)

    // No key ever pressed -> the single event misses and the run finishes.
    await waitFor(() => expect(screen.getByRole('button', { name: 'לתרגיל הבא' })).toBeInTheDocument(), { timeout: 3000 })
    expect(audioContextInstanceCount).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'לתרגיל הבא' }))

    // Step 2 auto-starts (every step after the first does) — same
    // AudioContext/engine reused, not recreated, per this page's whole
    // reason for existing without a per-step key.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Step B' })).toBeInTheDocument())
    expect(audioContextInstanceCount).toBe(1)
  })

  it('a remote "previous" command steps back to the prior step, and is absent on the routine\'s own first step', async () => {
    const exerciseA = await interactiveExerciseRepository.create(
      makeExerciseInput('Step A', [{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }]),
    )
    const exerciseB = await interactiveExerciseRepository.create(
      makeExerciseInput('Step B', [{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'snare', velocity: 100 }]),
    )
    const routine = await practiceRoutineRepository.create({ title: 'Routine', exerciseIds: [exerciseA.id, exerciseB.id] })

    renderPage(routine.id)

    // On step 1, nothing is registered to step back to.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Step A' })).toBeInTheDocument())
    expect(capturedSessionHolder.current?.previous).toBeUndefined()

    const startButton = await screen.findByRole('button', { name: 'התחל' })
    fireEvent.click(startButton)
    await waitFor(() => expect(screen.getByRole('button', { name: 'לתרגיל הבא' })).toBeInTheDocument(), { timeout: 3000 })
    fireEvent.click(screen.getByRole('button', { name: 'לתרגיל הבא' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Step B' })).toBeInTheDocument())

    // Now on step 2, a registered `previous` steps back to step 1 — the
    // same mechanism a remote 'previous' transport_command reaches.
    expect(capturedSessionHolder.current?.previous).toBeDefined()
    act(() => capturedSessionHolder.current!.previous!())

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Step A' })).toBeInTheDocument())
    expect(audioContextInstanceCount).toBe(1)
  })
})
