import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { songRepository, exerciseRepository } from '../../data/repositories'
import { songStatusSchema } from '../../domain'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Button, PageHeader } from '../../components/ui'
import { SONG_STATUS_LABELS } from './song-labels'
import type { Exercise, Song, SongSection } from '../../domain'

const optionalPositiveInt = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
)

const songFormSchema = z.object({
  title: z.string().min(1, 'שדה חובה'),
  artist: z.string(),
  externalUrl: z
    .string()
    .refine((value) => value === '' || /^https?:\/\//.test(value), {
      message: 'קישור חייב להתחיל ב-http:// או https://',
    }),
  bpm: optionalPositiveInt,
  difficulty: optionalPositiveInt,
  status: songStatusSchema,
})
type SongFormInput = z.input<typeof songFormSchema>
type SongFormValues = z.infer<typeof songFormSchema>

function songToFormValues(song: Song): SongFormInput {
  return {
    title: song.title,
    artist: song.artist ?? '',
    externalUrl: song.externalUrl ?? '',
    bpm: song.bpm,
    difficulty: song.difficulty,
    status: song.status,
  }
}

export function SongDetailPage() {
  const { songId } = useParams<{ songId: string }>()
  const navigate = useNavigate()
  const [song, setSong] = useState<Song | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<SongFormInput>({
    resolver: zodResolver(songFormSchema),
  })

  useEffect(() => {
    if (!songId) return
    let cancelled = false

    async function load() {
      const [loadedSong, allExercises] = await Promise.all([
        songRepository.getById(songId as string),
        exerciseRepository.getAll(),
      ])
      if (cancelled) return
      if (loadedSong) {
        setSong(loadedSong)
        reset(songToFormValues(loadedSong))
      }
      setExercises(allExercises.sort((a, b) => a.name.localeCompare(b.name)))
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [songId, reset])

  const debouncedSave = useDebouncedCallback(async (values: SongFormValues) => {
    if (!songId) return
    const updated = await songRepository.patch(songId, {
      title: values.title,
      artist: values.artist || undefined,
      externalUrl: values.externalUrl || undefined,
      bpm: values.bpm,
      difficulty: values.difficulty as 1 | 2 | 3 | 4 | 5 | undefined,
      status: values.status,
    })
    setSong(updated)
  }, 500)

  useEffect(() => {
    const subscription = watch((formValues) => {
      const parsed = songFormSchema.safeParse(formValues)
      if (parsed.success) debouncedSave(parsed.data)
    })
    return () => subscription.unsubscribe()
  }, [watch, debouncedSave])

  async function persistSections(nextSections: SongSection[]) {
    if (!song) return
    const updated = await songRepository.patch(song.id, { sections: nextSections })
    setSong(updated)
  }

  function handleAddSection() {
    if (!song) return
    void persistSections([...song.sections, { label: 'קטע חדש' }])
  }

  function handleSectionChange(index: number, patch: Partial<SongSection>) {
    if (!song) return
    const next = song.sections.map((section, i) =>
      i === index ? { ...section, ...patch } : section,
    )
    setSong({ ...song, sections: next })
    debouncedSaveSections(next)
  }

  const debouncedSaveSections = useDebouncedCallback((sections: SongSection[]) => {
    void persistSections(sections)
  }, 500)

  function handleRemoveSection(index: number) {
    if (!song) return
    void persistSections(song.sections.filter((_, i) => i !== index))
  }

  async function handleToggleExercise(exerciseId: string) {
    if (!song) return
    const nextExerciseIds = song.exerciseIds.includes(exerciseId)
      ? song.exerciseIds.filter((id) => id !== exerciseId)
      : [...song.exerciseIds, exerciseId]
    const updated = await songRepository.patch(song.id, { exerciseIds: nextExerciseIds })
    setSong(updated)
  }

  async function handleDelete() {
    if (!songId) return
    await songRepository.remove(songId)
    setConfirmDelete(false)
    void navigate('/songs')
  }

  const visibleExercises = useMemo(() => {
    if (!exerciseSearch) return exercises
    const needle = exerciseSearch.toLowerCase()
    return exercises.filter((exercise) => exercise.name.toLowerCase().includes(needle))
  }, [exercises, exerciseSearch])

  if (!song) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title={song.title} backTo="/songs" backLabel="← חזרה לספריית שירים" />

      <form className="flex flex-col gap-3">
        {Object.keys(errors).length > 0 && (
          <div className="rounded-[var(--radius-card)] border border-[var(--color-danger-text)] p-2 text-sm text-[var(--color-danger-text)]">
            יש לתקן שגיאות בטופס לפני שהשינויים יישמרו.
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm">
          שם השיר
          <input
            {...register('title')}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
          />
          {errors.title && (
            <span className="text-sm text-[var(--color-danger-text)]">{errors.title.message}</span>
          )}
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            אמן
            <input
              {...register('artist')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            סטטוס
            <select
              {...register('status')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-2"
            >
              {Object.entries(SONG_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            BPM
            <input
              type="number"
              {...register('bpm')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            רמת קושי (1-5)
            <input
              type="number"
              min={1}
              max={5}
              {...register('difficulty')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          קישור חיצוני
          <input
            {...register('externalUrl')}
            placeholder="https://..."
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
          />
          {errors.externalUrl && (
            <span className="text-sm text-[var(--color-danger-text)]">
              {errors.externalUrl.message}
            </span>
          )}
        </label>
      </form>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm text-[var(--color-text-muted)]">קטעים לתרגול</h3>
          <Button size="sm" variant="ghost" onClick={handleAddSection}>
            + קטע
          </Button>
        </div>
        {song.sections.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">אין עדיין קטעים מסומנים.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {song.sections.map((section, index) => (
              <li key={index} className="flex flex-wrap items-center gap-2">
                <input
                  value={section.label}
                  onChange={(event) => handleSectionChange(index, { label: event.target.value })}
                  aria-label="שם הקטע"
                  className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  value={section.startSeconds ?? ''}
                  onChange={(event) =>
                    handleSectionChange(index, {
                      startSeconds: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                  placeholder="התחלה (שניות)"
                  aria-label="זמן התחלה בשניות"
                  className="w-32 rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  value={section.endSeconds ?? ''}
                  onChange={(event) =>
                    handleSectionChange(index, {
                      endSeconds: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                  placeholder="סיום (שניות)"
                  aria-label="זמן סיום בשניות"
                  className="w-32 rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-1 text-sm"
                />
                <Button
                  size="sm"
                  variant="danger-outline"
                  onClick={() => handleRemoveSection(index)}
                  aria-label="הסר קטע"
                >
                  הסר
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm text-[var(--color-text-muted)]">תרגילים קשורים</h3>
        <input
          value={exerciseSearch}
          onChange={(event) => setExerciseSearch(event.target.value)}
          placeholder="חיפוש תרגיל..."
          aria-label="חיפוש תרגילים לשיוך"
          className="mb-2 w-full rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
        />
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {visibleExercises.map((exercise) => (
            <li key={exercise.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={song.exerciseIds.includes(exercise.id)}
                  onChange={() => void handleToggleExercise(exercise.id)}
                />
                {exercise.name}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <Button variant="danger-outline" className="self-start" onClick={() => setConfirmDelete(true)}>
        מחיקת שיר
      </Button>

      <ConfirmDialog
        open={confirmDelete}
        title={`למחוק את "${song.title}"?`}
        description="לא ניתן לבטל פעולה זו."
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
