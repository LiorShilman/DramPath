import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibraryPage } from './LibraryPage'
import { db } from '../../data/db'
import { settingsRepository } from '../../data/repositories'

afterEach(async () => {
  await db.resources.clear()
  await db.settings.clear()
})

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

  it('rejects a disallowed file type', async () => {
    render(<LibraryPage />)
    const input = await screen.findByLabelText(/העלאת קבצים/)
    const file = new File(['text'], 'notes.txt', { type: 'text/plain' })

    // user-event's upload() enforces the input's `accept` attribute itself
    // and no-ops for a mismatched type — fireEvent bypasses that so this
    // test actually exercises the component's own validation (defense in
    // depth for drag-and-drop / non-picker file assignment).
    fireEvent.change(input, { target: { files: [file] } })

    expect(
      await screen.findByText(/ניתן להעלות קובצי PDF, PNG או JPG בלבד\./),
    ).toBeInTheDocument()
    expect(await db.resources.count()).toBe(0)
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
