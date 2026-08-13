import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useRemoteDrumInput } from './useRemoteDrumInput'
import { PRODUCTION_RELAY_PORT, SUPERSEDED_CLOSE_CODE } from '../lib/visual-trainer/remote-drum-protocol'
import type { InteractiveExercise } from '../domain'
import { createId, nowIso } from '../domain'

// Hand-rolled test double, same technique this codebase already uses for
// Web-Audio-adjacent tests (see useVisualTrainer.test.ts's FakeAudioContext)
// — records every instance created so a test can grab the most recent one
// and simulate the server pushing a message/close event onto it. OPEN/
// readyState exist specifically for sendNotationState's own OPEN check —
// every socket here is "open" the instant it's constructed, same as every
// other assumption these tests already make (no separate onopen step).
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static readonly OPEN = 1
  url: string
  readyState = FakeWebSocket.OPEN
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  closed = false
  sentMessages: string[] = []

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  close() {
    this.closed = true
    this.readyState = 3
  }

  send(data: string) {
    this.sentMessages.push(data)
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }

  simulateClose(code: number) {
    this.onclose?.({ code })
  }
}

function latestSocket(): FakeWebSocket {
  const socket = FakeWebSocket.instances.at(-1)
  if (!socket) throw new Error('No FakeWebSocket instance was created')
  return socket
}

function makeExercise(): InteractiveExercise {
  const now = nowIso()
  return {
    id: createId(),
    title: 'test exercise',
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
    createdAt: now,
    updatedAt: now,
  }
}

