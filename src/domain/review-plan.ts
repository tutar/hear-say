import type { ReviewInterval, ReviewPlan, ReviewSchedule, ReviewStage } from './types'

export const DEFAULT_REVIEW_INTERVALS: ReviewInterval[] = [
  { value: 6, unit: 'hour' }, { value: 1, unit: 'day' }, { value: 2, unit: 'day' },
  { value: 4, unit: 'day' }, { value: 7, unit: 'day' }, { value: 14, unit: 'day' }, { value: 28, unit: 'day' },
]

export function intervalMilliseconds(interval: ReviewInterval): number {
  return interval.value * (interval.unit === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000)
}

export function validateReviewIntervals(intervals: ReviewInterval[]): void {
  if (intervals.length === 0) throw new Error('review plan requires at least one interval')
  let previous = 0
  for (const interval of intervals) {
    if (!Number.isFinite(interval.value) || interval.value <= 0) throw new Error('review intervals must be positive')
    const milliseconds = intervalMilliseconds(interval)
    if (milliseconds < previous) throw new Error('review intervals must be non-decreasing')
    previous = milliseconds
  }
}

export function createReviewPlan(version: number, intervals: ReviewInterval[], createdAt: string, id: string = crypto.randomUUID()): ReviewPlan {
  validateReviewIntervals(intervals)
  return { id, version, intervals: intervals.map((item) => ({ ...item })), createdAt }
}

export function createReviewSchedule(materialId: string, plan: ReviewPlan, firstRoundCompletedAt: string, id: string = crypto.randomUUID()): ReviewSchedule {
  const intervals = plan.intervals.map((item) => ({ ...item }))
  const firstDueAt = new Date(new Date(firstRoundCompletedAt).getTime() + intervalMilliseconds(intervals[0])).toISOString()
  return {
    id, materialId, planId: plan.id, planVersion: plan.version, intervals, completedCount: 0, status: 'active',
    occurrences: intervals.map((interval, index) => ({ id: `${id}:${index + 1}`, ordinal: index + 1, interval: { ...interval }, dueAt: index === 0 ? firstDueAt : null, status: 'scheduled', stages: null, difficultSegmentIds: null, stageIndex: 0, startedAt: null, completedAt: null })),
    nextReviewAt: firstDueAt,
    createdAt: firstRoundCompletedAt, updatedAt: firstRoundCompletedAt,
  }
}

export function startReviewOccurrence(schedule: ReviewSchedule, difficultSegmentIds: string[], startedAt: string): ReviewSchedule {
  if (schedule.status === 'completed') throw new Error('review schedule is already complete')
  const occurrence = schedule.occurrences[schedule.completedCount]
  if (!occurrence) throw new Error('review occurrence was not found')
  if (occurrence.status === 'in_progress') return schedule
  const stages: ReviewStage[] = difficultSegmentIds.length > 0 ? ['blind_listen', 'difficult_practice', 'retelling'] : ['blind_listen', 'retelling']
  const occurrences = schedule.occurrences.map((item, index) => index === schedule.completedCount ? { ...item, status: 'in_progress' as const, stages, difficultSegmentIds: [...difficultSegmentIds], startedAt } : item)
  return { ...schedule, occurrences, updatedAt: startedAt }
}

export function completeScheduledReview(schedule: ReviewSchedule, completedAt: string): ReviewSchedule {
  if (schedule.status === 'completed') throw new Error('review schedule is already complete')
  const completedCount = schedule.completedCount + 1
  const nextInterval = schedule.intervals[completedCount]
  const nextReviewAt = nextInterval ? new Date(new Date(completedAt).getTime() + intervalMilliseconds(nextInterval)).toISOString() : null
  const occurrences = schedule.occurrences.map((occurrence, index) => {
    if (index === schedule.completedCount) return { ...occurrence, status: 'completed' as const, completedAt }
    if (index === completedCount && nextReviewAt) return { ...occurrence, dueAt: nextReviewAt }
    return occurrence
  })
  return {
    ...schedule, occurrences, completedCount, updatedAt: completedAt,
    status: nextInterval ? 'active' : 'completed',
    nextReviewAt,
  }
}
