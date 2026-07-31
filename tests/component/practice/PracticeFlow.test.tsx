import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Material, Segment } from '@/domain/types'
import { PracticeFlow } from '@/features/practice/PracticeFlow'

const material: Material = {
  id: 'm1', title: 'Lesson', audioBlob: new Blob(['audio']), durationSeconds: 5, status: 'ready', transcriptionError: null,
  firstRoundStage: 'blind_listen', nextReviewAt: null, reviewStep: 0, isFavorite: false, tags: [], createdAt: '', updatedAt: '',
}
const segments: Segment[] = [{ id: 's1', materialId: 'm1', order: 0, startSeconds: 0, endSeconds: 1, text: 'First transcript sentence', isDifficult: false }]

describe('PracticeFlow', () => {
  afterEach(cleanup)
  it('hides the transcript during blind listening', () => {
    render(<PracticeFlow material={material} segments={segments} onComplete={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Blind listening' })).toBeInTheDocument()
    expect(screen.queryByText('First transcript sentence')).not.toBeInTheDocument()
  })

  it('applies the learner-selected playback speed to the audio element', () => {
    const { container } = render(<PracticeFlow material={{ ...material, firstRoundStage: 'shadowing' }} segments={segments} onComplete={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('播放速度'), { target: { value: '0.75' } })
    expect(container.querySelector('audio')).toHaveProperty('playbackRate', 0.75)
  })

  it('keeps help separate from the difficult-sentence bookmark', () => {
    const onSegmentsSaved = vi.fn()
    const { container } = render(<PracticeFlow material={{ ...material, firstRoundStage: 'intensive_listen' }} segments={segments} onComplete={vi.fn()} onSegmentsSaved={onSegmentsSaved} />)
    expect(screen.queryByText('First transcript sentence')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '听不太懂' }))
    expect(screen.getByText('First transcript sentence')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '难句解读' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '重点词汇' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '听力提示' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '语法' })).toBeInTheDocument()
    expect(screen.getByText('transcript')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '翻译' }))
    expect(screen.getByRole('region', { name: '翻译' })).toHaveTextContent('当前材料没有可用翻译')
    expect(screen.getByRole('heading', { name: '重点词汇' })).toBeInTheDocument()
    expect(screen.getByText('First transcript sentence')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '翻译' }))
    expect(screen.queryByRole('region', { name: '翻译' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '重点词汇' })).toBeInTheDocument()
    expect(screen.getByText('First transcript sentence')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '意群' }))
    expect(screen.getAllByText('First transcript sentence')).toHaveLength(1)
    expect(screen.queryByText('按标点和语义停顿分块朗读，再连成完整句子。')).not.toBeInTheDocument()
    expect(onSegmentsSaved).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '收藏为难句' }))
    expect(onSegmentsSaved).toHaveBeenCalledWith([expect.objectContaining({ id: 's1', isDifficult: true })])
    const audio = container.querySelector('audio')!
    fireEvent.play(audio)
    expect(screen.getByRole('button', { name: '暂停当前句' })).toHaveTextContent('Ⅱ')
    fireEvent.pause(audio)
    expect(screen.getByRole('button', { name: '播放当前句' })).toHaveTextContent('▶')
  })

  it('shows learner-authored keyword prompts while retelling', () => {
    render(<PracticeFlow material={{ ...material, firstRoundStage: 'retelling' }} segments={segments} onComplete={vi.fn()} />)
    expect(screen.getByLabelText('复述关键词')).toBeInTheDocument()
    expect(screen.queryByText('First transcript sentence')).not.toBeInTheDocument()
  })

  it('allows a due review to be completed explicitly', () => {
    const onCompleteReview = vi.fn()
    render(<PracticeFlow material={{ ...material, firstRoundStage: 'complete', nextReviewAt: '2026-07-30T00:00:00.000Z' }} segments={segments} onComplete={vi.fn()} onCompleteReview={onCompleteReview} />)
    fireEvent.click(screen.getByRole('button', { name: '完成本次复习' }))
    expect(onCompleteReview).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }))
  })

  it('opens the timeline editor without changing learning flow in subtitle-only mode', () => {
    const onComplete = vi.fn()
    render(<PracticeFlow material={{ ...material, firstRoundStage: 'blind_listen' }} segments={segments} editorOnly onComplete={onComplete} onSegmentsSaved={vi.fn()} />)
    expect(screen.getByLabelText('Segment 1 text')).toHaveValue('First transcript sentence')
    expect(screen.queryByRole('button', { name: /完成/ })).not.toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })
})
