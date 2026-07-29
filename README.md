# DrumPath

מערכת WEB אישית לניהול לימוד ואימון בתופים — Local-first, משתמש יחיד, ללא Backend. עובדת אופליין כ-PWA, וכל הנתונים נשמרים אך ורק במכשיר (IndexedDB).

האפיון המלא נמצא ב-[SPEC.md](./SPEC.md). המערכת נבנתה שלב אחר שלב לפי §35 במסמך.

## סטטוס

**גרסה 1.0 — כל 10 השלבים (0–9) הושלמו.** פירוט מלא לכל שלב: [docs/implementation-status.md](./docs/implementation-status.md). היסטוריית שינויים: [CHANGELOG.md](./CHANGELOG.md).

## יכולות עיקריות

- **תוכנית לימוד**: מסלול קבוע של 12 שבועות, שיעורים ותרגילים עם מעקב סטטוס.
- **אימון יומי**: תכנון אוטומטי לפי §25 (חימום, פוקוס שבועי, "דורש עבודה", תרגיל הנאה), עם מטרונום Web Audio מלא (Tap Tempo, חלוקות, Count-in) והצעת שינוי BPM חכמה.
- **מעקב התקדמות**: יומן אימונים, גרפי BPM וזמן תרגול, מערכת הישגים.
- **ספרייה**: קבצי PDF/תמונות מצורפים לשיעורים ותרגילים, ספריית שירים.
- **גיבוי ושחזור**: ייצוא/ייבוא ZIP מלא (Replace/Merge), ייצוא CSV ליומן. ראו [docs/backup-guide.md](./docs/backup-guide.md).
- **PWA**: מותקנת כאפליקציה, עובדת אופליין, עדכון גרסה כהצעה שאינה נכפית באמצע אימון.

## טכנולוגיה

React 19 + TypeScript (strict) + Vite 8, Tailwind CSS v4, עברית RTL. Local-first, ללא שרת:

- **נתונים**: Dexie (IndexedDB), Zod לוולידציה.
- **ניתוב**: React Router.
- **טפסים**: React Hook Form + `@hookform/resolvers/zod`.
- **גרפים**: Recharts.
- **גיבוי**: JSZip.
- **PWA**: vite-plugin-pwa.
- **אייקונים**: lucide-react.

(שכבת ה-state מנוהלת כולה דרך React state מקומי + Dexie כמקור אמת — אין Zustand או ספריית state-management נפרדת; לא היה בה צורך.)

## הרצה מקומית

```bash
npm install
npm run dev            # שרת פיתוח
npm run build           # build לפרודקשן
npm run preview         # תצוגה מקדימה של ה-build (נדרש כדי לבדוק PWA/Service Worker)
npm run lint             # ESLint
npm run typecheck        # בדיקת טיפוסים
npm run test              # Vitest
npm run test:coverage     # Vitest + דוח כיסוי (סף 80% על src/domain)
npm run format            # Prettier
```

## מבנה תיקיות

```text
src/
  app/        # bootstrap, router (כולל lazy loading לכל route), providers
  components/ # רכיבי UI לשימוש חוזר
  features/   # מסך/יכולת לכל תיקייה (dashboard, today, practice-session, course, ...)
  domain/     # entities, enums, כללים עסקיים — ללא תלות ב-React
  data/       # db (Dexie), repositories, seed
  hooks/      # React hooks
  lib/        # audio, checksum, גיבוי (backup/), utilities
  styles/     # design tokens
  test/       # test setup
```

## חומרי קורס וקבצים אישיים

המערכת **אינה** כוללת ואינה מפרסמת מחדש סרטוני קורס, PDF-ים או חומר מוגן בזכויות יוצרים. קישורים לשיעורים וקבצים פרטיים (PDF, תמונות) מתווספים ידנית על ידי המשתמש דרך הממשק ונשמרים מקומית בלבד (IndexedDB), ואינם נכללים ב-repository של הקוד.

## גיבוי

ראו §27 במסמך האפיון ואת [docs/backup-guide.md](./docs/backup-guide.md) למדריך שימוש מלא (ייצוא/ייבוא, Replace מול Merge, ייצוא CSV, תזכורת 14 יום).
