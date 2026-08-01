import { describe, expect, it, vi } from 'vitest'
import { beforeEach } from 'vitest'
import { resetDatabaseForTest } from '@/db/database'
import { VocabularyService, lookupVocabulary } from '@/services/vocabulary-service'
import { WordRepository } from '@/db/word-repository'

describe('VocabularyService.lookup', () => {
  beforeEach(async () => { await resetDatabaseForTest() })
  it('returns a contextual Chinese explanation for a selected English term', async () => {
    const result = await lookupVocabulary(
      { term: 'record', sentence: 'Please record a short message.' },
      { explain: async () => ({ term: 'record', ipa: '/rɪˈkɔːrd/', partOfSpeech: '动词', meaningZh: '录制', contextExplanationZh: '这里表示把声音保存下来。' }) },
    )

    expect(result).toEqual({
      term: 'record',
      normalizedTerm: 'record',
      ipa: '/rɪˈkɔːrd/',
      partOfSpeech: '动词',
      meaningZh: '录制',
      contextExplanationZh: '这里表示把声音保存下来。',
    })
  })

  it('rejects a sentence-sized selection before sending it to the vocabulary provider', async () => {
    const explain = vi.fn()
    await expect(lookupVocabulary(
      { term: 'one two three four five six seven eight nine', sentence: 'A long sentence.' },
      { explain },
    )).rejects.toThrow('请选择一个单词或短语')
    expect(explain).not.toHaveBeenCalled()
  })

  it('reuses a successful lookup for the same term and sentence', async () => {
    const explain = vi.fn(async () => ({ term: 'record', ipa: '/rɪˈkɔːrd/', partOfSpeech: '动词', meaningZh: '录制', contextExplanationZh: '保存声音。' }))
    const service = new VocabularyService(new WordRepository(), { explain })
    const selection = { term: 'record', sentence: 'Please record a message.' }

    expect(await service.lookup(selection)).toMatchObject({ meaningZh: '录制' })
    expect(await service.lookup(selection)).toMatchObject({ meaningZh: '录制' })
    expect(explain).toHaveBeenCalledTimes(1)
  })
})
