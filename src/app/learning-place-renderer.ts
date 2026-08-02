import type { FirstRoundStage, Material, ReviewStage } from '../domain/types'
import type { WorkspacePlace } from './workspace-routes'

export type LearningPlaceView =
  | { kind: 'free-listening'; mode: 'free'; material: Material }
  | { kind: 'blind-listening'; mode: 'first-round' | 'review'; material: Material; reviewStage?: ReviewStage }
  | { kind: 'intensive-listening'; mode: 'first-round'; material: Material }
  | { kind: 'practice-flow'; mode: 'review' | 'subtitle-editor'; material: Material }
  | { kind: 'practice-flow'; mode: 'first-round'; material: Material }

export function resolveLearningPlace(place: WorkspacePlace, material: Material | null, reviewStage?: ReviewStage): LearningPlaceView | null {
  if (!material) return null
  if (place.kind === 'free-listening') return { kind: 'free-listening', mode: 'free', material }
  if (place.kind === 'subtitles') return { kind: 'practice-flow', mode: 'subtitle-editor', material }
  if (place.kind === 'review') return reviewStage === 'blind_listen' ? { kind: 'blind-listening', mode: 'review', material, reviewStage } : { kind: 'practice-flow', mode: 'review', material }
  if (place.kind === 'practice' && material.firstRoundStage === 'blind_listen') return { kind: 'blind-listening', mode: 'first-round', material }
  if (place.kind === 'practice' && material.firstRoundStage === 'intensive_listen') return { kind: 'intensive-listening', mode: 'first-round', material }
  if (place.kind === 'practice') return { kind: 'practice-flow', mode: 'first-round', material }
  return null
}

export const isLearningStage = (stage: FirstRoundStage) => stage !== 'complete'
