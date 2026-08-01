import type { LearningTimeMode, LearningTimeSlice, TrainingCategory } from './types'

export type CategoryLearningStats = { listeningSeconds: number; speakingSeconds: number; totalSeconds: number }
export type DailyLearningStats = { date: string; listeningSeconds: number; speakingSeconds: number; totalSeconds: number; categories: Record<TrainingCategory, CategoryLearningStats> }

const TRAINING_CATEGORIES: TrainingCategory[] = ['blind_listen', 'intensive_listen', 'shadowing', 'retelling', 'difficult_practice']
const emptyCategory = (): CategoryLearningStats => ({ listeningSeconds: 0, speakingSeconds: 0, totalSeconds: 0 })
const emptyCategories = (): Record<TrainingCategory, CategoryLearningStats> => Object.fromEntries(TRAINING_CATEGORIES.map((category) => [category, emptyCategory()])) as Record<TrainingCategory, CategoryLearningStats>
const emptyDay = (date: string): DailyLearningStats => ({ date, listeningSeconds: 0, speakingSeconds: 0, totalSeconds: 0, categories: emptyCategories() })

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
      const current = totals.get(date) ?? emptyDay(date)
      current[`${slice.mode}Seconds` as `${LearningTimeMode}Seconds`] += seconds
      current.totalSeconds += seconds
      current.categories[slice.trainingCategory][`${slice.mode}Seconds` as `${LearningTimeMode}Seconds`] += seconds
      current.categories[slice.trainingCategory].totalSeconds += seconds
      totals.set(date, current)
      cursor = partEnd
    }
  }
  return [...totals.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function currentLearningWeek(stats: DailyLearningStats[], now: Date): DailyLearningStats[] {
  const monday = new Date(now); const day = monday.getDay(); monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1)); monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, offset) => { const date = new Date(monday); date.setDate(date.getDate() + offset); const key = localDateKey(date); return stats.find((item) => item.date === key) ?? emptyDay(key) })
}
