import { describe, expect, it, vi } from 'vitest'
import { createDeepSeekExplainer } from '@/services/deepseek-client'

describe('DeepSeek vocabulary client', () => {
  it('explains only the selected term and its sentence as structured JSON', async () => {
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ term: 'record', ipa: '/rɪˈkɔːrd/', partOfSpeech: '动词', meaningZh: '录制', contextExplanationZh: '这里表示保存声音。' }) } }] }), { status: 200 }))
    const client = createDeepSeekExplainer({ baseUrl: 'https://api.deepseek.com', apiKey: 'secret', model: 'deepseek-v4-flash' }, request)

    const result = await client.explain({ term: 'record', sentence: 'Please record a message.' })

    expect(result).toMatchObject({ partOfSpeech: '动词', meaningZh: '录制' })
    const body = JSON.parse(String(request.mock.calls[0][1]?.body))
    expect(body).toMatchObject({ model: 'deepseek-v4-flash', response_format: { type: 'json_object' } })
    expect(JSON.stringify(body.messages)).toContain('Please record a message.')
    expect(JSON.stringify(body.messages)).not.toContain('example.com')
  })
})
