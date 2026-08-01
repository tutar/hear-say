export type MaterialStatus = 'pending_transcription' | 'ready' | 'transcription_failed'

export type FirstRoundStage = 'blind_listen' | 'intensive_listen' | 'shadowing' | 'retelling' | 'complete'

export type Segment = {
  id: string
  materialId: string
  order: number
  startSeconds: number
  endSeconds: number
  text: string
  isDifficult: boolean
}

export type Material = {
  id: string
  title: string
  audioBlob: Blob
  durationSeconds: number | null
  status: MaterialStatus
  transcriptionError: string | null
  firstRoundStage: FirstRoundStage
  nextReviewAt: string | null
  reviewStep: number
  isFavorite: boolean
  tags: string[]
  retellKeywords?: string[]
  createdAt: string
  updatedAt: string
}

export type AsrSettings = { baseUrl: string; apiKey: string; model: string }

export type VocabularySettings = { baseUrl: string; apiKey: string; model: string }
export type WordSource =
  | { kind: 'web'; title: string; url: string }
  | { kind: 'material'; title: string; materialId: string; segmentId: string }
export type WordContext = {
  id: string
  ipa: string
  partOfSpeech: string
  meaningZh: string
  contextExplanationZh: string
  sentence: string
  source: WordSource
  createdAt: string
}
export type WordEntry = {
  id: string
  term: string
  normalizedTerm: string
  contexts: WordContext[]
  createdAt: string
  lastSeenAt: string
}
export type VocabularyCacheEntry = {
  key: string
  term: string
  normalizedTerm: string
  sentence: string
  ipa: string
  partOfSpeech: string
  meaningZh: string
  contextExplanationZh: string
  updatedAt: string
}
