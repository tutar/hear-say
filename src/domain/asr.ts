import { validateSegment } from './segments'
import type { Segment } from './types'

type VerboseSegment = { start?: unknown; end?: unknown; text?: unknown }

export function normalizeVerboseJson(payload: unknown, materialId: string, durationSeconds: number | null): Segment[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { segments?: unknown }).segments)) {
    throw new Error('response has no sentence segments')
  }

  const rawSegments = (payload as { segments: VerboseSegment[] }).segments
  if (rawSegments.length === 0) throw new Error('no usable sentence segments')

  const segments = rawSegments.map((raw, order) => {
    if (typeof raw.start !== 'number' || typeof raw.end !== 'number' || typeof raw.text !== 'string') {
      throw new Error('response segment is missing a required field')
    }
    return validateSegment({
      id: crypto.randomUUID(), materialId, order, startSeconds: raw.start, endSeconds: raw.end,
      text: raw.text, isDifficult: false,
    }, durationSeconds)
  })

  if (segments.length === 0) throw new Error('no usable sentence segments')
  return segments
}
