import { db } from './database'
import type { VocabularyCacheEntry, WordEntry, WordSource } from '../domain/types'
import type { VocabularyLookup, VocabularySelection } from '../services/vocabulary-service'

export type NewWordContext = {
  term: string
  normalizedTerm: string
  ipa: string
  partOfSpeech: string
  meaningZh: string
  definitionZh?: string
  exampleSentenceEn?: string
  exampleSentenceZh?: string
  contextExplanationZh: string
  sentence: string
  source: WordSource
}

export class WordRepository {
  async addContext(input: NewWordContext): Promise<WordEntry> {
    const now = new Date().toISOString()
    const existing = await db.wordEntries.where('normalizedTerm').equals(input.normalizedTerm).first()
    if (existing) {
      const duplicate = existing.contexts.some((context) => sameContext(context.sentence, context.source, input.sentence, input.source))
      if (duplicate) return existing
      const updated: WordEntry = {
        ...existing,
        term: input.term,
        contexts: [...existing.contexts, toContext(input, now)],
        lastSeenAt: now,
      }
      await db.wordEntries.put(updated)
      return updated
    }
    const entry: WordEntry = {
      id: crypto.randomUUID(), term: input.term, normalizedTerm: input.normalizedTerm,
      contexts: [toContext(input, now)],
      createdAt: now, lastSeenAt: now,
    }
    await db.wordEntries.add(entry)
    return entry
  }
  async hasContext(input: Pick<NewWordContext, 'normalizedTerm' | 'sentence' | 'source'>): Promise<boolean> {
    const existing = await db.wordEntries.where('normalizedTerm').equals(input.normalizedTerm).first()
    return Boolean(existing?.contexts.some((context) => sameContext(context.sentence, context.source, input.sentence, input.source)))
  }

  async listEntries(): Promise<WordEntry[]> { return db.wordEntries.orderBy('lastSeenAt').reverse().toArray() }
  async getEntry(id: string): Promise<WordEntry | null> { return (await db.wordEntries.get(id)) ?? null }
  async getLookup(selection: VocabularySelection): Promise<VocabularyLookup | null> {
    const cached = await db.wordLookups.get(lookupKey(selection))
    if (!cached || typeof cached.definitionZh !== 'string' || typeof cached.exampleSentenceEn !== 'string' || typeof cached.exampleSentenceZh !== 'string') return null
    const { key: _key, sentence: _sentence, updatedAt: _updatedAt, ...lookup } = cached
    return lookup
  }
  async saveLookup(selection: VocabularySelection, lookup: VocabularyLookup): Promise<void> {
    const cached: VocabularyCacheEntry = { key: lookupKey(selection), sentence: selection.sentence, updatedAt: new Date().toISOString(), ...lookup }
    await db.wordLookups.put(cached)
  }
}

const sourceKey = (source: WordSource) => source.kind === 'web' ? `web:${source.url}` : source.kind === 'material' ? `material:${source.materialId}:${source.segmentId}` : `manual:${source.hasUserContext ? 'context' : 'standalone'}`
const sameContext = (leftSentence: string, leftSource: WordSource, rightSentence: string, rightSource: WordSource) => {
  if (leftSource.kind === 'manual' && rightSource.kind === 'manual' && !leftSource.hasUserContext && !rightSource.hasUserContext) return true
  return leftSentence === rightSentence && sourceKey(leftSource) === sourceKey(rightSource)
}
const lookupKey = (selection: VocabularySelection) => `${selection.term.trim().toLowerCase()}\n${selection.sentence.trim()}`
const toContext = (input: NewWordContext, createdAt: string) => ({
  id: crypto.randomUUID(), ipa: input.ipa, partOfSpeech: input.partOfSpeech, meaningZh: input.meaningZh,
  ...(input.definitionZh ? { definitionZh: input.definitionZh } : {}),
  ...(input.exampleSentenceEn ? { exampleSentenceEn: input.exampleSentenceEn } : {}),
  ...(input.exampleSentenceZh ? { exampleSentenceZh: input.exampleSentenceZh } : {}),
  contextExplanationZh: input.contextExplanationZh, sentence: input.sentence, source: input.source, createdAt,
})
