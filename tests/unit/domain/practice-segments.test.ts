import { describe, expect, it } from 'vitest'
import { createPracticeSegments } from '@/domain/practice-segments'

describe('practice segment grouping', () => {
  it('combines short sentences within a paragraph without crossing its boundary', () => {
    const result = createPracticeSegments([
      { start: 0, end: 500, text: 'Mm.' },
      { start: 700, end: 5_500, text: 'I think that could work.' },
      { start: 5_700, end: 7_000, text: 'Right.' },
      { start: 8_000, end: 9_000, text: 'New topic.' },
    ], [
      { start: 0, end: 7_000, text: '' },
      { start: 8_000, end: 9_000, text: '' },
    ])

    expect(result).toEqual([
      { start: 0, end: 7_000, text: 'Mm. I think that could work. Right.' },
      { start: 8_000, end: 9_000, text: 'New topic.' },
    ])
  })

  it('folds a short paragraph tail into its previous unit when both limits allow it', () => {
    const result = createPracticeSegments([
      { start: 0, end: 5_200, text: 'This is the first complete thought.' },
      { start: 5_300, end: 6_000, text: 'Yeah.' },
    ], [{ start: 0, end: 6_000, text: '' }])
    expect(result).toEqual([{ start: 0, end: 6_000, text: 'This is the first complete thought. Yeah.' }])
  })

  it('keeps a single long sentence intact and does not merge another sentence into it', () => {
    const long = 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty one.'
    const result = createPracticeSegments([
      { start: 0, end: 13_000, text: long },
      { start: 13_100, end: 14_000, text: 'Mm.' },
    ], [{ start: 0, end: 14_000, text: '' }])
    expect(result).toEqual([{ start: 0, end: 13_000, text: long }, { start: 13_100, end: 14_000, text: 'Mm.' }])
  })
})
