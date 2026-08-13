import type { WordEntry, WordSource } from '../../domain/types'
import { SpeakerIcon } from './SpeakerIcon'

type Props = { entry: WordEntry; activeTerm: string | null; onBack: () => void; onSpeak: (term: string) => void; onOpenSource: (source: WordSource) => void }

export function WordDetail({ entry, activeTerm, onBack, onSpeak, onOpenSource }: Props) {
  const speaking = activeTerm === entry.term
  return <main className="word-detail">
    <header className="word-detail-header"><button type="button" className="back-link" onClick={onBack}>← 返回单词本</button><p className="eyebrow">Vocabulary detail</p><div><h1>{entry.term}</h1><button type="button" aria-label={speaking ? `停止朗读 ${entry.term}` : `朗读 ${entry.term}`} onClick={() => onSpeak(entry.term)}>{speaking ? '■' : <SpeakerIcon />}</button></div></header>
    <div className="word-contexts">{entry.contexts.map((context) => <article key={context.id}>
      <div><strong>{context.partOfSpeech} · {context.meaningZh}</strong><span>{context.ipa}</span></div>
      <p>{context.contextExplanationZh}</p><blockquote>{context.sentence}</blockquote>
      {context.source.kind === 'manual' ? <span className="word-manual-source">手动添加</span> : <button type="button" onClick={() => onOpenSource(context.source)} aria-label={`打开来源 ${context.source.title}`}>{context.source.kind === 'web' ? '网页来源' : '音频材料'} · {context.source.title} →</button>}
    </article>)}</div>
  </main>
}
