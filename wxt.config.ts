import { defineConfig } from 'wxt'
import { fileURLToPath, URL } from 'node:url'

const e2eHostPermissions = process.env.HEAR_SAY_E2E === '1' ? [
  `${new URL(process.env.ASR_BASE_URL ?? 'http://localhost:8021/v1').origin}/*`,
  `${new URL(process.env.VOCABULARY_BASE_URL ?? 'https://api.deepseek.com').origin}/*`,
] : undefined
const recordingE2e = process.env.HEAR_SAY_RECORDING_E2E === '1'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
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
  },
})
