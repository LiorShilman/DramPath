import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineVideoPlayer } from './InlineVideoPlayer'
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

describe('InlineVideoPlayer', () => {
  it('shows a play button, then plays a blob-backed video on click', async () => {
    const resource = baseResource({ blob: new Blob(['x'], { type: 'video/mp4' }) })
    render(<InlineVideoPlayer resource={resource} />)

    const playButton = await screen.findByRole('button', { name: /נגן/ })
    const user = userEvent.setup()
    await user.click(playButton)

    expect(screen.queryByRole('button', { name: /נגן/ })).not.toBeInTheDocument()
    const video = document.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('src')
  })

  it('plays a linked video after granting permission via the click', async () => {
    const resource = baseResource({
      sourceType: 'link',
      fileHandle: new FakeFileHandle('prompt') as unknown as Resource['fileHandle'],
    })
    render(<InlineVideoPlayer resource={resource} />)

    const playButton = await screen.findByRole('button', { name: /נגן/ })
    const user = userEvent.setup()
    await user.click(playButton)

    await waitFor(() => {
      expect(document.querySelector('video')).toBeInTheDocument()
    })
  })
})
