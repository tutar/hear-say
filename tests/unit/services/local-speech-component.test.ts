import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDatabaseForTest } from '@/db/database'
import { IndexedDbSpeechComponentStore, LocalSpeechComponentLoader } from '@/services/local-speech-component'

describe('local speech recognition component', () => {
  beforeEach(resetDatabaseForTest)

  it('downloads a tar.gz with progress once and reuses it from IndexedDB', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const fetcher = vi.fn(async () => new Response(bytes, { status: 200, headers: { 'Content-Length': '4' } }))
    const progress: number[] = []
    const first = new LocalSpeechComponentLoader(new IndexedDbSpeechComponentStore(), fetcher)
    expect(await first.load('https://models.example/vosk-model-small-en-us-0.15.tar.gz', (value) => progress.push(value))).toEqual(bytes.buffer)
    const second = new LocalSpeechComponentLoader(new IndexedDbSpeechComponentStore(), fetcher)
    expect(await second.load('https://models.example/vosk-model-small-en-us-0.15.tar.gz')).toEqual(bytes.buffer)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(progress.at(-1)).toBe(100)
  })

  it('rejects zip sources before downloading', async () => {
    const fetcher = vi.fn()
    const loader = new LocalSpeechComponentLoader(new IndexedDbSpeechComponentStore(), fetcher)
    await expect(loader.load('https://models.example/vosk-small-en-us.zip')).rejects.toThrow('tar.gz')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
