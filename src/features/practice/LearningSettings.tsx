import { useEffect, useState } from 'react'
import type { ReviewInterval, ReviewPlan } from '../../domain/types'
import { validateReviewIntervals } from '../../domain/review-plan'

export function LearningSettings({ plan, onSave }: { plan: ReviewPlan; onSave: (intervals: ReviewInterval[]) => Promise<void> | void }) {
  const [intervals, setIntervals] = useState(plan.intervals)
  const [error, setError] = useState('')
  useEffect(() => setIntervals(plan.intervals), [plan])
  const update = (index: number, change: Partial<ReviewInterval>) => setIntervals((items) => items.map((item, position) => position === index ? { ...item, ...change } : item))
  const save = async () => { try { validateReviewIntervals(intervals); await onSave(intervals); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : '无法保存复习计划') } }
  return <section className="settings-page learning-settings"><div className="settings-page-heading"><p className="eyebrow">Review rhythm</p><h2>学习设置</h2><p>当前复习计划 v{plan.version}。修改后会创建新版本，只影响之后完成首次学习的材料。</p></div><div className="review-plan-editor"><header><strong>{intervals.length} 次复习</strong><span>间隔以上一次完成时间为起点</span></header>{intervals.map((interval, index) => <div className="review-interval" key={index}><span>第 {index + 1} 次</span><input aria-label={`第 ${index + 1} 次间隔`} type="number" min="1" value={interval.value} onChange={(event) => update(index, { value: Number(event.target.value) })}/><select aria-label={`第 ${index + 1} 次单位`} value={interval.unit} onChange={(event) => update(index, { unit: event.target.value as ReviewInterval['unit'] })}><option value="hour">小时</option><option value="day">天</option></select><button type="button" aria-label={`删除第 ${index + 1} 次复习`} onClick={() => setIntervals((items) => items.filter((_, position) => position !== index))}>×</button></div>)}<button className="secondary-action" type="button" onClick={() => setIntervals((items) => [...items, { value: Math.max(items.at(-1)?.value ?? 1, 1), unit: items.at(-1)?.unit ?? 'day' }])}>+ 添加一次复习</button>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-action" type="button" onClick={() => void save()}>保存为新版本</button></div></section>
}
