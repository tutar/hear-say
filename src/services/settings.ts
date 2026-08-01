import type { AsrSettings, VocabularySettings } from '../domain/types'

export const DEFAULT_ASR_SETTINGS: AsrSettings = {
  baseUrl: 'http://localhost:8021/v1',
  apiKey: '',
  model: 'sensevoice',
  language: 'en',
}
export const DEFAULT_VOCABULARY_SETTINGS: VocabularySettings = {
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-v4-flash',
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

export async function loadVocabularySettings(): Promise<VocabularySettings> {
  const stored = await browser.storage.local.get('vocabularySettings') as { vocabularySettings?: VocabularySettings }
  return stored.vocabularySettings ? { ...DEFAULT_VOCABULARY_SETTINGS, ...stored.vocabularySettings } : { ...DEFAULT_VOCABULARY_SETTINGS }
}

export async function saveVocabularySettings(settings: VocabularySettings): Promise<void> {
  await browser.storage.local.set({ vocabularySettings: { ...settings, baseUrl: normalizeBaseUrl(settings.baseUrl) } })
}
