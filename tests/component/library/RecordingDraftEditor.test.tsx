import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecordingDraftEditor } from '@/features/library/RecordingDraftEditor'

const draft = { id: 'draft-1', sessionId: 'draft-1', state: 'completed' as const, source: { title: 'Friends clip', url: 'https://youtube.com/watch?v=1', site: 'youtube.com', recordedAt: '2026-08-01T10:00:00.000Z' }, durationSeconds: 83, sizeBytes: 2_656_000, excludedIntervals: [], createdAt: '2026-08-01T10:02:00.000Z', updatedAt: '2026-08-01T10:02:00.000Z' }

describe('RecordingDraftEditor', () => {
  afterEach(cleanup)
  it('lets the learner name and import one retained recording', () => {
    const onImport = vi.fn()
    render(<RecordingDraftEditor draft={draft} audioUrl="blob:draft" onBack={vi.fn()} onImport={onImport} onExclusionsChange={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Friends clip' })).toBeInTheDocument()
    expect(screen.getByLabelText('预览录音')).toHaveAttribute('src', 'blob:draft')
    fireEvent.change(screen.getByLabelText('材料名称'), { target: { value: 'Friends 第一季片段' } })
    fireEvent.click(screen.getByRole('button', { name: '导入资料库' }))
    expect(onImport).toHaveBeenCalledWith('Friends 第一季片段')
  })

  it('lets the learner add and undo non-destructive excluded intervals', () => {
    const onExclusionsChange = vi.fn()
    const { rerender } = render(<RecordingDraftEditor draft={draft} audioUrl="blob:draft" onBack={vi.fn()} onImport={vi.fn()} onExclusionsChange={onExclusionsChange} />)

    fireEvent.change(screen.getByLabelText('排除开始时间'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('排除结束时间'), { target: { value: '18.5' } })
    fireEvent.click(screen.getByRole('button', { name: '排除这个片段' }))
    expect(onExclusionsChange).toHaveBeenCalledWith([{ startSample: 160_000, endSample: 296_000 }])

    rerender(<RecordingDraftEditor draft={{ ...draft, excludedIntervals: [{ startSample: 160_000, endSample: 296_000 }] }} audioUrl="blob:draft" onBack={vi.fn()} onImport={vi.fn()} onExclusionsChange={onExclusionsChange} />)
    expect(screen.getByText('00:10.0–00:18.5')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '撤销排除 00:10.0–00:18.5' }))
    expect(onExclusionsChange).toHaveBeenLastCalledWith([])
  })
})
