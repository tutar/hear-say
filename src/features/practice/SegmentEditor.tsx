import { useEffect, useState } from 'react'
import { mergeAdjacentSegments, splitSegment, updateSegment } from '../../domain/segments'
import type { Segment } from '../../domain/types'

type Props = {
  durationSeconds: number | null
  segments: Segment[]
  onSegmentsSaved: (segments: Segment[]) => void | Promise<void>
  onPlaySegment?: (segment: Segment) => void
  onDirtyChange?: (dirty: boolean) => void
}

export function SegmentEditor({ durationSeconds, segments, onSegmentsSaved, onPlaySegment, onDirtyChange }: Props) {
  const [saved, setSaved] = useState(segments)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Segment | null>(null)
  const [splitAt, setSplitAt] = useState(0)
  const [splitText, setSplitText] = useState({ left: '', right: '' })
  const [error, setError] = useState('')

  useEffect(() => { if (!editingId) setSaved(segments) }, [segments, editingId])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  function beginEdit(segment: Segment) {
    if (editingId) return
    const words = segment.text.trim().split(/\s+/), midpoint = Math.max(1, Math.floor(words.length / 2))
    setEditingId(segment.id)
    setDraft({ ...segment })
    setSplitAt((segment.startSeconds + segment.endSeconds) / 2)
    setSplitText({ left: words.slice(0, midpoint).join(' '), right: words.slice(midpoint).join(' ') || (words.at(-1) ?? '') })
    setError('')
    onDirtyChange?.(true)
  }

  function finishEdit() {
    setEditingId(null)
    setDraft(null)
    setError('')
    onDirtyChange?.(false)
  }

  async function save(index: number) {
    if (!draft) return
    try {
      const next = [...saved]
      next[index] = updateSegment(draft, {}, durationSeconds)
      await onSegmentsSaved(next)
      setSaved(next)
      finishEdit()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save segment') }
  }

  async function merge(index: number) {
    if (!draft) return
    try {
      const source = saved.map((segment) => segment.id === draft.id ? draft : segment)
      const next = mergeAdjacentSegments(source, draft.id)
      await onSegmentsSaved(next)
      setSaved(next)
      finishEdit()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to merge segments') }
  }

  async function split(index: number) {
    if (!draft) return
    try {
      const replacement = splitSegment(draft, { atSeconds: splitAt, leftText: splitText.left, rightText: splitText.right }, durationSeconds)
      const next = [...saved.slice(0, index), ...replacement, ...saved.slice(index + 1)].map((item, order) => ({ ...item, order }))
      await onSegmentsSaved(next)
      setSaved(next)
      finishEdit()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to split segment') }
  }

  return <section className="segment-editor"><div className="editor-heading"><h3>句子时间轴</h3><p>一次编辑一个句子；保存或放弃后才能修改下一句。</p></div>{error && <p role="alert">{error}</p>}<ol>{saved.map((segment, index) => {
    const isEditing = editingId === segment.id
    const value = isEditing && draft ? draft : segment
    return <li key={segment.id}>
      {isEditing ? <>
        <label>Segment {index + 1} text <input aria-label={`Segment ${index + 1} text`} value={value.text} onChange={(event) => setDraft({ ...value, text: event.target.value })} /></label>
        <label>Start <input aria-label={`Segment ${index + 1} start`} type="number" step="0.1" value={value.startSeconds} onChange={(event) => setDraft({ ...value, startSeconds: Number(event.target.value) })} /></label>
        <label>End <input aria-label={`Segment ${index + 1} end`} type="number" step="0.1" value={value.endSeconds} onChange={(event) => setDraft({ ...value, endSeconds: Number(event.target.value) })} /></label>
        <label><input aria-label={`Segment ${index + 1} difficult sentence`} type="checkbox" checked={value.isDifficult} onChange={(event) => setDraft({ ...value, isDifficult: event.target.checked })} /> Difficult sentence</label>
        <button type="button" onClick={() => void save(index)}>Save segment {index + 1}</button>
        <button type="button" onClick={finishEdit}>Discard segment {index + 1} changes</button>
        {index < saved.length - 1 && <button type="button" onClick={() => void merge(index)}>Merge segment {index + 1} with next</button>}
        <label>Split segment {index + 1} at <input aria-label={`Split segment ${index + 1} at`} type="number" step="0.1" value={splitAt} onChange={(event) => setSplitAt(Number(event.target.value))} /></label>
        <label>Left split text <input aria-label={`Split segment ${index + 1} left text`} value={splitText.left} onChange={(event) => setSplitText((current) => ({ ...current, left: event.target.value }))} /></label>
        <label>Right split text <input aria-label={`Split segment ${index + 1} right text`} value={splitText.right} onChange={(event) => setSplitText((current) => ({ ...current, right: event.target.value }))} /></label>
        <button type="button" onClick={() => void split(index)}>Split segment {index + 1}</button>
      </> : <>
        <p><strong>{index + 1}.</strong> {segment.text}</p><small>{segment.startSeconds.toFixed(1)}s – {segment.endSeconds.toFixed(1)}s{segment.isDifficult ? ' · 难句' : ''}</small>
        {onPlaySegment && <button type="button" onClick={() => onPlaySegment(segment)}>Play segment {index + 1}</button>}
        <button type="button" disabled={editingId !== null} onClick={() => beginEdit(segment)}>Edit segment {index + 1}</button>
      </>}
    </li>
  })}</ol></section>
}