describe('useRemoteDrumInput', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    FakeWebSocket.instances = []
  })

  it('starts disabled and opens no connection when enabled is false', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const { result } = renderHook(() => useRemoteDrumInput({ enabled: false, onHit }))

    expect(result.current.status).toBe('disabled')
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('connects to the local relay and reflects waiting-for-phone / connected from controller_status', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const { result } = renderHook(() => useRemoteDrumInput({ enabled: true, onHit }))

    expect(result.current.status).toBe('connecting')
    expect(latestSocket().url).toBe('ws://localhost:8001/ws/host')
  })

  it('connects to the fixed production relay address when the page itself was loaded over https', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    vi.stubGlobal('location', { protocol: 'https:', hostname: 'shilmanlior2608.ddns.net' })
    const onHit = vi.fn()
    renderHook(() => useRemoteDrumInput({ enabled: true, onHit }))

    expect(latestSocket().url).toBe(`wss://shilmanlior2608.ddns.net:${PRODUCTION_RELAY_PORT}/ws/host`)
  })

  it('calls onHit with the instrument and a performance.now()-comparable timestamp on a hit message', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    renderHook(() => useRemoteDrumInput({ enabled: true, onHit }))

    const before = performance.now()
    act(() => latestSocket().simulateMessage({ type: 'hit', instrument: 'crash' }))
    const after = performance.now()

    expect(onHit).toHaveBeenCalledTimes(1)
    expect(onHit.mock.calls[0]![0]).toBe('crash')
    const hitTimeMs = onHit.mock.calls[0]![1] as number
    expect(hitTimeMs).toBeGreaterThanOrEqual(before)
    expect(hitTimeMs).toBeLessThanOrEqual(after)
  })

  it('ignores a malformed message without crashing or calling onHit', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const { result } = renderHook(() => useRemoteDrumInput({ enabled: true, onHit }))

    act(() => latestSocket().onmessage?.({ data: 'not json' }))

    expect(onHit).not.toHaveBeenCalled()
    expect(result.current.status).toBe('connecting')
  })

  it('goes to superseded on close code 4001 and does not reconnect', () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const { result } = renderHook(() => useRemoteDrumInput({ enabled: true, onHit }))

    act(() => latestSocket().simulateClose(SUPERSEDED_CLOSE_CODE))
    expect(result.current.status).toBe('superseded')

    act(() => vi.advanceTimersByTime(10_000))
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('reconnects after an ordinary close', () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    renderHook(() => useRemoteDrumInput({ enabled: true, onHit }))

    expect(FakeWebSocket.instances).toHaveLength(1)
    act(() => latestSocket().simulateClose(1006))
    act(() => vi.advanceTimersByTime(3100))

    expect(FakeWebSocket.instances).toHaveLength(2)
  })

  it('closes the socket and stops reconnecting once disabled', () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const { rerender } = renderHook(({ enabled }) => useRemoteDrumInput({ enabled, onHit }), {
      initialProps: { enabled: true },
    })

    const firstSocket = latestSocket()
    rerender({ enabled: false })

    expect(firstSocket.closed).toBe(true)

    act(() => vi.advanceTimersByTime(10_000))
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('sendNotationState sends a notation_state frame with the given payload once connected', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const exercise = makeExercise()
    const { result } = renderHook(() => useRemoteDrumInput({ enabled: true, onHit }))

    act(() =>
      result.current.sendNotationState({
        exercise,
        playbackProgress: { bpm: 100, sessionId: 1 },
        paused: false,
        gradedEventIds: { 'event-1': 'hit' },
      }),
    )

    expect(latestSocket().sentMessages).toHaveLength(1)
    expect(JSON.parse(latestSocket().sentMessages[0]!)).toEqual({
      type: 'notation_state',
      exercise,
      playbackProgress: { bpm: 100, sessionId: 1 },
      paused: false,
      gradedEventIds: { 'event-1': 'hit' },
    })
  })

  it('sendNotationState sends a notation_clear frame when given null', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const { result } = renderHook(() => useRemoteDrumInput({ enabled: true, onHit }))

    act(() => result.current.sendNotationState(null))

    expect(JSON.parse(latestSocket().sentMessages[0]!)).toEqual({ type: 'notation_clear' })
  })

  it('sendNotationState silently no-ops when nothing is connected', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const { result } = renderHook(() => useRemoteDrumInput({ enabled: false, onHit }))

    expect(() => result.current.sendNotationState(null)).not.toThrow()
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  // Full remote control — dispatch of the 3 new controller->host message
  // types, and the 2 new host->controller send functions.

  it('calls onRequestExerciseList on a request_exercise_list message', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const onRequestExerciseList = vi.fn()
    renderHook(() => useRemoteDrumInput({ enabled: true, onHit, onRequestExerciseList }))

    act(() => latestSocket().simulateMessage({ type: 'request_exercise_list' }))

    expect(onRequestExerciseList).toHaveBeenCalledTimes(1)
  })

  it('calls onSelectExercise with the exerciseId on a select_exercise message', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const onSelectExercise = vi.fn()
    renderHook(() => useRemoteDrumInput({ enabled: true, onHit, onSelectExercise }))

    act(() => latestSocket().simulateMessage({ type: 'select_exercise', exerciseId: 'ex-1' }))

    expect(onSelectExercise).toHaveBeenCalledWith('ex-1')
  })

  it('calls onSelectRoutine with the routineId on a select_routine message', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const onSelectRoutine = vi.fn()
    renderHook(() => useRemoteDrumInput({ enabled: true, onHit, onSelectRoutine }))

    act(() => latestSocket().simulateMessage({ type: 'select_routine', routineId: 'routine-1' }))

    expect(onSelectRoutine).toHaveBeenCalledWith('routine-1')
  })

  it('calls onTransportCommand with the action on a transport_command message', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const onTransportCommand = vi.fn()
    renderHook(() => useRemoteDrumInput({ enabled: true, onHit, onTransportCommand }))

    act(() => latestSocket().simulateMessage({ type: 'transport_command', action: 'pause' }))

    expect(onTransportCommand).toHaveBeenCalledWith('pause')
  })

  it('a request_exercise_list/select_exercise/select_routine/transport_command message is silently ignored when no matching option was given', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    renderHook(() => useRemoteDrumInput({ enabled: true, onHit }))

    expect(() => {
      act(() => latestSocket().simulateMessage({ type: 'request_exercise_list' }))
      act(() => latestSocket().simulateMessage({ type: 'select_exercise', exerciseId: 'ex-1' }))
      act(() => latestSocket().simulateMessage({ type: 'select_routine', routineId: 'routine-1' }))
      act(() => latestSocket().simulateMessage({ type: 'transport_command', action: 'stop' }))
    }).not.toThrow()
    expect(onHit).not.toHaveBeenCalled()
  })

  it('sendExerciseList sends an exercise_list frame with the given exercises once connected', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const { result } = renderHook(() => useRemoteDrumInput({ enabled: true, onHit }))
    const exercises = [{ id: 'ex-1', title: 'Basic Rock Beat', bpm: 90, difficulty: 'beginner' as const, isCustom: true }]
    const routines = [{ id: 'routine-1', title: 'Warm-up', exerciseCount: 3 }]

    act(() => result.current.sendExerciseList(exercises, routines))

    expect(JSON.parse(latestSocket().sentMessages[0]!)).toEqual({ type: 'exercise_list', exercises, routines })
  })

  it('sendPlaybackStatus sends a playback_status frame with the given status once connected', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const { result } = renderHook(() => useRemoteDrumInput({ enabled: true, onHit }))
    const status = { exerciseId: 'ex-1', title: 'Basic Rock Beat', bpm: 90, phase: 'running' as const }

    act(() => result.current.sendPlaybackStatus(status))

    expect(JSON.parse(latestSocket().sentMessages[0]!)).toEqual({ type: 'playback_status', ...status })
  })

  it('sendExerciseList and sendPlaybackStatus silently no-op when nothing is connected', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const { result } = renderHook(() => useRemoteDrumInput({ enabled: false, onHit }))

    expect(() => {
      result.current.sendExerciseList([], [])
      result.current.sendPlaybackStatus({ exerciseId: null, title: null, bpm: null, phase: 'none' })
    }).not.toThrow()
    expect(FakeWebSocket.instances).toHaveLength(0)
  })
})
