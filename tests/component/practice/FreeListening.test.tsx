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
    expect(screen.getByRole('region', { name: '句子详情' })).toHaveClass('sentence-support-panel')
    fireEvent.click(screen.getByRole('button', { name: '关闭句子详情' }))
    expect(screen.queryByRole('region', { name: '句子详情' })).not.toBeInTheDocument()
  })

  it('labels the same template by its entry mode', () => {
    render(<FreeListening mode="blind" material={material} segments={segments} preferences={DEFAULT_FREE_LISTENING_PREFERENCES} progress={undefined} onPreferencesChange={vi.fn()} onProgressChange={vi.fn()} />)
    expect(screen.getByText('全文盲听')).toBeInTheDocument()
    expect(screen.getByText('Blind listening')).toBeInTheDocument()
  })

  it('does not scroll past the opening rows when restoring progress at sentence five', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    const longSegments = Array.from({ length: 6 }, (_, index) => ({
      id: `s${index + 1}`, materialId: 'm1', order: index, startSeconds: index * 3, endSeconds: (index + 1) * 3,
      text: `Sentence ${index + 1}.`, isDifficult: false,
    }))

    render(<FreeListening mode="blind" material={material} segments={longSegments} preferences={{ ...DEFAULT_FREE_LISTENING_PREFERENCES, viewMode: 'list', textVisible: false }} progress={{ materialId: 'm1', segmentIndex: 4, positionSeconds: 12, updatedAt: '' }} onPreferencesChange={vi.fn()} onProgressChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '偷看字幕' }))

    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('04')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '播放内容' })).toHaveClass('is-list')
    expect(scrollIntoView).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '下一句' }))
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('keeps playing the audio tail after the final sentence timestamp ends', () => {
    const trailingMaterial = { ...material, durationSeconds: 35 }
    const trailingSegments = [
      { ...segments[0], startSeconds: 0, endSeconds: 20 },
      { ...segments[1], startSeconds: 20, endSeconds: 31 },
    ]
    const { container } = render(<FreeListening mode="blind" material={trailingMaterial} segments={trailingSegments} preferences={{ ...DEFAULT_FREE_LISTENING_PREFERENCES, viewMode: 'list' }} progress={{ materialId: 'm1', segmentIndex: 1, positionSeconds: 30, updatedAt: '' }} onPreferencesChange={vi.fn()} onProgressChange={vi.fn()} />)
    const audio = container.querySelector('audio')!
    const pause = vi.spyOn(audio, 'pause')

    audio.currentTime = 31
    fireEvent.timeUpdate(audio)
    audio.currentTime = 34
    fireEvent.timeUpdate(audio)

    expect(pause).not.toHaveBeenCalled()
    expect(screen.getByRole('slider', { name: '播放进度' })).toHaveValue('34')
  })

  it('restarts full-article looping only when the audio actually ends', () => {
    const trailingMaterial = { ...material, durationSeconds: 35 }
    const trailingSegments = [{ ...segments[0], endSeconds: 31 }]
    const { container } = render(<FreeListening material={trailingMaterial} segments={trailingSegments} preferences={{ ...DEFAULT_FREE_LISTENING_PREFERENCES, loopMode: 'full' }} progress={{ materialId: 'm1', segmentIndex: 0, positionSeconds: 30, updatedAt: '' }} onPreferencesChange={vi.fn()} onProgressChange={vi.fn()} />)
    const audio = container.querySelector('audio')!
    const play = vi.spyOn(audio, 'play').mockResolvedValue()

    audio.currentTime = 31
    fireEvent.timeUpdate(audio)
    expect(play).not.toHaveBeenCalled()

    audio.currentTime = 35
    fireEvent.ended(audio)
    expect(audio.currentTime).toBe(0)
    expect(play).toHaveBeenCalledOnce()
  })
})
