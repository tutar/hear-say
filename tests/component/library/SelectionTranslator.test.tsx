import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SelectionTranslator } from '@/features/library/SelectionTranslator'

describe('SelectionTranslator', () => {
  afterEach(cleanup)
  it('waits for explicit translation consent before lookup and saves only after success', async () => {
    const onLookup = vi.fn(async () => ({ term: 'record', normalizedTerm: 'record', ipa: '/rɪˈkɔːrd/', partOfSpeech: 'verb', meaningZh: '录制', definitionZh: '保存声音。', exampleSentenceEn: 'Please record a message.', exampleSentenceZh: '请录一段留言。', contextExplanationZh: '保存声音。' }))
    const onAdd = vi.fn(async () => undefined)
    render(<SelectionTranslator selection={{ term: 'record', sentence: 'Please record a message.' }} onLookup={onLookup} onAdd={onAdd} onSpeak={vi.fn()} onClose={vi.fn()} />)

    expect(onLookup).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '翻译 record' }))
    await screen.findByText('v.')
    expect(onLookup).toHaveBeenCalledWith({ term: 'record', sentence: 'Please record a message.' })
    fireEvent.click(screen.getByRole('button', { name: '+ 单词本' }))
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

  it('retries a failed wordbook save without looking up the word again', async () => {
    const onLookup = vi.fn(async () => ({ term: 'record', normalizedTerm: 'record', ipa: '/rɪˈkɔːrd/', partOfSpeech: 'verb', meaningZh: '录制', definitionZh: '保存声音。', exampleSentenceEn: 'She recorded the concert.', exampleSentenceZh: '她录下了这场音乐会。', contextExplanationZh: '保存声音。' }))
    const onAdd = vi.fn().mockRejectedValueOnce(new Error('保存失败')).mockResolvedValueOnce(undefined)
    render(<SelectionTranslator selection={{ term: 'record', sentence: 'Please record a message.' }} onLookup={onLookup} onAdd={onAdd} onSpeak={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '翻译 record' }))
    await screen.findByText('v.')
    fireEvent.click(screen.getByRole('button', { name: '+ 单词本' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: '刷新重试' }))
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(2))
    expect(onLookup).toHaveBeenCalledTimes(1)
  })

  it('continues dragging when the pointer leaves the title bar', async () => {
    const lookup = { term: 'record', normalizedTerm: 'record', ipa: '/rɪˈkɔːrd/', partOfSpeech: 'verb', meaningZh: '录制', definitionZh: '保存声音。', exampleSentenceEn: 'She recorded the concert.', exampleSentenceZh: '她录下了这场音乐会。', contextExplanationZh: '保存声音。' }
    render(<SelectionTranslator selection={{ term: 'record', sentence: 'Please record a message.' }} onLookup={async () => lookup} onAdd={vi.fn()} onSpeak={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '翻译 record' }))
    await screen.findByText('v.')
    const handle = document.querySelector('.selection-translation-drag-handle') as HTMLElement
    const card = document.querySelector('.selection-translation') as HTMLElement
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ width: 300, height: 200, top: 0, left: 0, right: 300, bottom: 200, x: 0, y: 0, toJSON: () => ({}) })
    expect(handle).toHaveClass('selection-translation-drag-handle')
    const down = new MouseEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, bubbles: true })
    Object.defineProperty(down, 'pointerId', { value: 1 })
    handle.dispatchEvent(down)
    await waitFor(() => expect(card).toHaveClass('is-dragging'))
    const move = new MouseEvent('pointermove', { clientX: 160, clientY: 140 })
    Object.defineProperty(move, 'pointerId', { value: 1 })
    window.dispatchEvent(move)
    await waitFor(() => expect(card.style.transform).toBe('translate(60px, 40px)'))
    const up = new MouseEvent('pointerup', { clientX: 160, clientY: 140 })
    Object.defineProperty(up, 'pointerId', { value: 1 })
    window.dispatchEvent(up)
    await waitFor(() => expect(card).not.toHaveClass('is-dragging'))
  })

  it('highlights the complete inflected form in the generated example', async () => {
    const lookup = { term: 'encounter', normalizedTerm: 'encounter', ipa: '/ɪnˈkaʊntər/', partOfSpeech: 'verb', meaningZh: '遇到', definitionZh: '遇见某人或某事。', exampleSentenceEn: 'She encountered an unexpected delay.', exampleSentenceZh: '她遇到了意外的延误。', contextExplanationZh: '这里表示遇到。' }
    render(<SelectionTranslator selection={{ term: 'encounter', sentence: 'I encounter new words.' }} onLookup={async () => lookup} onAdd={vi.fn()} onSpeak={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '翻译 encounter' }))
    await screen.findByText('v.')
    expect(screen.getByText('encountered')).toHaveAttribute('data-testid', 'highlighted-word')
  })
})
