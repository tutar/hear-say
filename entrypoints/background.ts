import { WordRepository } from '../src/db/word-repository'
import { createDeepSeekExplainer } from '../src/services/deepseek-client'
import { loadVocabularySettings } from '../src/services/settings'
import { VocabularyService } from '../src/services/vocabulary-service'
import type { VocabularyMessage, VocabularyMessageResponse } from '../src/services/vocabulary-messages'
import { openOrFocusAppTab } from '../src/services/app-tab'
import type { OffscreenRecordingCommand, RecordingCommand, RecordingResponse } from '../src/services/recording-messages'
import { registerRecordingContextMenu } from '../src/services/recording-context-menu'
import { RecordingRepository } from '../src/db/recording-repository'
import { createRecordingDraft, type RecordingDraftState } from '../src/domain/recording-draft'
import type { RecordingSource } from '../src/features/recording/RecordingHarness'

type ActiveRecording = { sessionId: string; sourceTabId: number; source: RecordingSource; startedAt: string }
type ChromeRecordingBoundary = {
  runtime: {
    getURL(path: string): string
    getContexts(filter: { contextTypes: string[]; documentUrls: string[] }): Promise<unknown[]>
  }
  offscreen: {
    createDocument(options: { url: string; reasons: string[]; justification: string }): Promise<void>
  }
}
const chromeRecording = (globalThis as unknown as { chrome: ChromeRecordingBoundary }).chrome
const ACTIVE_RECORDING_KEY = 'activeRecordingSession'
const LAST_COMPLETED_RECORDING_KEY = 'lastCompletedRecording'
const recordingRepository = new RecordingRepository()
let creatingOffscreen: Promise<void> | null = null

async function ensureOffscreenRecorder(): Promise<void> {
  const url = chromeRecording.runtime.getURL('offscreen.html')
  const contexts = await chromeRecording.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] })
  if (contexts.length > 0) return
  if (!creatingOffscreen) creatingOffscreen = chromeRecording.offscreen.createDocument({ url: 'offscreen.html', reasons: ['USER_MEDIA', 'BLOBS'], justification: 'Capture tab audio and expose the completed WAV while the Side Panel is closed' }).finally(() => { creatingOffscreen = null })
  await creatingOffscreen
}

async function activeRecording(): Promise<ActiveRecording | null> {
  const stored = await browser.storage.local.get(ACTIVE_RECORDING_KEY) as Record<string, ActiveRecording | undefined>
  return stored[ACTIVE_RECORDING_KEY] ?? null
}

async function interruptedRecording(): Promise<ActiveRecording | null> {
  const stored = await browser.storage.local.get('lastInterruptedRecording') as { lastInterruptedRecording?: ActiveRecording }
  return stored.lastInterruptedRecording ?? null
}

async function sendToRecorder<T>(message: OffscreenRecordingCommand): Promise<T> {
  const response = await browser.runtime.sendMessage(message) as RecordingResponse<T>
  if (!response.ok) throw new Error(response.error)
  return response.data
}

async function retainDraft(recording: ActiveRecording, state: RecordingDraftState): Promise<boolean> {
  const sizeBytes = await recordingRepository.persistedBytes(recording.sessionId)
  if (sizeBytes === 0) { await recordingRepository.deleteSession(recording.sessionId); return false }
  await recordingRepository.saveDraft(createRecordingDraft({
    sessionId: recording.sessionId,
    state,
    source: { title: recording.source.title, url: recording.source.url, site: recording.source.site },
    startedAt: recording.startedAt,
    durationSeconds: sizeBytes / 2 / 16_000,
    sizeBytes,
    now: new Date().toISOString(),
  }))
  return true
}

