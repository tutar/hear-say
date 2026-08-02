export type VocabularySelection = { term: string; sentence: string }
export type VocabularyExplanation = {
  term: string
  ipa: string
  partOfSpeech: string
  meaningZh: string
  definitionZh: string
  exampleSentenceEn: string
  exampleSentenceZh: string
  contextExplanationZh: string
}
export type VocabularyLookup = VocabularyExplanation & { normalizedTerm: string }
export type VocabularyExplainer = { explain: (selection: VocabularySelection) => Promise<VocabularyExplanation> }

export async function lookupVocabulary(selection: VocabularySelection, explainer: VocabularyExplainer): Promise<VocabularyLookup> {
  const wordCount = selection.term.match(/[a-z]+(?:'[a-z]+)?/gi)?.length ?? 0
  if (wordCount === 0 || wordCount > 8 || selection.term.length > 80) throw new Error('请选择一个单词或短语')
  const explanation = await explainer.explain(selection)
  return { ...explanation, normalizedTerm: explanation.term.trim().toLowerCase() }
}

type LookupCache = {
  getLookup: (selection: VocabularySelection) => Promise<VocabularyLookup | null>
  saveLookup: (selection: VocabularySelection, lookup: VocabularyLookup) => Promise<void>
}

export class VocabularyService {
  constructor(private readonly cache: LookupCache, private readonly explainer: VocabularyExplainer) {}

  async lookup(selection: VocabularySelection): Promise<VocabularyLookup> {
    const cached = await this.cache.getLookup(selection)
    if (cached) return cached
    const lookup = await lookupVocabulary(selection, this.explainer)
    await this.cache.saveLookup(selection, lookup)
    return lookup
  }
}
