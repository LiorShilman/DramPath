# Visual Drum Trainer
## אפיון מקצועי למודול תרגול תופים אינטראקטיבי

**מערכת יעד:** DrumPath  
**טכנולוגיה:** React + TypeScript  
**שפה:** עברית RTL  
**מודל:** Local-first  
**מיועד למימוש באמצעות:** Claude Code

# 1. מטרת המודול
מודול תרגול שבו המשתמש רואה ערכת תופים, תווים, מטרונום וקו פגיעה; לוחץ על מקשי המקלדת בהתאם לתווים; והמערכת משמיעה סאונד, מנפישה את כלי התופים ומחשבת דיוק תזמון.

התוצאות נשמרות ביומן האימונים של DrumPath.

# 2. מטרות
- תרגול קריאת תווים.
- תרגול תזמון מול מטרונום.
- תרגול Two Way Coordination.
- תרגול מקצבים, מעברים ושילובים.
- משוב: Perfect, Early, Late, Miss.
- מדידת Accuracy, Combo וסטיית תזמון.
- הכנה לתמיכה עתידית ב-MIDI.

# 3. מחוץ לתחום ב-MVP
- זיהוי אודיו ממיקרופון.
- ניתוח מערכת תופים אקוסטית.
- הקלטת וידאו.
- Multiplayer.
- סנכרון ענן.
- עריכת תווים מתקדמת.

# 4. מצבי תרגול
## 4.1 לימוד
הכלי, התו והמקש מודגשים מראש. אין פסילה.

## 4.2 תרגול
מוצגים תווים, מטרונום ומשוב בזמן אמת.

## 4.3 מבחן
ללא רמזים וללא שינוי BPM בזמן הניסיון.

## 4.4 חיקוי
המערכת מנגנת תיבה, המשתמש חוזר עליה, והמערכת משווה.

## 4.5 Two Way Coordination
שני ערוצים במקביל, למשל Hi-Hat ביד ימין ו-Bass ברגל ימין.

## 4.6 קריאת תווים
ללא שמות כלים, מיפוי מקשים או הדגשה מוקדמת.

# 5. מבנה המסך
## אזור עליון
שם תרגיל, BPM, חתימת זמן, מספר תיבה, Start, Pause, Restart ו-Exit.

## אזור תווים
שני מצבים:
1. Note Highway — תווים נעים אל קו פגיעה.
2. Staff Cursor — חמשה קבועה עם סמן נע.

## ערכת תופים
SVG עם שכבות נפרדות:
Bass, Snare, High Tom, Mid Tom, Floor Tom, Hi-Hat, Ride, Crash.

## משוב
Perfect, Early, Late, Miss, Combo, Accuracy ו-Timing Error.

# 6. מיפוי מקלדת
| מקש | כלי |
|---|---|
| `F` | Bass Drum |
| `J` | Snare |
| `D` | Closed Hi-Hat |
| `E` | Open Hi-Hat |
| `R` | Ride |
| `T` | Crash |
| `U` | High Tom |
| `I` | Mid Tom |
| `O` | Floor Tom |

המיפוי ניתן לעריכה, ללא כפילויות, ונשמר בהגדרות.

# 7. מודל נתונים
```ts
export type DrumInstrument =
  | "kick"
  | "snare"
  | "hihat_closed"
  | "hihat_open"
  | "ride"
  | "crash"
  | "tom_high"
  | "tom_mid"
  | "tom_floor";

export interface DrumNoteEvent {
  id: string;
  bar: number;
  beat: number;
  subdivisionIndex: number;
  instrument: DrumInstrument;
  velocity: number;
  durationBeats?: number;
  accent?: boolean;
}

export interface InteractiveExercise {
  id: string;
  title: string;
  description?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  bpm: number;
  minBpm: number;
  maxBpm: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  subdivision: "quarter" | "eighth" | "sixteenth";
  bars: number;
  loopCount: number;
  displayMode: "note_highway" | "staff_cursor";
  events: DrumNoteEvent[];
  lessonId?: string;
  exerciseId?: string;
  createdAt: string;
  updatedAt: string;
}

export type HitGrade = "perfect" | "early" | "late" | "miss";

export interface HitResult {
  id: string;
  expectedEventId: string;
  instrument: DrumInstrument;
  expectedTimeMs: number;
  actualTimeMs?: number;
  timingErrorMs?: number;
  grade: HitGrade;
}
```

# 8. ייצוג זמן מוזיקלי
אין לשמור תווים רק במילישניות. כל אירוע נשמר לפי תיבה, פעימה וחלוקה.

