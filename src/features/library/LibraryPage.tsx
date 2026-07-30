import { useEffect, useRef, useState } from 'react'
import { FileText, Link as LinkIcon } from 'lucide-react'
import { resourceRepository, settingsRepository } from '../../data/repositories'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Button, Badge, PageHeader, buttonClassName } from '../../components/ui'
import {
  isFileSystemAccessSupported,
  pickLinkableFiles,
  ensureReadPermission,
} from '../../lib/file-system-access'
import type { Resource } from '../../domain'

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface ResourceCardProps {
  resource: Resource
  onDeleted: (id: string) => void
}

function ResourceCard({ resource, onDeleted }: ResourceCardProps) {
  const [tagsText, setTagsText] = useState(resource.tags.join(', '))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const objectUrl = useObjectUrl(resource.blob)

  const debouncedSaveTags = useDebouncedCallback(async (value: string) => {
    const tags = value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    await resourceRepository.updateTags(resource.id, tags)
  }, 500)

  async function handleDelete() {
    await resourceRepository.removeAndUnlink(resource.id)
    setConfirmDelete(false)
    onDeleted(resource.id)
  }

  // Linked resources only touch the file handle on an explicit click (this
  // handler IS the user gesture) — never on render/mount, which would fail
  // or risk an unexpected permission prompt.
  async function handleOpenLink() {
    if (!resource.fileHandle) return
    setOpenError(null)
    const granted = await ensureReadPermission(resource.fileHandle)
    if (!granted) {
      setOpenError('אין הרשאה לגשת לקובץ. נסו שוב כדי לאשר גישה מחדש.')
      return
    }
    try {
      const file = await resource.fileHandle.getFile()
      const url = URL.createObjectURL(file)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      setOpenError('הקובץ לא נמצא — ייתכן שהוזז או נמחק מהמחשב.')
    }
  }

  const isImage = resource.sourceType === 'blob' && resource.mimeType.startsWith('image/')
  const isLink = resource.sourceType === 'link'

  return (
    <li className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 [box-shadow:var(--shadow-card)]">
      <div className="flex h-32 items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)]">
        {isImage && objectUrl ? (
          <img src={objectUrl} alt={resource.fileName} className="h-full w-full object-cover" />
        ) : isLink ? (
          <LinkIcon size={40} aria-hidden="true" className="text-[var(--color-text-muted)]" />
        ) : (
          <FileText size={40} aria-hidden="true" className="text-[var(--color-text-muted)]" />
        )}
      </div>

      <div className="flex items-center gap-2">
        <p className="truncate text-sm font-semibold" title={resource.fileName}>
          {resource.fileName}
        </p>
        {isLink && <Badge variant="primary">🔗 מקושר</Badge>}
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">{formatSize(resource.sizeBytes)}</p>

      <label className="flex flex-col gap-1 text-sm">
        תגיות (מופרדות בפסיק)
        <input
          value={tagsText}
          onChange={(event) => {
            setTagsText(event.target.value)
            debouncedSaveTags(event.target.value)
          }}
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1 text-sm"
        />
      </label>

      {openError && <p className="text-xs text-[var(--color-danger-text)]">{openError}</p>}

      <div className="flex items-center gap-2">
        {isLink ? (
          <Button size="sm" variant="ghost" onClick={() => void handleOpenLink()}>
            פתח קובץ
          </Button>
        ) : (
          objectUrl && (
            <a
              href={objectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClassName('ghost', 'sm')}
            >
              פתח קובץ
            </a>
          )
        )}
        <Button size="sm" variant="danger-outline" onClick={() => setConfirmDelete(true)}>
          מחיקה
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`למחוק את "${resource.fileName}"?`}
        description={
          isLink
            ? 'הקישור יוסר גם משיוכים לשיעורים ותרגילים. הקובץ המקורי במחשב לא יימחק. לא ניתן לבטל פעולה זו.'
            : 'הקובץ יוסר גם משיוכים לשיעורים ותרגילים. לא ניתן לבטל פעולה זו.'
        }
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </li>
  )
}

