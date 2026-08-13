import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiServiceSettings } from '@/features/library/AiServiceSettings'

describe('AiServiceSettings', () => {
  afterEach(cleanup)

  it('lets a learner configure transcription and vocabulary explanation independently', async () => {
    const onSaveVocabulary = vi.fn(async () => undefined)
    render(<AiServiceSettings
      asr={{ provider: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', apiKey: '', model: 'universal-3-5-pro', language: 'en' }}
      vocabulary={{ baseUrl: 'https://api.deepseek.com', apiKey: '', model: 'deepseek-v4-flash' }}
      onSaveAsr={vi.fn()}
      onSaveVocabulary={onSaveVocabulary}
      onTestVocabulary={vi.fn(async () => undefined)}
    />)

    expect(screen.getByRole('heading', { name: '音频转写' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '词汇解释' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('DeepSeek API Key'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: '保存词汇解释设置' }))
    expect(onSaveVocabulary).toHaveBeenCalledWith({ baseUrl: 'https://api.deepseek.com', apiKey: 'secret', model: 'deepseek-v4-flash' })
    expect(await screen.findByRole('status')).toHaveTextContent('词汇解释设置已保存')
  })

  it('keeps incomplete vocabulary settings unsaved and explains what is missing', () => {
    const onSaveVocabulary = vi.fn(async () => undefined)
    render(<AiServiceSettings
      asr={{ provider: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', apiKey: '', model: 'universal-3-5-pro', language: 'en' }}
      vocabulary={{ baseUrl: '', apiKey: '', model: '' }}
      onSaveAsr={vi.fn(async () => undefined)}
      onSaveVocabulary={onSaveVocabulary}
      onTestVocabulary={vi.fn(async () => undefined)}
    />)

    fireEvent.submit(screen.getByRole('button', { name: '保存词汇解释设置' }).closest('form')!)

    expect(onSaveVocabulary).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('请填写 API 地址、模型和 API Key')
    expect(screen.queryByText('词汇解释设置已保存')).not.toBeInTheDocument()
  })
})
