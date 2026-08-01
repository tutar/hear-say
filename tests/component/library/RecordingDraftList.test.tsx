import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecordingDraftList } from '@/features/library/RecordingDraftList'

describe('RecordingDraftList', () => {
  afterEach(cleanup)

  it('lets the learner continue or delete a retained recording draft', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<RecordingDraftList drafts={[{
      id: 'draft-1', sessionId: 'draft-1', state: 'interrupted',
      source: { title: 'Friends · The first date', url: 'https://youtube.com/watch?v=1', site: 'youtube.com', recordedAt: '2026-08-01T10:00:00.000Z' },
      durationSeconds: 83, sizeBytes: 2_656_000, excludedIntervals: [],
      createdAt: '2026-08-01T10:02:00.000Z', updatedAt: '2026-08-01T10:02:00.000Z',
    }]} onEdit={onEdit} onDelete={onDelete} />)

    expect(screen.getByRole('heading', { name: '录制草稿' })).toBeInTheDocument()
    expect(screen.getByText('Friends · The first date')).toBeInTheDocument()
    expect(screen.getByText('中断后已保留')).toBeInTheDocument()
    expect(screen.getByText('01:23')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '编辑并导入 Friends · The first date' }))
    fireEvent.click(screen.getByRole('button', { name: '删除 Friends · The first date' }))
    expect(onEdit).toHaveBeenCalledWith('draft-1')
    expect(onDelete).toHaveBeenCalledWith('draft-1')
  })
})
