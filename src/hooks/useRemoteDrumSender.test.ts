import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { REMOTE_RELAY_URL_STORAGE_KEY, useRemoteDrumSender } from './useRemoteDrumSender'
import { PRODUCTION_RELAY_PORT } from '../lib/visual-trainer/remote-drum-protocol'
import { createId, nowIso } from '../domain'
import type { InteractiveExercise } from '../domain'

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

// Same hand-rolled test-double technique as useRemoteDrumInput.test.ts.
// readyState/OPEN/CLOSED mirror the real WebSocket constants since the hook
// checks `socket.readyState !== WebSocket.OPEN` against whatever global is
// currently stubbed in as `WebSocket`.
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 3

  url: string
  readyState = FakeWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  sentMessages: string[] = []

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sentMessages.push(data)
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED
  }

  simulateOpen() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  simulateClose() {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
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

describe('useRemoteDrumSender', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    localStorage.clear()
    FakeWebSocket.instances = []
  })

  it('starts disconnected', () => {
    const { result } = renderHook(() => useRemoteDrumSender())
    expect(result.current.status).toBe('disconnected')
  })

  it('connect() opens a socket to ws://<relayUrl>/ws/controller and persists the address', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteDrumSender())

    act(() => result.current.connect('192.168.1.59:8001'))

    expect(result.current.status).toBe('connecting')
    expect(latestSocket().url).toBe('ws://192.168.1.59:8001/ws/controller')
    expect(localStorage.getItem(REMOTE_RELAY_URL_STORAGE_KEY)).toBe('192.168.1.59:8001')
  })

  it('connect() with no argument auto-connects to the fixed production relay address, no localStorage write', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    vi.stubGlobal('location', { protocol: 'https:', hostname: 'shilmanlior2608.ddns.net' })
    const { result } = renderHook(() => useRemoteDrumSender())

    act(() => result.current.connect())

    expect(latestSocket().url).toBe(`wss://shilmanlior2608.ddns.net:${PRODUCTION_RELAY_PORT}/ws/controller`)
    expect(localStorage.getItem(REMOTE_RELAY_URL_STORAGE_KEY)).toBeNull()
  })

  it('reflects connected once the socket opens', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteDrumSender())

    act(() => result.current.connect('192.168.1.59:8001'))
    act(() => latestSocket().simulateOpen())

    expect(result.current.status).toBe('connected')
  })

  it('sendHit sends a hit message once connected', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteDrumSender())

    act(() => result.current.connect('192.168.1.59:8001'))
    act(() => latestSocket().simulateOpen())
    act(() => result.current.sendHit('crash'))

    expect(latestSocket().sentMessages).toEqual([JSON.stringify({ type: 'hit', instrument: 'crash' })])
  })

  it('sendHit is a silent no-op while not connected', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteDrumSender())

    act(() => result.current.connect('192.168.1.59:8001'))
    // Still 'connecting' — socket never opened.
    act(() => result.current.sendHit('crash'))

    expect(latestSocket().sentMessages).toEqual([])
  })

  it('disconnect() closes the socket and does not retry even if its close event fires afterward', () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteDrumSender())

    act(() => result.current.connect('192.168.1.59:8001'))
    act(() => latestSocket().simulateOpen())
    const socket = latestSocket()

    act(() => result.current.disconnect())
    expect(result.current.status).toBe('disconnected')

    // Simulates the real-world race: the browser's close event arrives
    // asynchronously, after disconnect() already cleared the socket ref.
    act(() => socket.simulateClose())
    act(() => vi.advanceTimersByTime(10_000))

    expect(result.current.status).toBe('disconnected')
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('a connection that never opens goes straight to error with no retry', () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteDrumSender())

    act(() => result.current.connect('192.168.1.59:8001'))
    act(() => latestSocket().simulateClose()) // never opened

    expect(result.current.status).toBe('error')

    act(() => vi.advanceTimersByTime(10_000))
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('an established connection that drops gets a few quiet retries before falling back to error', () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteDrumSender())

    act(() => result.current.connect('192.168.1.59:8001'))
    act(() => latestSocket().simulateOpen())
    expect(result.current.status).toBe('connected')

    // Drop, retry, drop, retry, drop, retry, drop -> exhausts the quiet
    // retry budget and falls back to 'error'.
    for (let i = 0; i < 3; i += 1) {
      act(() => latestSocket().simulateClose())
      expect(result.current.status).toBe('connecting')
      act(() => vi.advanceTimersByTime(2100))
    }
    act(() => latestSocket().simulateClose())

    expect(result.current.status).toBe('error')
    expect(FakeWebSocket.instances).toHaveLength(4)
  })

  it('receiving a notation_state message sets notationState', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteDrumSender())
    const exercise = makeExercise()

    act(() => result.current.connect('192.168.1.59:8001'))
    act(() => latestSocket().simulateOpen())
    expect(result.current.notationState).toBeUndefined()

    act(() =>
      latestSocket().simulateMessage({
        type: 'notation_state',
        exercise,
        playbackProgress: { bpm: 100, sessionId: 1 },
        paused: false,
        gradedEventIds: { 'event-1': 'hit' },
      }),
    )

    expect(result.current.notationState).toEqual({
      exercise,
      playbackProgress: { bpm: 100, sessionId: 1 },
      paused: false,
      gradedEventIds: { 'event-1': 'hit' },
    })
  })

  it('a following notation_clear message resets notationState to undefined', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteDrumSender())

    act(() => result.current.connect('192.168.1.59:8001'))
    act(() => latestSocket().simulateOpen())
    act(() =>
      latestSocket().simulateMessage({
        type: 'notation_state',
        exercise: makeExercise(),
        playbackProgress: { bpm: 100, sessionId: 1 },
        paused: false,
        gradedEventIds: {},
      }),
    )
    expect(result.current.notationState).toBeDefined()

    act(() => latestSocket().simulateMessage({ type: 'notation_clear' }))

    expect(result.current.notationState).toBeUndefined()
  })

  it('disconnect() clears notationState, so a stale previous session does not survive a reconnect', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteDrumSender())

    act(() => result.current.connect('192.168.1.59:8001'))
    act(() => latestSocket().simulateOpen())
    act(() =>
      latestSocket().simulateMessage({
        type: 'notation_state',
        exercise: makeExercise(),
        playbackProgress: { bpm: 100, sessionId: 1 },
        paused: false,
        gradedEventIds: {},
      }),
    )
    expect(result.current.notationState).toBeDefined()

    act(() => result.current.disconnect())

    expect(result.current.notationState).toBeUndefined()
  })

  // Full remote control (browse/select/play/pause/resume/stop) — receiving
  // exercise_list/playback_status, and sending the 3 new outbound commands.

  it('receiving an exercise_list message sets exerciseList', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteDrumSender())

    act(() => result.current.connect('192.168.1.59:8001'))
    act(() => latestSocket().simulateOpen())
    expect(result.current.exerciseList).toBeUndefined()

    const exercises = [{ id: 'ex-1', title: 'Basic Rock Beat', bpm: 90, difficulty: 'beginner' as const, isCustom: true }]
    act(() => latestSocket().simulateMessage({ type: 'exercise_list', exercises }))

    expect(result.current.exerciseList).toEqual(exercises)
  })

  it('disconnect() clears exerciseList and playbackStatus too', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteDrumSender())

    act(() => result.current.connect('192.168.1.59:8001'))
    act(() => latestSocket().simulateOpen())
    act(() => latestSocket().simulateMessage({ type: 'exercise_list', exercises: [] }))
    act(() =>
      latestSocket().simulateMessage({ type: 'playback_status', exerciseId: 'ex-1', title: 'x', bpm: 90, phase: 'running' }),
    )
    expect(result.current.exerciseList).toBeDefined()
    expect(result.current.playbackStatus).toBeDefined()

    act(() => result.current.disconnect())

    expect(result.current.exerciseList).toBeUndefined()
    expect(result.current.playbackStatus).toBeUndefined()
  })

  it('receiving a playback_status message sets playbackStatus, including the all-null "nothing loaded" shape', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteDrumSender())

    act(() => result.current.connect('192.168.1.59:8001'))
    act(() => latestSocket().simulateOpen())

    act(() =>
      latestSocket().simulateMessage({ type: 'playback_status', exerciseId: null, title: null, bpm: null, phase: 'none' }),
    )
    expect(result.current.playbackStatus).toEqual({ exerciseId: null, title: null, bpm: null, phase: 'none' })

    act(() =>
      latestSocket().simulateMessage({ type: 'playback_status', exerciseId: 'ex-1', title: 'x', bpm: 90, phase: 'paused' }),
    )
    expect(result.current.playbackStatus).toEqual({ exerciseId: 'ex-1', title: 'x', bpm: 90, phase: 'paused' })
  })

  it('requestExerciseList/selectExercise/sendTransportCommand send the right frames once connected', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteDrumSender())

    act(() => result.current.connect('192.168.1.59:8001'))
    act(() => latestSocket().simulateOpen())

    act(() => result.current.requestExerciseList())
    act(() => result.current.selectExercise('ex-1'))
    act(() => result.current.sendTransportCommand('pause'))

    expect(latestSocket().sentMessages.map((raw) => JSON.parse(raw))).toEqual([
      { type: 'request_exercise_list' },
      { type: 'select_exercise', exerciseId: 'ex-1' },
      { type: 'transport_command', action: 'pause' },
    ])
  })

  it('requestExerciseList/selectExercise/sendTransportCommand are silent no-ops while not connected', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useRemoteDrumSender())

    act(() => result.current.connect('192.168.1.59:8001'))
    // Still 'connecting' — socket never opened.
    act(() => {
      result.current.requestExerciseList()
      result.current.selectExercise('ex-1')
      result.current.sendTransportCommand('stop')
    })

    expect(latestSocket().sentMessages).toEqual([])
  })
})
