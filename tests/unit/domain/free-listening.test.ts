import { describe, expect, it } from 'vitest'
import { DEFAULT_FREE_LISTENING_PREFERENCES, moveFreeListeningCursor, normalizeFreeListeningPreferences } from '@/domain/free-listening'

describe('free listening', () => {
  it('defaults to a visible single-sentence player and clamps playback speed', () => {
    expect(DEFAULT_FREE_LISTENING_PREFERENCES).toMatchObject({ viewMode: 'single', textVisible: true, loopMode: 'off', playbackRate: 1 })
    expect(normalizeFreeListeningPreferences({ ...DEFAULT_FREE_LISTENING_PREFERENCES, playbackRate: 9 }).playbackRate).toBe(2)
  })

  it('moves continuously, loops the article, or repeats one sentence', () => {
    expect(moveFreeListeningCursor(1, 3, 'off', 1)).toEqual({ index: 2, continuePlaying: true })
    expect(moveFreeListeningCursor(2, 3, 'off', 1)).toEqual({ index: 2, continuePlaying: false })
    expect(moveFreeListeningCursor(2, 3, 'full', 1)).toEqual({ index: 0, continuePlaying: true })
    expect(moveFreeListeningCursor(1, 3, 'sentence', 1)).toEqual({ index: 1, continuePlaying: true })
  })
})
