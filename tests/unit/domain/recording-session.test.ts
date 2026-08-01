import { describe, expect, it } from 'vitest'
import { createRecordingSession, transitionRecordingSession } from '@/domain/recording-session'

describe('Recording Session', () => {
  it('keeps one output while pause excludes time from captured duration', () => {
    const started = createRecordingSession({
      id: 'recording-1',
      sourceTabId: 42,
      sourceTitle: 'An English lesson',
      sourceUrl: 'https://example.com/lesson',
      now: 1_000,
    })

    const paused = transitionRecordingSession(started, { type: 'pause', now: 4_000 })
    const resumed = transitionRecordingSession(paused, { type: 'resume', now: 9_000 })
    const completed = transitionRecordingSession(resumed, { type: 'complete', now: 11_000 })

    expect(completed).toMatchObject({
      id: 'recording-1',
      sourceTabId: 42,
      state: 'completed',
      capturedMilliseconds: 5_000,
      excludedMilliseconds: 5_000,
    })
  })
})
