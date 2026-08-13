import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type React from 'react'
import { completeStage } from '../../domain/learning'
import type { FirstRoundStage, LearningStage, Material, ReviewStage, Segment } from '../../domain/types'
import { SegmentEditor } from './SegmentEditor'
import { SelectionTranslator } from '../library/SelectionTranslator'
import type { WordSource } from '../../domain/types'
import type { VocabularyLookup, VocabularySelection } from '../../services/vocabulary-service'
import { PlaybackRateSelect, PlayGlyph, StepGlyph } from './PlayerControls'
import { useListeningSession } from './useListeningSession'
import { SentenceSupportControls } from './SentenceSupportPanel'
import { OralShadowingFeedback } from './OralShadowingFeedback'
import { createWebSpeechOralRecognizer, type OralRecognizer } from '../../services/oral-recognition'
import { VoskOralRecognizer } from '../../services/vosk-oral-recognition'

type IntensiveProgress = Record<string, { completed: number; skipped: boolean }>
type Props = { material: Material; segments: Segment[]; onComplete: (material: Material) => void; onSegmentsSaved?: (segments: Segment[]) => void | Promise<void>; onSentenceEditChange?: (dirty: boolean) => void; onCompleteReview?: (material: Material) => void; onReviewStageComplete?: () => void; onPlaybackChange?: (playing: boolean) => void; onIntensiveSegmentComplete?: (segmentId: string) => void; onIntensiveSegmentSkip?: (segmentId: string) => void; onIntensiveSegmentSelect?: (index: number) => void; initialIntensiveProgress?: IntensiveProgress; initialSegmentIndex?: number; reviewStages?: ReviewStage[]; difficultSegmentIds?: string[]; editorOnly?: boolean; retrospective?: boolean; onExit?: () => void; navigation?: ReactNode; onVocabularyLookup?: (selection: VocabularySelection) => Promise<VocabularyLookup>; onVocabularyAdd?: (selection: VocabularySelection, lookup: VocabularyLookup, source: WordSource) => Promise<void>; onVocabularySpeak?: (term: string) => void; onVocabularyOpenSettings?: () => void; oralRecognizer?: OralRecognizer | null }

