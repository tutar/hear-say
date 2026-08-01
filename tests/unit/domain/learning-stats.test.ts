import { describe, expect, it } from 'vitest'
import { currentLearningWeek, dailyLearningStats } from '@/domain/learning-stats'

describe('learning statistics', () => {
  it('splits effective time at local midnight and derives Monday-based weeks', () => {
    const stats = dailyLearningStats([{ id: '1', sessionId: 's', materialId: 'm', trainingCategory: 'retelling', mode: 'speaking', startedAt: new Date(2026, 7, 2, 23, 59, 30).toISOString(), endedAt: new Date(2026, 7, 3, 0, 0, 30).toISOString() }])
    expect(stats.map((item) => [item.date, item.speakingSeconds])).toEqual([['2026-08-02', 30], ['2026-08-03', 30]])
    const week = currentLearningWeek(stats, new Date(2026, 7, 3, 12))
    expect(week).toHaveLength(7)
    expect(week[0].date).toBe('2026-08-03')
  })

  it('aggregates five training categories without double-counting mixed listening and speaking', () => {
    const stats = dailyLearningStats([
      { id: '1', sessionId: 's', materialId: 'm', trainingCategory: 'blind_listen', mode: 'listening', startedAt: '2026-08-03T01:00:00.000Z', endedAt: '2026-08-03T01:01:00.000Z' },
      { id: '2', sessionId: 's', materialId: 'm', trainingCategory: 'shadowing', mode: 'listening', startedAt: '2026-08-03T01:01:00.000Z', endedAt: '2026-08-03T01:01:20.000Z' },
      { id: '3', sessionId: 's', materialId: 'm', trainingCategory: 'shadowing', mode: 'speaking', startedAt: '2026-08-03T01:01:20.000Z', endedAt: '2026-08-03T01:02:00.000Z' },
    ])[0]
    expect(stats).toMatchObject({ totalSeconds: 120, listeningSeconds: 80, speakingSeconds: 40, categories: { blind_listen: { totalSeconds: 60, listeningSeconds: 60, speakingSeconds: 0 }, shadowing: { totalSeconds: 60, listeningSeconds: 20, speakingSeconds: 40 } } })
  })

  it('ignores local slices from the obsolete schema instead of crashing the learning page', () => {
    const obsolete = { id: 'old', sessionId: 's', materialId: 'm', startedAt: '2026-08-03T01:00:00.000Z', endedAt: '2026-08-03T01:01:00.000Z' }

    expect(dailyLearningStats([obsolete as never])).toEqual([])
  })
})
