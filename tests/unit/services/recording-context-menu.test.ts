import { describe, expect, it, vi } from 'vitest'
import { registerRecordingContextMenu } from '@/services/recording-context-menu'

describe('recording context menu', () => {
  it('opens the recording Side Panel for the tab where the learner invoked the menu', async () => {
    let userGestureActive = false
    let openedDuringUserGesture = false
    let installed: (() => void) | undefined
    let clicked: ((info: { menuItemId: string }, tab?: { id?: number }) => void) | undefined
    const api = {
      runtime: { onInstalled: { addListener: (listener: () => void) => { installed = listener } } },
      contextMenus: {
        create: vi.fn(),
        remove: vi.fn(async () => undefined),
        onClicked: { addListener: (listener: typeof clicked) => { clicked = listener } },
      },
      sidePanel: { open: vi.fn(async () => { openedDuringUserGesture = userGestureActive }) },
      storage: { local: { set: vi.fn(async () => undefined) } },
    }

    registerRecordingContextMenu(api)
    installed?.()
    await vi.waitFor(() => expect(api.contextMenus.create).toHaveBeenCalledWith({
      id: 'hear-say-record-current-tab',
      title: '使用 Hear & Say 录制当前标签页',
      contexts: ['all'],
    }))
    userGestureActive = true
    clicked?.({ menuItemId: 'hear-say-record-current-tab' }, { id: 42 })
    userGestureActive = false

    await vi.waitFor(() => expect(api.sidePanel.open).toHaveBeenCalledWith({ tabId: 42 }))
    expect(openedDuringUserGesture).toBe(true)
    expect(api.storage.local.set).toHaveBeenCalledWith({ recordingPanelSource: { tabId: 42 } })
  })
})
