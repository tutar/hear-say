import { useEffect, useRef, useState } from 'react'
import type { VocabularyLookup, VocabularySelection } from '../../services/vocabulary-service'

type Props = {
  onClose: () => void
  onLookup: (selection: VocabularySelection) => Promise<VocabularyLookup>
  onSave: (selection: VocabularySelection, lookup: VocabularyLookup) => Promise<'saved' | 'duplicate'>
  onOpenSettings: () => void
}

export function ManualWordDialog({ onClose, onLookup, onSave, onOpenSettings }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState('')
  const [sentence, setSentence] = useState('')
  const [lookup, setLookup] = useState<VocabularyLookup | null>(null)
  const [status, setStatus] = useState<'editing' | 'loading' | 'preview' | 'saving'>('editing')
  const [error, setError] = useState('')
  useEffect(() => { inputRef.current?.focus() }, [])

  const dirty = Boolean(term.trim() || sentence.trim() || lookup)
  function requestClose() {
    if (!dirty || window.confirm('放弃这次添加？已填写和生成的内容不会保存。')) onClose()
  }
  async function generate() {
    const selection = { term: term.trim(), sentence: sentence.trim() }
    const count = selection.term.match(/[a-z]+(?:'[a-z]+)?/gi)?.length ?? 0
    if (!selection.term || count === 0 || count > 8 || selection.term.length > 80) { setError('请输入 1–8 个英文单词组成的单词或短语'); return }
    setError(''); setStatus('loading')
    try { setLookup(await onLookup(selection)); setStatus('preview') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '无法生成释义'); setStatus('editing') }
  }
  async function save() {
    if (!lookup) return
    setError(''); setStatus('saving')
    try {
      const result = await onSave({ term: term.trim(), sentence: sentence.trim() }, lookup)
      if (result === 'duplicate') { setError('该词条已经存在'); setStatus('preview'); return }
      onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '无法加入生词本'); setStatus('preview') }
  }

  return <div className="dialog-backdrop manual-word-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose() }}>
    <section className="manual-word-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-word-title" onKeyDown={(event) => { if (event.key === 'Escape') requestClose() }}>
      <header><div><p className="eyebrow">New vocabulary</p><h3 id="manual-word-title">{lookup ? '确认词卡' : '添加生词'}</h3></div><button type="button" aria-label="关闭添加生词" onClick={requestClose}>×</button></header>
      {!lookup ? <form onSubmit={(event) => { event.preventDefault(); void generate() }}>
        <label>单词或短语 <span>必填</span><input ref={inputRef} value={term} maxLength={80} placeholder="例如 encounter" onChange={(event) => setTerm(event.target.value)} /></label>
        <label>语境句 <span>选填</span><textarea value={sentence} rows={3} placeholder="填入遇到它时的英文原句" onChange={(event) => setSentence(event.target.value)} /></label>
        <small>未填语境句时，AI 会按最常用词义生成例句。</small>
        {error && <ErrorMessage message={error} onOpenSettings={onOpenSettings} />}
        <div className="manual-word-actions"><button type="button" onClick={requestClose}>取消</button><button className="primary-action" disabled={status === 'loading'} type="submit">{status === 'loading' ? '正在生成…' : '生成释义'}</button></div>
      </form> : <div className="manual-word-preview">
        <div className="manual-word-term"><div><h4>{lookup.term}</h4><span>{lookup.ipa}</span></div><strong>{lookup.partOfSpeech} · {lookup.meaningZh}</strong></div>
        <p>{lookup.definitionZh}</p>
        {sentence.trim() && <section><small>语境解释</small><blockquote>{sentence.trim()}</blockquote><p>{lookup.contextExplanationZh}</p></section>}
        <section><small>例句</small><blockquote>{lookup.exampleSentenceEn}</blockquote><p>{lookup.exampleSentenceZh}</p></section>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="manual-word-actions"><button type="button" disabled={status === 'saving'} onClick={() => { setLookup(null); setStatus('editing'); setError('') }}>返回修改</button><button className="primary-action" type="button" disabled={status === 'saving'} onClick={() => void save()}>{status === 'saving' ? '正在加入…' : '加入生词本'}</button></div>
      </div>}
    </section>
  </div>
}

function ErrorMessage({ message, onOpenSettings }: { message: string; onOpenSettings: () => void }) {
  const needsSettings = message.includes('设置') || message.includes('配置') || message.includes('授权')
  return <p className="form-error" role="alert">{message}{needsSettings && <> <button type="button" onClick={onOpenSettings}>前往设置</button></>}</p>
}
