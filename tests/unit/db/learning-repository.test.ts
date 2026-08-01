import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LearningRepository } from '@/db/learning-repository'
import { resetDatabaseForTest } from '@/db/database'
import type { LearningSession } from '@/domain/types'

describe('LearningRepository', () => {
  beforeEach(resetDatabaseForTest)

  it('versions global plans without changing an existing schedule', async () => {
    const repository = new LearningRepository()
    const schedule = await repository.scheduleMaterial('m1', '2026-08-01T00:00:00.000Z')
    const next = await repository.createNextReviewPlan([{ value: 12, unit: 'hour' }], '2026-08-02T00:00:00.000Z')
    expect(next.version).toBe(2)
    expect((await repository.scheduleForMaterial('m1'))?.planVersion).toBe(schedule.planVersion)
    expect((await repository.scheduleMaterial('m2', '2026-08-02T00:00:00.000Z')).planVersion).toBe(2)
  })

  it('will not mutate a completed session', async () => {
    const repository = new LearningRepository()
    const session: LearningSession = { id: 's1', materialId: 'm1', purpose: 'first_round', reviewScheduleId: null, reviewOccurrence: null, stage: 'retelling', stages: ['blind_listen', 'intensive_listen', 'shadowing', 'retelling'], stageIndex: 3, segmentIndex: 0, playbackRate: 1, loopSegment: true, audioPlaying: false, intensiveProgress: {}, retellKeywords: [], status: 'completed', ownerTabId: 't1', startedAt: '2026-08-01T00:00:00.000Z', lastCheckpointAt: '2026-08-01T00:01:00.000Z', endedAt: '2026-08-01T00:01:00.000Z' }
    await repository.saveActiveSession(session)
    await expect(repository.saveActiveSession({ ...session, retellKeywords: ['changed'] })).rejects.toThrow('immutable')
  })

  it('persists global free-listening preferences separately from each material position', async () => {
    const repository = new LearningRepository()
    await repository.saveFreeListeningPreferences({ viewMode: 'list', textVisible: false, loopMode: 'full', playbackRate: 0.7, analysisVisible: false, translationVisible: true, chunksVisible: true })
    await repository.saveFreeListeningProgress({ materialId: 'm1', segmentIndex: 3, positionSeconds: 42.5, updatedAt: '2026-08-01T00:00:00.000Z' })
    expect(await repository.freeListeningPreferences()).toMatchObject({ viewMode: 'list', playbackRate: 0.7 })
    expect(await repository.freeListeningProgress('m1')).toMatchObject({ segmentIndex: 3, positionSeconds: 42.5 })
    expect(await repository.freeListeningProgress('m2')).toBeUndefined()
  })
})
