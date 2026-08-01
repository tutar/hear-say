import { createRoot } from 'react-dom/client'
import { useEffect, useMemo, useState } from 'react'
import { RecordingHarness, type RecordingSource } from '../../src/features/recording/RecordingHarness'
import { ChromeRecordingClient } from '../../src/services/chrome-recording-client'
import '../../src/features/recording/recording-harness.css'

function SidePanel() {
  const [source, setSource] = useState<RecordingSource | null>(null)
  const [error, setError] = useState('')
  const client = useMemo(() => new ChromeRecordingClient(), [])
  useEffect(() => {
    void browser.storage.local.get('recordingPanelSource').then(async (stored) => {
      const sourceTabId = (stored as { recordingPanelSource?: { tabId?: number } }).recordingPanelSource?.tabId
      if (sourceTabId !== undefined) return browser.tabs.get(sourceTabId)
      return (await browser.tabs.query({ active: true, currentWindow: true }))[0]
    }).then((tab) => {
      if (tab?.id === undefined) throw new Error('找不到当前标签页')
      const url = tab.url ? new URL(tab.url) : null
      setSource({ tabId: tab.id, title: tab.title || '未命名标签页', url: tab.url || '', site: url?.hostname || '浏览器页面' })
    }).catch((cause) => setError(cause instanceof Error ? cause.message : '无法读取当前标签页'))
  }, [])
  if (error) return <main className="recording-harness"><p className="recording-error" role="alert">{error}</p></main>
  if (!source) return <main className="recording-harness"><p role="status">正在读取当前标签页…</p></main>
  return <RecordingHarness source={source} client={client} />
}

const root = document.getElementById('root')
if (!root) throw new Error('Side Panel root is missing')
createRoot(root).render(<SidePanel />)
