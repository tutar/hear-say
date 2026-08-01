import { useState } from 'react'
import type { RecordingDraft } from '../../domain/recording-draft'

const SAMPLE_RATE = 16_000
const timeLabel = (sample: number) => {
  const seconds = sample / SAMPLE_RATE
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`
}

export function RecordingDraftEditor({ draft, audioUrl, onBack, onImport, onExclusionsChange }: { draft: RecordingDraft; audioUrl: string; onBack: () => void; onImport: (title: string) => void; onExclusionsChange: (intervals: RecordingDraft['excludedIntervals']) => void }) {
  const [title, setTitle] = useState(draft.source.title)
  const [excludeStart, setExcludeStart] = useState('')
  const [excludeEnd, setExcludeEnd] = useState('')
  const addExclusion = () => {
    const start = Number(excludeStart); const end = Number(excludeEnd)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > draft.durationSeconds) return
    onExclusionsChange([...draft.excludedIntervals, { startSample: Math.round(start * SAMPLE_RATE), endSample: Math.round(end * SAMPLE_RATE) }])
    setExcludeStart(''); setExcludeEnd('')
  }
  return <section className="recording-draft-editor">
    <header><button type="button" onClick={onBack}>← 返回资料库</button><p className="eyebrow">录制草稿</p><h2>{draft.source.title}</h2><p>{draft.source.site} · {Math.round(draft.sizeBytes / 1024 / 1024 * 10) / 10} MB</p></header>
    <div className="draft-audio-desk"><span className="draft-audio-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span><div className="draft-exclusion-track" aria-label="排除片段时间轴">{draft.excludedIntervals.map((interval) => <i key={`${interval.startSample}-${interval.endSample}`} style={{ left: `${interval.startSample / SAMPLE_RATE / draft.durationSeconds * 100}%`, width: `${(interval.endSample - interval.startSample) / SAMPLE_RATE / draft.durationSeconds * 100}%` }} />)}</div><audio aria-label="预览录音" src={audioUrl} controls /></div>
    <section className="draft-cut-editor" aria-labelledby="draft-cut-title"><div><p className="eyebrow">Non-destructive edit</p><h3 id="draft-cut-title">排除不需要的片段</h3></div><div className="draft-cut-inputs"><label>开始（秒）<input aria-label="排除开始时间" type="number" min="0" max={draft.durationSeconds} step="0.1" value={excludeStart} onChange={(event) => setExcludeStart(event.target.value)} /></label><label>结束（秒）<input aria-label="排除结束时间" type="number" min="0" max={draft.durationSeconds} step="0.1" value={excludeEnd} onChange={(event) => setExcludeEnd(event.target.value)} /></label><button type="button" onClick={addExclusion}>排除这个片段</button></div>{draft.excludedIntervals.length > 0 && <ul>{draft.excludedIntervals.map((interval) => { const label = `${timeLabel(interval.startSample)}–${timeLabel(interval.endSample)}`; return <li key={label}><span>{label}</span><button type="button" aria-label={`撤销排除 ${label}`} onClick={() => onExclusionsChange(draft.excludedIntervals.filter((item) => item !== interval))}>撤销</button></li> })}</ul>}</section>
    <form onSubmit={(event) => { event.preventDefault(); if (title.trim()) onImport(title.trim()) }}>
      <label>材料名称<input aria-label="材料名称" value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
      <p>确认后才会转写并加入资料库。来源地址不会发送给转写服务。</p>
      <button className="primary-action" type="submit">导入资料库</button>
    </form>
  </section>
}
