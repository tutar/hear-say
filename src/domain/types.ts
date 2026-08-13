export type MaterialStatus = 'pending_transcription' | 'ready' | 'transcription_failed'

export type FirstRoundStage = 'blind_listen' | 'intensive_listen' | 'shadowing' | 'retelling' | 'complete'
export type LearningStage = Exclude<FirstRoundStage, 'complete'> | 'difficult_practice'
export type LearningSessionPurpose = 'first_round' | 'review' | 'free_listening'
export type LearningTimeMode = 'listening' | 'speaking'
export type TrainingCategory = 'blind_listen' | 'intensive_listen' | 'shadowing' | 'retelling' | 'difficult_practice'
export type FreeListeningLoopMode = 'off' | 'full' | 'sentence'
export type FreeListeningPreferences = {
  id: 'global'
  viewMode: 'single' | 'list'
  textVisible: boolean
  maskMode: 'all' | 'difficult'
  loopMode: FreeListeningLoopMode
  playbackRate: number
  analysisVisible: boolean
  translationVisible: boolean
  chunksVisible: boolean
}
export type FreeListeningProgress = { materialId: string; segmentIndex: number; positionSeconds: number; updatedAt: string }

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
  stages: LearningStage[]
  stageIndex: number
  segmentIndex: number
  playbackRate: number
  loopSegment: boolean
  audioPlaying: boolean
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
  trainingCategory: TrainingCategory
  mode: LearningTimeMode
  startedAt: string
  endedAt: string
}

export type ReviewInterval = { value: number; unit: 'hour' | 'day' }
export type ReviewStage = 'blind_listen' | 'difficult_practice' | 'retelling'
export type ReviewOccurrence = {
  id: string
  ordinal: number
  interval: ReviewInterval
  dueAt: string | null
  status: 'scheduled' | 'in_progress' | 'completed'
  stages: ReviewStage[] | null
  difficultSegmentIds: string[] | null
  stageIndex: number
  startedAt: string | null
  completedAt: string | null
}
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
  occurrences: ReviewOccurrence[]
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

export type AsrLanguage = 'en' | 'auto'
export type AsrProvider = 'assemblyai' | 'openai-compatible'
export type AsrSettings = { provider: AsrProvider; baseUrl: string; apiKey: string; model: string; language: AsrLanguage }

export type VocabularySettings = { baseUrl: string; apiKey: string; model: string }
export type WordSource =
  | { kind: 'web'; title: string; url: string }
  | { kind: 'material'; title: string; materialId: string; segmentId: string }
  | { kind: 'manual'; title: string; hasUserContext: boolean }
export type WordContext = {
  id: string
  ipa: string
  partOfSpeech: string
  meaningZh: string
  definitionZh?: string
  exampleSentenceEn?: string
  exampleSentenceZh?: string
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
  definitionZh: string
  exampleSentenceEn: string
  exampleSentenceZh: string
  contextExplanationZh: string
  updatedAt: string
}
