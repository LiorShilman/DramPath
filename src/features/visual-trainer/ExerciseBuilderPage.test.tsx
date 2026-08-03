import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { ExerciseBuilderPage } from './ExerciseBuilderPage'
import { interactiveExerciseRepository } from '../../data/repositories'
import { createId } from '../../domain'
import { db } from '../../data/db'

// Same FakeAudioContext technique already established elsewhere in this
// feature (useFreeDrumPlayback.test.ts) — the builder plays a preview hit
// via a lazily-created AudioContext when a cell is turned on.
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

function renderPage() {
  return render(
    <MemoryRouter>
      <ExerciseBuilderPage />
    </MemoryRouter>,
  )
}

function renderEditPage(exerciseId: string) {
  return render(
    <MemoryRouter initialEntries={[`/practice/visual/build/${exerciseId}`]}>
      <Routes>
        <Route path="/practice/visual/build/:exerciseId" element={<ExerciseBuilderPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.stubGlobal('AudioContext', FakeAudioContext)
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await db.interactiveExercises.clear()
})

describe('ExerciseBuilderPage', () => {
  it('keeps the continue button disabled until a title is entered', async () => {
    renderPage()
    const continueButton = screen.getByRole('button', { name: 'המשך לעריכת התווים' })
    expect(continueButton).toBeDisabled()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('שם התרגיל'), 'התרגיל שלי')
    expect(continueButton).toBeEnabled()
  })

  it('shows the grid after continuing, with one cell per instrument row', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('שם התרגיל'), 'התרגיל שלי')
    await user.click(screen.getByRole('button', { name: 'המשך לעריכת התווים' }))

    // Default setup: eighth subdivision, 2 bars -> 4 beats * 2 * 2 bars = 16 steps.
    expect(screen.getAllByRole('button', { name: /בס דראם תיבה/ })).toHaveLength(16)
  })

  it('toggles a cell on click and reflects it via aria-pressed', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('שם התרגיל'), 'התרגיל שלי')
    await user.click(screen.getByRole('button', { name: 'המשך לעריכת התווים' }))

    const firstKickCell = screen.getAllByRole('button', { name: /בס דראם תיבה/ })[0]!
    expect(firstKickCell).toHaveAttribute('aria-pressed', 'false')

    await user.click(firstKickCell)
    expect(firstKickCell).toHaveAttribute('aria-pressed', 'true')

    await user.click(firstKickCell)
    expect(firstKickCell).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a validation error when saving with no notes placed', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('שם התרגיל'), 'התרגיל שלי')
    await user.click(screen.getByRole('button', { name: 'המשך לעריכת התווים' }))

    await user.click(screen.getByRole('button', { name: 'שמירה והתחלת תרגול' }))
    expect(screen.getByText('צריך למקם לפחות תו אחד.')).toBeInTheDocument()
    expect(await db.interactiveExercises.count()).toBe(0)
  })

  it('saves the exercise with the placed notes', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('שם התרגיל'), 'התרגיל שלי')
    await user.click(screen.getByRole('button', { name: 'המשך לעריכת התווים' }))

    const firstKickCell = screen.getAllByRole('button', { name: /בס דראם תיבה/ })[0]!
    await user.click(firstKickCell)
    await user.click(screen.getByRole('button', { name: 'שמירה והתחלת תרגול' }))

    await waitFor(async () => expect(await db.interactiveExercises.count()).toBe(1))
    const saved = (await db.interactiveExercises.toArray())[0]!
    expect(saved.title).toBe('התרגיל שלי')
    expect(saved.events).toHaveLength(1)
    expect(saved.events[0]).toMatchObject({ bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick' })
  })

  it('seeking via the ruler moves the cursor without auto-starting playback', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('שם התרגיל'), 'התרגיל שלי')
    await user.click(screen.getByRole('button', { name: 'המשך לעריכת התווים' }))

    const firstKickCell = screen.getAllByRole('button', { name: /בס דראם תיבה/ })[0]!
    await user.click(firstKickCell)

    expect(screen.getByRole('button', { name: '▶ נגן' })).toBeInTheDocument()

    const rulerCell = screen.getByRole('button', { name: 'דלג לתיבה 1 פעימה 2.1' })
    await user.click(rulerCell)

    // Still showing "play", not "pause" — clicking the ruler while stopped
    // only repositions the cursor, it must not start audio on its own.
    expect(screen.getByRole('button', { name: '▶ נגן' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '⏸ השהה' })).not.toBeInTheDocument()
  })

  it('pausing keeps the cursor in place, so pressing play again resumes rather than restarting', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('שם התרגיל'), 'התרגיל שלי')
    await user.click(screen.getByRole('button', { name: 'המשך לעריכת התווים' }))

    const firstKickCell = screen.getAllByRole('button', { name: /בס דראם תיבה/ })[0]!
    await user.click(firstKickCell)

    await user.click(screen.getByRole('button', { name: '▶ נגן' }))
    expect(screen.getByRole('button', { name: '⏸ השהה' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '⏸ השהה' }))
    // Pausing returns to the "play" label (not a full stop/reset) — the
    // same button resumes playback from wherever it was paused.
    expect(screen.getByRole('button', { name: '▶ נגן' })).toBeInTheDocument()
  })

  it('persists the beamCymbals checkbox, off by default', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('שם התרגיל'), 'תרגיל עם צלחות')
    await user.click(screen.getByRole('button', { name: 'המשך לעריכת התווים' }))

    const firstKickCell = screen.getAllByRole('button', { name: /בס דראם תיבה/ })[0]!
    await user.click(firstKickCell)

    const beamCheckbox = screen.getByLabelText('לחבר גם צלחות (X) בקורה')
    expect(beamCheckbox).not.toBeChecked()
    await user.click(beamCheckbox)
    expect(beamCheckbox).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'שמירה והתחלת תרגול' }))

    await waitFor(async () => expect(await db.interactiveExercises.count()).toBe(1))
    const saved = (await db.interactiveExercises.toArray())[0]!
    expect(saved.beamCymbals).toBe(true)
  })

  it('saves successfully with a target BPM below 40, where a fixed minBpm floor would exceed it', async () => {
    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('שם התרגיל'), 'תרגיל איטי')
    const bpmInput = screen.getByLabelText('קצב יעד (BPM)')
    await user.clear(bpmInput)
    await user.type(bpmInput, '30')
    await user.click(screen.getByRole('button', { name: 'המשך לעריכת התווים' }))

    const firstKickCell = screen.getAllByRole('button', { name: /בס דראם תיבה/ })[0]!
    await user.click(firstKickCell)
    await user.click(screen.getByRole('button', { name: 'שמירה והתחלת תרגול' }))

    await waitFor(async () => expect(await db.interactiveExercises.count()).toBe(1))
    const saved = (await db.interactiveExercises.toArray())[0]!
    expect(saved.bpm).toBe(30)
    expect(saved.minBpm).toBeLessThanOrEqual(saved.bpm)
  })

  it('edit mode loads the existing exercise straight into the grid, pre-filled', async () => {
    const existing = await interactiveExerciseRepository.create({
      title: 'תרגיל קיים',
      difficulty: 'intermediate',
      bpm: 110,
      minBpm: 80,
      maxBpm: 160,
      timeSignature: { numerator: 4, denominator: 4 },
      subdivision: 'quarter',
      bars: 1,
      loopCount: 2,
      displayMode: 'note_highway',
      events: [{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }],
    })

    renderEditPage(existing.id)

    // Lands directly on the grid (skips the setup step) with the saved
    // note already toggled on.
    const firstKickCell = await screen.findAllByRole('button', { name: /בס דראם תיבה 1 פעימה 1\.1/ })
    expect(firstKickCell[0]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: /עריכת תרגיל — תרגיל קיים/ })).toBeInTheDocument()
  })

  it('edit mode saves via patch, keeping the same exercise id', async () => {
    const existing = await interactiveExerciseRepository.create({
      title: 'תרגיל קיים',
      difficulty: 'intermediate',
      bpm: 110,
      minBpm: 80,
      maxBpm: 160,
      timeSignature: { numerator: 4, denominator: 4 },
      subdivision: 'quarter',
      bars: 1,
      loopCount: 2,
      displayMode: 'note_highway',
      events: [{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }],
    })

    renderEditPage(existing.id)
    const user = userEvent.setup()

    const snareCell = (await screen.findAllByRole('button', { name: /סנר תיבה 1 פעימה 1\.1/ }))[0]!
    await user.click(snareCell)
    await user.click(screen.getByRole('button', { name: 'שמירה והתחלת תרגול' }))

    await waitFor(async () => expect(await db.interactiveExercises.count()).toBe(1))
    const updated = await interactiveExerciseRepository.getById(existing.id)
    expect(updated?.id).toBe(existing.id)
    expect(updated?.events).toHaveLength(2)
  })

  it('virtualizes the grid on a long exercise — only renders columns near the viewport, not all of them', async () => {
    // 50 bars * 4 beats * 4 sixteenth-subdivisions = 800 columns, well past
    // what the manual builder's own bars-input caps at (8) but exactly the
    // shape a real imported song produces (see drum-import's
    // approveDrumImport, which always saves subdivision: 'sixteenth').
    const existing = await interactiveExerciseRepository.create({
      title: 'שיר ארוך',
      difficulty: 'intermediate',
      bpm: 100,
      minBpm: 60,
      maxBpm: 140,
      timeSignature: { numerator: 4, denominator: 4 },
      subdivision: 'sixteenth',
      bars: 50,
      loopCount: 1,
      displayMode: 'note_highway',
      events: [{ id: createId(), bar: 1, beat: 1, subdivisionIndex: 0, instrument: 'kick', velocity: 100 }],
    })

    renderEditPage(existing.id)
    await screen.findByTestId('exercise-grid-scroll')

    // jsdom reports clientWidth 0 by default, which the component treats as
    // "can't measure yet, render everything" — override it to a real,
    // narrow value and fire a scroll event (the same event the component's
    // own listener reacts to) to force it to actually compute a bounded
    // visible range.
    const container = screen.getByTestId('exercise-grid-scroll')
    Object.defineProperty(container, 'clientWidth', { value: 300, configurable: true })
    fireEvent.scroll(container)

    const kickCells = screen.getAllByRole('button', { name: /בס דראם תיבה/ })
    expect(kickCells.length).toBeLessThan(800)
    expect(kickCells.length).toBeGreaterThan(0)
  })
})
