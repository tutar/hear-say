import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FREE_LISTENING_PREFERENCES } from '@/domain/free-listening'
import { FreeListening } from '@/features/practice/FreeListening'

const material = { id: 'm1', title: 'Small Talk', audioBlob: new Blob(['audio']), durationSeconds: 20, status: 'ready' as const, transcriptionError: null, firstRoundStage: 'blind_listen' as const, nextReviewAt: null, reviewStep: 0, isFavorite: false, tags: [], createdAt: '', updatedAt: '' }
const segments = [
  { id: 's1', materialId: 'm1', order: 0, startSeconds: 0, endSeconds: 10, text: 'How are you doing today?', isDifficult: false },
  { id: 's2', materialId: 'm1', order: 1, startSeconds: 10, endSeconds: 20, text: 'I am doing well.', isDifficult: false },
]
afterEach(cleanup)

describe('FreeListening', () => {
  it('starts in single-sentence mode and restores help controls after showing text again', () => {
    render(<FreeListening material={material} segments={segments} preferences={DEFAULT_FREE_LISTENING_PREFERENCES} progress={undefined} onPreferencesChange={vi.fn()} onProgressChange={vi.fn()} />)
    expect(screen.getByText('How are you doing today?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '解析' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '隐藏字幕' }))
    expect(screen.queryByText('How are you doing today?')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '解析' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '偷看字幕' }))
    expect(screen.getByRole('button', { name: '解析' })).toBeInTheDocument()
  })

  it('switches to a sentence list and selects a row', () => {
    render(<FreeListening material={material} segments={segments} preferences={DEFAULT_FREE_LISTENING_PREFERENCES} progress={undefined} onPreferencesChange={vi.fn()} onProgressChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '每句列表' }))
    fireEvent.click(screen.getByRole('button', { name: /I am doing well/ }))
    expect(screen.getByRole('button', { name: /I am doing well/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('region', { name: '句子详情' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭句子详情' }))
    expect(screen.queryByRole('region', { name: '句子详情' })).not.toBeInTheDocument()
  })

  it('labels the same template by its entry mode', () => {
    render(<FreeListening mode="blind" material={material} segments={segments} preferences={DEFAULT_FREE_LISTENING_PREFERENCES} progress={undefined} onPreferencesChange={vi.fn()} onProgressChange={vi.fn()} />)
    expect(screen.getByText('全文盲听')).toBeInTheDocument()
    expect(screen.getByText('Blind listening')).toBeInTheDocument()
  })
})
