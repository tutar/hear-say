import { describe, expect, it, vi } from 'vitest'
import { ChromeRecordingClient } from '@/services/chrome-recording-client'

describe('ChromeRecordingClient', () => {
  it('stores the versioned content acknowledgement without requesting capture permission', async () => {
    const api = {
      permissions: { contains: vi.fn(), request: vi.fn() }, tabCapture: { getMediaStreamId: vi.fn() }, runtime: { sendMessage: vi.fn() },
      storage: { local: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined) } },
    }
    const client = new ChromeRecordingClient(api)
    expect(await client.contentRightsAcknowledged()).toBe(false)
    await client.acknowledgeContentRights()
    expect(api.storage.local.set).toHaveBeenCalledWith({ recordingRightsAcknowledgement: { version: 1, acknowledgedAt: expect.any(String) } })
    expect(api.permissions.request).not.toHaveBeenCalled()
  })

  it('obtains the tab stream id inside the Side Panel start action before messaging the worker', async () => {
    const api = {
      permissions: { contains: vi.fn(), request: vi.fn() },
      tabCapture: { getMediaStreamId: vi.fn(async () => 'stream-from-user-action') },
      runtime: { sendMessage: vi.fn(async () => ({ ok: true, data: undefined })) },
    }
    const client = new ChromeRecordingClient(api)

    await client.start({ tabId: 42, title: 'English lesson', url: 'https://youtube.com/watch?v=1', site: 'youtube.com' })

    expect(api.tabCapture.getMediaStreamId).toHaveBeenCalledWith({ targetTabId: 42 })
    expect(api.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'recording.start',
      streamId: 'stream-from-user-action',
    }))
  })

  it('uses the Offscreen WAV URL without trying to reconstruct a Blob from an extension message', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => { throw new TypeError("Failed to execute 'createObjectURL' on 'URL': Overload resolution failed.") })
    const api = {
      permissions: { contains: vi.fn(), request: vi.fn() }, tabCapture: { getMediaStreamId: vi.fn() },
      runtime: { sendMessage: vi.fn(async () => ({ ok: true, data: { wavUrl: 'blob:chrome-extension-wav', fileName: 'capture.wav', draftId: 'draft-1' } })) },
    }

    const result = await new ChromeRecordingClient(api).complete()

    expect(result).toMatchObject({ wavUrl: 'blob:chrome-extension-wav', fileName: 'capture.wav', draftId: 'draft-1' })
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
