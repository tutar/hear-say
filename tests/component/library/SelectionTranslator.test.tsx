import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SelectionTranslator } from '@/features/library/SelectionTranslator'

describe('SelectionTranslator', () => {
  afterEach(cleanup)
  it('waits for explicit translation consent before lookup and saves only after success', async () => {
    const onLookup = vi.fn(async () => ({ term: 'record', normalizedTerm: 'record', ipa: '/rɪˈkɔːrd/', partOfSpeech: '动词', meaningZh: '录制', contextExplanationZh: '保存声音。' }))
    const onAdd = vi.fn(async () => undefined)
    render(<SelectionTranslator selection={{ term: 'record', sentence: 'Please record a message.' }} onLookup={onLookup} onAdd={onAdd} onSpeak={vi.fn()} onClose={vi.fn()} />)

    expect(onLookup).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '翻译 record' }))
    await screen.findByText('动词 · 录制')
    expect(onLookup).toHaveBeenCalledWith({ term: 'record', sentence: 'Please record a message.' })
    fireEvent.click(screen.getByRole('button', { name: '加入生词本' }))
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ normalizedTerm: 'record' })))
  })

  it('keeps the selection and offers AI service settings when lookup is unavailable', async () => {
    const onOpenSettings = vi.fn()
    render(<SelectionTranslator selection={{ term: 'record', sentence: 'Record it.' }} onLookup={async () => { throw new Error('请先配置词汇解释服务') }} onAdd={vi.fn()} onSpeak={vi.fn()} onClose={vi.fn()} onOpenSettings={onOpenSettings} />)
    fireEvent.click(screen.getByRole('button', { name: '翻译 record' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: '前往 AI 服务设置' }))
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })
})
