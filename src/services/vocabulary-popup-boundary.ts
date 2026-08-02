import type { WordSource } from '../domain/types'
import type { VocabularyLookup, VocabularySelection } from './vocabulary-service'
import type { VocabularyMessage, VocabularyMessageResponse } from './vocabulary-messages'

export type VocabularyPopupTransport = <T>(message: VocabularyMessage) => Promise<T>

export function createVocabularyPopupBoundary(send: VocabularyPopupTransport, selection: VocabularySelection, source: WordSource) {
  return {
    lookup: () => send<VocabularyLookup>({ type: 'vocabulary.lookup', selection }),
    add: (lookup: VocabularyLookup) => send({ type: 'vocabulary.add', selection, lookup, source }),
    isSaved: () => send<boolean>({ type: 'vocabulary.status', selection, source }),
    speak: (term: string) => send<null>({ type: 'vocabulary.speak', term }),
  }
}

export function vocabularyResponse<T>(response: VocabularyMessageResponse<T>): T {
  if (!response.ok) throw new Error(response.error)
  return response.data
}
