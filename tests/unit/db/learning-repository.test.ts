import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LearningRepository } from '@/db/learning-repository'
import { resetDatabaseForTest } from '@/db/database'

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
    const session = { id: 's1', materialId: 'm1', purpose: 'first_round' as const, reviewScheduleId: null, reviewOccurrence: null, stage: 'retelling' as const, segmentIndex: 0, playbackRate: 1, loopSegment: true, intensiveProgress: {}, retellKeywords: [], status: 'completed' as const, ownerTabId: 't1', startedAt: '2026-08-01T00:00:00.000Z', lastCheckpointAt: '2026-08-01T00:01:00.000Z', endedAt: '2026-08-01T00:01:00.000Z' }
    await repository.saveActiveSession(session)
    await expect(repository.saveActiveSession({ ...session, retellKeywords: ['changed'] })).rejects.toThrow('immutable')
  })
})
