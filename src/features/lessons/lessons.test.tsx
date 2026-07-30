import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { LessonsListPage } from './LessonsListPage'
import { LessonDetailPage } from './LessonDetailPage'
import { db } from '../../data/db'
import { runSeedIfNeeded } from '../../data/seed/seed-runner'
import { resourceRepository, lessonRepository } from '../../data/repositories'

afterEach(async () => {
  await Promise.all([
    db.coursePlans.clear(),
    db.weeks.clear(),
    db.lessons.clear(),
    db.exercises.clear(),
    db.lessonExercises.clear(),
    db.songs.clear(),
    db.achievements.clear(),
    db.resources.clear(),
  ])
})

function renderList() {
  return render(
    <MemoryRouter>
      <LessonsListPage />
    </MemoryRouter>,
  )
}

describe('LessonsListPage', () => {
  it('lists seeded lessons and filters by category', async () => {
    await runSeedIfNeeded()
    renderList()

    expect(await screen.findByText(/שיעור 1 —/)).toBeInTheDocument()
    const initialCount = (await db.lessons.count())

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('סינון לפי קטגוריה'), 'coordination')

    const coordinationLessons = await db.lessons.where('category').equals('coordination').toArray()
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'שכפול' })).toHaveLength(
        coordinationLessons.length,
      )
    })
    expect(coordinationLessons.length).toBeLessThan(initialCount)
  })

  it('renders without error when a lesson has a cover image set', async () => {
    // Doesn't assert on the actual <img> — jsdom/fake-indexeddb don't
    // preserve Blob identity through a real Dexie round-trip, so this
    // covers the "doesn't crash and still shows the lesson" integration
    // path; ResourceThumbnail's own test covers the real image rendering.
    await runSeedIfNeeded()
    const lesson = (await db.lessons.toArray())[0]
    if (!lesson) throw new Error('seeded lesson missing')
    const image = await resourceRepository.save({
      fileName: 'cover.png',
      mimeType: 'image/png',
      blob: new Blob(['png-bytes'], { type: 'image/png' }),
    })
    const updatedLesson = await lessonRepository.patch(lesson.id, { coverImageResourceId: image.id })

    renderList()
    expect(await screen.findByText(new RegExp(updatedLesson.title))).toBeInTheDocument()
  })

  it('creates a new lesson via the repository', async () => {
    await runSeedIfNeeded()
    renderList()
    await screen.findByText(/שיעור 1 —/)

    const before = await db.lessons.count()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '+ שיעור חדש' }))

    await waitFor(async () => {
      expect(await db.lessons.count()).toBe(before + 1)
    })
  })

  it('duplicates a lesson', async () => {
    await runSeedIfNeeded()
    renderList()
    await screen.findByText(/שיעור 1 —/)

    const before = await db.lessons.count()
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: 'שכפול' })[0]!)

    await waitFor(async () => {
      expect(await db.lessons.count()).toBe(before + 1)
    })
    const duplicated = (await db.lessons.toArray()).find((lesson) =>
      lesson.title.includes('(עותק)'),
    )
    expect(duplicated).toBeDefined()
  })

  it('deletes a lesson after confirming', async () => {
    await runSeedIfNeeded()
    renderList()
    await screen.findByText(/שיעור 1 —/)

    const before = await db.lessons.count()
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: 'מחיקה' })[0]!)

    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }))

    await waitFor(async () => {
      expect(await db.lessons.count()).toBe(before - 1)
    })
  })
})

