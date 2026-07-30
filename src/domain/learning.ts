import type { FirstRoundStage, Material } from './types'

const stages: FirstRoundStage[] = ['blind_listen', 'intensive_listen', 'shadowing', 'retelling', 'complete']
export const REVIEW_INTERVAL_DAYS = [1, 2, 4, 7, 14, 28] as const

function atOffset(date: Date, milliseconds: number): string {
  return new Date(date.getTime() + milliseconds).toISOString()
}

export function completeStage(material: Material, completedAt: Date): Material {
  const index = stages.indexOf(material.firstRoundStage)
  if (index < 0 || material.firstRoundStage === 'complete') throw new Error('stage is already complete')
  const nextStage = stages[index + 1]
  return {
    ...material,
    firstRoundStage: nextStage,
    nextReviewAt: nextStage === 'complete' ? atOffset(completedAt, 6 * 60 * 60 * 1000) : material.nextReviewAt,
    reviewStep: nextStage === 'complete' ? 0 : material.reviewStep,
    updatedAt: completedAt.toISOString(),
  }
}

export function advanceReview(material: Material, completedAt: Date): Material {
  if (material.firstRoundStage !== 'complete') throw new Error('first round is not complete')
  const interval = REVIEW_INTERVAL_DAYS[Math.min(material.reviewStep, REVIEW_INTERVAL_DAYS.length - 1)]
  return {
    ...material,
    reviewStep: Math.min(material.reviewStep + 1, REVIEW_INTERVAL_DAYS.length - 1),
    nextReviewAt: atOffset(completedAt, interval * 24 * 60 * 60 * 1000),
    updatedAt: completedAt.toISOString(),
  }
}
