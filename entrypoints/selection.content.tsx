import { createRoot, type Root } from 'react-dom/client'
import { SelectionTranslator } from '../src/features/library/SelectionTranslator'
import type { WordSource } from '../src/domain/types'
import type { VocabularyLookup, VocabularySelection } from '../src/services/vocabulary-service'
import type { VocabularyMessage, VocabularyMessageResponse } from '../src/services/vocabulary-messages'
import { createVocabularyPopupBoundary, vocabularyResponse } from '../src/services/vocabulary-popup-boundary'

const styles = `
:host{all:initial}.hs-layer{position:fixed;z-index:2147483647;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#27312e}button{font:inherit;cursor:pointer}.selection-translate-trigger>button{padding:8px 13px;border:1px solid #b8d1c7;border-radius:8px;background:#173e36;color:white}.selection-translation{width:320px;padding:16px 18px 18px;border:1px solid #cfe0d9;border-radius:14px;background:#fffefb;box-shadow:0 18px 45px #173e3638;touch-action:none}.selection-translation-drag-handle{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:move;user-select:none}.selection-translation.is-dragging .selection-translation-drag-handle{cursor:grabbing}.selection-brand-lockup,.selection-word-identity,.selection-translation-actions,.selection-dictionary header,.selection-dictionary header>div{display:flex;align-items:center;gap:8px}.selection-brand-lockup{color:#173e36;font-size:15px;font-weight:700}.brand-mark{display:flex;align-items:center;justify-content:center;gap:2px;width:28px;height:28px;border-radius:50%;background:#173e36}.brand-mark i{display:block;width:2px;border-radius:2px;background:#b9e5d3}.brand-mark i:nth-child(1),.brand-mark i:nth-child(4){height:7px}.brand-mark i:nth-child(2){height:17px}.brand-mark i:nth-child(3){height:12px}.selection-word-identity{margin:20px 0 8px}.selection-word-identity strong{color:#173e36;font-size:30px}.selection-word-identity span{color:#71817b}.selection-icon-button,.selection-close-button{display:inline-grid;width:36px;height:36px;place-items:center;border:0;border-radius:8px;background:#edf1ef;color:#52635e}.speaker-icon,.copy-icon{width:18px;height:18px;fill:currentColor}.speaker-icon .speaker-wave,.copy-icon{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.selection-close-button{background:transparent;font-size:24px}.selection-add-button{min-height:36px;padding:8px 11px;border:0;border-radius:8px;background:#173e36;color:#fff;font-weight:700}.selection-definition,.selection-example p{margin:8px 0;line-height:1.55}.selection-definition strong{margin-right:5px;color:#397966}.selection-example{margin-bottom:14px}.selection-example p+p{color:#71817b}.selection-example mark{background:#ffd7e7}.selection-dictionary{padding:14px;border-radius:12px;background:#f1f6f3}.selection-dictionary header{justify-content:space-between}.selection-dictionary header strong{font-size:17px}.selection-dictionary p{margin:10px 0 0;line-height:1.65}
`.replace('.selection-example mark{background:#ffd7e7}', '.selection-example mark{background:transparent;color:#c04c78;font-weight:800;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px}').replace('.selection-definition,.selection-example p{margin:8px 0;line-height:1.55}.selection-definition strong{margin-right:5px;color:#397966}.selection-example{margin-bottom:14px}', '.selection-definition{margin:3px 0 16px;color:#71817b;font-size:13px;line-height:1.5}.selection-definition strong{margin-right:5px;color:#71817b;font-size:12px}.selection-example{margin:0 0 16px;padding:13px 15px;border:1px solid #e1ebe6;border-radius:12px;background:#fbfcfb;color:#52635e;font-size:14px;line-height:1.55}.selection-example p{margin:8px 0}').replace('.selection-dictionary{padding:14px;border-radius:12px;background:#f1f6f3}', '.selection-dictionary{margin-top:2px;padding:16px;border:1px solid #b9e5d3;border-radius:12px;background:#f1f6f3;box-shadow:0 8px 20px #173e3614}').replace('.selection-dictionary header strong{font-size:17px}', '.selection-dictionary header strong{color:#173e36;font-size:19px}')

