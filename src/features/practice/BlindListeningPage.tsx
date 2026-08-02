import type { FreeListeningPreferences, FreeListeningProgress, Material, Segment } from '../../domain/types'
import { FreeListening } from './FreeListening'

type Props = { material: Material; segments: Segment[]; preferences: FreeListeningPreferences; progress?: FreeListeningProgress; onPreferencesChange: (preferences: FreeListeningPreferences) => void | Promise<void>; onProgressChange: (progress: FreeListeningProgress) => void | Promise<void>; onPlaybackChange?: (playing: boolean) => void }

export function BlindListeningPage({ preferences, ...props }: Props) {
  return <FreeListening {...props} mode="blind" preferences={{ ...preferences, viewMode: 'list', textVisible: false }} />
}
