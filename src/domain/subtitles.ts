import { validateSegment } from './segments'
import type { Segment } from './types'

function parseTimestamp(value: string): number {
  const match = value.trim().match(/^(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})$/)
  if (!match) throw new Error('invalid subtitle timestamp')
  const [, hours = '0', minutes, seconds, milliseconds] = match
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(milliseconds) / 1000
}

export function parseSubtitle(text: string, format: 'srt' | 'vtt', materialId: string, durationSeconds: number | null): Segment[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  const body = format === 'vtt' ? normalized.replace(/^WEBVTT[^\n]*\n*/i, '') : normalized
  const blocks = body.split(/\n\s*\n/).filter(Boolean)
  const segments: Segment[] = []

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    const timeIndex = lines.findIndex((line) => line.includes('-->'))
    if (timeIndex < 0) throw new Error('subtitle cue has no timing')
    const [start, end] = lines[timeIndex].split('-->').map((part) => part.trim().split(/\s+/)[0])
    const cueText = lines.slice(timeIndex + 1).join(' ')
    const segment = validateSegment({
      id: crypto.randomUUID(), materialId, order: segments.length,
      startSeconds: parseTimestamp(start), endSeconds: parseTimestamp(end), text: cueText, isDifficult: false,
    }, durationSeconds)
    const previous = segments.at(-1)
    if (previous && segment.startSeconds < previous.startSeconds) throw new Error('subtitle cues are out of order')
    segments.push(segment)
  }

  if (segments.length === 0) throw new Error('no usable subtitle cues')
  return segments
}
