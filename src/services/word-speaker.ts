type SpeechEvent = { type: string }
type SpeechEngine = {
  speak: (utterance: string, options: { lang: string; enqueue: boolean; onEvent: (event: SpeechEvent) => void }) => Promise<void>
  stop: () => void
}

export class WordSpeaker {
  private activeTerm: string | null = null
  constructor(private readonly engine: SpeechEngine, private readonly onChange: (term: string | null) => void = () => undefined) {}

  private setActive(term: string | null) { this.activeTerm = term; this.onChange(term) }

  async toggle(term: string): Promise<string | null> {
    if (this.activeTerm === term) {
      this.engine.stop()
      this.setActive(null)
      return null
    }
    if (this.activeTerm) this.engine.stop()
    this.setActive(term)
    await this.engine.speak(term, { lang: 'en-US', enqueue: false, onEvent: (event) => { if (['end', 'error', 'cancelled', 'interrupted'].includes(event.type)) this.setActive(null) } })
    return term
  }

  get active(): string | null { return this.activeTerm }
}
