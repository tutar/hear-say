import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import type { MaterialWithSegments } from '@/db/material-repository'
import { ReviewQueue } from '@/features/practice/ReviewQueue'

const due = (id: string, difficult: boolean): MaterialWithSegments => ({
  id, title: id, audioBlob: new Blob(['audio']), durationSeconds: 1, status: 'ready', transcriptionError: null,
  firstRoundStage: 'complete', nextReviewAt: '2026-07-30T00:00:00.000Z', reviewStep: 0, createdAt: '', updatedAt: '',
  segments: [{ id: `${id}-s`, materialId: id, order: 0, startSeconds: 0, endSeconds: 1, text: id, isDifficult: difficult }],
})

describe('ReviewQueue', () => {
  afterEach(cleanup)

  it('puts due material with difficult sentences first and opens it for review', () => {
    const onOpenMaterial = vi.fn()
    render(<ReviewQueue materials={[due('easy', false), due('hard', true)]} onOpenMaterial={onOpenMaterial} />)
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('hard')
    fireEvent.click(screen.getByRole('button', { name: '复习 hard' }))
    expect(onOpenMaterial).toHaveBeenCalledWith('hard')
  })
})
