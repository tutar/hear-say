import type { AsrSettings, VocabularySettings } from '../domain/types'

export const DEFAULT_ASR_SETTINGS: AsrSettings = {
  provider: 'assemblyai',
  baseUrl: 'https://api.assemblyai.com/v2',
  apiKey: '',
  model: 'universal-3-5-pro',
  language: 'en',
}
export const DEFAULT_VOCABULARY_SETTINGS: VocabularySettings = {
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-v4-flash',
}

export function isAsrConfigured(settings: AsrSettings): boolean {
  if (settings.provider === 'assemblyai') return settings.apiKey.trim().length > 0
  return settings.baseUrl.trim().length > 0 && settings.model.trim().length > 0
}

export function isVocabularyConfigured(settings: VocabularySettings): boolean {
  return Boolean(settings.baseUrl.trim() && settings.model.trim() && settings.apiKey.trim())
}

function normalizeBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('ASR Base URL must use HTTP or HTTPS')
  return url.toString().replace(/\/$/, '')
}

export async function loadAsrSettings(): Promise<AsrSettings> {
  const stored = await browser.storage.local.get('asrSettings') as { asrSettings?: AsrSettings }
  if (!stored.asrSettings?.provider) return { ...DEFAULT_ASR_SETTINGS }
  const settings = { ...DEFAULT_ASR_SETTINGS, ...stored.asrSettings }
  if (settings.provider === 'assemblyai' && settings.model === 'universal-3-pro') {
    const migrated = { ...settings, model: 'universal-3-5-pro' }
    await browser.storage.local.set({ asrSettings: migrated })
    return migrated
  }
  return settings
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
