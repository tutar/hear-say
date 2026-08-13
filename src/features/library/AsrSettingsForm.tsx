import { useEffect, useState } from 'react'
import type { AsrSettings } from '../../domain/types'

type Props = { settings: AsrSettings; onSave: (settings: AsrSettings) => Promise<void> }

export function AsrSettingsForm({ settings, onSave }: Props) {
  const [draft, setDraft] = useState(settings)
  const [saveStatus, setSaveStatus] = useState('')
  useEffect(() => setDraft(settings), [settings])

  return <form className="asr-settings" onSubmit={(event) => {
    event.preventDefault()
    setSaveStatus('正在保存…')
    void onSave(draft).then(() => setSaveStatus('转写设置已保存')).catch((error) => setSaveStatus(error instanceof Error ? error.message : '转写设置保存失败'))
  }}>
      <label>转写提供商<select aria-label="转写提供商" value={draft.provider} onChange={(event) => setDraft(event.target.value === 'assemblyai'
        ? { ...draft, provider: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', model: 'universal-3-5-pro' }
        : { ...draft, provider: 'openai-compatible', baseUrl: '', model: '' })}><option value="assemblyai">AssemblyAI</option><option value="openai-compatible">OpenAI 兼容</option></select></label>
      {draft.provider === 'assemblyai'
        ? <><p className="settings-field-note">在 <a href="https://www.assemblyai.com/dashboard" target="_blank" rel="noreferrer">AssemblyAI dashboard</a> 获取 API Key。</p><label>模型<select aria-label="模型" value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })}><option value="universal-3-5-pro">Universal-3.5 Pro</option><option value="universal-2">Universal-2</option></select></label></>
        : <><label>Base URL<input aria-label="Base URL" type="url" value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} required /></label><label>模型<input aria-label="模型" value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} required /></label></>}
      <label>音频语言<select aria-label="音频语言" value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value as AsrSettings['language'] })}><option value="en">英语（推荐）</option><option value="auto">自动检测</option></select></label>
      <label>API Key<input aria-label="API Key" type="password" value={draft.apiKey} autoComplete="off" required={draft.provider === 'assemblyai'} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} /></label>
      <div className="settings-actions"><button type="submit">保存转写设置</button>{saveStatus && <p className="settings-feedback" role="status">{saveStatus}</p>}</div>
    </form>
}
