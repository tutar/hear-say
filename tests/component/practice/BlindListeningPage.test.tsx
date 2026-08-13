import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FREE_LISTENING_PREFERENCES } from '@/domain/free-listening'
import { BlindListeningPage } from '@/features/practice/BlindListeningPage'

const material = { id: 'm1', title: 'Small Talk', audioBlob: new Blob(['audio']), durationSeconds: 20, status: 'ready' as const, transcriptionError: null, firstRoundStage: 'blind_listen' as const, nextReviewAt: null, reviewStep: 0, isFavorite: false, tags: [], createdAt: '', updatedAt: '' }
const segments = [{ id: 's1', materialId: 'm1', order: 0, startSeconds: 0, endSeconds: 10, text: 'How are you doing today?', isDifficult: false }]
afterEach(cleanup)
describe('BlindListeningPage', () => {
  it('always opens as a numbered sentence list with subtitles hidden', () => {
    render(<BlindListeningPage material={material} segments={segments} preferences={{ ...DEFAULT_FREE_LISTENING_PREFERENCES, viewMode: 'single', textVisible: true }} onPreferencesChange={vi.fn()} onProgressChange={vi.fn()} />)
    expect(screen.queryByText('How are you doing today?')).not.toBeInTheDocument()
    expect(screen.getByText('01')).toBeInTheDocument()
  })

  it('completes blind listening and advances the material to intensive listening', () => {
    const onComplete = vi.fn()
    render(<BlindListeningPage material={material} segments={segments} preferences={DEFAULT_FREE_LISTENING_PREFERENCES} onPreferencesChange={vi.fn()} onProgressChange={vi.fn()} onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: '完成全文盲听' }))

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1', firstRoundStage: 'intensive_listen' }))
  })

  it('marks blind listening complete when the audio actually ends', () => {
    const onComplete = vi.fn()
    const { container } = render(<BlindListeningPage material={material} segments={segments} preferences={{ ...DEFAULT_FREE_LISTENING_PREFERENCES, loopMode: 'full' }} onPreferencesChange={vi.fn()} onProgressChange={vi.fn()} onComplete={onComplete} />)

    fireEvent.ended(container.querySelector('audio')!)

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ firstRoundStage: 'intensive_listen' }))
  })
})
