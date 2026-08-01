import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecordingHarness, type RecordingHarnessClient } from '@/features/recording/RecordingHarness'

afterEach(cleanup)

describe('RecordingHarness', () => {
  it('blocks a new recording when less than 250 MB remains', async () => {
    const client: RecordingHarnessClient = {
      storageReadiness: vi.fn(async () => ({ usageBytes: 900_000_000, quotaBytes: 1_000_000_000, remainingBytes: 100_000_000, usageRatio: .9, canStart: false })),
      enable: vi.fn(async () => true), start: vi.fn(async () => undefined), pause: vi.fn(async () => undefined), resume: vi.fn(async () => undefined),
      complete: vi.fn(async () => ({ wavUrl: '', fileName: '', draftId: '' })), cancel: vi.fn(async () => undefined),
    }
    render(<RecordingHarness source={{ tabId: 42, title: 'English lesson', url: 'https://example.com/lesson', site: 'example.com' }} client={client} />)
    fireEvent.click(screen.getByRole('button', { name: '启用标签页录制' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('剩余空间不足 250 MB')
    expect(screen.getByRole('button', { name: '开始录制' })).toBeDisabled()
    expect(client.start).not.toHaveBeenCalled()
  })

  it('requires the first-use content acknowledgement before requesting capture permission', async () => {
    const client: RecordingHarnessClient = {
      contentRightsAcknowledged: vi.fn(async () => false), acknowledgeContentRights: vi.fn(async () => undefined),
      enable: vi.fn(async () => true), start: vi.fn(async () => undefined), pause: vi.fn(async () => undefined), resume: vi.fn(async () => undefined),
      complete: vi.fn(async () => ({ wavUrl: '', fileName: '', draftId: '' })), cancel: vi.fn(async () => undefined),
    }
    render(<RecordingHarness source={{ tabId: 42, title: 'English lesson', url: 'https://example.com/lesson', site: 'example.com' }} client={client} />)

    expect(await screen.findByRole('heading', { name: '开始前请确认' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认并继续' })).toBeDisabled()
    expect(client.enable).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: '我确认有权将这段内容用于个人学习' }))
    fireEvent.click(screen.getByRole('button', { name: '确认并继续' }))
    await waitFor(() => expect(client.acknowledgeContentRights).toHaveBeenCalled())
    fireEvent.click(await screen.findByRole('button', { name: '启用标签页录制' }))
    await waitFor(() => expect(client.enable).toHaveBeenCalled())
  })

  it('lets a tester start, pause, continue, and complete one source recording', async () => {
    const client: RecordingHarnessClient = {
      enable: vi.fn(async () => true),
      start: vi.fn(async () => undefined),
      pause: vi.fn(async () => undefined),
      resume: vi.fn(async () => undefined),
      complete: vi.fn(async () => ({ wavUrl: 'blob:recording', fileName: 'capture.wav', draftId: 'draft-1' })),
      cancel: vi.fn(async () => undefined),
      status: vi.fn(async () => ({ chunkCount: 3, bufferedSamples: 8_000, persistedBytes: 480_000 })),
      openDraft: vi.fn(async () => undefined),
    }
    render(<RecordingHarness source={{ tabId: 42, title: 'English lesson', url: 'https://example.com/lesson', site: 'example.com' }} client={client} />)

    expect(screen.getByText('English lesson')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '启用标签页录制' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '开始录制' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '开始录制' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('正在录制'))
    await waitFor(() => expect(screen.getByText('3 个分片')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '暂停' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已暂停'))
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    fireEvent.click(await screen.findByRole('button', { name: '完成录制' }))

    fireEvent.click(await screen.findByRole('button', { name: '编辑并导入' }))
    expect(client.openDraft).toHaveBeenCalledWith('draft-1')
    expect(screen.queryByRole('button', { name: '使用 FunASR 验证' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '稍后处理' }))
    expect(await screen.findByRole('status')).toHaveTextContent('已保存到资料库')
  })

  it('offers one recovered WAV after the recorder context was interrupted', async () => {
    const recovered = { wavUrl: 'blob:recovered', fileName: 'recovered.wav', draftId: 'recovered-draft' }
    const client: RecordingHarnessClient = {
      enable: vi.fn(async () => true), start: vi.fn(async () => undefined), pause: vi.fn(async () => undefined), resume: vi.fn(async () => undefined),
      complete: vi.fn(async () => recovered), cancel: vi.fn(async () => undefined), recoveryAvailable: vi.fn(async () => true), recover: vi.fn(async () => recovered), openDraft: vi.fn(async () => undefined),
    }
    render(<RecordingHarness source={{ tabId: 7, title: 'Recovered lesson', url: 'https://example.com/recovered', site: 'example.com' }} client={client} />)
    fireEvent.click(await screen.findByRole('button', { name: '恢复已保存的录音' }))
    expect(await screen.findByRole('button', { name: '编辑并导入' })).toBeInTheDocument()
  })

  it('restores an active recording when the Side Panel is opened again', async () => {
    const client: RecordingHarnessClient = {
      enable: vi.fn(async () => true), start: vi.fn(async () => undefined), pause: vi.fn(async () => undefined), resume: vi.fn(async () => undefined), complete: vi.fn(async () => ({ wavUrl: '', fileName: '', draftId: 'active-draft' })), cancel: vi.fn(async () => undefined),
      current: vi.fn(async () => ({ state: 'paused' as const, chunkCount: 4, bufferedSamples: 2_000, persistedBytes: 640_000 })),
    }
    render(<RecordingHarness source={{ tabId: 7, title: 'Active lesson', url: 'https://example.com/active', site: 'example.com' }} client={client} />)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('已暂停'))
    expect(screen.getByRole('button', { name: '继续' })).toBeInTheDocument()
  })

  it('shows the captured-time warning and restores an automatic completion', async () => {
    const base = { enable: vi.fn(async () => true), start: vi.fn(async () => undefined), pause: vi.fn(async () => undefined), resume: vi.fn(async () => undefined), complete: vi.fn(async () => ({ wavUrl: '', fileName: '', draftId: 'draft-1' })), cancel: vi.fn(async () => undefined), openDraft: vi.fn(async () => undefined) }
    const { unmount } = render(<RecordingHarness source={{ tabId: 7, title: 'Long lesson', url: 'https://example.com/long', site: 'example.com' }} client={{ ...base, current: vi.fn(async () => ({ state: 'recording' as const, chunkCount: 360, bufferedSamples: 0, persistedBytes: 57_600_000, capturedMilliseconds: 30 * 60_000 })) }} />)
    expect(await screen.findByText(/已录制 30 分钟/)).toBeInTheDocument()
    unmount()

    render(<RecordingHarness source={{ tabId: 7, title: 'Long lesson', url: 'https://example.com/long', site: 'example.com' }} client={{ ...base, current: vi.fn(async () => ({ state: 'completed' as const, chunkCount: 0, bufferedSamples: 0, persistedBytes: 115_200_000, capturedMilliseconds: 60 * 60_000, result: { wavUrl: 'blob:auto', fileName: 'auto.wav', draftId: 'draft-auto' } })) }} />)
    expect(await screen.findByRole('button', { name: '编辑并导入' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('录制完成')
  })
})
