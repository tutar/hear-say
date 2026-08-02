import { useEffect, useReducer, useRef } from 'react'
import type { FreeListeningLoopMode, Segment } from '../../domain/types'
import { reduceListeningSession, type ListeningSessionState } from '../../domain/listening-session'

const initial = (segmentIndex: number, positionSeconds: number, playbackRate: number, loopMode: FreeListeningLoopMode): ListeningSessionState => ({ segmentIndex, positionSeconds, playbackRate, loopMode, playing: false })

export function useListeningSession(segments: Segment[], initialIndex: number, initialPosition: number, playbackRate: number, loopMode: FreeListeningLoopMode) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [state, dispatch] = useReducer((current: ListeningSessionState, action: Parameters<typeof reduceListeningSession>[1]) => reduceListeningSession(current, action, segments.length), initial(initialIndex, initialPosition, playbackRate, loopMode))
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = state.playbackRate }, [state.playbackRate])
  const selectSegment = (index: number, autoplay = state.playing) => { const segment = segments[index]; if (!segment) return; dispatch({ type: 'select', index, positionSeconds: segment.startSeconds }); if (audioRef.current) { if (autoplay) void audioRef.current.play().catch(() => undefined); else audioRef.current.pause() } }
  const toggle = () => { const audio = audioRef.current; if (!audio) return; if (audio.paused) void audio.play().catch(() => undefined); else audio.pause() }
  return { audioRef, state, dispatch, selectSegment, toggle }
}
