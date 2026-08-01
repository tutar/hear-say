export const RECORD_CURRENT_TAB_MENU_ID = 'hear-say-record-current-tab'

type RecordingContextMenuApi = {
  runtime: { onInstalled: { addListener(listener: () => void): void } }
  contextMenus: {
    create(options: { id: string; title: string; contexts: ['all'] }): unknown
    remove(id: string): Promise<unknown>
    onClicked: { addListener(listener: (info: { menuItemId: string | number }, tab?: { id?: number }) => void): void }
  }
  sidePanel: { open(options: { tabId: number }): Promise<void> }
  storage: { local: { set(value: { recordingPanelSource: { tabId: number } }): Promise<void> } }
}

export function registerRecordingContextMenu(api: RecordingContextMenuApi): void {
  api.runtime.onInstalled.addListener(() => {
    void api.contextMenus.remove(RECORD_CURRENT_TAB_MENU_ID).catch(() => undefined).then(() => {
      api.contextMenus.create({
        id: RECORD_CURRENT_TAB_MENU_ID,
        title: '使用 Hear & Say 录制当前标签页',
        contexts: ['all'],
      })
    })
  })

  api.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== RECORD_CURRENT_TAB_MENU_ID || tab?.id === undefined) return
    const tabId = tab.id
    const sourceStored = api.storage.local.set({ recordingPanelSource: { tabId } })
    const panelOpened = api.sidePanel.open({ tabId })
    void Promise.allSettled([sourceStored, panelOpened])
  })
}
