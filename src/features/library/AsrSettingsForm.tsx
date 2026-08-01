import { useEffect, useState } from 'react'
import type { AsrSettings } from '../../domain/types'

type Props = { settings: AsrSettings; onSave: (settings: AsrSettings) => void }

export function AsrSettingsForm({ settings, onSave }: Props) {
  const [draft, setDraft] = useState(settings)
  useEffect(() => setDraft(settings), [settings])

  return <form className="asr-settings" onSubmit={(event) => { event.preventDefault(); onSave(draft) }}>
      <div className="settings-field-intro"><p>兼容 OpenAI 音频转写接口的本地或远程服务。</p></div>
      <label>ASR 地址<input aria-label="ASR 地址" type="url" value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} required /></label>
      <label>模型<input aria-label="模型" value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} required /></label>
      <label>音频语言<select aria-label="音频语言" value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value as AsrSettings['language'] })}><option value="en">英语（推荐）</option><option value="auto">自动检测</option></select></label>
      <label>API Key<input aria-label="API Key" type="password" value={draft.apiKey} autoComplete="off" onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} /></label>
      <button type="submit">保存转写设置</button>
    </form>
}
