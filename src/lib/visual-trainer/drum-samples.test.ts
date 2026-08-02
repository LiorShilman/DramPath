import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureDrumSamplesLoading, getDrumSample } from './drum-samples'

class FakeAudioContext {
  decodeAudioData(): Promise<AudioBuffer> {
    return Promise.resolve({} as AudioBuffer)
  }
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('drum-samples', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('leaves every instrument without a sample when no files are served (404s) — the no-samples-yet default', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch
    const audioContext = new FakeAudioContext() as unknown as AudioContext

    ensureDrumSamplesLoading(audioContext)
    await flushMicrotasks()

    expect(getDrumSample(audioContext, 'kick')).toBeUndefined()
    expect(getDrumSample(audioContext, 'snare')).toBeUndefined()
  })

  it('caches the decoded sample for an instrument whose file loads successfully, leaving others untouched', async () => {
    const fakeBuffer = {} as AudioBuffer
    globalThis.fetch = vi.fn((path: RequestInfo | URL) => {
      if (String(path).includes('kick')) {
        return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) } as unknown as Response)
      }
      return Promise.resolve({ ok: false } as unknown as Response)
    }) as unknown as typeof fetch

    const audioContext = new FakeAudioContext() as unknown as AudioContext
    vi.spyOn(audioContext, 'decodeAudioData').mockResolvedValue(fakeBuffer)

    ensureDrumSamplesLoading(audioContext)
    await flushMicrotasks()

    expect(getDrumSample(audioContext, 'kick')).toBe(fakeBuffer)
    expect(getDrumSample(audioContext, 'snare')).toBeUndefined()
  })

  it('only fetches once per AudioContext, even if called again later', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const audioContext = new FakeAudioContext() as unknown as AudioContext

    ensureDrumSamplesLoading(audioContext)
    ensureDrumSamplesLoading(audioContext)
    await flushMicrotasks()

    const callCountAfterFirstLoad = fetchMock.mock.calls.length
    expect(callCountAfterFirstLoad).toBeGreaterThan(0)

    ensureDrumSamplesLoading(audioContext)
    await flushMicrotasks()

    expect(fetchMock.mock.calls.length).toBe(callCountAfterFirstLoad)
  })

  it('keeps separate sample caches per AudioContext', async () => {
    const fakeBuffer = {} as AudioBuffer
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }) as unknown as typeof fetch

    const audioContextA = new FakeAudioContext() as unknown as AudioContext
    vi.spyOn(audioContextA, 'decodeAudioData').mockResolvedValue(fakeBuffer)
    const audioContextB = new FakeAudioContext() as unknown as AudioContext

    ensureDrumSamplesLoading(audioContextA)
    await flushMicrotasks()

    expect(getDrumSample(audioContextA, 'kick')).toBe(fakeBuffer)
    expect(getDrumSample(audioContextB, 'kick')).toBeUndefined()
  })
})
