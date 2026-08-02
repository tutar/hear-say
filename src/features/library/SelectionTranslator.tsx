import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { VocabularyLookup, VocabularySelection } from '../../services/vocabulary-service'
import { SpeakerIcon } from './SpeakerIcon'

type Props = {
  selection: VocabularySelection
  onLookup: (selection: VocabularySelection) => Promise<VocabularyLookup>
  onAdd: (lookup: VocabularyLookup) => Promise<void>
  onSpeak: (term: string, lang?: string) => void
  onClose: () => void
  onOpenSettings?: () => void
  onCheckSaved?: (lookup: VocabularyLookup) => Promise<boolean>
}

const isRetryableError = (message: string) => !/请先配置|未授权/.test(message)
const partOfSpeechLabels: Record<string, string> = { noun: 'n.', verb: 'v.', adjective: 'adj.', adverb: 'adv.', preposition: 'prep.', conjunction: 'conj.', pronoun: 'pron.', determiner: 'det.', 名词: 'n.', 动词: 'v.', 形容词: 'adj.', 副词: 'adv.' }

export function SelectionTranslator({ selection, onLookup, onAdd, onSpeak, onClose, onOpenSettings, onCheckSaved }: Props) {
  const [lookup, setLookup] = useState<VocabularyLookup | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')
  const [errorAction, setErrorAction] = useState<'lookup' | 'save' | null>(null)
  const [saved, setSaved] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!dragging) return undefined
    const move = (event: PointerEvent) => movePointer(event)
    const end = (event: PointerEvent) => endDrag(event)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', end)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end) }
  }, [dragging])

  function requestLookup() {
    setStatus('loading')
    setError('')
    setErrorAction(null)
    void onLookup(selection).then(async (result) => { setLookup(result); setSaved(onCheckSaved ? await onCheckSaved(result) : false); setStatus('idle') }).catch((reason) => { setError(reason instanceof Error ? reason.message : '翻译失败'); setErrorAction('lookup'); setStatus('idle') })
  }

  function saveLookup() {
    if (!lookup || saved) return
    setStatus('saving')
    setError('')
    setErrorAction(null)
    void onAdd(lookup).then(() => { setSaved(true); setStatus('saved') }).catch((reason) => { setError(reason instanceof Error ? reason.message : '保存失败'); setErrorAction('save'); setStatus('idle') })
  }

  function retry() { if (errorAction === 'save') saveLookup(); else requestLookup() }

  function onDragStart(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== undefined && event.button !== 0) return
    event.preventDefault()
    drag.current = { pointerId: event.pointerId, x: event.clientX - offset.x, y: event.clientY - offset.y }
    setDragging(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function onMouseDragStart(event: React.MouseEvent<HTMLElement>) {
    if (event.button !== 0 || drag.current) return
    event.preventDefault()
    drag.current = { pointerId: -1, x: event.clientX - offset.x, y: event.clientY - offset.y }
    setDragging(true)
  }

  function movePointer(event: { pointerId: number; clientX: number; clientY: number }) {
    if (!drag.current || (event.pointerId !== undefined && drag.current.pointerId !== event.pointerId)) return
    setOffset({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y })
  }

  function onDragMove(event: ReactPointerEvent<HTMLElement>) { movePointer(event) }

  function endDrag(event: { pointerId: number }) {
    if (!drag.current || (event.pointerId !== undefined && drag.current.pointerId !== event.pointerId)) return
    drag.current = null
    setDragging(false)
  }

  if (!lookup) return <div className="selection-translate-trigger"><button type="button" aria-label={`翻译 ${selection.term}`} disabled={status === 'loading'} onClick={requestLookup}>{status === 'loading' ? '正在翻译…' : '翻译'}</button>{error && <p role="alert">{error} {onOpenSettings && /请先配置|未授权/.test(error) && <button type="button" onClick={onOpenSettings}>前往 AI 服务设置</button>}{isRetryableError(error) && <button type="button" className="selection-retry" aria-label="刷新重试" title="刷新重试" onClick={retry}>↻</button>}<button type="button" onClick={onClose}>关闭</button></p>}</div>

  const escapedTerm = lookup.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const example = lookup.exampleSentenceEn.split(new RegExp(`(\\b${escapedTerm}[a-z]*\\b)`, 'ig'))
  return <article className={`selection-translation${dragging ? ' is-dragging' : ''}`} aria-label={`${lookup.term} 的语境释义`} style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
    <header className="selection-translation-drag-handle" aria-label="拖动翻译弹框" onPointerDown={onDragStart} onMouseDown={onMouseDragStart} onPointerMove={onDragMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <div className="selection-brand-lockup"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><strong>Hear &amp; Say</strong></div>
      <div className="selection-translation-actions"><button type="button" className="selection-add-button" disabled={saved || status === 'saving'} onPointerDown={(event) => event.stopPropagation()} onClick={saveLookup}>{saved ? '已加入单词本' : status === 'saving' ? '正在加入…' : '+ 单词本'}</button><button type="button" className="selection-close-button" aria-label={`关闭 ${lookup.term} 的翻译`} onPointerDown={(event) => event.stopPropagation()} onClick={onClose}>×</button></div>
    </header>
    <div className="selection-word-identity"><strong>{lookup.term}</strong><span>{lookup.ipa}</span><button type="button" className="selection-icon-button" aria-label={`朗读 ${lookup.term}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onSpeak(lookup.term, 'en-US')}><SpeakerIcon /></button></div>
    <p className="selection-definition"><strong>{partOfSpeechLabels[lookup.partOfSpeech] ?? lookup.partOfSpeech}</strong> {lookup.definitionZh}</p>
    <div className="selection-example"><p>{example.map((part, index) => part.toLowerCase().startsWith(lookup.term.toLowerCase()) ? <mark data-testid="highlighted-word" key={index}>{part}</mark> : part)}</p><p>{lookup.exampleSentenceZh}</p></div>
    <section className="selection-dictionary"><header><strong>{lookup.meaningZh}</strong><div><button type="button" className="selection-icon-button" aria-label={`朗读 ${lookup.meaningZh}`} onClick={() => onSpeak(lookup.meaningZh, 'zh-CN')}><SpeakerIcon /></button><button type="button" className="selection-icon-button" aria-label={`复制 ${lookup.meaningZh}`} onClick={() => void navigator.clipboard?.writeText(lookup.meaningZh)}><svg className="copy-icon" aria-hidden="true" viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 16H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"/></svg></button></div></header><p>在当前语境中，{lookup.contextExplanationZh}</p></section>
    {error && <p className="selection-error" role="alert">{error}{isRetryableError(error) && <button type="button" className="selection-retry" aria-label="刷新重试" title="刷新重试" onClick={retry}>↻</button>}</p>}
  </article>
}
