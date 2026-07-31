import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { PageHeader, Button, Card } from '../../components/ui'
import { FileDropzone } from '../../components/FileDropzone'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { DrumKit } from '../../components/visual-trainer/DrumKit'
import { useFreeDrumPlayback } from '../../hooks/useFreeDrumPlayback'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { useMetronome } from '../practice-session/useMetronome'
import { resourceRepository, notationPracticeStateRepository } from '../../data/repositories'
import { calculateTapTempoBpm } from '../../lib/metronome-math'
import { SUBDIVISION_LABELS } from '../exercises/exercise-labels'
import { DEFAULT_KEYBOARD_MAP, codeToKeyLabel } from '../../lib/visual-trainer/keyboard-map'
import { INSTRUMENT_LABELS } from '../../lib/visual-trainer/instrument-labels'
import type { Resource, Subdivision } from '../../domain'

const BEATS_PER_BAR = [0, 1, 2, 3]
const DEFAULT_BPM = 90
const BPM_STEP = 5
const MIN_BPM = 30
const MAX_BPM = 300
// Tags saved notation uploads so they're a distinct, filterable slice of
// the shared Resource library, not mixed in with lesson/song attachments.
const NOTATION_TAG = 'notation-practice'

/** VISUAL_DRUM_TRAINER_SPEC.md's graded exercises need structured
 * DrumNoteEvent[] data — an uploaded photo/PDF has none, so this is a
 * deliberately ungraded mode: a reference file on screen, a metronome for
 * tempo, and the drum kit reacting live to keyboard input while the player
 * reads the sheet and plays along by hand. Uploaded files are saved to the
 * shared Resource library (not just a session-only blob URL) so they don't
 * need re-uploading next time. */
export function FreeNotationPracticePage() {
  const [songs, setSongs] = useState<Resource[]>([])
  const [selectedResource, setSelectedResource] = useState<Resource | undefined>(undefined)
  const [fileUrl, setFileUrl] = useState<string | undefined>(undefined)
  const [pendingRemoval, setPendingRemoval] = useState<Resource | undefined>(undefined)
  const fileUrlRef = useRef(fileUrl)

  useEffect(() => {
    fileUrlRef.current = fileUrl
  }, [fileUrl])

  useEffect(() => {
    return () => {
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current)
    }
  }, [])

  useEffect(() => {
    void resourceRepository.getAll().then((all) => {
      setSongs(
        all
          .filter((resource) => resource.tags.includes(NOTATION_TAG))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      )
    })
  }, [])

  async function selectSong(resource: Resource) {
    if (!resource.blob) return
    setFileUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(resource.blob!)
    })
    setSelectedResource(resource)
    const savedState = await notationPracticeStateRepository.getForResource(resource.id)
    setBpm(savedState?.lastBpm ?? DEFAULT_BPM)
  }

  async function handleFilesSelected(files: File[]) {
    const file = files[0]
    if (!file) return
    const saved = await resourceRepository.save({
      fileName: file.name,
      mimeType: file.type,
      blob: file,
      tags: [NOTATION_TAG],
    })
    setSongs((current) => [saved, ...current.filter((song) => song.id !== saved.id)])
    void selectSong(saved)
  }

  async function confirmRemoveSong() {
    if (!pendingRemoval) return
    await resourceRepository.remove(pendingRemoval.id)
    await notationPracticeStateRepository.remove(pendingRemoval.id)
    setSongs((current) => current.filter((song) => song.id !== pendingRemoval.id))
    if (selectedResource?.id === pendingRemoval.id) {
      setFileUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return undefined
      })
      setSelectedResource(undefined)
    }
    setPendingRemoval(undefined)
  }

  const { activeHit } = useFreeDrumPlayback()
  const metronome = useMetronome()
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [subdivision, setSubdivision] = useState<Subdivision>('quarter')
  const [tapTimestamps, setTapTimestamps] = useState<number[]>([])

  const saveBpmForSong = useDebouncedCallback((resourceId: string, value: number) => {
    void notationPracticeStateRepository.saveBpm(resourceId, value)
  }, 500)

  function applyBpm(next: number) {
    const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, next))
    setBpm(clamped)
    if (metronome.isPlaying) metronome.updateBpm(clamped)
    if (selectedResource) saveBpmForSong(selectedResource.id, clamped)
    return clamped
  }

  function adjustBpm(delta: number) {
    applyBpm(bpm + delta)
  }

  function handleTap() {
    const now = Date.now()
    const nextTaps = [...tapTimestamps, now].slice(-5)
    setTapTimestamps(nextTaps)
    const tapped = calculateTapTempoBpm(nextTaps)
    if (tapped !== undefined) applyBpm(Math.round(tapped))
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

  const fileIsPdf = selectedResource?.mimeType === 'application/pdf'

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
          <FileDropzone
            accept="image/*,application/pdf"
            onFilesSelected={(files) => void handleFilesSelected(files)}
            label="גררו קובץ תווים לכאן או לחצו לבחירה"
            hint="תמונה או PDF — נשמר לשימוש הבא"
            selectedSummary={selectedResource?.fileName}
          />

          {songs.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {songs.map((song) => (
                <li key={song.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => void selectSong(song)}
                    className={`max-w-48 truncate rounded-s-[var(--radius-card)] border px-3 py-1.5 text-sm ${
                      selectedResource?.id === song.id
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-raised)]'
                    }`}
                    title={song.fileName}
                  >
                    {song.fileName}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingRemoval(song)}
                    aria-label={`הסרת ${song.fileName}`}
                    className="rounded-e-[var(--radius-card)] border border-s-0 border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[var(--color-danger-text)] hover:bg-[var(--color-surface-raised)]"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {fileUrl ? (
            fileIsPdf ? (
              // #view=FitH forces Chrome/Edge's built-in PDF viewer to fit
              // the page to the frame's width — its default "fit page" zoom
              // left large blank margins and could overflow a page taller
              // than it is wide.
              <iframe
                src={`${fileUrl}#view=FitH`}
                title={selectedResource?.fileName ?? 'תווים'}
                className="h-[75vh] w-full rounded-[var(--radius-card)] border border-[var(--color-border)]"
              />
            ) : (
              <div className="flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                <img
                  src={fileUrl}
                  alt={selectedResource?.fileName ?? 'תווים'}
                  className="mx-auto h-[75vh] max-h-[75vh] w-auto max-w-full object-contain"
                />
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

            <Button variant="ghost" onClick={handleTap} aria-label="הקשה לקצב">
              הקשה לקצב
            </Button>

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

      <ConfirmDialog
        open={pendingRemoval !== undefined}
        title={`להסיר את "${pendingRemoval?.fileName}"?`}
        description="הקובץ יימחק מהספרייה ולא ניתן יהיה לשחזר אותו."
        onConfirm={() => void confirmRemoveSong()}
        onCancel={() => setPendingRemoval(undefined)}
      />
    </div>
  )
}
