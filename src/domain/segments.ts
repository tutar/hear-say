import type { Segment } from './types'

export type SegmentSplit = { atSeconds: number; leftText: string; rightText: string }

export function validateSegment(segment: Segment, durationSeconds: number | null): Segment {
  if (!Number.isFinite(segment.startSeconds) || !Number.isFinite(segment.endSeconds)) throw new Error('timestamps must be finite')
  if (segment.startSeconds < 0 || segment.endSeconds <= segment.startSeconds) throw new Error('end must be after start')
  if (durationSeconds !== null && segment.endSeconds > durationSeconds) throw new Error('end exceeds duration')
  if (!segment.text.trim()) throw new Error('text is required')
  return { ...segment, text: segment.text.trim() }
}

export function updateSegment(segment: Segment, patch: Partial<Pick<Segment, 'text' | 'startSeconds' | 'endSeconds' | 'isDifficult'>>, durationSeconds: number | null): Segment {
  return validateSegment({ ...segment, ...patch }, durationSeconds)
}

function renumber(segments: Segment[]): Segment[] {
  return segments.sort((a, b) => a.order - b.order).map((segment, order) => ({ ...segment, order }))
}

export function mergeAdjacentSegments(segments: Segment[], segmentId: string): Segment[] {
  const ordered = renumber([...segments])
  const index = ordered.findIndex((segment) => segment.id === segmentId)
  if (index < 0 || index === ordered.length - 1) throw new Error('next segment is required')
  const current = ordered[index]
  const next = ordered[index + 1]
  const merged: Segment = {
    ...current,
    endSeconds: next.endSeconds,
    text: `${current.text.trim()} ${next.text.trim()}`,
    isDifficult: current.isDifficult || next.isDifficult,
  }
  return renumber([...ordered.slice(0, index), merged, ...ordered.slice(index + 2)])
}

export function splitSegment(segment: Segment, split: SegmentSplit, durationSeconds: number | null): Segment[] {
  if (split.atSeconds <= segment.startSeconds || split.atSeconds >= segment.endSeconds) throw new Error('split must be inside segment')
  const left = validateSegment({ ...segment, id: crypto.randomUUID(), order: 0, endSeconds: split.atSeconds, text: split.leftText }, durationSeconds)
  const right = validateSegment({ ...segment, id: crypto.randomUUID(), order: 1, startSeconds: split.atSeconds, text: split.rightText }, durationSeconds)
  return [left, right]
}
