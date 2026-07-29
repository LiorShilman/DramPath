# Implementation Status

Stages follow SPEC.md §35.

| # | שלב | תכולה | סטטוס |
| --- | --- | --- | --- |
| 0 | Bootstrap | Bootstrap, tooling, RTL, design tokens | ✅ הושלם |
| 1 | Data layer | Domain models, Zod, Dexie, repositories, Seed | ✅ הושלם |
| 2 | Product shell | Layout, router, dashboard, setup wizard | ✅ הושלם |
| 3 | Content mgmt | Course, weeks, lessons, exercises CRUD | ✅ הושלם |
| 4 | Practice core | Today planner + practice session | ✅ הושלם |
| 5 | Practice tools | Metronome + timer | ✅ הושלם |
| 6 | Progress tracking | Journal + analytics | ✅ הושלם |
| 7 | Library | Resources + songs | ✅ הושלם |
| 8 | Standalone | Backup/restore + PWA | ✅ הושלם |
| 9 | Release 1.0 | Tests, accessibility, performance, docs | ✅ הושלם |

## שלב 0 — פירוט

**תוצר:** אפליקציה ריקה תקינה.

- Vite + React 19 + TypeScript strict (`strict`, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`, `noFallthroughCasesInSwitch`).
- Tailwind CSS v4 מחוברת דרך `@tailwindcss/vite`.
- Design tokens לפי §31 ב-`src/styles/tokens.css` (כולל מצב `dark`).
- מעטפת RTL עברית: `index.html` עם `lang="he" dir="rtl"`, גופן Noto Sans Hebrew, מסך placeholder ב-`src/app/App.tsx`.
- מבנה תיקיות מלא לפי §22.4 מתחת ל-`src/` (features/domain/data/hooks/lib/styles/test).
- ESLint (flat config) + `@typescript-eslint/no-explicit-any: error` + `eslint-config-prettier`, ו-Prettier.
- Vitest + Testing Library + jsdom, עם smoke test ל-`App`.
- Scripts: `dev`, `build`, `preview`, `lint`, `format`, `typecheck`, `test`, `test:watch`.

**לא בתחום השלב:** Dexie, Zod, Zustand, React Router, React Hook Form, Recharts, date-fns, PWA plugin, וכל קוד domain/repository — אלו יתווספו החל משלב 1 ואילך.

## שלב 1 — פירוט

**תוצר:** שכבת נתונים מלאה, ללא UI.

- **Domain** (`src/domain/`): סכמות Zod + טיפוסים לכל 10 הישויות מ-§23 (CoursePlan, Week, Lesson, Exercise, Song, Resource, PracticeSession, PracticeEntry, UserSettings, Achievement), לפי השדות המדויקים מ-§14/§15/§18/§19/§20. אפס תלות ב-React או ב-Dexie.
- **DB** (`src/data/db/`): `DrumPathDatabase` (Dexie) עם `version(1).stores(...)` בדיוק לפי §23.1, וסינגלטון `db` מיוצא.
- **Repositories** (`src/data/repositories/`): שכבת ה-CRUD היחידה שנוגעת ב-Dexie (§22.5); כל כתיבה עוברת Zod validation (§22.3). `lessonRepository` שומר גם על טבלת ה-join `lessonExercises` מסונכרנת. `resourceRepository` מבצע דה-דופליקציה לפי SHA-256 checksum. `settingsRepository` מממש singleton עם ברירות מחדל.
- **Seed** (`src/data/seed/`): מסלול 12 שבועות + 30 שיעורי placeholder (לפי §9), 65 תרגילים לפי הכמויות ב-§24 (טכניקה/קואורדינציה/קריאה/מקצבים/מעברים/שילובים), 7 שירים (metadata בלבד, לפי §19). `runSeedIfNeeded()` הוא idempotent.
- **ADRs** (`docs/adr/0001`–`0005`): מתעדות החלטות לא-מפורטות בין §14/§18/§19 (טבלאות שדות) לבין §23.1 (סכמת Dexie המוצעת) — timestamps כ-ISO strings, נורמליזציה של PracticeEntry, מבנה יחסי Lesson↔Exercise, singleton של UserSettings, וחלוקת ה-Seed בין שבועות/קטגוריות מקובצים.
- **בדיקות:** 15 טסטים (Vitest + `fake-indexeddb`) — ולידציה לכל סכמה, פתיחת מסד ובדיקת stores, CRUD + סנכרון join table, שמירת/דה-דופליקציית Blob, וזריעה חד-פעמית.

**לא בתחום השלב:** קוד React שצורך את השכבה הזו, ראוטינג, ואלגוריתמים עסקיים (בחירת אימון יומי מ-§25, הצעת BPM מ-§13, חישובי mastery/streak מ-§21/§26) — אלו קשורים לשלבים 4 ו-6.

## שלב 2 — פירוט

**תוצר:** שלד מוצר מלא — ראוטינג לכל המסכים מ-§10, ושתי מסכים אמיתיים (דשבורד + אשף הפעלה).

- **Router** (`src/app/`): `react-router` v7 (`createBrowserRouter`), `routes.tsx` עם כל הנתיבים מ-§10 מקוננים תחת `AppLayout`. רק `/` ו-`/setup` מציגים מסך אמיתי; כל השאר `ComingSoonPage` (placeholder).
- **Layout** (`src/components/layout/`): `AppLayout` עם landmarks (`header`/`nav aria-label`/`main`), ניווט מלא ל-10 המסכים הראשיים מ-`NAV_ITEMS` (`src/app/nav-items.ts`), RTL ואייקוני `lucide-react`.
- **חישובי domain חדשים** (`src/domain/calculations/`): `calculateStreakDays`, `sumDurationSeconds`, `calculateWeekCompletion`, `getLatestCleanBpm` — פונקציות טהורות לפי הכללים המדויקים ב-§21/§13, עם unit tests. אלו ישמשו גם את שלב 6 (לא ישוכפלו).
- **דשבורד** (`src/features/dashboard/`): כל הכרטיסים מ-§11 (אימון הבא / שבוע נוכחי / רצף / זמן / תרגילים פעילים / הישג אחרון / תזכורת רכה), Empty State עם פעולה אחת כשאין CoursePlan, ולחיצה על "התחל אימון" יוצרת `PracticeSession` במצב `draft` (קריטריון קבלה מ-§11).
- **אשף הפעלה** (`src/features/setup/`): טעינת Seed דרך `runSeedIfNeeded()`, שדה יעד דקות שבועי שנשמר ב-`settingsRepository`, ניווט חזרה לדשבורד.
- **תוספות לשכבת הנתונים**: `UserSettings.weeklyGoalMinutes` (ברירת מחדל 150); תיקון ב-Seed כך ששבוע 1 נזרע כ-`active` (לא `locked`) כדי שלדשבורד יהיה שבוע נוכחי מיד לאחר ההפעלה.
- **בדיקות:** 17 טסטים חדשים (סה"כ 32) — 4 קבצי חישובים, Dashboard (Empty State / כרטיסים אחרי seed / יצירת Session), SetupWizard (seed + שמירת הגדרות), ו-App/router smoke test.
- **אימות ידני:** זרימה מלאה דרך Playwright מול שרת dev — `/setup` → זריעה → סיום → דשבורד עם נתונים אמיתיים (שבוע 1 פעיל, 0% הושלם, 0 ימי רצף, 0/150 דקות, 5 תרגילים, "עדיין אין הישגים"), ובדיקת `ComingSoonPage` ב-`/course`.

## שלב 3 — פירוט

**תוצר:** CRUD מלא למסלול/שבועות/שיעורים/תרגילים — `/course`, `/course/weeks/:weekId`, `/lessons`(+`:lessonId`), `/exercises`(+`:exerciseId`) הפכו ממסכי placeholder למסכים אמיתיים.

- **תלויות חדשות:** `react-hook-form` + `@hookform/resolvers` (טפסי עריכה עם ולידציית Zod ושגיאות לפי שדה, לפי §22.2/§32).
- **מסלול** (`src/features/course/`): `CoursePage` — רשימת 12 השבועות עם אחוז השלמה (שימוש חוזר ב-`calculateWeekCompletion` משלב 2) וסטטוס. `WeekDetailPage` — טופס autosave לשם/מוקד, ורשימת שיעורי השבוע.
- **הפעלת שבוע כפעולה מחושבת:** `weekRepository.activateWeek()` חדש — מבטיח שבוע `active` יחיד לקורס (שבועות מוקדמים יותר הופכים `completed`, מאוחרים יותר `locked`), עם בדיקה ייעודית.
- **שיעורים** (`src/features/lessons/`): `LessonsListPage` — סינון לפי שבוע/קטגוריה/סטטוס/תגית, חיפוש עם debounce, יצירה, שכפול, מחיקה עם אישור, סידור ידני ב-Drag & Drop (HTML5 native, פעיל רק כשאין סינון פעיל). `LessonDetailPage` — טופס autosave לכל שדות §14, ובחירת תרגילים מקושרים (checkbox list עם חיפוש) דרך `lessonRepository`.
- **תרגילים** (`src/features/exercises/`): `ExercisesListPage` — סינון לפי קטגוריה/רמת קושי/ארכיון, חיפוש, יצירה, שכפול, העברה לארכיון, מחיקה. `ExerciseDetailPage` — טופס autosave לכל שדות §15 (כולל אימות minBpm ≤ maxBpm), ורשימת היסטוריית תרגול לקריאה בלבד (`practiceEntryRepository.getByExerciseId`, שדה חדש).
- **תוספות לשכבת הנתונים:** `Lesson.tags` (היה חסר בשלב 1 אך נדרש לסינון לפי תגית ב-§14) — הוסף כשדה חובה, symmetric ל-`Exercise.tags`. `exerciseRepository.removeAndUnlink()` — מוחק תרגיל ומנקה את כל ה-`Lesson.exerciseIds`/`lessonExercises` שמצביעים אליו.
- **רכיבים משותפים:** `ConfirmDialog` (overlay נגיש ל-Escape/focus, לא `<dialog>`/`showModal` — jsdom לא תומך בכך), `useDebouncedCallback` (autosave).
- **בדיקות:** 16 טסטים חדשים (סה"כ 48) — `activateWeek`, `removeAndUnlink`, Course (2), Lessons (6), Exercises (6).
- **אימות ידני:** זרימה מלאה דרך Playwright — לאחר זריעה, `/course` מציג 12 שבועות עם ספירות שיעורים נכונות, `/course/weeks/:id` עורך ומעביר סטטוס, `/lessons` ו-`/exercises` מציגים את כל 30/65 הפריטים עם הטפסים המלאים.

**לא בתחום השלב:** העלאת/צירוף קבצים (שלב 7 — השדות קיימים אך אין UI), מטרונום (שלב 5), גרפים/אנליטיקס (שלב 6, מעבר לרשימת ההיסטוריה הפשוטה), ניהול CoursePlan מרובה (לא קיים נתיב לכך ב-§10), ספריית DnD חיצונית.

## שלב 4 — פירוט

**תוצר:** ליבת האימון — `/today` ו-`/practice/session` הפכו מ-placeholder לזרימה מלאה: תכנון יומי → אימון מודרך → סיכום.

- **הרחבת PracticeSession:** `plannedExerciseIds: string[]` ו-`currentExerciseIndex: number` — תור תרגילים בר-המשכה שנשמר ב-Dexie (לא ב-state של הראוטר), כדי לאפשר חזרה ל-session שלא הסתיים לאחר רענון (§17).
- **אלגוריתם תכנון יומי** (`src/domain/calculations/daily-plan.ts`): `buildDailyPlan()` מממש את כלל §25.2 (חימום טכניקה, תרגיל מוקד מהשבוע, תרגיל "דורש עבודה" אחרון, תרגיל הנאה/שיר), עם הגבלת זמן של +10% (§25.2 כלל 5). `getExercisesForWeek()` חולץ משימוש כפול (Dashboard משלב 2 + התכנון היומי) לפונקציה משותפת אחת.
- **אלגוריתם הצעת BPM** (`src/domain/calculations/bpm-suggestion.ts`): `suggestBpmChange()` מממש את §13 במדויק — 3 חזרות נקיות ברצף מציעות +5 BPM, 2 "דורש עבודה" ברצף מציעות ‑5 BPM, מוגבל ל-minBpm/maxBpm, ואינו משנה כלום ללא אישור מפורש (הבאנר דורש לחיצת "אישור").
- **האימון של היום** (`src/features/today/`): בונה/טוען תוכנית לפי duration preset (10/20/30/45 דק'), מציג BPM אחרון/יעד לכל תרגיל, מאפשר הסרה/הוספה/סידור מחדש (Drag & Drop), autosave לתוכנית, ומעבר ל-`/practice/session`.
- **מצב אימון** (`src/features/practice-session/`): טיימר סטופר פשוט (setInterval, לא Web Audio — זה שלב 5), שדה BPM עם +/-, כפתורי "בוצע נקי"/"דורש עבודה"/"דילוג" שיוצרים `PracticeEntry` ומעדכנים streak בתוך ה-session, באנר הצעת BPM, מעבר לתרגיל הבא, וסיכום אימון בסיום (זמן כולל, ספירת תוצאות) שמעדכן את ה-Session ל-`completed`.
- **בדיקות:** 12 טסטים חדשים (סה"כ 68) — `getExercisesForWeek`, `buildDailyPlan` (5 תרחישים), `suggestBpmChange` (6 תרחישים), TodayPage (5), PracticeSessionPage (2, כולל זרימה מלאה עם הצעת BPM וסיום session).
- **אימות ידני:** זרימה מלאה דרך Playwright — דשבורד "התחל אימון" → `/today` עם תוכנית אמיתית → הסרת פריט → התחלה → `/practice/session` → 3 סימוני "בוצע נקי" מציגים הצעת BPM → אישור → סיום אימון → סיכום → חזרה לדשבורד, שם ה-BPM הנוכחי של התרגיל מתעדכן בפועל מהנתונים שנרשמו.

**לא בתחום השלב:** מנוע מטרונום ב-Web Audio, Tap Tempo, subdivisions, Count-in, וכללי ה-persistence המלאים של §17 (שמירה כל 10 שניות, סף חוסר פעילות) — כולם שלב 5. אין תצוגת PDF/משאבים (שלב 7). אין חישוב mastery חוצה-sessions או גרפים (שלב 6). אין מסך נעילה למניעת לחיצות מקריות (אופציונלי, נדחה).

## שלב 5 — פירוט

**תוצר:** כלי האימון האמיתיים — מטרונום Web Audio מלא, ו-`/practice/session` עם persistence מלא לפי §17. `/settings` הפך ממסך placeholder למסך אמיתי (חלק המטרונום שלו).

- **מתמטיקה טהורה** (`src/lib/metronome-math.ts`): `subdivisionIntervalSeconds`, `calculateTapTempoBpm` (ממוצע עד 4 המרווחים בין 5 ההקשות האחרונות, לפי §16, עם התעלמות מהפסקות ארוכות), `clampBpm`. נבדק ב-unit tests מלאים.
- **מנוע השמעה** (`src/lib/metronome-engine.ts`): `MetronomeEngine` עם AudioContext scheduler בעל lookahead (לא setInterval גולמי לשמע — דרישת האיכות המפורשת ב-§16), קליקים מסונתזים (OscillatorNode, ללא קובץ אודיו), הדגשת פעימה ראשונה בצליל שונה, Count-in של 0-2 תיבות ב-4/4. לא ניתן ל-unit test (jsdom חסר Web Audio, אומת ידנית מול דפדפן אמיתי).
- **שילוב במצב אימון** (`src/features/practice-session/`): `useMetronome` (עטיפת React ל-Engine, יוצר AudioContext רק בלחיצת משתמש), בקרות חלוקה/הדגשה/Count-in/Tap Tempo, מחוון פעימה חזותי, ורישום ה-subdivision שנבחר על כל `PracticeEntry` ("הגדרות אחרונות לכל תרגיל" ב-§16 נגזר מההיסטוריה, באותה שיטה כמו BPM אחרון).
- **§17 בפועל:** `useInactivityPause` משהה את הטיימר אוטומטית לאחר חוסר פעילות (`UserSettings.inactivityTimeoutSeconds`), checkpoint כל 10 שניות ל-`actualDurationSeconds`, ושמירה נוספת ב-unmount/ניווט. שגיאות checkpoint (למשל session שנמחק) נבלעות בשקט — זו שמירת best-effort, לא פעולה קריטית.
- **הגדרות** (`src/features/settings/`): טופס autosave לברירות מחדל של המטרונום ול-bpmStep, עם `defaultValues` א-סינכרוני של react-hook-form (במקום load-then-reset() באפקט) כדי למנוע מירוץ שבו טעינה מאוחרת דורסת עריכה שכבר בוצעה. חלקי גיבוי/ערכת נושא מוצגים כ"בקרוב" בלבד.
- **בדיקות:** 16 טסטים חדשים (סה"כ 84) — `metronome-math` (9), `useInactivityPause` (3, עם fake timers), PracticeSessionPage מורחב (2 נוספים: subdivision נרשם, הפעלה/עצירה של המטרונום עם AudioContext מדומה), SettingsPage (2).
- **אימות ידני:** זרימה מלאה דרך Playwright מול דפדפן אמיתי — הפעלת מטרונום ומעקב אחר מחוון הפעימה, Tap Tempo שמעדכן BPM בפועל, שינוי חלוקה, סיום אימון, ועריכת הגדרות שנשמרת גם אחרי רענון דף — ללא אף שגיאת קונסולה.

**לא בתחום השלב:** משקלי זמן 3/4 ו-6/8 (נדחה גם ב-§16 עצמו). מסך גיבוי/ייצוא (שלב 8). Toggle ערכת נושא. MIDI או הקלטת אודיו. שינויים באלגוריתמי התכנון היומי/הצעת BPM משלב 4 מעבר לרישום subdivision.

## שלב 6 — פירוט

**תוצר:** מעקב התקדמות אמיתי — `/journal` ו-`/analytics` הפכו ממסכי placeholder למסכים אמיתיים, ומערכת ההישגים (קיימת מאז שלב 1, אך ריקה עד עכשיו) מתחילה לפעול בפועל.

- **חישובי domain חדשים** (`src/domain/calculations/`): `calculateExerciseMastery` (מצבי §26 — new/learning/stable/mastered, מחושב מכלל ה"השלמה מהירה" של §13: 3 חזרות נקיות באותו BPM בשני sessions נפרדים), `getPersonalBestBpm` (השיא ההיסטורי, בשונה מ-`getLatestCleanBpm` שהוא האחרון), `sumDurationSecondsByCategory`, `getExercisesNotPracticedRecently`, ו-`detectAchievements` (פונקציה טהורה שמזהה הישגי רצף ושיאי BPM חדשים, עם דה-דופליקציה מול הישגים קיימים).
- **תלות חדשה:** `recharts` (לפי §22.2), לגרפי העמודות/קו.
- **חיווט הישגים בנקודות השלמה קיימות:** סיום אימון (`PracticeSessionPage`), סימון שיעור כ"הושלם" (`LessonDetailPage`), וסימון שבוע כ"הושלם" (`WeekDetailPage`) — כולם יוצרים כעת רשומות `Achievement` אמיתיות.
- **יומן אימונים** (`src/features/journal/`): רשימה מקובצת לפי יום/שבוע/חודש (`groupSessionsByPeriod` — לפי זמן קלנדרי מקומי, לא UTC, כדי שאימון בשעת ערב לא "יגלוש" ליום הבא), עם sub-total לכל קבוצה, הרחבה לפרטי האימון, עריכת הערה/תחושה עם autosave, ומחיקה (כולל הרשומות) עם אישור.
- **ניתוח התקדמות** (`src/features/analytics/`): גרף עמודות לזמן אימון שבועי, גרף קו להתקדמות BPM לפי תרגיל נבחר (עם תג mastery לכל תרגיל ברשימת הבחירה), פילוח זמן לפי קטגוריה, כרטיסי סיכום (רצף/זמן כולל/אימונים שהושלמו), רשימת תרגילים שלא תורגלו לאחרונה, ורשימת הישגים.
- **תוספת לרפוזיטורי:** `practiceSessionRepository.removeWithEntries()` — מוחק session ואת כל ה-`PracticeEntry` שלו יחד.
- **בדיקות:** 34 טסטים חדשים (סה"כ 118) — 5 קבצי חישובים חדשים, `group-sessions` (3), JournalPage (5), AnalyticsPage (4), והרחבות ל-PracticeSessionPage/LessonDetailPage/WeekDetailPage שמוודאות יצירת הישגים.
- **אימות ידני:** זרימה מלאה דרך Playwright — השלמת אימון עם 2 חזרות נקיות יצרה שני שיאי BPM חדשים שהופיעו במסך הסיכום, ב-`/journal` (מקובץ ועם פירוט), ב-`/analytics` (ברשימת ההישגים), **וגם** בכרטיס "הישג אחרון" בדשבורד — שהציג "עדיין אין הישגים" ללא שינוי מאז שלב 2.

**לא בתחום השלב:** לוח שנה גרפי (רשימה מקובצת במקום, ראו scope decision), צירוף קבצים/PDF ליומן (שלב 7), גיבוי/PWA (שלב 8), הישגים נוספים מעבר לרצף/שיא BPM/השלמת שיעור/השלמת שבוע.

## שלב 7 — פירוט

**תוצר:** ספרייה מלאה — `/library` ו-`/songs`(+`:songId`) הפכו ממסכי placeholder למסכים אמיתיים, וכל 15 הנתיבים מ-§10 מיושמים כעת (אין יותר `ComingSoonPage` בראוטר — הקומפוננטה הוסרה כי אינה נדרשת עוד).

- **ספריית קבצים** (`src/features/library/`): העלאת PDF/PNG/JPG עם ולידציה מול MIME types מותרים וגודל קובץ (`UserSettings.maxResourceFileSizeMB`), תצוגה מקדימה לתמונות ואייקון כללי ל-PDF (`useObjectUrl` חדש — Blob URL שנוצר לפי דרישה ומושמד ב-unmount/החלפת blob, לפי §29), עריכת תגיות עם autosave, ו"פתח קובץ" בלשונית חדשה. הודעת הבהרת זכויות (§20) מוצגת גם באשף ההפעלה וגם במסך עצמו.
- **ספריית שירים** (`src/features/songs/`): אותו דפוס list+detail כמו שיעורים/תרגילים משלב 3 — סינון לפי סטטוס, חיפוש, יצירה/מחיקה, וטופס עריכה עם autosave לכל שדות §19 (כולל רשימת קטעים דינמית להוספה/הסרה, ובחירת תרגילים קשורים).
- **חיווט שדות שנותרו מרותקים משלב 3:** `LessonDetailPage` קיבל בורר קבצים מרובה (כמו בורר התרגילים), ו-`ExerciseDetailPage` קיבל בורר יחיד לשדה "קובץ תווים" (`notationResourceId`).
- **תוספות לרפוזיטורי:** `resourceRepository.removeAndUnlink()` (מנקה `Lesson.resourceIds`/`Exercise.notationResourceId`) ו-`updateTags()` (עדכון חלקי — לא מבצע re-validation מלא על שדה ה-blob שלא השתנה, כדי לעקוף את מגבלת ה-Blob הידועה של fake-indexeddb/jsdom). תוקן גם באג ב-`exerciseRepository.removeAndUnlink()` שלא ניקה `Song.exerciseIds` בעת מחיקת תרגיל.
- **בדיקות:** 25 טסטים חדשים (סה"כ 137) — repositories (5), `useObjectUrl` (3), LibraryPage (5), Songs (6), והרחבות ל-LessonDetailPage/ExerciseDetailPage שמוודאות שיוך קבצים.
- **אימות ידני:** זרימה מלאה דרך Playwright — הודעת הזכויות מוצגת באשף ההפעלה, העלאת PNG ו-PDF ל-`/library` עם תצוגה נכונה (תמונה מוקטנת מול אייקון), ו-`/songs` מציג את כל 7 השירים הראשוניים עם טופס עריכה מלא (כולל הוספת קטע ושיוך תרגיל).

**לא בתחום השלב:** גיבוי/ייצוא של קובצי ה-Blob (שלב 8 — §20 מציין שהייצוא חלק מחבילת הגיבוי). תצוגת PDF מוטמעת (קישור "פתח קובץ" בלבד). גרסאות/החלפת קובץ במקום.

## שלב 8 — פירוט

**תוצר:** האפליקציה הופכת ל"מוצר עצמאי" לפי §35 — גיבוי/ייצוא/ייבוא מלא (§27) והתקנה כ-PWA עובד אופליין (§28). מסך "גיבוי ושחזור" ב-`/settings`, שהציג "בקרוב" מאז שלב 5, הפך למסך אמיתי.

- **תלויות חדשות:** `jszip` (יצירת/פענוח ארכיוני ZIP — §27 דורש `manifest.json`+`data.json`+תיקיית `resources/`, ואין דבר כזה בשאר המחסנית). `vite-plugin-pwa` (כבר מתוכנן ב-§22.2).
- **ליבת הגיבוי** (`src/lib/backup/`):
  - `types.ts` — `BACKUP_SCHEMA_VERSION`, `BackupManifest` (עם checksums ל-`data.json` ולכל משאב), `BackupData`, ו-`stripBlob()` המשותף להסרת שדה ה-Blob לפני כתיבה ל-JSON.
  - `export-backup.ts` — `buildBackupArchive()` קורא את כל 10 הטבלאות, מחשב SHA-256 (שימוש חוזר ב-`sha256Hex` משלב 1) לכל משאב ול-`data.json` עצמו, ובונה ZIP עם JSZip.
  - `import-backup.ts` — `parseBackupArchive()` (פענוח + דחיית גרסת סכמה לא נתמכת), `validateBackupData()` (ולידציית Zod מלאה + אימות checksum מחדש לכל משאב — תופס גם ארכיון פגום, לא רק JSON שגוי), `previewImport()` (ספירות new/updated/unchanged למסך התצוגה המקדימה לפני ייבוא), `commitImport()` — כתיבה אטומית יחידה בתוך `db.transaction('rw', [...כל הטבלאות], ...)`; כשלון כלשהו באמצע גורר rollback אוטומטי של Dexie, ללא קוד undo ידני.
  - `journal-csv.ts` — `buildJournalCsv()`, שורה אחת לכל `PracticeEntry` עם escaping תקין לפסיקים/מרכאות.
- **החלטת scope — ללא מסך diff לכל רשומה:** פתרון קונפליקטים ב-merge הוא אוטומטי לפי `updatedAt` (§27), עם מסך תצוגה מקדימה שמציג ספירות לכל סוג ישות לפני האישור — לא UI השוואה בין רשומה לרשומה.
- **UI גיבוי** (`src/features/settings/BackupSection.tsx`): כפתור ייצוא (מוריד ZIP + מחתים `UserSettings.lastBackupExportAt`), בחירת קובץ לייבוא עם מצב Replace/Merge, תצוגה מקדימה, אישור/ביטול, והודעות שגיאה ברורות (checksum פגום / גרסת סכמה לא נתמכת / JSON שגוי). אישור ייבוא מרענן את הדף כדי להבטיח שכל מסך ישקף את הנתונים החדשים.
- **ייצוא CSV ביומן:** כפתור "ייצוא CSV" ב-`/journal` (§27 לא קבע מיקום; זה המסך שבו הנתונים כבר נצפים), עם BOM כדי ש-Excel יפתח עברית כ-UTF-8.
- **תזכורת גיבוי (§29):** `UserSettings.lastBackupExportAt` (שדה חדש) מניע באנר בדשבורד אחרי 14 יום ללא ייצוא — לפני ייצוא ראשון, השעון מתחיל מ-`CoursePlan.createdAt` כדי שהתקנה חדשה לא תציק ביום הראשון.
- **קישור וידאו חיצוני (§28):** `LessonDetailPage` מציג כעת קישור אמיתי (`target="_blank" rel="noopener noreferrer"`) עם הערת "דורש חיבור לאינטרנט" כשיש `externalVideoUrl` — סגירת פער אמיתי (הייתה רק שדה טופס ללא קישור מוצג).
- **PWA:** `vite-plugin-pwa` ב-`vite.config.ts` עם `registerType: 'prompt'` (§28 — עדכון הוא הצעה הניתנת לדחייה, לעולם לא מוחל אוטומטית באמצע אימון), manifest עם אייקון ה-`favicon.svg` הקיים (אין כלי ליצירת PNG בגדלים 192/512 — כרום ו-Safari מקבלים SVG כאייקון manifest). `PwaUpdateBanner` (`src/app/`) עוטף את `useRegisterSW` מ-`virtual:pwa-register/react`, מותקן ב-`AppLayout`, ומציג באנר לרענון בלבד עם דחייה אפשרית.
- **בדיקות:** 15 טסטים חדשים (סה"כ 152) — `backup.test.ts` (5: round-trip ייצוא/ייבוא, דחיית ארכיון פגום, דחיית גרסת סכמה, דחיית checksum מזויף, פתרון קונפליקט merge), `journal-csv.test.ts` (3), `BackupSection.test.tsx` (5), הרחבות ל-JournalPage/Dashboard/LessonDetailPage שמוודאות את כפתור ה-CSV, באנר התזכורת, והקישור החיצוני.
- **אימות ידני:** `vite build && vite preview` (שירות עובד רק מול build אמיתי, לא dev server) + סקריפט Playwright — service worker נרשם ומגיע ל-`activated`, `manifest.webmanifest` מוגש עם התוכן הנכון, והאפליקציה ממשיכה לעבוד (כותרת "DrumPath" מוצגת) גם אחרי רענון עם הרשת מנותקת.

**לא בתחום השלב:** UI השוואה אינטראקטיבי לכל רשומה בקונפליקט מיזוג (ראו scope decision למעלה). אייקוני PWA רסטריים חדשים (SVG קיים נשאר). שינויים בחישובי domain או בזרימת האימון. סנכרון מרובה-מכשירים (נדחה ל-post-MVP לפי §9/§40).

## שלב 9 — פירוט

**תוצר:** Release 1.0 — חיזוק (לא תכונות חדשות) לפי §30 (נגישות), §33 (ביצועים), §34 (בדיקות) ותיעוד. שלבים 0–8 סיפקו את כל התכולה הפונקציונלית; שלב זה מוודא שהיא עומדת ברף האיכות של גרסת Release.

- **נגישות (§30):** ל-Tap Tempo (טקסט עברי "הקשה לקצב" במקום אנגלית — תיקן גם אי-עמידה ב-§36 "טקסט עברי בכל מסך"), למתג המטרונום, ולכפתור השהיה/המשך טיימר יש כעת `aria-label` מפורש. כפתורי הפעולה העיקריים במצב אימון (תוצאות, מטרונום, טיימר, מעבר לתרגיל הבא) מבטיחים גובה מגע של 44 פיקסלים לפחות (`min-h-11`). התווסף כלל `:focus-visible` גלובלי (`src/index.css`) כך שפוקוס מקלדת מסומן תמיד בבירור ללא תלות ברקע הכפתור הספציפי, וכלל `@media (prefers-reduced-motion: reduce)` גלובלי. היררכיית הכותרות ו-landmarks נבדקו ונמצאו תקינים כבר מהשלבים הקודמים (H1 יחיד ב-`AppLayout`, H2/H3 עקביים בכל מסך) — לא נדרש שינוי.
- **תיקון ניגודיות אמיתי שנמצא תוך כדי (`color-scheme`):** תפריטי `<select>` מקוריים הוצגו עם רקע בהיר קבוע של הדפדפן בעוד הטקסט בערכת הנושא הכהה כמעט לבן — כמעט בלתי קריא. תוקן ע"י `color-scheme: light`/`dark` ב-`tokens.css`, כך שהדפדפן מתאים את פקדי הטופס המקוריים (רקע/טקסט) לערכת הנושא בפועל.
- **ביצועים (§33):** כל 16 מסכי ה-Route טוענים כעת עצלנית (`React.lazy`, מוגדרים ב-`src/app/lazy-pages.tsx` — קובץ נפרד מ-`routes.tsx` כדי לעמוד בכלל ESLint `react-refresh/only-export-components`, שדורש שקובץ שמייצא רכיבים לא יערבב ייצוא לא-רכיב כמו מערך ה-`routes`). `AppLayout` עוטף את ה-`<Outlet>` ב-`<Suspense>` עם מסך "טוען…" אחיד. חיפוש עם debounce וסלקטורים memoized לגרפים כבר היו מיושמים משלבים קודמים — לא נדרש שינוי.
- **בדיקות (§34):** נוסף `coverage` block ל-Vitest (`vite.config.ts`, ממוקד ל-`src/domain/**`, סף 80% לכל המדדים) וסקריפט `npm run test:coverage`. כיסוי בפועל: כ-99% statements, 92% branches — הרבה מעל הסף. נוספו 3 טסטים ממוקדים לכיסוי ענפים אמיתיים שלא היו מכוסים (לא ריפוד): fallback לחימום מהספרייה הכללית כשלשבוע הנוכחי אין תרגיל טכניקה (`daily-plan.test.ts`), בחירת רשומת "דורש עבודה" האחרונה מבין כמה רשומות (`daily-plan.test.ts`), ושמירה על הרשומה העדכנית ביותר כשרשומות לאותו תרגיל מגיעות שלא לפי סדר כרונולוגי (`stale-exercises.test.ts`) — סה"כ 155 טסטים (היו 152).
- **תיעוד:** `README.md` נכתב מחדש במלואו (סטטוס עדכני, מחסנית טכנולוגית אמיתית, יכולות עיקריות). `CHANGELOG.md` חדש — ערך `[1.0.0]` יחיד מקובץ לפי תחום. `docs/backup-guide.md` חדש — מדריך למשתמש לגיבוי/שחזור/CSV. `package.json` עודכן לגרסה `1.0.0`.
- **ניקיון פרויקט:** תיקיית `coverage/` (פלט גנרטיבי) נוספה ל-`.gitignore` ול-`globalIgnores` של ESLint.

**לא בתחום השלב (scope decisions):** אין וירטואליזציה לרשימות (react-window וכדומה) — אפליקציית משתמש-יחיד מקומית שבה נפחי הנתונים האמיתיים רחוקים מ-200 פריטים; תלות/מורכבות לא מוצדקת לסף שלא יגיע בפועל. אין טסט מיגרציית Dexie — עדיין אין מיגרציה (הסכמה בגרסה 1 בלבד). אין Error Boundaries או מערכת Toast (§32) — סעיף ספק נפרד שלא מופיע בתכולת שלב 9 המוגדרת. Lighthouse הורץ ידנית מול build אמיתי (ראו אימות).

**אימות ידני:** `npm run typecheck`/`lint`/`test`/`test:coverage`/`build` נקיים. `vite build && vite preview` — כל המסכים נבדקו דרך Playwright ועובדים תקין עם ה-routing העצלני (ללא שגיאות קונסולה), כולל אימות מחדש של פוקוס מקלדת גלוי (`outline: 2px solid`) ושל התנהגות אופליין (Service Worker מגיע ל-`activated`, האפליקציה טוענת עם רשת מנותקת). `npx lighthouse` הורץ בפועל מול שרת ה-preview: **Performance 90** (יעד §34.4: מעל 85 ✓), **Accessibility 94** (יעד: מעל 95 — כמעט, לא הושלם במלואו בשלב זה). הבדיקה חשפה כשל ניגודיות אמיתי אחד: כותרת "DrumPath" ב-`AppLayout` (`--color-primary` על `--color-bg` הכהה) יוצרת יחס ניגודיות 3.09:1 בלבד, מתחת לסף ה-AA (4.5:1) — אותר במדויק ותוקן במעבר העיצוב שתועד מיד לאחר מכן.

## מעבר עיצוב (לאחר שלב 9)

**תוצר:** מעבר עיצוב מקיף על פני כל האפליקציה, לפי בקשה מפורשת של המשתמש לאחר סקירת ה-UI בפועל (שהיה מינימלי בכוונה לאורך כל שלבי הבנייה). לא שונה קוד עסקי, ניתוב או התנהגות — שכבת עיצוב בלבד מעל מה שכבר נבנה ואומת.

- **תיקון ניגודיות (§30, המשך משלב 9):** נוספו טוקנים ייעודיים לטקסט/גבולות (`--color-primary-text`, `--color-success-text`, `--color-warning-text`, `--color-danger-text`) הנפרדים מטוקני ה-fill (רקעי כפתורים) — כי אותו גוון לא יכול לשרת גם טקסט על רקע כהה כמעט-שחור וגם טקסט לבן על הרקע שלו עצמו בו-זמנית. הערכים חושבו ונבדקו ידנית מול נוסחת הניגודיות של WCAG (לא רק ניחוש), ולאחר מכן אומתו סופית מול Lighthouse.
- **מערכת עיצוב משותפת חדשה** (`src/components/ui/`): `Card`, `Button` (עם וריאנטים `primary`/`secondary`/`ghost`/`success`/`warning`/`danger`/`danger-outline` וגדלים כולל `lg`=44px), `Badge`, `StatTile`, `PageHeader` — הוחלפו כל מחרוזות ה-className שחזרו על עצמן בעשרות מסכים בקוד עסקי-בלבד שחוזר על עצמו, כדי שהעיצוב יהיה עקבי באמת ולא "מתכנס" ידנית בכל מסך בנפרד.
- **ניווט:** הוחלפה שורת הניווט האחת שנשברה לשתי שורות (10 פריטים) ב-`Sidebar` (עמודה אנכית, למסכים רחבים) ו-`BottomTabBar` (5 פריטים עיקריים + תפריט "עוד" לשאר, למובייל) — שני רכיבים חדשים תחת `src/components/layout/`.
- **Dashboard** קיבל את תשומת הלב הרבה ביותר כמסך הראשון שרואים: `StatTile` לכל אחד מ-3 הנתונים המרכזיים, כרטיס hero לאימון הבא, כרטיסי תזכורת עם border מודגש.
- **`color-scheme` (מ-שלב 9):** יחד עם התיקון הנוכחי, פתר גם את הבעיה שדיווח עליה המשתמש ישירות — תפריטי `<select>` פתוחים היו כמעט בלתי קריאים (טקסט בהיר על רקע לבן קבוע) לפני התיקון.
- **בדיקות:** כל 155 הטסטים הקיימים ממשיכים לעבור ללא שינוי (הם בודקים טקסט/role/label, לא classNames) — לא נדרשו טסטים חדשים מעבר לכך.

**אימות ידני:** צילומי מסך דרך Playwright בכל שילוב של ערכת נושא (בהיר/כהה) ורוחב מסך (דסקטופ/מובייל) על כל אחד מהמסכים המרכזיים. `npx lighthouse` הורץ שוב מול build אמיתי: **Accessibility עלה מ-94 ל-100**, **Performance נשאר 90**.
