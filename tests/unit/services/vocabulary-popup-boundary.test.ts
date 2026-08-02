import { describe, expect, it, vi } from 'vitest'
import { createVocabularyPopupBoundary } from '@/services/vocabulary-popup-boundary'
const selection = { term: 'record', sentence: 'Record it.' }
const source = { kind: 'web' as const, title: 'Example', url: 'https://example.com' }
describe('vocabulary popup boundary', () => {
  it('centralizes content-script vocabulary messages', async () => {
    const send = vi.fn(async (message) => message.type === 'vocabulary.status' ? true : null)
    const boundary = createVocabularyPopupBoundary(send, selection, source)
    await boundary.isSaved()
    expect(send).toHaveBeenCalledWith({ type: 'vocabulary.status', selection, source })
  })
})
