import type { Lesson } from '../lesson'

/**
 * §21: "אחוז השלמת שבוע = מספר שיעורים שהושלמו חלקי מספר שיעורים פעילים
 * בשבוע." The denominator is every lesson assigned to the week (not just
 * ones currently `status: 'active'` — using that literally as the
 * denominator would shrink it every time a lesson finishes, so completion
 * could never approach 100%).
 *
 * Returns a 0..1 fraction, unrounded — §21: "אין עיגול נתונים בבסיס; העיגול
 * נעשה רק בתצוגה". Round only when displaying.
 */
export function calculateWeekCompletion(lessons: Lesson[]): number {
  if (lessons.length === 0) return 0
  const completed = lessons.filter((lesson) => lesson.status === 'completed').length
  return completed / lessons.length
}
