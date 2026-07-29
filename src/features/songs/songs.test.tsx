import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { SongsListPage } from './SongsListPage'
import { SongDetailPage } from './SongDetailPage'
import { db } from '../../data/db'
import { runSeedIfNeeded } from '../../data/seed/seed-runner'

afterEach(async () => {
  await Promise.all([
    db.coursePlans.clear(),
    db.weeks.clear(),
    db.lessons.clear(),
    db.exercises.clear(),
    db.lessonExercises.clear(),
    db.songs.clear(),
  ])
})

function renderList() {
  return render(
    <MemoryRouter>
      <SongsListPage />
    </MemoryRouter>,
  )
}

describe('SongsListPage', () => {
  it('lists seeded songs and filters by status', async () => {
    await runSeedIfNeeded()
    renderList()

    expect(await screen.findByText('Billie Jean — Michael Jackson')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(7)

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('סינון לפי סטטוס'), 'new')
    expect(screen.getAllByRole('link')).toHaveLength(7)
  })

  it('searches by title or artist', async () => {
    await runSeedIfNeeded()
    renderList()
    await screen.findByText('Billie Jean — Michael Jackson')

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('חיפוש שירים'), 'AC/DC')

    await waitFor(() => {
      expect(screen.getAllByRole('link')).toHaveLength(1)
    })
    expect(screen.getByText(/Highway to Hell/)).toBeInTheDocument()
  })

  it('creates a new song via the repository', async () => {
    await runSeedIfNeeded()
    renderList()
    await screen.findByText('Billie Jean — Michael Jackson')

    const before = await db.songs.count()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '+ שיר חדש' }))

    await waitFor(async () => {
      expect(await db.songs.count()).toBe(before + 1)
    })
  })

  it('deletes a song after confirming', async () => {
    await runSeedIfNeeded()
    renderList()
    await screen.findByText('Billie Jean — Michael Jackson')

    const before = await db.songs.count()
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: 'מחיקה' })[0]!)

    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }))

    await waitFor(async () => {
      expect(await db.songs.count()).toBe(before - 1)
    })
  })
})

describe('SongDetailPage', () => {
  it('loads the song, autosaves an edit, adds a section, and links an exercise', async () => {
    await runSeedIfNeeded()
    const song = (await db.songs.toArray())[0]
    if (!song) throw new Error('seeded song missing')
    const exercise = (await db.exercises.toArray())[0]
    if (!exercise) throw new Error('seeded exercise missing')

    render(
      <MemoryRouter initialEntries={[`/songs/${song.id}`]}>
        <Routes>
          <Route path="/songs/:songId" element={<SongDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const titleInput = await screen.findByLabelText('שם השיר')
    expect(titleInput).toHaveValue(song.title)

    const user = userEvent.setup()
    await user.clear(titleInput)
    await user.type(titleInput, 'שיר ערוך')

    await waitFor(async () => {
      const updated = await db.songs.get(song.id)
      expect(updated?.title).toBe('שיר ערוך')
    })

    await user.click(screen.getByRole('button', { name: '+ קטע' }))
    await waitFor(async () => {
      const updated = await db.songs.get(song.id)
      expect(updated?.sections).toHaveLength(1)
    })

    const exerciseCheckbox = await screen.findByRole('checkbox', { name: exercise.name })
    await user.click(exerciseCheckbox)

    await waitFor(async () => {
      const updated = await db.songs.get(song.id)
      expect(updated?.exerciseIds).toContain(exercise.id)
    })
  })

  it('deletes the song after confirming', async () => {
    await runSeedIfNeeded()
    const song = (await db.songs.toArray())[0]
    if (!song) throw new Error('seeded song missing')

    render(
      <MemoryRouter initialEntries={[`/songs/${song.id}`]}>
        <Routes>
          <Route path="/songs/:songId" element={<SongDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByLabelText('שם השיר')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'מחיקת שיר' }))

    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }))

    await waitFor(async () => {
      expect(await db.songs.get(song.id)).toBeUndefined()
    })
  })
})
