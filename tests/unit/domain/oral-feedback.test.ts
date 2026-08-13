import { describe, expect, it } from 'vitest'
import { compareOralAttempt } from '@/domain/oral-feedback'

describe('oral shadowing feedback', () => {
  it('reports character similarity and word-level changes in learner-facing order', () => {
    expect(compareOralAttempt('I really like this lesson.', 'I like the lesson')).toEqual({
      similarity: 64,
      words: [
        { kind: 'match', text: 'I' },
        { kind: 'missing', text: 'really' },
        { kind: 'match', text: 'like' },
        { kind: 'changed', expected: 'this', actual: 'the' },
        { kind: 'match', text: 'lesson' },
      ],
    })
  })
})
