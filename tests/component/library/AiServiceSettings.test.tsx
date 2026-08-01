import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiServiceSettings } from '@/features/library/AiServiceSettings'

describe('AiServiceSettings', () => {
  afterEach(cleanup)

  it('lets a learner configure transcription and vocabulary explanation independently', () => {
    const onSaveVocabulary = vi.fn()
    render(<AiServiceSettings
      asr={{ baseUrl: 'http://localhost:8021/v1', apiKey: '', model: 'sensevoice' }}
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
  })
})
