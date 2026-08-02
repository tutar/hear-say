import type { FreeListeningLoopMode } from './types'

export type ListeningSessionState = { segmentIndex: number; positionSeconds: number; playing: boolean; playbackRate: number; loopMode: FreeListeningLoopMode }
export type ListeningSessionAction = { type: 'play' | 'pause' | 'toggle' } | { type: 'select'; index: number; positionSeconds: number } | { type: 'seek'; positionSeconds: number } | { type: 'rate'; playbackRate: number } | { type: 'loop'; loopMode: FreeListeningLoopMode }

export function reduceListeningSession(state: ListeningSessionState, action: ListeningSessionAction, segmentCount: number): ListeningSessionState {
  switch (action.type) {
    case 'play': return { ...state, playing: true }
    case 'pause': return { ...state, playing: false }
    case 'toggle': return { ...state, playing: !state.playing }
    case 'select': return { ...state, segmentIndex: Math.min(Math.max(action.index, 0), Math.max(segmentCount - 1, 0)), positionSeconds: action.positionSeconds }
    case 'seek': return { ...state, positionSeconds: Math.max(0, action.positionSeconds) }
    case 'rate': return { ...state, playbackRate: Math.min(2, Math.max(.5, action.playbackRate)) }
    case 'loop': return { ...state, loopMode: action.loopMode }
  }
}
