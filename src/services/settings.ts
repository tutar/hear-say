import type { AsrSettings } from '../domain/types'

export const DEFAULT_ASR_SETTINGS: AsrSettings = {
  baseUrl: 'http://localhost:8021/v1',
  apiKey: '',
  model: 'sensevoice',
}

function normalizeBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('ASR Base URL must use HTTP or HTTPS')
  return url.toString().replace(/\/$/, '')
}

export async function loadAsrSettings(): Promise<AsrSettings> {
  const stored = await browser.storage.local.get('asrSettings') as { asrSettings?: AsrSettings }
  return stored.asrSettings ? { ...DEFAULT_ASR_SETTINGS, ...stored.asrSettings } : { ...DEFAULT_ASR_SETTINGS }
}

export async function saveAsrSettings(settings: AsrSettings): Promise<void> {
  await browser.storage.local.set({ asrSettings: { ...settings, baseUrl: normalizeBaseUrl(settings.baseUrl) } })
}
