import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Badge, Button, Card, PageHeader } from '../../components/ui'
import { practiceRoutineRepository, interactiveExerciseRepository } from '../../data/repositories'
import { DEMO_EXERCISES } from './demo-exercises'
import { DIFFICULTY_LABELS, DIFFICULTY_VARIANTS } from './exercise-difficulty-labels'
import type { InteractiveExercise } from '../../domain'

interface CatalogItem {
  id: string
  title: string
  bpm: number
  difficulty: InteractiveExercise['difficulty']
}

/** Create/edit a practice routine — title + an ordered list of steps built
 * from the same custom+demo catalog ExerciseSelectPage already assembles.
 * Plain up/down-button reordering (no drag-and-drop library in this repo,
 * and this is typically a short list) rather than LessonsListPage's own
 * native HTML5 drag-and-drop pattern. */
export function RoutineBuilderPage() {
  const { routineId } = useParams<{ routineId: string }>()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [stepIds, setStepIds] = useState<string[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [isLoaded, setIsLoaded] = useState(!routineId)

  useEffect(() => {
    void interactiveExerciseRepository.getAll().then((customExercises) => {
      const sorted = [...customExercises].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setCatalog([
        ...sorted.map((exercise) => ({ id: exercise.id, title: exercise.title, bpm: exercise.bpm, difficulty: exercise.difficulty })),
        ...DEMO_EXERCISES.map((exercise) => ({ id: exercise.id, title: exercise.title, bpm: exercise.bpm, difficulty: exercise.difficulty })),
      ])
    })
  }, [])

  useEffect(() => {
    if (!routineId) return
    void practiceRoutineRepository.getById(routineId).then((found) => {
      if (found) {
        setTitle(found.title)
        setStepIds(found.exerciseIds)
      }
      setIsLoaded(true)
    })
  }, [routineId])

  function catalogItem(id: string): CatalogItem | undefined {
    return catalog.find((item) => item.id === id)
  }

  function addStep(id: string) {
    setStepIds((current) => [...current, id])
  }

  function removeStep(index: number) {
    setStepIds((current) => current.filter((_, i) => i !== index))
  }

  function moveStep(index: number, direction: -1 | 1) {
    setStepIds((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const moved = next[index]!
      next[index] = next[target]!
      next[target] = moved
      return next
    })
  }

  async function handleSave() {
    if (!title.trim() || stepIds.length === 0) return
    if (routineId) {
      await practiceRoutineRepository.patch(routineId, { title: title.trim(), exerciseIds: stepIds })
    } else {
      await practiceRoutineRepository.create({ title: title.trim(), exerciseIds: stepIds })
    }
    void navigate('/practice/visual/routines')
  }

  if (!isLoaded) {
    return <p className="text-[var(--color-text-muted)]">טוען…</p>
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={routineId ? 'עריכת רצף' : 'רצף חדש'} backTo="/practice/visual/routines" backLabel="← חזרה לרצפים" />

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">שם הרצף</span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2"
          placeholder="לדוגמה: חימום + תרגול יומי"
        />
      </label>

      <Card padding="md" className="flex flex-col gap-2">
        <h3 className="font-semibold">שלבים ברצף</h3>
        {stepIds.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">עדיין לא נוספו תרגילים — הוסף מהרשימה למטה.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {stepIds.map((id, index) => {
              const item = catalogItem(id)
              return (
                <li
                  key={`${id}-${index}`}
                  className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] p-2"
                >
                  <span className="w-6 shrink-0 text-center text-sm text-[var(--color-text-muted)]">{index + 1}</span>
                  <span className="flex-1 truncate">{item ? item.title : 'תרגיל לא נמצא'}</span>
                  {item ? (
                    <>
                      <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{item.bpm} BPM</span>
                      <Badge variant={DIFFICULTY_VARIANTS[item.difficulty]} className="shrink-0">
                        {DIFFICULTY_LABELS[item.difficulty]}
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="danger" className="shrink-0">
                      לא נמצא
                    </Badge>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => moveStep(index, -1)} disabled={index === 0} aria-label="הזזה למעלה">
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveStep(index, 1)}
                    disabled={index === stepIds.length - 1}
                    aria-label="הזזה למטה"
                  >
                    ↓
                  </Button>
                  <Button size="sm" variant="danger-outline" onClick={() => removeStep(index)} aria-label="הסרה משלב זה">
                    הסרה
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card padding="md" className="flex flex-col gap-2">
        <h3 className="font-semibold">הוספת תרגיל</h3>
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {catalog.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => addStep(item.id)}
                className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] p-2 text-start hover:bg-[var(--color-surface)]"
              >
                <span className="truncate">{item.title}</span>
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{item.bpm} BPM</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex gap-2">
        <Button onClick={() => void handleSave()} disabled={!title.trim() || stepIds.length === 0}>
          שמירה
        </Button>
      </div>
    </div>
  )
}
