import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { completeStage } from '../../domain/learning'
import type { Material, Segment } from '../../domain/types'
import { SegmentEditor } from './SegmentEditor'

type Props = { material: Material; segments: Segment[]; onComplete: (material: Material) => void; onSegmentsSaved?: (segments: Segment[]) => void; onCompleteReview?: (material: Material) => void; editorOnly?: boolean; onExit?: () => void; navigation?: ReactNode }

const labels = {
  blind_listen: 'Blind listening',
  intensive_listen: 'Intensive listening',
  shadowing: 'Shadowing',
  retelling: 'Retelling',
  complete: 'First round complete',
} as const

const functionWords = new Set(['a', 'an', 'the', 'to', 'of', 'for', 'and', 'or', 'but', 'in', 'on', 'at', 'as', 'is', 'are', 'was', 'were'])
function sentenceAnalysis(text: string) {
  const words = text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? []
  const keywords = [...new Set(words.filter((word) => word.length >= 6 && !functionWords.has(word)))].slice(0, 4)
  const weakWords = [...new Set(words.filter((word) => functionWords.has(word)))].slice(0, 5)
  const grammar = /\b(and|or|but)\b/i.test(text)
    ? '句中包含并列连接词。先分别找出连接词两侧的结构，再理解它们之间的并列或转折关系。'
    : /\b(that|which|who|when|where|because|if)\b/i.test(text)
      ? '句中包含从句信号词。先读懂主句，再判断信号词引出的部分修饰或补充了什么。'
      : /\b(can|could|will|would|should|must|may|might)\b/i.test(text)
        ? '句中包含情态动词。情态动词后接动词原形，重点判断它表达能力、可能、意愿还是必要性。'
        : '先找句子的谓语动词，再确认“谁做什么”；其余内容通常用于补充对象、时间、地点或方式。'
  return { keywords, weakWords, grammar }
}

