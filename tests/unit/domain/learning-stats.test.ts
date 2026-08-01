import { describe, expect, it } from 'vitest'
import { currentLearningWeek, dailyLearningStats } from '@/domain/learning-stats'

describe('learning statistics', () => {
  it('splits effective time at local midnight and derives Monday-based weeks', () => {
    const stats = dailyLearningStats([{ id: '1', sessionId: 's', materialId: 'm', category: 'speaking', startedAt: '2026-08-02T15:59:30.000Z', endedAt: '2026-08-02T16:00:30.000Z' }])
    expect(stats.map((item) => [item.date, item.speakingSeconds])).toEqual([['2026-08-02', 30], ['2026-08-03', 30]])
    const week = currentLearningWeek(stats, new Date('2026-08-03T04:00:00.000Z'))
    expect(week).toHaveLength(7)
    expect(week[0].date).toBe('2026-08-03')
  })
})
