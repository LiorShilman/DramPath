import { useEffect, useRef, useState } from 'react'
import { useMidiDrumInput } from '../../hooks/useMidiDrumInput'
import type { MidiDrumInputStatus } from '../../hooks/useMidiDrumInput'
import { useRemoteHost } from './remote-host-context'
import { Badge, Button, Card, PageHeader } from '../../components/ui'
import type { BadgeVariant } from '../../components/ui'
import { HiHatVisual } from '../../components/visual-trainer/HiHatVisual'
import type { HiHatHitFeedback } from '../../components/visual-trainer/HiHatVisual'
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

export function PedalDisciplinePage() {
  const [isRunning, setIsRunning] = useState(false)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(loadBestStreak)
  const [totalHits, setTotalHits] = useState(0)
  const [closedHits, setClosedHits] = useState(0)
  const [feedback, setFeedback] = useState<HiHatHitFeedback | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [celebrationToken, setCelebrationToken] = useState<string | null>(null)

  const isRunningRef = useRef(false)
  const startedAtRef = useRef<number | null>(null)
  const longestStreakThisSessionRef = useRef(0)
  const totalHitsRef = useRef(0)
  const closedHitsRef = useRef(0)
  const streakRef = useRef(0)
  const bestStreakRef = useRef(loadBestStreak())
  const bestStreakAtStartRef = useRef(0)
  const hasBeatenBestThisSessionRef = useRef(false)

  const { sendPedalDisciplineState } = useRemoteHost()

  // Mirrors this screen to a paired phone (ADR 0007) — a completely
  // separate screen from the notation/exercise mirror, so it's sent
  // directly here rather than via useVisualTrainer's registerSession (this
  // page takes no remote hits/transport commands, nothing to register).
  // Sent once on mount (so the phone switches to this view immediately,
  // before Start is even pressed) and cleared on unmount so the phone
  // doesn't keep showing a stale mirror after navigating away.
  useEffect(() => {
    sendPedalDisciplineState({
      isRunning: false,
      streak: 0,
      bestStreak: loadBestStreak(),
      totalHits: 0,
      closedHits: 0,
      elapsedSeconds: 0,
    })
    return () => sendPedalDisciplineState(null)
  }, [sendPedalDisciplineState])

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
      const hitKind = instrument === 'hihat_closed' ? 'closed' : 'open'
      setFeedback({ kind: hitKind, token: createId() })

      if (instrument === 'hihat_closed') {
        closedHitsRef.current += 1
        setClosedHits(closedHitsRef.current)
        streakRef.current += 1
        setStreak(streakRef.current)
        longestStreakThisSessionRef.current = Math.max(longestStreakThisSessionRef.current, streakRef.current)
        if (streakRef.current > bestStreakAtStartRef.current && !hasBeatenBestThisSessionRef.current) {
          hasBeatenBestThisSessionRef.current = true
          bestStreakRef.current = streakRef.current
          saveBestStreak(streakRef.current)
          setBestStreak(streakRef.current)
          setCelebrationToken(createId())
        } else if (streakRef.current > bestStreakRef.current) {
          bestStreakRef.current = streakRef.current
          saveBestStreak(streakRef.current)
          setBestStreak(streakRef.current)
        }
      } else {
        streakRef.current = 0
        setStreak(0)
      }

      sendPedalDisciplineState({
        isRunning: true,
        streak: streakRef.current,
        bestStreak: bestStreakRef.current,
        totalHits: totalHitsRef.current,
        closedHits: closedHitsRef.current,
        elapsedSeconds: startedAtRef.current !== null ? Math.floor((performance.now() - startedAtRef.current) / 1000) : 0,
        lastHit: hitKind,
      })
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
    streakRef.current = 0
    totalHitsRef.current = 0
    closedHitsRef.current = 0
    longestStreakThisSessionRef.current = 0
    bestStreakAtStartRef.current = bestStreakRef.current
    hasBeatenBestThisSessionRef.current = false
    startedAtRef.current = performance.now()
    isRunningRef.current = true
    setIsRunning(true)
    sendPedalDisciplineState({
      isRunning: true,
      streak: 0,
      bestStreak: bestStreakRef.current,
      totalHits: 0,
      closedHits: 0,
      elapsedSeconds: 0,
    })
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
    sendPedalDisciplineState({
      isRunning: false,
      streak: streakRef.current,
      bestStreak: bestStreakRef.current,
      totalHits: totalHitsRef.current,
      closedHits: closedHitsRef.current,
      elapsedSeconds,
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
        {/* Always mounted (never conditionally inserted/removed) — direct
            user report: a conditionally-mounted absolutely-positioned banner
            could paint one frame before position:absolute fully applied,
            briefly pushing the rest of the layout down-and-right. Toggling
            opacity on an always-present node can't do that, since nothing
            is ever inserted into the DOM after the initial render. */}
        <div
          className={`pointer-events-none absolute -top-4 rounded-full bg-[var(--color-success)] px-4 py-1 text-sm font-bold text-white shadow-lg transition-opacity duration-300 ${celebrationToken ? 'opacity-100' : 'opacity-0'}`}
        >
          🔥 שיא אישי חדש!
        </div>
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
