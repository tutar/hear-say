import { describe, expect, it } from 'vitest'
import type { Material } from '@/domain/types'
import { advanceReview, completeStage } from '@/domain/learning'

function materialAt(stage: Material['firstRoundStage']): Material {
  return {
    id: 'm1', title: 'clip.wav', audioBlob: new Blob(['audio']), durationSeconds: 5,
    status: 'ready', transcriptionError: null, firstRoundStage: stage, nextReviewAt: null,
    reviewStep: 0, createdAt: '2026-07-30T00:00:00.000Z', updatedAt: '2026-07-30T00:00:00.000Z',
  }
}

describe('learning flow', () => {
  it('advances blind listening by exactly one legal stage', () => {
    expect(completeStage(materialAt('blind_listen'), new Date('2026-07-30T00:00:00.000Z')).firstRoundStage)
      .toBe('intensive_listen')
  })

  it('schedules the first review six hours after retelling', () => {
    expect(completeStage(materialAt('retelling'), new Date('2026-07-30T00:00:00.000Z'))).toMatchObject({
      firstRoundStage: 'complete', nextReviewAt: '2026-07-30T06:00:00.000Z',
    })
  })

  it('schedules the next review one day after the first review', () => {
    const complete = completeStage(materialAt('retelling'), new Date('2026-07-30T00:00:00.000Z'))
    expect(advanceReview(complete, new Date('2026-07-30T06:00:00.000Z')).nextReviewAt)
      .toBe('2026-07-31T06:00:00.000Z')
  })
})
