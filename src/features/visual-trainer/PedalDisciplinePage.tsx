import { useEffect, useRef, useState } from 'react'
import { useMidiDrumInput } from '../../hooks/useMidiDrumInput'
import type { MidiDrumInputStatus } from '../../hooks/useMidiDrumInput'
import { Badge, Button, Card, PageHeader } from '../../components/ui'
import type { BadgeVariant } from '../../components/ui'
import { createId } from '../../domain'
import type { DrumInstrument } from '../../domain'

// Not tied to any InteractiveExercise/notation — there's nothing to read
// here, just a continuous stream of real hi-hat hits graded purely on
// which instrument they resolved to (hihat_closed vs hihat_open). Direct
// user finding, confirmed via tools/midi-inspector.html: their module sends
// no continuous pedal-position data at all (no Control Change messages),
// only a Note On whose note number (30 vs 46) is decided by pedal state at
// strike time — so there's nothing to draw a live pressure gauge from. The
// real skill being trained is foot endurance/consistency over time, not
// one-off precision, hence the streak-based framing instead of a
// timing/accuracy score.
const BEST_STREAK_STORAGE_KEY = 'drumpath.pedal-discipline-best-streak'

const MIDI_STATUS_LABELS: Record<MidiDrumInputStatus, string> = {
  disabled: 'כבוי',
  unsupported: 'הדפדפן לא תומך ב-MIDI (צריך Chrome/Edge)',
  requesting: 'מבקש הרשאה…',
  'no-device': 'לא נמצא התקן MIDI',
  connected: 'קיט תופים מחובר',
}
const MIDI_STATUS_BADGE_VARIANT: Record<MidiDrumInputStatus, BadgeVariant> = {
  disabled: 'neutral',
  unsupported: 'danger',
  requesting: 'neutral',
  'no-device': 'warning',
  connected: 'success',
}

