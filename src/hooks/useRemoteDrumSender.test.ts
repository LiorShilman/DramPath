import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { REMOTE_RELAY_URL_STORAGE_KEY, useRemoteDrumSender } from './useRemoteDrumSender'
import { PRODUCTION_RELAY_PORT } from '../lib/visual-trainer/remote-drum-protocol'

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
})
