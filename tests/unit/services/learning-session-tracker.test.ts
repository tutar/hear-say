import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabaseForTest } from '@/db/database'
import { LearningRepository } from '@/db/learning-repository'
import { LearningSessionTracker } from '@/services/learning-session-tracker'

describe('LearningSessionTracker', () => {
  beforeEach(resetDatabaseForTest)
  it('enforces one active owner and supports explicit takeover', async () => {
    const repository = new LearningRepository(); const first = new LearningSessionTracker(repository, 'tab-a'); const second = new LearningSessionTracker(repository, 'tab-b')
    await first.start('m1', 'first_round', 'blind_listen', '2026-08-01T00:00:00.000Z')
    expect(await second.start('m1', 'first_round', 'blind_listen', '2026-08-01T00:00:01.000Z')).toEqual({ kind: 'owned_elsewhere', ownerTabId: 'tab-a' })
    expect((await second.start('m1', 'first_round', 'blind_listen', '2026-08-01T00:00:02.000Z', true)).kind).toBe('started')
    expect((await repository.activeSession())?.ownerTabId).toBe('tab-b')
  })

  it('checkpoints only visible effective time', async () => {
    const repository = new LearningRepository(); const tracker = new LearningSessionTracker(repository, 'tab-a')
    await tracker.start('m1', 'first_round', 'blind_listen', '2026-08-01T00:00:00.000Z')
    await tracker.dispatch({ type: 'checkpoint', at: '2026-08-01T00:00:30.000Z' })
    await tracker.dispatch({ type: 'visibility_changed', visible: false, at: '2026-08-01T00:00:40.000Z' })
    await tracker.dispatch({ type: 'checkpoint', at: '2026-08-01T00:01:00.000Z' })
    expect((await repository.timeSlices()).reduce((sum, slice) => sum + new Date(slice.endedAt).getTime() - new Date(slice.startedAt).getTime(), 0)).toBe(40_000)
  })
})
