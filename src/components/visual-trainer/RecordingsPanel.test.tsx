import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordingsPanel } from './RecordingsPanel'
import { db } from '../../data/db'
import { practiceRecordingRepository } from '../../data/repositories'
import { createId } from '../../domain'

afterEach(async () => {
  await db.practiceRecordings.clear()
})

function seedRecording(exerciseId: string, overrides: Partial<{ exerciseTitle: string; accuracyPercent: number }> = {}) {
  return practiceRecordingRepository.create({
    exerciseId,
    exerciseTitle: overrides.exerciseTitle ?? 'תרגיל בדיקה',
    durationMs: 65_000,
    accuracyPercent: overrides.accuracyPercent ?? 87,
    audioBlob: new Blob(['fake-mp3-bytes'], { type: 'audio/mp3' }),
  })
}

describe('RecordingsPanel', () => {
  it('renders nothing when this exercise has no saved recordings', async () => {
    const { container } = render(<RecordingsPanel exerciseId={createId()} />)
    await waitFor(() => expect(container).not.toHaveTextContent('טוען'))
    expect(container.textContent).toBe('')
  })

  it('lists only recordings belonging to this exercise, with duration and accuracy shown', async () => {
    const exerciseId = createId()
    await seedRecording(exerciseId)
    await seedRecording(createId())

    render(<RecordingsPanel exerciseId={exerciseId} />)

    await screen.findByText('הקלטות שמורות')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText(/1:05/)).toBeInTheDocument()
    expect(screen.getByText(/87%/)).toBeInTheDocument()
  })

  it('deletes a recording after confirming, removing it from the list and the database', async () => {
    const exerciseId = createId()
    const recording = await seedRecording(exerciseId)
    render(<RecordingsPanel exerciseId={exerciseId} />)
    await screen.findByText('הקלטות שמורות')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'מחיקה' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }))

    await waitFor(() => expect(screen.queryByText('הקלטות שמורות')).not.toBeInTheDocument())
    expect(await db.practiceRecordings.get(recording.id)).toBeUndefined()
  })
})
