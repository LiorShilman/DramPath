import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileDropzone } from './FileDropzone'

describe('FileDropzone', () => {
  it('shows the label/hint when nothing is selected, and calls onFilesSelected on pick', async () => {
    const onFilesSelected = vi.fn()
    render(<FileDropzone label="גררו קובץ" hint="תמונה או PDF" onFilesSelected={onFilesSelected} />)

    expect(screen.getByText('גררו קובץ')).toBeInTheDocument()

    const file = new File(['x'], 'song.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const user = userEvent.setup()
    await user.upload(input, file)

    expect(onFilesSelected).toHaveBeenCalledWith([file])
  })

  it('shows selectedSummary instead of the label once provided', () => {
    render(<FileDropzone label="גררו קובץ" hint="תמונה או PDF" onFilesSelected={vi.fn()} selectedSummary="song.pdf" />)
    expect(screen.getByText('song.pdf')).toBeInTheDocument()
    expect(screen.queryByText('גררו קובץ')).not.toBeInTheDocument()
  })

  it('passes only the first file when multiple is false (default) on drop', () => {
    const onFilesSelected = vi.fn()
    render(<FileDropzone label="גררו קובץ" hint="תמונה או PDF" onFilesSelected={onFilesSelected} />)

    const fileA = new File(['a'], 'a.pdf', { type: 'application/pdf' })
    const fileB = new File(['b'], 'b.pdf', { type: 'application/pdf' })
    const dropzone = screen.getByText('גררו קובץ').closest('button')!

    const dataTransfer = { files: [fileA, fileB] } as unknown as DataTransfer
    dropzone.dispatchEvent(
      Object.assign(new Event('drop', { bubbles: true, cancelable: true }), { dataTransfer }),
    )

    expect(onFilesSelected).toHaveBeenCalledWith([fileA])
  })
})
