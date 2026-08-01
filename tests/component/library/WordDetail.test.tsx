import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WordDetail } from '@/features/library/WordDetail'
import type { WordEntry } from '@/domain/types'

const entry: WordEntry = { id: 'w1', term: 'record', normalizedTerm: 'record', createdAt: '', lastSeenAt: '', contexts: [
  { id: 'c1', ipa: '/ˈrekərd/', partOfSpeech: '名词', meaningZh: '记录', contextExplanationZh: '保留下来的信息。', sentence: 'Keep a record.', source: { kind: 'web', title: 'Notes', url: 'https://example.com/notes' }, createdAt: '' },
  { id: 'c2', ipa: '/rɪˈkɔːrd/', partOfSpeech: '动词', meaningZh: '录制', contextExplanationZh: '保存声音。', sentence: 'Record a message.', source: { kind: 'material', title: 'output1.wav', materialId: 'm1', segmentId: 's1' }, createdAt: '' },
] }

describe('WordDetail', () => {
  afterEach(cleanup)
  it('shows every contextual meaning and opens its original source', () => {
    const onOpenSource = vi.fn()
    render(<WordDetail entry={entry} activeTerm={null} onBack={vi.fn()} onSpeak={vi.fn()} onOpenSource={onOpenSource} />)
    expect(screen.getByRole('heading', { name: 'record' })).toBeInTheDocument()
    expect(screen.getByText('名词 · 记录')).toBeInTheDocument()
    expect(screen.getByText('动词 · 录制')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '打开来源 output1.wav' }))
    expect(onOpenSource).toHaveBeenCalledWith(entry.contexts[1].source)
  })
})
