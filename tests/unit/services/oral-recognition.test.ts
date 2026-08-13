import { describe, expect, it, vi } from 'vitest'
import { WebSpeechOralRecognizer } from '@/services/oral-recognition'

class FakeRecognition {
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn(() => this.onend?.())
}

describe('Web Speech oral recognition', () => {
  it('requests the microphone on start, streams partial text, and returns final text on manual stop', async () => {
    const recognition = new FakeRecognition()
    const track = { stop: vi.fn() }
    const microphone = { getUserMedia: vi.fn(async () => ({ getTracks: () => [track] })) }
    const updates: string[] = []
    const finals: string[] = []
    const recognizer = new WebSpeechOralRecognizer({ createRecognition: () => recognition, microphone })

    expect(microphone.getUserMedia).not.toHaveBeenCalled()
    await recognizer.start({ onPartial: (text) => updates.push(text), onFinal: (text) => finals.push(text), onError: vi.fn() })
    expect(microphone.getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(recognition).toMatchObject({ lang: 'en-US', continuous: true, interimResults: true })
    recognition.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: 'hello wor' }], { isFinal: false }), Object.assign([{ transcript: 'hello world' }], { isFinal: true })] })
    expect(updates).toEqual(['hello wor'])
    recognition.onend?.()
    expect(recognition.start).toHaveBeenCalledTimes(2)
    expect(finals).toEqual([])
    recognizer.stop()
    expect(finals).toEqual(['hello world'])
    expect(track.stop).toHaveBeenCalled()
  })

  it('reports denied microphone permission without starting recognition', async () => {
    const recognition = new FakeRecognition()
    const microphone = { getUserMedia: vi.fn(async () => { throw new DOMException('denied', 'NotAllowedError') }) }
    const onError = vi.fn()
    const recognizer = new WebSpeechOralRecognizer({ createRecognition: () => recognition, microphone })
    await recognizer.start({ onPartial: vi.fn(), onFinal: vi.fn(), onError })
    expect(onError).toHaveBeenCalledWith({ kind: 'permission-denied', message: expect.any(String) })
    expect(recognition.start).not.toHaveBeenCalled()
  })
})
