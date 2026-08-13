import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, unknown>()
const local = {
  get: vi.fn(async (key: string) => ({ [key]: storage.get(key) })),
  set: vi.fn(async (value: Record<string, unknown>) => Object.entries(value).forEach(([key, item]) => storage.set(key, item))),
}

vi.stubGlobal('browser', { storage: { local } })

const { DEFAULT_ASR_SETTINGS, DEFAULT_VOCABULARY_SETTINGS, isAsrConfigured, isVocabularyConfigured, loadAsrSettings, loadVocabularySettings, saveAsrSettings, saveVocabularySettings } = await import('@/services/settings')

describe('ASR settings', () => {
  beforeEach(() => { storage.clear(); vi.clearAllMocks() })

  it('uses AssemblyAI with English and Universal-3.5 Pro before the learner saves settings', async () => {
    expect(await loadAsrSettings()).toEqual({
      provider: 'assemblyai',
      baseUrl: 'https://api.assemblyai.com/v2',
      apiKey: '',
      model: 'universal-3-5-pro',
      language: 'en',
    })
  })

  it('migrates the deprecated AssemblyAI Universal-3 Pro model ID', async () => {
    storage.set('asrSettings', { provider: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', apiKey: 'key', model: 'universal-3-pro', language: 'en' })

    expect(await loadAsrSettings()).toEqual({ provider: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', apiKey: 'key', model: 'universal-3-5-pro', language: 'en' })
  })

  it('replaces the legacy provider-less transcription shape with current defaults', async () => {
    storage.set('asrSettings', { baseUrl: 'http://localhost:8021/v1', apiKey: '', model: 'sensevoice', language: 'en' })
    expect(await loadAsrSettings()).toEqual(DEFAULT_ASR_SETTINGS)
  })

  it('normalizes a trailing base URL slash before saving', async () => {
    await saveAsrSettings({ provider: 'openai-compatible', baseUrl: 'https://asr.example/v1/', apiKey: 'secret', model: 'custom', language: 'auto' })
    expect(await loadAsrSettings()).toEqual({ provider: 'openai-compatible', baseUrl: 'https://asr.example/v1', apiKey: 'secret', model: 'custom', language: 'auto' })
  })

  it('requires only an API key for AssemblyAI and endpoint plus model for a custom provider', () => {
    expect(isAsrConfigured({ ...DEFAULT_ASR_SETTINGS, apiKey: '' })).toBe(false)
    expect(isAsrConfigured({ ...DEFAULT_ASR_SETTINGS, apiKey: 'assembly-key' })).toBe(true)
    expect(isAsrConfigured({ provider: 'openai-compatible', baseUrl: '', model: 'whisper', apiKey: '', language: 'en' })).toBe(false)
    expect(isAsrConfigured({ provider: 'openai-compatible', baseUrl: 'http://localhost:8000/v1', model: '', apiKey: '', language: 'en' })).toBe(false)
    expect(isAsrConfigured({ provider: 'openai-compatible', baseUrl: 'http://localhost:8000/v1', model: 'whisper', apiKey: '', language: 'en' })).toBe(true)
  })

  it('requires every vocabulary explanation field', () => {
    expect(isVocabularyConfigured({ baseUrl: 'https://api.example', model: 'chat', apiKey: '' })).toBe(false)
    expect(isVocabularyConfigured({ baseUrl: 'https://api.example', model: 'chat', apiKey: 'key' })).toBe(true)
  })

  it('stores vocabulary explanation settings independently from transcription settings', async () => {
    expect(await loadVocabularySettings()).toEqual({ baseUrl: 'https://api.deepseek.com', apiKey: '', model: 'deepseek-v4-flash' })
    await saveVocabularySettings({ ...DEFAULT_VOCABULARY_SETTINGS, apiKey: 'vocabulary-secret' })

    expect(await loadVocabularySettings()).toEqual({ baseUrl: 'https://api.deepseek.com', apiKey: 'vocabulary-secret', model: 'deepseek-v4-flash' })
    expect(await loadAsrSettings()).toEqual(DEFAULT_ASR_SETTINGS)
  })
})
