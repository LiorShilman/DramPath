# Drum Audio Import & Transcription — Stage 0 Compatibility Report

תוצר של שלב 0 לפי `DRUM_AUDIO_IMPORT_AND_TRANSCRIPTION_SPEC.md` §42/§44/§45 — סקירת מבנה בפועל, ללא קוד Feature או Migration.

## 1. גרסת Dexie בפועל

`src/data/db/database.ts` נמצא כיום ב-**`version(13)`** (לא 2 — הניחוש בדוגמת §30.1 של מסמך ה-Import שגוי לפרויקט הזה). Migration הבא של Import חייב להיות `version(14)`, ולחזור על כל ה-`stores` הקיימים (Dexie דורש זאת בכל migration, ראה התקדים ב-versions 2–13 הקיימים).

הטבלאות הקיימות (`storesV1` + תוספות): `coursePlans`, `weeks`, `lessons`, `exercises`, `lessonExercises`, `songs`, `resources`, `practiceSessions`, `practiceEntries`, `settings`, `achievements`, `notationPracticeState`, `interactiveExercises`.

## 2. ישויות ליבה — מיקום בפועל

| ישות (במסמך ה-Import) | קובץ בפועל | הערות |
| --- | --- | --- |
| `Exercise` | `src/domain/exercise.ts` | ישות הליבה, קטגוריה/קושי/תגים; **שונה** מ-`InteractiveExercise` |
| `InteractiveExercise` | `src/domain/interactive-exercise.ts` | כולל `DrumNoteEvent`, `DrumInstrument`, `TimeSignature`, `Subdivision` |
| `DrumNoteEvent` | `src/domain/interactive-exercise.ts:45` (`z.infer<typeof drumNoteEventSchema>`) | `bar`/`beat`/`subdivisionIndex`/`instrument`/`velocity`/`durationBeats?`/`accent?` — **אין לשנות** |
| `Subdivision` | `src/domain/exercise.ts` (`subdivisionSchema`, משותף עם `InteractiveExercise`) | כרגע `'quarter' \| 'eighth' \| 'sixteenth'` בלבד — **אין Triplet** |
| `PracticeEntry` | `src/domain/practice-entry.ts` | `exerciseId` — חייב להצביע ל-`Exercise` הליבה, לא ל-`InteractiveExercise` |
| `Resource` | `src/domain/resource.ts` | `mimeType: z.string().min(1)` — **אין Allowlist נוכשף בשכבת ה-Schema**; ה"איסור הרחבת Allowlist בשקט" של המסמך הוא כלל מוצר/UI, לא שינוי Schema נדרש |
| `Song` | `src/domain/song.ts` | קיים, ללא קישור Import כרגע |

Repositories קיימים (`src/data/repositories/`): `achievement`, `course-plan`, `exercise`, `interactive-exercise`, `lesson`, `notation-practice-state`, `practice-entry`, `practice-session`, `resource`, `settings`, `song`, `week` — כולם עוברים דרך `base-repository.ts` + Zod. **אין גישה ישירה ל-Dexie מ-UI היום** — תואם לדרישת §3.9/§44.7 של מסמך ה-Import ללא שינוי.

## 3. נתיבים (Routes) קיימים

`src/app/routes.tsx` — כל הנתיבים תחת `AppLayout`, `Lazy` דרך `src/app/lazy-pages.tsx`. רלוונטי ל-Import:

- `/practice/visual`, `/practice/visual/:exerciseId`, `/practice/visual/free-notation`, `/practice/visual/build`(`/:exerciseId`)
- `/songs`, `/songs/:songId`
- `/exercises`, `/exercises/:exerciseId`

אין כרגע שום נתיב תחת `/practice/visual/import/*` — כצפוי, ותואם ל-§7 של מסמך ה-Import (להוסיף, לא להחליף).

## 4. Backend

**אין Backend בפרויקט הזה בכלל.** DrumPath הוא PWA Local-first טהור (Vite + React 19, Dexie/IndexedDB, ללא שרת). ה-Stack המוצע במסמך ה-Import (ASP.NET Core + Python Worker) הוא **המלצת מימוש חדשה לחלוטין**, לא רכיב קיים — תואם למה שהמסמך עצמו מצהיר ב-§2.2 ("זוהי המלצת מימוש... אין להציג Stack זה כמצב שכבר מומש").

## 5. Bundle Size

`SPEC.md:579` — יעד קיים: **"Bundle ראשוני יעד: עד 350KB gzip ללא ספריית PDF."** מסמך ה-Import מצטט את אותו מספר (§34) — תואם, לא סתירה.

## 6. ADR קיימים

`docs/adr/0001`–`0005` קיימים (timestamps כ-ISO, נורמליזציית PracticeEntry, יחסי Lesson↔Exercise, singleton Settings, חלוקת Seed). ADR הבא ל-Import יהיה **`0006`**.

## 7. סתירות/פערים מול המסמך

לא אותרה סתירה מהותית. שתי הערות דיוק בלבד:

1. גרסת Dexie הבאה היא 14, לא 2 (המסמך עצמו מזהיר מפני הנחה זו ב-§30.1/§44.13 — הנחיה זו קוימה, לא הופרה).
2. `Resource.mimeType` הוא `string` פתוח ברמת ה-Schema (אין Zod enum/allowlist) — "איסור הרחבת Allowlist בשקט" (§24) הוא אפוא כלל התנהגותי (איזה Resources ה-UI/ה-Repository מייצרים בפועל), לא שינוי Schema נדרש בשלב 1.

## 8. מסקנת שלב 0

הפרויקט תואם להנחות הבסיס של מסמך ה-Import (Local-first, Repositories בלבד, Dexie versioned migrations, Lazy routes, ADRs מתועדים). ניתן להמשיך לשלב 1 (Domain types + Zod + `DrumScoreDocument` + Adapters + Unit Tests) לפי §42 — בכפוף לאישור המשתמש להמשיך, כנדרש ע"י §44.3 ("ממש שלב אחד בלבד בכל פעם").

**לא נוצר קוד Feature ולא Migration בשלב זה**, כנדרש ב-§45.
