import { useEffect, useMemo, useRef, useState } from 'react'
import { completeStage } from '../../domain/learning'
import type { Material, Segment } from '../../domain/types'
import { SegmentEditor } from './SegmentEditor'

type Props = { material: Material; segments: Segment[]; onComplete: (material: Material) => void; onSegmentsSaved?: (segments: Segment[]) => void; onCompleteReview?: (material: Material) => void; editorOnly?: boolean }

const labels = {
  blind_listen: 'Blind listening',
  intensive_listen: 'Intensive listening',
  shadowing: 'Shadowing',
  retelling: 'Retelling',
  complete: 'First round complete',
} as const

export function PracticeFlow({ material, segments, onComplete, onSegmentsSaved, onCompleteReview, editorOnly = false }: Props) {
  const [stage, setStage] = useState(material.firstRoundStage)
  const [rate, setRate] = useState(1)
  const [activeSegment, setActiveSegment] = useState<Segment | null>(null)
  const [loopSegment, setLoopSegment] = useState(true)
  const [keywords, setKeywords] = useState(material.retellKeywords?.join(', ') ?? '')
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioUrl = useMemo(() => URL.createObjectURL(material.audioBlob), [material.audioBlob])

  useEffect(() => () => URL.revokeObjectURL(audioUrl), [audioUrl])
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = rate }, [rate])
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !activeSegment) return
    const stopAtSegmentEnd = () => {
      if (audio.currentTime < activeSegment.endSeconds) return
      if (loopSegment) audio.currentTime = activeSegment.startSeconds
      else audio.pause()
    }
    audio.addEventListener('timeupdate', stopAtSegmentEnd)
    return () => audio.removeEventListener('timeupdate', stopAtSegmentEnd)
  }, [activeSegment, loopSegment])

  function playSegment(segment: Segment) {
    const audio = audioRef.current
    if (!audio) return
    setActiveSegment(segment)
    audio.currentTime = segment.startSeconds
    void audio.play().catch(() => undefined)
  }

  function finishStage() {
    const retellKeywords = keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean)
    const updated = completeStage({ ...material, firstRoundStage: stage, retellKeywords }, new Date())
    setStage(updated.firstRoundStage)
    onComplete(updated)
  }

  if (editorOnly) return <section className="practice-flow"><h2>管理字幕</h2><audio ref={audioRef} controls src={audioUrl} /><div className="player-controls"><label className="speed-control">播放速度 <select value={rate} onChange={(event) => setRate(Number(event.target.value))}><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option></select></label></div><SegmentEditor durationSeconds={material.durationSeconds} segments={segments} onSegmentsSaved={onSegmentsSaved ?? (() => undefined)} onPlaySegment={playSegment} /></section>
  if (stage === 'complete') return <section className="practice-flow completion-card"><p className="eyebrow">{onCompleteReview ? '到期复习' : '首轮完成'}</p><h2>{onCompleteReview ? '完成这一轮复习' : labels.complete}</h2><p>{onCompleteReview ? '这会按既定间隔安排下一次复习。' : `下次复习：${material.nextReviewAt ?? '已安排'}`}</p>{onCompleteReview && <button className="review-complete-action" type="button" onClick={() => onCompleteReview(material)}>完成本次复习</button>}</section>

  const showTranscript = stage === 'intensive_listen' || stage === 'shadowing'
  return (
    <section className="practice-flow" aria-label="Practice flow">
      <div className="stage-rail practice-rail" aria-label={`当前阶段：${labels[stage]}`}><span className={stage === 'blind_listen' ? 'active' : ''}>听</span><i /><span className={stage === 'intensive_listen' ? 'active' : ''}>看</span><i /><span className={stage === 'shadowing' ? 'active' : ''}>跟</span><i /><span className={stage === 'retelling' ? 'active' : ''}>说</span></div>
      <h2>{labels[stage]}</h2>
      <p className="stage-instruction">{stage === 'blind_listen' ? '先完整听一遍。不要急着看原文。' : stage === 'intensive_listen' ? '逐句校对你听到的内容，必要时修正时间和文本。' : stage === 'shadowing' ? '跟着句子开口，节奏比完美更重要。' : '合上原文，用自己的话复述这段内容。'}</p>
      <audio ref={audioRef} controls src={audioUrl} />
      {stage !== 'blind_listen' && <div className="player-controls"><label className="speed-control">播放速度 <select value={rate} onChange={(event) => setRate(Number(event.target.value))}><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option></select></label><label className="loop-control"><input type="checkbox" checked={loopSegment} onChange={(event) => setLoopSegment(event.target.checked)} /> 循环当前句</label></div>}
      {showTranscript && <SegmentEditor durationSeconds={material.durationSeconds} segments={segments} onSegmentsSaved={onSegmentsSaved ?? (() => undefined)} onPlaySegment={playSegment} />}
      {stage === 'retelling' && <label className="keyword-prompt">复述关键词<input aria-label="复述关键词" value={keywords} placeholder="例如：人物、转折、结论" onChange={(event) => setKeywords(event.target.value)} /><small>用逗号分隔；它们只在这段材料的复述中显示。</small></label>}
      <button className="primary-action complete-stage" type="button" onClick={finishStage}>完成{labels[stage]}</button>
    </section>
  )
}
