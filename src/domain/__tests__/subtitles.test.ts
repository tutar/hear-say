import { describe, expect, it } from 'vitest'
import { parseSubtitle } from '@/domain/subtitles'

describe('subtitle parsing', () => {
  it('parses a valid SRT cue', () => {
    const srt = '1\n00:00:00,000 --> 00:00:01,500\nHello there\n'
    expect(parseSubtitle(srt, 'srt', 'm1', 3)[0]).toMatchObject({ text: 'Hello there', endSeconds: 1.5 })
  })

  it('rejects a VTT cue whose end is before its start', () => {
    expect(() => parseSubtitle('WEBVTT\n\n00:00:03.000 --> 00:00:01.000\nBad', 'vtt', 'm1', 4))
      .toThrow('end must be after start')
  })
})
