const DEFAULT_ASR_BASE_URL = 'http://localhost:8021/v1'

export default async function globalSetup() {
  if (process.env.HEAR_SAY_SKIP_ASR_CHECK === '1') return
  const baseUrl = process.env.ASR_BASE_URL ?? DEFAULT_ASR_BASE_URL
  const openApiUrl = new URL('/openapi.json', baseUrl).toString()
  const timeoutMs = Number(process.env.ASR_HEALTH_TIMEOUT_MS ?? 60_000)

  try {
    const response = await fetch(openApiUrl, { signal: AbortSignal.timeout(timeoutMs) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await response.json()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error([
      `FunASR is required for E2E tests but ${openApiUrl} is unavailable (${reason}).`,
      'Start it first with: funasr-server --device cuda --port 8021',
      'Set ASR_BASE_URL when the OpenAI-compatible API uses another address.',
      'Set ASR_HEALTH_TIMEOUT_MS when model startup needs a longer warm-up.',
    ].join('\n'))
  }
}