export function LibraryPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [maxSizeMB, setMaxSizeMB] = useState(25)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const [allResources, settings] = await Promise.all([
        resourceRepository.getAll(),
        settingsRepository.getSettings(),
      ])
      setResources(allResources.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      setMaxSizeMB(settings.maxResourceFileSizeMB)
      setLoading(false)
    }
    void load()
  }, [])

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (files.length === 0) return

    setUploadError(null)
    const errors: string[] = []
    const saved: Resource[] = []

    for (const file of files) {
      if (file.size > maxSizeMB * 1024 * 1024) {
        errors.push(`${file.name}: חורג מהגודל המותר (${maxSizeMB}MB).`)
        continue
      }
      saved.push(await resourceRepository.save({ fileName: file.name, mimeType: file.type, blob: file }))
    }

    if (saved.length > 0) {
      setResources((prev) => [...saved.filter((r) => !prev.some((p) => p.id === r.id)), ...prev])
    }
    if (errors.length > 0) {
      setUploadError(errors.join(' '))
    }
  }

  // Large video/image files (200-300MB+) risk the browser evicting them
  // from IndexedDB under storage pressure and bloat backup archives —
  // link the file on disk instead of uploading it. Multiple files can be
  // picked in one round-trip; each is saved independently so one failure
  // (e.g. a persistence error) doesn't block the rest of the batch —
  // same per-item error handling as handleFileSelected's regular uploads.
  async function handleLinkFile() {
    setLinkError(null)
    const handles = await pickLinkableFiles()
    if (handles.length === 0) return

    const errors: string[] = []
    const saved: Resource[] = []

    for (const handle of handles) {
      try {
        const file = await handle.getFile()
        saved.push(
          await resourceRepository.saveLink({
            fileHandle: handle,
            fileName: file.name,
            mimeType: file.type || 'video/*',
            sizeBytes: file.size,
          }),
        )
      } catch (error) {
        // Surfaced to the console (not just a generic on-screen message) so a
        // real persistence failure — e.g. IndexedDB rejecting a real
        // FileSystemFileHandle in a way this codebase hasn't hit before —
        // is actually diagnosable instead of silently swallowed.
        console.error('saveLink failed:', error)
        errors.push(
          error instanceof Error ? `${handle.name}: קישור נכשל (${error.message}).` : `${handle.name}: קישור נכשל.`,
        )
      }
    }

    if (saved.length > 0) {
      setResources((prev) => [...saved, ...prev])
    }
    if (errors.length > 0) {
      setLinkError(errors.join(' '))
    }
  }

  function handleDeleted(id: string) {
    setResources((prev) => prev.filter((resource) => resource.id !== id))
  }

  if (loading) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader title="ספריית קבצים" />

      <p className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text-muted)]">
        יש להעלות רק קבצים שאתם רשאים לשמור לשימושכם האישי. אין במערכת פונקציית שיתוף או קישור
        ציבורי — הקבצים נשמרים מקומית בלבד.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
        <div>
          <label className="flex flex-col gap-1 text-sm">
            העלאת קבצים (כל סוג קובץ, עד {maxSizeMB}MB לקובץ — ניתן לבחור כמה קבצים יחד)
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(event) => void handleFileSelected(event)}
              className="text-sm"
            />
          </label>
          {uploadError && (
            <p className="mt-1 text-sm text-[var(--color-danger-text)]">{uploadError}</p>
          )}
        </div>

        {isFileSystemAccessSupported() && (
          <div className="flex flex-col gap-1">
            <span className="text-sm text-[var(--color-text-muted)]">
              קבצים גדולים — וידאו או תמונה (Chrome/Edge בלבד)
            </span>
            <Button size="sm" variant="secondary" onClick={() => void handleLinkFile()}>
              🔗 קשר קובץ (וידאו/תמונה)
            </Button>
            {linkError && (
              <p className="text-sm text-[var(--color-danger-text)]">{linkError}</p>
            )}
          </div>
        )}
      </div>

      {resources.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">עדיין לא הועלו קבצים.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {resources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} onDeleted={handleDeleted} />
          ))}
        </ul>
      )}
    </div>
  )
}
