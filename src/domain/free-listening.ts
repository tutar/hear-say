import type { FreeListeningLoopMode, FreeListeningPreferences } from './types'

export const DEFAULT_FREE_LISTENING_PREFERENCES: FreeListeningPreferences = {
  id: 'global',
  viewMode: 'single',
  textVisible: true,
  loopMode: 'off',
  playbackRate: 1,
  analysisVisible: false,
  translationVisible: false,
  chunksVisible: false,
}

export function normalizeFreeListeningPreferences(preferences: FreeListeningPreferences): FreeListeningPreferences {
  return { ...preferences, playbackRate: Math.min(2, Math.max(0.5, Math.round(preferences.playbackRate * 10) / 10)) }
}

export function moveFreeListeningCursor(index: number, count: number, loopMode: FreeListeningLoopMode, direction: -1 | 1): { index: number; continuePlaying: boolean } {
  if (count <= 0) return { index: 0, continuePlaying: false }
  if (loopMode === 'sentence') return { index: Math.min(Math.max(index, 0), count - 1), continuePlaying: true }
  const next = index + direction
  if (next >= 0 && next < count) return { index: next, continuePlaying: true }
  if (loopMode === 'full') return { index: direction === 1 ? 0 : count - 1, continuePlaying: true }
  return { index: Math.min(Math.max(index, 0), count - 1), continuePlaying: false }
}
