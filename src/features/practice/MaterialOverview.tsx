import { useState, type CSSProperties, type ReactNode } from 'react'
import type { MaterialWithSegments } from '../../db/material-repository'
import type { FirstRoundStage, ReviewOccurrence, ReviewSchedule } from '../../domain/types'
import { EarIcon } from './EarIcon'

type Props = { material: MaterialWithSegments; schedule?: ReviewSchedule; navigation?: ReactNode; onBack: () => void; onContinue: () => void; onFreeListen?: () => void; onOpenStage?: (stage: FirstRoundStage) => void }
const stages: Array<{ id: FirstRoundStage; label: string; description: string; mark: ReactNode }> = [
  { id: 'blind_listen', label: '全文盲听', description: '先完整听，感受整体难度和大意', mark: <EarIcon /> },
  { id: 'intensive_listen', label: '逐句精听', description: '逐句听懂，校对文本与时间轴', mark: '◉' },
  { id: 'shadowing', label: '难句跟读', description: '针对卡住的句子反复开口', mark: '◌' },
  { id: 'retelling', label: '段落复述', description: '合上原文，用英文复述主要内容', mark: '▰' },
]
const duration = (seconds: number | null) => seconds === null ? '--:--' : `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

const reviewStageNames = { blind_listen: '全文盲听', difficult_practice: '难句补练', retelling: '段落复述' } as const
const intervalText = (occurrence: ReviewOccurrence) => `${occurrence.interval.value} ${occurrence.interval.unit === 'hour' ? '小时' : '天'}后`

export function MaterialOverview({ material, schedule, navigation, onBack, onContinue, onFreeListen, onOpenStage }: Props) {
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
          <button className="learning-stage-card" type="button" disabled={!isComplete && !isCurrent} onClick={() => isCurrent ? onContinue() : onOpenStage?.(stage.id)}><span className="stage-mark" aria-hidden="true">{stage.mark}</span><div><h3>{stage.label}</h3><p>{stage.description}</p>{stage.id === 'intensive_listen' && difficultCount > 0 && <small>{difficultCount} 个难句</small>}</div></button>
        </li>
      })}</ol>
    </section>
    {schedule && <ReviewTimeline schedule={schedule} difficultCount={difficultCount} />}
    <footer className="overview-footer overview-actions"><button className="free-listen-action" type="button" onClick={onFreeListen}>随心听</button><button className="continue-action" type="button" onClick={onContinue}>{material.firstRoundStage === 'blind_listen' ? '开始学习' : material.firstRoundStage === 'complete' ? '查看学习结果' : '继续学习'}</button></footer>
  </main>
}

function ReviewTimeline({ schedule, difficultCount }: { schedule: ReviewSchedule; difficultCount: number }) {
  const initiallyOpen = schedule.occurrences.filter((item) => item.status === 'in_progress' || (item.ordinal === schedule.completedCount + 1 && item.dueAt !== null)).map((item) => item.id)
  const [open, setOpen] = useState(new Set(initiallyOpen))
  const allOpen = open.size === schedule.occurrences.length
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(schedule.occurrences.map((item) => item.id)))
  return <section className="review-timeline"><div className="map-heading"><div><p className="eyebrow">Review plan</p><h2>复习计划</h2></div><button type="button" onClick={toggleAll}>{allOpen ? '全部收起' : '全部展开'}</button></div><ol>{schedule.occurrences.map((occurrence) => {
    const expanded = open.has(occurrence.id)
    const stages = occurrence.stages ?? (difficultCount > 0 ? ['blind_listen', 'difficult_practice', 'retelling'] : ['blind_listen', 'retelling'])
    const status = occurrence.status === 'completed' ? '已完成' : occurrence.status === 'in_progress' ? '进行中' : occurrence.ordinal === schedule.completedCount + 1 ? '待复习' : '计划中'
    const timing = occurrence.dueAt && occurrence.ordinal === schedule.completedCount + 1 ? new Date(occurrence.dueAt).toLocaleString() : intervalText(occurrence)
    return <li key={occurrence.id} className={occurrence.status === 'in_progress' ? 'is-current' : ''}><button type="button" aria-expanded={expanded} onClick={() => setOpen((current) => { const next = new Set(current); if (next.has(occurrence.id)) next.delete(occurrence.id); else next.add(occurrence.id); return next })}><span>第 {occurrence.ordinal} 轮</span><small>{timing} · {stages.length} 个阶段</small><b>{status}</b><i aria-hidden="true">⌄</i></button>{expanded && <ul>{stages.map((stage, index) => <li key={stage}><span>{index + 1}</span><strong>{reviewStageNames[stage]}</strong>{stage === 'difficult_practice' && <small>{occurrence.difficultSegmentIds?.length ?? difficultCount} 句</small>}</li>)}</ul>}</li>
  })}</ol></section>
}
