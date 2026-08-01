import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabaseForTest } from '@/db/database'
import { RecordingRepository } from '@/db/recording-repository'
import { createRecordingDraft } from '@/domain/recording-draft'

describe('RecordingRepository', () => {
  beforeEach(resetDatabaseForTest)

  it('recovers persisted chunks and excludes a middle interval from one WAV', async () => {
    const repository = new RecordingRepository()
    await repository.appendChunk({ sessionId: 'recording-1', sequence: 0, sampleRate: 16_000, samples: new Int16Array([100, 200]) })
    await repository.appendChunk({ sessionId: 'recording-1', sequence: 1, sampleRate: 16_000, samples: new Int16Array([300, 400]) })

    const recovered = new RecordingRepository()
    const wav = await recovered.reconstructWav('recording-1', [{ startSample: 1, endSample: 3 }])
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)

    expect(await recovered.chunkCount('recording-1')).toBe(2)
    expect(view.getUint32(40, true)).toBe(4)
    expect([view.getInt16(44, true), view.getInt16(46, true)]).toEqual([100, 400])
  })

  it('retains completed and interrupted recordings as durable drafts', async () => {
    const repository = new RecordingRepository()
    const completed = createRecordingDraft({ sessionId: 'recording-1', state: 'completed', source: { title: 'Lesson', url: 'https://example.com/lesson', site: 'example.com' }, startedAt: '2026-08-01T10:00:00.000Z', durationSeconds: 12, sizeBytes: 384_000, now: '2026-08-01T10:01:00.000Z' })
    const interrupted = createRecordingDraft({ sessionId: 'recording-2', state: 'interrupted', source: { title: 'Video', url: 'https://example.com/video', site: 'example.com' }, startedAt: '2026-08-01T11:00:00.000Z', durationSeconds: 4, sizeBytes: 128_000, now: '2026-08-01T11:01:00.000Z' })

    await repository.saveDraft(completed)
    await repository.saveDraft(interrupted)

    expect(await new RecordingRepository().getDraft('recording-1')).toEqual(completed)
    expect((await repository.listDrafts()).map((draft) => draft.state)).toEqual(['interrupted', 'completed'])
  })

  it('keeps non-destructive exclusions when the app is reopened', async () => {
    const repository = new RecordingRepository()
    await repository.saveDraft(createRecordingDraft({ sessionId: 'recording-1', state: 'completed', source: { title: 'Lesson', url: '', site: 'example.com' }, startedAt: '2026-08-01T10:00:00.000Z', durationSeconds: 12, sizeBytes: 384_000, now: '2026-08-01T10:01:00.000Z' }))
    await repository.saveExcludedIntervals('recording-1', [{ startSample: 16_000, endSample: 32_000 }])
    expect((await new RecordingRepository().getDraft('recording-1'))?.excludedIntervals).toEqual([{ startSample: 16_000, endSample: 32_000 }])
  })
})
