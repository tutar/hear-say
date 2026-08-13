import { test, expect, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test'

declare const chrome: {
  runtime: { sendMessage: (message: unknown) => Promise<unknown> }
  storage: { local: { set: (values: Record<string, unknown>) => Promise<void> } }
}
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

let context: BrowserContext
let page: Page
let userDataDir: string
let worker: Worker

async function seedMaterial(target: Page) {
  await target.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('hear-say'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('materials', 'readwrite')
      transaction.objectStore('materials').put({ id: 'compact-fixture', title: 'The Art of Small Talk', audioBlob: new Blob(['audio'], { type: 'audio/wav' }), durationSeconds: 62, status: 'ready', transcriptionError: null, firstRoundStage: 'retelling', nextReviewAt: null, reviewStep: 0, isFavorite: false, tags: [], createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' })
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })
}

async function setMaterialStage(target: Page, stage: string) {
  await target.evaluate(async (nextStage) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('hear-say'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('materials', 'readwrite'); const store = transaction.objectStore('materials'); const request = store.get('compact-fixture')
      request.onsuccess = () => store.put({ ...request.result, firstRoundStage: nextStage }); request.onerror = () => reject(request.error)
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  }, stage)
}

async function seedAbandonedSession(target: Page) {
  await target.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('hear-say'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('learningSessions', 'readwrite')
      transaction.objectStore('learningSessions').put({ id: 'abandoned-session', materialId: 'compact-fixture', purpose: 'first_round', reviewScheduleId: null, reviewOccurrence: null, stage: 'blind_listen', segmentIndex: 0, playbackRate: 1, loopSegment: true, intensiveProgress: {}, retellKeywords: [], status: 'active', ownerTabId: 'closed-tab', startedAt: '2026-08-01T00:00:00.000Z', lastCheckpointAt: '2026-08-01T00:00:30.000Z', endedAt: null })
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })
}

async function seedIntensiveSegment(target: Page) {
  await setMaterialStage(target, 'intensive_listen')
  await target.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('hear-say'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('segments', 'readwrite')
      transaction.objectStore('segments').put({ id: 'compact-segment', materialId: 'compact-fixture', order: 0, startSeconds: 0, endSeconds: 3, text: 'Listening closely makes every repetition more useful.', isDifficult: false })
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })
}

