export type ExcludedSampleInterval = { startSample: number; endSample: number }

export type RecordingDraftState = 'completed' | 'interrupted'

export type SourceReference = {
  title: string
  url: string
  site: string
  recordedAt: string
}

export type RecordingDraft = {
  id: string
  sessionId: string
  state: RecordingDraftState
  source: SourceReference
  durationSeconds: number
  sizeBytes: number
  excludedIntervals: ExcludedSampleInterval[]
  createdAt: string
  updatedAt: string
}

export function createRecordingDraft(input: {
  sessionId: string
  state: RecordingDraftState
  source: Omit<SourceReference, 'recordedAt'>
  startedAt: string
  durationSeconds: number
  sizeBytes: number
  now: string
}): RecordingDraft {
  if (input.durationSeconds < 0 || input.sizeBytes < 0) throw new Error('Recording Draft measurements cannot be negative')
  if (input.durationSeconds === 0 || input.sizeBytes === 0) throw new Error('Recording Draft must contain persisted audio')
  return {
    id: input.sessionId,
    sessionId: input.sessionId,
    state: input.state,
    source: { ...input.source, recordedAt: input.startedAt },
    durationSeconds: input.durationSeconds,
    sizeBytes: input.sizeBytes,
    excludedIntervals: [],
    createdAt: input.now,
    updatedAt: input.now,
  }
}

export function normalizeExcludedIntervals(intervals: readonly ExcludedSampleInterval[], totalSamples: number): ExcludedSampleInterval[] {
  const valid = intervals
    .filter((interval) => Number.isInteger(interval.startSample) && Number.isInteger(interval.endSample) && interval.startSample >= 0 && interval.endSample > interval.startSample && interval.endSample <= totalSamples)
    .map((interval) => ({ ...interval }))
    .sort((left, right) => left.startSample - right.startSample)
  return valid.reduce<ExcludedSampleInterval[]>((result, interval) => {
    const previous = result.at(-1)
    if (previous && interval.startSample <= previous.endSample) previous.endSample = Math.max(previous.endSample, interval.endSample)
    else result.push(interval)
    return result
  }, [])
}
