import { useEffect, useState } from 'react'
import { EarIcon } from '../practice/EarIcon'

export type RecordingSource = { tabId: number; title: string; url: string; site: string }
export type CompletedRecording = { wavUrl: string; fileName: string; draftId: string; audioBlob?: Blob }
export type RecordingTranscriptLine = { startSeconds: number; endSeconds: number; text: string }
export type RecordingDiagnostics = { chunkCount: number; bufferedSamples: number; persistedBytes: number; capturedMilliseconds?: number }
export type RecordingStorageReadiness = { usageBytes: number; quotaBytes: number; remainingBytes: number; usageRatio: number; canStart: boolean }
export type RecordingCurrent = RecordingDiagnostics & ({ state: 'idle' | 'recording' | 'paused' | 'interrupted' } | { state: 'completed'; result: CompletedRecording })
export type RecordingHarnessClient = {
  enable(): Promise<boolean>
  start(source: RecordingSource): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  complete(): Promise<CompletedRecording>
  cancel(): Promise<void>
  status?(): Promise<RecordingDiagnostics>
  transcribe?(recording: CompletedRecording): Promise<RecordingTranscriptLine[]>
  recoveryAvailable?(): Promise<boolean>
  recover?(): Promise<CompletedRecording>
  current?(): Promise<RecordingCurrent>
  openDraft?(draftId: string): Promise<void>
  contentRightsAcknowledged?(): Promise<boolean>
  acknowledgeContentRights?(): Promise<void>
  storageReadiness?(): Promise<RecordingStorageReadiness>
}

type HarnessState = 'checking' | 'consent' | 'permission' | 'ready' | 'recording' | 'paused' | 'completed' | 'deferred' | 'cancelled'

