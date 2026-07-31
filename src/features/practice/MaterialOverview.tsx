import type { CSSProperties, ReactNode } from 'react'
import type { MaterialWithSegments } from '../../db/material-repository'
import type { FirstRoundStage } from '../../domain/types'

type Props = { material: MaterialWithSegments; navigation?: ReactNode; onBack: () => void; onContinue: () => void }
const stages: Array<{ id: FirstRoundStage; label: string; description: string; mark: string }> = [
  { id: 'blind_listen', label: '全文盲听', description: '先完整听，感受整体难度和大意', mark: '◖' },
  { id: 'intensive_listen', label: '逐句精听', description: '逐句听懂，校对文本与时间轴', mark: '◉' },
  { id: 'shadowing', label: '难句跟读', description: '针对卡住的句子反复开口', mark: '◌' },
  { id: 'retelling', label: '段落复述', description: '合上原文，用英文复述主要内容', mark: '▰' },
]
const duration = (seconds: number | null) => seconds === null ? '--:--' : `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

export function MaterialOverview({ material, navigation, onBack, onContinue }: Props) {
  const currentIndex = material.firstRoundStage === 'complete' ? stages.length : stages.findIndex((stage) => stage.id === material.firstRoundStage)
  const completed = Math.max(0, currentIndex)
  const progress = Math.round((completed / stages.length) * 100)
  const difficultCount = material.segments.filter((segment) => segment.isDifficult).length
  const wordCount = material.segments.reduce((total, segment) => total + segment.text.trim().split(/\s+/).filter(Boolean).length, 0)
  return <main className="material-overview">
    <header className="overview-nav">
      {navigation ?? <button className="back-link overview-back" type="button" onClick={onBack} aria-label="返回材料库">←</button>}
      <div><p className="eyebrow">学习材料</p><h1>{material.title}</h1></div><span aria-hidden="true" />
    </header>
    <section className="overview-summary" aria-label="学习进度">
      <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}><span>{progress}%</span></div>
      <div className="summary-copy">
        <div><h2>{material.firstRoundStage === 'complete' ? '首次学习完成' : '首次学习'}</h2><span className="status-chip">{material.firstRoundStage === 'blind_listen' ? '未开始' : material.firstRoundStage === 'complete' ? '已完成' : '学习中'}</span></div>
        <p>{material.firstRoundStage === 'complete' ? '等待下一轮复习' : stages[Math.max(0, currentIndex)]?.label}</p>
        <ul aria-label="材料信息"><li>◷ {duration(material.durationSeconds)}</li><li>☷ {material.segments.length} 句</li><li>Tᵀ {wordCount} 词</li></ul>
      </div>
    </section>
    <section className="learning-map">
      <div className="map-heading"><div><p className="eyebrow">Learning route</p><h2>首次学习</h2></div><span>{completed}/{stages.length} 完成</span></div>
      <ol>{stages.map((stage, index) => {
        const isComplete = index < completed, isCurrent = index === currentIndex
        return <li key={stage.id} className={isComplete ? 'is-complete' : isCurrent ? 'is-current' : ''}>
          <span className="route-node" aria-hidden="true">{isComplete ? '✓' : index + 1}</span>
          <article><span className="stage-mark" aria-hidden="true">{stage.mark}</span><div><h3>{stage.label}</h3><p>{stage.description}</p>{stage.id === 'intensive_listen' && difficultCount > 0 && <small>{difficultCount} 个难句</small>}</div></article>
        </li>
      })}</ol>
    </section>
    <footer className="overview-footer"><button className="continue-action" type="button" onClick={onContinue}>{material.firstRoundStage === 'blind_listen' ? '开始学习' : material.firstRoundStage === 'complete' ? '查看学习结果' : '继续学习'}</button></footer>
  </main>
}
