import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibraryPage } from './LibraryPage'
import { db } from '../../data/db'
import { settingsRepository } from '../../data/repositories'

afterEach(async () => {
  await db.resources.clear()
  await db.settings.clear()
  Reflect.deleteProperty(window, 'showOpenFilePicker')
})

// Prototype method (non-enumerable), not an own function property — a real
// FileSystemFileHandle is a native, structured-clone-safe host object;
// a plain object literal with a function property is not (functions can
// never survive structured clone), and fake-indexeddb enforces that like a
// real browser would when the resource is actually saved.
class FakeFileHandle {
  kind = 'file'
  name = 'concert.mp4'
  async getFile() {
    return new File([], 'concert.mp4', { type: 'video/mp4' })
  }
}

describe('LibraryPage', () => {
  it('shows an empty state when there are no resources', async () => {
    render(<LibraryPage />)
    expect(await screen.findByText('עדיין לא הועלו קבצים.')).toBeInTheDocument()
  })

  it('uploads a valid image and shows it in the list', async () => {
    render(<LibraryPage />)
    const input = await screen.findByLabelText(/העלאת קבצים/)
    const file = new File(['fake-image-bytes'], 'drawing.png', { type: 'image/png' })

    const user = userEvent.setup()
    await user.upload(input, file)

    expect(await screen.findByText('drawing.png')).toBeInTheDocument()
    await waitFor(async () => {
      expect(await db.resources.count()).toBe(1)
    })
  })

  it('accepts any file type, not just PDF/PNG/JPG', async () => {
    render(<LibraryPage />)
    const input = await screen.findByLabelText(/העלאת קבצים/)
    const file = new File(['text'], 'notes.txt', { type: 'text/plain' })

    const user = userEvent.setup()
    await user.upload(input, file)

    expect(await screen.findByText('notes.txt')).toBeInTheDocument()
    await waitFor(async () => {
      expect(await db.resources.count()).toBe(1)
    })
  })

  it('uploads multiple files selected together', async () => {
    render(<LibraryPage />)
    const input = await screen.findByLabelText(/העלאת קבצים/)
    const fileA = new File(['a'], 'a.png', { type: 'image/png' })
    const fileB = new File(['b'], 'b.pdf', { type: 'application/pdf' })

    fireEvent.change(input, { target: { files: [fileA, fileB] } })

    expect(await screen.findByText('a.png')).toBeInTheDocument()
    expect(await screen.findByText('b.pdf')).toBeInTheDocument()
    await waitFor(async () => {
      expect(await db.resources.count()).toBe(2)
    })
  })

  it('rejects a file larger than the configured limit', async () => {
    await settingsRepository.updateSettings({ maxResourceFileSizeMB: 1 })
    render(<LibraryPage />)
    const input = await screen.findByLabelText(/העלאת קבצים/)
    const bigContent = new Uint8Array(2 * 1024 * 1024)
    const file = new File([bigContent], 'big.png', { type: 'image/png' })

    const user = userEvent.setup()
    await user.upload(input, file)

    expect(await screen.findByText(/חורג מהגודל המותר/)).toBeInTheDocument()
    expect(await db.resources.count()).toBe(0)
  })

  it('hides the "link video" button when File System Access API is unsupported', async () => {
    render(<LibraryPage />)
    await screen.findByText('עדיין לא הועלו קבצים.')
    expect(screen.queryByRole('button', { name: /קשר קובץ/ })).not.toBeInTheDocument()
  })

  it('links a video file without storing it as a blob', async () => {
    Object.defineProperty(window, 'showOpenFilePicker', {
      value: async () => [new FakeFileHandle()],
      configurable: true,
    })

    render(<LibraryPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /קשר קובץ/ }))

    expect(await screen.findByText('concert.mp4')).toBeInTheDocument()
    expect(await screen.findByText('🔗 מקושר')).toBeInTheDocument()

    await waitFor(async () => {
      const resource = (await db.resources.toArray())[0]
      expect(resource?.sourceType).toBe('link')
      expect(resource?.blob).toBeUndefined()
    })
  })

  it('links multiple files picked together in one round-trip', async () => {
    class FakeImageHandle {
      kind = 'file'
      name = 'cover.png'
      async getFile() {
        return new File([], 'cover.png', { type: 'image/png' })
      }
    }
    Object.defineProperty(window, 'showOpenFilePicker', {
      value: async () => [new FakeFileHandle(), new FakeImageHandle()],
      configurable: true,
    })

    render(<LibraryPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /קשר קובץ/ }))

    expect(await screen.findByText('concert.mp4')).toBeInTheDocument()
    expect(await screen.findByText('cover.png')).toBeInTheDocument()

    await waitFor(async () => {
      const resources = await db.resources.toArray()
      expect(resources.filter((r) => r.sourceType === 'link')).toHaveLength(2)
    })
  })

  it('edits tags and deletes a resource after confirming', async () => {
    render(<LibraryPage />)
    const input = await screen.findByLabelText(/העלאת קבצים/)
    const file = new File(['pdf-bytes'], 'sheet.pdf', { type: 'application/pdf' })

    const user = userEvent.setup()
    await user.upload(input, file)
    await screen.findByText('sheet.pdf')

    const card = (await screen.findByText('sheet.pdf')).closest('li')
    if (!card) throw new Error('resource card not found')

    const tagsInput = within(card).getByLabelText('תגיות (מופרדות בפסיק)')
    await user.type(tagsInput, 'תווים')

    await waitFor(async () => {
      const resource = (await db.resources.toArray())[0]
      expect(resource?.tags).toEqual(['תווים'])
    })

    await user.click(within(card).getByRole('button', { name: 'מחיקה' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'מחיקה' }))

    await waitFor(async () => {
      expect(await db.resources.count()).toBe(0)
    })
  })
})
