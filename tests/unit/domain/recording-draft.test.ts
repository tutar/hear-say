import { describe, expect, it } from 'vitest'
import { createRecordingDraft, normalizeExcludedIntervals } from '@/domain/recording-draft'

describe('Recording Draft', () => {
  it('keeps local source metadata separate from the future material', () => {
    const draft = createRecordingDraft({ sessionId: 'session-1', state: 'completed', source: { title: 'A lesson', url: 'https://example.com/watch', site: 'example.com' }, startedAt: '2026-08-01T10:00:00.000Z', durationSeconds: 9, sizeBytes: 288_000, now: '2026-08-01T10:01:00.000Z' })
    expect(draft).toMatchObject({ id: 'session-1', sessionId: 'session-1', state: 'completed', durationSeconds: 9, sizeBytes: 288_000, excludedIntervals: [], source: { recordedAt: '2026-08-01T10:00:00.000Z' } })
  })

  it('rejects invalid measurements', () => {
    expect(() => createRecordingDraft({ sessionId: 'session-1', state: 'completed', source: { title: '', url: '', site: '' }, startedAt: '', durationSeconds: -1, sizeBytes: 0, now: '' })).toThrow('cannot be negative')
  })

  it('does not create a draft when no audio was persisted', () => {
    expect(() => createRecordingDraft({ sessionId: 'session-1', state: 'interrupted', source: { title: 'Empty', url: '', site: '' }, startedAt: '', durationSeconds: 0, sizeBytes: 0, now: '' })).toThrow('must contain persisted audio')
  })

  it('orders and merges overlapping excluded intervals', () => {
    expect(normalizeExcludedIntervals([{ startSample: 300, endSample: 500 }, { startSample: 100, endSample: 350 }, { startSample: 700, endSample: 800 }], 1_000)).toEqual([{ startSample: 100, endSample: 500 }, { startSample: 700, endSample: 800 }])
  })
})
