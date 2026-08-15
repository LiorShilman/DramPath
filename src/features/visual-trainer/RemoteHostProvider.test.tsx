import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { RemoteHostProvider } from './RemoteHostProvider'
import { useRemoteHost } from './remote-host-context'
import { interactiveExerciseRepository, practiceRoutineRepository } from '../../data/repositories'
import { DEMO_EXERCISES } from './demo-exercises'
import { createId } from '../../domain'
import type { InteractiveExercise, PracticeRoutine } from '../../domain'

// RemoteHostProvider calls useNavigate() (select_exercise -> navigate to
// the chosen exercise) and useLocation() (to detect a "re-select the
// current route" no-op — see handleSelectExercise's own comment) — both
// mocked here rather than dragging in a real router tree, same reasoning
// ExerciseBuilderPage.test.tsx-style tests already apply elsewhere in this
// codebase for router-adjacent hooks. mockPathname is mutable per test
// (default '/dashboard', never a real target path) so a test can simulate
// "already on this route" by setting it to match.
const navigateSpy = vi.fn()
let mockPathname = '/dashboard'
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return { ...actual, useNavigate: () => navigateSpy, useLocation: () => ({ pathname: mockPathname }) }
})

// Same hand-rolled test-double technique as useRemoteDrumInput.test.ts —
// every socket is "open" the instant it's constructed.
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static readonly OPEN = 1
  readyState = FakeWebSocket.OPEN
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  sentMessages: string[] = []

  constructor() {
    FakeWebSocket.instances.push(this)
  }

  close() {}

  send(data: string) {
    this.sentMessages.push(data)
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

function latestSocket(): FakeWebSocket {
  const socket = FakeWebSocket.instances.at(-1)
  if (!socket) throw new Error('No FakeWebSocket instance was created')
  return socket
}

function wrapper({ children }: { children: ReactNode }) {
  return <RemoteHostProvider>{children}</RemoteHostProvider>
}

function makeFakeSession() {
  return {
    handleHit: vi.fn(),
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    skip: vi.fn(),
    previous: vi.fn(),
    resendStatus: vi.fn(),
  }
}

async function seedExercise(): Promise<InteractiveExercise> {
  return interactiveExerciseRepository.create({
    title: 'Seeded exercise',
    difficulty: 'beginner',
    bpm: 100,
    minBpm: 60,
    maxBpm: 160,
    timeSignature: { numerator: 4, denominator: 4 },
    subdivision: 'quarter',
    bars: 1,
    loopCount: 1,
    displayMode: 'staff_cursor',
    events: [{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }],
  })
}

async function seedRoutine(exerciseIds: string[]): Promise<PracticeRoutine> {
  return practiceRoutineRepository.create({ title: 'Seeded routine', exerciseIds })
}

describe('RemoteHostProvider / useRemoteHost', () => {
  afterEach(async () => {
    vi.unstubAllGlobals()
    navigateSpy.mockClear()
    mockPathname = '/dashboard'
    FakeWebSocket.instances = []
    // isEnabled reads from real (jsdom) localStorage on mount — without
    // clearing it, an earlier test's toggleEnabled() leaves it 'true', so a
    // later test's own toggleEnabled() call would actually turn the
    // connection OFF instead of on.
    localStorage.clear()
    const allExercises = await interactiveExerciseRepository.getAll()
    await Promise.all(allExercises.map((exercise) => interactiveExerciseRepository.remove(exercise.id)))
    const allRoutines = await practiceRoutineRepository.getAll()
    await Promise.all(allRoutines.map((routine) => practiceRoutineRepository.remove(routine.id)))
  })

  it('starts disabled, no connection opened', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteHost(), { wrapper })

    expect(result.current.status).toBe('disabled')
    expect(result.current.isEnabled).toBe(false)
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('toggleEnabled connects, and a hit message is forwarded to the registered session', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteHost(), { wrapper })
    const session = makeFakeSession()

    act(() => result.current.toggleEnabled())
    act(() => {
      result.current.registerSession(session)
    })

    act(() => latestSocket().simulateMessage({ type: 'hit', instrument: 'kick' }))

    expect(session.handleHit).toHaveBeenCalledWith('kick', expect.any(Number))
  })

  it('a hit message no-ops silently when no session is registered', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteHost(), { wrapper })

    act(() => result.current.toggleEnabled())

    expect(() => act(() => latestSocket().simulateMessage({ type: 'hit', instrument: 'kick' }))).not.toThrow()
  })

  it('request_exercise_list queries the repository + demo catalog and sends exercise_list back, including routines', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const seeded = await seedExercise()
    const seededRoutine = await seedRoutine([seeded.id])
    const { result } = renderHook(() => useRemoteHost(), { wrapper })

    act(() => result.current.toggleEnabled())
    act(() => latestSocket().simulateMessage({ type: 'request_exercise_list' }))

    await waitFor(() => expect(latestSocket().sentMessages.length).toBeGreaterThan(0))
    const sent = JSON.parse(latestSocket().sentMessages.at(-1)!)
    expect(sent.type).toBe('exercise_list')
    expect(sent.exercises).toContainEqual({
      id: seeded.id,
      title: seeded.title,
      bpm: seeded.bpm,
      difficulty: seeded.difficulty,
      isCustom: true,
    })
    expect(sent.exercises).toHaveLength(1 + DEMO_EXERCISES.length)
    expect(sent.routines).toEqual([{ id: seededRoutine.id, title: seededRoutine.title, exerciseCount: 1 }])
  })

  it('select_exercise sends an immediate {phase: none} playback_status, then navigates', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteHost(), { wrapper })

    act(() => result.current.toggleEnabled())
    act(() => latestSocket().simulateMessage({ type: 'select_exercise', exerciseId: 'ex-1' }))

    const sent = JSON.parse(latestSocket().sentMessages.at(-1)!)
    expect(sent).toEqual({ type: 'playback_status', exerciseId: null, title: null, bpm: null, phase: 'none' })
    expect(navigateSpy).toHaveBeenCalledWith('/practice/visual/ex-1')
  })

  it('select_routine sends an immediate {phase: none} playback_status, then navigates to the routine player', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteHost(), { wrapper })

    act(() => result.current.toggleEnabled())
    act(() => latestSocket().simulateMessage({ type: 'select_routine', routineId: 'routine-1' }))

    const sent = JSON.parse(latestSocket().sentMessages.at(-1)!)
    expect(sent).toEqual({ type: 'playback_status', exerciseId: null, title: null, bpm: null, phase: 'none' })
    expect(navigateSpy).toHaveBeenCalledWith('/practice/visual/routines/routine-1/play')
  })

  it("re-selecting the exercise already at the current route doesn't navigate, and re-asserts the registered session's real status instead of clearing it", () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    mockPathname = '/practice/visual/ex-1'
    const { result } = renderHook(() => useRemoteHost(), { wrapper })
    const session = makeFakeSession()

    act(() => result.current.toggleEnabled())
    act(() => {
      result.current.registerSession(session)
    })
    act(() => latestSocket().simulateMessage({ type: 'select_exercise', exerciseId: 'ex-1' }))

    expect(navigateSpy).not.toHaveBeenCalled()
    // No clearing {phase: 'none'} sent — a stuck-wrong phone display gets
    // corrected via the session's own resendStatus instead.
    expect(latestSocket().sentMessages).toHaveLength(0)
    expect(session.resendStatus).toHaveBeenCalledTimes(1)
  })

  it('re-selecting the routine already at the current route re-asserts real status the same way', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    mockPathname = '/practice/visual/routines/routine-1/play'
    const { result } = renderHook(() => useRemoteHost(), { wrapper })
    const session = makeFakeSession()

    act(() => result.current.toggleEnabled())
    act(() => {
      result.current.registerSession(session)
    })
    act(() => latestSocket().simulateMessage({ type: 'select_routine', routineId: 'routine-1' }))

    expect(navigateSpy).not.toHaveBeenCalled()
    expect(latestSocket().sentMessages).toHaveLength(0)
    expect(session.resendStatus).toHaveBeenCalledTimes(1)
  })

  it('re-selecting the current route with no session registered does not throw', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    mockPathname = '/practice/visual/ex-1'
    const { result } = renderHook(() => useRemoteHost(), { wrapper })

    act(() => result.current.toggleEnabled())

    expect(() =>
      act(() => latestSocket().simulateMessage({ type: 'select_exercise', exerciseId: 'ex-1' })),
    ).not.toThrow()
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('transport_command dispatches to the matching registered session method', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteHost(), { wrapper })
    const session = makeFakeSession()

    act(() => result.current.toggleEnabled())
    act(() => {
      result.current.registerSession(session)
    })

    act(() => latestSocket().simulateMessage({ type: 'transport_command', action: 'pause' }))
    expect(session.pause).toHaveBeenCalledTimes(1)

    act(() => latestSocket().simulateMessage({ type: 'transport_command', action: 'resume' }))
    expect(session.resume).toHaveBeenCalledTimes(1)

    act(() => latestSocket().simulateMessage({ type: 'transport_command', action: 'start' }))
    expect(session.start).toHaveBeenCalledTimes(1)

    act(() => latestSocket().simulateMessage({ type: 'transport_command', action: 'stop' }))
    expect(session.stop).toHaveBeenCalledTimes(1)

    act(() => latestSocket().simulateMessage({ type: 'transport_command', action: 'skip' }))
    expect(session.skip).toHaveBeenCalledTimes(1)

    act(() => latestSocket().simulateMessage({ type: 'transport_command', action: 'previous' }))
    expect(session.previous).toHaveBeenCalledTimes(1)
  })

  it("transport_command 'skip'/'previous' no-op when the registered session has neither (a plain, non-routine run)", () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteHost(), { wrapper })
    const sessionWithoutSkip = {
      handleHit: vi.fn(),
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      resendStatus: vi.fn(),
    }

    act(() => result.current.toggleEnabled())
    act(() => {
      result.current.registerSession(sessionWithoutSkip)
    })

    expect(() => act(() => latestSocket().simulateMessage({ type: 'transport_command', action: 'skip' }))).not.toThrow()
    expect(() => act(() => latestSocket().simulateMessage({ type: 'transport_command', action: 'previous' }))).not.toThrow()
  })

  it('transport_command no-ops silently when no session is registered', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteHost(), { wrapper })

    act(() => result.current.toggleEnabled())

    expect(() => act(() => latestSocket().simulateMessage({ type: 'transport_command', action: 'pause' }))).not.toThrow()
  })

  it('a controller_status increase (a phone (re)connecting) re-asserts the registered session\'s real status', () => {
    // Direct user report: a phone that drops and reconnects mid-run had no
    // way to learn the desktop's current state until the next unrelated
    // thing happened to change it — controller_status (already sent by the
    // relay on every connect/disconnect) is the actual reconnect signal.
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteHost(), { wrapper })
    const session = makeFakeSession()

    act(() => result.current.toggleEnabled())
    act(() => {
      result.current.registerSession(session)
    })

    act(() => latestSocket().simulateMessage({ type: 'controller_status', count: 1 }))

    expect(session.resendStatus).toHaveBeenCalledTimes(1)
  })

  it('a controller_status decrease (a phone disconnecting) does not trigger a resend', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteHost(), { wrapper })
    const session = makeFakeSession()

    act(() => result.current.toggleEnabled())
    act(() => {
      result.current.registerSession(session)
    })
    act(() => latestSocket().simulateMessage({ type: 'controller_status', count: 1 }))
    session.resendStatus.mockClear()

    act(() => latestSocket().simulateMessage({ type: 'controller_status', count: 0 }))

    expect(session.resendStatus).not.toHaveBeenCalled()
  })

  it('a controller_status increase with no session registered does not throw', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteHost(), { wrapper })

    act(() => result.current.toggleEnabled())

    expect(() =>
      act(() => latestSocket().simulateMessage({ type: 'controller_status', count: 1 })),
    ).not.toThrow()
  })

  it("registerSession's unregister only clears the slot if it's still the same registration (identity guard)", () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteHost(), { wrapper })
    const sessionA = makeFakeSession()
    const sessionB = makeFakeSession()

    act(() => result.current.toggleEnabled())
    let unregisterA: (() => void) | undefined
    act(() => {
      unregisterA = result.current.registerSession(sessionA)
    })
    act(() => {
      result.current.registerSession(sessionB)
    })
    // A stale cleanup from A firing after B already registered must not
    // wipe out B.
    act(() => unregisterA?.())

    act(() => latestSocket().simulateMessage({ type: 'hit', instrument: 'kick' }))
    expect(sessionB.handleHit).toHaveBeenCalled()
    expect(sessionA.handleHit).not.toHaveBeenCalled()
  })

  it('sendNotationState/sendPlaybackStatus send frames once connected', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteHost(), { wrapper })

    act(() => result.current.toggleEnabled())
    act(() => result.current.sendPlaybackStatus({ exerciseId: 'ex-1', title: 'x', bpm: 90, phase: 'running' }))

    expect(JSON.parse(latestSocket().sentMessages.at(-1)!)).toEqual({
      type: 'playback_status',
      exerciseId: 'ex-1',
      title: 'x',
      bpm: 90,
      phase: 'running',
    })
  })

  it('sendPlaybackStatus carries routineProgress through when supplied', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteHost(), { wrapper })

    act(() => result.current.toggleEnabled())
    act(() =>
      result.current.sendPlaybackStatus({
        exerciseId: 'ex-1',
        title: 'x',
        bpm: 90,
        phase: 'running',
        routineProgress: { stepIndex: 1, stepCount: 3 },
      }),
    )

    expect(JSON.parse(latestSocket().sentMessages.at(-1)!)).toEqual({
      type: 'playback_status',
      exerciseId: 'ex-1',
      title: 'x',
      bpm: 90,
      phase: 'running',
      routineProgress: { stepIndex: 1, stepCount: 3 },
    })
  })
})
