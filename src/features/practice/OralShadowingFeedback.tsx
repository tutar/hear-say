import { useEffect, useRef, useState } from 'react'
import { compareOralAttempt, type OralAttemptFeedback } from '../../domain/oral-feedback'
import type { OralRecognitionError, OralRecognizer } from '../../services/oral-recognition'
import { DEFAULT_LOCAL_SPEECH_COMPONENT_URL } from '../../services/local-speech-component'

export type PreparedOralRecognizer = OralRecognizer & { prepare(url: string, onProgress: (percentage: number) => void): Promise<void> }
type Props = { sentence: string; recognizer: OralRecognizer | null; localRecognizer?: PreparedOralRecognizer | null; onSkip(): void; autoStartToken?: number }

export function OralShadowingFeedback({ sentence, recognizer, localRecognizer, onSkip, autoStartToken = 0 }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'empty' | 'result' | 'error'>('idle')
  const [partial, setPartial] = useState('')
  const [recognized, setRecognized] = useState('')
  const [feedback, setFeedback] = useState<OralAttemptFeedback | null>(null)
  const [error, setError] = useState<OralRecognitionError | null>(null)
  const [componentUrl, setComponentUrl] = useState(DEFAULT_LOCAL_SPEECH_COMPONENT_URL)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const seenAutoStart = useRef(autoStartToken)

  const start = async () => {
    setPartial(''); setRecognized(''); setFeedback(null); setError(null)
    if (!recognizer) { setError({ kind: 'unavailable', message: 'Online speech recognition is unavailable.' }); setState('error'); return }
    setState('recording')
    await recognizer.start({
      onPartial: setPartial,
      onFinal: (text) => {
        const finalText = text.trim()
        setRecognized(finalText)
        if (!finalText) { setState('empty'); return }
        setFeedback(compareOralAttempt(sentence, finalText)); setState('result')
      },
      onError: (nextError) => { setError(nextError); setState('error') },
    })
  }
  useEffect(() => {
    if (autoStartToken === seenAutoStart.current) return
    seenAutoStart.current = autoStartToken
    void start()
  }, [autoStartToken])
  const downloadAndUse = async () => {
    if (!localRecognizer) return
    setDownloadProgress(0); setError(null)
    try {
      await localRecognizer.prepare(componentUrl, setDownloadProgress)
      setState('recording')
      await localRecognizer.start({ onPartial: setPartial, onFinal: (text) => { const finalText = text.trim(); setRecognized(finalText); if (!finalText) setState('empty'); else { setFeedback(compareOralAttempt(sentence, finalText)); setState('result') } }, onError: (nextError) => { setError(nextError); setState('error') } })
    } catch (cause) {
      setError({ kind: 'unavailable', message: `${cause instanceof Error ? cause.message : 'Download failed.'} Check the component URL and try again.` }); setState('error')
    }
  }

  return <section className="oral-shadowing-feedback" aria-label="跟读识别反馈">
    {state === 'idle' && <button type="button" onClick={() => void start()}>开始跟读录音</button>}
    {state === 'recording' && <><p role="status">正在听…{partial ? ` ${partial}` : ''}</p><button type="button" onClick={() => recognizer?.stop()}>停止录音</button></>}
    {state === 'result' && feedback && <><p>识别结果：{recognized}</p><strong>相似度 {feedback.similarity}%</strong><div className="oral-word-differences">{feedback.words.map((word, index) => <span className={`oral-word-${word.kind}`} key={index}>{word.kind === 'changed' ? `${word.expected} → ${word.actual}` : word.text}</span>)}</div><button type="button" onClick={() => void start()}>再试一次</button></>}
    {state === 'empty' && <><p>没有识别到语音。</p><button type="button" onClick={() => void start()}>再试一次</button><button type="button" onClick={onSkip}>跳过本句</button></>}
    {state === 'error' && error && <><p role="alert">{error.message}</p>{error.kind === 'unavailable' && <><p>Online speech recognition is unavailable. Download a local speech recognition component? It can be used offline after download.</p>{localRecognizer && <><label>本地语音组件地址<input aria-label="本地语音组件地址" type="url" value={componentUrl} onChange={(event) => setComponentUrl(event.target.value)} /></label><button type="button" onClick={() => void downloadAndUse()}>下载并使用</button></>}</>}<button type="button" onClick={() => void start()}>再试一次</button></>}
    {downloadProgress !== null && <p role="status">下载进度 {downloadProgress}%</p>}
  </section>
}
