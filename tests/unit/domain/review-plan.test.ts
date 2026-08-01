import { describe, expect, it } from 'vitest'
import { completeScheduledReview, createReviewPlan, createReviewSchedule, DEFAULT_REVIEW_INTERVALS, validateReviewIntervals } from '@/domain/review-plan'

describe('review plans and schedules', () => {
  it('pins a copied plan version and schedules all seven finite reviews', () => {
    const plan = createReviewPlan(1, DEFAULT_REVIEW_INTERVALS, '2026-08-01T00:00:00.000Z', 'p1')
    let schedule = createReviewSchedule('m1', plan, '2026-08-01T00:00:00.000Z', 's1')
    expect(schedule.nextReviewAt).toBe('2026-08-01T06:00:00.000Z')
    plan.intervals[0].value = 99
    expect(schedule.intervals[0].value).toBe(6)
    for (let count = 0; count < 7; count += 1) schedule = completeScheduledReview(schedule, schedule.nextReviewAt!)
    expect(schedule).toMatchObject({ completedCount: 7, status: 'completed', nextReviewAt: null })
  })

  it('requires positive non-decreasing intervals', () => {
    expect(() => validateReviewIntervals([{ value: 1, unit: 'day' }, { value: 6, unit: 'hour' }])).toThrow('non-decreasing')
    expect(() => validateReviewIntervals([{ value: 0, unit: 'hour' }])).toThrow('positive')
  })
})
