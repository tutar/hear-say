import { db } from '../db/database'

export const DEFAULT_LOCAL_SPEECH_COMPONENT_URL = 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.tar.gz'

export interface SpeechComponentStore { get(url: string): Promise<ArrayBuffer | undefined>; put(url: string, archive: ArrayBuffer): Promise<void> }

export class IndexedDbSpeechComponentStore implements SpeechComponentStore {
  async get(url: string) { return (await db.speechComponents.get(url))?.archive }
  async put(url: string, archive: ArrayBuffer) { await db.speechComponents.put({ url, archive, cachedAt: new Date().toISOString() }) }
}

export class LocalSpeechComponentLoader {
  constructor(private readonly store: SpeechComponentStore, private readonly fetcher: typeof fetch = fetch) {}

  async load(url = DEFAULT_LOCAL_SPEECH_COMPONENT_URL, onProgress?: (percentage: number) => void): Promise<ArrayBuffer> {
    if (!url.toLowerCase().endsWith('.tar.gz')) throw new Error('Local speech recognition component must be a .tar.gz archive')
    const cached = await this.store.get(url)
    if (cached) { onProgress?.(100); return cached }
    if (typeof browser !== 'undefined') {
      const origin = `${new URL(url).origin}/*`
      if (!await browser.permissions.contains({ origins: [origin] }) && !await browser.permissions.request({ origins: [origin] })) throw new Error('Access to the component download address was not granted')
    }
    const response = await this.fetcher(url)
    if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}. Check the component URL and try again.`)
    const total = Number(response.headers.get('Content-Length'))
    let archive: ArrayBuffer
    if (response.body && total > 0) {
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let received = 0
      while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); received += value.byteLength; onProgress?.(Math.min(100, Math.round(received / total * 100))) }
      const combined = new Uint8Array(received); let offset = 0
      chunks.forEach((chunk) => { combined.set(chunk, offset); offset += chunk.byteLength }); archive = combined.buffer
    } else { archive = await response.arrayBuffer(); onProgress?.(100) }
    await this.store.put(url, archive)
    return archive
  }
}
