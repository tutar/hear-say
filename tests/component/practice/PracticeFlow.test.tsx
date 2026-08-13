import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Material, Segment } from '@/domain/types'
import { PracticeFlow } from '@/features/practice/PracticeFlow'
import type { OralRecognitionListener, OralRecognizer } from '@/services/oral-recognition'

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

  it('starts oral recognition after a difficult sentence finishes without marking it complete', async () => {
    let listener: OralRecognitionListener | undefined
    const recognizer: OralRecognizer = { start: vi.fn(async (next) => { listener = next }), stop: vi.fn() }
    const difficult = { ...segments[0], isDifficult: true }
    const onComplete = vi.fn()
    const { container } = render(<PracticeFlow material={{ ...material, firstRoundStage: 'shadowing' }} segments={[difficult]} onComplete={onComplete} oralRecognizer={recognizer} />)
    await screen.findByText('First transcript sentence')
    const audio = container.querySelector('audio')!
    audio.play = vi.fn(async () => undefined)
    fireEvent.click(screen.getByRole('button', { name: '播放当前难句' }))
    audio.currentTime = difficult.endSeconds
    fireEvent.timeUpdate(audio)
    await vi.waitFor(() => expect(recognizer.start).toHaveBeenCalled())
    act(() => listener?.onFinal('First transcript sentence'))
    expect(screen.getByText('相似度 100%')).toBeInTheDocument()
    expect(screen.getByText('待练习')).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('presents difficult-sentence repetition with the shared practice visual hierarchy', () => {
    const difficult = { ...segments[0], isDifficult: true }
    const { container } = render(<PracticeFlow material={{ ...material, firstRoundStage: 'shadowing' }} segments={[difficult]} onComplete={vi.fn()} />)

    expect(container.querySelector('.difficult-practice > .practice-mode-header')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /难句复读\s*（首轮练习 正在练习 Lesson）/ })).toBeInTheDocument()
    expect(screen.getByText('First transcript sentence')).toHaveClass('difficult-sentence-copy')
    expect(screen.getByRole('button', { name: '跳过本句' })).toHaveClass('secondary-action')
    expect(screen.getByRole('button', { name: '完成本句' })).toHaveClass('primary-action')
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
    expect(screen.getByLabelText('翻译')).toHaveTextContent('当前材料没有可用翻译')
    expect(screen.queryByRole('heading', { name: '翻译' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '重点词汇' })).toBeInTheDocument()
    expect(screen.getByText('First transcript sentence')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '翻译' }))
    expect(screen.queryByLabelText('翻译')).not.toBeInTheDocument()
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

  it('still starts the four-second pause when a bookmark save refreshes the material during playback', async () => {
    let resolveSave!: () => void
    const save = new Promise<void>((resolve) => { resolveSave = resolve })
    const onSegmentsSaved = vi.fn(() => save)
    const view = render(<PracticeFlow material={{ ...material, firstRoundStage: 'intensive_listen' }} segments={segments} onComplete={vi.fn()} onSegmentsSaved={onSegmentsSaved} />)
    let audio = view.container.querySelector('audio')!
    audio.play = vi.fn(async () => undefined)
    fireEvent.click(screen.getByRole('button', { name: '播放当前句' }))
    fireEvent.click(screen.getByRole('button', { name: '收藏为难句' }))
    resolveSave()
    await save
    view.rerender(<PracticeFlow material={{ ...material, audioBlob: new Blob(['audio']), firstRoundStage: 'intensive_listen' }} segments={segments.map((segment) => ({ ...segment, isDifficult: true }))} onComplete={vi.fn()} onSegmentsSaved={onSegmentsSaved} />)
    audio = view.container.querySelector('audio')!
    audio.currentTime = 1
    fireEvent.timeUpdate(audio)
    expect(screen.getByRole('button', { name: '暂停倒计时' })).toHaveTextContent('4')
  })

  it('offers the shared translator after a learner selects text in the intensive transcript', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'transcript' } as Selection)
    render(<PracticeFlow material={{ ...material, firstRoundStage: 'intensive_listen' }} segments={segments} onComplete={vi.fn()} onVocabularyLookup={vi.fn()} onVocabularyAdd={vi.fn()} onVocabularySpeak={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '听不太懂' }))
    fireEvent.mouseUp(screen.getByText('First transcript sentence'))
    expect(screen.getByRole('button', { name: '翻译 transcript' })).toBeInTheDocument()
  })

  it('persists bookmarks during intensive review and rolls back a failed save', async () => {
    const onSegmentsSaved = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('无法保存收藏'))
    render(<PracticeFlow material={{ ...material, firstRoundStage: 'intensive_listen' }} segments={segments} retrospective onComplete={vi.fn()} onSegmentsSaved={onSegmentsSaved} />)
    fireEvent.click(screen.getByRole('button', { name: '收藏为难句' }))
    expect(await screen.findByRole('button', { name: '取消难句收藏' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '取消难句收藏' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('无法保存收藏')
    expect(screen.getByRole('button', { name: '取消难句收藏' })).toBeInTheDocument()
  })

  it('keeps a normal completion action for an empty shadowing review and returns to overview', () => {
    const onExit = vi.fn()
    render(<PracticeFlow material={{ ...material, firstRoundStage: 'shadowing' }} segments={segments} retrospective onExit={onExit} onComplete={vi.fn()} />)
    expect(screen.getByText('本轮没有收藏的难句。')).toBeInTheDocument()
    const complete = screen.getByRole('button', { name: '完成难句跟读' })
    expect(complete).toBeEnabled()
    fireEvent.click(complete)
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('pauses for four seconds after one playback and then starts the next sentence', () => {
    vi.useFakeTimers()
    const nextSegment: Segment = { id: 's2', materialId: 'm1', order: 1, startSeconds: 1, endSeconds: 2, text: 'Second sentence', isDifficult: false }
    const onIntensiveSegmentComplete = vi.fn()
    const onIntensiveSegmentSkip = vi.fn()
    const { container } = render(<PracticeFlow material={{ ...material, firstRoundStage: 'intensive_listen' }} segments={[...segments, nextSegment]} onComplete={vi.fn()} onIntensiveSegmentComplete={onIntensiveSegmentComplete} onIntensiveSegmentSkip={onIntensiveSegmentSkip} />)
    const next = screen.getByRole('button', { name: '下一句' })
    const audio = container.querySelector('audio')!
    audio.play = vi.fn(async () => undefined)
    fireEvent.click(screen.getByRole('button', { name: '播放当前句' }))
    audio.currentTime = 1
    fireEvent.timeUpdate(audio)
    expect(screen.getByRole('button', { name: '暂停倒计时' })).toHaveTextContent('4')
    fireEvent.click(screen.getByRole('button', { name: '暂停倒计时' }))
    act(() => vi.advanceTimersByTime(2_000))
    expect(screen.getByRole('button', { name: '继续倒计时' })).toHaveTextContent('4')
    fireEvent.click(screen.getByRole('button', { name: '继续倒计时' }))
    act(() => vi.advanceTimersByTime(4_000))
    expect(screen.getByRole('button', { name: '上一句' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '下一句' })).toBeDisabled()
    expect(onIntensiveSegmentComplete).toHaveBeenCalledWith('s1')
    expect(audio.play).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '上一句' }))
    expect(onIntensiveSegmentSkip).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('finishes intensive listening after the final countdown and skips empty shadowing', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    const { container } = render(<PracticeFlow material={{ ...material, firstRoundStage: 'intensive_listen' }} segments={segments} onComplete={onComplete} />)
    const audio = container.querySelector('audio')!
    audio.play = vi.fn(async () => undefined)
    fireEvent.click(screen.getByRole('button', { name: '播放当前句' }))
    audio.currentTime = 1
    fireEvent.timeUpdate(audio)
    act(() => vi.advanceTimersByTime(4_000))

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ firstRoundStage: 'retelling' }))
    vi.useRealTimers()
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
