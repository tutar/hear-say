import { describe, expect, it, vi } from 'vitest'
import { openOrFocusAppTab } from '@/services/app-tab'

describe('openOrFocusAppTab', () => {
  it('focuses an existing Hear & Say tab', async () => {
    const tabs = { query: vi.fn(async () => [{ id: 7, windowId: 3 }]), update: vi.fn(async () => undefined), create: vi.fn() }
    const windows = { update: vi.fn(async () => undefined) }
    await openOrFocusAppTab({ tabs, windows, runtime: { getURL: () => 'chrome-extension://id/app.html' } })

    expect(tabs.update).toHaveBeenCalledWith(7, { active: true })
    expect(windows.update).toHaveBeenCalledWith(3, { focused: true })
    expect(tabs.create).not.toHaveBeenCalled()
  })

  it('creates the app tab when none exists', async () => {
    const tabs = { query: vi.fn(async () => []), update: vi.fn(), create: vi.fn(async () => undefined) }
    await openOrFocusAppTab({ tabs, windows: { update: vi.fn() }, runtime: { getURL: () => 'chrome-extension://id/app.html' } })
    expect(tabs.create).toHaveBeenCalledWith({ url: 'chrome-extension://id/app.html' })
  })

  it('navigates an existing app tab to a requested workspace place', async () => {
    const tabs = { query: vi.fn(async () => [{ id: 7, windowId: 3 }]), update: vi.fn(async () => undefined), create: vi.fn() }
    await openOrFocusAppTab({ tabs, windows: { update: vi.fn(async () => undefined) }, runtime: { getURL: (path) => `chrome-extension://id${path}` } }, '#/settings')
    expect(tabs.update).toHaveBeenCalledWith(7, { active: true, url: 'chrome-extension://id/app.html#/settings' })
  })
})
