import type { MaterialWithSegments } from '../../db/material-repository'
import type { Material } from '../../domain/types'
import type { DailyLearningStats } from '../../domain/learning-stats'

type Props = { materials: Material[]; due: MaterialWithSegments[]; onReview: (id: string) => void; onOpen: (id: string) => void; weekStats?: DailyLearningStats[]; today?: string }
const stageName = (stage: Material['firstRoundStage']) => stage === 'blind_listen' ? '全文盲听' : stage === 'intensive_listen' ? '逐句精听' : stage === 'shadowing' ? '难句跟读' : stage === 'retelling' ? '段落复述' : '等待复习'

const duration = (seconds: number) => seconds < 60 ? `${Math.round(seconds)} 秒` : seconds < 3600 ? `${Math.round(seconds / 60)} 分钟` : `${Math.floor(seconds / 3600)} 小时 ${Math.round(seconds % 3600 / 60)} 分钟`
export function LearningDashboard({ materials, due, onReview, onOpen, weekStats = [], today }: Props) {
  const continuing = materials.filter((item) => item.firstRoundStage !== 'blind_listen' && item.firstRoundStage !== 'complete')
  const newMaterials = materials.filter((item) => item.firstRoundStage === 'blind_listen' && item.status === 'ready')
  const totalMinutes = Math.round(materials.reduce((total, item) => total + (item.durationSeconds ?? 0), 0) / 60)
  return <section className="learning-dashboard" aria-labelledby="learning-title">
    <div className="dashboard-title"><div><p className="eyebrow">Today’s desk</p><h2 id="learning-title">学习任务</h2></div><span>{due.length + continuing.length + newMaterials.length} 项待完成</span></div>
    {weekStats.length > 0 ? <LearningTimeSummary week={weekStats} today={today ?? ''} /> : <div className="learning-summary"><div><small>今日任务</small><strong>{due.length + continuing.length + newMaterials.length}</strong><span>项</span></div><div><small>待复习</small><strong>{due.length}</strong><span>段</span></div><div><small>材料总时长</small><strong>{totalMinutes}</strong><span>分钟</span></div></div>}
    {due.length > 0 && <TaskGroup title="待复习" tone="review" items={due} action="复习" onOpen={(id) => onReview(id)} />}
    {continuing.length > 0 && <TaskGroup title="继续学习" tone="continue" items={continuing} action="继续" onOpen={onOpen} />}
    {newMaterials.length > 0 && <TaskGroup title="首次学习" tone="new" items={newMaterials} action="开始" onOpen={onOpen} />}
    {due.length + continuing.length + newMaterials.length === 0 && <div className="dashboard-empty"><span aria-hidden="true">✓</span><h3>今天的任务已完成</h3><p>去资料库添加一段新音频，开始下一次练习。</p></div>}
  </section>
}

function LearningTimeSummary({ week, today }: { week: DailyLearningStats[]; today: string }) {
  const current = week.find((item) => item.date === today) ?? { listeningSeconds: 0, speakingSeconds: 0, totalSeconds: 0 }
  const weekTotal = week.reduce((sum, item) => sum + item.totalSeconds, 0); const max = Math.max(...week.map((item) => item.totalSeconds), 1)
  return <><div className="learning-summary time-summary"><div><small>今日总时间</small><strong>{duration(current.totalSeconds)}</strong></div><div><small>听力 · 输入</small><strong>{duration(current.listeningSeconds)}</strong></div><div><small>口语 · 输出</small><strong>{duration(current.speakingSeconds)}</strong></div><div><small>本周总时间</small><strong>{duration(weekTotal)}</strong></div></div><div className="week-chart" aria-label="本周学习时间">{week.map((day, index) => <div className={day.date === today ? 'today' : ''} key={day.date}><i style={{ height: `${Math.max(day.totalSeconds / max * 100, day.totalSeconds ? 5 : 1)}%` }}/><span>{['一','二','三','四','五','六','日'][index]}</span></div>)}</div></>
}

function TaskGroup({ title, tone, items, action, onOpen }: { title: string; tone: string; items: Material[]; action: string; onOpen: (id: string) => void }) {
  return <section className={`task-group task-${tone}`}><h3>{title} <span>{items.length}</span></h3><ul>{items.map((item) => <li key={item.id}><div className="task-wave" aria-hidden="true">▮▯▮</div><div><strong>{item.title}</strong><small>{stageName(item.firstRoundStage)} · {item.durationSeconds === null ? '--:--' : `${Math.floor(item.durationSeconds / 60)}:${String(Math.round(item.durationSeconds % 60)).padStart(2, '0')}`}</small></div><button type="button" onClick={() => onOpen(item.id)}>{action}</button></li>)}</ul></section>
}
