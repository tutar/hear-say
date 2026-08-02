import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Material } from '@/domain/types'
import { MaterialRow } from '@/features/library/MaterialRow'

const material: Material = {
  id: 'm1', title: 'lesson.wav', audioBlob: new Blob(['audio']), durationSeconds: 5, status: 'ready', transcriptionError: null,
  firstRoundStage: 'blind_listen', nextReviewAt: null, reviewStep: 0, isFavorite: false, tags: [], createdAt: '', updatedAt: '',
}

describe('MaterialRow', () => {
  afterEach(cleanup)

  function renderRow(onRename = vi.fn(async () => undefined), onDelete = vi.fn(async () => undefined), onOpen = vi.fn()) {
    const onToggleFavorite = vi.fn(async () => undefined)
    const onSaveTags = vi.fn(async () => undefined)
    const onExport = vi.fn()
    const onResetProgress = vi.fn(async () => undefined)
    const onManageSubtitles = vi.fn()
    render(<MaterialRow material={material} actions={<button type="button">开始练习</button>} onOpen={onOpen} onRename={onRename} onDelete={onDelete} onToggleFavorite={onToggleFavorite} availableTags={['work']} onSaveTags={onSaveTags} onExport={onExport} onResetProgress={onResetProgress} onManageSubtitles={onManageSubtitles} />)
    return { onRename, onDelete, onOpen, onToggleFavorite, onSaveTags, onExport, onResetProgress, onManageSubtitles }
  }
  function openMenu() { fireEvent.click(screen.getByRole('button', { name: '更多操作 lesson.wav' })) }

  it('saves a trimmed name through the library callback', async () => {
    const { onRename } = renderRow()
    openMenu(); fireEvent.click(screen.getByRole('menuitem', { name: '重命名' }))
    fireEvent.change(screen.getByLabelText('材料名称'), { target: { value: '  revised  ' } })
    expect(screen.getByRole('dialog', { name: '重命名材料' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onRename).toHaveBeenCalledWith('m1', 'revised')
  })

  it('rejects an empty name without persisting', () => {
    const { onRename } = renderRow()
    openMenu(); fireEvent.click(screen.getByRole('menuitem', { name: '重命名' }))
    fireEvent.change(screen.getByLabelText('材料名称'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByText('材料名称不能为空')).toBeInTheDocument()
    expect(onRename).not.toHaveBeenCalled()
  })

  it('closes the rename dialog without persisting', () => {
    const { onRename } = renderRow()
    openMenu(); fireEvent.click(screen.getByRole('menuitem', { name: '重命名' }))
    fireEvent.change(screen.getByLabelText('材料名称'), { target: { value: 'discarded' } })
    fireEvent.click(screen.getByRole('button', { name: '关闭重命名' }))
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByText('lesson.wav')).toBeInTheDocument()
  })

  it('keeps rename controls from opening the material detail', () => {
    const { onOpen } = renderRow()
    openMenu(); fireEvent.click(screen.getByRole('menuitem', { name: '重命名' }))
    fireEvent.click(screen.getByLabelText('材料名称'))
    fireEvent.click(screen.getByRole('button', { name: '关闭重命名' }))
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('closes the rename dialog with Escape without saving', () => {
    const { onRename } = renderRow()
    openMenu(); fireEvent.click(screen.getByRole('menuitem', { name: '重命名' }))
    fireEvent.keyDown(screen.getByRole('dialog', { name: '重命名材料' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '重命名材料' })).not.toBeInTheDocument()
    expect(onRename).not.toHaveBeenCalled()
  })

  it('closes a delete confirmation without mutating the material', () => {
    const { onDelete } = renderRow()
    openMenu(); fireEvent.click(screen.getByRole('menuitem', { name: '删除' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('音频、句子时间轴与学习记录将一并永久删除')
    fireEvent.click(screen.getByRole('button', { name: '取消删除' }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('deletes only after the learner confirms in the custom dialog', () => {
    const { onDelete } = renderRow()
    openMenu(); fireEvent.click(screen.getByRole('menuitem', { name: '删除' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    expect(onDelete).toHaveBeenCalledWith('m1')
  })

  it('shows card metadata and provides favorite and menu actions', () => {
    const { onToggleFavorite, onExport, onManageSubtitles } = renderRow()
    expect(screen.getByText(/00:05 · 字幕/)).toBeInTheDocument()
    expect(screen.getByText('首次学习')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '收藏 lesson.wav' }))
    expect(onToggleFavorite).toHaveBeenCalledWith('m1', true)
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: '管理字幕' }))
    expect(onManageSubtitles).toHaveBeenCalledWith('m1')
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: '导出' }))
    expect(onExport).toHaveBeenCalledWith('m1')
  })

  it('closes the more menu when focus leaves the material card', () => {
    renderRow()
    openMenu()
    const menu = screen.getByRole('menu')
    fireEvent.blur(menu, { relatedTarget: document.body })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('saves selected and newly created tags, and confirms progress reset', () => {
    const { onSaveTags, onResetProgress } = renderRow()
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: '管理标签' }))
    fireEvent.click(screen.getByLabelText('work'))
    fireEvent.change(screen.getByLabelText('新标签'), { target: { value: ' podcast ' } })
    fireEvent.click(screen.getByRole('button', { name: '添加标签' }))
    fireEvent.click(screen.getByRole('button', { name: '保存标签' }))
    expect(onSaveTags).toHaveBeenCalledWith('m1', ['work', 'podcast'])
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: '重置学习进度' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('保留音频、字幕、标签和收藏')
    fireEvent.click(screen.getByRole('button', { name: '确认重置' }))
    expect(onResetProgress).toHaveBeenCalledWith('m1')
  })

  it('can close the tag dialog without saving', () => {
    const { onSaveTags } = renderRow()
    openMenu(); fireEvent.click(screen.getByRole('menuitem', { name: '管理标签' }))
    fireEvent.click(screen.getByRole('button', { name: '关闭管理标签' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onSaveTags).not.toHaveBeenCalled()
  })
})
