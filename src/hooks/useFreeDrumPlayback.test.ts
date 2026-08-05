import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { useFreeDrumPlayback } from './useFreeDrumPlayback'

// Same hand-rolled test double as useRemoteDrumInput.test.ts.
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null

  constructor() {
    FakeWebSocket.instances.push(this)
  }

  close() {}

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

function latestSocket(): FakeWebSocket {
  const socket = FakeWebSocket.instances.at(-1)
  if (!socket) throw new Error('No FakeWebSocket instance was created')
  return socket
}

// Same FakeAudioContext technique already established in useVisualTrainer.test.ts.
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
  close() {
    return Promise.resolve()
  }
}

describe('useFreeDrumPlayback', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    // isPhoneControlEnabled reads from real (jsdom) localStorage, which
    // otherwise persists across tests within this file.
    localStorage.clear()
    FakeWebSocket.instances = []
  })

  it('sets activeHits with the mapped instrument when a mapped key is pressed', () => {
    const { result } = renderHook(() => useFreeDrumPlayback())
    expect(result.current.activeHits.snare).toBeUndefined()

    fireEvent.keyDown(window, { code: 'KeyF' })

    expect(result.current.activeHits.snare).toBeTruthy()
  })

  it('gives each hit a fresh hitToken, even for the same instrument twice', () => {
    const { result } = renderHook(() => useFreeDrumPlayback())

    fireEvent.keyDown(window, { code: 'KeyF' })
    const firstToken = result.current.activeHits.snare

    fireEvent.keyUp(window, { code: 'KeyF' })
    fireEvent.keyDown(window, { code: 'KeyF' })
    const secondToken = result.current.activeHits.snare

    expect(secondToken).toBeTruthy()
    expect(secondToken).not.toBe(firstToken)
  })

  it('keeps both instruments active when two different keys are pressed close together, instead of one overwriting the other', () => {
    const { result } = renderHook(() => useFreeDrumPlayback())

    fireEvent.keyDown(window, { code: 'KeyF' })
    fireEvent.keyDown(window, { code: 'KeyJ' })

    expect(result.current.activeHits.snare).toBeTruthy()
    expect(result.current.activeHits.kick).toBeTruthy()
  })

  it('does nothing for an unmapped key', () => {
    const { result } = renderHook(() => useFreeDrumPlayback())
    fireEvent.keyDown(window, { code: 'KeyZ' })
    expect(Object.keys(result.current.activeHits)).toHaveLength(0)
  })

  it('phone control is off by default, and togglePhoneControl turns it on', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useFreeDrumPlayback())

    expect(result.current.isPhoneControlEnabled).toBe(false)
    expect(result.current.remoteStatus).toBe('disabled')

    act(() => result.current.togglePhoneControl())

    expect(result.current.isPhoneControlEnabled).toBe(true)
    expect(result.current.remoteStatus).toBe('connecting')
  })

  it('a remote hit plays immediately (no phase to gate on, unlike the graded runner)', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const { result } = renderHook(() => useFreeDrumPlayback())

    act(() => result.current.togglePhoneControl())
    act(() => latestSocket().simulateMessage({ type: 'hit', instrument: 'crash' }))

    expect(result.current.activeHits.crash).toBeTruthy()
  })
})
