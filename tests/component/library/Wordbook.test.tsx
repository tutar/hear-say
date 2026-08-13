import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Wordbook } from '@/features/library/Wordbook'
import type { WordEntry } from '@/domain/types'

const entry: WordEntry = {
  id: 'w1', term: 'record', normalizedTerm: 'record', createdAt: '', lastSeenAt: '',
  contexts: [{ id: 'c1', ipa: '/rɪˈkɔːrd/', partOfSpeech: '动词', meaningZh: '录制', contextExplanationZh: '保存声音。', sentence: 'Record a message.', source: { kind: 'material', title: 'output1.wav', materialId: 'm1', segmentId: 's1' }, createdAt: '' }],
}

describe('Wordbook', () => {
  afterEach(cleanup)

  it('shows contextual meaning, speaks from the audio control, and opens details from the row', () => {
    const onSpeak = vi.fn(), onOpen = vi.fn()
    render(<Wordbook entries={[entry]} activeTerm={null} onSpeak={onSpeak} onOpen={onOpen} onLookup={vi.fn()} onAdd={vi.fn()} onOpenSettings={vi.fn()} />)

    expect(screen.getByText('动词 · 录制')).toBeInTheDocument()
    expect(screen.queryByText(/来自《output1\.wav》/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '朗读 record' }))
    expect(onSpeak).toHaveBeenCalledWith('record')
    fireEvent.click(screen.getByRole('button', { name: '查看 record' }))
    expect(onOpen).toHaveBeenCalledWith('w1')
  })

  it('opens manual vocabulary entry from the circular add control', () => {
    render(<Wordbook entries={[]} activeTerm={null} onSpeak={vi.fn()} onOpen={vi.fn()} onLookup={vi.fn()} onAdd={vi.fn()} onOpenSettings={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '添加生词' }))
    expect(screen.getByRole('dialog', { name: '添加生词' })).toBeInTheDocument()
    expect(screen.getByLabelText(/单词或短语/)).toHaveFocus()
  })
})
