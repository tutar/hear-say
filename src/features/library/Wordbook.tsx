import type { WordEntry } from '../../domain/types'
import { SpeakerIcon } from './SpeakerIcon'

type Props = { entries: WordEntry[]; activeTerm: string | null; onSpeak: (term: string) => void; onOpen: (id: string) => void }

export function Wordbook({ entries, activeTerm, onSpeak, onOpen }: Props) {
  return <section className="wordbook-page" aria-labelledby="wordbook-title">
    <div className="wordbook-heading"><div><p className="eyebrow">Collected from context</p><h2 id="wordbook-title">单词本</h2></div><span>{entries.length} 个词</span></div>
    {entries.length === 0 ? <div className="wordbook-empty"><span aria-hidden="true">Aa</span><h3>还没有积累单词</h3><p>在网页或逐句精听中划词翻译，再主动加入生词本。</p></div> : <ul className="word-list">{entries.map((entry) => {
      const latest = entry.contexts.at(-1)!
      const speaking = activeTerm === entry.term
      return <li key={entry.id}>
        <button className="word-open" type="button" aria-label={`查看 ${entry.term}`} onClick={() => onOpen(entry.id)} />
        <button className="word-audio" type="button" aria-label={speaking ? `停止朗读 ${entry.term}` : `朗读 ${entry.term}`} onClick={() => onSpeak(entry.term)}><span aria-hidden="true">{speaking ? '■' : <SpeakerIcon />}</span></button>
        <div><strong>{entry.term}</strong><small>{latest.partOfSpeech} · {latest.meaningZh}</small></div>
      </li>
    })}</ul>}
  </section>
}
