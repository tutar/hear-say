type AppTabBrowser = {
  runtime: { getURL: (path: `/app.html${string}`) => string }
  tabs: {
    query: (query: { url: string }) => Promise<Array<{ id?: number; windowId?: number }>>
    update: (tabId: number, changes: { active: boolean; url?: string }) => Promise<unknown>
    create: (options: { url: string }) => Promise<unknown>
  }
  windows: { update: (windowId: number, changes: { focused: boolean }) => Promise<unknown> }
}

export async function openOrFocusAppTab(browserApi: AppTabBrowser, hash = ''): Promise<void> {
  const baseUrl = browserApi.runtime.getURL('/app.html')
  const url = browserApi.runtime.getURL(`/app.html${hash}`)
  const [existing] = await browserApi.tabs.query({ url: `${baseUrl}*` })
  if (existing?.id !== undefined) {
    await browserApi.tabs.update(existing.id, { active: true, ...(hash ? { url } : {}) })
    if (existing.windowId !== undefined) await browserApi.windows.update(existing.windowId, { focused: true })
    return
  }
  await browserApi.tabs.create({ url })
}
