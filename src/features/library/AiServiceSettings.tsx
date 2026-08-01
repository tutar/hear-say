import { useEffect, useState } from 'react'
import type { AsrSettings, VocabularySettings } from '../../domain/types'
import { AsrSettingsForm } from './AsrSettingsForm'

type Props = {
  asr: AsrSettings
  vocabulary: VocabularySettings
  onSaveAsr: (settings: AsrSettings) => void
  onSaveVocabulary: (settings: VocabularySettings) => void
  onTestVocabulary: (settings: VocabularySettings) => Promise<void>
}

export function AiServiceSettings({ asr, vocabulary, onSaveAsr, onSaveVocabulary, onTestVocabulary }: Props) {
  const [draft, setDraft] = useState(vocabulary)
  const [testStatus, setTestStatus] = useState('')
  useEffect(() => setDraft(vocabulary), [vocabulary])

  return <div className="ai-service-settings">
    <section><h3>音频转写</h3><AsrSettingsForm settings={asr} onSave={onSaveAsr} /></section>
    <section><div className="settings-field-intro"><h3>词汇解释</h3><p>使用 DeepSeek 为主动选择的单词或短语生成语境释义。</p></div>
      <form className="asr-settings" onSubmit={(event) => { event.preventDefault(); onSaveVocabulary(draft) }}>
        <label>API 地址<input aria-label="DeepSeek API 地址" type="url" required value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} /></label>
        <label>模型<input aria-label="DeepSeek 模型" required value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} /></label>
        <label>API Key<input aria-label="DeepSeek API Key" type="password" autoComplete="off" value={draft.apiKey} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} /></label>
        <div className="settings-actions"><button type="submit">保存词汇解释设置</button><button type="button" onClick={() => { setTestStatus('正在测试…'); void onTestVocabulary(draft).then(() => setTestStatus('连接成功')).catch((error) => setTestStatus(error instanceof Error ? error.message : '连接失败')) }}>测试连接</button></div>
        {testStatus && <p role="status">{testStatus}</p>}
      </form>
    </section>
  </div>
}
