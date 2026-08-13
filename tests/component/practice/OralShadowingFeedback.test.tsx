import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OralRecognitionListener, OralRecognizer } from '@/services/oral-recognition'
import { OralShadowingFeedback } from '@/features/practice/OralShadowingFeedback'

class FakeRecognizer implements OralRecognizer {
  listener?: OralRecognitionListener
  start = vi.fn(async (listener: OralRecognitionListener) => { this.listener = listener })
  stop = vi.fn()
}

describe('OralShadowingFeedback', () => {
  afterEach(cleanup)

  it('shows live speech and final similarity without changing sentence completion', async () => {
    const recognizer = new FakeRecognizer()
    render(<OralShadowingFeedback sentence="First transcript sentence" recognizer={recognizer} onSkip={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '开始跟读录音' }))
    await vi.waitFor(() => expect(recognizer.start).toHaveBeenCalled())
    act(() => recognizer.listener?.onPartial('First trans'))
    expect(screen.getByRole('status')).toHaveTextContent('First trans')
    fireEvent.click(screen.getByRole('button', { name: '停止录音' }))
    act(() => recognizer.listener?.onFinal('First transcript sentence'))
    expect(screen.getByText('识别结果：First transcript sentence')).toBeInTheDocument()
    expect(screen.getByText('相似度 100%')).toBeInTheDocument()
  })

  it('offers retry and skip when recognition returns no speech', async () => {
    const recognizer = new FakeRecognizer()
    const onSkip = vi.fn()
    render(<OralShadowingFeedback sentence="First transcript sentence" recognizer={recognizer} onSkip={onSkip} />)
    fireEvent.click(screen.getByRole('button', { name: '开始跟读录音' }))
    await vi.waitFor(() => expect(recognizer.start).toHaveBeenCalled())
    act(() => recognizer.listener?.onFinal(''))
    expect(screen.getByRole('button', { name: '再试一次' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '跳过本句' }))
    expect(onSkip).toHaveBeenCalled()
  })

  it('offers a plain-language local download with progress after online recognition is unavailable', async () => {
    const online = new FakeRecognizer()
    const local = new FakeRecognizer() as FakeRecognizer & { prepare: ReturnType<typeof vi.fn> }
    local.prepare = vi.fn(async (_url: string, onProgress: (value: number) => void) => onProgress(100))
    render(<OralShadowingFeedback sentence="First transcript sentence" recognizer={online} localRecognizer={local} onSkip={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '开始跟读录音' }))
    await vi.waitFor(() => expect(online.start).toHaveBeenCalled())
    online.listener?.onError({ kind: 'unavailable', message: 'Online speech recognition is unavailable.' })
    expect(await screen.findByText(/Download a local speech recognition component/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('本地语音组件地址'), { target: { value: 'https://mirror.example/model.tar.gz' } })
    fireEvent.click(screen.getByRole('button', { name: '下载并使用' }))
    await vi.waitFor(() => expect(local.prepare).toHaveBeenCalledWith('https://mirror.example/model.tar.gz', expect.any(Function)))
    expect(await screen.findByText('下载进度 100%')).toBeInTheDocument()
    expect(local.start).toHaveBeenCalled()
  })
})
