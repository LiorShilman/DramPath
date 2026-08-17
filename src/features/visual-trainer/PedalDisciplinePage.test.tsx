import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PedalDisciplinePage } from './PedalDisciplinePage'

// Same mock-the-whole-module technique as RoutinePlayerPage.test.tsx — this
// page isn't wrapped in a real RemoteHostProvider in tests (which would need
// a Router ancestor too, for its own useNavigate/useLocation), so
// useRemoteHost() would otherwise throw "must be used within a
// RemoteHostProvider".
const sendPedalDisciplineState = vi.fn()
vi.mock('./remote-host-context', () => ({
  useRemoteHost: () => ({
    status: 'disabled',
    isEnabled: false,
    toggleEnabled: vi.fn(),
    sendNotationState: vi.fn(),
    sendPlaybackStatus: vi.fn(),
    sendPedalDisciplineState,
    registerSession: vi.fn(() => () => {}),
  }),
}))

// Same hand-rolled test doubles as useMidiDrumInput.test.ts/useVisualTrainer.test.ts.
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

function stubMidiAccess(input: FakeMIDIInput) {
  vi.stubGlobal('navigator', { ...navigator, requestMIDIAccess: vi.fn().mockResolvedValue(new FakeMIDIAccess([input])) })
}

const CLOSED_HIHAT = [0x99, 30, 100]
const OPEN_HIHAT = [0x99, 46, 100]
const KICK = [0x99, 36, 100]

const BEST_STREAK_STORAGE_KEY = 'drumpath.pedal-discipline-best-streak'

describe('PedalDisciplinePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    sendPedalDisciplineState.mockClear()
  })

  async function renderAndStart() {
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    render(<PedalDisciplinePage />)
    await waitFor(() => expect(screen.getByText('קיט תופים מחובר')).toBeInTheDocument())

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'התחלה' }))

    return input
  }

  it('starts at streak 0 with no session running, and the start button begins one', async () => {
    const input = await renderAndStart()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'עצירה' })).toBeInTheDocument()

    act(() => input.simulateMessage(CLOSED_HIHAT))
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())
  })

  it('a closed hi-hat hit increments the streak, an open one resets it to 0', async () => {
    const input = await renderAndStart()

    act(() => input.simulateMessage(CLOSED_HIHAT))
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())
    act(() => input.simulateMessage(CLOSED_HIHAT))
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument())

    act(() => input.simulateMessage(OPEN_HIHAT))
    await waitFor(() => expect(screen.getByText('0')).toBeInTheDocument())
  })

  it('ignores hits before a session has started', async () => {
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    render(<PedalDisciplinePage />)
    await waitFor(() => expect(screen.getByText('קיט תופים מחובר')).toBeInTheDocument())

    act(() => input.simulateMessage(CLOSED_HIHAT))

    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'התחלה' })).toBeInTheDocument()
  })

  it('ignores hits from instruments other than the hi-hat', async () => {
    const input = await renderAndStart()

    act(() => input.simulateMessage(KICK))

    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('persists a new personal best to localStorage as it happens, live during the run', async () => {
    const input = await renderAndStart()

    act(() => input.simulateMessage(CLOSED_HIHAT))
    act(() => input.simulateMessage(CLOSED_HIHAT))
    act(() => input.simulateMessage(CLOSED_HIHAT))

    await waitFor(() => expect(localStorage.getItem(BEST_STREAK_STORAGE_KEY)).toBe('3'))
    expect(await screen.findByText('🔥 שיא אישי חדש!')).toBeInTheDocument()
  })

  it('stopping shows a session summary with the right totals', async () => {
    // Seeded above any streak this test reaches — keeps this test scoped to
    // the summary numbers, without also exercising the new-best path (that
    // has its own dedicated test above).
    localStorage.setItem(BEST_STREAK_STORAGE_KEY, '10')
    const input = await renderAndStart()
    const user = userEvent.setup()

    act(() => input.simulateMessage(CLOSED_HIHAT))
    act(() => input.simulateMessage(CLOSED_HIHAT))
    act(() => input.simulateMessage(OPEN_HIHAT))

    await waitFor(() => expect(screen.getByText('0')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'עצירה' }))

    expect(screen.getByText('סיכום האימון')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument() // total hits
    expect(screen.getByText('67%')).toBeInTheDocument() // 2/3 closed
    expect(screen.getByText('2')).toBeInTheDocument() // longest streak
  })

  it('a fresh session starts back at streak 0 even after a previous best was set', async () => {
    localStorage.setItem(BEST_STREAK_STORAGE_KEY, '5')
    const input = await renderAndStart()

    expect(screen.getByText(/שיא אישי: 5/)).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()

    act(() => input.simulateMessage(CLOSED_HIHAT))
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())
    // Well below the existing best — the celebration banner stays in the
    // DOM (always mounted, see PedalDisciplinePage's own comment on why),
    // just invisible via opacity.
    expect(screen.getByText('🔥 שיא אישי חדש!')).toHaveClass('opacity-0')
  })

  it('mirrors state to the phone on mount, on every hit, and on stop', async () => {
    const input = await renderAndStart()
    sendPedalDisciplineState.mockClear() // drop the mount-time + start-time sends

    act(() => input.simulateMessage(CLOSED_HIHAT))
    await waitFor(() =>
      expect(sendPedalDisciplineState).toHaveBeenCalledWith(
        expect.objectContaining({ isRunning: true, streak: 1, totalHits: 1, closedHits: 1, lastHit: 'closed' }),
      ),
    )

    act(() => input.simulateMessage(OPEN_HIHAT))
    await waitFor(() =>
      expect(sendPedalDisciplineState).toHaveBeenCalledWith(
        expect.objectContaining({ isRunning: true, streak: 0, totalHits: 2, closedHits: 1, lastHit: 'open' }),
      ),
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'עצירה' }))
    expect(sendPedalDisciplineState).toHaveBeenCalledWith(
      expect.objectContaining({ isRunning: false, totalHits: 2, closedHits: 1 }),
    )
  })

  it('clears the phone mirror on unmount', async () => {
    const input = new FakeMIDIInput()
    stubMidiAccess(input)
    const { unmount } = render(<PedalDisciplinePage />)
    await waitFor(() => expect(screen.getByText('קיט תופים מחובר')).toBeInTheDocument())
    sendPedalDisciplineState.mockClear()

    unmount()

    expect(sendPedalDisciplineState).toHaveBeenCalledWith(null)
  })
})
