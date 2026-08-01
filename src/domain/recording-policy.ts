export const RECORDING_WARNING_MILLISECONDS = 30 * 60_000
export const RECORDING_LIMIT_MILLISECONDS = 60 * 60_000

export type RecordingDurationPolicy = 'continue' | 'finish_soon' | 'auto_complete'

export function recordingDurationPolicy(capturedMilliseconds: number): RecordingDurationPolicy {
  if (capturedMilliseconds >= RECORDING_LIMIT_MILLISECONDS) return 'auto_complete'
  if (capturedMilliseconds >= RECORDING_WARNING_MILLISECONDS) return 'finish_soon'
  return 'continue'
}
