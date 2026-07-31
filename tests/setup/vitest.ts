import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

Object.assign(URL, {
  createObjectURL: () => 'blob:test-audio',
  revokeObjectURL: () => undefined,
})
