import { useEffect, useMemo, useState } from 'react'
import { MaterialRepository, type MaterialWithSegments } from '../db/material-repository'
import { advanceReview } from '../domain/learning'
import type { AsrSettings, Material } from '../domain/types'
import { AsrSettingsForm } from '../features/library/AsrSettingsForm'
import { AudioImportControl } from '../features/library/AudioImportControl'
import { LibraryController } from '../features/library/library-controller'
import { MaterialRow } from '../features/library/MaterialRow'
import { Wordbook } from '../features/library/Wordbook'
import { toExportData } from '../features/library/material-export'
import { PracticeFlow } from '../features/practice/PracticeFlow'
import { MaterialOverview } from '../features/practice/MaterialOverview'
import { LearningDashboard } from '../features/practice/LearningDashboard'
import { transcribeAudio } from '../services/asr-client'
import { DEFAULT_ASR_SETTINGS, loadAsrSettings, saveAsrSettings } from '../services/settings'

type PrimarySection = 'learning' | 'library' | 'words' | 'settings'
type ViewSnapshot = { active: MaterialWithSegments | null; overview: MaterialWithSegments | null; isReview: boolean; subtitleEditor: boolean; primarySection: PrimarySection }
function NavigationControls({ canBack, canForward, onBack, onForward }: { canBack: boolean; canForward: boolean; onBack: () => void; onForward: () => void }) {
  return <nav className="app-navigation" aria-label="页面导航"><button type="button" aria-label="后退" disabled={!canBack} onClick={onBack}>←</button><button type="button" aria-label="前进" disabled={!canForward} onClick={onForward}>→</button></nav>
}

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
  const [expandedMaterials, setExpandedMaterials] = useState<MaterialWithSegments[]>([])
  const [libraryLoaded, setLibraryLoaded] = useState(false)
  const [active, setActive] = useState<MaterialWithSegments | null>(null)
  const [overview, setOverview] = useState<MaterialWithSegments | null>(null)
  const [isReview, setIsReview] = useState(false)
  const [subtitleEditor, setSubtitleEditor] = useState(false)
  const [message, setMessage] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [asrSettings, setAsrSettings] = useState<AsrSettings>(DEFAULT_ASR_SETTINGS)
  const [pastViews, setPastViews] = useState<ViewSnapshot[]>([])
  const [futureViews, setFutureViews] = useState<ViewSnapshot[]>([])
  const [primarySection, setPrimarySection] = useState<PrimarySection>('learning')
  const [profileMenu, setProfileMenu] = useState(false)

  const currentView = (): ViewSnapshot => ({ active, overview, isReview, subtitleEditor, primarySection })
  const applyView = (view: ViewSnapshot) => { setActive(view.active); setOverview(view.overview); setIsReview(view.isReview); setSubtitleEditor(view.subtitleEditor); setPrimarySection(view.primarySection) }
  const navigate = (view: ViewSnapshot) => { setPastViews([...pastViews, currentView()]); setFutureViews([]); applyView(view) }
  const goBack = () => {
    const previous = pastViews.at(-1)
    if (!previous) return
    setPastViews(pastViews.slice(0, -1))
    setFutureViews([currentView(), ...futureViews])
    applyView(previous)
  }
  const goForward = () => {
    const next = futureViews[0]
    if (!next) return
    setPastViews([...pastViews, currentView()])
    setFutureViews(futureViews.slice(1))
    applyView(next)
  }
  const navigation = <NavigationControls canBack={pastViews.length > 0} canForward={futureViews.length > 0} onBack={goBack} onForward={goForward} />
  const openSection = (section: PrimarySection) => navigate({ active: null, overview: null, isReview: false, subtitleEditor: false, primarySection: section })

  const refresh = async () => {
    const [allMaterials, due] = await Promise.all([repository.listMaterials(), repository.listDueMaterials()])
    setMaterials(allMaterials)
    setDueMaterials(due)
    const expanded = await Promise.all(allMaterials.map((material) => repository.getMaterial(material.id)))
    setExpandedMaterials(expanded.filter((material): material is MaterialWithSegments => material !== null))
  }
  useEffect(() => {
    let mounted = true
    void Promise.all([repository.listMaterials(), repository.listDueMaterials()]).then(([loaded, due]) => {
      if (!mounted) return
      setMaterials(loaded)
      setDueMaterials(due)
      setLibraryLoaded(true)
      void Promise.all(loaded.map((material) => repository.getMaterial(material.id))).then((expanded) => setExpandedMaterials(expanded.filter((material): material is MaterialWithSegments => material !== null)))
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
  async function toggleFavorite(id: string, value: boolean) { await repository.setFavorite(id, value); await refresh() }
  async function saveTags(id: string, tags: string[]) { await repository.setTags(id, tags); await refresh() }
  async function resetProgress(id: string) { await repository.resetLearningProgress(id); await refresh() }
  async function exportMaterial(id: string) { const material = await repository.getMaterial(id); if (!material) return; const url = URL.createObjectURL(new Blob([JSON.stringify(toExportData(material), null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `${material.title}.json`; link.click(); URL.revokeObjectURL(url) }

  async function openPractice(id: string, review = false) {
    navigate({ active: await repository.getMaterial(id), overview: null, isReview: review, subtitleEditor: false, primarySection })
  }
  async function openOverview(id: string) { navigate({ active: null, overview: await repository.getMaterial(id), isReview: false, subtitleEditor: false, primarySection }) }
  async function manageSubtitles(id: string) { navigate({ active: await repository.getMaterial(id), overview: null, isReview: false, subtitleEditor: true, primarySection }) }

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

  const siteHeader = <div className="brand-lockup">
    <div className="brand-tools"><button className="brand-home" type="button" aria-label="返回学习首页" onClick={() => openSection('learning')}><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span><small>Private listening desk</small><h1>Hear &amp; Say</h1></span></button>{navigation}</div>
    <div className="header-actions"><nav className="primary-navigation" aria-label="主菜单"><button className={primarySection === 'learning' ? 'active' : ''} type="button" onClick={() => openSection('learning')}>学习</button><button className={primarySection === 'library' ? 'active' : ''} type="button" onClick={() => openSection('library')}>资料库</button><button className={primarySection === 'words' ? 'active' : ''} type="button" onClick={() => openSection('words')}>单词本</button></nav><div className="profile-control" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setProfileMenu(false) }}><button className="avatar-button" type="button" aria-label="打开个人菜单" aria-expanded={profileMenu} onClick={() => setProfileMenu(!profileMenu)}><span aria-hidden="true">HS</span></button>{profileMenu && <div className="profile-menu" role="menu"><div><strong>Hear &amp; Say</strong><small>所有数据保存在本机</small></div><button role="menuitem" onClick={() => { setProfileMenu(false); openSection('settings') }}>转写设置</button><button role="menuitem" onClick={() => { setProfileMenu(false); openSection('library') }}>管理资料</button></div>}</div></div>
  </div>

  if (active) {
    if (!subtitleEditor && active.firstRoundStage === 'intensive_listen') return <><header className="global-page-header">{siteHeader}</header><PracticeFlow material={active} segments={active.segments} navigation={<span />} onExit={goBack} onComplete={(material) => void persistPractice(material)} onSegmentsSaved={(segments) => void persistSegments(segments)} /></>
    return <main className="app-shell practice-page"><header className="app-header">{siteHeader}</header><header className="practice-header"><p className="eyebrow">{subtitleEditor ? '管理字幕' : '正在练习'}</p><h1>{active.title}</h1></header><PracticeFlow material={active} segments={active.segments} editorOnly={subtitleEditor} navigation={<span />} onExit={goBack} onComplete={(material) => void persistPractice(material)} onSegmentsSaved={(segments) => void persistSegments(segments)} onCompleteReview={isReview ? (material) => void completeReview(material) : undefined} /></main>
  }

  if (overview) {
    return <><header className="global-page-header">{siteHeader}</header><MaterialOverview material={overview} navigation={<span />} onBack={goBack} onContinue={() => navigate({ active: overview, overview: null, isReview: false, subtitleEditor: false, primarySection })} /></>
  }

  return (
    <main className="app-shell library-page">
      <header className="app-header">
        {siteHeader}
        {primarySection === 'learning' && <div className="header-intro">
          <p className="header-lede">把一段真实英语，练成你能听懂、能开口说的内容。</p>
          <div className="stage-rail" aria-label="学习路径"><span>听</span><i /><span>看</span><i /><span>跟</span><i /><span>说</span></div>
        </div>}
      </header>
      {primarySection === 'learning' && <LearningDashboard materials={materials} due={dueMaterials} onReview={(id) => void openPractice(id, true)} onOpen={(id) => void openOverview(id)} />}
      {primarySection === 'library' && <section className="library-section" id="material-library">
        <div className="section-heading library-heading">
          <div><p className="eyebrow">材料库 · {materials.length} 段</p><h2>你的听说素材</h2></div>
          <AudioImportControl isImporting={isImporting} onSelectFile={(file) => void importFile(file)} />
        </div>
        {message && !isImporting && <p className="library-status" role="status">{message}</p>}
        {!libraryLoaded ? <p className="empty-state">正在读取本地材料…</p> : materials.length === 0 ? <p className="empty-state">还没有材料。选一段你真想听懂的英语音频，从这里开始。</p> : <ul className="material-list">{materials.map((material) => <MaterialRow key={material.id} material={material} onOpen={(id) => void openOverview(id)} onRename={renameMaterial} onDelete={deleteMaterial} onToggleFavorite={toggleFavorite} availableTags={[...new Set(materials.flatMap((item) => item.tags))]} onSaveTags={saveTags} onExport={(id) => void exportMaterial(id)} onResetProgress={resetProgress} onManageSubtitles={(id) => void manageSubtitles(id)} actions={material.status === 'ready' ? undefined : <div className="recovery-actions"><button type="button" onClick={() => void retryMaterial(material.id)}>重新转写</button><label>导入字幕<input aria-label={`SRT or VTT subtitle for ${material.title}`} type="file" accept=".srt,.vtt,text/vtt" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importSubtitle(material.id, file) }} /></label></div>} />)}</ul>}
      </section>}
      {primarySection === 'words' && <Wordbook materials={expandedMaterials} />}
      {primarySection === 'settings' && <section className="settings-page"><div className="settings-page-heading"><p className="eyebrow">Audio transcription</p><h2>转写设置</h2><p>配置添加音频时使用的语音识别服务。设置仅保存在当前浏览器中。</p></div><AsrSettingsForm settings={asrSettings} onSave={(settings) => void saveSettings(settings)} />{message === '转写设置已保存' && <p className="settings-saved" role="status">设置已保存</p>}</section>}
    </main>
  )
}
