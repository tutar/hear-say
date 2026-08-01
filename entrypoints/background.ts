import { WordRepository } from '../src/db/word-repository'
import { createDeepSeekExplainer } from '../src/services/deepseek-client'
import { loadVocabularySettings } from '../src/services/settings'
import { VocabularyService } from '../src/services/vocabulary-service'
import type { VocabularyMessage, VocabularyMessageResponse } from '../src/services/vocabulary-messages'

export default defineBackground(() => {
  browser.action.onClicked.addListener(async () => {
    await browser.tabs.create({ url: browser.runtime.getURL('/app.html') })
  })

  browser.runtime.onMessage.addListener(async (message: VocabularyMessage, sender): Promise<VocabularyMessageResponse> => {
    try {
      const repository = new WordRepository()
      if (message.type === 'vocabulary.lookup') {
        const settings = await loadVocabularySettings()
        const origin = `${new URL(settings.baseUrl).origin}/*`
        if (!await browser.permissions.contains({ origins: [origin] })) throw new Error('请先在 AI 服务设置中保存并授权词汇解释服务')
        const service = new VocabularyService(repository, createDeepSeekExplainer(settings))
        return { ok: true, data: await service.lookup(message.selection) }
      }
      if (message.type === 'vocabulary.add') {
        const entry = await repository.addContext({ ...message.lookup, sentence: message.selection.sentence, source: message.source })
        return { ok: true, data: entry }
      }
      if (message.type === 'vocabulary.speak') {
        browser.tts.stop()
        await browser.tts.speak(message.term, { lang: 'en-US', enqueue: false })
        return { ok: true, data: null }
      }
      if (message.type === 'vocabulary.stop') { browser.tts.stop(); return { ok: true, data: null } }
      if (message.type === 'vocabulary.openSettings') {
        await browser.tabs.create({ url: browser.runtime.getURL('/app.html#settings') })
        return { ok: true, data: null }
      }
      return { ok: false, error: '不支持的词汇操作' }
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : '词汇操作失败' } }
  })
})
