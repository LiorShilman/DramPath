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
- **תפריטי `<select>` פתוחים (דווח ישירות ע"י המשתמש עם צילום מסך):** `color-scheme: dark` (משלב 9) התברר כלא מספיק בפועל — Chromium לא עקבי בהחלת הטוקן הזה על ה-popup הילידי של `<select>`. תוקן סופית ע"י קביעת `background-color`/`color` מפורשים על `select, option` ישירות ב-`src/index.css`, ואומת ידנית מול תרשים DOM אמיתי (לא רק חישוב ניגודיות תיאורטי) לפני שדווח כפתור.
- **בדיקות:** כל 155 הטסטים הקיימים ממשיכים לעבור ללא שינוי (הם בודקים טקסט/role/label, לא classNames) — לא נדרשו טסטים חדשים מעבר לכך.

**אימות ידני:** צילומי מסך דרך Playwright בכל שילוב של ערכת נושא (בהיר/כהה) ורוחב מסך (דסקטופ/מובייל) על כל אחד מהמסכים המרכזיים. `npx lighthouse` הורץ שוב מול build אמיתי: **Accessibility עלה מ-94 ל-100**, **Performance נשאר 90**.

## שינויים לאחר גרסה 1.0.0

- **ספריית קבצים: בחירה מרובה** — `<input type="file">` תמך רק בקובץ בודד (מגבלה מקרית מהמימוש בשלב 7, לא החלטה מכוונת). נוסף `multiple`, ו-`handleFileSelected` מטפל בכל קובץ בנפרד כך שכשל בקובץ אחד (סוג/גודל) לא חוסם את שאר האצווה.
- **ספריית קבצים: כל סוג קובץ (סטייה מכוונת מ-§20 של האפיון)** — §20 המקורי הגביל ל-PDF/PNG/JPG בלבד. המשתמש ביקש לינק לקבצים מקומיים ללא הגבלת סוג; **בדקתי והסברתי שהאפשרות ה"אמיתית" (File System Access API) קיימת רק ב-Chromium שולחני, לא עובדת במובייל, ודורשת אישור מחדש תקופתי + לא שורדת גיבוי/שחזור למכשיר אחר**. המשתמש בחר בחלופה השנייה: הרחבת סוגי הקבצים המותרים תוך שמירה על אחסון Blob מקומי מלא ב-IndexedDB (כמו היום) — כך שהתכונה ממשיכה לעבוד בכל דפדפן/מכשיר ולשרוד גיבוי/שחזור. `ALLOWED_MIME_TYPES` ואימות הסוג הוסרו לגמרי מ-`LibraryPage.tsx`; `resourceSchema.mimeType` כבר היה `z.string()` חופשי ללא הגבלה, כך שלא נדרש שינוי בשכבת הדומיין.
- **בדיקות:** נוסף טסט לבחירה מרובה (`uploads multiple files selected together`), והטסט הישן `rejects a disallowed file type` הוחלף ב-`accepts any file type, not just PDF/PNG/JPG`. סה"כ 156 טסטים.

- **תיקון UX + באג אמיתי בסימון קבצים מצורפים לשיעור:** אחרי הוספת יכולת קישור הווידאו, המשתמש דיווח שוב ושוב ש"אין אפשרות לבחור קישור" — שרשרת דיבוג ארוכה גילתה **שלוש** בעיות אמיתיות ונפרדות שהצטברו זו על זו:
  1. **checkbox כמעט בלתי נראה בערכת נושא כהה** (`src/index.css`) — אותה משפחת באג בדיוק כמו ה-`<select>` משלב 9; `accent-color` וגודל מפורש נוספו ל-`input[type=checkbox]`/`input[type=radio]` גלובלית. אומת חזותית לפני ואחרי.
  2. **בלבול UX אמיתי**: קישור "+ הוספת קובץ/קישור בספרייה" שנוסף במסך השיעור לקח לדף אחר (`/library`) שאין בו שום פעולת "שייך לשיעור" — המשתמש חשב שזו הדרך לבחור. הוחלף בטקסט הסבר ברור: "סמנו למטה כדי לצרף קובץ קיים... אם הקובץ עדיין לא קיים — העלו/קשרו קודם, ואז חזרו לכאן."
  3. **הבאג האמיתי שחסם בפועל**: `ZodError` על `tags` (`expected array, received undefined`) בזמן `lessonRepository.patch()`, שנתפס ישירות מ-console.error שהמשתמש שלח. `Lesson.tags` נוסף כשדה חובה בשלב 3 (ADR 0001-era) — רשומות שנוצרו/נזרעו לפני התוספת נשארו תקפות-למראית-עין ב-IndexedDB (Zod מאמת בכתיבה בלבד, לא בקריאה) עד ש-`patch()`'s read-merge-revalidate-write ניסה לשמור מחדש את האובייקט המלא וקרס.
- **מיגרציית Dexie ראשונה (`src/data/db/database.ts`):** `version(2)` חדש עם `.upgrade()` שמשלים `tags: []` בכל רשומת lessons/exercises שחסר לה השדה — רץ אוטומטית בפתיחת ה-DB הבאה, בלי צורך בפעולה ידנית מהמשתמש. זו המיגרציה הממשית הראשונה בפרויקט (עד כה היה רק `version(1)`, ולכן גם הוחזר טסט מיגרציה שהיה מסומן "לא רלוונטי עדיין" בשלב 9). נבדק ב-`database.test.ts` עם רשומה שנכתבה דרך אינסטנס Dexie גולמי (עוקף Zod לגמרי) כדי לשחזר במדויק את מצב הדאטה האמיתי שנמצא.

- **ספריית קבצים: קישור סרטונים גדולים ללא העתקה (File System Access API)** — המשך ישיר לנקודה הקודמת: המשתמש חזר עם צורך אמיתי בקבצי וידאו של 200-300MB, שם הרחבת סוג הקובץ בלבד לא מספיקה — העתקה של קבצים כאלה ל-IndexedDB מסוכנת (סיכון פינוי אחסון אמיתי בדפדפן, בלי אזהרה) ומנפחת את קובצי הגיבוי. **הוסבר למשתמש בפירוט הפער האמיתי בין שתי חלופות (הרחבת מגבלת גודל בהגדרות, מול File System Access API), כולל שהאפשרות השנייה עובדת רק ב-Chrome/Edge שולחני**. המשתמש אישר שהוא צופה בסרטונים רק מאותו מחשב, ובחר: **PDF/תמונות ממשיכים בהעלאה כרגיל; רק וידאו מקבל אפשרות קישור**.
  - **דומיין** (`src/domain/resource.ts`): נוסף `sourceType: 'blob' | 'link'` (ברירת מחדל `'blob'`, כך שרשומות קיימות ללא השדה עדיין תקפות). `blob`/`checksum` הפכו לאופציונליים; נוסף `fileHandle` אופציונלי, מאומת ב-duck-typing (`'getFile' in value`) ולא ב-`instanceof FileSystemFileHandle` — המחלקה הזו לא קיימת בסביבת הטסטים (Node/jsdom). שתי `.refine()` מוודאות שבדיוק אחד מ-blob/fileHandle קיים בהתאם ל-sourceType. `resourceObjectSchema` יוצא בנפרד מ-`resourceSchema` (שעטוף כעת ב-`.refine`, ולכן איבד את `.shape`) כדי ש-`resourceRepository.updateTags()` ימשיך לעבוד.
  - **טיפוסים חדשים:** הותקן `@types/wicg-file-system-access` (dev-only) — DOM lib המובנה של TypeScript לא כולל את ה-methods החדשים יותר של ה-API (`showOpenFilePicker`, `queryPermission`, `requestPermission`). נוסף ל-`tsconfig.app.json`'s `types` array (חובה כי יש שם מערך מפורש, שמבטל הכללה אוטומטית של חבילות `@types/*`).
  - **`src/lib/file-system-access.ts`** (חדש): `isFileSystemAccessSupported()` (feature-detection, לא זיהוי דפדפן), `pickVideoFile()`, `ensureReadPermission()` — האחרון **חייב** להיקרא מתוך user gesture (קליק), אחרת הדפדפן דוחה את הבקשה.
  - **`resourceRepository.saveLink()`** — ללא checksum/dedup (חישוב SHA-256 על קובץ של 300MB רק לצורך דה-דופליקציה לא שווה את העלות).
  - **`LibraryPage.tsx`:** כפתור "🔗 קשר סרטון" מוצג רק כש-`isFileSystemAccessSupported()` (נעלם לגמרי ב-Firefox/Safari/מובייל, לא מציג שגיאה). `ResourceCard` מתפצל לפי `sourceType` — משאב מקושר לא נוגע ב-handle בזמן render (אסור/מסוכן ללא gesture), רק בלחיצה על "פתח קובץ": בדיקת/בקשת הרשאה → `getFile()` → object URL זמני שנפתח בטאב חדש. תג "🔗 מקושר" מבדיל חזותית. אישור מחיקה למשאב מקושר מנוסח מפורשות: מוסר רק את ההפניה, לא מוחק את הקובץ במחשב.
  - **גיבוי (Stage 8):** משאבים מקושרים **מוחרגים מהגיבוי לגמרי** — לא רק ה-blob, גם לא metadata placeholder. `stripBlob` (ב-`src/lib/backup/types.ts`) מוחק גם `fileHandle`; `export-backup.ts` מסנן `sourceType !== 'link'` לפני בניית `resources` ב-`data.json`, לפני מפת ה-checksums, ולפני כתיבת קבצי `resources/<id>` ל-ZIP. הוחלט לא לשמור אפילו "עצם שבור" (stub) כי handle לא אומר כלום במכשיר אחר או אחרי ניקוי נתוני האתר — עדיף תיעוד ברור מ-UI שמנסה ולא מצליח.
  - **בדיקות (סה"כ 161):** `schemas.test.ts` (ולידציה לוריאנט link), `resource-repository.test.ts` (`saveLink`), `LibraryPage.test.tsx` (הכפתור מוסתר כברירת מחדל ב-jsdom; מופיע ועובד כש-`window.showOpenFilePicker` מדומה), `backup.test.ts` (משאב מקושר לא מופיע לא ב-`data.json` ולא כקובץ ב-ZIP). **מלכודת טסטים אמיתית שנתקלנו בה ותועדה בקוד:** ה-fake handle בטסטים חייב להיות מחלקה עם השיטה `getFile` על ה-prototype (לא property של פונקציה על אובייקט literal) — structured clone (הן אמיתי והן ב-fake-indexeddb) לא יכול לשכפל פונקציות בכלל, וניסיון ראשוני עם אובייקט literal נכשל ב-`DataCloneError` באמת בזמן הרצת הטסט.

- **תמונת נושא לשיעור + הרחבת הקישור (ללא העתקה) לתמונות, לא רק וידאו:** המשך ישיר לתכונת קישור הווידאו — המשתמש ביקש שגם תמונות (למשל סריקות תווים באיכות גבוהה) יהיה ניתן לקשר במקום להעלות, וגם דרך להציג תמונה אחת כ"תמונת נושא" של שיעור על גבי כרטיס השיעור עצמו ברשימה. אושר במפורש: שתי הדרישות יחד.
  - **`src/lib/file-system-access.ts`:** `pickVideoFile()` הוכלל ל-`pickLinkableFile()` — ה-`accept` הורחב ל-`{'video/*': [], 'image/*': []}`. `LibraryPage.tsx` שינה שם פונקציה (`handleLinkVideo` → `handleLinkFile`) וכותרת כפתור ל-"🔗 קשר קובץ (וידאו/תמונה)".
  - **`Lesson.coverImageResourceId`** (`src/domain/lesson.ts`) — שדה UUID אופציונלי חדש, עצמאי מ-`resourceIds` (תמונת נושא לא חייבת גם להיות מסומנת כקובץ מצורף כללי).
  - **`src/components/ResourceThumbnail.tsx`** (חדש, רכיב משותף): מציג תצוגה ממוזערת של משאב, בשלוש התנהגויות: `blob` → `useObjectUrl` רגיל; `link` עם הרשאה שכבר `'granted'` (נבדק דרך `queryPermission`, שלא דורש user gesture) → נטען אוטומטית; `link` ללא הרשאה עדיין → placeholder עם סמל קישור שניתן ללחוץ עליו (זה כן user gesture) כדי לבקש הרשאה ולטעון. נעשה שימוש חוזר גם ב-`LessonDetailPage` (תצוגה מקדימה של הבחירה) וגם ב-`LessonsListPage` (תמונה ממוזערת 40×40 לכל שורת שיעור).
  - **`useObjectUrl` הפך יותר עמיד:** הבדיקה שונתה מ-truthy ל-`blob instanceof Blob` — פער ידוע ב-jsdom/fake-indexeddb שבו Blob לא תמיד שורד structuredClone דרך round-trip אמיתי ב-Dexie; כעת נופל בחזרה ל"אין תצוגה מקדימה" בלי לקרוס, במקום `TypeError`.
  - **`LessonDetailPage.tsx`:** שדה טופס `coverImageResourceId` (אותו דפוס "מחרוזת ריקה = undefined" כמו `notationResourceId`), בורר `<select>` עם `<ResourceThumbnail>` תצוגה מקדימה, מסונן ל-`resources.filter(r => r.mimeType.startsWith('image/'))` (עובד גם למשאבי blob וגם link).
  - **`LessonsListPage.tsx`:** `reload()` כעת שולף גם משאבים (`resourceRepository.getAll()`), בונה `Map<id, Resource>`, ומציג `<ResourceThumbnail>` בתחילת כל שורת שיעור עם `coverImageResourceId` מוגדר.
  - **תיקון UX נלווה — רשימות תרגילים/קבצים מצורפים כבר לא נפתחות במלואן כברירת מחדל:** המשתמש דיווח "למה יש רשימה ענקית של תרגילים קשורים בכרטיסיית השיעור" — שתי הרשימות (תרגילים וקבצים מצורפים) ב-`LessonDetailPage` שוחזרו: כעת מוצגת רק רשימה קומפקטית של הפריטים המקושרים בפועל + כפתורי "הסר", והבורר המלא (חיפוש + checkbox list) מוסתר מאחורי כפתור "+ הוספת תרגיל"/"+ הוספת קובץ" (`showExercisePicker`/`showResourcePicker`).
  - **תיקון UX נלווה — קליק על ה-checkbox לא הגיב, רק קליק על שם הקובץ:** אובחן (ברמת ביטחון בינונית) כתופעת לוואי של `<Badge>` (תג "🔗 מקושר" וכו') שיושב כאח בתוך אותו `<label>` ומיירט קליקים שאמורים לעבור להורה. תוקן ע"י `pointer-events-none` על ה-Badge, בנוסף להגדלת גודל ה-checkbox הגלובלי (`src/index.css`, 1rem → 1.15rem) ו-`flex-shrink: 0` כדי שהוא לא יתכווץ ליד טקסט ארוך.
  - **בדיקות (סה"כ 169):** `schemas.test.ts` (ולידציית `coverImageResourceId`), `ResourceThumbnail.test.tsx` חדש (4 טסטים — אין משאב / blob / link עם הרשאה / link ללא הרשאה עם טעינה בלחיצה), הרחבות ל-`lessons.test.tsx` (בחירת תמונת נושא ונשמרת ב-DB; לא קורס כשלשיעור כבר יש תמונת נושא — ללא assertion על ה-`<img>` עצמו בגלל אותה מגבלת jsdom/fake-indexeddb Blob round-trip; שתי הרשימות (תרגילים/קבצים) דורשות כעת לחיצה על כפתור "+ הוספת..." לפני אינטראקציה עם ה-checkboxes), `LibraryPage.test.tsx` (שם הכפתור עודכן ל-"קשר קובץ").

- **קישור קבצים: בחירה מרובה** — המשתמש שאל למה הקישור (בניגוד להעלאה הרגילה, שכבר תומכת בבחירה מרובה) מאפשר רק קובץ אחד בכל פעם. פער אמיתי: `pickLinkableFile()` (`src/lib/file-system-access.ts`) קרא ל-`showOpenFilePicker` עם `multiple: false` ו-`handleLinkFile` ב-`LibraryPage.tsx` טיפל רק בהנדל בודד. שונה שם ל-`pickLinkableFiles()` (מחזיר מערך, `multiple: true`), ו-`handleLinkFile` עבר ללולאה עם טיפול שגיאות per-file (כשל בקובץ אחד לא חוסם את שאר האצווה) — אותו דפוס בדיוק כמו `handleFileSelected` להעלאה רגילה. **בדיקות (סה"כ 170):** נוסף `links multiple files picked together in one round-trip` ל-`LibraryPage.test.tsx`.

- **"קבצים מצורפים" בכרטיס שיעור: גלריה במקום רשימה שטוחה** — המשתמש ציפה לגלריית תמונות אמיתית (לא רק "תמונת נושא" בודדת קטנה), וגם ביקש עמודות + אייקון סוג קובץ גם ברשימת הבחירה. `LessonDetailPage.tsx`: רשימת "קבצים מצורפים" הפכה מ-`<ul>` בעמודה אחת לגריד (`grid-cols-2`/`sm:grid-cols-3`) של כרטיסים — קבצי תמונה מציגים `<ResourceThumbnail>` אמיתי (40px), קבצים אחרים מציגים אייקון סוג קובץ (`FileTypeIcon` חדש) בתוך תיבה מרובעת. רשימת הבחירה (checkbox picker) קיבלה גם היא עמודות (`sm:grid-cols-2`) ואייקון סוג קובץ ליד כל שם קובץ.
  - **`src/components/FileTypeIcon.tsx`** (חדש, רכיב משותף קל): ממפה `mimeType` לאייקון `lucide-react` מתאים (תמונה/וידאו/PDF/כללי) — ללא I/O, בשונה מ-`ResourceThumbnail` שטוען בפועל Blob/קובץ מקושר; משמש בדיוק במקומות שבהם תצוגה מקדימה אמיתית לא מוצדקת (שורת בחירה צפופה, כרטיס קובץ שאינו תמונה).
  - שני התיקונים הקודמים בטור (בחירה מרובה לקישור + גלריית התמונות/אייקונים) בוצעו יחד ואומתו במלואם (`typecheck`/`lint`/`test`/`build` נקיים, 170 טסטים).
  - **עידון נוסף לגלריה:** תג "🔗 מקושר" וכפתור "הסר" קיבלו אותו רוחב (`w-full`) *וגם* אותו גובה (`min-h-8` על ה-Badge) — דווח ע"י המשתמש כ"נראה פחות טוב" כששניהם היו בגבהים שונים.
  - **תמונת נושא ברשימת השיעורים שמורה לעמודה קבועה:** גם כשלשיעור אין תמונת נושא, נשמר תא ריק בגודל 40×40 (ממוסגר, אותו רקע) כך שכותרות השיעורים מיושרות זו מתחת לזו בכל השורות — לפני התיקון, שורות ללא תמונה "קפצו" שמאלה כי `ResourceThumbnail` מחזיר `null` ולא תופס מקום.

- **נגן וידאו מוטמע מתוך כרטיס השיעור** — המשתמש שאל אם אפשר לנגן קבצי וידאו בתוך התוכנה עצמה, ומתוך השיעור (לא רק מספריית הקבצים, ששם ה"פתח קובץ" הקיים תמיד פתח טאב חדש). נוסף `src/components/InlineVideoPlayer.tsx` (רכיב משותף חדש, אותו דפוס בדיוק כמו `ResourceThumbnail`): מציג כפתור "▶" בגודל קבוע (72px), ובלחיצה — עבור קובץ blob טוען מיידית, ועבור קובץ מקושר מבצע את ריקוד ההרשאה הרגיל (`ensureReadPermission`, שחייב להיקרא מתוך הלחיצה עצמה) ואז טוען את הקובץ; בשני המקרים מציג לבסוף `<video controls autoPlay>` באותו גודל. שולב ב-`LessonDetailPage.tsx` בתוך גלריית "קבצים מצורפים" — קבצי וידאו (`mimeType` שמתחיל ב-`video/`) מציגים כעת נגן במקום אייקון סטטי, לצד תמונות (`ResourceThumbnail`) וקבצים אחרים (`FileTypeIcon`). **בדיקות (סה"כ 172):** `InlineVideoPlayer.test.tsx` חדש (2 טסטים — ניגון blob מיידי, ניגון קובץ מקושר לאחר אישור הרשאה).

- **תמונת נושא גדולה בכרטיס השיעור + יישור עמודות ברשימת השיעורים** — שני תיקוני עיצוב שהתבקשו ישירות מהמשתמש אחרי שראה את המסכים בפועל:
  - **`ResourceThumbnail.tsx`** קיבל שני props חדשים: `fluidWidth` (רוחב 100% מהאלמנט ההורה במקום פיקסלים קבועים, כדי שתמונת נושא "hero" תגדל יחד עם מקום פנוי בעמוד) ו-`objectFit` (`'cover'` ברירת מחדל לתמונות ממוזערות קטנות בגריד; `'contain'` לתצוגה גדולה כדי לא לחתוך תוכן חשוב בתמונה, למשל דיאגרמות/תווים). `LessonDetailPage.tsx` מציג כעת את תמונת הנושא בעמודה נפרדת לצד הטופס (`lg:flex-1 lg:max-w-xl`, גובה 340px, `objectFit="contain"`) במקום תצוגה מקדימה קטנה של 56px בלבד.
  - **`LessonsListPage.tsx`**: המשתמש דיווח שהתאמת `justify-between`/`justify-start` בין כותרת לתגיות עדיין לא נתנה עמודות מיושרות אמיתיות (`מחיקה`/`שכפול`/סטטוס/קטגוריה/שבוע זזו שורה-שורה לפי אורך הטקסט). התיקון האמיתי: לכל שדה (שבוע/קטגוריה/סטטוס/כפתורים) רוחב קבוע משלו (`w-20`/`w-28` וכו') עם `truncate`, כך שהעמודות מיושרות תמיד לאותו מקום בכל שורה בלי קשר לאורך הטקסט הספציפי. גם הכותרת עצמה קיבלה רוחב קבוע (`sm:w-[28rem]`) עם קיצוץ טקסט. הרשימה כולה הוגבלה ל-`max-w-5xl` כדי שהכרטיסים לא יימתחו על פני מסך רחב.
  - **תגית סטטוס צבעונית**: `LESSON_STATUS_BADGE_VARIANTS` חדש ב-`lesson-labels.ts` (אותו דפוס בדיוק כמו `STATUS_BADGE_VARIANTS` הקיים ב-`CoursePage.tsx`) — `not_started`→neutral, `active`→primary, `completed`→success — כך שאפשר לראות מיד אילו שיעורים הושלמו בלי לקרוא טקסט.
  - **בדיקות:** ללא שינוי במספר (172) — אלו שינויי CSS/עיצוב טהורים על גבי רכיבים קיימים, לא נדרשו טסטים חדשים; `typecheck`/`lint`/`test`/`build` אומתו מלאים אחרי כל שינוי.

- **ספריית קבצים: אין הבחנה חזותית בין סוגי קבצים** — המשתמש דיווח שבכרטיסי המשאבים ב-`LibraryPage.tsx` כל קובץ מקושר (תמונה, וידאו, כל דבר) הציג את אותו אייקון קישור גנרי, וכל קובץ שאינו תמונת blob (כולל וידאו!) הציג את אותו אייקון מסמך גנרי — בלי שום דרך להבחין ויזואלית בין סוגי קבצים. תוקן ע"י שימוש חוזר ברכיבים שכבר נבנו לצורך גלריית "קבצים מצורפים" בשיעור: `ResourceThumbnail` (עם `fluidWidth`/`objectFit="cover"`) לכל קובץ תמונה — כולל תמונות **מקושרות**, שכעת מציגות תצוגה מקדימה אמיתית (עם ריקוד ההרשאה הרגיל) במקום אייקון קישור — ו-`FileTypeIcon` לכל שאר סוגי הקבצים (וידאו/PDF/כללי, כל אחד עם אייקון משלו). **תיקון טסטים נלווה:** ה-fake file handles ב-`LibraryPage.test.tsx` היו חסרות `queryPermission`/`requestPermission` (לא נדרשו קודם כי משאבים מקושרים מעולם לא עברו דרך `ResourceThumbnail` בעמוד הזה) — נוספו עם `'granted'` קבוע, כמו בטסטים המקבילים של `ResourceThumbnail.test.tsx`. `typecheck`/`lint`/`test` (212)/`build` נקיים.

## Visual Drum Trainer (VISUAL_DRUM_TRAINER_SPEC.md)

מודול חדש ונפרד מ-SPEC.md — תרגול תופים אינטראקטיבי (ערכת תופים על המסך, תווים נעים/קו פגיעה, קלט מקלדת, ציון Perfect/Early/Late/Miss). מפורט במלואו ב-`VISUAL_DRUM_TRAINER_SPEC.md` (שורש הריפו), שדורש מימוש שלב-אחר-שלב (8 שלבים, §21) עם תוכנית מאושרת מראש לפני כל שלב.

### שלב 1 — פירוט

**תוצר:** שכבת הלוגיקה הטהורה בלבד — ללא UI, ללא Audio Engine, ללא Dexie/repositories (אלו שלבים 2-7). Domain types, סכמות Zod, וכל חישובי הזמן/דיוק/ציון, עם בדיקות יחידה מלאות.

- **דומיין** (`src/domain/`): `interactive-exercise.ts` — `DrumInstrument` (9 כלים), `TimeSignature`, `InteractiveExerciseDifficulty`, `DisplayMode`, `DrumNoteEvent`, ו-`InteractiveExercise` עם `superRefine` שבודק `minBpm<=bpm<=maxBpm` ושכל אירוע בתרגיל בטווח החוקי שלו (`bar<=bars`, `beat<=timeSignature.numerator`, `subdivisionIndex` בטווח לפי סוג החלוקה) — אומת עם המשתמש שהבדיקה הזו נדרשת כבר עכשיו ולא רק בשלב עורך התרגילים. `hit-result.ts` — `HitGrade`/`HitResult` (בדיוק לפי §7), ו-`ExtraHitEvent` חדש (לא קיים באפיון המילולי) לייצוג פספוס/הקשה שגויה שלא תואמת אף תו קרוב — נדרש כי המשתמש אישר במפורש שהקשות כאלה צריכות לפגוע ב-Combo/Accuracy, אבל `HitResult` המקורי מניח `expectedEventId` אמיתי שאין להקשה שגויה.
- **חישובים** (`src/domain/calculations/`): `event-timing.ts` — ממיר מיקום מוזיקלי (bar/beat/subdivisionIndex, לפי §8) לזמן מוחלט במילישניות; `bar`/`beat` נספרים מ-1 (מוסכמת נגנים), `subdivisionIndex` מ-0 (כמו שדוגמת האפיון עצמה מראה לשמיניות). `hit-matcher.ts` — מימוש 6 השלבים מ-§11: מציאת האירוע התואם הקרוב ביותר לכלי שנלחץ בתוך חלון הזמן (עם שובר שוויון לאירוע המוקדם יותר), דירוג Perfect/Early/Late (גבולות כוללניים לפי טבלת §11: מתחיל ±60/130, בינוני ±40/90, מתקדם ±25/60), וזיהוי אירועים שהוחמצו לגמרי. `scoring-engine.ts` — Accuracy ו-Combo: **הנוסחאות לא הוגדרו במפורש באפיון**, אז אומתו עם המשתמש: Accuracy = אחוז ההקשות שנפגעו (לא הוחמצו ולא היו הקשות שגויות) מתוך הסך הכל; Combo נשבר ב-Miss **וגם** בהקשה שגויה (Extra Hit), אך ממשיך גם ב-Early/Late.
- **החלטת ארכיטקטורה חשובה:** `src/domain/` לעולם לא מייבא מ-`src/lib/` (זרימת תלות חד-כיוונית שאומתה מראש בקוד הקיים) — למרות ש-`src/lib/metronome-math.ts` כבר מכיל קבוע דומה (`NOTES_PER_BEAT`), `event-timing.ts` מגדיר עותק מקומי משלו במקום לייבא, כדי לשמור על הכיוון הזה.
- **בדיקות (סה"כ 207 בכל הפרויקט):** 5 קבצי בדיקה חדשים — `interactive-exercise.test.ts` (ולידציית superRefine), `event-timing.test.ts` (6 תרחישי המרת זמן), `hit-matcher.test.ts` (12 בדיקות — התאמה, שובר שוויון, גבולות דירוג כוללניים, זיהוי Miss), `scoring-engine.test.ts` (Accuracy/Combo/Timing Error, כולל מקרי קצה), והרחבה ל-`schemas.test.ts` עבור `hitResultSchema`.

**לא בתחום השלב:** כל דבר שרואים על המסך (SVG של ערכת תופים, Note Highway, קלט מקלדת), Web Audio, כיול Latency, שמירה ל-IndexedDB/יומן — כל אלו משלבים 2-7 לפי §21.

### שלב 2 — פירוט

**תוצר:** מנוע השמע — מטרונום + השמעת התרגיל בפועל, ללא UI, ללא Dexie (משלבים 3+).

- **בעיה אמיתית שנפתרה עם המשתמש:** §10 באפיון דורש קבצי סאמפל אמיתיים (`kick.wav`, `snare.wav` וכו') שלא קיימים בפרויקט כלל, ואין דרך ליצור/להשיג קבצי אודיו אמיתיים בסביבה הזו. **אומת עם המשתמש:** באותו האופן שהמטרונום הקיים בפרויקט (`src/lib/metronome-engine.ts`, משלב 5 של הבנייה המקורית) פותר בעיה זהה — סינתוז הצליל בקוד (Web Audio oscillator), ללא קובץ חיצוני — כל 9 צלילי התופים מסונתזים בקוד גם הם. `SampleLoader.ts` מ-§14 הושמט לגמרי (אין מה לטעון); הדרישות "לא להתחיל לפני סיום טעינה" ו"עבודה ללא רשת" מ-§10 מתקיימות אוטומטית.
- **חישובים** (`src/domain/calculations/exercise-schedule.ts`, חדש): `calculateExerciseDurationMs`, `resolveEventScheduleMs`, `resolveMetronomeBeatScheduleMs` — הופכים תרגיל (כולל `loopCount`) לרשימת "מה מתנגן מתי" (זמנים במילישניות מתחילת התרגיל), תוך שימוש חוזר ב-`calculateEventTimeMs`/`calculateBarDurationMs` משלב 1. נשארו בתחום `domain/calculations` (לוגיקה עסקית טהורה) ולא ב-`lib`, ולכן ניתנים לבדיקת יחידה מלאה.
- **שכבת Web Audio** (`src/lib/visual-trainer/`, תיקייה חדשה — אותו דפוס בדיוק כמו `src/lib/backup/` הקיימת): `drum-synth.ts` — `playDrumSound()` מסנתז כל אחד מ-9 הכלים (kick/toms: אוסצילטור עם מעטפת גובה-צליל יורדת; snare/hi-hats/ride/crash: רעש לבן מסונן דרך `BiquadFilterNode` עם זמן דעיכה ותדר גזירה שונים לכל כלי) עם מעטפת עוצמה (envelope), אותה טכניקה בדיוק כמו `MetronomeEngine.playClick` הקיים. `exercise-playback-engine.ts` — מחלקת `ExercisePlaybackEngine`: מקבלת `AudioContext` מבחוץ (אותו דפוס הזרקה כמו `MetronomeEngine`), מנהלת 3 `GainNode` לעוצמת מאסטר/תופים/מטרונום בנפרד, ו-`start()` שמריץ scheduler עם lookahead (אותה טכניקה בדיוק כמו `MetronomeEngine` — `setInterval` לבדיקה, לוח זמנים אמיתי מ-`AudioContext.currentTime`) שמזמן גם קליקים לפני התרגיל (Count-In) וגם את צלילי התרגיל עצמו.
- **החלטת ארכיטקטורה:** לא נוצר `MetronomeScheduler.ts` נפרד כמו ב-§14 — מוזג לתוך `ExercisePlaybackEngine` היחיד, כי הטריינר הוויזואלי תמיד צריך מסלול קליקים בסנכרון מדויק עם לוח הזמנים הספציפי של תרגיל אחד, ולא מטרונום חופשי (זה כבר קיים במקום אחר באפליקציה). `MetronomeEngine`/`useMetronome` הקיימים לא נגעו בהם כלל.
- **בדיקות (סה"כ 212 בכל הפרויקט):** `exercise-schedule.test.ts` חדש (5 טסטים — משך תרגיל, פריסת אירועים על פני חזרות, פריסת פעימות מטרונום כולל 3/4). שכבת ה-Web Audio (`drum-synth.ts`/`exercise-playback-engine.ts`) **אינה נבדקת ביחידה** — אותה מגבלה מתועדת כמו `metronome-engine.ts` הקיים (jsdom לא מיישם Web Audio). אין עדיין אימות ידני בדפדפן (אין שום מסך ללחוץ עליו "נגן") — זה ייסגר בשלבים 3-4 כשהמנוע הזה יחובר למסך אמיתי.

**לא בתחום השלב:** React hook (`useAudioEngine`), SVG/Note Highway/קלט מקלדת, כיול Latency, שמירה ל-IndexedDB/יומן.

### שלב 3 — פירוט

**תוצר:** זיהוי קלט מקלדת — אילו מקש נלחץ ומתי, ממופה לכלי תופים. ללא הפעלת צליל וללא התאמת הקשות (§9: Input Handler נפרד מ-Audio Scheduler ומ-Scoring Engine — אלו שלב 5, כשהכול יתחבר יחד עם מסך אמיתי).

- **בעיה אמיתית שאותרה באפיון:** §6 כותב את מיפוי המקלדת (F/J/D/E/R/T/U/I/O) כתווים מילוליים. אם קוראים את זה דרך `KeyboardEvent.key`, הערך **תלוי בפריסת המקלדת הפעילה** — כשעברית פעילה כשפת קלט (סביר מאוד באפליקציה עברית), אותם מקשים פיזיים F/J/D/... מפיקים ערכי `key` שונים לגמרי, מה שהיה שובר את כל המיפוי בשקט. **תוקן:** משתמשים ב-`KeyboardEvent.code` (למשל `'KeyF'`) במקום — מדווח על מיקום פיזי של המקש בלי קשר לשפת הקלט הפעילה, הטכניקה הסטנדרטית למשחקים מבוססי-מקלדת (כמו WASD).
- **`src/lib/visual-trainer/keyboard-map.ts`** (חדש): `DEFAULT_KEYBOARD_MAP` (מיפוי ברירת המחדל לפי טבלת §6, עם קודי מקש פיזיים) ו-`mapCodeToInstrument()` — פונקציה טהורה, בדוקה במלואה.
- **`src/hooks/useKeyboardDrums.ts`** (חדש — שטוח תחת `src/hooks/`, כמו `useObjectUrl`/`useDebouncedCallback`/`useInactivityPause` הקיימים; עדיין אין `features/visual-trainer/` כי אף שלב עוד לא בנה מסך): מאזין ל-`keydown`/`keyup` על ה-`window`, עוקב אחרי מקשים לחוצים ב-`Set` כדי למנוע הפעלה חוזרת כשמקש מוחזק (Auto-Repeat), מתעלם מקומבינציות עם Ctrl/Alt/Meta ומהקשות בזמן פוקוס על שדה טקסט (כדי שהקלדה בטופס לא תפעיל תוף בטעות). `hitTimeMs` נמדד עם `performance.now()`.
- **פער פתוח שתועד לשלב הבא ולא נפתר עכשיו:** `performance.now()` (שעון הקלט) ו-`AudioContext.currentTime` (שעון האודיו משלב 2) הם **שני שעונים שונים** — התאמה ביניהם נדרשת לצורך Hit Matching מדויק, אבל זו בעיית אינטגרציה של שלב 5 (כשקלט+אודיו+ניקוד מתחברים לראשונה), לא של השלב הזה.
- **בדיקות (סה"כ 223 בכל הפרויקט):** בניגוד לשכבת ה-Web Audio של שלב 2, קלט מקלדת **כן** ניתן לבדיקה מלאה ב-jsdom. `keyboard-map.test.ts` (3 טסטים) ו-`useKeyboardDrums.test.ts` (8 טסטים, עם `renderHook`+`fireEvent` — הפעלה תקינה, מניעת הפעלה חוזרת בהחזקת מקש, הפעלה מחדש אחרי שחרור, התעלמות ממקש לא ממופה/מודיפייר/שדה טקסט, `enabled:false`, וניקוי מאזינים ב-unmount).

**לא בתחום השלב:** מסך הגדרות לעריכת המיפוי או שמירתו (§6 — זה שלב 6, כשיש התמדה). בדיקת כפילויות למיפוי שאין לו עדיין עורך. חיבור למסך אמיתי (שלב 4 בונה את הראשון). הפעלת צליל או התאמת הקשות (שלב 5).

### שלב 4 — פירוט

**תוצר:** השלב הראשון שמציג משהו על המסך בפועל — ערכת תופים מצוירת ב-SVG עם אנימציית פגיעה, ו-Note Highway (תווים נופלים לעבר קו פגיעה). אומת עם המשתמש: נבנה כרכיבים אמיתיים המחוברים ל**דף הדגמה זמני** שמחבר לראשונה את שלבים 1-4 יחד לבדיקה אמיתית בדפדפן (מוזיקה + קלט + גרפיקה), במקום רכיבים מבודדים ללא מסך.

- **החלטות scope שסוכמו מראש:**
  1. **כיוון ה-Note Highway** — האפיון לא קובע כיוון; נבחר אנכי (תווים נופלים מלמעלה למטה לעבר קו פגיעה קרוב לתחתית) — המוסכמה הסטנדרטית במשחקי קצב, ונמנע מהעדפה LTR/RTL עמומה שכיוון אופקי היה מעורר באפליקציה עברית.
  2. **מצב Staff Cursor נדחה** — §5 מציג שני מצבי תצוגה, אך שם השלב עצמו מזכיר רק Note Highway. `displayMode: 'staff_cursor'` נשאר ערך תקין בסכמה משלב 1 בלי רנדרר עדיין — תיווי מוזיקלי אמיתי (תווים/מקלות/מיקום על חמשה לכל כלי) הוא scope גדול משמעותית, ומחכה למשימה נפרדת.
  3. **§18 ("אין React state חדש בכל Frame") קבע את הארכיטקטורה** — `NoteHighway` לא יכול לקבל `currentTimeMs` כ-prop רגיל שמתעדכן ב-`setState` בכל פריים. נבנה עם `forwardRef`+`useImperativeHandle` שחושף `render(currentTimeMs)` — לולאת `requestAnimationFrame` שבבעלות ההורה קוראת לה ישירות מדי פריים, ומעדכנת `transform` על כל תו דרך refs, ללא רינדור React בנתיב החם. תבנית חדשה לגמרי בפרויקט (אומת: אין שום שימוש קודם ב-`requestAnimationFrame` או SVG מצויר-ביד ב-`src/`).
- **מתמטיקה טהורה** (`src/lib/visual-trainer/note-highway-math.ts`): `calculateNoteProgress`/`isNoteVisible` — ממירים זמן אירוע מוחלט לערך התקדמות 0..1+ לאורך ה-highway. נבדק במלואו.
- **`src/lib/visual-trainer/drum-kit-layout.ts`**: `LANE_ORDER`/`INSTRUMENT_COLORS` משותפים לשני הרכיבים כדי שצבע המסלול תמיד יתאים לחלק בערכת התופים — 9 צבעים קבועים (לא טוקני עיצוב, כי לפלטת ה-4 הצבעים הסמנטיים של האפליקציה אין מספיק גוונים נבדלים לצורך זה).
- **`src/components/visual-trainer/DrumKitSvg.tsx`** (חדש — תיקיית רכיבים ייעודית ראשונה, כמו ש-`src/lib/visual-trainer/` כבר נוצרה בשלב 2): SVG מצויר-ביד עם 8 חלקים חזותיים (9 הכלים חולקים 8 חלקים — hihat_closed/hihat_open הם אותו חלק פיזי, בדיוק כמו רשימת 8 השכבות של §13 עצמו). Prop `activeHit` עם `hitToken` ייחודי לכל הקשה — מכריח remount של ה-`<g>` הפעיל (טריק ה-`key`) כדי שהאנימציה תתחיל מחדש גם בהקשות חוזרות מהירות על אותו כלי, מה שהחלפת class בלבד לא הייתה משיגה. `@keyframes drum-hit`/`.drum-piece.hit` נוספו ל-`src/index.css` בדיוק לפי §13, עם `@keyframes cymbal-hit` נוסף (סיבוב+glow) למצילות (ride/crash) לפי הדרישה המפורשת באפיון. `prefers-reduced-motion` לא דרש קוד נוסף — הכלל הגלובלי הקיים ב-`index.css` כבר מנטרל `animation-duration` לכל אנימציה.
- **`src/components/visual-trainer/NoteHighway.tsx`** (חדש): מרנדר תו אחד ל-DOM לכל `DrumNoteEvent` (עם ref), וחושף `render(currentTimeMs)` שמעדכן `transform`/`visibility` על כל ref ישירות מדי פריים. גובה קבוע בפיקסלים (לא נמדד מהקונטיינר בכל פריים, ולא `top` שמפעיל layout) — פישוט מכוון לשלב 4, ניתן להפוך לרספונסיבי בהמשך.
- **`src/lib/visual-trainer/exercise-playback-engine.ts`**: נוסף getter קטן `startAudioTimeSeconds` (חושף שדה פרטי קיים) כדי שדף ההדגמה יוכל לסנכרן את לולאת ה-rAF החזותית שלו בדיוק לפי נקודת ההתחלה של ה-audio, במקום לקרב אותה בנפרד.
- **`src/features/practice-visual-demo/PracticeVisualDemoPage.tsx`** (חדש, **זמני** — יימחק בשלב 5): מחבר לראשונה את `ExercisePlaybackEngine` (שלב 2), `useKeyboardDrums` (שלב 3), `DrumKitSvg` ו-`NoteHighway` יחד, עם תרגיל קשיח מקומי ("מקצב Rock בסיסי", תוכן הזרעה המוצע ב-§17 עצמו — לא שמור, לא Seed אמיתי). נתיב חדש `practice/visual-demo` נוסף ל-`routes.tsx`/`lazy-pages.tsx` לפי התבנית הקיימת, **בלי** ערך ב-`NAV_ITEMS` (אותה תקדים בדיוק כמו `/practice/session` — נגיש רק ב-URL ישיר).
- **בדיקות (סה"כ 242 בכל הפרויקט):** `note-highway-math.test.ts` (9), `DrumKitSvg.test.tsx` (5 — כולל אימות ש-hihat_closed/hihat_open שניהם מפעילים את אותו חלק חזותי, ושה-remount קורה בפועל), `NoteHighway.test.tsx` (5, קוראים ל-`ref.current.render(t)` ישירות בלי rAF מזויף).
- **אימות ידני בדפדפן אמיתי (לראשונה בתכונה הזו):** Playwright מול שרת ה-dev — נלחץ "נגן", בוצעה הקשת מקלדת (F, T), ואומת ישירות ב-DOM ש-`[data-instrument="kick"]` בתוך ה-SVG מקבל class בדיוק `drum-piece hit` ו-`[data-instrument="crash"]` מקבל `drum-piece cymbal hit` — לא רק בדיקת יחידה עם props מלאכותיים. צילום מסך אישר חזותית: תווים נופלים ב-9 מסלולים צבעוניים לעבר קו הפגיעה, וערכת התופים מוצגת עם כל 8 החלקים. אפס שגיאות קונסולה.

**לא בתחום השלב:** מסך Staff Cursor. חיבור לתוצאות/ניקוד אמיתי על המסך (Combo/Accuracy/Perfect-Early-Late-Miss feedback — שלב 5). כיול Latency. שמירה ל-IndexedDB/יומן. `KeyboardGuide`/`TransportControls`/`SessionResults` מ-§14 (שלב 5).

### שלב 5 — פירוט

**תוצר:** המסך האמיתי והקבוע של הטריינר הוויזואלי — `/practice/visual` (רשימת תרגילים, נוסף גם ל-`NAV_ITEMS`) ו-`/practice/visual/:exerciseId` (הרצה אמיתית עם ניקוד חי וסיכום בסיום), מחליפים את דף ההדגמה הזמני משלב 4 (`src/features/practice-visual-demo/` — **נמחק במלואו**). אושר עם המשתמש: כל השלב בבת אחת, לא מפוצל.

- **התאמת scope:** §16 מזכיר שמירת `VisualPracticeSession`/`PracticeEntry` ליומן, אבל §21 משייך את זה במפורש לשלב 6 הנפרד — השלב הזה עדיין לא נוגע ב-Dexie בכלל. שתי השלכות: (1) קטלוג התרגילים נשאר **בזיכרון בלבד** — `src/features/visual-trainer/demo-exercises.ts` (3 תרגילים, אחד לכל רמת קושי, לפי הצעות §17) במקום קריאה מ-IndexedDB; `:exerciseId` נפתר מול הרשימה הזו, לא מול DB אמיתי. (2) מסך `/practice/visual/results/:sessionId` מ-§15 עדיין לא ניתן למימוש (אין session מזוהה לשמור) — `SessionResults` מוצג **inline** בתוך `VisualTrainerPage` בסיום ריצה, לא כניווט לנתיב נפרד. גם אושר עם המשתמש: עיצוב ערכת התופים (העיגולים/אליפסות הפשוטים משלב 4) נשאר כפי שהוא — ליטוש ויזואלי הוא משימת המשך נפרדת, לא חלק מהשלב הזה.
- **מתמטיקה טהורה חדשה** (`src/lib/visual-trainer/clock-sync-math.ts`): הקשת מקלדת נמדדת ב-`performance.now()` (שלב 3), אבל ציר הזמן של התרגיל מעוגן ל-`AudioContext.currentTime` (שלב 2) — שני שעונים שונים עם היסט קבוע לאורך חיי ה-AudioContext. `convertHitTimeToExerciseElapsedMs()` ממיר בין השניים; קריאת השעונים עצמה (לא טהורה) נשארת inline ב-hook.
- **`ExercisePlaybackEngine` קיבל Pause/Resume אמיתיים** (`src/lib/visual-trainer/exercise-playback-engine.ts`): `pause()`/`resumeFromPause()` עוטפים `AudioContext.suspend()`/`.resume()` — משהים את השעון האמיתי, כך שכל צליל שכבר תוזמן פשוט ממתין ולא צריך תזמון מחדש.
- **`src/hooks/useVisualTrainer.ts`** (חדש, ה-orchestrator לפי §14): מנהל את מחזור החיים המלא של ריצה אחת — יוצר `AudioContext`/`ExercisePlaybackEngine` בעצלנות (בלחיצת Start, לפי כלל ה-gesture הקיים), מריץ לולאת `requestAnimationFrame` משלו שמזינה את `NoteHighway.render()` ומריצה `detectMissedEvents` מול רשימת אירועים ממתינים שנשמרת ב-ref (לא state) — `setState` נקרא רק כשבאמת קרה Miss, לא בכל פריים, בהתאם ל-§18. הקשות מקלדת (נדירות יחסית לפריימים) עוברות דרך `findMatchingEvent`/`gradeTimingError` (שלב 1) ומעדכנות ניקוד. חושף `phase`/`scoring`/`gradeCounts`/`lastGrade`/`activeHit`/`currentBar`/`start`/`pause`/`resume`/`restart`/`exit`.
- **רכיבים חדשים** (`src/components/visual-trainer/`): `TransportControls` (שם/BPM/מספר תיבה + כפתורי Start/Pause/Restart/Exit לפי §5), `HitFeedback` (Perfect/Early/Late/Miss + Accuracy/Combo/Timing Error חיים, עם `StatTile` הקיים מהדשבורד), `KeyboardGuide` (מקרא סטטי של המיפוי מ-`DEFAULT_KEYBOARD_MAP`), `SessionResults` (סיכום עם פירוט לפי דירוג, כפתורי המשך/יציאה).
- **בעיה טכנית אמיתית שנתקלנו בה:** לולאת `requestAnimationFrame` שקוראת לעצמה מתוך `useCallback` נכשלה ב-lint (`Cannot access variable before it is declared`) — הפונקציה מפנה לעצמה לפני שההצהרה `const tick = ...` הושלמה. תוקן ע"י אינדיקציה דרך `ref` (`tickRef.current = tick` ב-`useEffect`, וקריאה עצמית דרך `() => tickRef.current()`) — דפוס סטנדרטי ללולאות rAF עצמיות ב-React.
- **בדיקות (סה"כ 267 בכל הפרויקט):** בניגוד לשכבת ה-Web Audio הגולמית (בלתי-נבדקת), ה-hook עצמו **כן** נבדק במלואו — עם `FakeAudioContext` (אותו דפוס בדיוק כמו `PracticeSessionPage.test.tsx` הקיים, מורחב לתמיכה ב-noise/filter nodes) ש-`currentTime` שלו עוקב אחרי `performance.now()` אמיתי, כך שמבחנים עם טיימרים אמיתיים (לא מזויפים) מקבלים חישובי זמן נכונים באמת: מעבר count-in→running, דירוג הקשה מתוזמנת היטב כ-non-miss, Miss אוטומטי כשלא לוחצים, Pause/Resume, ו-Exit. רכיבי ה-UGI (Transport/HitFeedback/KeyboardGuide/SessionResults) נבדקו במלואם כרגיל.
- **אימות ידני בדפדפן אמיתי:** Playwright מול שרת ה-dev — ניווט מהתפריט הראשי (פריט "תרגול ויזואלי" חדש) → רשימת 3 תרגילים → פתיחת "מקצב Rock בסיסי" → Start → הקשת F הפעילה גם את אנימציית ה-SVG וגם עדכנה את משוב הניקוד → Pause הקפיא בפועל (כפתור הפך ל"המשך") → Resume המשיך → Exit ניווט חזרה לרשימה. אפס שגיאות קונסולה. השלמת ריצה מלאה עד `SessionResults` לא אומתה ידנית (התרגיל ארוך מדי לבדיקה נוחה), אך התרחיש הזה מכוסה במלואו בבדיקת היחידה של ה-hook (מעבר ל-`finished` כשכל האירועים נפתרים).

**לא בתחום השלב:** ליטוש ויזואלי של ערכת התופים. `/practice/visual/results/:sessionId` כנתיב אמיתי. שמירה ל-IndexedDB/יומן, כיול Latency, קטלוג תרגילים אמיתי — כל אלו שלב 6+.

- **תיקון יישור נלווה ב-`ExerciseSelectPage`:** אותה בעיה בדיוק שכבר תוקנה ב-`LessonsListPage` (ראו "שינויים לאחר גרסה 1.0.0" למעלה) הופיעה כאן מחדש — `BPM 90`/`BPM 100`/`BPM 130` באורכים שונים גרמו לתג הרמה לזוז שורה-שורה. תוקן באותו דפוס בדיוק: רוחב קבוע (`w-16 shrink-0`) ל-BPM ולתג, ו-`max-w-5xl` לרשימה כולה כדי שלא תימתח על פני מסך רחב.
- **תווית מקש על כל תו נופל:** המשתמש ביקש לראות איזה מקש רלוונטי ישירות על התו ב-Note Highway, לא רק במקרא `KeyboardGuide` הנפרד. נוסף `getKeyLabelForInstrument()` (חיפוש הפוך במפת המקלדת, `src/lib/visual-trainer/keyboard-map.ts`) ו-`NoteHighway` מציג את האות (למשל "F"/"J"/"D") במרכז כל תו — טקסט כהה קבוע על פני הפלטה הבהירה יחסית של `INSTRUMENT_COLORS`. `KeyboardGuide` עודכן להשתמש ב-`codeToKeyLabel` המשותף במקום עותק מקומי כפול.
- **משוב הצלחה/כישלון על התו עצמו:** המשתמש דיווח שבלי תגובה ויזואלית על התו הנופל עצמו "מרגיש כמו ללחוץ באוויר" — המשוב היחיד היה בפאנל `HitFeedback` הנפרד למעלה. נוסף `NoteHighwayHandle.markResult(eventId, 'hit'|'miss')` — פגיעה מבריקה בירוק (glow), פספוס מבריק באדום ומעומעם — ו-`useVisualTrainer` קורא לה גם כשהקשה מתאימה נמצאת (`findMatchingEvent`) וגם כשאירוע מוחמץ אוטומטית (`detectMissedEvents`). גם התו וגם האות עליו הוגדלו (22px→34px גובה, 11px→16px טקסט) לפי בקשה מפורשת.
- **פלטת צבעים לא אחידה בבהירות:** המשתמש דיווח "יש כאלה שיורדים מוארים וכאלה חשוכים" — הפלטה המקורית ערבבה צהובים כמעט-לבנים עם ירוקים/אדומים כהים, מה שנראה כמו מצב "דלוק/כבוי" בין תווים במקום 9 מסלולים שווי-נוכחות. `INSTRUMENT_COLORS` (`drum-kit-layout.ts`) הוחלפה בפלטה עם בהירות/רוויה אחידה בין כל 9 הצבעים (רק הגוון משתנה) — משמשת כעת רק את `NoteHighway` (ראו החלפת `DrumKitSvg` להלן).
- **`DrumKitSvg` הוחלף ב-`DrumKit` — תמונות אמת של הערכה במקום SVG מצויר:** המשתמש ציין שהציור "עדיין ילדותי מדי" (עיגולים/אליפסות שטוחים בצבע אחיד), ולאחר ניסיון עם גרדיאנטים ב-SVG (ראו היסטוריה) המשתמש סיפק 9 תמונות מוצר שקופות אמיתיות (PNG, ~1024×1024, נוצרו ב-ChatGPT) בתיקייה זמנית בשורש הפרויקט. שתי זוגות תמונות היו דו-משמעיות ויזואלית ואושרו מול המשתמש (`AskUserQuestion`): תום גבוה מול אמצעי, וריייד מול קראש; תמונה תשיעית (שרפרף מתופף) לא נדרשת ל-8 חלקי הערכה בשימוש. התמונות הועברו ושונה שמן ל-`public/drum-kit/` (kick/snare/hihat/ride/crash/tom-high/tom-mid/tom-floor.png), כווצו מ-1024×1024 ל-480×480 דרך התקנה זמנית של `sharp` (`resize+png({quality:85,palette:true})`), מ-~15MB ל-~350KB כולל. `src/components/visual-trainer/DrumKitSvg.tsx` נמחק לגמרי, הוחלף ב-`DrumKit.tsx` החדש: אותו `data-instrument`/`INSTRUMENT_TO_PIECE`/`activeHit`+`hitToken`-remount/`.hit`/`.cymbal` class contract בדיוק (עכשיו כולל את `hihat` המאוחד ב-`CYMBAL_PIECES`, כי תמונת ה-hihat היחידה כבר מציגה סטנד+פדל מלא), אך כל חלק מרונדר כ-`<img>` ממוקם ב-`position:absolute` לפי `PIECE_LAYOUT` (אחוזים, לפי עין — לא מדידה, כי אלה תמונות מוצר אמיתיות ולא ציור טכני) במקום `<Piece>` מצויר. פריסה ראשונה הייתה מפוזרת מדי ("התמונות סתם מפוזרות" — דיווח מפורש של המשתמש עם צילום מסך); `PIECE_LAYOUT` כוונן פעמיים נוספות (עם אימות Playwright בכל פעם) להדק חפיפה בין החלקים כך שהערכה תיראה מורכבת ולא מפוזרת, לפי תמונת התייחסות אמיתית של ערכה שסיפק המשתמש.
- **תיקון שגיאת כתיב "הָיי-הָט":** האיות המקורי "הָ**א**י-הט" (עם א') נראה למשתמש כמו "אותיות בערבית" — לא באג רינדור אמיתי (הטקסט ב-DOM היה תקין), אלא תעתיק עברי לא-סטנדרטי שגרם לצירוף אותיות לא-מוכר. תוקן ל-"הָ**י**י-הט" (עם יי, כמו המילה "היי") ב-`instrument-labels.ts` וב-`DrumKit.tsx`'s `PIECE_ALT` — אישור מפורש מהמשתמש ("הערבית נעלמה") אחרי התיקון.
- **תרשים תווים סטטי — נבנה ואז הוסר מה-UI:** בעקבות בקשת המשתמש ("לדעתי יהיה מעולה אם היה אפשרות להציג עמוד תווים") נבנה גיליון תיווי תופים מפושט — `src/lib/visual-trainer/staff-notation-layout.ts` (מיפוי `STAFF_POSITION` מדויק שאושר עם המשתמש שלב-שלב: בס=רווח תחתון, טום-רצפה=קו 2 מלמטה, סנר=קו 2 מלמעלה, טום-אמצעי=רווח עליון, טום-גבוה/ריייד=קו עליון, היי-הט=מעל החמשה בלי קו חוצה, קראש=מעל החמשה עם קו חוצה) ו-`ExerciseNotationSheet.tsx` (רינדור SVG סטטי, ללא stems/beaming — גיליון קצב מפושט במפורש, לא תיווי מוזיקלי מלא). אינטגרציה ראשונה הייתה כמסך/route נפרד (`ExerciseNotationPage`) — המשתמש תיקן: "חשבתי שהתווים יהיו בזמן האימון ולא בעמוד נפרד", אז הועבר להיות סקשן מוטמע עם toggle בתוך `VisualTrainerPage` (מוסתר כברירת מחדל, כדי לא להחזיר את בעיית ה-scroll שתוקנה קודם). בבדיקה ויזואלית התגלה גם באג אמיתי: ה-`viewBox` תמיד שוריין לרוחב 4 תיבות (`BARS_PER_ROW`) גם כשלתרגיל היו רק 2, מה שהשאיר שטח ריק — תוקן. בסופו של דבר המשתמש ביקש להסיר את האופציה מה-UI לגמרי ("לא נראה טוב ולא שימושי כרגע") — `VisualTrainerPage.tsx` הוחזר למצב בלי הכפתור/הרינדור, אבל `ExerciseNotationSheet.tsx`/`staff-notation-layout.ts` (עם הבדיקות המלאות שלהם) **נשארו בקוד, לא מחוברים לשום מסך** — עבודה שלמה ונבדקת, רק לא מוצגת כרגע; קלה לחיבור מחדש אם ירצו לחזור לזה.