async function handleRecording(message: RecordingCommand): Promise<RecordingResponse<unknown>> {
  try {
    if (message.type === 'recording.durationWarning') {
      const active = await activeRecording()
      if (active?.sessionId === message.sessionId) {
        await browser.storage.local.set({ recordingDurationWarning: { sessionId: message.sessionId, warnedAt: new Date().toISOString() } })
        await browser.notifications.create(`recording-warning-${message.sessionId}`, { type: 'basic', iconUrl: browser.runtime.getURL('/notification-icon.svg'), title: '已录制 30 分钟', message: '建议尽快完成。达到 60 分钟时，Hear & Say 会自动保存为草稿。' })
      }
      return { ok: true, data: undefined }
    }
    if (message.type === 'recording.autoCompleted') {
      const active = await activeRecording()
      if (!active || active.sessionId !== message.sessionId) return { ok: true, data: undefined }
      await retainDraft(active, 'completed')
      const completed = { ...message.result, draftId: active.sessionId }
      await browser.storage.local.set({ [LAST_COMPLETED_RECORDING_KEY]: completed })
      await browser.storage.local.remove(ACTIVE_RECORDING_KEY)
      await browser.notifications.create(`recording-completed-${message.sessionId}`, { type: 'basic', iconUrl: browser.runtime.getURL('/notification-icon.svg'), title: '录音已自动完成', message: '已达到 60 分钟上限，录音已安全保存到资料库草稿。' })
      return { ok: true, data: undefined }
    }
    if (message.type === 'recording.openDraft') {
      await openOrFocusAppTab(browser, `#/recording-drafts/${encodeURIComponent(message.draftId)}`)
      return { ok: true, data: undefined }
    }
    if (message.type === 'recording.start') {
      if (await activeRecording()) throw new Error('已有标签页正在录制，请先完成或取消')
      await ensureOffscreenRecorder()
      await browser.storage.local.remove([LAST_COMPLETED_RECORDING_KEY, 'recordingDurationWarning'])
      const sessionId = crypto.randomUUID()
      await sendToRecorder({ type: 'recording.offscreen.start', sessionId, streamId: message.streamId })
      await browser.storage.local.set({ [ACTIVE_RECORDING_KEY]: { sessionId, sourceTabId: message.source.tabId, source: message.source, startedAt: new Date().toISOString() } })
      return { ok: true, data: undefined }
    }
    if (message.type === 'recording.current') {
      const active = await activeRecording()
      if (active) {
        await ensureOffscreenRecorder()
        const status = await sendToRecorder<{ state: string; chunkCount: number; bufferedSamples: number; persistedBytes: number }>({ type: 'recording.offscreen.status' })
        return { ok: true, data: status.state === 'idle' ? { ...status, state: 'interrupted' } : status }
      }
      const stored = await browser.storage.local.get(LAST_COMPLETED_RECORDING_KEY) as Record<string, { wavUrl: string; fileName: string; draftId: string } | undefined>
      if (stored[LAST_COMPLETED_RECORDING_KEY]) return { ok: true, data: { state: 'completed', chunkCount: 0, bufferedSamples: 0, persistedBytes: 0, capturedMilliseconds: 60 * 60_000, result: stored[LAST_COMPLETED_RECORDING_KEY] } }
      if (await interruptedRecording()) return { ok: true, data: { state: 'interrupted', chunkCount: 0, bufferedSamples: 0, persistedBytes: 0 } }
      return { ok: true, data: { state: 'idle', chunkCount: 0, bufferedSamples: 0, persistedBytes: 0 } }
    }
    if (message.type === 'recording.recoveryAvailable') return { ok: true, data: Boolean(await activeRecording() ?? await interruptedRecording()) }
    if (message.type === 'recording.recover') {
      const candidate = await activeRecording() ?? await interruptedRecording()
      if (!candidate) throw new Error('没有可恢复的录音分片')
      await ensureOffscreenRecorder()
      const status = await sendToRecorder<{ state: string }>({ type: 'recording.offscreen.status' })
      if (status.state !== 'idle') throw new Error('录音仍在进行，无需恢复')
      const result = await sendToRecorder({ type: 'recording.offscreen.recover', sessionId: candidate.sessionId })
      if (!await recordingRepository.getDraft(candidate.sessionId)) await retainDraft(candidate, 'interrupted')
      await browser.storage.local.remove([ACTIVE_RECORDING_KEY, 'lastInterruptedRecording'])
      return { ok: true, data: { ...result as object, draftId: candidate.sessionId } }
    }
    const active = await activeRecording()
    if (!active) throw new Error('没有活动的 Recording Session')
    if (message.type === 'recording.pause') await sendToRecorder({ type: 'recording.offscreen.pause' })
    if (message.type === 'recording.resume') await sendToRecorder({ type: 'recording.offscreen.resume' })
    if (message.type === 'recording.status') return { ok: true, data: await sendToRecorder({ type: 'recording.offscreen.status' }) }
    if (message.type === 'recording.complete') {
      const result = await sendToRecorder({ type: 'recording.offscreen.complete' })
      await retainDraft(active, 'completed')
      await browser.storage.local.remove(ACTIVE_RECORDING_KEY)
      return { ok: true, data: { ...result as object, draftId: active.sessionId } }
    }
    if (message.type === 'recording.cancel') {
      await sendToRecorder({ type: 'recording.offscreen.cancel' })
      await browser.storage.local.remove(ACTIVE_RECORDING_KEY)
    }
    return { ok: true, data: undefined }
  } catch (cause) { return { ok: false, error: cause instanceof Error ? cause.message : '标签页录音失败' } }
}

