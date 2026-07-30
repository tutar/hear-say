import { describe, expect, it } from 'vitest'
import type { Segment } from '@/domain/types'
import { mergeAdjacentSegments, splitSegment, validateSegment } from '@/domain/segments'

const first: Segment = { id: 's1', materialId: 'm1', order: 0, startSeconds: 0, endSeconds: 2, text: 'First.', isDifficult: false }
const second: Segment = { id: 's2', materialId: 'm1', order: 1, startSeconds: 2, endSeconds: 4, text: 'Second.', isDifficult: false }

describe('segments', () => {
  it('rejects a segment whose end is not after its start', () => {
    expect(() => validateSegment({ ...first, endSeconds: 0 }, 10)).toThrow('end must be after start')
  })

  it('merges the selected segment with its next neighbor', () => {
    expect(mergeAdjacentSegments([first, second], first.id)).toMatchObject([
      { startSeconds: 0, endSeconds: 4, text: 'First. Second.', order: 0 },
    ])
  })

  it('splits a segment at a user-specified valid time', () => {
    expect(splitSegment(first, { atSeconds: 1, leftText: 'First', rightText: 'Second' }, 8)).toMatchObject([
      { startSeconds: 0, endSeconds: 1, text: 'First', order: 0 },
      { startSeconds: 1, endSeconds: 2, text: 'Second', order: 1 },
    ])
  })
})