```ts
const beatDurationMs = 60000 / bpm;

const subdivisionsPerBeat =
  subdivision === "quarter" ? 1 :
  subdivision === "eighth" ? 2 :
  4;

const subdivisionDurationMs =
  beatDurationMs / subdivisionsPerBeat;
```

בשמיניות: `0 = המספר`, `1 = &`  
בשש-עשריות: `0 = 1`, `1 = e`, `2 = &`, `3 = a`

# 9. מנוע תזמון
אין להשתמש ב-`setInterval` כמקור האמת.

יש להשתמש ב:
- `AudioContext`
- Scheduler עם Lookahead
- `performance.now()`
- `requestAnimationFrame`

חלוקת אחריות:
- Audio Scheduler — מטרונום, Count-In ו-Samples.
- Visual Renderer — תווים, סמן ואנימציות.
- Input Handler — מקלדת ו-MIDI עתידי.
- Scoring Engine — התאמת לחיצות וחישוב ציון.

# 10. מנוע אודיו
Samples נדרשים:

```text
kick.wav
snare.wav
hihat-closed.wav
hihat-open.wav
ride.wav
crash.wav
tom-high.wav
tom-mid.wav
tom-floor.wav
metronome-accent.wav
metronome-click.wav
```

דרישות:
- טעינה מראש ל-AudioBuffer.
- אין התחלת תרגול לפני סיום טעינה.
- Master Volume.
- Drum Volume.
- Metronome Volume.
- עבודה ללא רשת.

# 11. זיהוי לחיצה וציון
```ts
const rawHitTime = performance.now();
const adjustedHitTime = rawHitTime - inputLatencyOffsetMs;
const timingErrorMs = adjustedHitTime - expectedHitTimeMs;
```

| רמה | Perfect | Early/Late | Miss |
|---|---:|---:|---:|
| מתחיל | ±60ms | עד ±130ms | מעל 130ms |
| בינוני | ±40ms | עד ±90ms | מעל 90ms |
| מתקדם | ±25ms | עד ±60ms | מעל 60ms |

בעת לחיצה:
1. חפש אירוע שלא נענה.
2. ודא התאמה לכלי.
3. בחר את האירוע הקרוב ביותר בזמן.
4. אם הוא בחלון התגובה, סמן Hit.
5. אחרת, רשום Extra Hit.
6. אירוע שעבר את חלון ה-Late יסומן Miss.

# 12. כיול Latency
1. המערכת משמיעה 8 פעימות.
2. המשתמש לוחץ עם הקליק.
3. ערכים חריגים מסוננים.
4. נשמר ממוצע בשם `inputLatencyOffsetMs`.
5. ניתן לבצע כיול מחדש או איפוס.

# 13. אנימציית ערכת התופים
לכל כלי יהיה רכיב SVG עצמאי.

```tsx
<g
  data-instrument="snare"
  className={active ? "drum-piece hit" : "drum-piece"}
>
  {/* SVG */}
</g>
```

```css
.drum-piece {
  transform-box: fill-box;
  transform-origin: center;
}

.drum-piece.hit {
  animation: drum-hit 120ms ease-out;
}

@keyframes drum-hit {
  0% { transform: scale(1); }
  40% { transform: scale(0.94); }
  100% { transform: scale(1); }
}
```

למצילות יש להוסיף Rotation, Vibration ו-Glow קצר.

# 14. מבנה תיקיות
```text
src/features/visual-trainer/
  components/
    DrumKitSvg.tsx
    NoteHighway.tsx
    StaffRenderer.tsx
    HitFeedback.tsx
    KeyboardGuide.tsx
    SessionResults.tsx
    TransportControls.tsx
  audio/
    AudioEngine.ts
    SampleLoader.ts
    MetronomeScheduler.ts
  engine/
    TimingEngine.ts
    HitMatcher.ts
    ScoringEngine.ts
    ExerciseRunner.ts
    LatencyCalibration.ts
  hooks/
    useKeyboardDrums.ts
    useVisualTrainer.ts
    useLatencyCalibration.ts
    useAudioEngine.ts
  pages/
    VisualTrainerPage.tsx
    CalibrationPage.tsx
    ExerciseSelectPage.tsx
    ResultsPage.tsx
  repositories/
    InteractiveExerciseRepository.ts
    VisualPracticeSessionRepository.ts
  types/
    visualTrainer.types.ts
  tests/
    HitMatcher.test.ts
    ScoringEngine.test.ts
    TimingEngine.test.ts
```

# 15. נתיבים
```text
/practice/visual
/practice/visual/exercises
/practice/visual/:exerciseId
/practice/visual/calibration
/practice/visual/results/:sessionId
```