const selectionStyles = styles.replace('.selection-close-button{background:transparent;font-size:24px}', '.selection-close-button{background:transparent;font-size:24px}.selection-add-button:disabled{background:#b8c3bf!important;color:#fff!important;cursor:not-allowed}')

async function send<T>(message: VocabularyMessage): Promise<T> {
  const response = await browser.runtime.sendMessage(message) as VocabularyMessageResponse<T>
  return vocabularyResponse(response)
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  main() {
    let host: HTMLElement | null = null, root: Root | null = null
    const close = () => { root?.unmount(); host?.remove(); root = null; host = null }
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close() })
    document.addEventListener('mousedown', (event) => { if (host && !event.composedPath().includes(host)) close() })
    document.addEventListener('mouseup', (event) => {
      const target = event.target as HTMLElement | null
      if (!target || target.closest('input,textarea,[contenteditable]:not([contenteditable="false"])') || host?.contains(target)) return
      const selection = getSelection(), term = selection?.toString().trim() ?? ''
      if (!selection || selection.rangeCount === 0 || !term) return close()
      const range = selection.getRangeAt(0), rect = range.getBoundingClientRect()
      const block = (range.commonAncestorContainer.nodeType === Node.TEXT_NODE ? range.commonAncestorContainer.parentElement : range.commonAncestorContainer as Element)?.closest('p,li,blockquote,article,div')
      const blockText = (block?.textContent ?? term).trim()
      let selectedStart = blockText.indexOf(term)
      if (block) {
        const before = document.createRange(); before.selectNodeContents(block); before.setEnd(range.startContainer, range.startOffset)
        selectedStart = before.toString().trimStart().length
      }
      const previousBoundary = Math.max(blockText.lastIndexOf('.', Math.max(0, selectedStart - 1)), blockText.lastIndexOf('!', Math.max(0, selectedStart - 1)), blockText.lastIndexOf('?', Math.max(0, selectedStart - 1)))
      const following = blockText.slice(selectedStart + term.length), nextRelative = following.search(/[.!?]/)
      const sentenceStart = previousBoundary < 0 ? 0 : previousBoundary + 1
      const sentenceEnd = nextRelative < 0 ? blockText.length : selectedStart + term.length + nextRelative + 1
      let sentence = blockText.slice(sentenceStart, sentenceEnd).trim()
      if (sentence.length > 500) { const localStart = Math.max(0, selectedStart - sentenceStart - 220); sentence = sentence.slice(localStart, localStart + 500).trim() }
      close()
      host = document.createElement('hear-say-selection')
      host.style.cssText = `position:fixed;z-index:2147483647;left:${Math.max(8, Math.min(rect.left, innerWidth - 340))}px;top:${Math.min(innerHeight - 90, rect.bottom + 8)}px`
      const shadow = host.attachShadow({ mode: 'open' }), style = document.createElement('style'), mount = document.createElement('div')
      style.textContent = selectionStyles; mount.className = 'hs-layer'; shadow.append(style, mount); document.documentElement.append(host)
      root = createRoot(mount)
      const selected: VocabularySelection = { term, sentence }
      const source: WordSource = { kind: 'web', title: document.title || location.hostname, url: location.href }
      const popup = createVocabularyPopupBoundary(send, selected, source)
      root.render(<SelectionTranslator selection={selected} onLookup={() => popup.lookup()} onAdd={popup.add} onCheckSaved={popup.isSaved} onSpeak={(word) => { void popup.speak(word) }} onOpenSettings={() => { void send({ type: 'vocabulary.openSettings' }) }} onClose={close} />)
    })
  },
})
