import { normalizeVerboseJson } from '../domain/asr'
import type { AsrSettings, Segment } from '../domain/types'

export type TranscriptionInput = {
  audioBlob: Blob
  filename: string
  materialId: string
  durationSeconds: number | null
  settings: AsrSettings
}

function endpointOriginPattern(baseUrl: string): string {
  const url = new URL(baseUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('ASR Base URL must use HTTP or HTTPS')
  return `${url.protocol}//${url.host}/*`
}

async function ensurePermission(baseUrl: string): Promise<void> {
  const origin = endpointOriginPattern(baseUrl)
  if (await browser.permissions.contains({ origins: [origin] })) return
  if (!await browser.permissions.request({ origins: [origin] })) throw new Error('ASR endpoint permission was not granted')
}

export async function transcribeAudio(input: TranscriptionInput): Promise<Segment[]> {
  await ensurePermission(input.settings.baseUrl)
  const body = new FormData()
  body.append('file', input.audioBlob, input.filename)
  body.append('model', input.settings.model)
  body.append('response_format', 'verbose_json')
  const baseUrl = input.settings.baseUrl.replace(/\/$/, '')
  const headers = input.settings.apiKey ? { Authorization: `Bearer ${input.settings.apiKey}` } : undefined

  let response: Response
  try {
    response = await fetch(`${baseUrl}/audio/transcriptions`, { method: 'POST', body, headers })
  } catch {
    throw new Error('ASR endpoint is unreachable. Check the address and retry.')
  }
  if (!response.ok) throw new Error(`ASR transcription failed with HTTP ${response.status}. Retry or import subtitles.`)

  try {
    return normalizeVerboseJson(await response.json(), input.materialId, input.durationSeconds)
  } catch (error) {
    if (error instanceof Error) throw new Error(`ASR response cannot create a sentence timeline: ${error.message}`)
    throw new Error('ASR response cannot create a sentence timeline. Retry or import subtitles.')
  }
}
