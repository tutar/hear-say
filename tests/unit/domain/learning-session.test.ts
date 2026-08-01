import { describe, expect, it } from 'vitest'
import { canLeaveIntensiveSegment, createLearningSession, reduceLearningSession } from '@/domain/learning-session'

const start = () => createLearningSession({ id: 'ls1', materialId: 'm1', purpose: 'first_round', reviewScheduleId: null, reviewOccurrence: null, ownerTabId: 'tab1' }, '2026-08-01T00:00:00.000Z')

describe('learning session state machine', () => {
  it('shares the four stages across first rounds and reviews and categorizes effective visible time', () => {
    let runtime = reduceLearningSession(start(), { type: 'stage_completed', at: '2026-08-01T00:01:00.000Z' })
    expect(runtime.session.stage).toBe('intensive_listen')
    runtime = reduceLearningSession(runtime, { type: 'visibility_changed', visible: false, at: '2026-08-01T00:03:00.000Z' })
    expect(runtime.slices.map((slice) => [slice.mode, (new Date(slice.endedAt).getTime() - new Date(slice.startedAt).getTime()) / 1000])).toEqual([['listening', 60], ['listening', 120]])
  })

  it('requires three real intensive repetitions or an explicit skip', () => {
    let runtime = reduceLearningSession(start(), { type: 'stage_completed', at: '2026-08-01T00:00:01.000Z' })
    expect(canLeaveIntensiveSegment(runtime.session, 'a')).toBe(false)
    for (let count = 0; count < 3; count += 1) runtime = reduceLearningSession(runtime, { type: 'intensive_repetition_completed', segmentId: 'a', at: `2026-08-01T00:00:0${count + 2}.000Z` })
    expect(canLeaveIntensiveSegment(runtime.session, 'a')).toBe(true)
    runtime = reduceLearningSession(runtime, { type: 'intensive_segment_skipped', segmentId: 'b', at: '2026-08-01T00:00:05.000Z' })
    expect(canLeaveIntensiveSegment(runtime.session, 'b')).toBe(true)
  })

  it('ends immutably after retelling', () => {
    let runtime = start()
    for (const at of ['01', '02', '03', '04']) runtime = reduceLearningSession(runtime, { type: 'stage_completed', at: `2026-08-01T00:00:${at}.000Z` })
    expect(runtime.session.status).toBe('completed')
    expect(() => reduceLearningSession(runtime, { type: 'checkpoint', at: '2026-08-01T00:00:05.000Z' })).toThrow('immutable')
  })

  it('advances a review through its frozen stages instead of the first-round template', () => {
    let runtime = createLearningSession({ id: 'review-1', materialId: 'm1', purpose: 'review', reviewScheduleId: 'schedule-1', reviewOccurrence: 1, ownerTabId: 'tab1', stages: ['blind_listen', 'difficult_practice', 'retelling'] }, '2026-08-01T00:00:00.000Z')
    runtime = reduceLearningSession(runtime, { type: 'stage_completed', at: '2026-08-01T00:01:00.000Z' })
    expect(runtime.session.stage).toBe('difficult_practice')
    runtime = reduceLearningSession(runtime, { type: 'stage_completed', at: '2026-08-01T00:02:00.000Z' })
    expect(runtime.session.stage).toBe('retelling')
    runtime = reduceLearningSession(runtime, { type: 'stage_completed', at: '2026-08-01T00:03:00.000Z' })
    expect(runtime.session.status).toBe('completed')
  })

  it('omits difficult reinforcement when it is absent from the frozen review stages', () => {
    let runtime = createLearningSession({ id: 'review-1', materialId: 'm1', purpose: 'review', reviewScheduleId: 'schedule-1', reviewOccurrence: 1, ownerTabId: 'tab1', stages: ['blind_listen', 'retelling'] }, '2026-08-01T00:00:00.000Z')
    runtime = reduceLearningSession(runtime, { type: 'stage_completed', at: '2026-08-01T00:01:00.000Z' })
    expect(runtime.session.stage).toBe('retelling')
  })

  it('splits mixed-stage time into speaking while paused and listening while audio plays', () => {
    let runtime = createLearningSession({ id: 'shadow-1', materialId: 'm1', purpose: 'first_round', reviewScheduleId: null, reviewOccurrence: null, ownerTabId: 'tab1', stages: ['shadowing'] }, '2026-08-01T00:00:00.000Z')
    runtime = reduceLearningSession(runtime, { type: 'audio_playback_changed', playing: true, at: '2026-08-01T00:00:30.000Z' })
    runtime = reduceLearningSession(runtime, { type: 'checkpoint', at: '2026-08-01T00:01:00.000Z' })
    expect(runtime.slices.map((slice) => [slice.trainingCategory, slice.mode, new Date(slice.endedAt).getTime() - new Date(slice.startedAt).getTime()])).toEqual([
      ['shadowing', 'speaking', 30_000], ['shadowing', 'listening', 30_000],
    ])
  })
})
