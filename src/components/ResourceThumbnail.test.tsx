import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResourceThumbnail } from './ResourceThumbnail'
import { createId, nowIso } from '../domain'
import type { Resource } from '../domain'

function baseResource(overrides: Partial<Resource>): Resource {
  return {
    id: createId(),
    fileName: 'cover.png',
    mimeType: 'image/png',
    sizeBytes: 100,
    sourceType: 'blob',
    tags: [],
    createdAt: nowIso(),
    ...overrides,
  }
}

// Prototype methods (non-enumerable) — same clone-safe pattern used
// elsewhere for fake FileSystemFileHandle test doubles, even though this
// component never writes the handle to IndexedDB; kept consistent so the
// fake stays a faithful stand-in for the real duck-typed shape.
class FakeFileHandle {
  kind = 'file'
  name = 'cover.png'
  permission: 'granted' | 'prompt' = 'prompt'
  constructor(permission: 'granted' | 'prompt') {
    this.permission = permission
  }
  async getFile() {
    return new File(['x'], 'cover.png', { type: 'image/png' })
  }
  async queryPermission() {
    return this.permission
  }
  async requestPermission() {
    this.permission = 'granted'
    return 'granted'
  }
}

describe('ResourceThumbnail', () => {
  it('renders nothing when there is no resource', () => {
    const { container } = render(<ResourceThumbnail resource={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows an <img> for a blob-backed image resource', async () => {
    const resource = baseResource({ blob: new Blob(['x'], { type: 'image/png' }) })
    render(<ResourceThumbnail resource={resource} alt="תמונת נושא" />)
    expect(await screen.findByAltText('תמונת נושא')).toBeInTheDocument()
  })

  it('auto-loads the image for a linked resource with permission already granted', async () => {
    const resource = baseResource({
      sourceType: 'link',
      fileHandle: new FakeFileHandle('granted') as unknown as Resource['fileHandle'],
    })
    render(<ResourceThumbnail resource={resource} alt="תמונת נושא" />)
    expect(await screen.findByAltText('תמונת נושא')).toBeInTheDocument()
  })

  it('shows a clickable placeholder for a linked resource without permission yet, then loads on click', async () => {
    const resource = baseResource({
      sourceType: 'link',
      fileHandle: new FakeFileHandle('prompt') as unknown as Resource['fileHandle'],
    })
    render(<ResourceThumbnail resource={resource} alt="תמונת נושא" />)

    const placeholder = await screen.findByRole('button', { name: /אשר גישה/ })
    expect(screen.queryByAltText('תמונת נושא')).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(placeholder)
    expect(await screen.findByAltText('תמונת נושא')).toBeInTheDocument()
  })

  it('renders at native size (no inline width/height box) when nativeSize is set', async () => {
    const resource = baseResource({ blob: new Blob(['x'], { type: 'image/png' }) })
    render(<ResourceThumbnail resource={resource} nativeSize alt="תמונת נושא" />)
    const img = await screen.findByAltText('תמונת נושא')
    expect(img.style.width).toBe('')
    expect(img.style.height).toBe('')
    expect(img.className).toContain('max-w-full')
  })
})