test.describe('library controls', () => {
  test.beforeAll(async () => {
    userDataDir = await mkdtemp(join(tmpdir(), 'hear-say-library-ui-'))
    context = await chromium.launchPersistentContext(userDataDir, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${resolve('.output/chrome-mv3')}`, `--load-extension=${resolve('.output/chrome-mv3')}`] })
    worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
    page = await context.newPage()
    await page.goto(`chrome-extension://${new URL(worker.url()).host}/app.html#/library`)
  })

  test.afterAll(async () => { await context?.close(); if (userDataDir) await rm(userDataDir, { recursive: true, force: true }) })

  test('reuses the existing app tab from the real extension worker', async () => {
    await page.evaluate(() => chrome.runtime.sendMessage({ type: 'vocabulary.openSettings' }))
    await expect(page).toHaveURL(/#\/settings$/)
    const appPages = context.pages().filter((candidate) => candidate.url().includes('/app.html'))
    expect(appPages).toHaveLength(1)
    await worker.evaluate(() => chrome.storage.local.set({
      asrSettings: { provider: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', apiKey: 'e2e-key', model: 'universal-3-pro', language: 'en' },
      vocabularySettings: { baseUrl: 'https://api.deepseek.com', apiKey: 'e2e-key', model: 'deepseek-v4-flash' },
    }))
  })

  test('centres a clearly visible add-audio glyph', async () => {
    await page.goto(page.url().replace(/#.*$/, '#/library'))
    const result = await page.locator('.file-cta').evaluate((button) => {
      const glyph = button.querySelector<SVGGraphicsElement>('.add-audio-icon')!
      const outer = button.getBoundingClientRect(); const inner = glyph.getBoundingClientRect(); const style = getComputedStyle(glyph)
      const ink = glyph.getBBox()
      return { horizontalOffset: Math.abs((outer.left + outer.width / 2) - (inner.left + inner.width / 2)), verticalOffset: Math.abs((outer.top + outer.height / 2) - (inner.top + inner.height / 2)), inkHorizontalOffset: Math.abs(12 - (ink.x + ink.width / 2)), inkVerticalOffset: Math.abs(12 - (ink.y + ink.height / 2)), color: style.color, strokeWidth: Number.parseFloat(style.strokeWidth) }
    })
    expect(result.horizontalOffset).toBeLessThanOrEqual(.5)
    expect(result.verticalOffset).toBeLessThanOrEqual(.5)
    expect(result.inkHorizontalOffset).toBeLessThanOrEqual(.01)
    expect(result.inkVerticalOffset).toBeLessThanOrEqual(.01)
    expect(result.color).toBe('rgb(255, 255, 255)')
    expect(result.strokeWidth).toBeGreaterThanOrEqual(2.5)
  })

  test('keeps primary pages on one compact visual rhythm', async () => {
    await page.setViewportSize({ width: 1280, height: 720 })

    await page.goto(page.url().replace(/#.*$/, '#/library'))
    const libraryTitleSize = await page.getByRole('heading', { name: '你的听说素材' }).evaluate((heading) => Number.parseFloat(getComputedStyle(heading).fontSize))
    const addAudioSize = await page.locator('.file-cta').evaluate((control) => {
      const box = control.getBoundingClientRect()
      return { width: box.width, height: box.height }
    })

    await page.goto(page.url().replace(/#.*$/, '#/words'))
    const wordbookTitleSize = await page.getByRole('heading', { name: '单词本' }).evaluate((heading) => Number.parseFloat(getComputedStyle(heading).fontSize))

    await page.goto(page.url().replace(/#.*$/, '#/settings'))
    const settingsTitleSize = await page.getByRole('heading', { name: 'AI 服务设置' }).evaluate((heading) => Number.parseFloat(getComputedStyle(heading).fontSize))
    const controls = await page.locator('.ai-service-settings input, .ai-service-settings select').evaluateAll((elements) => elements.map((element) => {
      const style = getComputedStyle(element)
      return {
        height: element.getBoundingClientRect().height,
        radius: style.borderRadius,
        background: style.backgroundColor,
      }
    }))
    const transcriptionNote = await page.locator('.ai-service-settings section').first().locator('form > p').evaluate((note) => {
      const style = getComputedStyle(note)
      return { color: style.color, fontSize: Number.parseFloat(style.fontSize) }
    })

    expect.soft(addAudioSize.width).toBeLessThanOrEqual(44)
    expect.soft(addAudioSize.height).toBeLessThanOrEqual(44)
    expect.soft(Math.max(libraryTitleSize, wordbookTitleSize, settingsTitleSize) - Math.min(libraryTitleSize, wordbookTitleSize, settingsTitleSize)).toBeLessThanOrEqual(1)
    expect.soft(Math.max(...controls.map(({ height }) => height)) - Math.min(...controls.map(({ height }) => height))).toBeLessThanOrEqual(1)
    expect.soft(new Set(controls.map(({ radius }) => radius)).size).toBe(1)
    expect.soft(new Set(controls.map(({ background }) => background)).size).toBe(1)
    expect.soft(transcriptionNote.color).toBe('rgb(101, 117, 111)')
    expect.soft(transcriptionNote.fontSize).toBeLessThanOrEqual(14)

    const transcriptionSection = page.locator('.ai-service-settings section').first()
    await transcriptionSection.getByLabel('API Key').fill('e2e-key')
    await transcriptionSection.getByRole('button', { name: '保存转写设置' }).click()
    await expect(transcriptionSection.getByRole('status')).toHaveText('转写设置已保存')
    await expect(page.locator('.settings-page > .settings-saved')).toHaveCount(0)

    const vocabularySection = page.locator('.ai-service-settings section').nth(1)
    await vocabularySection.getByLabel('DeepSeek API 地址').fill('')
    await vocabularySection.getByLabel('DeepSeek 模型').fill('')
    await vocabularySection.getByLabel('DeepSeek API Key').fill('')
    await vocabularySection.getByRole('button', { name: '保存词汇解释设置' }).click()
    await expect(vocabularySection.getByRole('alert')).toHaveText('请填写 API 地址、模型和 API Key')
    await expect(vocabularySection.getByText('词汇解释设置已保存')).toHaveCount(0)

    await page.setViewportSize({ width: 390, height: 844 })
    for (const place of ['library', 'words', 'settings']) {
      await page.goto(page.url().replace(/#.*$/, `#/${place}`))
      const viewport = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
      expect.soft(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width)
    }
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(page.url().replace(/#.*$/, '#/library'))
  })

  test('keeps material overview as compact as the library list', async () => {
    await page.goto(page.url().replace(/#.*$/, '#/library'))
    await seedMaterial(page)
    await page.reload()
    const row = page.getByRole('button', { name: '打开 The Art of Small Talk' })
    await expect(row).toBeVisible()
    const libraryRowHeight = await row.locator('xpath=..').evaluate((element) => element.getBoundingClientRect().height)
    await row.click()
    await expect(page.getByRole('region', { name: '学习进度' })).toBeVisible()
    const summaryHeight = await page.locator('.overview-summary').evaluate((element) => element.getBoundingClientRect().height)
    const articleHeights = await page.locator('.learning-map .learning-stage-card').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height))
    for (const height of articleHeights) expect(Math.abs(height - libraryRowHeight)).toBeLessThanOrEqual(4)
    expect(summaryHeight).toBeLessThanOrEqual(150)
  })

  test('matches the compact material rhythm on mobile', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(page.url().replace(/#.*$/, '#/library'))
    await seedMaterial(page)
    await page.reload()
    const row = page.getByRole('button', { name: '打开 The Art of Small Talk' })
    await expect(row).toBeVisible()
    const libraryRowHeight = await row.locator('xpath=..').evaluate((element) => element.getBoundingClientRect().height)
    await row.click()
    const summaryHeight = await page.locator('.overview-summary').evaluate((element) => element.getBoundingClientRect().height)
    const articleHeights = await page.locator('.learning-map .learning-stage-card').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height))
    expect(summaryHeight).toBeLessThanOrEqual(150)
    for (const height of articleHeights) {
      expect(height).toBeGreaterThanOrEqual(96)
      expect(height).toBeLessThanOrEqual(libraryRowHeight + 4)
    }
  })

  test('opens the original learning flow from material overview', async () => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(page.url().replace(/#.*$/, '#/library'))
    await seedMaterial(page)
    await setMaterialStage(page, 'blind_listen')
    await page.reload()
    await page.getByRole('button', { name: '打开 The Art of Small Talk' }).click()
    await expect(page).toHaveURL(/#\/materials\/compact-fixture$/)
    await page.getByRole('button', { name: '开始学习' }).click()
    await expect(page).toHaveURL(/#\/materials\/compact-fixture\/practice$/)
    await expect(page.getByRole('heading', { name: 'Blind listening' })).toBeVisible()
    await expect(page.getByRole('button', { name: '完成Blind listening' })).toBeVisible()
  })

  test('does not lose the learning page to an abandoned session owner', async () => {
    await page.goto(page.url().replace(/#.*$/, '#/library'))
    await seedMaterial(page); await setMaterialStage(page, 'blind_listen'); await seedAbandonedSession(page); await page.reload()
    await page.getByRole('button', { name: '打开 The Art of Small Talk' }).click()
    await page.getByRole('button', { name: '开始学习' }).click()
    await expect(page.getByRole('heading', { name: 'Blind listening' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '这个学习过程正在另一个页面中进行' })).toHaveCount(0)
  })

  test('fits intensive listening into a laptop viewport with a centred play mark', async () => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(page.url().replace(/#.*$/, '#/library'))
    await seedMaterial(page); await seedIntensiveSegment(page); await page.reload()
    await page.getByRole('button', { name: '打开 The Art of Small Talk' }).click()
    await page.getByRole('button', { name: '继续学习' }).click()
    await expect(page.getByRole('heading', { name: '逐句精听' })).toBeVisible()
    const speed = page.getByLabel('播放速度')
    await expect(speed.locator('option')).toHaveCount(16)
    await expect(speed.locator('option').first()).toHaveText('0.5×')
    await expect(speed.locator('option').last()).toHaveText('2.0×')
    const speedStyle = await speed.evaluate((select) => { const style = getComputedStyle(select); return { appearance: style.appearance, radius: Number.parseFloat(style.borderRadius), background: style.backgroundColor } })
    expect(speedStyle).toMatchObject({ appearance: 'none', background: 'rgb(255, 255, 255)' })
    expect(speedStyle.radius).toBeGreaterThanOrEqual(8)
    const viewport = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, height: innerHeight }))
    expect(viewport.scrollHeight).toBeLessThanOrEqual(viewport.height + 1)
    const play = page.getByRole('button', { name: '播放当前句' })
    await expect(play.locator('svg')).toHaveCount(1)
    const centreOffset = await play.evaluate((button) => {
      const outer = button.getBoundingClientRect(); const icon = button.querySelector<SVGGraphicsElement>('svg')!; const box = icon.getBBox()
      const centroidX = box.x + box.width / 3
      return Math.abs(12 - centroidX) + Math.abs(12 - (box.y + box.height / 2)) + Math.abs((outer.left + outer.width / 2) - (icon.getBoundingClientRect().left + icon.getBoundingClientRect().width / 2))
    })
    expect(centreOffset).toBeLessThanOrEqual(.1)
  })
})
