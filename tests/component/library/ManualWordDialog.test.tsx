import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManualWordDialog } from '@/features/library/ManualWordDialog'

const lookup = { term: 'encounter', normalizedTerm: 'encounter', ipa: '/ɪnˈkaʊntər/', partOfSpeech: 'verb', meaningZh: '遇到', definitionZh: '意外遇见或遇到', exampleSentenceEn: 'We encountered a delay.', exampleSentenceZh: '我们遇到了延误。', contextExplanationZh: '表示遇到某人或某事。' }

describe('ManualWordDialog', () => {
  afterEach(cleanup)

  it('generates a preview and only saves after confirmation', async () => {
    const onLookup = vi.fn(async () => lookup), onSave = vi.fn(async () => 'saved' as const), onClose = vi.fn()
    render(<ManualWordDialog onClose={onClose} onLookup={onLookup} onSave={onSave} onOpenSettings={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/单词或短语/), { target: { value: 'encounter' } })
    fireEvent.click(screen.getByRole('button', { name: '生成释义' }))
    expect(await screen.findByRole('heading', { name: '确认词卡' })).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '加入生词本' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ term: 'encounter', sentence: '' }, lookup))
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps input and offers settings when lookup is not configured', async () => {
    const onOpenSettings = vi.fn()
    render(<ManualWordDialog onClose={vi.fn()} onLookup={vi.fn(async () => { throw new Error('请先完成词汇解释设置') })} onSave={vi.fn()} onOpenSettings={onOpenSettings} />)
    fireEvent.change(screen.getByLabelText(/单词或短语/), { target: { value: 'encounter' } })
    fireEvent.click(screen.getByRole('button', { name: '生成释义' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('请先完成词汇解释设置')
    expect(screen.getByLabelText(/单词或短语/)).toHaveValue('encounter')
    fireEvent.click(screen.getByRole('button', { name: '前往设置' }))
    expect(onOpenSettings).toHaveBeenCalled()
  })
})