export function RecordingHarness({ source, client }: { source: RecordingSource; client: RecordingHarnessClient }) {
  const [state, setState] = useState<HarnessState>(client.contentRightsAcknowledged ? 'checking' : 'permission')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [startedAt, setStartedAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<CompletedRecording | null>(null)
  const [error, setError] = useState('')
  const [diagnostics, setDiagnostics] = useState<RecordingDiagnostics>({ chunkCount: 0, bufferedSamples: 0, persistedBytes: 0 })
  const [canRecover, setCanRecover] = useState(false)
  const [busy, setBusy] = useState(false)
  const [storageReadiness, setStorageReadiness] = useState<RecordingStorageReadiness | null>(null)

  useEffect(() => {
    if (state !== 'recording') return
    const update = () => setElapsed(Date.now() - startedAt)
    update()
    const timer = window.setInterval(update, 250)
    return () => window.clearInterval(timer)
  }, [startedAt, state])

  useEffect(() => {
    if (!client.status || (state !== 'recording' && state !== 'paused')) return
    const update = async () => {
      try {
        const current = client.current ? await client.current() : { ...await client.status!(), state: state as 'recording' | 'paused' }
        setDiagnostics(current)
        if (current.capturedMilliseconds !== undefined) setElapsed(current.capturedMilliseconds)
        if (current.state === 'completed') { setResult(current.result); setState('completed') }
      } catch { /* the next current-state poll reconciles lifecycle transitions */ }
    }
    void update()
    const timer = window.setInterval(() => void update(), 1_000)
    return () => window.clearInterval(timer)
  }, [client, state])

  useEffect(() => { if (client.recoveryAvailable) void client.recoveryAvailable().then(setCanRecover).catch(() => setCanRecover(false)) }, [client])
  useEffect(() => {
    if (!client.contentRightsAcknowledged) return
    void client.contentRightsAcknowledged().then((acknowledged) => setState(acknowledged ? 'permission' : 'consent')).catch(() => setState('consent'))
  }, [client])
  useEffect(() => {
    if (state !== 'ready') return
    if (!client.storageReadiness) { setStorageReadiness({ usageBytes: 0, quotaBytes: 0, remainingBytes: 0, usageRatio: 0, canStart: true }); return }
    setStorageReadiness(null)
    void client.storageReadiness().then(setStorageReadiness).catch(() => setStorageReadiness({ usageBytes: 0, quotaBytes: 0, remainingBytes: 0, usageRatio: 0, canStart: true }))
  }, [client, state])
  useEffect(() => {
    if (!client.current) return
    void client.current().then((current) => {
      setDiagnostics(current)
      if (current.capturedMilliseconds !== undefined) setElapsed(current.capturedMilliseconds)
      if (current.state === 'recording' || current.state === 'paused') { setStartedAt(Date.now() - (current.capturedMilliseconds ?? 0)); setState(current.state) }
      if (current.state === 'interrupted') setCanRecover(true)
      if (current.state === 'completed') { setResult(current.result); setState('completed') }
    }).catch(() => undefined)
  }, [client])

  const act = async (action: () => Promise<void>, next: HarnessState) => {
    setBusy(true)
    setError('')
    try { await action(); setState(next) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '录制操作失败') }
    finally { setBusy(false) }
  }

  const status = { checking: '正在检查', consent: '等待确认', permission: '等待启用', ready: '准备就绪', recording: '正在录制', paused: '已暂停', completed: '录制完成', deferred: '已保存到资料库', cancelled: '已取消' }[state]
  const elapsedText = new Date(elapsed).toISOString().slice(14, 19)

  return <main className="recording-harness">
    <header className="recording-brand"><span className="recording-ear" aria-hidden="true"><EarIcon /></span><div><strong>Hear &amp; Say</strong><small>标签页录音</small></div></header>
    <section className="recording-source" aria-label="录音来源">
      <p>当前来源</p><h1>{source.title}</h1><span>{source.site}</span>
    </section>
    <div className={`recording-rail is-${state}`} aria-hidden="true"><i /><i /><i /><i /><i /></div>
    <section className="recording-console">
      <div className="recording-readout"><span role="status">{status}</span><strong>{elapsedText}</strong></div>
      {state === 'consent' && <section className="recording-consent"><p className="recording-consent-kicker">仅首次确认</p><h2>开始前请确认</h2><p>只录制你有权用于个人学习的内容。录音和来源信息保存在本机，不会自动上传。</p><label><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} />我确认有权将这段内容用于个人学习</label><button className="recording-primary" type="button" disabled={!rightsConfirmed || busy} onClick={() => act(async () => { await client.acknowledgeContentRights?.() }, 'permission')}>确认并继续</button></section>}
      <div className="recording-actions">
        {state === 'permission' && <button className="recording-primary" disabled={busy} onClick={() => act(async () => { if (!await client.enable()) throw new Error('未授予标签页录制权限') }, 'ready')}>启用标签页录制</button>}
        {state === 'permission' && canRecover && client.recover && <button disabled={busy} onClick={() => act(async () => { setResult(await client.recover!()); setCanRecover(false) }, 'completed')}>恢复已保存的录音</button>}
        {state === 'ready' && <button className="recording-primary" disabled={busy || !storageReadiness?.canStart} onClick={() => act(async () => { await client.start(source); setStartedAt(Date.now()) }, 'recording')}>开始录制</button>}
        {state === 'recording' && <button disabled={busy} onClick={() => act(() => client.pause(), 'paused')}>暂停</button>}
        {state === 'paused' && <button disabled={busy} onClick={() => act(() => client.resume(), 'recording')}>继续</button>}
        {(state === 'recording' || state === 'paused') && <button className="recording-primary" disabled={busy} onClick={() => act(async () => setResult(await client.complete()), 'completed')}>完成录制</button>}
        {(state === 'recording' || state === 'paused') && <button className="recording-danger" disabled={busy} onClick={() => act(() => client.cancel(), 'cancelled')}>取消</button>}
      </div>
      {state === 'ready' && storageReadiness && !storageReadiness.canStart && <p className="recording-storage-block" role="alert">剩余空间不足 250 MB，暂时不能开始新录制。请先处理录制草稿或释放浏览器存储空间。</p>}
      {state === 'ready' && storageReadiness?.canStart && storageReadiness.usageRatio >= .8 && <p className="recording-storage-warning" role="status">录制存储已使用 {Math.round(storageReadiness.usageRatio * 100)}%，建议尽快处理已有草稿。</p>}
      {(state === 'permission' || state === 'ready') && <p className="recording-rights-reminder">请只录制你有权用于个人学习的内容。</p>}
      {result && state === 'completed' && <div className="recording-completed-actions"><p>录音已安全保存为草稿。现在编辑，或稍后在资料库继续。</p><button className="recording-primary" disabled={!client.openDraft} onClick={() => { setError(''); void client.openDraft?.(result.draftId).catch((cause) => setError(cause instanceof Error ? cause.message : '无法打开录制草稿')) }}>编辑并导入</button><button onClick={() => setState('deferred')}>稍后处理</button></div>}
      {state === 'deferred' && <p className="recording-deferred">你可以关闭侧栏，之后从资料库的“录制草稿”继续。</p>}
      {error && <p className="recording-error" role="alert">{error}</p>}
      {(state === 'recording' || state === 'paused') && <p className="recording-chunks">{diagnostics.chunkCount} 个分片</p>}
      {(state === 'recording' || state === 'paused') && elapsed >= 30 * 60_000 && <p className="recording-duration-warning" role="status">已录制 30 分钟，建议尽快完成。达到 60 分钟时会自动保存为草稿。</p>}
    </section>
    <details className="recording-diagnostics"><summary>诊断信息</summary><dl><div><dt>来源标签</dt><dd>{source.tabId}</dd></div><div><dt>目标格式</dt><dd>PCM · 16 kHz · mono</dd></div><div><dt>捕获时长</dt><dd>{elapsedText}</dd></div><div><dt>缓冲采样</dt><dd>{diagnostics.bufferedSamples.toLocaleString()}</dd></div><div><dt>已写入</dt><dd>{Math.round(diagnostics.persistedBytes / 1024).toLocaleString()} KiB</dd></div></dl></details>
  </main>
}
