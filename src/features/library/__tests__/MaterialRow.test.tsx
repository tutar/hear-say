import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Material } from '@/domain/types'
import { MaterialRow } from '@/features/library/MaterialRow'

const material: Material = {
  id: 'm1', title: 'lesson.wav', audioBlob: new Blob(['audio']), durationSeconds: 5, status: 'ready', transcriptionError: null,
  firstRoundStage: 'blind_listen', nextReviewAt: null, reviewStep: 0, createdAt: '', updatedAt: '',
}

describe('MaterialRow', () => {
  afterEach(cleanup)

  function renderRow(onRename = vi.fn(async () => undefined), onDelete = vi.fn(async () => undefined)) {
    render(<MaterialRow material={material} actions={<button type="button">开始练习</button>} onRename={onRename} onDelete={onDelete} />)
    return { onRename, onDelete }
  }

  it('saves a trimmed name through the library callback', async () => {
    const { onRename } = renderRow()
    fireEvent.click(screen.getByRole('button', { name: '重命名 lesson.wav' }))
    fireEvent.change(screen.getByLabelText('材料名称'), { target: { value: '  revised  ' } })
    fireEvent.click(screen.getByRole('button', { name: '保存名称' }))
    expect(onRename).toHaveBeenCalledWith('m1', 'revised')
  })

  it('rejects an empty name without persisting', () => {
    const { onRename } = renderRow()
    fireEvent.click(screen.getByRole('button', { name: '重命名 lesson.wav' }))
    fireEvent.change(screen.getByLabelText('材料名称'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: '保存名称' }))
    expect(screen.getByText('材料名称不能为空')).toBeInTheDocument()
    expect(onRename).not.toHaveBeenCalled()
  })

  it('cancels an in-place rename without persisting', () => {
    const { onRename } = renderRow()
    fireEvent.click(screen.getByRole('button', { name: '重命名 lesson.wav' }))
    fireEvent.change(screen.getByLabelText('材料名称'), { target: { value: 'discarded' } })
    fireEvent.click(screen.getByRole('button', { name: '取消重命名' }))
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByText('lesson.wav')).toBeInTheDocument()
  })

  it('closes a delete confirmation without mutating the material', () => {
    const { onDelete } = renderRow()
    fireEvent.click(screen.getByRole('button', { name: '删除 lesson.wav' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('音频、句子时间轴与学习记录将一并永久删除')
    fireEvent.click(screen.getByRole('button', { name: '取消删除' }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('deletes only after the learner confirms in the custom dialog', () => {
    const { onDelete } = renderRow()
    fireEvent.click(screen.getByRole('button', { name: '删除 lesson.wav' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    expect(onDelete).toHaveBeenCalledWith('m1')
  })
})
