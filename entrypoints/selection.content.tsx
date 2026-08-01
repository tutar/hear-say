import { createRoot, type Root } from 'react-dom/client'
import { SelectionTranslator } from '../src/features/library/SelectionTranslator'
import type { WordSource } from '../src/domain/types'
import type { VocabularyLookup, VocabularySelection } from '../src/services/vocabulary-service'
import type { VocabularyMessage, VocabularyMessageResponse } from '../src/services/vocabulary-messages'

const styles = `
:host{all:initial}.hs-layer{position:fixed;z-index:2147483647;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#27312e}
button{font:inherit;cursor:pointer}.selection-translate-trigger>button{padding:8px 13px;border:1px solid #b8d1c7;border-radius:8px;background:#173e36;color:white;box-shadow:0 8px 22px #173e3630}
.selection-translation{width:320px;padding:18px;border:1px solid #cfe0d9;border-radius:14px;background:#fff;box-shadow:0 18px 45px #173e3638}.selection-translation header,.selection-translation footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.selection-translation header strong,.selection-translation header span{display:block}.selection-translation header strong{font-size:20px;color:#173e36}.selection-translation header span{margin-top:2px;color:#71817b;font-size:13px}.selection-translation header button{border:0;background:transparent;font-size:20px}.selection-translation p{margin:12px 0;line-height:1.55}.selection-meaning{font-weight:700;color:#397966}.selection-translation small{display:block;color:#84928d;font-size:11px;line-height:1.45}.selection-translation footer{margin-top:16px}.selection-translation footer button{padding:8px 11px;border:1px solid #cfe0d9;border-radius:8px;background:#edf6f2;color:#173e36}.selection-translation footer button:last-child{border-color:#173e36;background:#173e36;color:#fff}
`

async function send<T>(message: VocabularyMessage): Promise<T> {
  const response = await browser.runtime.sendMessage(message) as VocabularyMessageResponse<T>
  if (!response.ok) throw new Error(response.error)
  return response.data
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
      style.textContent = styles; mount.className = 'hs-layer'; shadow.append(style, mount); document.documentElement.append(host)
      root = createRoot(mount)
      const selected: VocabularySelection = { term, sentence }
      const source: WordSource = { kind: 'web', title: document.title || location.hostname, url: location.href }
      root.render(<SelectionTranslator selection={selected} onLookup={(value) => send<VocabularyLookup>({ type: 'vocabulary.lookup', selection: value })} onAdd={(lookup) => send({ type: 'vocabulary.add', selection: selected, lookup, source })} onSpeak={(word) => { void send({ type: 'vocabulary.speak', term: word }) }} onOpenSettings={() => { void send({ type: 'vocabulary.openSettings' }) }} onClose={close} />)
    })
  },
})
