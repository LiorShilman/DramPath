import { useRef, useState } from 'react'
import { FileCheck2, Upload } from 'lucide-react'

export interface FileDropzoneProps {
  accept?: string
  multiple?: boolean
  onFilesSelected: (files: File[]) => void
  label: string
  hint: string
  // Shown instead of label/hint once at least one file has been picked —
  // e.g. the selected file's name, or "N קבצים נבחרו".
  selectedSummary?: string
}

/** Styled drag-and-drop upload control — a hidden native <input> triggered
 * by a click on a large, obvious dropzone, replacing the browser's plain
 * "Choose File" button everywhere it's used. */
export function FileDropzone({ accept, multiple = false, onFilesSelected, label, hint, selectedSummary }: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (inputRef.current) inputRef.current.value = ''
    if (files.length > 0) onFilesSelected(files)
  }

  function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setIsDragOver(false)
    const files = Array.from(event.dataTransfer.files ?? [])
    if (files.length > 0) onFilesSelected(multiple ? files : files.slice(0, 1))
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        aria-label={label}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`flex items-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed p-4 text-start transition-colors ${
          isDragOver
            ? 'border-[var(--color-primary)] bg-[var(--color-surface-raised)]'
            : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-raised)]'
        }`}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary-text)]">
          {selectedSummary ? <FileCheck2 size={22} aria-hidden="true" /> : <Upload size={22} aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          {selectedSummary ? (
            <>
              <p className="truncate font-semibold">{selectedSummary}</p>
              <p className="text-xs text-[var(--color-text-muted)]">לחצו או גררו כדי להחליף</p>
            </>
          ) : (
            <>
              <p className="font-semibold">{label}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>
            </>
          )}
        </span>
      </button>
    </>
  )
}