# 16. אינטגרציה עם DrumPath
בסיום תרגול:
1. נוצר VisualPracticeSession.
2. נוצר PracticeEntry במערכת הקיימת.
3. נשמר זמן התרגול.
4. נשמר BPM.
5. נשמר Accuracy.
6. נשמר קישור לתוצאות המפורטות.

# 17. Seed Data
1. רבעים על Snare.
2. שמיניות על Hi-Hat.
3. Bass על פעימות 1 ו-3.
4. Snare על פעימות 2 ו-4.
5. מקצב Rock בסיסי.
6. Two Way Coordination בסיסי.
7. מעבר רבעים.
8. מעבר שמיניות.
9. מעבר שש-עשריות.
10. חיבור מקצב ומעבר.

# 18. דרישות ביצועים ונגישות
- תגובת UI ללחיצה בתוך פחות מ-16ms.
- אין React state חדש בכל Frame.
- שימוש ב-Refs עבור נתוני זמן.
- אנימציה באמצעות transform.
- Lazy Loading למסך.
- תפעול מלא במקלדת.
- Focus visible.
- אין שימוש בצבע בלבד.
- תמיכה ב-`prefers-reduced-motion`.
- כפתורי מגע בגודל 44x44 לפחות.

# 19. בדיקות
## Unit
- חישוב זמני אירועים.
- Hit Matching.
- Early/Late/Miss.
- Combo.
- Accuracy.
- Latency Offset.
- BPM conversion.

## Integration
- התחלת Session.
- Count-In.
- לחיצת מקלדת.
- HitResult.
- סיום ושמירה.

## E2E
1. בחירת תרגיל.
2. התחלת Count-In.
3. לחיצה לפי תווים.
4. הצגת משוב.
5. הצגת תוצאות.
6. שמירה ביומן.

# 20. קריטריוני קבלה ל-MVP
- בחירת תרגיל ו-BPM.
- Count-In.
- מטרונום יציב.
- Note Highway פעיל.
- מקלדת מפעילה כלי.
- Sample מתאים נשמע.
- כלי התופים מונפש.
- Perfect/Early/Late/Miss מוצגים.
- Combo ו-Accuracy מוצגים.
- סיכום נשמר ביומן.
- עובד ב-Chrome וב-Android Chrome.
- אין שימוש ב-`setInterval` כמנוע התזמון הראשי.

# 21. שלבי מימוש
1. Domain, Zod ו-Unit Tests.
2. Audio Engine ומטרונום.
3. Keyboard Input.
4. DrumKit SVG ו-Note Highway.
5. Exercise Runner ותוצאות.
6. אינטגרציה עם Journal ו-IndexedDB.
7. Latency Calibration.
8. QA, ביצועים ונגישות.

# 22. הוראות ל-Claude Code
1. קרא את כל המסמך.
2. ממש שלב אחד בלבד בכל פעם.
3. אל תשתמש ב-`any`.
4. אל תיגש ל-IndexedDB מתוך UI.
5. כתוב Tests לכל חוק עסקי.
6. השתמש ב-Web Audio API.
7. השתמש ב-`requestAnimationFrame`.
8. אל תשתמש ב-`setInterval` כמקור אמת.
9. אל תוסיף Backend.
10. שמור על RTL.
11. עדכן `implementation-status.md` לאחר כל שלב.

# 23. Prompt פתיחה ל-Claude Code
```text
קרא את VISUAL_DRUM_TRAINER_SPEC.md במלואו.

המטרה: לממש מודול Visual Drum Trainer בתוך DrumPath.

התחל בשלב 1 בלבד:
- Domain types
- Zod schemas
- Timing calculations
- Hit matching
- Scoring engine
- Unit tests

לפני כתיבת קוד:
1. סקור את מבנה הפרויקט.
2. ציין אילו קבצים תיצור ותשנה.
3. ציין הנחות או סתירות.
4. הצג תוכנית עבודה לפני מימוש.

דרישות:
- React + TypeScript strict.
- ללא any.
- ללא Backend.
- RTL.
- הפרדה בין Domain, Data, Features ו-UI.
- Unit Tests לכל חוק עסקי.
```

# 24. Definition of Done
- TypeScript ללא שגיאות.
- ESLint עובר.
- כל הבדיקות עוברות.
- אין שגיאות Console.
- עובד במחשב וב-Android Chrome.
- תוצאות נשמרות ביומן.
- Latency Calibration עובד.
- המטרונום נשאר יציב לאורך תרגול ממושך.
- README ו-implementation-status.md מעודכנים.
