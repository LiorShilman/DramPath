import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useRemoteDrumInput } from './useRemoteDrumInput'
import { PRODUCTION_RELAY_PORT, SUPERSEDED_CLOSE_CODE } from '../lib/visual-trainer/remote-drum-protocol'

// Hand-rolled test double, same technique this codebase already uses for
// Web-Audio-adjacent tests (see useVisualTrainer.test.ts's FakeAudioContext)
// — records every instance created so a test can grab the most recent one
// and simulate the server pushing a message/close event onto it.
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  url: string
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  closed = false

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  close() {
    this.closed = true
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

    expect(result.current).toBe('disabled')
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('connects to the local relay and reflects waiting-for-phone / connected from controller_status', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const { result } = renderHook(() => useRemoteDrumInput({ enabled: true, onHit }))

    expect(result.current).toBe('connecting')
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
    expect(result.current).toBe('connecting')
  })

  it('goes to superseded on close code 4001 and does not reconnect', () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const onHit = vi.fn()
    const { result } = renderHook(() => useRemoteDrumInput({ enabled: true, onHit }))

    act(() => latestSocket().simulateClose(SUPERSEDED_CLOSE_CODE))
    expect(result.current).toBe('superseded')

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
})
