import { useState, type ReactNode } from 'react'
import type { Material } from '../../domain/types'

type Props = {
  material: Material
  actions: ReactNode
  onRename: (materialId: string, title: string) => Promise<void>
  onDelete: (materialId: string) => Promise<void>
}

export function MaterialRow({ material, actions, onRename, onDelete }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(material.title)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  async function saveName() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('材料名称不能为空')
      return
    }
    try {
      await onRename(material.id, trimmedTitle)
      setError('')
      setIsEditing(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存名称失败')
    }
  }

  function cancelRename() {
    setTitle(material.title)
    setError('')
    setIsEditing(false)
  }

  async function confirmDelete() {
    try {
      await onDelete(material.id)
      setError('')
      setIsDeleting(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除材料失败')
    }
  }

  return <li className="material-row">
    <div className="material-info">
      {isEditing ? <div className="rename-editor"><label>材料名称<input aria-label="材料名称" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /></label><div><button type="button" onClick={() => void saveName()}>保存名称</button><button type="button" onClick={cancelRename}>取消重命名</button></div></div> : <strong>{material.title}</strong>}
      <small>{material.status === 'ready' ? '时间轴已就绪' : '等待转写或字幕'}</small>
      {error && <p className="row-error" role="alert">{error}</p>}
    </div>
    <div className="material-actions">
      {actions}
      {!isEditing && <button className="secondary-action" type="button" aria-label={`重命名 ${material.title}`} onClick={() => setIsEditing(true)}>重命名</button>}
      <button className="danger-action" type="button" aria-label={`删除 ${material.title}`} onClick={() => setIsDeleting(true)}>删除</button>
    </div>
    {isDeleting && <div className="dialog-backdrop"><section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby={`delete-title-${material.id}`}><p className="eyebrow">永久删除</p><h3 id={`delete-title-${material.id}`}>删除“{material.title}”吗？</h3><p>音频、句子时间轴与学习记录将一并永久删除</p><div className="dialog-actions"><button className="secondary-action" type="button" onClick={() => setIsDeleting(false)}>取消删除</button><button className="danger-action" type="button" onClick={() => void confirmDelete()}>确认删除</button></div></section></div>}
  </li>
}
