import { describe, expect, it } from 'vitest'
import { recordingDurationPolicy } from '@/domain/recording-policy'

describe('recording duration policy', () => {
  it('warns at 30 captured minutes and automatically completes at 60', () => {
    expect(recordingDurationPolicy(29 * 60_000 + 59_999)).toBe('continue')
    expect(recordingDurationPolicy(30 * 60_000)).toBe('finish_soon')
    expect(recordingDurationPolicy(59 * 60_000 + 59_999)).toBe('finish_soon')
    expect(recordingDurationPolicy(60 * 60_000)).toBe('auto_complete')
  })
})
