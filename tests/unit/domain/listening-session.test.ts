import { describe, expect, it } from 'vitest'
import { reduceListeningSession } from '@/domain/listening-session'
const state = { segmentIndex: 0, positionSeconds: 0, playing: false, playbackRate: 1, loopMode: 'off' as const }
describe('listening session core', () => {
  it('keeps playback state transitions pure', () => {
    expect(reduceListeningSession(state, { type: 'toggle' }, 2).playing).toBe(true)
    expect(reduceListeningSession(state, { type: 'select', index: 9, positionSeconds: 4 }, 2).segmentIndex).toBe(1)
  })
})
