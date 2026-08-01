import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabaseForTest } from '@/db/database'
import { WordRepository } from '@/db/word-repository'

describe('WordRepository', () => {
  beforeEach(async () => { await resetDatabaseForTest() })

  it('makes a learner-saved contextual word retrievable from the wordbook', async () => {
    const repository = new WordRepository()
    const saved = await repository.addContext({
      term: 'record', normalizedTerm: 'record', ipa: '/rɪˈkɔːrd/', partOfSpeech: '动词', meaningZh: '录制',
      contextExplanationZh: '这里表示保存声音。', sentence: 'Please record a message.',
      source: { kind: 'web', title: 'Speaking tips', url: 'https://example.com/tips' },
    })

    expect(await repository.listEntries()).toEqual([expect.objectContaining({ id: saved.id, term: 'record', contexts: [expect.objectContaining({ partOfSpeech: '动词', meaningZh: '录制' })] })])
    expect(await repository.getEntry(saved.id)).toMatchObject({ term: 'record' })
  })

  it('merges new contexts into one word entry and ignores an identical source sentence', async () => {
    const repository = new WordRepository()
    const base = { term: 'record', normalizedTerm: 'record', ipa: '/ˈrekərd/', contextExplanationZh: '语境解释', sentence: 'Keep a record of it.', source: { kind: 'web' as const, title: 'Notes', url: 'https://example.com/notes' } }
    await repository.addContext({ ...base, partOfSpeech: '名词', meaningZh: '记录' })
    await repository.addContext({ ...base, partOfSpeech: '名词', meaningZh: '记录' })
    await repository.addContext({ ...base, ipa: '/rɪˈkɔːrd/', partOfSpeech: '动词', meaningZh: '录制', sentence: 'Record the meeting.' })

    const entries = await repository.listEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].contexts).toHaveLength(2)
    expect(entries[0].contexts.map((context) => context.partOfSpeech)).toEqual(['名词', '动词'])
  })
})
