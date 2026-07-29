import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BackupSection } from './BackupSection'
import { db } from '../../data/db'
import { runSeedIfNeeded } from '../../data/seed/seed-runner'
import { buildBackupArchive } from '../../lib/backup/export-backup'
import { exerciseRepository } from '../../data/repositories'

afterEach(async () => {
  await Promise.all([
    db.coursePlans.clear(),
    db.weeks.clear(),
    db.lessons.clear(),
    db.exercises.clear(),
    db.lessonExercises.clear(),
    db.songs.clear(),
    db.settings.clear(),
  ])
})

describe('BackupSection', () => {
  it('exports a backup and stamps lastBackupExportAt', async () => {
    await runSeedIfNeeded()
    render(<BackupSection />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'ייצוא גיבוי' }))

    expect(await screen.findByRole('button', { name: 'הגיבוי הורד ✓' })).toBeInTheDocument()
    await waitFor(async () => {
      const settings = await db.settings.get('user-settings')
      expect(settings?.lastBackupExportAt).toBeDefined()
    })
  })

  it('shows a merge preview and imports on confirm', async () => {
    await runSeedIfNeeded()
    const archiveBlob = await buildBackupArchive()
    const exercise = (await db.exercises.toArray())[0]!
    await exerciseRepository.patch(exercise.id, { name: 'שם חדש מקומי' })

    render(<BackupSection />)
    const file = new File([archiveBlob], 'backup.zip', { type: 'application/zip' })
    const input = screen.getByLabelText('בחירת קובץ גיבוי')

    const user = userEvent.setup()
    await user.upload(input, file)

    expect(await screen.findByText('תצוגה מקדימה של המיזוג:')).toBeInTheDocument()
    expect(screen.getByText('תרגילים')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'אישור ושחזור' }))

    await waitFor(async () => {
      const updated = await exerciseRepository.getById(exercise.id)
      // Merge keeps the local edit because its updatedAt is newer than the backup's.
      expect(updated?.name).toBe('שם חדש מקומי')
    })
  })

  it('shows a clear error for an invalid file', async () => {
    render(<BackupSection />)
    const input = screen.getByLabelText('בחירת קובץ גיבוי')
    const file = new File(['not a zip'], 'notes.txt', { type: 'text/plain' })

    // fireEvent bypasses the input's `accept` filtering that user-event's
    // upload() enforces — see the same fix in LibraryPage's tests.
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText('הקובץ אינו ארכיון ZIP תקין.')).toBeInTheDocument()
  })
})
