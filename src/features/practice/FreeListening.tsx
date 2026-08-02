import { useEffect, useMemo, useRef, useState } from 'react'
import { moveFreeListeningCursor } from '../../domain/free-listening'
import type { FreeListeningPreferences, FreeListeningProgress, Material, Segment } from '../../domain/types'
import { PlaybackRateSelect, PlayerSelect, PlayGlyph, StepGlyph } from './PlayerControls'
import { WordRepository } from '../../db/word-repository'
import { useListeningSession } from './useListeningSession'

type Props = {
  material: Material
  segments: Segment[]
  preferences: FreeListeningPreferences
  progress: FreeListeningProgress | undefined
  onPreferencesChange: (preferences: FreeListeningPreferences) => void | Promise<void>
  onProgressChange: (progress: FreeListeningProgress) => void | Promise<void>
  onPlaybackChange?: (playing: boolean) => void
  mode?: 'free' | 'blind'
}

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

export function FreeListening({ material, segments, preferences: initialPreferences, progress, onPreferencesChange, onProgressChange, onPlaybackChange, mode = 'free' }: Props) {
  const [preferences, setPreferences] = useState(initialPreferences)
  const [difficultWords, setDifficultWords] = useState<string[]>([])
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const session = useListeningSession(segments, Math.min(progress?.segmentIndex ?? 0, Math.max(segments.length - 1, 0)), progress?.positionSeconds ?? segments[progress?.segmentIndex ?? 0]?.startSeconds ?? 0, preferences.playbackRate, preferences.loopMode)
  const audioRef = session.audioRef
  const { segmentIndex, position, playing } = { segmentIndex: session.state.segmentIndex, position: session.state.positionSeconds, playing: session.state.playing }
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([])
  const audioUrl = useMemo(() => URL.createObjectURL(material.audioBlob), [material.audioBlob])
  const current = segments[segmentIndex]
  useEffect(() => { void new WordRepository().listEntries().then((entries) => setDifficultWords(entries.map((entry) => entry.term).filter(Boolean))) }, [])

  useEffect(() => () => URL.revokeObjectURL(audioUrl), [audioUrl])
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = preferences.playbackRate }, [preferences.playbackRate])
  useEffect(() => { if (preferences.viewMode === 'list') rowRefs.current[segmentIndex]?.scrollIntoView?.({ block: 'nearest' }) }, [preferences.viewMode, segmentIndex])
  useEffect(() => {
    const timer = window.setInterval(() => saveProgress(), 5_000)
    return () => { clearInterval(timer); saveProgress() }
  // Persist the latest playback cursor without restarting the timer on every tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.id, segmentIndex])

  function saveProgress(nextPosition = audioRef.current?.currentTime ?? position) {
    void onProgressChange({ materialId: material.id, segmentIndex, positionSeconds: nextPosition, updatedAt: new Date().toISOString() })
  }
  function changePreferences(changes: Partial<FreeListeningPreferences>) {
    const next = { ...preferences, ...changes }
    setPreferences(next)
    void onPreferencesChange(next)
    saveProgress()
  }
  function selectSegment(index: number, autoplay = playing) {
    const segment = segments[index]
    if (!segment) return
    session.selectSegment(index, autoplay)
  }
  function move(direction: -1 | 1, automatic = false) {
    const moved = moveFreeListeningCursor(segmentIndex, segments.length, automatic ? preferences.loopMode : 'full', direction)
    selectSegment(moved.index, automatic ? moved.continuePlaying : playing)
    if (automatic && !moved.continuePlaying) audioRef.current?.pause()
  }
  function togglePlay() {
    const audio = audioRef.current
    if (!audio || !current) return
    if (audio.paused) {
      if (audio.currentTime < current.startSeconds || audio.currentTime >= current.endSeconds) audio.currentTime = current.startSeconds
      void audio.play().catch(() => undefined)
    } else audio.pause()
  }
  function onTimeUpdate() {
    const audio = audioRef.current
    if (!audio || !current) return
    session.dispatch({ type: 'seek', positionSeconds: audio.currentTime })
    if (audio.currentTime >= current.endSeconds) move(1, true)
  }

  const chunked = current?.text.split(/([,;:.!?]\s*)/).filter(Boolean)
  const maskText = (text: string) => {
    if (preferences.maskMode === 'all' || !difficultWords.length) return text.replace(/\S/g, '·')
    const terms = difficultWords.filter((word) => /^[a-z][a-z' -]*$/i.test(word)).sort((a, b) => b.length - a.length)
    if (!terms.length) return text
    return text.replace(new RegExp(`\\b(${terms.map((term) => term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'))})[a-z]*\\b`, 'ig'), (match) => '·'.repeat(match.length))
  }
  return <main className="free-listening">
    <audio ref={audioRef} src={audioUrl} onTimeUpdate={onTimeUpdate} onPlay={() => { session.dispatch({ type: 'play' }); onPlaybackChange?.(true) }} onPause={() => { session.dispatch({ type: 'pause' }); saveProgress(); onPlaybackChange?.(false) }} />
    <header className="free-listening-heading"><span className="listening-mode">{mode === 'blind' ? '全文盲听' : '随心听'}</span><div><p className="eyebrow">{mode === 'blind' ? 'Blind listening' : 'Free listening'}</p><h1>{material.title}</h1></div><PlaybackRateSelect value={preferences.playbackRate} onChange={(playbackRate) => changePreferences({ playbackRate })} compact /></header>
    <section className={`free-listening-stage ${preferences.textVisible ? '' : 'is-hidden'}`} aria-label="播放内容">
      {preferences.viewMode === 'single' ? <div className="free-sentence">
        {preferences.textVisible ? <>
          <p>{preferences.chunksVisible ? chunked?.map((part, index) => <mark key={`${part}-${index}`}>{part}</mark>) : current?.text}</p>
          <div className="content-switches free-help-switches"><button type="button" className={preferences.analysisVisible ? 'active' : ''} aria-pressed={preferences.analysisVisible} onClick={() => changePreferences({ analysisVisible: !preferences.analysisVisible })}>解析</button><button type="button" className={preferences.translationVisible ? 'active' : ''} aria-pressed={preferences.translationVisible} onClick={() => changePreferences({ translationVisible: !preferences.translationVisible })}>翻译</button><button type="button" className={preferences.chunksVisible ? 'active' : ''} aria-pressed={preferences.chunksVisible} onClick={() => changePreferences({ chunksVisible: !preferences.chunksVisible })}>意群</button></div>
          {preferences.translationVisible && <aside><strong>翻译</strong><p>在这里查看当前句子的中文理解。</p></aside>}
          {preferences.analysisVisible && <aside><strong>解析</strong><p>先找句子的主干，再结合语境理解修饰成分。</p></aside>}
        </> : <div className="hidden-copy"><span aria-hidden="true">•••</span><p>文本已隐藏，保持专注聆听</p></div>}
      </div> : <><ol className="free-sentence-list">{segments.map((segment, index) => <li key={segment.id}><button ref={(node) => { rowRefs.current[index] = node }} type="button" aria-current={index === segmentIndex ? 'true' : undefined} onClick={() => { selectSegment(index); setDetailIndex(index) }}><span>{String(index + 1).padStart(2, '0')}</span>{preferences.textVisible ? segment.text : <i>{maskText(segment.text)}</i>}</button></li>)}</ol>{detailIndex !== null && <section className="free-sentence-detail" aria-label="句子详情"><header><strong>第 {detailIndex + 1} 句</strong><button type="button" aria-label="关闭句子详情" onClick={() => setDetailIndex(null)}>×</button></header><p>{segments[detailIndex]?.text}</p><div className="content-switches"><button type="button" className={preferences.analysisVisible ? 'active' : ''} onClick={() => changePreferences({ analysisVisible: !preferences.analysisVisible })}>解析</button><button type="button" className={preferences.translationVisible ? 'active' : ''} onClick={() => changePreferences({ translationVisible: !preferences.translationVisible })}>翻译</button><button type="button" className={preferences.chunksVisible ? 'active' : ''} onClick={() => changePreferences({ chunksVisible: !preferences.chunksVisible })}>意群</button></div>{preferences.translationVisible && <p>在这里查看当前句子的中文理解。</p>}{preferences.analysisVisible && <p>先找句子的主干，再结合语境理解修饰成分。</p>}</section>}</>}
    </section>
    <section className="free-player" aria-label="播放器">
      <div className="free-progress"><span>{formatTime(position)}</span><div><input aria-label="播放进度" type="range" min={0} max={material.durationSeconds ?? current?.endSeconds ?? 0} step="0.1" value={position} onChange={(event) => { const value = Number(event.target.value); session.dispatch({ type: 'seek', positionSeconds: value }); if (audioRef.current) audioRef.current.currentTime = value }} /><i style={{ width: `${material.durationSeconds ? Math.min(100, position / material.durationSeconds * 100) : 0}%` }} /></div><span>{formatTime(material.durationSeconds ?? 0)}</span></div>
      <div className="free-player-controls"><button type="button" aria-label="上一句" onClick={() => move(-1)}><StepGlyph direction="previous" /></button><button className={`free-play round-play-button ${playing ? 'is-playing' : ''}`} type="button" aria-label={playing ? '暂停' : '播放'} onClick={togglePlay}><PlayGlyph playing={playing} /></button><button type="button" aria-label="下一句" onClick={() => move(1)}><StepGlyph direction="next" /></button></div>
      <div className="free-options">
        <div className="segmented-control" aria-label="文本模式"><button type="button" className={preferences.viewMode === 'single' ? 'active' : ''} onClick={() => changePreferences({ viewMode: 'single' })}>单句</button><button type="button" className={preferences.viewMode === 'list' ? 'active' : ''} onClick={() => changePreferences({ viewMode: 'list' })}>每句列表</button></div>
        <button className="eye-control" type="button" aria-label={preferences.textVisible ? '隐藏字幕' : '偷看字幕'} onClick={() => changePreferences({ textVisible: !preferences.textVisible })}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.8" />{!preferences.textVisible && <path d="m4 4 16 16" />}</svg>{preferences.textVisible ? '隐藏字幕' : '偷看字幕'}</button><PlayerSelect label="遮挡" ariaLabel="遮挡模式" value={preferences.maskMode} onChange={(maskMode) => changePreferences({ maskMode: maskMode as FreeListeningPreferences['maskMode'] })}><option value="all">全部遮挡</option><option value="difficult">困难词遮挡</option></PlayerSelect>
        <PlayerSelect label="循环" ariaLabel="循环模式" value={preferences.loopMode} onChange={(loopMode) => changePreferences({ loopMode: loopMode as FreeListeningPreferences['loopMode'] })}><option value="off">不循环</option><option value="full">整篇循环</option><option value="sentence">单句循环</option></PlayerSelect>
      </div>
    </section>
  </main>
}