describe('LessonDetailPage', () => {
  it('loads the lesson, autosaves an edit, and links an exercise', async () => {
    await runSeedIfNeeded()
    const lesson = (await db.lessons.toArray())[0]
    if (!lesson) throw new Error('seeded lesson missing')
    const exercise = (await db.exercises.toArray())[0]
    if (!exercise) throw new Error('seeded exercise missing')

    render(
      <MemoryRouter initialEntries={[`/lessons/${lesson.id}`]}>
        <Routes>
          <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const titleInput = await screen.findByLabelText('שם השיעור')
    expect(titleInput).toHaveValue(lesson.title)

    const user = userEvent.setup()
    await user.clear(titleInput)
    await user.type(titleInput, 'שיעור ערוך')

    await waitFor(async () => {
      const updated = await db.lessons.get(lesson.id)
      expect(updated?.title).toBe('שיעור ערוך')
    })

    await user.click(await screen.findByRole('button', { name: '+ הוספת תרגיל' }))
    const exerciseCheckbox = await screen.findByRole('checkbox', { name: exercise.name })
    await user.click(exerciseCheckbox)

    await waitFor(async () => {
      const updated = await db.lessons.get(lesson.id)
      expect(updated?.exerciseIds).toContain(exercise.id)
    })
  })

  it('links a resource from the library', async () => {
    await runSeedIfNeeded()
    const lesson = (await db.lessons.toArray())[0]
    if (!lesson) throw new Error('seeded lesson missing')
    const resource = await resourceRepository.save({
      fileName: 'sheet-music.pdf',
      mimeType: 'application/pdf',
      blob: new Blob(['pdf-bytes'], { type: 'application/pdf' }),
    })

    render(
      <MemoryRouter initialEntries={[`/lessons/${lesson.id}`]}>
        <Routes>
          <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '+ הוספת קובץ' }))
    const resourceCheckbox = await screen.findByRole('checkbox', { name: resource.fileName })
    await user.click(resourceCheckbox)

    await waitFor(async () => {
      const updated = await db.lessons.get(lesson.id)
      expect(updated?.resourceIds).toContain(resource.id)
    })
  })

  it('picks a cover image and persists it on the lesson', async () => {
    // Doesn't assert on the <ResourceThumbnail>'s actual <img> rendering —
    // jsdom/fake-indexeddb don't preserve Blob identity through a real
    // Dexie round-trip (documented gap, real browsers are unaffected; see
    // ResourceThumbnail.test.tsx for that behavior tested directly against
    // an in-memory Blob instead). This test checks the selection itself
    // persists correctly.
    await runSeedIfNeeded()
    const lesson = (await db.lessons.toArray())[0]
    if (!lesson) throw new Error('seeded lesson missing')
    const image = await resourceRepository.save({
      fileName: 'cover.png',
      mimeType: 'image/png',
      blob: new Blob(['png-bytes'], { type: 'image/png' }),
    })

    render(
      <MemoryRouter initialEntries={[`/lessons/${lesson.id}`]}>
        <Routes>
          <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    const select = await screen.findByLabelText('תמונת נושא')
    await user.selectOptions(select, image.id)
    expect(select).toHaveValue(image.id)

    await waitFor(async () => {
      const updated = await db.lessons.get(lesson.id)
      expect(updated?.coverImageResourceId).toBe(image.id)
    })
  })

  it('links a linked (non-uploaded) video resource and shows it as marked', async () => {
    await runSeedIfNeeded()
    const lesson = (await db.lessons.toArray())[0]
    if (!lesson) throw new Error('seeded lesson missing')

    // Prototype method (non-enumerable), not an own function property — see
    // the same pattern/reasoning in resource-repository.test.ts.
    class FakeFileHandle {
      kind = 'file'
      name = 'concert.mp4'
      async getFile() {
        return new File([], 'concert.mp4', { type: 'video/mp4' })
      }
    }
    const resource = await resourceRepository.saveLink({
      fileHandle: new FakeFileHandle() as unknown as FileSystemFileHandle,
      fileName: 'concert.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 300_000_000,
    })

    render(
      <MemoryRouter initialEntries={[`/lessons/${lesson.id}`]}>
        <Routes>
          <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '+ הוספת קובץ' }))
    const resourceCheckbox = await screen.findByRole('checkbox', {
      name: new RegExp(resource.fileName),
    })
    expect(resourceCheckbox.closest('li')).toHaveTextContent('🔗 מקושר')

    await user.click(resourceCheckbox)

    await waitFor(async () => {
      const updated = await db.lessons.get(lesson.id)
      expect(updated?.resourceIds).toContain(resource.id)
    })
  })

  it('creates a lesson_completed achievement when status changes to completed', async () => {
    await runSeedIfNeeded()
    const lesson = (await db.lessons.toArray())[0]
    if (!lesson) throw new Error('seeded lesson missing')

    render(
      <MemoryRouter initialEntries={[`/lessons/${lesson.id}`]}>
        <Routes>
          <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const statusSelect = await screen.findByLabelText('סטטוס')
    const user = userEvent.setup()
    await user.selectOptions(statusSelect, 'completed')

    await waitFor(async () => {
      const achievements = await db.achievements.toArray()
      expect(
        achievements.some(
          (achievement) => achievement.type === 'lesson_completed' && achievement.relatedEntityId === lesson.id,
        ),
      ).toBe(true)
    })
  })

  it('shows an external video link with an offline note when set', async () => {
    await runSeedIfNeeded()
    const lesson = (await db.lessons.toArray())[0]
    if (!lesson) throw new Error('seeded lesson missing')
    await lessonRepository.patch(lesson.id, { externalVideoUrl: 'https://example.com/video' })

    render(
      <MemoryRouter initialEntries={[`/lessons/${lesson.id}`]}>
        <Routes>
          <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const link = await screen.findByRole('link', { name: 'פתח את השיעור המקורי ↗' })
    expect(link).toHaveAttribute('href', 'https://example.com/video')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('— דורש חיבור לאינטרנט')).toBeInTheDocument()
  })

  it('deletes the lesson after confirming', async () => {
    await runSeedIfNeeded()
    const lesson = (await db.lessons.toArray())[0]
    if (!lesson) throw new Error('seeded lesson missing')

    render(
      <MemoryRouter initialEntries={[`/lessons/${lesson.id}`]}>
        <Routes>
          <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByLabelText('שם השיעור')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'מחיקת שיעור' }))

    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }))

    await waitFor(async () => {
      expect(await db.lessons.get(lesson.id)).toBeUndefined()
    })
  })
})