const labels = {
  blind_listen: 'Blind listening',
  intensive_listen: 'Intensive listening',
  shadowing: '难句跟读',
  difficult_practice: '难句补练',
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

export function PracticeFlow({ material, segments, onComplete, onSegmentsSaved, onSentenceEditChange, onCompleteReview, onReviewStageComplete, onPlaybackChange, onIntensiveSegmentComplete, onIntensiveSegmentSkip, onIntensiveSegmentSelect, initialIntensiveProgress = {}, initialSegmentIndex = 0, reviewStages, difficultSegmentIds, editorOnly = false, retrospective = false, onExit, navigation, onVocabularyLookup, onVocabularyAdd, onVocabularySpeak, onVocabularyOpenSettings, oralRecognizer }: Props) {
  const [stage, setStage] = useState<LearningStage | 'complete'>(onCompleteReview ? reviewStages?.[0] ?? 'blind_listen' : material.firstRoundStage)
  const [rate, setRate] = useState(1)
  const [activeSegment, setActiveSegment] = useState<Segment | null>(null)
  const [loopSegment, setLoopSegment] = useState(false)
  const [keywords, setKeywords] = useState(material.retellKeywords?.join(', ') ?? '')
  const [segmentIndex, setSegmentIndex] = useState(() => Math.min(Math.max(initialSegmentIndex, 0), Math.max(segments.length - 1, 0)))
  const [needsHelp, setNeedsHelp] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [helpOptions, setHelpOptions] = useState({ analysis: true, translation: false, chunks: false })
  const [intensiveProgress, setIntensiveProgress] = useState<IntensiveProgress>(initialIntensiveProgress)
  const [difficultIndex, setDifficultIndex] = useState(0)
  const [difficultResults, setDifficultResults] = useState<Record<string, 'done' | 'skipped'>>({})
  const [oralAutoStartToken, setOralAutoStartToken] = useState(0)
  const [firstRoundDifficultIds, setFirstRoundDifficultIds] = useState<string[]>([])
  const fullPlayRef = useRef(false)
  const [vocabularySelection, setVocabularySelection] = useState<VocabularySelection | null>(null)
  const [bookmarkOverrides, setBookmarkOverrides] = useState<Record<string, boolean>>({})
  const [bookmarkError, setBookmarkError] = useState('')
  const [countdown, setCountdown] = useState<{ segmentId: string; remainingMs: number; running: boolean } | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const currentSegment = segments[segmentIndex] ?? null
  const listening = useListeningSession(segments, segmentIndex, currentSegment?.startSeconds ?? 0, rate, loopSegment ? 'sentence' : 'off')
  const audioUrl = useMemo(() => URL.createObjectURL(material.audioBlob), [material.audioBlob])
  const activeOralRecognizer = useMemo(() => oralRecognizer === undefined ? createWebSpeechOralRecognizer() : oralRecognizer, [oralRecognizer])
  const localOralRecognizer = useMemo(() => new VoskOralRecognizer(), [])

  useEffect(() => () => URL.revokeObjectURL(audioUrl), [audioUrl])
  useEffect(() => { if (onCompleteReview && reviewStages?.length) setStage(reviewStages[0]) }, [onCompleteReview, reviewStages])
  useEffect(() => { if (stage === 'shadowing' && firstRoundDifficultIds.length === 0) setFirstRoundDifficultIds(segments.filter((segment) => segment.isDifficult).map((segment) => segment.id)) }, [stage, segments, firstRoundDifficultIds.length])
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = rate }, [rate])
  useEffect(() => {
    const audio = (stage === 'intensive_listen' ? listening.audioRef : audioRef).current
    if (!audio || !activeSegment) return
    const stopAtSegmentEnd = () => {
      if (audio.currentTime < activeSegment.endSeconds) return
      if (stage === 'intensive_listen') { audio.pause(); setCountdown((current) => current?.segmentId === activeSegment.id ? current : { segmentId: activeSegment.id, remainingMs: 4_000, running: true }); return }
      fullPlayRef.current = loopSegment
      if (stage === 'shadowing' || stage === 'difficult_practice') { audio.pause(); setOralAutoStartToken((token) => token + 1) }
      else if (loopSegment) audio.currentTime = activeSegment.startSeconds
      else audio.pause()
    }
    audio.addEventListener('timeupdate', stopAtSegmentEnd)
    return () => audio.removeEventListener('timeupdate', stopAtSegmentEnd)
  }, [activeSegment, loopSegment, stage])
  useEffect(() => {
    if (!countdown?.running) return
    const timer = window.setInterval(() => setCountdown((current) => {
      if (!current?.running) return current
      if (current.remainingMs > 100) return { ...current, remainingMs: current.remainingMs - 100 }
      window.clearInterval(timer)
      finishIntensiveSentence(current.segmentId)
      return null
    }), 100)
    return () => window.clearInterval(timer)
  // The completion routine intentionally consumes the current segment snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown?.running, countdown?.segmentId])

  function playSegment(segment: Segment) {
    const audio = (stage === 'intensive_listen' ? listening.audioRef : audioRef).current
    if (!audio) return
    setActiveSegment(segment)
    fullPlayRef.current = true
    audio.currentTime = segment.startSeconds
    void audio.play().catch(() => undefined)
  }
  function togglePlayback() {
    const audio = (stage === 'intensive_listen' ? listening.audioRef : audioRef).current
    if (!audio || !currentSegment) return
    if (isPlaying) audio.pause()
    else {
      if (audio.currentTime < currentSegment.startSeconds || audio.currentTime >= currentSegment.endSeconds) audio.currentTime = currentSegment.startSeconds
      setActiveSegment(currentSegment)
      if (audio.currentTime <= currentSegment.startSeconds + .15) fullPlayRef.current = true
      void audio.play().catch(() => undefined)
    }
  }

  function finishStage() {
    if (retrospective) { onExit?.(); return }
    if (onCompleteReview && reviewStages) {
      const index = reviewStages.indexOf(stage as ReviewStage)
      onReviewStageComplete?.()
      setStage(index >= 0 && index < reviewStages.length - 1 ? reviewStages[index + 1] : 'complete')
      return
    }
    const retellKeywords = keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean)
    const updated = completeStage({ ...material, firstRoundStage: stage as FirstRoundStage, retellKeywords }, new Date())
    setStage(updated.firstRoundStage)
    onComplete(updated)
  }

  function finishIntensiveSentence(segmentId: string) {
    const index = segments.findIndex((segment) => segment.id === segmentId)
    if (index < 0) return
    setIntensiveProgress((current) => ({ ...current, [segmentId]: { completed: 1, skipped: false } }))
    onIntensiveSegmentComplete?.(segmentId)
    if (index === segments.length - 1) {
      if (retrospective) return
      let updated = completeStage({ ...material, firstRoundStage: 'intensive_listen' }, new Date())
      if (!segments.some((segment) => segment.isDifficult)) updated = completeStage(updated, new Date())
      setStage(updated.firstRoundStage)
      onComplete(updated)
      return
    }
    const next = segments[index + 1]
    setSegmentIndex(index + 1)
    onIntensiveSegmentSelect?.(index + 1)
    setActiveSegment(next)
    listening.selectSegment(index + 1, true)
  }

  function skipAndMove(nextIndex: number) {
    setCountdown(null)
    if (currentSegment) {
      setIntensiveProgress((current) => ({ ...current, [currentSegment.id]: { completed: currentIntensiveProgress.completed, skipped: true } }))
      onIntensiveSegmentSkip?.(currentSegment.id)
    }
    moveAndPlay(nextIndex)
  }

  function moveAndPlay(nextIndex: number) {
    setCountdown(null)
    moveToSegment(nextIndex)
    const next = segments[nextIndex]
    if (next) { setActiveSegment(next); listening.selectSegment(nextIndex, true); onIntensiveSegmentSelect?.(nextIndex) }
  }

  const currentIntensiveProgress = currentSegment ? intensiveProgress[currentSegment.id] ?? { completed: 0, skipped: false } : { completed: 0, skipped: false }
  const analysis = sentenceAnalysis(currentSegment?.text ?? '')
  function moveToSegment(nextIndex: number) {
    const index = Math.min(Math.max(nextIndex, 0), Math.max(segments.length - 1, 0))
    setSegmentIndex(index)
    setNeedsHelp(false)
    setHelpOptions({ analysis: true, translation: false, chunks: false })
    setVocabularySelection(null)
    if (segments[index]) playSegment(segments[index])
  }
  async function markDifficult() {
    if (!currentSegment) return
    const previous = bookmarkOverrides[currentSegment.id] ?? currentSegment.isDifficult
    const isDifficult = !previous
    setBookmarkError('')
    setBookmarkOverrides((current) => ({ ...current, [currentSegment.id]: isDifficult }))
    try {
      await onSegmentsSaved?.(segments.map((segment) => segment.id === currentSegment.id ? { ...segment, isDifficult } : segment))
    } catch (cause) {
      setBookmarkOverrides((current) => ({ ...current, [currentSegment.id]: previous }))
      setBookmarkError(cause instanceof Error ? cause.message : '难句收藏保存失败，请重试。')
    }
  }
  function toggleHelp(option: keyof typeof helpOptions) {
    setHelpOptions((current) => ({ ...current, [option]: !current[option] }))
  }
  function selectVocabulary() {
    if (!currentSegment || !onVocabularyLookup) return
    const term = window.getSelection()?.toString().trim() ?? ''
    if (term) setVocabularySelection({ term, sentence: currentSegment.text.slice(0, 500) })
  }
  const currentSegmentMarked = currentSegment ? bookmarkOverrides[currentSegment.id] ?? currentSegment.isDifficult : false

  if (editorOnly) return <section className="practice-flow"><h2>管理字幕</h2><audio ref={audioRef} controls src={audioUrl} /><div className="player-controls"><PlaybackRateSelect value={rate} onChange={setRate} /></div><SegmentEditor durationSeconds={material.durationSeconds} segments={segments} onSegmentsSaved={onSegmentsSaved ?? (() => undefined)} onPlaySegment={playSegment} onDirtyChange={onSentenceEditChange} /></section>
  if (stage === 'complete') return <section className="practice-flow completion-card"><p className="eyebrow">{onCompleteReview ? '到期复习' : '首轮完成'}</p><h2>{onCompleteReview ? '完成这一轮复习' : labels.complete}</h2><p>{onCompleteReview ? '这会按既定间隔安排下一次复习。' : `下次复习：${material.nextReviewAt ?? '已安排'}`}</p>{onCompleteReview && <button className="review-complete-action" type="button" onClick={() => onCompleteReview(material)}>完成本次复习</button>}</section>

  if (stage === 'intensive_listen') return <main className="intensive-listening">
    <audio ref={(node) => { listening.audioRef.current = node; audioRef.current = node }} src={audioUrl} onPlay={() => { listening.dispatch({ type: 'play' }); setIsPlaying(true); onPlaybackChange?.(true) }} onPause={() => { listening.dispatch({ type: 'pause' }); setIsPlaying(false); onPlaybackChange?.(false) }} onSeeking={() => {
      const audio = audioRef.current
      if (!audio || !currentSegment || Math.abs(audio.currentTime - currentSegment.startSeconds) > .15) fullPlayRef.current = false
    }} onEnded={() => setIsPlaying(false)} />
    <header className="intensive-header">
      {navigation ?? <button type="button" className="intensive-icon" aria-label="退出逐句精听" onClick={onExit}>×</button>}
      <h1>{needsHelp ? '难句解读' : '逐句精听'}</h1>
      <PlaybackRateSelect value={rate} onChange={setRate} compact />
    </header>
    <div className="sentence-progress"><i style={{ width: `${segments.length === 0 ? 0 : ((segmentIndex + 1) / segments.length) * 100}%` }} /><div><span>第 {Math.min(segmentIndex + 1, segments.length)}/{segments.length} 句</span><span>{currentSegment ? (currentSegment.endSeconds - currentSegment.startSeconds).toFixed(1) : '0.0'} 秒</span></div></div>
    <button className={`difficulty-toggle ${currentSegmentMarked ? 'is-marked' : ''}`} type="button" aria-label={currentSegmentMarked ? '取消难句收藏' : '收藏为难句'} aria-pressed={currentSegmentMarked} onClick={() => void markDifficult()}><span>{currentSegmentMarked ? '已收藏' : '收藏难句'}</span><svg className="bookmark-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M7 3.5h10v17l-5-3.4-5 3.4Z" /></svg></button>
    {bookmarkError && <p className="bookmark-error" role="alert">{bookmarkError}</p>}
    <section className={`sentence-stage ${needsHelp ? 'has-help' : ''}`}>
      {!needsHelp ? <div className="listen-prompt" aria-hidden="true"><span>◉</span><i /><i /><i /></div> : <>
        <SentenceSupportControls state={helpOptions} onChange={(state) => setHelpOptions(state)} />
        <div className="sentence-help">
          <div className="sentence-focus">
            {helpOptions.chunks
              ? <p className="sentence-transcript sentence-chunks" onMouseUp={selectVocabulary}>{currentSegment?.text.split(/([,;:.!?]\s*)/).filter(Boolean).map((chunk, index) => <mark key={`${chunk}-${index}`}>{chunk}</mark>)}</p>
              : <p className="sentence-transcript" onMouseUp={selectVocabulary}>{currentSegment?.text || '当前句没有字幕。'}</p>}
            {helpOptions.translation && <p className="sentence-inline-translation" aria-label="翻译">当前材料没有可用翻译。</p>}
          </div>
          {vocabularySelection && onVocabularyLookup && onVocabularyAdd && <div className="practice-selection-translation"><SelectionTranslator selection={vocabularySelection} onLookup={onVocabularyLookup} onAdd={(lookup) => onVocabularyAdd(vocabularySelection, lookup, { kind: 'material', title: material.title, materialId: material.id, segmentId: currentSegment?.id ?? '' })} onSpeak={onVocabularySpeak ?? (() => undefined)} onOpenSettings={onVocabularyOpenSettings} onClose={() => setVocabularySelection(null)} /></div>}
          {helpOptions.analysis && <div className="analysis-sheet help-analysis">
            <section><h2><span aria-hidden="true">Aa</span>重点词汇</h2>{analysis.keywords.length > 0 ? <ul>{analysis.keywords.map((word) => <li key={word}><strong>{word}</strong><span>内容词，通常承载句子的关键信息；结合上下文确认具体含义。</span></li>)}</ul> : <p>这句话没有明显的长内容词。重点关注动词和名词在上下文中的含义。</p>}</section>
            <section><h2><span aria-hidden="true">◉</span>听力提示</h2>{analysis.weakWords.length > 0 ? <ul><li><strong>{analysis.weakWords.join(' · ')}</strong><span>这些功能词在自然语流中常被弱读。先抓住前后的重读内容词，再补全它们。</span></li></ul> : <p>按意群寻找重音，注意相邻单词之间可能发生的连读和音节省略。</p>}</section>
            <section><h2><span aria-hidden="true">▤</span>语法</h2><p>{analysis.grammar}</p></section>
          </div>}
        </div>
      </>}
    </section>
    <div className="intensive-controls">
      {!needsHelp && <button className="help-action" type="button" onClick={() => { setNeedsHelp(true); setHelpOptions({ analysis: true, translation: false, chunks: false }) }}>听不太懂 <span aria-hidden="true">→</span></button>}
      <div><button type="button" aria-label="上一句" disabled={segmentIndex === 0} onClick={() => moveAndPlay(segmentIndex - 1)}><StepGlyph direction="previous" /></button><button className={`play-sentence round-play-button ${isPlaying || countdown?.running ? 'is-playing' : ''} ${countdown ? 'is-countdown' : ''}`} style={countdown ? { '--countdown-progress': `${countdown.remainingMs / 40}%` } as React.CSSProperties : undefined} type="button" aria-label={countdown ? countdown.running ? '暂停倒计时' : '继续倒计时' : isPlaying ? '暂停当前句' : '播放当前句'} disabled={!currentSegment} onClick={() => countdown ? setCountdown({ ...countdown, running: !countdown.running }) : togglePlayback()}>{countdown ? <strong>{Math.ceil(countdown.remainingMs / 1000)}</strong> : <PlayGlyph playing={isPlaying} />}</button><button type="button" aria-label="下一句" disabled={segmentIndex >= segments.length - 1} onClick={() => skipAndMove(segmentIndex + 1)}><StepGlyph direction="next" /></button></div>
      <small>{countdown ? countdown.running ? '暂停 4 秒，准备下一句' : '倒计时已暂停' : currentIntensiveProgress.skipped ? '本句已跳过' : currentIntensiveProgress.completed ? '本句已完成' : isPlaying ? '正在播放' : '准备播放'}</small>
    </div>
  </main>

  if (stage === 'shadowing' || stage === 'difficult_practice') {
    const ids = stage === 'difficult_practice' ? difficultSegmentIds ?? [] : firstRoundDifficultIds
    const difficultSegments = ids.map((id) => segments.find((segment) => segment.id === id)).filter((segment): segment is Segment => Boolean(segment))
    const sentence = difficultSegments[difficultIndex]
    const resolved = difficultSegments.every((item) => difficultResults[item.id])
    return <main className="difficult-practice"><audio ref={audioRef} src={audioUrl} onPlay={() => { setIsPlaying(true); onPlaybackChange?.(true) }} onPause={() => { setIsPlaying(false); onPlaybackChange?.(false) }} /><header className="practice-mode-header"><div><h1>{stage === 'shadowing' ? '难句复读' : '难句补练'} <small>（{stage === 'shadowing' ? '首轮练习 正在练习' : '到期复习'} {material.title}）</small></h1></div><PlaybackRateSelect value={rate} onChange={setRate} compact /></header>{sentence ? <><div className="sentence-progress"><i style={{ width: `${(difficultIndex + 1) / difficultSegments.length * 100}%` }} /><div><span>第 {difficultIndex + 1}/{difficultSegments.length} 句</span><span>{difficultResults[sentence.id] === 'done' ? '已完成' : difficultResults[sentence.id] === 'skipped' ? '已跳过' : '待练习'}</span></div></div><section className="difficult-sentence-stage"><span aria-hidden="true">R</span><p className="difficult-sentence-copy">{sentence.text}</p></section><div className="difficult-controls"><button type="button" aria-label="上一句" disabled={difficultIndex === 0} onClick={() => setDifficultIndex((index) => index - 1)}><StepGlyph direction="previous" /></button><button className={`free-play round-play-button ${isPlaying ? 'is-playing' : ''}`} type="button" aria-label={isPlaying ? '暂停当前难句' : '播放当前难句'} onClick={() => { if (!audioRef.current) return; if (isPlaying) audioRef.current.pause(); else { audioRef.current.currentTime = sentence.startSeconds; setActiveSegment(sentence); void audioRef.current.play().catch(() => undefined) } }}><PlayGlyph playing={isPlaying} /></button><button type="button" aria-label="下一句" disabled={difficultIndex === difficultSegments.length - 1} onClick={() => setDifficultIndex((index) => index + 1)}><StepGlyph direction="next" /></button></div><OralShadowingFeedback key={sentence.id} sentence={sentence.text} recognizer={activeOralRecognizer} localRecognizer={localOralRecognizer} autoStartToken={oralAutoStartToken} onSkip={() => setDifficultResults((current) => ({ ...current, [sentence.id]: 'skipped' }))} /><div className="difficult-decisions"><button className="secondary-action" type="button" onClick={() => setDifficultResults((current) => ({ ...current, [sentence.id]: 'skipped' }))}>跳过本句</button><button className="primary-action" type="button" onClick={() => setDifficultResults((current) => ({ ...current, [sentence.id]: 'done' }))}>完成本句</button></div></> : <section className="no-difficult-sentences"><p>本轮没有收藏的难句。</p></section>}<button className="secondary-action complete-stage" type="button" disabled={difficultSegments.length > 0 && !resolved} onClick={finishStage}>完成{labels[stage]}</button></main>
  }

  return (
    <section className="practice-flow" aria-label="Practice flow">
      <div className="stage-rail practice-rail" aria-label={`当前阶段：${labels[stage]}`}><span className={stage === 'blind_listen' ? 'active' : ''}>听</span><i /><span>看</span><i /><span>跟</span><i /><span className={stage === 'retelling' ? 'active' : ''}>说</span></div>
      <h2>{labels[stage]}</h2>
      <p className="stage-instruction">{stage === 'blind_listen' ? '先完整听一遍。不要急着看原文。' : '合上原文，用自己的话复述这段内容。'}</p>
      <audio ref={audioRef} controls src={audioUrl} onPlay={() => onPlaybackChange?.(true)} onPause={() => onPlaybackChange?.(false)} />
      {stage !== 'blind_listen' && <div className="player-controls"><PlaybackRateSelect value={rate} onChange={setRate} /><label className="loop-control"><input type="checkbox" checked={loopSegment} onChange={(event) => setLoopSegment(event.target.checked)} /> 循环当前句</label></div>}
      {stage === 'retelling' && <label className="keyword-prompt">复述关键词<input aria-label="复述关键词" value={keywords} placeholder="例如：人物、转折、结论" onChange={(event) => setKeywords(event.target.value)} /><small>用逗号分隔；它们只在这段材料的复述中显示。</small></label>}
      <button className="primary-action complete-stage" type="button" onClick={finishStage}>完成{labels[stage]}</button>
    </section>
  )
}
