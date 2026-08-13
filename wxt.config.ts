import { defineConfig } from 'wxt'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

function voskMv3Worker(): Plugin {
  const voskPath = fileURLToPath(new URL('./node_modules/vosk-browser/dist/vosk.js', import.meta.url))
  const source = readFileSync(voskPath, 'utf8')
  const encodedWorker = source.match(/createBase64WorkerFactory\('([^']+)'/)?.[1]
  if (!encodedWorker) throw new Error('Unable to locate the vosk-browser worker')
  return {
    name: 'vosk-mv3-worker',
    transform(code, id) {
      if (!id.includes('vosk-browser/dist/vosk.js')) return
      return code
        .replace(/createBase64WorkerFactory\('[^']+'/, "createBase64WorkerFactory(''")
        .replace('return new Worker(url, options);', "return new Worker(globalThis.chrome.runtime.getURL('vosk-worker.js'), options);")
    },
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'vosk-worker.js', source: Buffer.from(encodedWorker, 'base64').toString('utf8') }) },
  }
}

const e2eHostPermissions = process.env.HEAR_SAY_E2E === '1' ? [
  `${new URL(process.env.ASR_BASE_URL ?? 'http://localhost:8021/v1').origin}/*`,
  `${new URL(process.env.VOCABULARY_BASE_URL ?? 'https://api.deepseek.com').origin}/*`,
] : undefined
const recordingE2e = process.env.HEAR_SAY_RECORDING_E2E === '1'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [voskMv3Worker()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  }),
  manifest: {
    minimum_chrome_version: '116',
    action: { default_title: 'Hear & Say', default_icon: { 16: '/icon-16.png', 32: '/icon-32.png', 48: '/icon-48.png', 128: '/icon-128.png' } },
    permissions: ['storage', 'tts', 'offscreen', 'tabs', 'contextMenus', 'notifications', ...(recordingE2e ? ['tabCapture' as const] : [])],
    optional_permissions: recordingE2e ? undefined : ['tabCapture'],
    host_permissions: e2eHostPermissions,
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self';" },
  },
})