function loadBestStreak(): number {
  if (typeof localStorage === 'undefined') return 0
  const parsed = Number.parseInt(localStorage.getItem(BEST_STREAK_STORAGE_KEY) ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function saveBestStreak(value: number): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(BEST_STREAK_STORAGE_KEY, String(value))
}

interface HitFeedback {
  kind: 'closed' | 'open'
  token: string
}

interface SessionSummary {
  totalHits: number
  closedHits: number
  longestStreak: number
  durationSeconds: number
  isNewBest: boolean
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

// The animated hi-hat itself — two bars whose gap smoothly transitions
// based on the last real hit, plus a glow/shake burst on every hit (keyed
// by feedback.token so two consecutive same-result hits both visibly pulse,
// not just a class toggle that no-ops on an unchanged state).
function HiHatVisual({ isRunning, feedback }: { isRunning: boolean; feedback: HitFeedback | null }) {
  const gapPx = !isRunning || !feedback ? 18 : feedback.kind === 'closed' ? 6 : 34

  return (
    <div className="relative flex h-48 w-72 items-end justify-center">
      <div
        key={feedback?.token ?? 'idle'}
        className={`pedal-hihat-glow absolute inset-0 ${feedback ? feedback.kind : ''}`}
      >
        {/* stand */}
        <div className="absolute bottom-0 left-1/2 h-40 w-2 -translate-x-1/2 rounded-full bg-[var(--color-border)]" />
        {/* bottom cymbal — fixed */}
        <div className="absolute bottom-16 left-1/2 h-5 w-64 -translate-x-1/2 rounded-[50%] bg-gradient-to-b from-amber-400 to-amber-700 shadow-lg" />
        {/* top cymbal — moves with gapPx */}
        <div
          className="absolute left-1/2 h-5 w-60 -translate-x-1/2 rounded-[50%] bg-gradient-to-b from-amber-300 to-amber-600 shadow-lg transition-[bottom] duration-150 ease-out"
          style={{ bottom: `${64 + gapPx}px` }}
        />
      </div>
    </div>
  )
}

export function PedalDisciplinePage() {
  const [isRunning, setIsRunning] = useState(false)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(loadBestStreak)
  const [totalHits, setTotalHits] = useState(0)
  const [closedHits, setClosedHits] = useState(0)
  const [feedback, setFeedback] = useState<HitFeedback | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [celebrationToken, setCelebrationToken] = useState<string | null>(null)

  const isRunningRef = useRef(false)
  const startedAtRef = useRef<number | null>(null)
  const longestStreakThisSessionRef = useRef(0)
  const totalHitsRef = useRef(0)
  const closedHitsRef = useRef(0)
  const bestStreakAtStartRef = useRef(0)
  const hasBeatenBestThisSessionRef = useRef(false)

  useEffect(() => {
    if (!isRunning) return undefined
    const intervalId = setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsedSeconds(Math.floor((performance.now() - startedAtRef.current) / 1000))
      }
    }, 250)
    return () => clearInterval(intervalId)
  }, [isRunning])

  useEffect(() => {
    if (!celebrationToken) return undefined
    const timeoutId = setTimeout(() => setCelebrationToken(null), 2200)
    return () => clearTimeout(timeoutId)
  }, [celebrationToken])

  const midiStatus = useMidiDrumInput({
    enabled: true,
    onHit: (instrument: DrumInstrument) => {
      if (!isRunningRef.current) return
      if (instrument !== 'hihat_closed' && instrument !== 'hihat_open') return

      totalHitsRef.current += 1
      setTotalHits(totalHitsRef.current)
      setFeedback({ kind: instrument === 'hihat_closed' ? 'closed' : 'open', token: createId() })

      if (instrument === 'hihat_closed') {
        closedHitsRef.current += 1
        setClosedHits(closedHitsRef.current)
        setStreak((prev) => {
          const next = prev + 1
          longestStreakThisSessionRef.current = Math.max(longestStreakThisSessionRef.current, next)
          if (next > bestStreakAtStartRef.current && !hasBeatenBestThisSessionRef.current) {
            hasBeatenBestThisSessionRef.current = true
            saveBestStreak(next)
            setBestStreak(next)
            setCelebrationToken(createId())
          } else if (next > bestStreak) {
            saveBestStreak(next)
            setBestStreak(next)
          }
          return next
        })
      } else {
        setStreak(0)
      }
    },
  })

  function handleStart() {
    setStreak(0)
    setTotalHits(0)
    setClosedHits(0)
    setFeedback(null)
    setSummary(null)
    setElapsedSeconds(0)
    setCelebrationToken(null)
    totalHitsRef.current = 0
    closedHitsRef.current = 0
    longestStreakThisSessionRef.current = 0
    bestStreakAtStartRef.current = bestStreak
    hasBeatenBestThisSessionRef.current = false
    startedAtRef.current = performance.now()
    isRunningRef.current = true
    setIsRunning(true)
  }

  function handleStop() {
    isRunningRef.current = false
    setIsRunning(false)
    setSummary({
      totalHits: totalHitsRef.current,
      closedHits: closedHitsRef.current,
      longestStreak: longestStreakThisSessionRef.current,
      durationSeconds: elapsedSeconds,
      isNewBest: hasBeatenBestThisSessionRef.current,
    })
  }

  const closedPercent = totalHits > 0 ? Math.round((closedHits / totalHits) * 100) : 100

  return (
    <div className="flex max-w-2xl flex-col items-center gap-6">
      <PageHeader
        title="משמעת פדל — היי-הט"
        subtitle="החזיקו את ההיי-הט סגור ברגל לאורך זמן — כל פתיחה בטעות מאפסת את הרצף"
      />

      <Badge variant={MIDI_STATUS_BADGE_VARIANT[midiStatus]}>{MIDI_STATUS_LABELS[midiStatus]}</Badge>

      <div className="relative flex flex-col items-center gap-2">
        <HiHatVisual isRunning={isRunning} feedback={feedback} />
        {celebrationToken && (
          <div
            key={celebrationToken}
            className="pedal-streak-number pop absolute -top-4 rounded-full bg-[var(--color-success)] px-4 py-1 text-sm font-bold text-white shadow-lg"
          >
            🔥 שיא אישי חדש!
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-1">
        <div
          key={feedback?.token ?? 'streak-idle'}
          // Fixed min-width so the number stays visually anchored in place
          // — without it, centered text of a changing digit count (e.g. 9
          // -> 10) shifts the whole element sideways every time, on top of
          // the pop animation's own scale, reading as "jumping around"
          // instead of a clean in-place pulse (direct user report).
          className="pedal-streak-number pop min-w-[8rem] text-center text-7xl font-black tabular-nums"
        >
          {streak}
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">רצף נוכחי · שיא אישי: {bestStreak}</p>
      </div>

      {isRunning && (
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-[var(--color-text-muted)]">
          <span className="tabular-nums">{formatDuration(elapsedSeconds)}</span>
          <span className="tabular-nums">{totalHits} הקשות</span>
          <span className="tabular-nums">{closedPercent}% סגור</span>
        </div>
      )}

      <Button size="lg" variant={isRunning ? 'danger' : 'primary'} onClick={isRunning ? handleStop : handleStart}>
        {isRunning ? 'עצירה' : 'התחלה'}
      </Button>

      {summary && (
        <Card className="w-full">
          <h3 className="mb-2 font-semibold">
            {summary.isNewBest ? '🔥 שיא אישי חדש!' : 'סיכום האימון'}
          </h3>
          <ul className="flex flex-col gap-1 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">משך</span>
              <span className="tabular-nums">{formatDuration(summary.durationSeconds)}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">סה״כ הקשות</span>
              <span className="tabular-nums">{summary.totalHits}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">אחוז סגור</span>
              <span className="tabular-nums">
                {`${summary.totalHits > 0 ? Math.round((summary.closedHits / summary.totalHits) * 100) : 100}%`}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-[var(--color-text-muted)]">הרצף הכי ארוך</span>
              <span className="tabular-nums">{summary.longestStreak}</span>
            </li>
          </ul>
        </Card>
      )}
    </div>
  )
}
