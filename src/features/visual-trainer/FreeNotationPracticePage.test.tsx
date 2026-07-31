import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { FreeNotationPracticePage } from './FreeNotationPracticePage'
import { db } from '../../data/db'

// Same FakeAudioContext technique already established in
// useVisualTrainer.test.ts / useFreeDrumPlayback.test.ts — this page
// creates one via useMetronome and another (lazily) via useFreeDrumPlayback.
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
  suspend() {
    return Promise.resolve()
  }
  close() {
    return Promise.resolve()
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <FreeNotationPracticePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.stubGlobal('AudioContext', FakeAudioContext)
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await db.resources.clear()
  await db.notationPracticeState.clear()
})

describe('FreeNotationPracticePage', () => {
  it('saves an uploaded file to the resource library and shows it as selected', async () => {
    renderPage()
    const file = new File(['x'], 'song.pdf', { type: 'application/pdf' })
    const user = userEvent.setup()
    await user.upload(screen.getByLabelText(/גררו קובץ תווים/), file)

    await waitFor(() => expect(screen.getByRole('button', { name: 'song.pdf' })).toBeInTheDocument())
    expect(await db.resources.count()).toBe(1)
    expect((await db.resources.toArray())[0]?.tags).toContain('notation-practice')
  })

  it('lists a previously saved song again on remount, without re-uploading', async () => {
    const { unmount } = renderPage()
    const file = new File(['x'], 'song.pdf', { type: 'application/pdf' })
    const user = userEvent.setup()
    await user.upload(screen.getByLabelText(/גררו קובץ תווים/), file)
    await waitFor(() => expect(screen.getByRole('button', { name: 'song.pdf' })).toBeInTheDocument())
    unmount()

    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'song.pdf' })).toBeInTheDocument())
  })

  it('remembers the last BPM used for a song and restores it when reselected', async () => {
    renderPage()
    const file = new File(['x'], 'song.pdf', { type: 'application/pdf' })
    const user = userEvent.setup()
    await user.upload(screen.getByLabelText(/גררו קובץ תווים/), file)
    await waitFor(() => expect(screen.getByRole('button', { name: 'song.pdf' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'הגבר BPM' }))
    expect(screen.getByText('95')).toBeInTheDocument()

    await waitFor(
      async () => {
        const resource = (await db.resources.toArray())[0]!
        const state = await db.notationPracticeState.get(resource.id)
        expect(state?.lastBpm).toBe(95)
      },
      { timeout: 2000 },
    )
  })

  it('tap tempo sets the BPM from the interval between two taps', async () => {
    renderPage()
    const tapButton = screen.getByRole('button', { name: 'הקשה לקצב' })

    vi.useFakeTimers()
    vi.setSystemTime(0)
    fireEvent.click(tapButton)
    vi.setSystemTime(500)
    fireEvent.click(tapButton)
    vi.useRealTimers()

    // Two taps 500ms apart -> 120 BPM (60000 / 500).
    expect(screen.getByText('120')).toBeInTheDocument()
  })

  it('removes a saved song after confirming, clearing it if it was selected', async () => {
    renderPage()
    const file = new File(['x'], 'song.pdf', { type: 'application/pdf' })
    const user = userEvent.setup()
    await user.upload(screen.getByLabelText(/גררו קובץ תווים/), file)
    await waitFor(() => expect(screen.getByRole('button', { name: 'song.pdf' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'הסרת song.pdf' }))
    await user.click(screen.getByRole('button', { name: 'מחיקה' }))

    await waitFor(async () => expect(await db.resources.count()).toBe(0))
    expect(screen.queryByRole('button', { name: 'song.pdf' })).not.toBeInTheDocument()
  })
})
