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
    const speed = screen.getByLabelText('播放速度')
    expect([...speed.querySelectorAll('option')].map((option) => option.textContent)).toEqual(Array.from({ length: 16 }, (_, index) => `${((index + 5) / 10).toFixed(1)}×`))
    fireEvent.change(speed, { target: { value: '0.7' } })
    expect(container.querySelector('audio')).toHaveProperty('playbackRate', 0.7)
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
    expect(screen.getByRole('button', { name: '收藏为难句' }).querySelector('.bookmark-icon')).toBeInTheDocument()
    expect(screen.queryByText('◇')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '收藏为难句' }))
    expect(onSegmentsSaved).toHaveBeenCalledWith([expect.objectContaining({ id: 's1', isDifficult: true })])
    const audio = container.querySelector('audio')!
    fireEvent.play(audio)
    expect(screen.getByRole('button', { name: '暂停当前句' }).querySelector('.pause-mark')).toBeInTheDocument()
    fireEvent.pause(audio)
    expect(screen.getByRole('button', { name: '播放当前句' }).querySelector('.play-mark')).toBeInTheDocument()
  })

  it('offers the shared translator after a learner selects text in the intensive transcript', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'transcript' } as Selection)
    render(<PracticeFlow material={{ ...material, firstRoundStage: 'intensive_listen' }} segments={segments} onComplete={vi.fn()} onVocabularyLookup={vi.fn()} onVocabularyAdd={vi.fn()} onVocabularySpeak={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '听不太懂' }))
    fireEvent.mouseUp(screen.getByText('First transcript sentence'))
    expect(screen.getByRole('button', { name: '翻译 transcript' })).toBeInTheDocument()
  })

  it('enables the next sentence after three complete repetitions', () => {
    const nextSegment: Segment = { id: 's2', materialId: 'm1', order: 1, startSeconds: 1, endSeconds: 2, text: 'Second sentence', isDifficult: false }
    const { container } = render(<PracticeFlow material={{ ...material, firstRoundStage: 'intensive_listen' }} segments={[...segments, nextSegment]} onComplete={vi.fn()} />)
    const next = screen.getByRole('button', { name: '下一句' })
    const audio = container.querySelector('audio')!
    audio.play = vi.fn(async () => undefined)
    expect(next).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '播放当前句' }))
    fireEvent.seeking(audio)
    for (let repetition = 0; repetition < 3; repetition += 1) {
      audio.currentTime = 1
      fireEvent.timeUpdate(audio)
    }
    expect(next).toBeEnabled()
    fireEvent.click(next)
    expect(screen.getByRole('button', { name: '上一句' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '下一句' })).toBeDisabled()
  })

  it('shows learner-authored keyword prompts while retelling', () => {
    render(<PracticeFlow material={{ ...material, firstRoundStage: 'retelling' }} segments={segments} onComplete={vi.fn()} />)
    expect(screen.getByLabelText('复述关键词')).toBeInTheDocument()
    expect(screen.queryByText('First transcript sentence')).not.toBeInTheDocument()
  })

  it('starts a due review with the same full flow as a first round', () => {
    render(<PracticeFlow material={{ ...material, firstRoundStage: 'complete', nextReviewAt: '2026-07-30T00:00:00.000Z' }} segments={segments} onComplete={vi.fn()} onCompleteReview={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Blind listening' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '完成Blind listening' })).toBeInTheDocument()
  })

  it('opens the timeline editor without changing learning flow in subtitle-only mode', () => {
    const onComplete = vi.fn()
    render(<PracticeFlow material={{ ...material, firstRoundStage: 'blind_listen' }} segments={segments} editorOnly onComplete={onComplete} onSegmentsSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit segment 1' }))
    expect(screen.getByLabelText('Segment 1 text')).toHaveValue('First transcript sentence')
    expect(screen.queryByRole('button', { name: /完成/ })).not.toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })
})
