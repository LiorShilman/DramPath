import { useEffect, useState } from 'react'
import { practiceRecordingRepository } from '../../data/repositories'
import type { PracticeRecording } from '../../domain'
import { Button, buttonClassName } from '../ui'
import { ConfirmDialog } from '../ConfirmDialog'
import { useObjectUrl } from '../../hooks/useObjectUrl'

export interface RecordingsPanelProps {
  exerciseId: string
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function canShareFile(file: File): boolean {
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

interface RecordingRowProps {
  recording: PracticeRecording
  onDeleted: (id: string) => void
}

function RecordingRow({ recording, onDeleted }: RecordingRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const objectUrl = useObjectUrl(recording.audioBlob)

  const fileName = `${recording.exerciseTitle} - ${new Date(recording.createdAt).toLocaleDateString('he-IL')}.mp3`

  async function handleShare() {
    const file = new File([recording.audioBlob], fileName, { type: 'audio/mp3' })
    if (!canShareFile(file)) return
    try {
      await navigator.share({ files: [file], title: fileName })
    } catch {
      // Cancelled by the user, or the OS share sheet failed — nothing to
      // recover from here, same as a cancelled native file picker.
    }
  }

  async function handleDelete() {
    await practiceRecordingRepository.remove(recording.id)
    setConfirmDelete(false)
    onDeleted(recording.id)
  }

  return (
    <li className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          {new Date(recording.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
        <span className="tabular-nums text-[var(--color-text-muted)]">
          {formatDuration(recording.durationMs)} · {Math.round(recording.accuracyPercent)}%
        </span>
      </div>

      {objectUrl && <audio controls src={objectUrl} className="w-full" />}

      <div className="flex flex-wrap gap-2">
        {objectUrl && (
          <a href={objectUrl} download={fileName} className={buttonClassName('ghost', 'sm')}>
            הורדה
          </a>
        )}
        {typeof navigator.share === 'function' && (
          <Button size="sm" variant="ghost" onClick={() => void handleShare()}>
            שיתוף
          </Button>
        )}
        <Button size="sm" variant="danger-outline" onClick={() => setConfirmDelete(true)}>
          מחיקה
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="למחוק את ההקלטה?"
        description="לא ניתן לבטל פעולה זו."
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </li>
  )
}

// Shown on an exercise's own idle (pre-start) screen — explicit user
// request: a saved-recordings management panel appears when entering the
// exercise, not tucked into the post-run results screen. Renders nothing
// while loading or once loaded with zero recordings, so an exercise that's
// never produced one doesn't grow an empty panel here.
export function RecordingsPanel({ exerciseId }: RecordingsPanelProps) {
  const [recordings, setRecordings] = useState<PracticeRecording[] | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const all = await practiceRecordingRepository.getAll()
      if (cancelled) return
      setRecordings(
        all
          .filter((recording) => recording.exerciseId === exerciseId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      )
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [exerciseId])

  function handleDeleted(id: string) {
    setRecordings((prev) => prev?.filter((recording) => recording.id !== id) ?? null)
  }

  if (!recordings || recordings.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">הקלטות שמורות</h3>
      <ul className="flex flex-col gap-2">
        {recordings.map((recording) => (
          <RecordingRow key={recording.id} recording={recording} onDeleted={handleDeleted} />
        ))}
      </ul>
    </div>
  )
}
