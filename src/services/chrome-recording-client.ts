import type { CompletedRecording, RecordingCurrent, RecordingDiagnostics, RecordingHarnessClient, RecordingSource, RecordingStorageReadiness } from '../features/recording/RecordingHarness'
import type { RecordingCommand, RecordingResponse, RecordingStatus } from './recording-messages'
import { transcribeAudio } from './asr-client'
import { loadAsrSettings } from './settings'

type ChromeRecordingClientApi = {
  permissions: {
    contains(options: { permissions: string[] }): Promise<boolean>
    request(options: { permissions: string[] }): Promise<boolean>
  }
  tabCapture: { getMediaStreamId(options: { targetTabId: number }): Promise<string> }
  runtime: { sendMessage(message: RecordingCommand): Promise<unknown> }
  storage?: { local: { get(key: string): Promise<Record<string, unknown>>; set(value: Record<string, unknown>): Promise<void> } }
}

const RIGHTS_ACKNOWLEDGEMENT_KEY = 'recordingRightsAcknowledgement'
const RIGHTS_ACKNOWLEDGEMENT_VERSION = 1
const MINIMUM_REMAINING_BYTES = 250 * 1024 * 1024

export class ChromeRecordingClient implements RecordingHarnessClient {
  private readonly api: ChromeRecordingClientApi

  constructor(api?: ChromeRecordingClientApi) {
    this.api = api ?? browser as unknown as ChromeRecordingClientApi
  }

  private async send<T>(message: RecordingCommand): Promise<T> {
    const response = await this.api.runtime.sendMessage(message) as RecordingResponse<T>
    if (!response.ok) throw new Error(response.error)
    return response.data
  }

  private completed(result: { wavUrl: string; fileName: string; draftId: string }): CompletedRecording {
    return result
  }
  async enable(): Promise<boolean> {
    if (await this.api.permissions.contains({ permissions: ['tabCapture'] })) return true
    return this.api.permissions.request({ permissions: ['tabCapture'] })
  }
  async contentRightsAcknowledged(): Promise<boolean> {
    const stored = await this.api.storage?.local.get(RIGHTS_ACKNOWLEDGEMENT_KEY)
    const acknowledgement = stored?.[RIGHTS_ACKNOWLEDGEMENT_KEY] as { version?: number } | undefined
    return acknowledgement?.version === RIGHTS_ACKNOWLEDGEMENT_VERSION
  }
  async acknowledgeContentRights(): Promise<void> {
    await this.api.storage?.local.set({ [RIGHTS_ACKNOWLEDGEMENT_KEY]: { version: RIGHTS_ACKNOWLEDGEMENT_VERSION, acknowledgedAt: new Date().toISOString() } })
  }
  async storageReadiness(): Promise<RecordingStorageReadiness> {
    const estimate = await navigator.storage.estimate()
    const usageBytes = estimate.usage ?? 0
    const quotaBytes = estimate.quota ?? 0
    const remainingBytes = Math.max(0, quotaBytes - usageBytes)
    return { usageBytes, quotaBytes, remainingBytes, usageRatio: quotaBytes > 0 ? usageBytes / quotaBytes : 0, canStart: quotaBytes === 0 || remainingBytes >= MINIMUM_REMAINING_BYTES }
  }
  async start(source: RecordingSource): Promise<void> {
    const streamId = await this.api.tabCapture.getMediaStreamId({ targetTabId: source.tabId })
    await this.send({ type: 'recording.start', source, streamId })
  }
  async pause(): Promise<void> { await this.send({ type: 'recording.pause' }) }
  async resume(): Promise<void> { await this.send({ type: 'recording.resume' }) }
  async complete(): Promise<CompletedRecording> {
    const result = await this.send<{ wavUrl: string; fileName: string; draftId: string }>({ type: 'recording.complete' })
    return this.completed(result)
  }
  async cancel(): Promise<void> { await this.send({ type: 'recording.cancel' }) }
  async status(): Promise<RecordingDiagnostics> {
    const status = await this.send<RecordingStatus>({ type: 'recording.status' })
    return status
  }
  async recoveryAvailable(): Promise<boolean> { return this.send({ type: 'recording.recoveryAvailable' }) }
  async recover(): Promise<CompletedRecording> { return this.completed(await this.send<{ wavUrl: string; fileName: string; draftId: string }>({ type: 'recording.recover' })) }
  async openDraft(draftId: string): Promise<void> { await this.send({ type: 'recording.openDraft', draftId }) }
  async current(): Promise<RecordingCurrent> { return this.send<RecordingCurrent>({ type: 'recording.current' }) }
  async transcribe(recording: CompletedRecording) {
    let audioBlob: Blob
    if (recording.audioBlob) audioBlob = recording.audioBlob
    else audioBlob = await fetch(recording.wavUrl).then((response) => response.blob())
    const durationSeconds = Math.max(0, (audioBlob.size - 44) / 2 / 16_000)
    return transcribeAudio({ audioBlob, filename: recording.fileName, materialId: 'tab-recording-spike', durationSeconds, settings: await loadAsrSettings() })
  }
}
