import { defineConfig } from 'wxt'
import { fileURLToPath, URL } from 'node:url'

const e2eHostPermissions = process.env.HEAR_SAY_E2E === '1' ? [
  `${new URL(process.env.ASR_BASE_URL ?? 'http://localhost:8021/v1').origin}/*`,
  `${new URL(process.env.VOCABULARY_BASE_URL ?? 'https://api.deepseek.com').origin}/*`,
] : undefined

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  }),
  manifest: {
    action: { default_title: 'Hear & Say' },
    permissions: ['storage', 'tts'],
    host_permissions: e2eHostPermissions,
    optional_host_permissions: ['http://*/*', 'https://*/*'],
  },
})
