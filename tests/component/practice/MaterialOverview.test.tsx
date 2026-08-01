import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MaterialWithSegments } from '@/db/material-repository'
import { MaterialOverview } from '@/features/practice/MaterialOverview'

const material: MaterialWithSegments = {
  id: 'm1', title: 'The Art of Small Talk', audioBlob: new Blob(['audio']), durationSeconds: 62,
  status: 'ready', transcriptionError: null, firstRoundStage: 'retelling', nextReviewAt: null,
  reviewStep: 0, isFavorite: false, tags: [], createdAt: '', updatedAt: '',
  segments: [
    { id: 's1', materialId: 'm1', order: 0, startSeconds: 0, endSeconds: 1, text: 'Small talk matters', isDifficult: true },
    { id: 's2', materialId: 'm1', order: 1, startSeconds: 1, endSeconds: 2, text: 'Keep going', isDifficult: false },
  ],
}

describe('MaterialOverview', () => {
  it('summarizes progress and only continues when the learner asks', () => {
    const onContinue = vi.fn()
    const onFreeListen = vi.fn()
    render(<MaterialOverview material={material} onBack={vi.fn()} onContinue={onContinue} onFreeListen={onFreeListen} />)
    expect(screen.getByRole('heading', { name: 'The Art of Small Talk' })).toBeInTheDocument()
    expect(screen.getByText('3/4 完成')).toBeInTheDocument()
    expect(screen.getByText('1 个难句')).toBeInTheDocument()
    expect(onContinue).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '继续学习' }))
    expect(onContinue).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '随心听' }))
    expect(onFreeListen).toHaveBeenCalledOnce()
  })
})
