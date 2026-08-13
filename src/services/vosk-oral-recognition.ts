import type { KaldiRecognizer, Model } from 'vosk-browser'
import type { OralRecognitionListener, OralRecognizer } from './oral-recognition'
import { IndexedDbSpeechComponentStore, LocalSpeechComponentLoader } from './local-speech-component'

export class VoskOralRecognizer implements OralRecognizer {
  private model: Model | null = null
  private recognizer: KaldiRecognizer | null = null
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private listener: OralRecognitionListener | null = null
  private finalParts: string[] = []
  private stopping = false

  constructor(private readonly loader = new LocalSpeechComponentLoader(new IndexedDbSpeechComponentStore())) {}

  async prepare(url: string, onProgress: (percentage: number) => void): Promise<void> {
    if (this.model) return onProgress(100)
    const archive = await this.loader.load(url, onProgress)
    const objectUrl = URL.createObjectURL(new Blob([archive], { type: 'application/gzip' }))
    try { const { createModel } = await import('vosk-browser'); this.model = await createModel(objectUrl, -1) } finally { URL.revokeObjectURL(objectUrl) }
  }

  async start(listener: OralRecognitionListener): Promise<void> {
    if (!this.model) { listener.onError({ kind: 'unavailable', message: 'Download the local speech recognition component before recording.' }); return }
    this.listener = listener; this.finalParts = []; this.stopping = false
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1, sampleRate: 16000 } })
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      listener.onError({ kind: denied ? 'permission-denied' : 'unavailable', message: denied ? 'Microphone access was denied. Allow microphone access in browser settings and try again.' : 'Local speech recognition could not access the microphone.' }); return
    }
    this.context = new AudioContext({ sampleRate: 16000 })
    this.recognizer = new this.model.KaldiRecognizer(this.context.sampleRate)
    this.recognizer.on('partialresult', (message) => { if ('result' in message) listener.onPartial(message.result.partial) })
    this.recognizer.on('result', (message) => {
      if (!('result' in message)) return
      if (message.result.text) this.finalParts.push(message.result.text)
      if (this.stopping) { listener.onFinal(this.finalParts.join(' ').trim()); this.cleanupRecognizer() }
    })
    this.source = this.context.createMediaStreamSource(this.stream)
    this.processor = this.context.createScriptProcessor(4096, 1, 1)
    this.processor.onaudioprocess = (event) => this.recognizer?.acceptWaveform(event.inputBuffer)
    this.source.connect(this.processor); this.processor.connect(this.context.destination)
  }

  stop(): void {
    if (!this.recognizer) return
    this.stopping = true
    this.processor?.disconnect(); this.source?.disconnect(); this.stream?.getTracks().forEach((track) => track.stop())
    this.recognizer.retrieveFinalResult()
  }

  private cleanupRecognizer() {
    this.recognizer?.remove(); this.recognizer = null; this.processor = null; this.source = null; this.stream = null
    void this.context?.close(); this.context = null; this.stopping = false
  }
}
