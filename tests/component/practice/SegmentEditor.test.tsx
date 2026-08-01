import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Segment } from '@/domain/types'
import { SegmentEditor } from '@/features/practice/SegmentEditor'

const first: Segment = { id: 's1', materialId: 'm1', order: 0, startSeconds: 0, endSeconds: 2, text: 'First.', isDifficult: false }
const second: Segment = { id: 's2', materialId: 'm1', order: 1, startSeconds: 2, endSeconds: 4, text: 'Second.', isDifficult: false }

describe('SegmentEditor', () => {
  afterEach(cleanup)

  it('saves edited text through its caller', () => {
    const onSegmentsSaved = vi.fn()
    render(<SegmentEditor durationSeconds={4} segments={[first, second]} onSegmentsSaved={onSegmentsSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit segment 1' }))
    fireEvent.change(screen.getByLabelText('Segment 1 text'), { target: { value: 'Revised text' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save segment 1' }))
    expect(onSegmentsSaved).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ text: 'Revised text' })]))
  })

  it('merges a segment with its next neighbor', () => {
    const onSegmentsSaved = vi.fn()
    render(<SegmentEditor durationSeconds={4} segments={[first, second]} onSegmentsSaved={onSegmentsSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit segment 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Merge segment 1 with next' }))
    expect(onSegmentsSaved).toHaveBeenCalledWith([expect.objectContaining({ text: 'First. Second.', endSeconds: 4 })])
  })

  it('splits a segment at the learner-provided timestamp', () => {
    const onSegmentsSaved = vi.fn()
    render(<SegmentEditor durationSeconds={4} segments={[first, second]} onSegmentsSaved={onSegmentsSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit segment 1' }))
    fireEvent.change(screen.getByLabelText('Split segment 1 at'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Split segment 1 left text'), { target: { value: 'First half' } })
    fireEvent.change(screen.getByLabelText('Split segment 1 right text'), { target: { value: 'Second half' } })
    fireEvent.click(screen.getByRole('button', { name: 'Split segment 1' }))
    expect(onSegmentsSaved).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ startSeconds: 0, endSeconds: 1, text: 'First half' }),
      expect.objectContaining({ startSeconds: 1, endSeconds: 2, text: 'Second half' }),
    ]))
  })

  it('asks the audio player to play the selected sentence', () => {
    const onPlaySegment = vi.fn()
    render(<SegmentEditor durationSeconds={4} segments={[first, second]} onSegmentsSaved={vi.fn()} onPlaySegment={onPlaySegment} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play segment 1' }))
    expect(onPlaySegment).toHaveBeenCalledWith(first)
  })

  it('does not save an invalid sentence time range', () => {
    const onSegmentsSaved = vi.fn()
    render(<SegmentEditor durationSeconds={4} segments={[first, second]} onSegmentsSaved={onSegmentsSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit segment 1' }))
    fireEvent.change(screen.getByLabelText('Segment 1 end'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save segment 1' }))
    expect(screen.getByRole('alert')).toHaveTextContent('end must be after start')
    expect(onSegmentsSaved).not.toHaveBeenCalled()
  })

  it('persists a difficult-sentence choice when the sentence is saved', () => {
    const onSegmentsSaved = vi.fn()
    render(<SegmentEditor durationSeconds={4} segments={[first, second]} onSegmentsSaved={onSegmentsSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit segment 1' }))
    fireEvent.click(screen.getByLabelText('Segment 1 difficult sentence'))
    fireEvent.click(screen.getByRole('button', { name: 'Save segment 1' }))
    expect(onSegmentsSaved).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 's1', isDifficult: true })]))
  })

  it('allows only one sentence edit until it is saved or discarded', () => {
    const onDirtyChange = vi.fn()
    render(<SegmentEditor durationSeconds={4} segments={[first, second]} onSegmentsSaved={vi.fn()} onDirtyChange={onDirtyChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit segment 1' }))
    expect(screen.getByRole('button', { name: 'Edit segment 2' })).toBeDisabled()
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByRole('button', { name: 'Discard segment 1 changes' }))
    expect(screen.getByRole('button', { name: 'Edit segment 2' })).toBeEnabled()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })
})
