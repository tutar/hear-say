import { useRef } from 'react'
import type { FreeListeningPreferences, FreeListeningProgress, Material, Segment } from '../../domain/types'
import { completeStage } from '../../domain/learning'
import { FreeListening } from './FreeListening'

type Props = { material: Material; segments: Segment[]; preferences: FreeListeningPreferences; progress?: FreeListeningProgress; onPreferencesChange: (preferences: FreeListeningPreferences) => void | Promise<void>; onProgressChange: (progress: FreeListeningProgress) => void | Promise<void>; onPlaybackChange?: (playing: boolean) => void; onComplete?: (material: Material) => void }

export function BlindListeningPage({ material, preferences, onComplete, ...props }: Props) {
  const completed = useRef(false)
  const finish = () => { if (!onComplete || completed.current) return; completed.current = true; onComplete(completeStage(material, new Date())) }
  return <FreeListening {...props} material={material} mode="blind" preferences={{ ...preferences, viewMode: 'list', textVisible: false }} onAudioEnded={onComplete ? finish : undefined} completionAction={onComplete && <button className="primary-action complete-listening" type="button" onClick={finish}>完成全文盲听</button>} />
}
