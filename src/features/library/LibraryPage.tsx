import { useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { resourceRepository, settingsRepository } from '../../data/repositories'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Button, buttonClassName, PageHeader } from '../../components/ui'
import type { Resource } from '../../domain'

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg']

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

  const isImage = resource.mimeType.startsWith('image/')

  return (
    <li className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 [box-shadow:var(--shadow-card)]">
      <div className="flex h-32 items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)]">
        {isImage && objectUrl ? (
          <img src={objectUrl} alt={resource.fileName} className="h-full w-full object-cover" />
        ) : (
          <FileText size={40} aria-hidden="true" className="text-[var(--color-text-muted)]" />
        )}
      </div>

      <p className="truncate text-sm font-semibold" title={resource.fileName}>
        {resource.fileName}
      </p>
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

      <div className="flex items-center gap-2">
        {objectUrl && (
          <a
            href={objectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClassName('ghost', 'sm')}
          >
            פתח קובץ
          </a>
        )}
        <Button size="sm" variant="danger-outline" onClick={() => setConfirmDelete(true)}>
          מחיקה
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`למחוק את "${resource.fileName}"?`}
        description="הקובץ יוסר גם משיוכים לשיעורים ותרגילים. לא ניתן לבטל פעולה זו."
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
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        errors.push(`${file.name}: ניתן להעלות קובצי PDF, PNG או JPG בלבד.`)
        continue
      }
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

      <div>
        <label className="flex flex-col gap-1 text-sm">
          העלאת קבצים (PDF, PNG או JPG, עד {maxSizeMB}MB לקובץ — ניתן לבחור כמה קבצים יחד)
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_MIME_TYPES.join(',')}
            onChange={(event) => void handleFileSelected(event)}
            className="text-sm"
          />
        </label>
        {uploadError && (
          <p className="mt-1 text-sm text-[var(--color-danger-text)]">{uploadError}</p>
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
