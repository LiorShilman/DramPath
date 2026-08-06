import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  lessonRepository,
  weekRepository,
  exerciseRepository,
  resourceRepository,
  achievementRepository,
  interactiveExerciseRepository,
} from '../../data/repositories'
import { lessonCategorySchema, lessonStatusSchema, nowIso } from '../../domain'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { useExercisePreviewPlayback } from '../../hooks/useExercisePreviewPlayback'
import type { RemoteDrumInputStatus } from '../../hooks/useRemoteDrumInput'
import { useMetronome } from '../practice-session/useMetronome'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ResourceThumbnail } from '../../components/ResourceThumbnail'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { VideoThumbnailButton } from '../../components/VideoThumbnailButton'
import { ExerciseNotationSheet } from '../../components/visual-trainer/ExerciseNotationSheet'
import { DrumKit } from '../../components/visual-trainer/DrumKit'
import { Badge, Button, PageHeader, Card, buttonClassName } from '../../components/ui'
import type { BadgeVariant } from '../../components/ui'
import { LESSON_CATEGORY_LABELS, LESSON_STATUS_LABELS } from './lesson-labels'
import { DIFFICULTY_LABELS, DIFFICULTY_VARIANTS } from '../visual-trainer/exercise-difficulty-labels'
import type { Exercise, InteractiveExercise, Lesson, Resource, Week } from '../../domain'

const SUBDIVISION_LABELS: Record<InteractiveExercise['subdivision'], string> = {
  quarter: 'רבעים',
  eighth: 'שמיניות',
  sixteenth: 'שש-עשריות',
}

// Same convention as VisualTrainerPage/FreeNotationPracticePage's own copy
// of these labels — richer than a flat connected/not boolean since the
// reason nothing's happening matters (relay down vs. no phone yet vs. a
// second tab took over).
const REMOTE_STATUS_LABELS: Record<RemoteDrumInputStatus, string> = {
  disabled: 'כבוי',
  connecting: 'מתחבר לשירות…',
  'waiting-for-phone': 'ממתין לחיבור טלפון',
  connected: 'טלפון מחובר',
  superseded: 'הוחלף בכרטיסייה אחרת',
}
const REMOTE_STATUS_BADGE_VARIANT: Record<RemoteDrumInputStatus, BadgeVariant> = {
  disabled: 'neutral',
  connecting: 'neutral',
  'waiting-for-phone': 'warning',
  connected: 'success',
  superseded: 'danger',
}

const BEATS_PER_BAR = 4

const lessonFormSchema = z.object({
  title: z.string().min(1, 'שדה חובה'),
  description: z.string(),
  weekId: z.string(),
  category: lessonCategorySchema,
  externalVideoUrl: z
    .string()
    .refine((value) => value === '' || /^https?:\/\//.test(value), {
      message: 'קישור חייב להתחיל ב-http:// או https://',
    }),
  coverImageResourceId: z.string(),
  status: lessonStatusSchema,
  completionCriteria: z.string(),
  notes: z.string(),
  tagsText: z.string(),
})
type LessonFormValues = z.infer<typeof lessonFormSchema>

function lessonToFormValues(lesson: Lesson): LessonFormValues {
  return {
    title: lesson.title,
    description: lesson.description ?? '',
    weekId: lesson.weekId ?? '',
    category: lesson.category,
    externalVideoUrl: lesson.externalVideoUrl ?? '',
    coverImageResourceId: lesson.coverImageResourceId ?? '',
    status: lesson.status,
    completionCriteria: lesson.completionCriteria ?? '',
    notes: lesson.notes ?? '',
    tagsText: lesson.tags.join(', '),
  }
}

