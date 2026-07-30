import { beforeEach, describe, expect, it, vi } from 'vitest'

const permissions = { contains: vi.fn(async () => true), request: vi.fn(async () => true) }
vi.stubGlobal('browser', { permissions })
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const { transcribeAudio } = await import('@/services/asr-client')

const input = {
  audioBlob: new Blob(['audio'], { type: 'audio/wav' }), filename: 'clip.wav', materialId: 'm1', durationSeconds: 3,
  settings: { baseUrl: 'http://localhost:8021/v1', apiKey: '', model: 'sensevoice' },
}

describe('ASR client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions.contains.mockResolvedValue(true)
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ segments: [{ start: 0, end: 1, text: 'Hello' }] }), { status: 200 }))
  })

  it('posts the chosen audio to the OpenAI-compatible transcriptions path', async () => {
    const result = await transcribeAudio(input)
    expect(result[0]).toMatchObject({ text: 'Hello', materialId: 'm1' })
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8021/v1/audio/transcriptions')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' })
  })

  it('does not request audio when the learner declines the endpoint permission', async () => {
    permissions.contains.mockResolvedValue(false)
    permissions.request.mockResolvedValue(false)
    await expect(transcribeAudio(input)).rejects.toThrow('ASR endpoint permission was not granted')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never exposes the API key in a surfaced ASR error', async () => {
    fetchMock.mockRejectedValue(new Error('network failure'))
    await expect(transcribeAudio({ ...input, settings: { ...input.settings, apiKey: 'secret-key' } })).rejects.not.toThrow('secret-key')
  })
})