export default defineBackground(() => {
  registerRecordingContextMenu(browser)

  browser.action.onClicked.addListener(async () => {
    await openOrFocusAppTab(browser)
  })

  browser.tabs.onRemoved.addListener(async (tabId) => {
    const active = await activeRecording()
    if (active?.sourceTabId !== tabId) return
    try { await sendToRecorder({ type: 'recording.offscreen.complete' }) } catch { /* persisted chunks, if any, are retained below */ } finally {
      const retained = await retainDraft(active, 'interrupted')
      if (retained) await browser.storage.local.set({ lastInterruptedRecording: { ...active, reason: 'source_tab_closed', interruptedAt: new Date().toISOString() } })
      else await browser.storage.local.remove('lastInterruptedRecording')
      await browser.storage.local.remove(ACTIVE_RECORDING_KEY)
    }
  })

  browser.runtime.onMessage.addListener(async (message: VocabularyMessage | RecordingCommand | OffscreenRecordingCommand, sender): Promise<VocabularyMessageResponse | RecordingResponse<unknown> | undefined> => {
    if (message.type.startsWith('recording.offscreen.')) return undefined
    if (message.type.startsWith('recording.')) return handleRecording(message as RecordingCommand)
    try {
      const repository = new WordRepository()
      if (message.type === 'vocabulary.lookup') {
        const settings = await loadVocabularySettings()
        const origin = `${new URL(settings.baseUrl).origin}/*`
        if (!await browser.permissions.contains({ origins: [origin] })) throw new Error('请先在 AI 服务设置中保存并授权词汇解释服务')
        const service = new VocabularyService(repository, createDeepSeekExplainer(settings))
        return { ok: true, data: await service.lookup(message.selection) }
      }
      if (message.type === 'vocabulary.add') {
        const entry = await repository.addContext({ ...message.lookup, sentence: message.selection.sentence, source: message.source })
        return { ok: true, data: entry }
      }
      if (message.type === 'vocabulary.speak') {
        browser.tts.stop()
        await browser.tts.speak(message.term, { lang: 'en-US', enqueue: false })
        return { ok: true, data: null }
      }
      if (message.type === 'vocabulary.stop') { browser.tts.stop(); return { ok: true, data: null } }
      if (message.type === 'vocabulary.openSettings') {
        await openOrFocusAppTab(browser, '#/settings')
        return { ok: true, data: null }
      }
      return { ok: false, error: '不支持的词汇操作' }
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : '词汇操作失败' } }
  })
})
