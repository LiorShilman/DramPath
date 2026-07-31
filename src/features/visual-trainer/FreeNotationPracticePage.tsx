import { useEffect, useRef, useState } from 'react'
import { FileMusic, Upload } from 'lucide-react'
import { PageHeader, Button, Card } from '../../components/ui'
import { DrumKit } from '../../components/visual-trainer/DrumKit'
import { useFreeDrumPlayback } from '../../hooks/useFreeDrumPlayback'
import { useMetronome } from '../practice-session/useMetronome'
import { SUBDIVISION_LABELS } from '../exercises/exercise-labels'
import { DEFAULT_KEYBOARD_MAP, codeToKeyLabel } from '../../lib/visual-trainer/keyboard-map'
import { INSTRUMENT_LABELS } from '../../lib/visual-trainer/instrument-labels'
import type { Subdivision } from '../../domain'

const BEATS_PER_BAR = [0, 1, 2, 3]
const DEFAULT_BPM = 90
const BPM_STEP = 5

/** VISUAL_DRUM_TRAINER_SPEC.md's graded exercises need structured
 * DrumNoteEvent[] data — an uploaded photo has none, so this is a
 * deliberately ungraded mode: a reference image/PDF on screen, a metronome
 * for tempo, and the drum kit reacting live to keyboard input while the
 * player reads the sheet and plays along by hand. */
