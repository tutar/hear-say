type Props = {
  isImporting: boolean
  onSelectFile: (file: File) => void
}

export function AudioImportControl({ isImporting, onSelectFile }: Props) {
  return <div className="import-control">
    <label className="file-cta" aria-busy={isImporting}>
      {isImporting ? '正在转写…' : '选择音频文件'}
      <input aria-label="选择音频文件" type="file" accept="audio/*" disabled={isImporting} onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) onSelectFile(file)
      }} />
    </label>
    {isImporting && <p className="transcription-progress" role="status"><span className="import-spinner" aria-hidden="true" />正在转写音频，这可能需要一点时间…</p>}
  </div>
}
