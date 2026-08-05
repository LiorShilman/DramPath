import { useEffect, useState } from 'react'
import { resourceRepository, settingsRepository } from '../../data/repositories'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ResourceThumbnail } from '../../components/ResourceThumbnail'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { FileDropzone } from '../../components/FileDropzone'
import { Button, Badge, PageHeader } from '../../components/ui'
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

// A resources table holding many blobs above this size makes getAll()-based
// views (the whole Library list) slow to load or hang the tab outright —
// large video/image files were meant to stay linked (saveLink's own
// comment), not copied into IndexedDB. Resources above this offer a
// "convert back to link" action.
const LARGE_BLOB_THRESHOLD_BYTES = 20 * 1024 * 1024

interface ResourceCardProps {
  resource: Resource
  onDeleted: (id: string) => void
  onConvertedToLink: (resource: Resource) => void
}

function ResourceCard({ resource, onDeleted, onConvertedToLink }: ResourceCardProps) {
  const [tagsText, setTagsText] = useState(resource.tags.join(', '))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const [convertToLinkError, setConvertToLinkError] = useState<string | null>(null)

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

  // Blob content is deliberately NOT part of `resource` here (the Library
  // list is loaded via getAllMetadata(), not getAll() — see its own
  // comment) — fetched fresh on click instead of held in memory for every
  // card the whole time the page is open, same "only when actually needed"
  // principle as handleOpenLink above.
  async function handleOpenBlob() {
    setOpenError(null)
    const full = await resourceRepository.getById(resource.id)
    if (!full?.blob) {
      setOpenError('הקובץ לא נמצא.')
      return
    }
    const url = URL.createObjectURL(full.blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  // Reverts a large blob-backed resource back to a link — the original
  // FileSystemFileHandle was never kept after converting forward, so this
  // re-picks the file from disk instead. Same id, so lesson/exercise
  // references keep working; only relevant for blob resources large enough
  // to matter (see LARGE_BLOB_THRESHOLD_BYTES) — a resources table holding
  // many large blobs makes the whole Library list slow to load or hang the
  // tab outright.
  async function handleConvertToLink() {
    setConvertToLinkError(null)
    const handles = await pickLinkableFiles()
    const handle = handles[0]
    if (!handle) return
    try {
      const updated = await resourceRepository.convertBlobToLink(resource.id, handle)
      onConvertedToLink(updated)
    } catch (error) {
      setConvertToLinkError(error instanceof Error ? error.message : 'ההמרה נכשלה.')
    }
  }

  const isImage = resource.mimeType.startsWith('image/')
  const isLink = resource.sourceType === 'link'
  const isLargeBlob = !isLink && resource.sizeBytes > LARGE_BLOB_THRESHOLD_BYTES

  return (
    <li className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 [box-shadow:var(--shadow-card)]">
      <div className="flex h-32 items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)]">
        {isImage ? (
          <ResourceThumbnail resource={resource} height={128} fluidWidth objectFit="cover" alt={resource.fileName} />
        ) : (
          <span className="text-[var(--color-text-muted)]">
            <FileTypeIcon mimeType={resource.mimeType} size={40} />
          </span>
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
          <Button size="sm" variant="ghost" onClick={() => void handleOpenBlob()}>
            פתח קובץ
          </Button>
        )}
        {isLargeBlob && isFileSystemAccessSupported() && (
          <Button size="sm" variant="ghost" onClick={() => void handleConvertToLink()}>
            🔗 המר לקישור
          </Button>
        )}
        <Button size="sm" variant="danger-outline" onClick={() => setConfirmDelete(true)}>
          מחיקה
        </Button>
      </div>

      {convertToLinkError && <p className="text-xs text-[var(--color-danger-text)]">{convertToLinkError}</p>}

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
  const [convertProgress, setConvertProgress] = useState<{ done: number; total: number } | null>(null)
  const [convertErrors, setConvertErrors] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const [allResources, settings] = await Promise.all([
        resourceRepository.getAllMetadata(),
        settingsRepository.getSettings(),
      ])
      setResources(allResources.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      setMaxSizeMB(settings.maxResourceFileSizeMB)
      setLoading(false)
    }
    void load()
  }, [])

  async function handleFilesSelected(files: File[]) {
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

  // Linked resources (FileSystemFileHandle) can never be included in a
  // backup archive — a file handle can't be serialized across origins or
  // devices, so it's excluded entirely (see docs/backup-guide.md). This
  // reads each linked file's current content once and re-saves it as a
  // blob resource (same id, so lesson/exercise references keep working),
  // so it becomes normally backup-able going forward — the practical way
  // to move a large linked library to a different origin (e.g. from a local
  // dev server to a deployed site) without manually re-linking every file
  // there one at a time. Sequential, not parallel: each conversion is its
  // own permission/read round-trip, and running many at once risks
  // overlapping native file-picker-adjacent prompts.
  async function handleConvertAllLinksToBlobs() {
    const linked = resources.filter((resource) => resource.sourceType === 'link')
    if (linked.length === 0) return

    setConvertErrors([])
    setConvertProgress({ done: 0, total: linked.length })
    const errors: string[] = []

    for (const [index, resource] of linked.entries()) {
      try {
        if (!resource.fileHandle) throw new Error('חסרה הפניה לקובץ.')
        const granted = await ensureReadPermission(resource.fileHandle)
        if (!granted) throw new Error('ההרשאה לגישה לקובץ נדחתה.')
        const converted = await resourceRepository.convertLinkToBlob(resource.id)
        // Strip the blob before it enters this page's list state — same
        // reasoning as getAllMetadata() above: this state should never hold
        // more than one large blob in memory at a time.
        const metadata: Resource = { ...converted }
        delete metadata.blob
        setResources((prev) => prev.map((item) => (item.id === metadata.id ? metadata : item)))
      } catch (error) {
        errors.push(error instanceof Error ? `${resource.fileName}: ${error.message}` : `${resource.fileName}: המרה נכשלה.`)
      }
      setConvertProgress({ done: index + 1, total: linked.length })
    }

    setConvertErrors(errors)
  }

  function handleDeleted(id: string) {
    setResources((prev) => prev.filter((resource) => resource.id !== id))
  }

  function handleConvertedToLink(updated: Resource) {
    setResources((prev) => prev.map((resource) => (resource.id === updated.id ? updated : resource)))
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
        <div className="flex-1">
          <FileDropzone
            multiple
            onFilesSelected={(files) => void handleFilesSelected(files)}
            label="העלאת קבצים"
            hint={`כל סוג קובץ, עד ${maxSizeMB}MB לקובץ — ניתן לבחור כמה קבצים יחד`}
          />
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

      {isFileSystemAccessSupported() && resources.some((resource) => resource.sourceType === 'link') && (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <p className="mb-2 text-sm text-[var(--color-text-muted)]">
            קבצים מקושרים לא נכללים בגיבוי (הפניה לקובץ בדיסק אינה ניתנת להעברה בין אתרים/מכשירים) — כדי
            שהם ייכללו בגיבוי הבא, אפשר להמיר אותם לאחסון פנימי. הקבצים המקוריים במחשב לא יימחקו.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void handleConvertAllLinksToBlobs()}
            disabled={convertProgress !== null && convertProgress.done < convertProgress.total}
          >
            {convertProgress && convertProgress.done < convertProgress.total
              ? `ממיר… (${convertProgress.done}/${convertProgress.total})`
              : 'המרת כל הקבצים המקושרים לאחסון פנימי'}
          </Button>
          {convertProgress && convertProgress.done === convertProgress.total && convertErrors.length === 0 && (
            <p className="mt-2 text-sm text-[var(--color-success-text)]">
              הומרו {convertProgress.total} קבצים בהצלחה.
            </p>
          )}
          {convertErrors.length > 0 && (
            <p className="mt-2 text-sm text-[var(--color-danger-text)]">{convertErrors.join(' ')}</p>
          )}
        </div>
      )}

      {resources.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">עדיין לא הועלו קבצים.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              onDeleted={handleDeleted}
              onConvertedToLink={handleConvertedToLink}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
