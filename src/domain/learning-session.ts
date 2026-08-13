import type { LearningSession, LearningStage, LearningTimeMode, LearningTimeSlice, TrainingCategory } from './types'

export const LEARNING_STAGES: LearningStage[] = ['blind_listen', 'intensive_listen', 'shadowing', 'retelling']
export const trainingCategoryForStage = (stage: LearningStage): TrainingCategory => stage
export const modeForStage = (stage: LearningStage, audioPlaying: boolean): LearningTimeMode =>
  stage === 'blind_listen' || stage === 'intensive_listen' || audioPlaying ? 'listening' : 'speaking'

export type SessionRuntime = { session: LearningSession; visibleSince: string | null; slices: LearningTimeSlice[] }
export type SessionEvent =
  | { type: 'visibility_changed'; visible: boolean; at: string }
  | { type: 'checkpoint'; at: string }
  | { type: 'stage_completed'; at: string }
  | { type: 'segment_selected'; index: number; at: string }
  | { type: 'playback_changed'; rate?: number; loopSegment?: boolean; at: string }
  | { type: 'audio_playback_changed'; playing: boolean; at: string }
  | { type: 'intensive_segment_completed'; segmentId: string; at: string }
  | { type: 'intensive_segment_skipped'; segmentId: string; at: string }
  | { type: 'retell_keywords_changed'; keywords: string[]; at: string }
  | { type: 'session_ended'; at: string }

export function createLearningSession(input: Pick<LearningSession, 'id' | 'materialId' | 'purpose' | 'reviewScheduleId' | 'reviewOccurrence' | 'ownerTabId'> & { stages?: LearningStage[] }, at: string): SessionRuntime {
  const stages = input.stages ? [...input.stages] : [...LEARNING_STAGES]
  if (stages.length === 0) throw new Error('learning session requires at least one stage')
  return { session: { ...input, stages, stage: stages[0], stageIndex: 0, segmentIndex: 0, playbackRate: 1, loopSegment: true, audioPlaying: false, intensiveProgress: {}, retellKeywords: [], status: 'active', startedAt: at, lastCheckpointAt: at, endedAt: null }, visibleSince: at, slices: [] }
}

function closeVisible(runtime: SessionRuntime, at: string): SessionRuntime {
  if (!runtime.visibleSince || new Date(at) <= new Date(runtime.visibleSince)) return { ...runtime, visibleSince: null }
  const slice: LearningTimeSlice = { id: `${runtime.session.id}:${runtime.visibleSince}:${at}`, sessionId: runtime.session.id, materialId: runtime.session.materialId, trainingCategory: trainingCategoryForStage(runtime.session.stage), mode: modeForStage(runtime.session.stage, runtime.session.audioPlaying), startedAt: runtime.visibleSince, endedAt: at }
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
    const index = runtime.session.stageIndex
    const final = index === runtime.session.stages.length - 1
    next = { ...closed, visibleSince: final ? null : event.at, session: { ...closed.session, stageIndex: final ? index : index + 1, stage: final ? closed.session.stage : closed.session.stages[index + 1], status: final ? 'completed' : 'active', endedAt: final ? event.at : null } }
  } else if (event.type === 'session_ended') {
    const closed = closeVisible(runtime, event.at)
    next = { ...closed, session: { ...closed.session, status: 'ended', endedAt: event.at } }
  } else if (event.type === 'segment_selected') next = { ...runtime, session: { ...runtime.session, segmentIndex: Math.max(0, event.index) } }
  else if (event.type === 'playback_changed') next = { ...runtime, session: { ...runtime.session, playbackRate: event.rate ?? runtime.session.playbackRate, loopSegment: event.loopSegment ?? runtime.session.loopSegment } }
  else if (event.type === 'audio_playback_changed') {
    const wasVisible = runtime.visibleSince !== null
    const closed = closeVisible(runtime, event.at)
    next = { ...closed, visibleSince: wasVisible ? event.at : null, session: { ...closed.session, audioPlaying: event.playing } }
  }
  else if (event.type === 'retell_keywords_changed') next = { ...runtime, session: { ...runtime.session, retellKeywords: [...event.keywords] } }
  else if (event.type === 'intensive_segment_completed') {
    next = { ...runtime, session: { ...runtime.session, intensiveProgress: { ...runtime.session.intensiveProgress, [event.segmentId]: { completed: 1, skipped: false } } } }
  } else if (event.type === 'intensive_segment_skipped') {
    const progress = runtime.session.intensiveProgress[event.segmentId] ?? { completed: 0, skipped: false }
    next = { ...runtime, session: { ...runtime.session, intensiveProgress: { ...runtime.session.intensiveProgress, [event.segmentId]: { ...progress, skipped: true } } } }
  }
  return { ...next, session: { ...next.session, lastCheckpointAt: event.at } }
}

export function canLeaveIntensiveSegment(session: LearningSession, segmentId: string): boolean {
  const progress = session.intensiveProgress[segmentId]
  return Boolean(progress?.skipped || progress?.completed === 1)
}
