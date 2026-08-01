import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const extensionPath = resolve('.output/chrome-mv3')
const audioFixture = resolve('e2e/fixtures/english-sample.wav')

let context: BrowserContext
let page: Page
let userDataDir: string

test.describe.serial('audio learning journey', () => {
  test.beforeAll(async () => {
    userDataDir = await mkdtemp(join(tmpdir(), 'hear-say-e2e-'))
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    })

    let serviceWorker = context.serviceWorkers()[0]
    if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker')
    const extensionId = new URL(serviceWorker.url()).host
    page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/app.html`)
    await page.evaluate(async () => {
      const api = (globalThis as unknown as { chrome: { storage: { local: { set: (value: unknown) => Promise<void> } } } }).chrome
      await api.storage.local.set({ vocabularySettings: { baseUrl: 'https://api.deepseek.com', apiKey: 'e2e-key', model: 'deepseek-v4-flash' } })
    })
    await page.reload()

  })

  test.afterAll(async () => {
    await context?.close()
    if (userDataDir) await rm(userDataDir, { recursive: true, force: true })
  })

  test('imports an audio file through the local FunASR service', async () => {
    await page.getByRole('button', { name: '资料库' }).click()
    await page.getByLabel('选择音频文件').setInputFiles(audioFixture)

    await expect(page.getByRole('status')).toContainText('正在转写音频')
    await expect(page.getByRole('button', { name: '打开 english-sample.wav' })).toBeVisible({ timeout: 300_000 })
    await expect(page.getByText('字幕就绪')).toBeVisible()
  })

  test('opens material details before entering the learning flow', async () => {
    await page.getByRole('button', { name: '打开 english-sample.wav' }).click()
    await expect(page.getByRole('heading', { name: 'english-sample.wav' })).toBeVisible()
    await expect(page.getByRole('region', { name: '学习进度' })).toBeVisible()

    await page.getByRole('button', { name: '开始学习' }).click()
    await expect(page.getByRole('heading', { name: 'Blind listening' })).toBeVisible()
    await page.getByRole('button', { name: '完成Blind listening' }).click()
    await expect(page.getByRole('heading', { name: '逐句精听' })).toBeVisible()
  })

  test('supports playback, difficult bookmarks, and independent help controls', async () => {
    const playButton = page.getByRole('button', { name: '播放当前句' })
    await playButton.click()
    await expect(page.getByRole('button', { name: '暂停当前句' })).toBeVisible()
    await page.getByRole('button', { name: '暂停当前句' }).click()
    await expect(playButton).toBeVisible()

    const bookmark = page.getByRole('button', { name: '收藏为难句' })
    await bookmark.click()
    await expect(page.getByRole('button', { name: '取消难句收藏' })).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: /听不太懂/ }).click()
    const analysis = page.getByRole('button', { name: '解析' })
    const translation = page.getByRole('button', { name: '翻译' })
    const chunks = page.getByRole('button', { name: '意群' })
    await expect(analysis).toHaveAttribute('aria-pressed', 'true')
    await translation.click()
    await chunks.click()
    await expect(translation).toHaveAttribute('aria-pressed', 'true')
    await expect(chunks).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('heading', { name: '翻译' })).toBeVisible()
    await expect(page.locator('.sentence-transcript mark').first()).toBeVisible()

    await translation.click()
    await expect(page.getByRole('heading', { name: '翻译' })).toHaveCount(0)
    await expect(analysis).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.analysis-sheet')).toBeVisible()
  })

  test('translates a selected intensive-listening term and adds it to the wordbook', async () => {
    let selectedTerm = ''
    await context.route('https://api.deepseek.com/chat/completions', async (route) => {
      const body = route.request().postDataJSON() as { messages: Array<{ role: string; content: string }> }
      selectedTerm = JSON.parse(body.messages.at(-1)!.content).selectedTerm
      await route.fulfill({ json: { choices: [{ message: { content: JSON.stringify({ term: selectedTerm, ipa: '/test/', partOfSpeech: '名词', meaningZh: '测试释义', contextExplanationZh: '来自逐句精听原句。' }) } }] } })
    })
    const transcript = page.locator('.sentence-transcript').first()
    selectedTerm = await transcript.evaluate((node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
      let textNode: Node | null = null, match: RegExpExecArray | null = null
      while ((textNode = walker.nextNode())) { match = /[A-Za-z]{2,}/.exec(textNode.textContent ?? ''); if (match) break }
      if (!textNode || !match) throw new Error('Transcript has no selectable English term')
      const range = document.createRange(); range.setStart(textNode, match.index); range.setEnd(textNode, match.index + match[0].length)
      const selection = getSelection(); selection?.removeAllRanges(); selection?.addRange(range)
      node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      return match[0]
    })
    await page.getByRole('button', { name: `翻译 ${selectedTerm}` }).click()
    await expect(page.getByText('名词 · 测试释义')).toBeVisible()
    await page.getByRole('button', { name: '加入生词本' }).click()
    await expect(page.getByRole('button', { name: '加入生词本' })).toHaveText('已加入')
  })
})
