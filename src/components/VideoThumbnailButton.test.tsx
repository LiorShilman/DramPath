import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VideoThumbnailButton } from './VideoThumbnailButton'
import { createId, nowIso } from '../domain'
import type { Resource } from '../domain'

function baseResource(overrides: Partial<Resource>): Resource {
  return {
    id: createId(),
    fileName: 'concert.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 300_000_000,
    sourceType: 'blob',
    tags: [],
    createdAt: nowIso(),
    ...overrides,
  }
}

// Prototype methods (non-enumerable) — same clone-safe pattern used for
// every other fake FileSystemFileHandle test double in this codebase.
class FakeFileHandle {
  kind = 'file'
  name = 'concert.mp4'
  permission: 'granted' | 'prompt' = 'prompt'
  constructor(permission: 'granted' | 'prompt') {
    this.permission = permission
  }
  async getFile() {
    return new File(['x'], 'concert.mp4', { type: 'video/mp4' })
  }
  async queryPermission() {
    return this.permission
  }
  async requestPermission() {
    this.permission = 'granted'
    return 'granted'
  }
}

describe('VideoThumbnailButton', () => {
  it('resolves a blob-backed video and calls onPlay with an object URL, without rendering a <video> itself', async () => {
    const resource = baseResource({ blob: new Blob(['x'], { type: 'video/mp4' }) })
    const onPlay = vi.fn()
    render(<VideoThumbnailButton resource={resource} onPlay={onPlay} />)

    const playButton = await screen.findByRole('button', { name: /נגן/ })
    const user = userEvent.setup()
    await user.click(playButton)

    await waitFor(() => expect(onPlay).toHaveBeenCalledWith(resource, expect.stringContaining('blob:')))
    expect(document.querySelector('video')).not.toBeInTheDocument()
  })

  it('resolves a linked video after granting permission via the click', async () => {
    const resource = baseResource({
      sourceType: 'link',
      fileHandle: new FakeFileHandle('prompt') as unknown as Resource['fileHandle'],
    })
    const onPlay = vi.fn()
    render(<VideoThumbnailButton resource={resource} onPlay={onPlay} />)

    const playButton = await screen.findByRole('button', { name: /נגן/ })
    const user = userEvent.setup()
    await user.click(playButton)

    await waitFor(() => expect(onPlay).toHaveBeenCalledTimes(1))
  })

  it('shows an error and does not call onPlay when permission is denied', async () => {
    const resource = baseResource({
      sourceType: 'link',
      fileHandle: {
        kind: 'file',
        name: 'concert.mp4',
        queryPermission: async () => 'prompt',
        requestPermission: async () => 'denied',
      } as unknown as Resource['fileHandle'],
    })
    const onPlay = vi.fn()
    render(<VideoThumbnailButton resource={resource} onPlay={onPlay} />)

    const playButton = await screen.findByRole('button', { name: /נגן/ })
    const user = userEvent.setup()
    await user.click(playButton)

    expect(await screen.findByText(/אין הרשאה/)).toBeInTheDocument()
    expect(onPlay).not.toHaveBeenCalled()
  })
})
