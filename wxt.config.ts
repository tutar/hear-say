import { defineConfig } from 'wxt'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  }),
  manifest: {
    action: { default_title: 'Hear & Say' },
    permissions: ['storage'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
  },
})
