import { describe, expect, it } from 'vitest'
import { normalizeVerboseJson } from '@/domain/asr'

describe('verbose JSON normalization', () => {
  it('normalizes valid sentence timestamps and text', () => {
    expect(normalizeVerboseJson({ segments: [{ start: 0, end: 1.2, text: ' Hello ' }] }, 'm1', 3))
      .toMatchObject([{ materialId: 'm1', order: 0, text: 'Hello', startSeconds: 0, endSeconds: 1.2 }])
  })

  it('rejects an empty response rather than creating a ready material', () => {
    expect(() => normalizeVerboseJson({ segments: [] }, 'm1', 3)).toThrow('no usable sentence segments')
  })

  it('rejects invalid timestamp ordering', () => {
    expect(() => normalizeVerboseJson({ segments: [{ start: 2, end: 1, text: 'bad' }] }, 'm1', 3))
      .toThrow('end must be after start')
  })
})
