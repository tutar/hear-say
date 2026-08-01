import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, unknown>()
const local = {
  get: vi.fn(async (key: string) => ({ [key]: storage.get(key) })),
  set: vi.fn(async (value: Record<string, unknown>) => Object.entries(value).forEach(([key, item]) => storage.set(key, item))),
}

vi.stubGlobal('browser', { storage: { local } })

const { DEFAULT_ASR_SETTINGS, DEFAULT_VOCABULARY_SETTINGS, loadAsrSettings, loadVocabularySettings, saveAsrSettings, saveVocabularySettings } = await import('@/services/settings')

describe('ASR settings', () => {
  beforeEach(() => { storage.clear(); vi.clearAllMocks() })

  it('uses the local FunASR defaults before the learner saves settings', async () => {
    expect(await loadAsrSettings()).toEqual(DEFAULT_ASR_SETTINGS)
  })

  it('normalizes a trailing base URL slash before saving', async () => {
    await saveAsrSettings({ baseUrl: 'https://asr.example/v1/', apiKey: 'secret', model: 'custom' })
    expect(await loadAsrSettings()).toEqual({ baseUrl: 'https://asr.example/v1', apiKey: 'secret', model: 'custom' })
  })

  it('stores vocabulary explanation settings independently from transcription settings', async () => {
    expect(await loadVocabularySettings()).toEqual({ baseUrl: 'https://api.deepseek.com', apiKey: '', model: 'deepseek-v4-flash' })
    await saveVocabularySettings({ ...DEFAULT_VOCABULARY_SETTINGS, apiKey: 'vocabulary-secret' })

    expect(await loadVocabularySettings()).toEqual({ baseUrl: 'https://api.deepseek.com', apiKey: 'vocabulary-secret', model: 'deepseek-v4-flash' })
    expect(await loadAsrSettings()).toEqual(DEFAULT_ASR_SETTINGS)
  })
})
