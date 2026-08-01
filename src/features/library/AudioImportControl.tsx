type Props = {
  isImporting: boolean
  onSelectFile: (file: File) => void
}

export function AudioImportControl({ isImporting, onSelectFile }: Props) {
  return <div className="import-control">
    <label className="file-cta" aria-busy={isImporting} title={isImporting ? '正在转写音频' : '添加音频'}>
      {isImporting ? <span aria-hidden="true">···</span> : <svg className="add-audio-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 4.5v15M4.5 12h15" /></svg>}
      <span className="visually-hidden">{isImporting ? '正在转写音频' : '添加音频'}</span>
      <input aria-label="选择音频文件" type="file" accept="audio/*" disabled={isImporting} onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) onSelectFile(file)
      }} />
    </label>
    {isImporting && <p className="transcription-progress" role="status"><span className="import-spinner" aria-hidden="true" />正在转写音频，这可能需要一点时间…</p>}
  </div>
}
