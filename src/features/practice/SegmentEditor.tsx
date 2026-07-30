import { useState } from 'react'
import { mergeAdjacentSegments, splitSegment, updateSegment } from '../../domain/segments'
import type { Segment } from '../../domain/types'

type Props = { durationSeconds: number | null; segments: Segment[]; onSegmentsSaved: (segments: Segment[]) => void; onPlaySegment?: (segment: Segment) => void }

export function SegmentEditor({ durationSeconds, segments, onSegmentsSaved, onPlaySegment }: Props) {
  const [drafts, setDrafts] = useState(segments)
  const [splitAt, setSplitAt] = useState<Record<string, number>>({})
  const [splitText, setSplitText] = useState<Record<string, { left: string; right: string }>>({})
  const [error, setError] = useState('')

  function save(index: number) {
    try {
      const next = [...drafts]
      next[index] = updateSegment(next[index], {}, durationSeconds)
      setError('')
      onSegmentsSaved(next)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save segment') }
  }

  function merge(index: number) {
    try {
      const next = mergeAdjacentSegments(drafts, drafts[index].id)
      setDrafts(next)
      setError('')
      onSegmentsSaved(next)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to merge segments') }
  }

  function split(index: number) {
    try {
      const segment = drafts[index]
      const atSeconds = splitAt[segment.id] ?? (segment.startSeconds + segment.endSeconds) / 2
      const words = segment.text.trim().split(/\s+/)
      const midpoint = Math.max(1, Math.floor(words.length / 2))
      const text = splitText[segment.id] ?? { left: words.slice(0, midpoint).join(' '), right: words.slice(midpoint).join(' ') || (words.at(-1) ?? '') }
      const replacement = splitSegment(segment, { atSeconds, leftText: text.left, rightText: text.right }, durationSeconds)
      const next = [...drafts.slice(0, index), ...replacement, ...drafts.slice(index + 1)].map((item, order) => ({ ...item, order }))
      setDrafts(next)
      setError('')
      onSegmentsSaved(next)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to split segment') }
  }

  return <section className="segment-editor"><div className="editor-heading"><h3>句子时间轴</h3><p>可以修正识别结果；难句会优先进入复习。</p></div>{error && <p role="alert">{error}</p>}<ol>{drafts.map((segment, index) => <li key={segment.id}>
    <label>Segment {index + 1} text <input aria-label={`Segment ${index + 1} text`} value={segment.text} onChange={(event) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} /></label>
    <label>Start <input aria-label={`Segment ${index + 1} start`} type="number" step="0.1" value={segment.startSeconds} onChange={(event) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, startSeconds: Number(event.target.value) } : item))} /></label>
    <label>End <input aria-label={`Segment ${index + 1} end`} type="number" step="0.1" value={segment.endSeconds} onChange={(event) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, endSeconds: Number(event.target.value) } : item))} /></label>
    <label><input aria-label={`Segment ${index + 1} difficult sentence`} type="checkbox" checked={segment.isDifficult} onChange={(event) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, isDifficult: event.target.checked } : item))} /> Difficult sentence</label>
    {onPlaySegment && <button type="button" onClick={() => onPlaySegment(segment)}>Play segment {index + 1}</button>}
    <button type="button" onClick={() => save(index)}>Save segment {index + 1}</button>
    {index < drafts.length - 1 && <button type="button" onClick={() => merge(index)}>Merge segment {index + 1} with next</button>}
    <label>Split segment {index + 1} at <input aria-label={`Split segment ${index + 1} at`} type="number" step="0.1" value={splitAt[segment.id] ?? (segment.startSeconds + segment.endSeconds) / 2} onChange={(event) => setSplitAt((current) => ({ ...current, [segment.id]: Number(event.target.value) }))} /></label>
    <label>Left split text <input aria-label={`Split segment ${index + 1} left text`} value={splitText[segment.id]?.left ?? segment.text} onChange={(event) => setSplitText((current) => ({ ...current, [segment.id]: { left: event.target.value, right: current[segment.id]?.right ?? segment.text } }))} /></label>
    <label>Right split text <input aria-label={`Split segment ${index + 1} right text`} value={splitText[segment.id]?.right ?? segment.text} onChange={(event) => setSplitText((current) => ({ ...current, [segment.id]: { left: current[segment.id]?.left ?? segment.text, right: event.target.value } }))} /></label>
    <button type="button" onClick={() => split(index)}>Split segment {index + 1}</button>
  </li>)}</ol></section>
}
