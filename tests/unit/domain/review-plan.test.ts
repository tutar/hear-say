import { describe, expect, it } from 'vitest'
import { completeScheduledReview, createReviewPlan, createReviewSchedule, DEFAULT_REVIEW_INTERVALS, startReviewOccurrence, validateReviewIntervals } from '@/domain/review-plan'

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

  it('shows every planned occurrence and freezes optional difficult reinforcement when one starts', () => {
    const plan = createReviewPlan(1, DEFAULT_REVIEW_INTERVALS, '2026-08-01T00:00:00.000Z', 'p1')
    const schedule = createReviewSchedule('m1', plan, '2026-08-01T00:00:00.000Z', 's1')
    expect(schedule.occurrences).toHaveLength(7)
    expect(schedule.occurrences[0]).toMatchObject({ ordinal: 1, dueAt: '2026-08-01T06:00:00.000Z', status: 'scheduled', interval: { value: 6, unit: 'hour' } })
    expect(schedule.occurrences[1]).toMatchObject({ ordinal: 2, dueAt: null, interval: { value: 1, unit: 'day' } })

    const started = startReviewOccurrence(schedule, ['difficult-1'], '2026-08-01T06:00:00.000Z')
    expect(started.occurrences[0]).toMatchObject({ status: 'in_progress', stages: ['blind_listen', 'difficult_practice', 'retelling'], difficultSegmentIds: ['difficult-1'] })
    expect(startReviewOccurrence(started, [], '2026-08-01T06:05:00.000Z').occurrences[0].stages).toEqual(['blind_listen', 'difficult_practice', 'retelling'])
  })

  it('omits difficult reinforcement when a review starts without difficult sentences', () => {
    const plan = createReviewPlan(1, DEFAULT_REVIEW_INTERVALS, '2026-08-01T00:00:00.000Z', 'p1')
    const schedule = startReviewOccurrence(createReviewSchedule('m1', plan, '2026-08-01T00:00:00.000Z', 's1'), [], '2026-08-01T06:00:00.000Z')
    expect(schedule.occurrences[0].stages).toEqual(['blind_listen', 'retelling'])
  })
})
