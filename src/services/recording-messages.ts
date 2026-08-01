import type { RecordingDiagnostics, RecordingSource } from '../features/recording/RecordingHarness'

export type RecordingCommand =
  | { type: 'recording.start'; source: RecordingSource; streamId: string }
  | { type: 'recording.openDraft'; draftId: string }
  | { type: 'recording.durationWarning'; sessionId: string }
  | { type: 'recording.autoCompleted'; sessionId: string; result: { wavUrl: string; fileName: string } }
  | { type: 'recording.pause' | 'recording.resume' | 'recording.complete' | 'recording.cancel' | 'recording.status' | 'recording.recoveryAvailable' | 'recording.recover' | 'recording.current' }

export type OffscreenRecordingCommand =
  | { type: 'recording.offscreen.start'; sessionId: string; streamId: string }
  | { type: 'recording.offscreen.recover'; sessionId: string }
  | { type: 'recording.offscreen.pause' | 'recording.offscreen.resume' | 'recording.offscreen.complete' | 'recording.offscreen.cancel' | 'recording.offscreen.status' }

export type RecordingResponse<T = undefined> = { ok: true; data: T } | { ok: false; error: string }
export type RecordingStatus = RecordingDiagnostics & { state: 'idle' | 'recording' | 'paused' }
