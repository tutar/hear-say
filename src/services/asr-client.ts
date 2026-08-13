import { normalizeVerboseJson } from '../domain/asr'
import { createPracticeSegments } from '../domain/practice-segments'
import type { AsrSettings, Segment } from '../domain/types'

export type TranscriptionInput = {
  audioBlob: Blob
  filename: string
  materialId: string
  durationSeconds: number | null
  settings: AsrSettings
  onWarning?: (message: string) => void
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

type AssemblyTranscript = {
  id?: string
  status?: string
  error?: string
  words?: { start: number; end: number; text: string }[]
}
type AssemblyTimedText = { start: number; end: number; text: string }

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function assemblyTimeline(timed: AssemblyTimedText[], materialId: string): Segment[] {
  if (timed.length === 0) throw new Error('response has no sentence timestamps')
  return timed.map((item, order) => ({ id: crypto.randomUUID(), materialId, order, startSeconds: item.start / 1000, endSeconds: item.end / 1000, text: item.text.trim(), isDifficult: false }))
}

async function transcribeWithAssemblyAI(input: TranscriptionInput): Promise<Segment[]> {
  const baseUrl = input.settings.baseUrl.replace(/\/$/, '')
  const headers = { Authorization: input.settings.apiKey }
  const upload = await fetch(`${baseUrl}/upload`, { method: 'POST', body: input.audioBlob, headers })
  if (!upload.ok) throw new Error(`AssemblyAI upload failed with HTTP ${upload.status}. Retry or import subtitles.`)
  const { upload_url: audioUrl } = await upload.json() as { upload_url?: string }
  if (!audioUrl) throw new Error('AssemblyAI upload returned no audio URL. Retry or import subtitles.')
  const selectedModel = input.settings.model === 'universal-3-pro' ? 'universal-3-5-pro' : input.settings.model
  const speechModels = selectedModel === 'universal-3-5-pro' ? [selectedModel, 'universal-2'] : [selectedModel]
  const request = input.settings.language === 'auto'
    ? { audio_url: audioUrl, speech_models: speechModels, language_detection: true }
    : { audio_url: audioUrl, speech_models: speechModels, language_code: input.settings.language }
  const submitted = await fetch(`${baseUrl}/transcript`, { method: 'POST', body: JSON.stringify(request), headers: { ...headers, 'Content-Type': 'application/json' } })
  if (!submitted.ok) throw new Error(`AssemblyAI transcription failed with HTTP ${submitted.status}. Retry or import subtitles.`)
  let transcript = await submitted.json() as AssemblyTranscript
  if (!transcript.id) throw new Error('AssemblyAI returned no transcript ID. Retry or import subtitles.')
  for (let attempt = 0; attempt < 600 && transcript.status !== 'completed'; attempt += 1) {
    if (transcript.status === 'error') throw new Error(`AssemblyAI transcription failed: ${transcript.error ?? 'unknown error'}. Retry or import subtitles.`)
    if (attempt > 0) await wait(250)
    const response = await fetch(`${baseUrl}/transcript/${encodeURIComponent(transcript.id)}`, { headers })
    if (!response.ok) throw new Error(`AssemblyAI polling failed with HTTP ${response.status}. Retry or import subtitles.`)
    transcript = await response.json() as AssemblyTranscript
  }
  if (transcript.status !== 'completed') throw new Error('AssemblyAI transcription timed out. Retry or import subtitles.')
  const sentencesResponse = await fetch(`${baseUrl}/transcript/${encodeURIComponent(transcript.id)}/sentences`, { headers })
  if (!sentencesResponse.ok) throw new Error(`AssemblyAI sentence segmentation failed with HTTP ${sentencesResponse.status}. Retry or import subtitles.`)
  const { sentences } = await sentencesResponse.json() as { sentences?: AssemblyTimedText[] }
  if (!sentences?.length) throw new Error('AssemblyAI sentence segmentation returned no sentences. Retry or import subtitles.')
  const paragraphsResponse = await fetch(`${baseUrl}/transcript/${encodeURIComponent(transcript.id)}/paragraphs`, { headers })
  if (!paragraphsResponse.ok) {
    input.onWarning?.('段落分组不可用，已保留原始句子。')
    return assemblyTimeline(sentences, input.materialId)
  }
  const { paragraphs } = await paragraphsResponse.json() as { paragraphs?: AssemblyTimedText[] }
  if (!paragraphs?.length) {
    input.onWarning?.('段落分组不可用，已保留原始句子。')
    return assemblyTimeline(sentences, input.materialId)
  }
  return assemblyTimeline(createPracticeSegments(sentences, paragraphs), input.materialId)
}

export async function transcribeAudio(input: TranscriptionInput): Promise<Segment[]> {
  await ensurePermission(input.settings.baseUrl)
  if (input.settings.provider === 'assemblyai') {
    try { return await transcribeWithAssemblyAI(input) } catch (error) {
      if (error instanceof Error) throw error
      throw new Error('AssemblyAI transcription failed. Retry or import subtitles.')
    }
  }
  const body = new FormData()
  body.append('file', input.audioBlob, input.filename)
  body.append('model', input.settings.model)
  body.append('response_format', 'verbose_json')
  if (input.settings.language !== 'auto') body.append('language', input.settings.language)
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