export function FreeNotationPracticePage() {
  const [fileUrl, setFileUrl] = useState<string | undefined>(undefined)
  const [fileName, setFileName] = useState<string | undefined>(undefined)
  const [fileIsPdf, setFileIsPdf] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileUrlRef = useRef(fileUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fileUrlRef.current = fileUrl
  }, [fileUrl])

  useEffect(() => {
    return () => {
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current)
    }
  }, [])

  function loadFile(file: File) {
    setFileUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(file)
    })
    setFileName(file.name)
    setFileIsPdf(file.type === 'application/pdf')
  }

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) loadFile(file)
  }

  function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setIsDragOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) loadFile(file)
  }

  const { activeHit } = useFreeDrumPlayback()
  const metronome = useMetronome()
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [subdivision, setSubdivision] = useState<Subdivision>('quarter')

  function adjustBpm(delta: number) {
    setBpm((current) => {
      const next = Math.min(300, Math.max(30, current + delta))
      if (metronome.isPlaying) metronome.updateBpm(next)
      return next
    })
  }

  function handleToggleMetronome() {
    if (metronome.isPlaying) {
      metronome.stop()
      return
    }
    metronome.start({ bpm, subdivision, accentFirstBeat: true, countInBars: 0 })
  }

  function handleSubdivisionChange(next: Subdivision) {
    setSubdivision(next)
    if (metronome.isPlaying) metronome.updateSubdivision(next)
  }

  return (
    <div className="flex flex-col gap-4 pb-12">
      <PageHeader title="תרגול חופשי לפי תווים" backTo="/practice/visual" backLabel="← חזרה לרשימת התרגילים" />

      {/* lg:flex-row-reverse: in this RTL app the first DOM child of a row
          lands on the right — reversing puts the notation column (coded
          first) on the LEFT and the drum-kit/metronome/keys column (coded
          second) on the RIGHT, flush against the sidebar, per explicit
          layout direction. */}
      <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start">
        <div className="flex w-full flex-col gap-2 lg:flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
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
              {fileName ? <FileMusic size={22} aria-hidden="true" /> : <Upload size={22} aria-hidden="true" />}
            </span>
            <span className="min-w-0 flex-1">
              {fileName ? (
                <>
                  <p className="truncate font-semibold">{fileName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">לחצו או גררו כדי להחליף קובץ</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">גררו קובץ תווים לכאן או לחצו לבחירה</p>
                  <p className="text-xs text-[var(--color-text-muted)]">תמונה או PDF</p>
                </>
              )}
            </span>
          </button>

          {fileUrl ? (
            fileIsPdf ? (
              // #view=FitH forces Chrome/Edge's built-in PDF viewer to fit
              // the page to the frame's width — its default "fit page" zoom
              // left large blank margins and could overflow a page taller
              // than it is wide.
              <iframe
                src={`${fileUrl}#view=FitH`}
                title={fileName ?? 'תווים'}
                className="h-[75vh] w-full rounded-[var(--radius-card)] border border-[var(--color-border)]"
              />
            ) : (
              <div className="flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                <img src={fileUrl} alt={fileName ?? 'תווים'} className="mx-auto h-[75vh] max-h-[75vh] w-auto max-w-full object-contain" />
              </div>
            )
          ) : (
            <div className="flex h-[50vh] items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-muted)]">
              העלו קובץ תווים (תמונה או PDF) כדי להתחיל
            </div>
          )}
        </div>

        {/* Right column: drum kit -> metronome -> keyboard legend, stacked. */}
        <div className="flex w-full flex-col gap-4 lg:max-w-2xl">
          {/* w-[80%] (not w-full): the kit's cymbal pieces are laid out to
              intentionally overflow their own container a little (crash/ride
              extend past its right edge) — at full column width that
              overflow lands directly on the sidebar. Keeping the kit at 80%
              and centered leaves real margin on both sides to absorb it,
              while the wider column (max-w-2xl) still nets a bigger kit
              overall than before. */}
          <div className="mx-auto w-[80%]">
            <DrumKit activeHit={activeHit} />
          </div>

          <Card padding="sm" className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => adjustBpm(-BPM_STEP)}
                aria-label="הפחת BPM"
                className="min-h-14 min-w-14 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-primary)]/15 px-4 py-2 text-2xl [box-shadow:var(--shadow-card)] active:shadow-none"
              >
                −
              </button>
              <span className="text-3xl font-bold tabular-nums">{bpm}</span>
              <button
                type="button"
                onClick={() => adjustBpm(BPM_STEP)}
                aria-label="הגבר BPM"
                className="min-h-14 min-w-14 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-primary)]/15 px-4 py-2 text-2xl [box-shadow:var(--shadow-card)] active:shadow-none"
              >
                +
              </button>
            </div>

            <Button onClick={handleToggleMetronome} aria-label={metronome.isPlaying ? 'עצור מטרונום' : 'הפעל מטרונום'}>
              {metronome.isPlaying ? 'עצור מטרונום' : 'הפעל מטרונום'}
            </Button>

            <div className="flex items-center gap-1" aria-hidden="true">
              {BEATS_PER_BAR.map((beat) => (
                <span
                  key={beat}
                  className={`h-3 w-3 rounded-full border border-[var(--color-border)] ${
                    metronome.isPlaying && metronome.beatIndex === beat
                      ? 'bg-[var(--color-primary)]'
                      : 'bg-[var(--color-text-muted)]/40'
                  }`}
                />
              ))}
            </div>

            <label className="flex items-center gap-1 text-sm">
              חלוקה
              <select
                value={subdivision}
                onChange={(event) => handleSubdivisionChange(event.target.value as Subdivision)}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1"
              >
                {Object.entries(SUBDIVISION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </Card>

          {/* Inline keyboard legend — a plain (non-fixed) grid, unlike the
              shared KeyboardGuide component which pins itself to the
              viewport bottom (right for the graded runner page, but this
              page wants it as part of the stacked right-hand column). */}
          <Card padding="sm">
            <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">מקשים</h3>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-3 text-base">
              {Object.entries(DEFAULT_KEYBOARD_MAP).map(([code, instrument]) => (
                <li key={code} className="flex items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-primary)]/15 text-base font-bold [box-shadow:var(--shadow-card)]">
                    {codeToKeyLabel(code)}
                  </span>
                  <span className="text-[var(--color-text-muted)]">{INSTRUMENT_LABELS[instrument]}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
