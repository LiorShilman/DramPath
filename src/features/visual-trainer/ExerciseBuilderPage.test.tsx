import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
})
