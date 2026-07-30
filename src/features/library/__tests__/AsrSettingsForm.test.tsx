import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { AsrSettingsForm } from '@/features/library/AsrSettingsForm'

describe('AsrSettingsForm', () => {
  afterEach(cleanup)

  it('lets a learner save an ASR endpoint and model without displaying the API key', () => {
    const onSave = vi.fn()
    render(<AsrSettingsForm settings={{ baseUrl: 'http://localhost:8021/v1', apiKey: '', model: 'sensevoice' }} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('ASR 地址'), { target: { value: 'http://localhost:9000/v1' } })
    fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'paraformer' } })
    fireEvent.click(screen.getByRole('button', { name: '保存转写设置' }))

    expect(screen.getByLabelText('API Key')).toHaveAttribute('type', 'password')
    expect(onSave).toHaveBeenCalledWith({ baseUrl: 'http://localhost:9000/v1', apiKey: '', model: 'paraformer' })
  })
})
