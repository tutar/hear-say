import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioImportControl } from '@/features/library/AudioImportControl'

describe('AudioImportControl', () => {
  afterEach(cleanup)

  it('makes an active transcription unmistakable and prevents another selection', () => {
    render(<AudioImportControl isImporting onSelectFile={vi.fn()} />)
    expect(screen.getByLabelText('选择音频文件')).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('正在转写音频，这可能需要一点时间…')
  })

  it('leaves the chooser available when not importing', () => {
    render(<AudioImportControl isImporting={false} onSelectFile={vi.fn()} />)
    expect(screen.getByLabelText('选择音频文件')).toBeEnabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
