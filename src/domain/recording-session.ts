export type RecordingSessionState = 'recording' | 'paused' | 'completed' | 'cancelled' | 'interrupted'

export type RecordingSession = {
  id: string
  sourceTabId: number
  sourceTitle: string
  sourceUrl: string
  state: RecordingSessionState
  startedAt: number
  stateChangedAt: number
  capturedMilliseconds: number
  excludedMilliseconds: number
}

type CreateRecordingSessionInput = {
  id: string
  sourceTabId: number
  sourceTitle: string
  sourceUrl: string
  now: number
}

export type RecordingSessionEvent =
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'complete' | 'cancel' | 'interrupt'; now: number }

export function createRecordingSession(input: CreateRecordingSessionInput): RecordingSession {
  return {
    id: input.id,
    sourceTabId: input.sourceTabId,
    sourceTitle: input.sourceTitle,
    sourceUrl: input.sourceUrl,
    state: 'recording',
    startedAt: input.now,
    stateChangedAt: input.now,
    capturedMilliseconds: 0,
    excludedMilliseconds: 0,
  }
}

export function transitionRecordingSession(session: RecordingSession, event: RecordingSessionEvent): RecordingSession {
  if (event.now < session.stateChangedAt) throw new Error('Recording Session time cannot move backwards')
  const elapsed = event.now - session.stateChangedAt

  if (event.type === 'pause' && session.state === 'recording') {
    return { ...session, state: 'paused', stateChangedAt: event.now, capturedMilliseconds: session.capturedMilliseconds + elapsed }
  }
  if (event.type === 'resume' && session.state === 'paused') {
    return { ...session, state: 'recording', stateChangedAt: event.now, excludedMilliseconds: session.excludedMilliseconds + elapsed }
  }
  if (event.type === 'complete' && (session.state === 'recording' || session.state === 'paused')) {
    return {
      ...session,
      state: 'completed',
      stateChangedAt: event.now,
      capturedMilliseconds: session.capturedMilliseconds + (session.state === 'recording' ? elapsed : 0),
      excludedMilliseconds: session.excludedMilliseconds + (session.state === 'paused' ? elapsed : 0),
    }
  }
  if (event.type === 'cancel' && (session.state === 'recording' || session.state === 'paused')) {
    return { ...session, state: 'cancelled', stateChangedAt: event.now }
  }
  if (event.type === 'interrupt' && (session.state === 'recording' || session.state === 'paused')) {
    return { ...session, state: 'interrupted', stateChangedAt: event.now }
  }
  throw new Error(`Cannot ${event.type} a ${session.state} Recording Session`)
}
