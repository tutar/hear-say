import type { ReactNode } from 'react'

export type SentenceSupportState = { analysis: boolean; translation: boolean; chunks: boolean }
type Props = { sentence: string; state: SentenceSupportState; onChange: (state: SentenceSupportState) => void; onClose?: () => void; vocabularySlot?: ReactNode }

export function SentenceSupportPanel({ sentence, state, onChange, onClose, vocabularySlot }: Props) {
  const toggle = (key: keyof SentenceSupportState) => onChange({ ...state, [key]: !state[key] })
  return <section className="sentence-support-panel" aria-label="句子详情"><header><strong>句子详情</strong>{onClose && <button type="button" aria-label="关闭句子详情" onClick={onClose}>×</button>}</header><nav className="content-switches" aria-label="句子辅助内容"><button type="button" className={state.analysis ? 'active' : ''} aria-pressed={state.analysis} onClick={() => toggle('analysis')}>解析</button><button type="button" className={state.translation ? 'active' : ''} aria-pressed={state.translation} onClick={() => toggle('translation')}>翻译</button><button type="button" className={state.chunks ? 'active' : ''} aria-pressed={state.chunks} onClick={() => toggle('chunks')}>意群</button></nav>{state.chunks ? <p className="sentence-support-original">{sentence.split(/([,;:.!?]\s*)/).filter(Boolean).map((chunk, index) => <mark key={`${chunk}-${index}`}>{chunk}</mark>)}</p> : <p className="sentence-support-original">{sentence}</p>}{vocabularySlot}{state.translation && <section className="translation-block"><h2>翻译</h2><p>当前材料没有可用翻译。</p></section>}{state.analysis && <section className="analysis-sheet"><h2>解析</h2><p>先找句子的主干，再结合语境理解修饰成分。</p></section>}</section>
}

export function SentenceSupportControls({ state, onChange }: { state: SentenceSupportState; onChange: (state: SentenceSupportState) => void }) {
  const toggle = (key: keyof SentenceSupportState) => onChange({ ...state, [key]: !state[key] })
  return <nav className="content-switches help-tabs" aria-label="显示辅助内容"><button className={state.analysis ? 'active' : ''} aria-pressed={state.analysis} onClick={() => toggle('analysis')}>解析</button><button className={state.translation ? 'active' : ''} aria-pressed={state.translation} onClick={() => toggle('translation')}>翻译</button><button className={state.chunks ? 'active' : ''} aria-pressed={state.chunks} onClick={() => toggle('chunks')}>意群</button></nav>
}
