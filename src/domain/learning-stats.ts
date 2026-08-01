import type { LearningTimeSlice } from './types'

export type DailyLearningStats = { date: string; listeningSeconds: number; speakingSeconds: number; totalSeconds: number }

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function dailyLearningStats(slices: LearningTimeSlice[]): DailyLearningStats[] {
  const totals = new Map<string, DailyLearningStats>()
  for (const slice of slices) {
    let cursor = new Date(slice.startedAt)
    const end = new Date(slice.endedAt)
    while (cursor < end) {
      const midnight = new Date(cursor); midnight.setHours(24, 0, 0, 0)
      const partEnd = midnight < end ? midnight : end
      const seconds = (partEnd.getTime() - cursor.getTime()) / 1000
      const date = localDateKey(cursor)
      const current = totals.get(date) ?? { date, listeningSeconds: 0, speakingSeconds: 0, totalSeconds: 0 }
      current[`${slice.category}Seconds`] += seconds
      current.totalSeconds += seconds
      totals.set(date, current)
      cursor = partEnd
    }
  }
  return [...totals.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function currentLearningWeek(stats: DailyLearningStats[], now: Date): DailyLearningStats[] {
  const monday = new Date(now); const day = monday.getDay(); monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1)); monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, offset) => { const date = new Date(monday); date.setDate(date.getDate() + offset); const key = localDateKey(date); return stats.find((item) => item.date === key) ?? { date: key, listeningSeconds: 0, speakingSeconds: 0, totalSeconds: 0 } })
}