export function LessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [weeks, setWeeks] = useState<Week[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [resources, setResources] = useState<Resource[]>([])
  const [resourceSearch, setResourceSearch] = useState('')
  const [showResourcePicker, setShowResourcePicker] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [linkedExercise, setLinkedExercise] = useState<InteractiveExercise | undefined>(undefined)
  const preview = useExercisePreviewPlayback(linkedExercise)
  const metronome = useMetronome()
  const [playingVideo, setPlayingVideo] = useState<{ resource: Resource; url: string } | undefined>(undefined)
  const playingVideoRef = useRef(playingVideo)
  playingVideoRef.current = playingVideo

  function playVideo(resource: Resource, url: string) {
    setPlayingVideo((current) => {
      if (current) URL.revokeObjectURL(current.url)
      return { resource, url }
    })
  }

  function closeVideo() {
    setPlayingVideo((current) => {
      if (current) URL.revokeObjectURL(current.url)
      return undefined
    })
  }

  // Unmount-only cleanup — reads the ref (always current) rather than closing
  // over `playingVideo`, which would stay stuck at its mount-time value
  // (undefined) for the lifetime of this effect.
  useEffect(() => {
    return () => {
      if (playingVideoRef.current) URL.revokeObjectURL(playingVideoRef.current.url)
    }
  }, [])

  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<LessonFormValues>({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: lessonToFormValues({
      id: '',
      order: 0,
      title: '',
      category: 'technique',
      resourceIds: [],
      exerciseIds: [],
      tags: [],
      status: 'not_started',
      createdAt: '',
      updatedAt: '',
    }),
  })

  useEffect(() => {
    if (!lessonId) return
    let cancelled = false

    async function load() {
      const [loadedLesson, allWeeks, allExercises, allResources, linkedExercises] =
        await Promise.all([
          lessonRepository.getById(lessonId as string),
          weekRepository.getAll(),
          exerciseRepository.getAll(),
          resourceRepository.getAll(),
          interactiveExerciseRepository.findByLessonId(lessonId as string),
        ])
      if (cancelled) return
      if (loadedLesson) {
        setLesson(loadedLesson)
        reset(lessonToFormValues(loadedLesson))
      }
      setWeeks(allWeeks.sort((a, b) => a.order - b.order))
      setExercises(allExercises.sort((a, b) => a.name.localeCompare(b.name)))
      setResources(
        allResources.sort((a, b) => a.fileName.localeCompare(b.fileName)),
      )
      setLinkedExercise(linkedExercises[0])
    }

    void load()

    // If a file was added to the library from another tab (or /library in
    // the same tab, then browser-back instead of an in-app nav that would
    // remount this page), this component's `resources` state would
    // otherwise stay stale until a manual reload — refresh it whenever the
    // tab regains focus/visibility instead.
    function handleVisible() {
      if (document.visibilityState === 'visible')
        void resourceRepository.getAll().then((all) => {
          if (!cancelled)
            setResources(
              all.sort((a, b) => a.fileName.localeCompare(b.fileName)),
            )
        })
    }
    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('focus', handleVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('focus', handleVisible)
    }
  }, [lessonId, reset])

  const debouncedSave = useDebouncedCallback(
    async (values: LessonFormValues) => {
      if (!lessonId) return
      const wasCompleted = lesson?.status === 'completed'
      const tags = values.tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
      const updated = await lessonRepository.patch(lessonId, {
        title: values.title,
        description: values.description || undefined,
        weekId: values.weekId || undefined,
        category: values.category,
        externalVideoUrl: values.externalVideoUrl || undefined,
        coverImageResourceId: values.coverImageResourceId || undefined,
        status: values.status,
        completionCriteria: values.completionCriteria || undefined,
        notes: values.notes || undefined,
        tags,
      })
      setLesson(updated)

      if (!wasCompleted && updated.status === 'completed') {
        await achievementRepository.create({
          type: 'lesson_completed',
          title: `שיעור הושלם: ${updated.title}`,
          relatedEntityId: updated.id,
          achievedAt: nowIso(),
        })
      }
    },
    500,
  )

  useEffect(() => {
    const subscription = watch((formValues) => {
      const parsed = lessonFormSchema.safeParse(formValues)
      if (parsed.success) debouncedSave(parsed.data)
    })
    return () => subscription.unsubscribe()
  }, [watch, debouncedSave])

  async function handleToggleExercise(exerciseId: string) {
    if (!lesson) return
    const nextExerciseIds = lesson.exerciseIds.includes(exerciseId)
      ? lesson.exerciseIds.filter((id) => id !== exerciseId)
      : [...lesson.exerciseIds, exerciseId]
    const updated = await lessonRepository.patch(lesson.id, {
      exerciseIds: nextExerciseIds,
    })
    setLesson(updated)
  }

  async function handleToggleResource(resourceId: string) {
    if (!lesson) return
    const nextResourceIds = lesson.resourceIds.includes(resourceId)
      ? lesson.resourceIds.filter((id) => id !== resourceId)
      : [...lesson.resourceIds, resourceId]
    const updated = await lessonRepository.patch(lesson.id, {
      resourceIds: nextResourceIds,
    })
    setLesson(updated)
  }

  async function handleDelete() {
    if (!lessonId) return
    await lessonRepository.remove(lessonId)
    setConfirmDelete(false)
    void navigate('/lessons')
  }

  const visibleExercises = useMemo(() => {
    if (!exerciseSearch) return exercises
    const needle = exerciseSearch.toLowerCase()
    return exercises.filter((exercise) =>
      exercise.name.toLowerCase().includes(needle),
    )
  }, [exercises, exerciseSearch])

  const attachedExercises = useMemo(
    () =>
      exercises.filter((exercise) => lesson?.exerciseIds.includes(exercise.id)),
    [exercises, lesson],
  )

  const visibleResources = useMemo(() => {
    if (!resourceSearch) return resources
    const needle = resourceSearch.toLowerCase()
    return resources.filter((resource) =>
      resource.fileName.toLowerCase().includes(needle),
    )
  }, [resources, resourceSearch])

  const attachedResources = useMemo(
    () =>
      resources.filter((resource) => lesson?.resourceIds.includes(resource.id)),
    [resources, lesson],
  )

  const imageResources = useMemo(
    () =>
      resources.filter((resource) => resource.mimeType.startsWith('image/')),
    [resources],
  )

  const coverImage = imageResources.find(
    (resource) => resource.id === lesson?.coverImageResourceId,
  )

  if (!lesson) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex max-w-2xl flex-1 flex-col gap-4">
        <PageHeader
          title={lesson.title}
          backTo="/lessons"
          backLabel="← חזרה לספריית שיעורים"
        />

        <form className="flex flex-col gap-3">
          {Object.keys(errors).length > 0 && (
            <div className="rounded-[var(--radius-card)] border border-[var(--color-danger-text)] p-2 text-sm text-[var(--color-danger-text)]">
              יש לתקן שגיאות בטופס לפני שהשינויים יישמרו.
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm">
            שם השיעור
            <input
              {...register('title')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
            {errors.title && (
              <span className="text-sm text-[var(--color-danger-text)]">
                {errors.title.message}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            תיאור
            <textarea
              {...register('description')}
              rows={4}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              שבוע
              <select
                {...register('weekId')}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-2"
              >
                <option value="">ללא שיוך</option>
                {weeks.map((week) => (
                  <option key={week.id} value={week.id}>
                    {week.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              קטגוריה
              <select
                {...register('category')}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-2"
              >
                {Object.entries(LESSON_CATEGORY_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              סטטוס
              <select
                {...register('status')}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-2"
              >
                {Object.entries(LESSON_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              תגיות (מופרדות בפסיק)
              <input
                {...register('tagsText')}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            קישור לשיעור המקורי
            <input
              {...register('externalVideoUrl')}
              placeholder="https://..."
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
            {errors.externalVideoUrl && (
              <span className="text-sm text-[var(--color-danger-text)]">
                {errors.externalVideoUrl.message}
              </span>
            )}
          </label>

          {lesson.externalVideoUrl && (
            <p className="text-sm">
              <a
                href={lesson.externalVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-primary-text)]"
              >
                פתח את השיעור המקורי ↗
              </a>
              <span className="text-[var(--color-text-muted)]">
                {' '}
                — דורש חיבור לאינטרנט
              </span>
            </p>
          )}

          <label className="flex flex-col gap-1 text-sm">
            תמונת נושא
            <div className="flex items-center gap-3">
              <ResourceThumbnail resource={coverImage} size={56} />
              <select
                {...register('coverImageResourceId')}
                className="flex-1 rounded-[var(--radius-card)] border border-[var(--color-border)] px-2 py-2"
              >
                <option value="">ללא</option>
                {imageResources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.sourceType === 'link'
                      ? `🔗 ${resource.fileName}`
                      : resource.fileName}
                  </option>
                ))}
              </select>
            </div>
            {imageResources.length === 0 && (
              <span className="text-xs text-[var(--color-text-muted)]">
                אין עדיין תמונות בספרייה. ניתן להעלות או לקשר ב-
                <Link
                  to="/library"
                  className="text-[var(--color-primary-text)]"
                >
                  ספריית קבצים
                </Link>
                .
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            תנאי השלמה
            <input
              {...register('completionCriteria')}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            הערות
            <textarea
              {...register('notes')}
              rows={3}
              className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
            />
          </label>
        </form>

        {linkedExercise && (
          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm text-[var(--color-text-muted)]">תווי התרגיל</h3>
              {!preview.isPlaying ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    // The pattern playback already includes its own synced
                    // metronome click (ExercisePlaybackEngine) — running the
                    // standalone metronome at the same time would be a
                    // second, unsynced click track.
                    metronome.stop()
                    preview.play()
                  }}
                >
                  ▶ נגן
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={preview.stop}>
                  ⏹ עצור
                </Button>
              )}
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <span>{linkedExercise.bpm} BPM</span>
              <span>·</span>
              <span>{SUBDIVISION_LABELS[linkedExercise.subdivision]}</span>
              <span>·</span>
              <Badge variant={DIFFICULTY_VARIANTS[linkedExercise.difficulty]}>
                {DIFFICULTY_LABELS[linkedExercise.difficulty]}
              </Badge>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={metronome.isPlaying ? 'ghost' : 'secondary'}
                  onClick={() => {
                    if (metronome.isPlaying) {
                      metronome.stop()
                    } else {
                      // Same reasoning as the ▶ נגן button above, in
                      // reverse — a click-only metronome and the pattern's
                      // own baked-in click must never run at once.
                      preview.stop()
                      metronome.start({
                        bpm: linkedExercise.bpm,
                        subdivision: linkedExercise.subdivision,
                        accentFirstBeat: true,
                        countInBars: 0,
                      })
                    }
                  }}
                >
                  {metronome.isPlaying ? '⏹ עצור מטרונום' : '🎵 מטרונום'}
                </Button>
                {metronome.isPlaying && (
                  <div className="flex gap-1" aria-hidden="true">
                    {Array.from({ length: BEATS_PER_BAR }, (_, beat) => (
                      <span
                        key={beat}
                        className={`h-2.5 w-2.5 rounded-full ${
                          metronome.beatIndex === beat ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-text-muted)]/40'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant={preview.isPhoneControlEnabled ? 'ghost' : 'secondary'} onClick={preview.togglePhoneControl}>
                  {preview.isPhoneControlEnabled ? '📴 כבה שליטת טלפון' : '📱 הפעל שליטת טלפון'}
                </Button>
                {preview.isPhoneControlEnabled && (
                  <Badge variant={REMOTE_STATUS_BADGE_VARIANT[preview.remoteStatus]}>
                    {REMOTE_STATUS_LABELS[preview.remoteStatus]}
                  </Badge>
                )}
              </div>
            </div>

            {/* Same DrumKit used by the real note-highway runner — its
                activeHits prop (from useExercisePreviewPlayback) is timed
                off the actual AudioContext clock, so the piece that flashes
                always matches the sound and the notation's own fill
                animation, not just an approximation. */}
            {/* DrumKit's artwork intentionally draws a little past its own
                box on both sides (hihat pokes out the left, crash/ride the
                right) — every other usage in the app absorbs that with
                margin (see FreeNotationPracticePage's 90%-width kit column),
                never placing it flush against a bordered edge. */}
            <Card padding="md" className="mb-3">
              <div className="mx-auto w-[90%] max-w-sm">
                <DrumKit activeHits={preview.activeHits} />
              </div>
            </Card>

            <Card padding="md" className="mb-3">
              <div dir="ltr" className="overflow-x-auto">
                <ExerciseNotationSheet
                  exercise={linkedExercise}
                  playbackProgress={
                    preview.isPlaying ? { bpm: linkedExercise.bpm, sessionId: preview.playSessionId } : undefined
                  }
                  highlightedEventIds={preview.highlightedEventIds}
                  showBeatLabels
                  barsPerRow={2}
                />
              </div>
            </Card>
            <Link to={`/practice/visual/${linkedExercise.id}`} className={buttonClassName('primary', 'sm')}>
              התחל תרגול
            </Link>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm text-[var(--color-text-muted)]">
              תרגילים קשורים
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowExercisePicker((value) => !value)}
            >
              {showExercisePicker ? 'סגירה' : '+ הוספת תרגיל'}
            </Button>
          </div>

          {attachedExercises.length > 0 && (
            <ul className="mb-3 flex flex-col gap-1">
              {attachedExercises.map((exercise) => (
                <li
                  key={exercise.id}
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-1.5 text-sm"
                >
                  <span>{exercise.name}</span>
                  <Button
                    size="sm"
                    variant="danger-outline"
                    onClick={() => void handleToggleExercise(exercise.id)}
                    aria-label={`הסר את ${exercise.name} מהשיעור`}
                  >
                    הסר
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {attachedExercises.length === 0 && !showExercisePicker && (
            <p className="text-sm text-[var(--color-text-muted)]">
              אין עדיין תרגילים משויכים לשיעור זה.
            </p>
          )}

          {showExercisePicker && (
            <>
              <input
                value={exerciseSearch}
                onChange={(event) => setExerciseSearch(event.target.value)}
                placeholder="חיפוש תרגיל..."
                aria-label="חיפוש תרגילים לשיוך"
                className="mb-2 w-full rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
              />
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {visibleExercises.length === 0 ? (
                  <li className="text-sm text-[var(--color-text-muted)]">
                    לא נמצאו תרגילים.
                  </li>
                ) : (
                  visibleExercises.map((exercise) => (
                    <li key={exercise.id}>
                      <label className="flex items-center gap-2 rounded-[var(--radius-card)] px-1 py-1.5 text-sm hover:bg-[var(--color-surface)]">
                        <input
                          type="checkbox"
                          checked={lesson.exerciseIds.includes(exercise.id)}
                          onChange={() =>
                            void handleToggleExercise(exercise.id)
                          }
                        />
                        {exercise.name}
                      </label>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </section>

        <section>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm text-[var(--color-text-muted)]">
              קבצים מצורפים
            </h3>
            {resources.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowResourcePicker((value) => !value)}
              >
                {showResourcePicker ? 'סגירה' : '+ הוספת קובץ'}
              </Button>
            )}
          </div>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">
            {attachedResources.length === 0 && !showResourcePicker
              ? 'אין עדיין קבצים משויכים לשיעור זה. '
              : ''}
            אם הקובץ שאתם מחפשים עדיין לא קיים בספרייה —{' '}
            <Link to="/library" className="text-[var(--color-primary-text)]">
              העלו או קשרו אותו שם
            </Link>{' '}
            קודם, ואז חזרו לכאן לסמן אותו.
          </p>

          {attachedResources.length > 0 && (
            <ul className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {attachedResources.map((resource) => (
                <li
                  key={resource.id}
                  className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-2 text-sm"
                >
                  {resource.mimeType.startsWith('image/') ? (
                    <ResourceThumbnail resource={resource} size={72} />
                  ) : resource.mimeType.startsWith('video/') ? (
                    <VideoThumbnailButton resource={resource} size={72} onPlay={playVideo} />
                  ) : (
                    <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                      <FileTypeIcon mimeType={resource.mimeType} size={28} />
                    </span>
                  )}
                  <span
                    className="w-full truncate text-center"
                    title={resource.fileName}
                  >
                    {resource.fileName}
                  </span>
                  {resource.sourceType === 'link' && (
                    <Badge
                      variant="primary"
                      className="min-h-8 w-full justify-center"
                    >
                      🔗 מקושר
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="danger-outline"
                    className="w-full"
                    onClick={() => void handleToggleResource(resource.id)}
                    aria-label={`הסר את ${resource.fileName} מהשיעור`}
                  >
                    הסר
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {resources.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">
              אין עדיין קבצים בספרייה. ניתן להעלות ב-
              <Link to="/library" className="text-[var(--color-primary-text)]">
                ספריית קבצים
              </Link>
              .
            </p>
          )}

          {showResourcePicker && resources.length > 0 && (
            <>
              <input
                value={resourceSearch}
                onChange={(event) => setResourceSearch(event.target.value)}
                placeholder="חיפוש קובץ להוספה..."
                aria-label="חיפוש קבצים לשיוך"
                className="mb-2 w-full rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
              />
              <ul className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                {visibleResources.length === 0 ? (
                  <li className="text-sm text-[var(--color-text-muted)]">
                    לא נמצאו קבצים.
                  </li>
                ) : (
                  visibleResources.map((resource) => (
                    <li key={resource.id}>
                      <label className="flex items-center gap-2 rounded-[var(--radius-card)] px-1 py-1.5 text-sm hover:bg-[var(--color-surface)]">
                        <input
                          type="checkbox"
                          checked={lesson.resourceIds.includes(resource.id)}
                          onChange={() =>
                            void handleToggleResource(resource.id)
                          }
                        />
                        <span className="shrink-0 text-[var(--color-text-muted)]">
                          <FileTypeIcon
                            mimeType={resource.mimeType}
                            size={16}
                          />
                        </span>
                        <span
                          className="min-w-0 flex-1 truncate"
                          title={resource.fileName}
                        >
                          {resource.fileName}
                        </span>
                        {resource.sourceType === 'link' && (
                          <Badge variant="primary">🔗 מקושר</Badge>
                        )}
                      </label>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </section>

        <Button
          variant="danger-outline"
          className="self-start"
          onClick={() => setConfirmDelete(true)}
        >
          מחיקת שיעור
        </Button>

        <ConfirmDialog
          open={confirmDelete}
          title={`למחוק את "${lesson.title}"?`}
          description="לא ניתן לבטל פעולה זו."
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmDelete(false)}
        />
      </div>

      {(playingVideo || coverImage) && (
        <div className="order-first flex w-full shrink-0 flex-col gap-4 lg:order-none lg:max-w-2xl lg:flex-1">
          {playingVideo && (
            // The column itself is capped at a sensible absolute width
            // (lg:max-w-2xl, matching the form) rather than "however much
            // free space happens to be available" — on a very wide/dual
            // monitor window that free space was enormous, so even 80% of
            // it produced a huge card with the (much smaller, native-sized)
            // video floating uncentered inside. mx-auto on the video itself
            // centers it within this now-reasonably-sized card; h-auto +
            // max-w-full keeps it at native resolution, never upscaled.
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 [box-shadow:var(--shadow-card)]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-xs text-[var(--color-text-muted)]" title={playingVideo.resource.fileName}>
                  {playingVideo.resource.fileName}
                </p>
                <Button size="sm" variant="ghost" onClick={closeVideo} aria-label="סגירת הנגן">
                  סגירה
                </Button>
              </div>
              <video controls autoPlay src={playingVideo.url} className="mx-auto block h-auto max-w-full rounded-[var(--radius-card)] bg-black">
                <track kind="captions" />
              </video>
            </div>
          )}

          {coverImage && (
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 [box-shadow:var(--shadow-card)]">
              <ResourceThumbnail resource={coverImage} nativeSize alt={lesson.title} />
              <p
                className="mt-2 truncate text-center text-xs text-[var(--color-text-muted)]"
                title={coverImage.fileName}
              >
                {coverImage.sourceType === 'link' ? `🔗 ${coverImage.fileName}` : coverImage.fileName}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
