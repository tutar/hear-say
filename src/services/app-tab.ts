type AppTabBrowser = {
  runtime: {
    getURL: (path: `/app.html${string}`) => string
    getContexts?: (filter: { contextTypes: ['TAB'] }) => Promise<Array<{ contextType: string; documentUrl: string; tabId: number; windowId: number }>>
  }
  tabs: {
    query: (query: { url: string }) => Promise<Array<{ id?: number; windowId?: number }>>
    update: (tabId: number, changes: { active: boolean; url?: string }) => Promise<unknown>
    create: (options: { url: string }) => Promise<unknown>
  }
  windows: { update: (windowId: number, changes: { focused: boolean }) => Promise<unknown> }
}

let pendingOpen: Promise<void> = Promise.resolve()

async function openOrFocus(browserApi: AppTabBrowser, hash: string): Promise<void> {
  const baseUrl = browserApi.runtime.getURL('/app.html')
  const url = browserApi.runtime.getURL(`/app.html${hash}`)
  const contexts = await browserApi.runtime.getContexts?.({ contextTypes: ['TAB'] })
  const appContext = contexts?.find((context) => context.documentUrl.startsWith(baseUrl))
  const [queried] = appContext ? [] : await browserApi.tabs.query({ url: `${baseUrl}*` })
  const existing = appContext ? { id: appContext.tabId, windowId: appContext.windowId } : queried
  if (existing?.id !== undefined) {
    await browserApi.tabs.update(existing.id, { active: true, ...(hash ? { url } : {}) })
    if (existing.windowId !== undefined) await browserApi.windows.update(existing.windowId, { focused: true })
    return
  }
  await browserApi.tabs.create({ url })
}

export function openOrFocusAppTab(browserApi: AppTabBrowser, hash = ''): Promise<void> {
  const operation = pendingOpen.then(() => openOrFocus(browserApi, hash))
  pendingOpen = operation.catch(() => undefined)
  return operation
}
