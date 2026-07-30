import { useEffect, useMemo, useState } from 'react'
import { MaterialRepository, type MaterialWithSegments } from '../db/material-repository'
import { advanceReview } from '../domain/learning'
import type { AsrSettings, Material } from '../domain/types'
import { AsrSettingsForm } from '../features/library/AsrSettingsForm'
import { AudioImportControl } from '../features/library/AudioImportControl'
import { LibraryController } from '../features/library/library-controller'
import { MaterialRow } from '../features/library/MaterialRow'
import { PracticeFlow } from '../features/practice/PracticeFlow'
import { ReviewQueue } from '../features/practice/ReviewQueue'
import { transcribeAudio } from '../services/asr-client'
import { DEFAULT_ASR_SETTINGS, loadAsrSettings, saveAsrSettings } from '../services/settings'

async function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    const finish = (duration: number | null) => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(duration) && duration! > 0 ? duration : null)
    }
    audio.addEventListener('loadedmetadata', () => finish(audio.duration), { once: true })
    audio.addEventListener('error', () => finish(null), { once: true })
    audio.src = url
  })
}

export function App() {
  const repository = useMemo(() => new MaterialRepository(), [])
  const [materials, setMaterials] = useState<Material[]>([])
  const [dueMaterials, setDueMaterials] = useState<MaterialWithSegments[]>([])
  const [libraryLoaded, setLibraryLoaded] = useState(false)
  const [active, setActive] = useState<MaterialWithSegments | null>(null)
  const [isReview, setIsReview] = useState(false)
  const [message, setMessage] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [asrSettings, setAsrSettings] = useState<AsrSettings>(DEFAULT_ASR_SETTINGS)

  const refresh = async () => {
    const [allMaterials, due] = await Promise.all([repository.listMaterials(), repository.listDueMaterials()])
    setMaterials(allMaterials)
    setDueMaterials(due)
  }
  useEffect(() => {
    let mounted = true
    void Promise.all([repository.listMaterials(), repository.listDueMaterials()]).then(([loaded, due]) => {
      if (!mounted) return
      setMaterials(loaded)
      setDueMaterials(due)
      setLibraryLoaded(true)
    })
    return () => { mounted = false }
  }, [repository])
  useEffect(() => {
    if (typeof browser === 'undefined') return
    void loadAsrSettings().then(setAsrSettings)
  }, [])

  async function importFile(file: File) {
    setIsImporting(true)
    setMessage('Transcribing')
    try {
      const material = await asrController().importAudio(file, await readAudioDuration(file))
      setMessage(material.status === 'ready' ? 'Ready' : material.transcriptionError ?? 'Transcription failed')
      await refresh()
    } finally {
      setIsImporting(false)
    }
  }

  function asrController() {
    return new LibraryController(repository, async (input) => {
      return transcribeAudio({ ...input, settings: asrSettings })
    })
  }

  async function saveSettings(settings: AsrSettings) {
    await saveAsrSettings(settings)
    setAsrSettings(settings)
    setMessage('转写设置已保存')
  }

  async function retryMaterial(id: string) {
    setMessage('Transcribing')
    const material = await asrController().retry(id)
    setMessage(material.status === 'ready' ? 'Ready' : material.transcriptionError ?? 'Transcription failed')
    await refresh()
  }

  async function importSubtitle(id: string, file: File) {
    try {
      await asrController().importSubtitle(id, await file.text(), file.name.toLowerCase().endsWith('.vtt') ? 'vtt' : 'srt')
      setMessage('Subtitle imported')
      await refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Subtitle import failed') }
  }

  async function renameMaterial(id: string, title: string) {
    await repository.renameMaterial(id, title)
    await refresh()
  }

  async function deleteMaterial(id: string) {
    await repository.deleteMaterial(id)
    await refresh()
  }

  async function openPractice(id: string, review = false) {
    setIsReview(review)
    setActive(await repository.getMaterial(id))
  }

  async function persistPractice(material: Material) {
    await repository.saveMaterial(material)
    await refresh()
    setActive(await repository.getMaterial(material.id))
  }

  async function persistSegments(segments: import('../domain/types').Segment[]) {
    if (!active) return
    await repository.replaceSegments(active.id, segments)
    setActive(await repository.getMaterial(active.id))
  }

  async function completeReview(material: Material) {
    const updated = advanceReview(material, new Date())
    await repository.saveMaterial(updated)
    await refresh()
    setIsReview(false)
    setActive(await repository.getMaterial(material.id))
  }

  if (active) {
    return <main className="app-shell practice-page"><header className="practice-header"><button className="back-link" type="button" onClick={() => { setIsReview(false); setActive(null) }}>← 返回材料库</button><p className="eyebrow">正在练习</p><h1>{active.title}</h1></header><PracticeFlow material={active} segments={active.segments} onComplete={(material) => void persistPractice(material)} onSegmentsSaved={(segments) => void persistSegments(segments)} onCompleteReview={isReview ? (material) => void completeReview(material) : undefined} /></main>
  }

  return (
    <main className="app-shell library-page">
      <header className="app-header">
        <p className="eyebrow">Private listening desk</p>
        <h1>Hear &amp; Say</h1>
        <p className="header-lede">把一段真实英语，练成你能听懂、能开口说的内容。</p>
        <div className="stage-rail" aria-label="学习路径"><span>听</span><i /><span>看</span><i /><span>跟</span><i /><span>说</span></div>
      </header>
      <section className="import-panel">
        <div><p className="eyebrow">新材料</p><h2>从一段音频开始</h2><p>只上传你主动选择的文件；音频和学习记录都保留在本机。</p></div>
        <AudioImportControl isImporting={isImporting} onSelectFile={(file) => void importFile(file)} />
        {message && <p role="status">{message}</p>}
      </section>
      <AsrSettingsForm settings={asrSettings} onSave={(settings) => void saveSettings(settings)} />
      <ReviewQueue materials={dueMaterials} onOpenMaterial={(id) => void openPractice(id, true)} />
      <section className="library-section">
        <div className="section-heading"><div><p className="eyebrow">材料库</p><h2>今天的听说素材</h2></div><span>{materials.length} 段</span></div>
        {!libraryLoaded ? <p className="empty-state">正在读取本地材料…</p> : materials.length === 0 ? <p className="empty-state">还没有材料。选一段你真想听懂的英语音频，从这里开始。</p> : <ul className="material-list">{materials.map((material) => <MaterialRow key={material.id} material={material} onRename={renameMaterial} onDelete={deleteMaterial} actions={material.status === 'ready' ? <button className="primary-action" type="button" onClick={() => void openPractice(material.id)}>开始练习 →</button> : <div className="recovery-actions"><button type="button" onClick={() => void retryMaterial(material.id)}>重新转写</button><label>导入字幕<input aria-label={`SRT or VTT subtitle for ${material.title}`} type="file" accept=".srt,.vtt,text/vtt" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importSubtitle(material.id, file) }} /></label></div>} />)}</ul>}
      </section>
    </main>
  )
}
