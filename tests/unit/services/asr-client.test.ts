import { beforeEach, describe, expect, it, vi } from 'vitest'

const permissions = { contains: vi.fn(async () => true), request: vi.fn(async () => true) }
vi.stubGlobal('browser', { permissions })
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const { transcribeAudio } = await import('@/services/asr-client')

const input = {
  audioBlob: new Blob(['audio'], { type: 'audio/wav' }), filename: 'clip.wav', materialId: 'm1', durationSeconds: 3,
  settings: { provider: 'openai-compatible' as const, baseUrl: 'http://localhost:8021/v1', apiKey: '', model: 'sensevoice', language: 'en' as const },
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
    expect((fetchMock.mock.calls[0][1].body as FormData).get('language')).toBe('en')
  })

  it('omits the language hint when automatic detection is selected', async () => {
    await transcribeAudio({ ...input, settings: { ...input.settings, language: 'auto' } })
    expect((fetchMock.mock.calls[0][1].body as FormData).has('language')).toBe(false)
  })

  it('uploads once, then reads AssemblyAI sentences and paragraphs to create practice units', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ upload_url: 'https://cdn.assemblyai.com/upload/one' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'transcript-1', status: 'queued' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'transcript-1', status: 'processing' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'transcript-1', status: 'completed' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sentences: [{ start: 250, end: 1500, text: 'Hello there.' }, { start: 1600, end: 5900, text: 'How are you doing today?' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ paragraphs: [{ start: 250, end: 5900, text: 'Hello there. How are you doing today?' }] }), { status: 200 }))

    const result = await transcribeAudio({ ...input, settings: { provider: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', apiKey: 'assembly-key', model: 'universal-3-pro', language: 'en' } })

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://api.assemblyai.com/v2/upload',
      'https://api.assemblyai.com/v2/transcript',
      'https://api.assemblyai.com/v2/transcript/transcript-1',
      'https://api.assemblyai.com/v2/transcript/transcript-1',
      'https://api.assemblyai.com/v2/transcript/transcript-1/sentences',
      'https://api.assemblyai.com/v2/transcript/transcript-1/paragraphs',
    ])
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', body: input.audioBlob, headers: { Authorization: 'assembly-key' } })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ audio_url: 'https://cdn.assemblyai.com/upload/one', speech_models: ['universal-3-5-pro', 'universal-2'], language_code: 'en' })
    expect(result).toMatchObject([{ materialId: 'm1', startSeconds: 0.25, endSeconds: 5.9, text: 'Hello there. How are you doing today?' }])
  })

  it('groups an AssemblyAI words-only response into sentence timeline entries', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ upload_url: 'https://cdn.assemblyai.com/upload/words' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'transcript-words', status: 'queued' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'transcript-words', status: 'completed', words: [
          { start: 0, end: 400, text: 'Hello' },
          { start: 450, end: 900, text: 'there.' },
          { start: 1100, end: 1350, text: 'How' },
          { start: 1400, end: 1650, text: 'are' },
          { start: 1700, end: 2100, text: 'you?' },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sentences: [
        { start: 0, end: 900, text: 'Hello there.' },
        { start: 1100, end: 2100, text: 'How are you?' },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ paragraphs: [{ start: 0, end: 2100, text: 'Hello there. How are you?' }] }), { status: 200 }))

    const result = await transcribeAudio({ ...input, settings: { provider: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', apiKey: 'assembly-key', model: 'universal-3-5-pro', language: 'en' } })

    expect(result).toMatchObject([{ order: 0, startSeconds: 0, endSeconds: 2.1, text: 'Hello there. How are you?' }])
    expect(fetchMock.mock.calls[3][0]).toBe('https://api.assemblyai.com/v2/transcript/transcript-words/sentences')
    expect(fetchMock.mock.calls[4][0]).toBe('https://api.assemblyai.com/v2/transcript/transcript-words/paragraphs')
  })

  it('keeps original sentences and reports a non-blocking warning when paragraph grouping fails', async () => {
    const onWarning = vi.fn()
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ upload_url: 'https://cdn.assemblyai.com/upload/one' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'transcript-1', status: 'queued' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'transcript-1', status: 'completed' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sentences: [{ start: 0, end: 500, text: 'Mm.' }, { start: 700, end: 2200, text: 'All right.' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))

    const result = await transcribeAudio({ ...input, onWarning, settings: { provider: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', apiKey: 'assembly-key', model: 'universal-3-5-pro', language: 'en' } })
    expect(result.map((segment) => segment.text)).toEqual(['Mm.', 'All right.'])
    expect(onWarning).toHaveBeenCalledWith('段落分组不可用，已保留原始句子。')
  })

  it('does not turn words into learning entries when AssemblyAI sentence segmentation fails', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ upload_url: 'https://cdn.assemblyai.com/upload/words' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'transcript-words', status: 'queued' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'transcript-words', status: 'completed', words: [{ start: 0, end: 400, text: 'Hello' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))

    await expect(transcribeAudio({ ...input, settings: { provider: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', apiKey: 'assembly-key', model: 'universal-3-5-pro', language: 'en' } }))
      .rejects.toThrow('sentence segmentation failed with HTTP 503')
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
