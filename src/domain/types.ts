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
