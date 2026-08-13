import type { WordEntry } from '../../domain/types'
import { SpeakerIcon } from './SpeakerIcon'
import { ManualWordDialog } from './ManualWordDialog'
import type { VocabularyLookup, VocabularySelection } from '../../services/vocabulary-service'
import { useState } from 'react'

type Props = { entries: WordEntry[]; activeTerm: string | null; onSpeak: (term: string) => void; onOpen: (id: string) => void; onLookup: (selection: VocabularySelection) => Promise<VocabularyLookup>; onAdd: (selection: VocabularySelection, lookup: VocabularyLookup) => Promise<'saved' | 'duplicate'>; onOpenSettings: () => void }

export function Wordbook({ entries, activeTerm, onSpeak, onOpen, onLookup, onAdd, onOpenSettings }: Props) {
  const [adding, setAdding] = useState(false)
  return <section className="wordbook-page" aria-labelledby="wordbook-title">
    <div className="wordbook-heading"><div><p className="eyebrow">Collected from context</p><h2 id="wordbook-title">单词本</h2></div><div className="wordbook-heading-actions"><span>{entries.length} 个词</span><button className="word-add-button" type="button" aria-label="添加生词" title="添加生词" onClick={() => setAdding(true)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 4.5v15M4.5 12h15" /></svg></button></div></div>
    {entries.length === 0 ? <div className="wordbook-empty"><span aria-hidden="true">Aa</span><h3>还没有积累单词</h3><p>手动添加，或在网页和逐句精听中划词收集。</p></div> : <ul className="word-list">{entries.map((entry) => {
      const latest = entry.contexts.at(-1)!
      const speaking = activeTerm === entry.term
      return <li key={entry.id}>
        <button className="word-open" type="button" aria-label={`查看 ${entry.term}`} onClick={() => onOpen(entry.id)} />
        <button className="word-audio" type="button" aria-label={speaking ? `停止朗读 ${entry.term}` : `朗读 ${entry.term}`} onClick={() => onSpeak(entry.term)}><span aria-hidden="true">{speaking ? '■' : <SpeakerIcon />}</span></button>
        <div><strong>{entry.term}</strong><small>{latest.partOfSpeech} · {latest.meaningZh}</small></div>
      </li>
    })}</ul>}
    {adding && <ManualWordDialog onClose={() => setAdding(false)} onLookup={onLookup} onSave={onAdd} onOpenSettings={onOpenSettings} />}
  </section>
}
