import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Material, Segment } from '@/domain/types'
import { PracticeFlow } from '@/features/practice/PracticeFlow'

const material: Material = {
  id: 'm1', title: 'Lesson', audioBlob: new Blob(['audio']), durationSeconds: 5, status: 'ready', transcriptionError: null,
  firstRoundStage: 'blind_listen', nextReviewAt: null, reviewStep: 0, createdAt: '', updatedAt: '',
}
const segments: Segment[] = [{ id: 's1', materialId: 'm1', order: 0, startSeconds: 0, endSeconds: 1, text: 'First transcript sentence', isDifficult: false }]

describe('PracticeFlow', () => {
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
})
