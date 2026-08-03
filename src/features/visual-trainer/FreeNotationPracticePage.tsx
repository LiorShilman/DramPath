import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { PageHeader, Button, Card } from '../../components/ui'
import { FileDropzone } from '../../components/FileDropzone'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { DrumKit } from '../../components/visual-trainer/DrumKit'
import { KeyboardGuide } from '../../components/visual-trainer/KeyboardGuide'
import { useFreeDrumPlayback } from '../../hooks/useFreeDrumPlayback'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { useMetronome } from '../practice-session/useMetronome'
import { resourceRepository, notationPracticeStateRepository } from '../../data/repositories'
import { calculateTapTempoBpm } from '../../lib/metronome-math'
import { SUBDIVISION_LABELS } from '../exercises/exercise-labels'
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

  const { activeHits } = useFreeDrumPlayback()
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
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title="תרגול חופשי לפי תווים" backTo="/practice/visual" backLabel="← חזרה לרשימת התרגילים" />

      {/* Three columns, explicit user spec (revised from equal thirds to
          quarter/half/quarter so the kit actually reads as bigger than the
          side panels): right quarter = metronome + keys, center half =
          drum kit (large), left quarter = notation. No lg:flex-row-reverse
          needed here — in this RTL app a row's first DOM child already
          lands on the right by default (row-reverse was only needed in the
          old 2-column version to push the first-coded notation column to
          the non-default left side), so coding right-to-left in that order
          is enough. lg:w-1/4 on the side columns (not a fixed w-72/w-80):
          KeyboardGuide's inline variant needs real width to render its two
          staggered key rows without falling back to horizontal scroll — a
          fixed narrow column cut it off, confirmed via screenshot. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        {/* Right quarter: metronome + keyboard legend. */}
        <div className="flex w-full flex-col gap-4 lg:w-1/4">
          <Card padding="sm" className="flex flex-col items-stretch gap-3">
            <div className="flex items-center justify-center gap-3">
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

            <div className="flex items-center justify-center gap-1" aria-hidden="true">
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

            <label className="flex items-center justify-center gap-1 text-sm">
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

          <KeyboardGuide variant="inline" pressedInstruments={activeHits} />
        </div>

        {/* Center half: the drum kit, large — this page's main instrument,
            per explicit user request. No max-width cap: shrinking the
            notation column's h-[75vh] down to h-[60vh] below already fixed
            the real vertical-scroll report, so the kit is free to fill its
            full half-width column — confirmed by the user as the right
            call after trying an earlier max-w-5xl cap. w-[90%] (not
            w-full): the kit's cymbal pieces intentionally overflow their
            own container a little (crash/ride extend past its right edge)
            — keeping the kit at 90% and centered leaves real margin on both
            sides to absorb that. */}
        <div className="flex w-full items-center justify-center lg:w-1/2">
          <div className="w-[90%]">
            <DrumKit activeHits={activeHits} />
          </div>
        </div>

        {/* Left quarter: notation viewer. */}
        <div className="flex w-full flex-col gap-2 lg:w-1/4">
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
              // than it is wide. h-[60vh] (was 75vh): this column is now a
              // quarter-width side panel, not half the page — the taller
              // 75vh was pushing the row (height-matched to its tallest
              // column via items-stretch) past the viewport, a real
              // vertical scroll confirmed by the user once a file was
              // actually loaded (the empty-state placeholder is much
              // shorter, so this only showed up with a file open).
              <iframe
                src={`${fileUrl}#view=FitH`}
                title={selectedResource?.fileName ?? 'תווים'}
                className="h-[60vh] w-full rounded-[var(--radius-card)] border border-[var(--color-border)]"
              />
            ) : (
              <div className="flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                <img
                  src={fileUrl}
                  alt={selectedResource?.fileName ?? 'תווים'}
                  className="mx-auto h-[60vh] max-h-[60vh] w-auto max-w-full object-contain"
                />
              </div>
            )
          ) : (
            <div className="flex min-h-[50vh] items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] text-center text-sm text-[var(--color-text-muted)]">
              העלו קובץ תווים (תמונה או PDF) כדי להתחיל
            </div>
          )}
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
