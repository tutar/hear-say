import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const extensionPath = resolve('.output/chrome-mv3')
let context: BrowserContext, app: Page, userDataDir: string

test.describe('contextual vocabulary journey', () => {
  test.beforeAll(async () => {
    userDataDir = await mkdtemp(join(tmpdir(), 'hear-say-words-e2e-'))
    context = await chromium.launchPersistentContext(userDataDir, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`] })
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
    app = await context.newPage()
    await app.goto(`chrome-extension://${new URL(worker.url()).host}/app.html`)
    await app.evaluate(async () => {
      const api = (globalThis as unknown as { chrome: { storage: { local: { set: (value: unknown) => Promise<void> } } } }).chrome
      await api.storage.local.set({ vocabularySettings: { baseUrl: 'https://api.deepseek.com', apiKey: 'e2e-key', model: 'deepseek-v4-flash' } })
    })
  })
  test.afterAll(async () => { await context?.close(); if (userDataDir) await rm(userDataDir, { recursive: true, force: true }) })

  test('translates an explicit web selection and saves it to the wordbook', async () => {
    let requests = 0, sentSentence = ''
    await context.route('https://api.deepseek.com/chat/completions', async (route) => { requests += 1; const body = route.request().postDataJSON() as { messages: Array<{ content: string }> }; sentSentence = JSON.parse(body.messages.at(-1)!.content).sentence; await route.fulfill({ json: { choices: [{ message: { content: JSON.stringify({ term: 'record', ipa: '/rɪˈkɔːrd/', partOfSpeech: '动词', meaningZh: '录制', contextExplanationZh: '这里表示保存声音。' }) } }] } }) })
    await context.route('https://selection.test/article', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Speaking tips</title><p id="sentence">Ignore this opening. Please record a short message for the class. Do not send this ending.</p>' }))
    const article = await context.newPage()
    await article.goto('https://selection.test/article')
    await article.locator('#sentence').evaluate((node) => {
      const text = node.firstChild!, start = text.textContent!.indexOf('record'), range = document.createRange()
      range.setStart(text, start); range.setEnd(text, start + 6)
      const selection = getSelection(); selection?.removeAllRanges(); selection?.addRange(range)
      node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    expect(requests).toBe(0)
    await article.getByRole('button', { name: '翻译 record' }).click()
    await expect(article.getByText('动词 · 录制')).toBeVisible()
    expect(requests).toBe(1)
    expect(sentSentence).toBe('Please record a short message for the class.')
    await article.getByRole('button', { name: '加入生词本' }).click()
    await expect(article.getByRole('button', { name: '加入生词本' })).toHaveText('已加入')

    await app.reload()
    await app.getByRole('button', { name: '单词本' }).click()
    await expect(app.getByText('动词 · 录制')).toBeVisible()
  })
})
