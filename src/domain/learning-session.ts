import type { LearningSession, LearningStage, LearningTimeCategory, LearningTimeSlice } from './types'

export const LEARNING_STAGES: LearningStage[] = ['blind_listen', 'intensive_listen', 'shadowing', 'retelling']
export const categoryForStage = (stage: LearningStage): LearningTimeCategory =>
  stage === 'blind_listen' || stage === 'intensive_listen' ? 'listening' : 'speaking'

export type SessionRuntime = { session: LearningSession; visibleSince: string | null; slices: LearningTimeSlice[] }
export type SessionEvent =
  | { type: 'visibility_changed'; visible: boolean; at: string }
  | { type: 'checkpoint'; at: string }
  | { type: 'stage_completed'; at: string }
  | { type: 'segment_selected'; index: number; at: string }
  | { type: 'playback_changed'; rate?: number; loopSegment?: boolean; at: string }
  | { type: 'intensive_repetition_completed'; segmentId: string; at: string }
  | { type: 'intensive_segment_skipped'; segmentId: string; at: string }
  | { type: 'retell_keywords_changed'; keywords: string[]; at: string }
  | { type: 'session_ended'; at: string }

export function createLearningSession(input: Pick<LearningSession, 'id' | 'materialId' | 'purpose' | 'reviewScheduleId' | 'reviewOccurrence' | 'ownerTabId'>, at: string): SessionRuntime {
  return { session: { ...input, stage: 'blind_listen', segmentIndex: 0, playbackRate: 1, loopSegment: true, intensiveProgress: {}, retellKeywords: [], status: 'active', startedAt: at, lastCheckpointAt: at, endedAt: null }, visibleSince: at, slices: [] }
}

function closeVisible(runtime: SessionRuntime, at: string): SessionRuntime {
  if (!runtime.visibleSince || new Date(at) <= new Date(runtime.visibleSince)) return { ...runtime, visibleSince: null }
  const slice: LearningTimeSlice = { id: `${runtime.session.id}:${runtime.visibleSince}:${at}`, sessionId: runtime.session.id, materialId: runtime.session.materialId, category: categoryForStage(runtime.session.stage), startedAt: runtime.visibleSince, endedAt: at }
  return { ...runtime, visibleSince: null, slices: [...runtime.slices, slice] }
}

export function reduceLearningSession(runtime: SessionRuntime, event: SessionEvent): SessionRuntime {
  if (runtime.session.status !== 'active') throw new Error('ended learning sessions are immutable')
  let next = runtime
  if (event.type === 'visibility_changed') {
    next = event.visible ? { ...runtime, visibleSince: runtime.visibleSince ?? event.at } : closeVisible(runtime, event.at)
  } else if (event.type === 'checkpoint') {
    const closed = closeVisible(runtime, event.at)
    next = { ...closed, visibleSince: runtime.visibleSince ? event.at : null }
  } else if (event.type === 'stage_completed') {
    const closed = closeVisible(runtime, event.at)
    const index = LEARNING_STAGES.indexOf(runtime.session.stage)
    const final = index === LEARNING_STAGES.length - 1
    next = { ...closed, visibleSince: final ? null : event.at, session: { ...closed.session, stage: final ? closed.session.stage : LEARNING_STAGES[index + 1], status: final ? 'completed' : 'active', endedAt: final ? event.at : null } }
  } else if (event.type === 'session_ended') {
    const closed = closeVisible(runtime, event.at)
    next = { ...closed, session: { ...closed.session, status: 'ended', endedAt: event.at } }
  } else if (event.type === 'segment_selected') next = { ...runtime, session: { ...runtime.session, segmentIndex: Math.max(0, event.index) } }
  else if (event.type === 'playback_changed') next = { ...runtime, session: { ...runtime.session, playbackRate: event.rate ?? runtime.session.playbackRate, loopSegment: event.loopSegment ?? runtime.session.loopSegment } }
  else if (event.type === 'retell_keywords_changed') next = { ...runtime, session: { ...runtime.session, retellKeywords: [...event.keywords] } }
  else if (event.type === 'intensive_repetition_completed') {
    const progress = runtime.session.intensiveProgress[event.segmentId] ?? { completed: 0, skipped: false }
    next = { ...runtime, session: { ...runtime.session, intensiveProgress: { ...runtime.session.intensiveProgress, [event.segmentId]: { completed: Math.min(3, progress.completed + 1), skipped: false } } } }
  } else if (event.type === 'intensive_segment_skipped') {
    const progress = runtime.session.intensiveProgress[event.segmentId] ?? { completed: 0, skipped: false }
    next = { ...runtime, session: { ...runtime.session, intensiveProgress: { ...runtime.session.intensiveProgress, [event.segmentId]: { ...progress, skipped: true } } } }
  }
  return { ...next, session: { ...next.session, lastCheckpointAt: event.at } }
}

export function canLeaveIntensiveSegment(session: LearningSession, segmentId: string): boolean {
  const progress = session.intensiveProgress[segmentId]
  return Boolean(progress?.skipped || progress?.completed === 3)
}
