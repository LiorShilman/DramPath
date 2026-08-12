import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useMidiDrumInput } from './useMidiDrumInput'

// Hand-rolled test doubles, same technique this codebase already uses for
// Web-Audio-adjacent tests (see useVisualTrainer.test.ts's FakeAudioContext,
// useRemoteDrumInput.test.ts's FakeWebSocket) — real Web MIDI types aren't
// constructible in jsdom.
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

function stubMidiAccess(resolvedAccess: FakeMIDIAccess | (() => Promise<FakeMIDIAccess>)) {
  const requestMIDIAccess = vi.fn(() =>
    typeof resolvedAccess === 'function' ? resolvedAccess() : Promise.resolve(resolvedAccess),
  )
  vi.stubGlobal('navigator', { ...navigator, requestMIDIAccess })
  return requestMIDIAccess
}

describe('useMidiDrumInput', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts disabled and never calls requestMIDIAccess when enabled is false', () => {
    const requestMIDIAccess = stubMidiAccess(new FakeMIDIAccess())
    const onHit = vi.fn()
    const { result } = renderHook(() => useMidiDrumInput({ enabled: false, onHit }))

    expect(result.current).toBe('disabled')
    expect(requestMIDIAccess).not.toHaveBeenCalled()
  })

  it('reports unsupported when the browser has no Web MIDI API', () => {
    const navigatorWithoutMidi = { ...navigator } as Omit<Navigator, 'requestMIDIAccess'> & { requestMIDIAccess?: unknown }
    delete navigatorWithoutMidi.requestMIDIAccess
    vi.stubGlobal('navigator', navigatorWithoutMidi)
    const onHit = vi.fn()
    const { result } = renderHook(() => useMidiDrumInput({ enabled: true, onHit }))

    expect(result.current).toBe('unsupported')
  })

  it('reports no-device once access resolves with zero inputs', async () => {
    stubMidiAccess(new FakeMIDIAccess([]))
    const onHit = vi.fn()
    const { result } = renderHook(() => useMidiDrumInput({ enabled: true, onHit }))

    expect(result.current).toBe('requesting')
    await waitFor(() => expect(result.current).toBe('no-device'))
  })

  it('reports no-device when requestMIDIAccess itself rejects (permission denied)', async () => {
    stubMidiAccess(() => Promise.reject(new Error('denied')))
    const onHit = vi.fn()
    const { result } = renderHook(() => useMidiDrumInput({ enabled: true, onHit }))

    await waitFor(() => expect(result.current).toBe('no-device'))
  })

  it('reports connected once access resolves with at least one input', async () => {
    stubMidiAccess(new FakeMIDIAccess([new FakeMIDIInput()]))
    const onHit = vi.fn()
    const { result } = renderHook(() => useMidiDrumInput({ enabled: true, onHit }))

    await waitFor(() => expect(result.current).toBe('connected'))
  })

  it('calls onHit with the mapped instrument, a performance.now()-comparable timestamp, and the real velocity byte on a Note On message', async () => {
    const input = new FakeMIDIInput()
    stubMidiAccess(new FakeMIDIAccess([input]))
    const onHit = vi.fn()
    const { result } = renderHook(() => useMidiDrumInput({ enabled: true, onHit }))
    await waitFor(() => expect(result.current).toBe('connected'))

    const before = performance.now()
    // Channel 10 Note On (0x99), note 36 (kick per midi-drum-map.ts), velocity 127.
    act(() => input.simulateMessage([0x99, 36, 127]))
    const after = performance.now()

    expect(onHit).toHaveBeenCalledTimes(1)
    expect(onHit.mock.calls[0]![0]).toBe('kick')
    const hitTimeMs = onHit.mock.calls[0]![1] as number
    expect(hitTimeMs).toBeGreaterThanOrEqual(before)
    expect(hitTimeMs).toBeLessThanOrEqual(after)
    expect(onHit.mock.calls[0]![2]).toBe(127)
  })

  it('forwards the real parsed velocity, not a hardcoded constant', async () => {
    const input = new FakeMIDIInput()
    stubMidiAccess(new FakeMIDIAccess([input]))
    const onHit = vi.fn()
    const { result } = renderHook(() => useMidiDrumInput({ enabled: true, onHit }))
    await waitFor(() => expect(result.current).toBe('connected'))

    act(() => input.simulateMessage([0x99, 36, 62]))

    expect(onHit.mock.calls[0]![2]).toBe(62)
  })

  it('ignores a Note On with velocity 0 (the MIDI note-off convention)', async () => {
    const input = new FakeMIDIInput()
    stubMidiAccess(new FakeMIDIAccess([input]))
    const onHit = vi.fn()
    const { result } = renderHook(() => useMidiDrumInput({ enabled: true, onHit }))
    await waitFor(() => expect(result.current).toBe('connected'))

    act(() => input.simulateMessage([0x99, 36, 0]))

    expect(onHit).not.toHaveBeenCalled()
  })

  it('ignores a note number with no entry in MIDI_NOTE_TO_INSTRUMENT', async () => {
    const input = new FakeMIDIInput()
    stubMidiAccess(new FakeMIDIAccess([input]))
    const onHit = vi.fn()
    const { result } = renderHook(() => useMidiDrumInput({ enabled: true, onHit }))
    await waitFor(() => expect(result.current).toBe('connected'))

    act(() => input.simulateMessage([0x99, 127, 100]))

    expect(onHit).not.toHaveBeenCalled()
  })

  it('stops forwarding hits once disabled', async () => {
    const input = new FakeMIDIInput()
    stubMidiAccess(new FakeMIDIAccess([input]))
    const onHit = vi.fn()
    const { result, rerender } = renderHook(({ enabled }) => useMidiDrumInput({ enabled, onHit }), {
      initialProps: { enabled: true },
    })
    await waitFor(() => expect(result.current).toBe('connected'))

    rerender({ enabled: false })
    expect(result.current).toBe('disabled')

    act(() => input.simulateMessage([0x99, 36, 127]))
    expect(onHit).not.toHaveBeenCalled()
  })
})
