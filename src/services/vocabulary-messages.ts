import type { WordSource } from '../domain/types'
import type { VocabularyLookup, VocabularySelection } from './vocabulary-service'

export type VocabularyMessage =
  | { type: 'vocabulary.lookup'; selection: VocabularySelection }
  | { type: 'vocabulary.add'; selection: VocabularySelection; lookup: VocabularyLookup; source: WordSource }
  | { type: 'vocabulary.speak'; term: string }
  | { type: 'vocabulary.stop' }
  | { type: 'vocabulary.openSettings' }

export type VocabularyMessageResponse<T = unknown> = { ok: true; data: T } | { ok: false; error: string }
