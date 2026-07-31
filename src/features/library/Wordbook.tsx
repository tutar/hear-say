import type { MaterialWithSegments } from '../../db/material-repository'

const ignored = new Set(['about', 'after', 'again', 'because', 'before', 'could', 'their', 'there', 'these', 'those', 'would', 'should', 'which', 'where', 'while'])
export function Wordbook({ materials }: { materials: MaterialWithSegments[] }) {
  const words = new Map<string, string>()
  for (const material of materials) for (const segment of material.segments.filter((item) => item.isDifficult)) for (const raw of segment.text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? []) if (raw.length >= 6 && !ignored.has(raw) && !words.has(raw)) words.set(raw, material.title)
  return <section className="wordbook-page" aria-labelledby="wordbook-title"><div className="wordbook-heading"><div><p className="eyebrow">Collected from listening</p><h2 id="wordbook-title">单词本</h2></div><span>{words.size} 个词</span></div>{words.size === 0 ? <div className="wordbook-empty"><span aria-hidden="true">Aa</span><h3>还没有积累单词</h3><p>在逐句精听中收藏难句后，句中的重点词会出现在这里。</p></div> : <ul className="word-list">{[...words].map(([word, source]) => <li key={word}><button type="button" aria-label={`朗读 ${word}`}>◖</button><div><strong>{word}</strong><small>来自《{source}》</small></div><span>难句词汇</span></li>)}</ul>}</section>
}
