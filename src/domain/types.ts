export type MaterialStatus = 'pending_transcription' | 'ready' | 'transcription_failed'

export type FirstRoundStage = 'blind_listen' | 'intensive_listen' | 'shadowing' | 'retelling' | 'complete'
export type LearningStage = Exclude<FirstRoundStage, 'complete'>
export type LearningSessionPurpose = 'first_round' | 'review'
export type LearningTimeCategory = 'listening' | 'speaking'

export type IntensiveRepetitionProgress = {
  completed: number
  skipped: boolean
}

export type LearningSession = {
  id: string
  materialId: string
  purpose: LearningSessionPurpose
  reviewScheduleId: string | null
  reviewOccurrence: number | null
  stage: LearningStage
  segmentIndex: number
  playbackRate: number
  loopSegment: boolean
  intensiveProgress: Record<string, IntensiveRepetitionProgress>
  retellKeywords: string[]
  status: 'active' | 'completed' | 'ended'
  ownerTabId: string
  startedAt: string
  lastCheckpointAt: string
  endedAt: string | null
}

export type LearningTimeSlice = {
  id: string
  sessionId: string
  materialId: string
  category: LearningTimeCategory
  startedAt: string
  endedAt: string
}

export type ReviewInterval = { value: number; unit: 'hour' | 'day' }
export type ReviewPlan = {
  id: string
  version: number
  intervals: ReviewInterval[]
  createdAt: string
}
export type ReviewSchedule = {
  id: string
  materialId: string
  planId: string
  planVersion: number
  intervals: ReviewInterval[]
  completedCount: number
  nextReviewAt: string | null
  status: 'active' | 'completed'
  createdAt: string
  updatedAt: string
}

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
