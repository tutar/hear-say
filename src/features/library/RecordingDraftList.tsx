import type { RecordingDraft } from '../../domain/recording-draft'

type Props = {
  drafts: RecordingDraft[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

function durationLabel(durationSeconds: number): string {
  const seconds = Math.max(0, Math.floor(durationSeconds))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function RecordingDraftList({ drafts, onEdit, onDelete }: Props) {
  if (drafts.length === 0) return null
  return <section className="recording-drafts" aria-labelledby="recording-drafts-title">
    <div className="recording-drafts-heading">
      <div><p className="eyebrow">From the browser</p><h2 id="recording-drafts-title">录制草稿</h2></div>
      <span>{drafts.length} 段待处理</span>
    </div>
    <ul>{drafts.map((draft) => <li key={draft.id}>
      <span className="recording-draft-mark" aria-hidden="true"><i /></span>
      <div className="recording-draft-copy">
        <strong>{draft.source.title}</strong>
        <span className="recording-draft-meta"><span>{draft.source.site}</span><span>{draft.state === 'interrupted' ? '中断后已保留' : '录制完成'}</span><time>{durationLabel(draft.durationSeconds)}</time></span>
      </div>
      <div className="recording-draft-actions">
        <button type="button" onClick={() => onEdit(draft.id)} aria-label={`编辑并导入 ${draft.source.title}`}>编辑并导入</button>
        <button className="subtle-danger" type="button" onClick={() => onDelete(draft.id)} aria-label={`删除 ${draft.source.title}`}>删除</button>
      </div>
    </li>)}</ul>
  </section>
}
