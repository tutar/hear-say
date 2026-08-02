import { describe, expect, it } from 'vitest'
import { resolveLearningPlace } from '@/app/learning-place-renderer'

const material = { id: 'm', title: 'x', firstRoundStage: 'blind_listen', status: 'ready' } as any
describe('learning place renderer', () => {
  it('keeps free listening and first-round blind listening distinct', () => {
    expect(resolveLearningPlace({ kind: 'free-listening', materialId: 'm' }, material)?.kind).toBe('free-listening')
    expect(resolveLearningPlace({ kind: 'practice', materialId: 'm' }, material)?.kind).toBe('blind-listening')
  })
  it('resolves the structured learning stages without leaking route flags', () => {
    expect(resolveLearningPlace({ kind: 'practice', materialId: 'm' }, { ...material, firstRoundStage: 'intensive_listen' } as any)?.kind).toBe('intensive-listening')
    expect(resolveLearningPlace({ kind: 'practice', materialId: 'm' }, { ...material, firstRoundStage: 'shadowing' } as any)?.kind).toBe('practice-flow')
    expect(resolveLearningPlace({ kind: 'subtitles', materialId: 'm' }, material)?.mode).toBe('subtitle-editor')
  })
})
