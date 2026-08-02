import { afterEach, describe, expect, it, vi } from 'vitest'
import { playDrumSound } from './drum-synth'

// Same FakeAudioContext technique established in useFreeDrumPlayback.test.ts,
// extended with decodeAudioData for drum-samples.ts's fetch-and-decode path.
class FakeAudioContext {
  get currentTime() {
    return performance.now() / 1000
  }
  destination = {}
  sampleRate = 44100
  createOscillator = vi.fn(() => ({
    type: '',
    frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    connect() {},
    start() {},
    stop() {},
  }))
  createGain = vi.fn(() => ({
    gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    connect() {},
  }))
  createBufferSource = vi.fn(() => ({ buffer: null as AudioBuffer | null, connect() {}, start() {}, stop() {} }))
  createBiquadFilter = vi.fn(() => ({ type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }))
  createBuffer() {
    return { getChannelData: () => new Float32Array(1) }
  }
  decodeAudioData(): Promise<AudioBuffer> {
    return Promise.resolve({} as AudioBuffer)
  }
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('playDrumSound', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('falls back to the synthesized sound when no sample file is available (the no-samples-yet default)', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch
    const audioContext = new FakeAudioContext() as unknown as AudioContext & FakeAudioContext
    const output = { connect() {} } as unknown as AudioNode

    playDrumSound(audioContext, output, 0, 'kick', 100)

    expect(audioContext.createOscillator).toHaveBeenCalled()
  })

  it('plays a loaded sample instead of synthesizing once one is available for that instrument', async () => {
    const fakeBuffer = {} as AudioBuffer
    globalThis.fetch = vi.fn((path: RequestInfo | URL) => {
      if (String(path).includes('kick')) {
        return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) } as unknown as Response)
      }
      return Promise.resolve({ ok: false } as unknown as Response)
    }) as unknown as typeof fetch

    const audioContext = new FakeAudioContext() as unknown as AudioContext & FakeAudioContext
    vi.spyOn(audioContext, 'decodeAudioData').mockResolvedValue(fakeBuffer)
    const output = { connect() {} } as unknown as AudioNode

    // First hit kicks off loading; the sample isn't ready yet, so it still
    // falls back to synthesis this time.
    playDrumSound(audioContext, output, 0, 'kick', 100)
    expect(audioContext.createOscillator).toHaveBeenCalledTimes(1)

    await flushMicrotasks()

    // Now that the sample is loaded, the same instrument uses it instead.
    playDrumSound(audioContext, output, 0, 'kick', 100)
    expect(audioContext.createOscillator).toHaveBeenCalledTimes(1)
    const bufferSourceCall = audioContext.createBufferSource.mock.results.at(-1)
    expect(bufferSourceCall?.value.buffer).toBe(fakeBuffer)
  })
})
