import { RecordingRepository } from '../../src/db/recording-repository'
import type { OffscreenRecordingCommand, RecordingResponse, RecordingStatus } from '../../src/services/recording-messages'
import { RECORDING_LIMIT_MILLISECONDS, RECORDING_WARNING_MILLISECONDS } from '../../src/domain/recording-policy'

const SAMPLE_RATE = 16_000
const CHUNK_SAMPLES = SAMPLE_RATE * 5
const WARNING_SAMPLES = SAMPLE_RATE * RECORDING_WARNING_MILLISECONDS / 1_000
const LIMIT_SAMPLES = SAMPLE_RATE * RECORDING_LIMIT_MILLISECONDS / 1_000

class OffscreenRecorder {
  private repository = new RecordingRepository()
  private sessionId: string | null = null
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private processor: AudioWorkletNode | null = null
  private samples: number[] = []
  private sequence = 0
  private state: RecordingStatus['state'] = 'idle'
  private writes: Promise<void> = Promise.resolve()
  private capturedSamples = 0
  private warningSent = false
  private autoCompleting = false

  async start(sessionId: string, streamId: string): Promise<void> {
    if (this.state !== 'idle') throw new Error('已有活动的 Recording Session')
    this.sessionId = sessionId; this.sequence = 0; this.samples = []; this.capturedSamples = 0; this.warningSent = false; this.autoCompleting = false
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } } } as MediaStreamConstraints)
    this.context = new AudioContext({ sampleRate: SAMPLE_RATE })
    await this.context.audioWorklet.addModule(new URL('/audio-recorder-worklet.js', location.href).href)
    const source = this.context.createMediaStreamSource(this.stream)
    this.processor = new AudioWorkletNode(this.context, 'hear-say-pcm-capture')
    const silentMonitor = this.context.createGain()
    silentMonitor.gain.value = 0
    source.connect(this.context.destination)
    source.connect(this.processor)
    this.processor.connect(silentMonitor).connect(this.context.destination)
    this.processor.port.onmessage = (event: MessageEvent<Float32Array | { type: 'flushed' }>) => {
      if (!(event.data instanceof Float32Array)) return
      if (this.state !== 'recording') return
      const remaining = Math.max(0, LIMIT_SAMPLES - this.capturedSamples)
      const accepted = event.data.subarray(0, remaining)
      for (const value of accepted) this.samples.push(Math.round(Math.max(-1, Math.min(1, value)) * (value < 0 ? 32_768 : 32_767)))
      this.capturedSamples += accepted.length
      if (this.samples.length >= CHUNK_SAMPLES) this.flush()
      if (!this.warningSent && this.capturedSamples >= WARNING_SAMPLES) {
        this.warningSent = true
        void browser.runtime.sendMessage({ type: 'recording.durationWarning', sessionId })
      }
      if (!this.autoCompleting && this.capturedSamples >= LIMIT_SAMPLES) {
        this.autoCompleting = true; this.state = 'paused'
        void this.complete().then((result) => browser.runtime.sendMessage({ type: 'recording.autoCompleted', sessionId, result }))
      }
    }
    this.state = 'recording'
  }

  pause(): void { if (this.state !== 'recording') throw new Error('当前录音不能暂停'); this.state = 'paused' }
  resume(): void { if (this.state !== 'paused') throw new Error('当前录音不能继续'); this.state = 'recording' }

  private flush(): void {
    if (!this.sessionId || this.samples.length === 0) return
    const samples = Int16Array.from(this.samples.splice(0))
    const chunk = { sessionId: this.sessionId, sequence: this.sequence, sampleRate: SAMPLE_RATE, samples }
    this.sequence += 1
    this.writes = this.writes.then(() => this.repository.appendChunk(chunk))
  }

  private async release(): Promise<void> {
    this.processor?.port.close()
    this.processor?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    await this.context?.close()
    this.processor = null; this.stream = null; this.context = null; this.state = 'idle'
  }

  async complete(): Promise<{ wavUrl: string; fileName: string }> {
    if (!this.sessionId || this.state === 'idle') throw new Error('没有活动的 Recording Session')
    await this.flushProcessor()
    this.flush(); await this.writes
    const wav = await this.repository.reconstructWav(this.sessionId)
    await this.release()
    const audioBlob = new Blob([wav.slice().buffer as ArrayBuffer], { type: 'audio/wav' })
    return { wavUrl: URL.createObjectURL(audioBlob), fileName: `hear-say-${new Date().toISOString().replaceAll(':', '-')}.wav` }
  }

  private async flushProcessor(): Promise<void> {
    if (!this.processor) return
    await new Promise<void>((resolve) => {
      const listener = (event: MessageEvent<Float32Array | { type: 'flushed' }>) => {
        if (!(event.data instanceof Float32Array)) { this.processor?.port.removeEventListener('message', listener); resolve() }
      }
      this.processor!.port.addEventListener('message', listener)
      this.processor!.port.postMessage({ type: 'flush' })
    })
  }

  async recover(sessionId: string): Promise<{ wavUrl: string; fileName: string }> {
    if (this.state !== 'idle') throw new Error('活动录音不能作为中断录音恢复')
    const wav = await this.repository.reconstructWav(sessionId)
    const audioBlob = new Blob([wav.slice().buffer as ArrayBuffer], { type: 'audio/wav' })
    return { wavUrl: URL.createObjectURL(audioBlob), fileName: `hear-say-recovered-${sessionId}.wav` }
  }

  async cancel(): Promise<void> {
    const sessionId = this.sessionId
    await this.release()
    if (sessionId) await this.repository.deleteSession(sessionId)
    this.sessionId = null; this.samples = []; this.sequence = 0
  }

  async status(): Promise<RecordingStatus> {
    return { state: this.state, chunkCount: this.sessionId ? await this.repository.chunkCount(this.sessionId) : 0, bufferedSamples: this.samples.length, persistedBytes: this.sessionId ? await this.repository.persistedBytes(this.sessionId) : 0, capturedMilliseconds: this.capturedSamples / SAMPLE_RATE * 1_000 }
  }
}

const recorder = new OffscreenRecorder()
async function handleOffscreenCommand(message: OffscreenRecordingCommand): Promise<RecordingResponse<unknown>> {
  try {
    if (message.type === 'recording.offscreen.start') await recorder.start(message.sessionId, message.streamId)
    else if (message.type === 'recording.offscreen.pause') recorder.pause()
    else if (message.type === 'recording.offscreen.resume') recorder.resume()
    else if (message.type === 'recording.offscreen.cancel') await recorder.cancel()
    else if (message.type === 'recording.offscreen.complete') return { ok: true, data: await recorder.complete() }
    else if (message.type === 'recording.offscreen.recover') return { ok: true, data: await recorder.recover(message.sessionId) }
    else if (message.type === 'recording.offscreen.status') return { ok: true, data: await recorder.status() }
    return { ok: true, data: undefined }
  } catch (cause) { return { ok: false, error: cause instanceof Error ? cause.message : 'Offscreen 录音失败' } }
}
browser.runtime.onMessage.addListener((message: OffscreenRecordingCommand): Promise<RecordingResponse<unknown>> | undefined => {
  if (!message.type.startsWith('recording.offscreen.')) return undefined
  return handleOffscreenCommand(message)
})
