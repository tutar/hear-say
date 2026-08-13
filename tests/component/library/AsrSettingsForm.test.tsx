import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { AsrSettingsForm } from '@/features/library/AsrSettingsForm'

describe('AsrSettingsForm', () => {
  afterEach(cleanup)

  it('shows the simple AssemblyAI configuration by default', async () => {
    const onSave = vi.fn(async () => undefined)
    render(<AsrSettingsForm settings={{ provider: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', apiKey: '', model: 'universal-3-5-pro', language: 'en' }} onSave={onSave} />)

    expect(screen.queryByLabelText('Base URL')).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Universal-3.5 Pro' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Universal-2' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'AssemblyAI dashboard' })).toHaveAttribute('href', 'https://www.assemblyai.com/dashboard')
    fireEvent.change(screen.getByLabelText('音频语言'), { target: { value: 'auto' } })
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'assembly-key' } })
    fireEvent.click(screen.getByRole('button', { name: '保存转写设置' }))
    expect(onSave).toHaveBeenCalledWith({ provider: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', apiKey: 'assembly-key', model: 'universal-3-5-pro', language: 'auto' })
    expect(await screen.findByRole('status')).toHaveTextContent('转写设置已保存')
  })

  it('lets a learner switch to an OpenAI-compatible endpoint', () => {
    const onSave = vi.fn(async () => undefined)
    render(<AsrSettingsForm settings={{ provider: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', apiKey: '', model: 'universal-3-5-pro', language: 'en' }} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('转写提供商'), { target: { value: 'openai-compatible' } })
    fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: 'http://localhost:9000/v1' } })
    fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'paraformer' } })
    fireEvent.change(screen.getByLabelText('音频语言'), { target: { value: 'auto' } })
    fireEvent.click(screen.getByRole('button', { name: '保存转写设置' }))

    expect(screen.getByLabelText('API Key')).toHaveAttribute('type', 'password')
    expect(onSave).toHaveBeenCalledWith({ provider: 'openai-compatible', baseUrl: 'http://localhost:9000/v1', apiKey: '', model: 'paraformer', language: 'auto' })
  })
})
