export type OralRecognitionError = { kind: 'permission-denied' | 'unavailable'; message: string }
export type OralRecognitionListener = { onPartial(text: string): void; onFinal(text: string): void; onError(error: OralRecognitionError): void }
export interface OralRecognizer { start(listener: OralRecognitionListener): Promise<void>; stop(): void }

type SpeechResult = { isFinal: boolean; 0: { transcript: string } }
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> }
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechEvent) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
type Microphone = { getUserMedia(constraints: { audio: true }): Promise<{ getTracks(): { stop(): void }[] }> }

export class WebSpeechOralRecognizer implements OralRecognizer {
  private recognition: SpeechRecognitionLike | null = null
  private tracks: { stop(): void }[] = []
  private finalText = ''
  private listener: OralRecognitionListener | null = null
  private manuallyStopped = false

  constructor(private readonly dependencies: { createRecognition(): SpeechRecognitionLike; microphone: Microphone }) {}

  async start(listener: OralRecognitionListener): Promise<void> {
    this.listener = listener
    this.finalText = ''
    this.manuallyStopped = false
    try {
      const stream = await this.dependencies.microphone.getUserMedia({ audio: true })
      this.tracks = stream.getTracks()
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      listener.onError({ kind: denied ? 'permission-denied' : 'unavailable', message: denied ? 'Microphone access was denied. Allow microphone access in browser settings and try again.' : 'Online speech recognition is unavailable.' })
      return
    }
    const recognition = this.dependencies.createRecognition()
    this.recognition = recognition
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let partial = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result.isFinal) this.finalText = `${this.finalText} ${result[0].transcript}`.trim()
        else partial = `${partial} ${result[0].transcript}`.trim()
      }
      if (partial) listener.onPartial(partial)
    }
    recognition.onerror = (event) => {
      const denied = event.error === 'not-allowed' || event.error === 'service-not-allowed'
      this.manuallyStopped = true
      this.releaseMicrophone()
      listener.onError({ kind: denied ? 'permission-denied' : 'unavailable', message: denied ? 'Microphone access was denied. Allow microphone access in browser settings and try again.' : 'Online speech recognition is unavailable.' })
    }
    recognition.onend = () => {
      if (!this.manuallyStopped) { recognition.start(); return }
      this.releaseMicrophone(); listener.onFinal(this.finalText.trim())
    }
    recognition.start()
  }

  stop(): void { this.manuallyStopped = true; this.recognition?.stop() }

  private releaseMicrophone() { this.tracks.forEach((track) => track.stop()); this.tracks = []; this.recognition = null }
}

export function createWebSpeechOralRecognizer(): OralRecognizer | null {
  const scope = globalThis as typeof globalThis & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
  const Constructor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition
  if (!Constructor || !navigator.mediaDevices?.getUserMedia) return null
  return new WebSpeechOralRecognizer({ createRecognition: () => new Constructor(), microphone: navigator.mediaDevices })
}
