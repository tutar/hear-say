import { useState } from 'react'
import type { VocabularyLookup, VocabularySelection } from '../../services/vocabulary-service'

type Props = {
  selection: VocabularySelection
  onLookup: (selection: VocabularySelection) => Promise<VocabularyLookup>
  onAdd: (lookup: VocabularyLookup) => Promise<void>
  onSpeak: (term: string) => void
  onClose: () => void
  onOpenSettings?: () => void
}

export function SelectionTranslator({ selection, onLookup, onAdd, onSpeak, onClose, onOpenSettings }: Props) {
  const [lookup, setLookup] = useState<VocabularyLookup | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')

  if (!lookup) return <div className="selection-translate-trigger"><button type="button" aria-label={`翻译 ${selection.term}`} disabled={status === 'loading'} onClick={() => { setStatus('loading'); setError(''); void onLookup(selection).then((result) => { setLookup(result); setStatus('idle') }).catch((reason) => { setError(reason instanceof Error ? reason.message : '翻译失败'); setStatus('idle') }) }}>{status === 'loading' ? '正在翻译…' : '翻译'}</button>{error && <p role="alert">{error} {onOpenSettings && <button type="button" onClick={onOpenSettings}>前往 AI 服务设置</button>} <button type="button" onClick={onClose}>关闭</button></p>}</div>

  return <article className="selection-translation" aria-label={`${lookup.term} 的语境释义`}>
    <header><div><strong>{lookup.term}</strong><span>{lookup.ipa}</span></div><button type="button" aria-label={`关闭 ${lookup.term} 的翻译`} onClick={onClose}>×</button></header>
    <p className="selection-meaning">{lookup.partOfSpeech} · {lookup.meaningZh}</p>
    <p>{lookup.contextExplanationZh}</p>
    <small>将所选内容和所在句发送到已配置的词汇服务</small>
    <footer><button type="button" aria-label={`朗读 ${lookup.term}`} onClick={() => onSpeak(lookup.term)}>◖ 发音</button><button type="button" aria-label="加入生词本" disabled={status === 'saving' || status === 'saved'} onClick={() => { setStatus('saving'); void onAdd(lookup).then(() => setStatus('saved')).catch((reason) => { setError(reason instanceof Error ? reason.message : '保存失败'); setStatus('idle') }) }}>{status === 'saved' ? '已加入' : status === 'saving' ? '正在加入…' : '+ 生词本'}</button></footer>
    {error && <p role="alert">{error}</p>}
  </article>
}
