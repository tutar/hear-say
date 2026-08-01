import { useState, type ReactNode } from 'react'
import type { Material } from '../../domain/types'

type Props = {
  material: Material; actions?: ReactNode; onOpen?: (id: string) => void
  onRename: (id: string, title: string) => Promise<void>; onDelete: (id: string) => Promise<void>
  onToggleFavorite?: (id: string, value: boolean) => Promise<void>; availableTags?: string[]
  onSaveTags?: (id: string, tags: string[]) => Promise<void>; onExport?: (id: string) => void
  onResetProgress?: (id: string) => Promise<void>; onManageSubtitles?: (id: string) => void
}
const duration = (seconds: number | null) => seconds === null ? '--:--' : `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
const learningState = (material: Material) => material.firstRoundStage === 'blind_listen' ? ['未开始', '首次学习'] : material.firstRoundStage === 'complete' ? ['待复习', `第 ${material.reviewStep + 1} 轮`] : ['学习中', '首次学习']
const addedAt = (value: string) => { const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000); if (!Number.isFinite(seconds) || seconds < 60) return '刚刚'; if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`; if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`; return `${Math.floor(seconds / 86400)}天前` }

export function MaterialRow({ material, actions, onOpen, onRename, onDelete, onToggleFavorite, availableTags = [], onSaveTags, onExport, onResetProgress, onManageSubtitles }: Props) {
  const [editing, setEditing] = useState(false), [title, setTitle] = useState(material.title), [menu, setMenu] = useState(false), [tagsOpen, setTagsOpen] = useState(false), [selectedTags, setSelectedTags] = useState(material.tags), [newTag, setNewTag] = useState(''), [deleting, setDeleting] = useState(false), [resetting, setResetting] = useState(false), [error, setError] = useState('')
  const state = learningState(material)
  const saveName = async () => { const value = title.trim(); if (!value) return setError('材料名称不能为空'); await onRename(material.id, value); setEditing(false) }
  const saveTags = async () => { setTagsOpen(false); await onSaveTags?.(material.id, selectedTags) }
  const addTag = () => { const value = newTag.trim(); if (value && !selectedTags.includes(value)) setSelectedTags([...selectedTags, value]); setNewTag('') }
  const toggleTag = (tag: string) => setSelectedTags(selectedTags.includes(tag) ? selectedTags.filter((item) => item !== tag) : [...selectedTags, tag])
  return <li className="material-row material-card" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenu(false) }}>
    {onOpen && <button className="card-open" type="button" aria-label={`打开 ${material.title}`} onClick={() => onOpen(material.id)} />}
    <div className="audio-ring" aria-hidden="true"><i /><i /><i /><i /></div>
    <div className="material-info">{editing ? <div className="rename-editor"><label>材料名称<input aria-label="材料名称" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /></label><div><button onClick={() => void saveName()}>保存名称</button><button onClick={() => { setTitle(material.title); setEditing(false) }}>取消重命名</button></div></div> : <strong>{material.title}</strong>}<small>{duration(material.durationSeconds)} · {material.status === 'ready' ? '字幕就绪' : '待字幕'} · {addedAt(material.createdAt)}添加</small>{material.tags.length > 0 && <div className="card-tags">{material.tags.map((tag) => <em key={tag}>{tag}</em>)}</div>}{error && <p role="alert" className="row-error">{error}</p>}</div>
    <div className={`material-state state-${material.firstRoundStage}`}><span>{state[0]}</span><small>{state[1]}</small></div>
    <div className="material-actions">{actions}<button className="icon-action" aria-label={`${material.isFavorite ? '取消收藏' : '收藏'} ${material.title}`} onClick={() => void onToggleFavorite?.(material.id, !material.isFavorite)}>{material.isFavorite ? '★' : '☆'}</button><button className="icon-action" aria-label={`更多操作 ${material.title}`} onClick={() => setMenu(!menu)}>•••</button></div>
    {menu && <div className="more-menu" role="menu"><button role="menuitem" onClick={() => { setEditing(true); setMenu(false) }}>重命名</button><button role="menuitem" onClick={() => { setMenu(false); onManageSubtitles?.(material.id) }}>管理字幕</button><button role="menuitem" onClick={() => { setTagsOpen(true); setMenu(false) }}>管理标签</button><button role="menuitem" onClick={() => { setMenu(false); onExport?.(material.id) }}>导出</button><button role="menuitem" onClick={() => { setResetting(true); setMenu(false) }}>重置学习进度</button><button role="menuitem" onClick={() => { setDeleting(true); setMenu(false) }}>删除</button></div>}
    {tagsOpen && <div className="dialog-backdrop"><section className="delete-dialog" role="dialog"><h3>管理标签</h3>{[...new Set([...availableTags, ...selectedTags])].map((tag) => <label key={tag}><input aria-label={tag} type="checkbox" checked={selectedTags.includes(tag)} onChange={() => toggleTag(tag)} />{tag}</label>)}<label>新标签<input aria-label="新标签" value={newTag} onChange={(event) => setNewTag(event.target.value)} /></label><button onClick={addTag}>添加标签</button><button onClick={() => void saveTags()}>保存标签</button></section></div>}
    {resetting && <div className="dialog-backdrop"><section className="delete-dialog" role="dialog"><h3>重置学习进度？</h3><p>首次学习将重新开始，当前复习计划与未完成练习会被删除，复习计划会重新生成。</p><p>保留音频、字幕、标签和收藏，也会保留历史学习时间、收藏难句、随心听位置和全局偏好。</p><button onClick={() => setResetting(false)}>取消重置</button><button onClick={() => void onResetProgress?.(material.id)}>确认重置</button></section></div>}
    {deleting && <div className="dialog-backdrop"><section className="delete-dialog" role="dialog"><h3>删除“{material.title}”吗？</h3><p>音频、句子时间轴与学习记录将一并永久删除</p><button onClick={() => setDeleting(false)}>取消删除</button><button onClick={() => void onDelete(material.id)}>确认删除</button></section></div>}
  </li>
}