export function PracticeFlow({ material, segments, onComplete, onSegmentsSaved, onCompleteReview, editorOnly = false, onExit, navigation }: Props) {
  const [stage, setStage] = useState(material.firstRoundStage)
  const [rate, setRate] = useState(1)
  const [activeSegment, setActiveSegment] = useState<Segment | null>(null)
  const [loopSegment, setLoopSegment] = useState(true)
  const [keywords, setKeywords] = useState(material.retellKeywords?.join(', ') ?? '')
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [needsHelp, setNeedsHelp] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [helpOptions, setHelpOptions] = useState({ analysis: true, translation: false, chunks: false })
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
  function togglePlayback() {
    const audio = audioRef.current
    if (!audio || !currentSegment) return
    if (isPlaying) audio.pause()
    else {
      if (audio.currentTime < currentSegment.startSeconds || audio.currentTime >= currentSegment.endSeconds) audio.currentTime = currentSegment.startSeconds
      setActiveSegment(currentSegment)
      void audio.play().catch(() => undefined)
    }
  }

  function finishStage() {
    const retellKeywords = keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean)
    const updated = completeStage({ ...material, firstRoundStage: stage, retellKeywords }, new Date())
    setStage(updated.firstRoundStage)
    onComplete(updated)
  }

  const currentSegment = segments[segmentIndex] ?? null
  const analysis = sentenceAnalysis(currentSegment?.text ?? '')
  function moveToSegment(nextIndex: number) {
    const index = Math.min(Math.max(nextIndex, 0), Math.max(segments.length - 1, 0))
    setSegmentIndex(index)
    setNeedsHelp(false)
    setHelpOptions({ analysis: true, translation: false, chunks: false })
    if (segments[index]) playSegment(segments[index])
  }
  function markDifficult() {
    if (!currentSegment) return
    const isDifficult = !currentSegment.isDifficult
    onSegmentsSaved?.(segments.map((segment) => segment.id === currentSegment.id ? { ...segment, isDifficult } : segment))
  }
  function toggleHelp(option: keyof typeof helpOptions) {
    setHelpOptions((current) => ({ ...current, [option]: !current[option] }))
  }

  if (editorOnly) return <section className="practice-flow"><h2>管理字幕</h2><audio ref={audioRef} controls src={audioUrl} /><div className="player-controls"><label className="speed-control">播放速度 <select value={rate} onChange={(event) => setRate(Number(event.target.value))}><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option></select></label></div><SegmentEditor durationSeconds={material.durationSeconds} segments={segments} onSegmentsSaved={onSegmentsSaved ?? (() => undefined)} onPlaySegment={playSegment} /></section>
  if (stage === 'complete') return <section className="practice-flow completion-card"><p className="eyebrow">{onCompleteReview ? '到期复习' : '首轮完成'}</p><h2>{onCompleteReview ? '完成这一轮复习' : labels.complete}</h2><p>{onCompleteReview ? '这会按既定间隔安排下一次复习。' : `下次复习：${material.nextReviewAt ?? '已安排'}`}</p>{onCompleteReview && <button className="review-complete-action" type="button" onClick={() => onCompleteReview(material)}>完成本次复习</button>}</section>

  if (stage === 'intensive_listen') return <main className="intensive-listening">
    <audio ref={audioRef} src={audioUrl} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} />
    <header className="intensive-header">
      {navigation ?? <button type="button" className="intensive-icon" aria-label="退出逐句精听" onClick={onExit}>×</button>}
      <h1>{needsHelp ? '难句解读' : '逐句精听'}</h1>
      <label className="rate-button">速度<select aria-label="播放速度" value={rate} onChange={(event) => setRate(Number(event.target.value))}><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option></select></label>
    </header>
    <div className="sentence-progress"><i style={{ width: `${segments.length === 0 ? 0 : ((segmentIndex + 1) / segments.length) * 100}%` }} /><div><span>第 {Math.min(segmentIndex + 1, segments.length)}/{segments.length} 句</span><span>{currentSegment ? (currentSegment.endSeconds - currentSegment.startSeconds).toFixed(1) : '0.0'} 秒</span></div></div>
    <button className={`difficulty-toggle ${currentSegment?.isDifficult ? 'is-marked' : ''}`} type="button" aria-label={currentSegment?.isDifficult ? '取消难句收藏' : '收藏为难句'} aria-pressed={Boolean(currentSegment?.isDifficult)} onClick={markDifficult}><span>{currentSegment?.isDifficult ? '已收藏' : '收藏难句'}</span><b aria-hidden="true">{currentSegment?.isDifficult ? '◆' : '◇'}</b></button>
    <section className={`sentence-stage ${needsHelp ? 'has-help' : ''}`}>
      {!needsHelp ? <div className="listen-prompt" aria-hidden="true"><span>◉</span><i /><i /><i /></div> : <>
        <nav className="help-tabs" aria-label="显示辅助内容"><button className={helpOptions.analysis ? 'active' : ''} aria-pressed={helpOptions.analysis} onClick={() => toggleHelp('analysis')}>解析</button><button className={helpOptions.translation ? 'active' : ''} aria-pressed={helpOptions.translation} onClick={() => toggleHelp('translation')}>翻译</button><button className={helpOptions.chunks ? 'active' : ''} aria-pressed={helpOptions.chunks} onClick={() => toggleHelp('chunks')}>意群</button></nav>
        <div className="sentence-help">
          {helpOptions.chunks
            ? <p className="sentence-transcript sentence-chunks">{currentSegment?.text.split(/([,;:.!?]\s*)/).filter(Boolean).map((chunk, index) => <mark key={`${chunk}-${index}`}>{chunk}</mark>)}</p>
            : <p className="sentence-transcript">{currentSegment?.text || '当前句没有字幕。'}</p>}
          {helpOptions.translation && <section className="translation-block" aria-label="翻译"><h2>翻译</h2><p>当前材料没有可用翻译。</p></section>}
          {helpOptions.analysis && <div className="analysis-sheet">
            <section><h2><span aria-hidden="true">Aa</span>重点词汇</h2>{analysis.keywords.length > 0 ? <ul>{analysis.keywords.map((word) => <li key={word}><strong>{word}</strong><span>内容词，通常承载句子的关键信息；结合上下文确认具体含义。</span></li>)}</ul> : <p>这句话没有明显的长内容词。重点关注动词和名词在上下文中的含义。</p>}</section>
            <section><h2><span aria-hidden="true">◉</span>听力提示</h2>{analysis.weakWords.length > 0 ? <ul><li><strong>{analysis.weakWords.join(' · ')}</strong><span>这些功能词在自然语流中常被弱读。先抓住前后的重读内容词，再补全它们。</span></li></ul> : <p>按意群寻找重音，注意相邻单词之间可能发生的连读和音节省略。</p>}</section>
            <section><h2><span aria-hidden="true">▤</span>语法</h2><p>{analysis.grammar}</p></section>
          </div>}
        </div>
      </>}
    </section>
    <div className="intensive-controls">
      {!needsHelp && <button className="help-action" type="button" onClick={() => { setNeedsHelp(true); setHelpOptions({ analysis: true, translation: false, chunks: false }) }}>听不太懂 <span aria-hidden="true">→</span></button>}
      <div><button type="button" aria-label="上一句" disabled={segmentIndex === 0} onClick={() => moveToSegment(segmentIndex - 1)}>◀</button><button className={`play-sentence ${isPlaying ? 'is-playing' : ''}`} type="button" aria-label={isPlaying ? '暂停当前句' : '播放当前句'} disabled={!currentSegment} onClick={togglePlayback}><span aria-hidden="true">{isPlaying ? 'Ⅱ' : '▶'}</span></button><button type="button" aria-label="下一句" disabled={segmentIndex >= segments.length - 1} onClick={() => moveToSegment(segmentIndex + 1)}>▶</button></div>
      <small>{isPlaying ? '正在播放' : '准备播放'} · 第 1/3 遍</small>
    </div>
  </main>

  const showTranscript = stage === 'shadowing'
  return (
    <section className="practice-flow" aria-label="Practice flow">
      <div className="stage-rail practice-rail" aria-label={`当前阶段：${labels[stage]}`}><span className={stage === 'blind_listen' ? 'active' : ''}>听</span><i /><span>看</span><i /><span className={stage === 'shadowing' ? 'active' : ''}>跟</span><i /><span className={stage === 'retelling' ? 'active' : ''}>说</span></div>
      <h2>{labels[stage]}</h2>
      <p className="stage-instruction">{stage === 'blind_listen' ? '先完整听一遍。不要急着看原文。' : stage === 'shadowing' ? '跟着句子开口，节奏比完美更重要。' : '合上原文，用自己的话复述这段内容。'}</p>
      <audio ref={audioRef} controls src={audioUrl} />
      {stage !== 'blind_listen' && <div className="player-controls"><label className="speed-control">播放速度 <select value={rate} onChange={(event) => setRate(Number(event.target.value))}><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option></select></label><label className="loop-control"><input type="checkbox" checked={loopSegment} onChange={(event) => setLoopSegment(event.target.checked)} /> 循环当前句</label></div>}
      {showTranscript && <SegmentEditor durationSeconds={material.durationSeconds} segments={segments} onSegmentsSaved={onSegmentsSaved ?? (() => undefined)} onPlaySegment={playSegment} />}
      {stage === 'retelling' && <label className="keyword-prompt">复述关键词<input aria-label="复述关键词" value={keywords} placeholder="例如：人物、转折、结论" onChange={(event) => setKeywords(event.target.value)} /><small>用逗号分隔；它们只在这段材料的复述中显示。</small></label>}
      <button className="primary-action complete-stage" type="button" onClick={finishStage}>完成{labels[stage]}</button>
    </section>
  )
}
