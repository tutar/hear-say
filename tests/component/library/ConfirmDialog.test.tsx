import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '@/features/library/ConfirmDialog'

describe('ConfirmDialog', () => {
  afterEach(cleanup)
  it('presents a focused safe action and a distinct destructive action', () => {
    const onCancel = vi.fn(); const onConfirm = vi.fn()
    render(<ConfirmDialog title="删除录制草稿吗？" cancelLabel="保留草稿" confirmLabel="确认删除" danger onCancel={onCancel} onConfirm={onConfirm}><p>录音将无法恢复。</p></ConfirmDialog>)
    expect(screen.getByRole('dialog', { name: '删除录制草稿吗？' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: '保留草稿' })).toHaveFocus()
    expect(screen.getByRole('button', { name: '确认删除' })).toHaveClass('dialog-danger')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
