import { useEffect, useMemo, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react'
import { MaterialRepository } from '../db/material-repository'
import { WordRepository } from '../db/word-repository'
import { LearningRepository } from '../db/learning-repository'
import type { AsrSettings, Material, ReviewPlan, VocabularySettings, WordSource } from '../domain/types'
import { currentLearningWeek, dailyLearningStats, type DailyLearningStats } from '../domain/learning-stats'
import { completeScheduledReview } from '../domain/review-plan'
import { AiServiceSettings } from '../features/library/AiServiceSettings'
import { AudioImportControl } from '../features/library/AudioImportControl'
import type { Transcribe } from '../features/library/library-controller'
import { MaterialRow } from '../features/library/MaterialRow'
import { Wordbook } from '../features/library/Wordbook'
import { WordDetail } from '../features/library/WordDetail'
import { toExportData } from '../features/library/material-export'
import { PracticeFlow } from '../features/practice/PracticeFlow'
import { MaterialOverview } from '../features/practice/MaterialOverview'
import { LearningDashboard } from '../features/practice/LearningDashboard'
import { LearningSettings } from '../features/practice/LearningSettings'
import { transcribeAudio } from '../services/asr-client'
import { createDeepSeekExplainer } from '../services/deepseek-client'
import { WordSpeaker } from '../services/word-speaker'
import { LearningSessionTracker } from '../services/learning-session-tracker'
import { VocabularyService, type VocabularyLookup, type VocabularySelection } from '../services/vocabulary-service'
import { DEFAULT_ASR_SETTINGS, DEFAULT_VOCABULARY_SETTINGS, loadAsrSettings, loadVocabularySettings, saveAsrSettings, saveVocabularySettings } from '../services/settings'
import { LearningWorkspace } from './learning-workspace'
import { formatWorkspacePlace, type WorkspacePlace } from './workspace-routes'

type PrimarySection = 'learning' | 'library' | 'words' | 'settings'
const primarySectionFor = (place: WorkspacePlace): PrimarySection => {
  if (place.kind === 'word') return 'words'
  if (place.kind === 'material' || place.kind === 'practice' || place.kind === 'review' || place.kind === 'subtitles') return 'library'
  return place.kind === 'learning-settings' ? 'learning' : place.kind
}
function WorkspaceLink({ place, go, children, ...props }: { place: WorkspacePlace; go: (place: WorkspacePlace) => void; children: ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    props.onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    go(place)
  }
  return <a {...props} href={formatWorkspacePlace(place)} onClick={navigate}>{children}</a>
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
  const wordRepository = useMemo(() => new WordRepository(), [])
  const learningRepository = useMemo(() => new LearningRepository(), [])
  const workspace = useMemo(() => new LearningWorkspace({ materialRepository: repository, wordRepository, navigation: window, confirmDiscard: () => confirm('当前句子尚未保存。放弃修改并离开吗？') }), [repository, wordRepository])
  const workspaceState = useSyncExternalStore(workspace.subscribe, workspace.getState)
  const { materials, dueMaterials, words: wordEntries, currentMaterial, currentWord: wordDetail, loading: workspaceLoading, message, isImporting } = workspaceState
  const active = ['practice', 'review', 'subtitles'].includes(workspaceState.place.kind) ? currentMaterial : null
  const overview = workspaceState.place.kind === 'material' ? currentMaterial : null
  const isReview = workspaceState.place.kind === 'review'
  const subtitleEditor = workspaceState.place.kind === 'subtitles'
  const primarySection = primarySectionFor(workspaceState.place)
  const [activeSpokenTerm, setActiveSpokenTerm] = useState<string | null>(null)
  const wordSpeaker = useMemo(() => typeof browser === 'undefined' ? null : new WordSpeaker(browser.tts, setActiveSpokenTerm), [])
  const [asrSettings, setAsrSettings] = useState<AsrSettings>(DEFAULT_ASR_SETTINGS)
  const [vocabularySettings, setVocabularySettings] = useState<VocabularySettings>(DEFAULT_VOCABULARY_SETTINGS)
  const [profileMenu, setProfileMenu] = useState(false)
  const [reviewPlan, setReviewPlan] = useState<ReviewPlan | null>(null)
  const [weekStats, setWeekStats] = useState<DailyLearningStats[]>([])
  const [sessionConflict, setSessionConflict] = useState(false)
  const sessionTracker = useMemo(() => new LearningSessionTracker(learningRepository, sessionStorage.getItem('hear-say-tab-id') ?? (() => { const id = crypto.randomUUID(); sessionStorage.setItem('hear-say-tab-id', id); return id })(), () => setSessionConflict(true)), [learningRepository])

  const navigate = (place: WorkspacePlace) => { void workspace.go(place) }
  const goBack = () => history.back()
  const openSection = (section: PrimarySection) => navigate({ kind: section })
  const refresh = async () => workspace.refresh()
  useEffect(() => {
    void workspace.start()
    const refreshOnFocus = () => { void workspace.refresh() }
    addEventListener('focus', refreshOnFocus)
    return () => { removeEventListener('focus', refreshOnFocus); workspace.stop() }
  }, [workspace])
  useEffect(() => {
    if (typeof browser === 'undefined') return
    void Promise.all([loadAsrSettings(), loadVocabularySettings()]).then(([asr, vocabulary]) => { setAsrSettings(asr); setVocabularySettings(vocabulary) })
  }, [])
  useEffect(() => { void Promise.all([learningRepository.currentReviewPlan(), learningRepository.timeSlices()]).then(([plan, slices]) => { setReviewPlan(plan); setWeekStats(currentLearningWeek(dailyLearningStats(slices), new Date())) }) }, [learningRepository, workspaceState.place])
  useEffect(() => {
    if (!active || subtitleEditor) return
    let disposed = false
    const begin = async () => { const result = await sessionTracker.start(active.id, isReview ? 'review' : 'first_round', isReview || active.firstRoundStage === 'complete' ? 'blind_listen' : active.firstRoundStage, new Date().toISOString()); if (!disposed) setSessionConflict(result.kind === 'owned_elsewhere') }
    void begin()
    const checkpoint = window.setInterval(() => { void sessionTracker.dispatch({ type: 'checkpoint', at: new Date().toISOString() }) }, 30_000)
    const visibility = () => { void sessionTracker.dispatch({ type: 'visibility_changed', visible: !document.hidden, at: new Date().toISOString() }) }
    document.addEventListener('visibilitychange', visibility)
    return () => { disposed = true; clearInterval(checkpoint); document.removeEventListener('visibilitychange', visibility); void sessionTracker.end(new Date().toISOString()) }
  }, [active?.id, isReview, sessionTracker, subtitleEditor])
  useEffect(() => () => sessionTracker.close(), [sessionTracker])

  async function importFile(file: File) {
    await workspace.importAudio(file, await readAudioDuration(file), transcribeWithSettings)
  }

  const transcribeWithSettings: Transcribe = (input) => transcribeAudio({ ...input, settings: asrSettings })

  async function saveSettings(settings: AsrSettings) {
    await saveAsrSettings(settings)
    setAsrSettings(settings)
    workspace.setMessage('转写设置已保存')
  }

  async function saveVocabularyService(settings: VocabularySettings) {
    await ensureVocabularyPermission(settings, true)
    await saveVocabularySettings(settings)
    setVocabularySettings(settings)
    workspace.setMessage('词汇解释设置已保存')
  }

  async function testVocabularyService(settings: VocabularySettings) {
    await ensureVocabularyPermission(settings, true)
    await createDeepSeekExplainer(settings).explain({ term: 'context', sentence: 'Context helps explain meaning.' })
  }

  async function toggleWordSpeech(term: string) {
    if (!wordSpeaker) return
    const next = await wordSpeaker.toggle(term)
    setActiveSpokenTerm(next)
  }

  async function ensureVocabularyPermission(settings: VocabularySettings, request: boolean) {
    if (typeof browser === 'undefined') return
    const origins = [`${new URL(settings.baseUrl).origin}/*`]
    if (request) { if (!await browser.permissions.request({ origins })) throw new Error('未授权访问词汇解释服务'); return }
    if (!await browser.permissions.contains({ origins })) throw new Error('未授权访问词汇解释服务')
  }

  async function lookupSelectedVocabulary(selection: VocabularySelection): Promise<VocabularyLookup> {
    await ensureVocabularyPermission(vocabularySettings, false)
    return new VocabularyService(wordRepository, createDeepSeekExplainer(vocabularySettings)).lookup(selection)
  }

  async function addSelectedVocabulary(selection: VocabularySelection, lookup: VocabularyLookup, source: WordSource) {
    await workspace.addVocabularyContext({ ...lookup, sentence: selection.sentence, source })
  }

  async function openWordSource(source: WordSource) {
    if (source.kind === 'web') { if (typeof browser !== 'undefined') await browser.tabs.create({ url: source.url }); return }
    navigate({ kind: 'material', materialId: source.materialId })
  }

  async function retryMaterial(id: string) {
    await workspace.retryTranscription(id, transcribeWithSettings)
  }

  async function importSubtitle(id: string, file: File) {
    await workspace.importSubtitle(id, file)
  }

  async function renameMaterial(id: string, title: string) {
    await workspace.renameMaterial(id, title)
  }

  async function deleteMaterial(id: string) {
    await workspace.deleteMaterial(id)
  }
  async function toggleFavorite(id: string, value: boolean) { await workspace.setMaterialFavorite(id, value) }
  async function saveTags(id: string, tags: string[]) { await workspace.setMaterialTags(id, tags) }
  async function resetProgress(id: string) { await workspace.resetMaterialProgress(id) }
  async function exportMaterial(id: string) { const material = await workspace.materialForExport(id); if (!material) return; const url = URL.createObjectURL(new Blob([JSON.stringify(toExportData(material), null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `${material.title}.json`; link.click(); URL.revokeObjectURL(url) }

  async function openPractice(id: string, review = false) {
    navigate({ kind: review ? 'review' : 'practice', materialId: id })
  }
  async function openOverview(id: string) { navigate({ kind: 'material', materialId: id }) }
  async function manageSubtitles(id: string) { navigate({ kind: 'subtitles', materialId: id }) }

  async function persistPractice(material: Material) {
    await sessionTracker.dispatch({ type: 'stage_completed', at: new Date().toISOString() })
    if (material.firstRoundStage === 'complete') {
      const schedule = await learningRepository.scheduleMaterial(material.id, material.updatedAt)
      await workspace.savePractice({ ...material, nextReviewAt: schedule.nextReviewAt, reviewStep: schedule.completedCount })
    } else await workspace.savePractice(material)
  }

  async function persistSegments(segments: import('../domain/types').Segment[]) {
    if (!active) return
    await workspace.saveSegments(active.id, segments)
  }

  async function completeReview(material: Material) {
    const schedule = await learningRepository.scheduleForMaterial(material.id)
    if (!schedule) return
    const updated = completeScheduledReview(schedule, new Date().toISOString())
    await learningRepository.saveSchedule(updated)
    await workspace.savePractice({ ...material, nextReviewAt: updated.nextReviewAt, reviewStep: updated.completedCount })
    navigate({ kind: 'material', materialId: material.id })
  }

  const today = (() => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` })()
  const siteHeader = <div className="brand-lockup">
    <div className="brand-tools"><WorkspaceLink className="brand-home" aria-label="返回学习首页" place={{ kind: 'learning' }} go={navigate}><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span><small>Private listening desk</small><h1>Hear &amp; Say</h1></span></WorkspaceLink></div>
    <div className="header-actions">{workspaceState.transcriptionTasks.size > 0 && <WorkspaceLink className="transcription-indicator" place={{ kind: 'library' }} go={navigate}>正在转写 {workspaceState.transcriptionTasks.size} 个材料</WorkspaceLink>}<nav className="primary-navigation" aria-label="主菜单"><WorkspaceLink className={primarySection === 'learning' ? 'active' : ''} place={{ kind: 'learning' }} go={navigate}>学习{dueMaterials.length > 0 && <sup>{dueMaterials.length}</sup>}</WorkspaceLink><WorkspaceLink className={primarySection === 'library' ? 'active' : ''} place={{ kind: 'library' }} go={navigate}>资料库</WorkspaceLink><WorkspaceLink className={primarySection === 'words' ? 'active' : ''} place={{ kind: 'words' }} go={navigate}>单词本</WorkspaceLink></nav><div className="profile-control" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setProfileMenu(false) }}><button className="avatar-button" type="button" aria-label="打开个人菜单" aria-expanded={profileMenu} onClick={() => setProfileMenu(!profileMenu)}><span aria-hidden="true">HS</span></button>{profileMenu && <div className="profile-menu" role="menu"><div><strong>Hear &amp; Say</strong><small>所有数据保存在本机</small></div><WorkspaceLink role="menuitem" place={{ kind: 'settings' }} go={navigate} onClick={() => setProfileMenu(false)}>AI 服务</WorkspaceLink><WorkspaceLink role="menuitem" place={{ kind: 'learning-settings' }} go={navigate} onClick={() => setProfileMenu(false)}>学习设置</WorkspaceLink><WorkspaceLink role="menuitem" place={{ kind: 'library' }} go={navigate} onClick={() => setProfileMenu(false)}>管理资料</WorkspaceLink></div>}</div></div>
  </div>

  if (active) {
    if (sessionConflict && !subtitleEditor) return <><header className="global-page-header">{siteHeader}</header><main className="session-conflict"><p className="eyebrow">Learning session</p><h2>这个学习过程正在另一个页面中进行</h2><p>为避免重复计时，这里暂时保持只读。你可以把控制权转移到当前页面。</p><button className="primary-action" type="button" onClick={async () => { await sessionTracker.start(active.id, isReview ? 'review' : 'first_round', isReview || active.firstRoundStage === 'complete' ? 'blind_listen' : active.firstRoundStage, new Date().toISOString(), true); setSessionConflict(false) }}>在这里继续</button></main></>
    if (!subtitleEditor && active.firstRoundStage === 'intensive_listen') return <><header className="global-page-header">{siteHeader}</header><PracticeFlow material={active} segments={active.segments} navigation={<span />} onExit={goBack} onComplete={(material) => void persistPractice(material)} onSegmentsSaved={persistSegments} onSentenceEditChange={workspace.setSentenceEditActive} onVocabularyLookup={lookupSelectedVocabulary} onVocabularyAdd={addSelectedVocabulary} onVocabularySpeak={(term) => void toggleWordSpeech(term)} onVocabularyOpenSettings={() => openSection('settings')} /></>
    return <main className="app-shell practice-page"><header className="app-header">{siteHeader}</header><header className="practice-header"><p className="eyebrow">{subtitleEditor ? '管理字幕' : '正在练习'}</p><h1>{active.title}</h1></header><PracticeFlow material={active} segments={active.segments} editorOnly={subtitleEditor} navigation={<span />} onExit={goBack} onComplete={(material) => void persistPractice(material)} onSegmentsSaved={persistSegments} onSentenceEditChange={workspace.setSentenceEditActive} onCompleteReview={isReview ? (material) => void completeReview(material) : undefined} onVocabularyLookup={lookupSelectedVocabulary} onVocabularyAdd={addSelectedVocabulary} onVocabularySpeak={(term) => void toggleWordSpeech(term)} /></main>
  }

  if (overview) {
    return <><header className="global-page-header">{siteHeader}</header><MaterialOverview material={overview} navigation={<span />} onBack={goBack} onContinue={() => navigate({ kind: 'practice', materialId: overview.id })} /></>
  }

  if (wordDetail) return <><header className="global-page-header">{siteHeader}</header><WordDetail entry={wordDetail} activeTerm={activeSpokenTerm} onBack={goBack} onSpeak={(term) => void toggleWordSpeech(term)} onOpenSource={(source) => void openWordSource(source)} /></>

  return (
    <main className="app-shell library-page">
      <header className="app-header">
        {siteHeader}
        {primarySection === 'learning' && <div className="header-intro">
          <p className="header-lede">把一段真实英语，练成你能听懂、能开口说的内容。</p>
          <div className="stage-rail" aria-label="学习路径"><span>听</span><i /><span>看</span><i /><span>跟</span><i /><span>说</span></div>
        </div>}
      </header>
      {workspaceState.place.kind === 'learning' && <LearningDashboard materials={materials} due={dueMaterials} weekStats={weekStats} today={today} onReview={(id) => void openPractice(id, true)} onOpen={(id) => void openOverview(id)} />}
      {workspaceState.place.kind === 'learning-settings' && reviewPlan && <LearningSettings plan={reviewPlan} onSave={async (intervals) => { const plan = await learningRepository.createNextReviewPlan(intervals); setReviewPlan(plan); workspace.setMessage('学习设置已保存') }} />}
      {primarySection === 'library' && <section className="library-section" id="material-library">
        <div className="section-heading library-heading">
          <div><p className="eyebrow">材料库 · {materials.length} 段</p><h2>你的听说素材</h2></div>
          <AudioImportControl isImporting={isImporting} onSelectFile={(file) => void importFile(file)} />
        </div>
        {message && !isImporting && <p className="library-status" role="status">{message}</p>}
        {workspaceLoading ? <p className="empty-state">正在读取本地材料…</p> : materials.length === 0 ? <p className="empty-state">还没有材料。选一段你真想听懂的英语音频，从这里开始。</p> : <ul className="material-list">{materials.map((material) => <MaterialRow key={material.id} material={material} onOpen={(id) => void openOverview(id)} onRename={renameMaterial} onDelete={deleteMaterial} onToggleFavorite={toggleFavorite} availableTags={[...new Set(materials.flatMap((item) => item.tags))]} onSaveTags={saveTags} onExport={(id) => void exportMaterial(id)} onResetProgress={resetProgress} onManageSubtitles={(id) => void manageSubtitles(id)} actions={material.status === 'ready' ? undefined : <div className="recovery-actions"><button type="button" disabled={workspaceState.transcriptionTasks.has(material.id)} onClick={() => void retryMaterial(material.id)}>{workspaceState.transcriptionTasks.has(material.id) ? '正在转写' : '重新转写'}</button><label>导入字幕<input aria-label={`SRT or VTT subtitle for ${material.title}`} type="file" accept=".srt,.vtt,text/vtt" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importSubtitle(material.id, file) }} /></label></div>} />)}</ul>}
      </section>}
      {primarySection === 'words' && <Wordbook entries={wordEntries} activeTerm={activeSpokenTerm} onSpeak={(term) => void toggleWordSpeech(term)} onOpen={(id) => navigate({ kind: 'word', wordId: id })} />}
      {primarySection === 'settings' && <section className="settings-page"><div className="settings-page-heading"><p className="eyebrow">Learning services</p><h2>AI 服务设置</h2><p>配置音频转写和词汇解释所使用的服务。密钥仅保存在当前浏览器。</p></div><AiServiceSettings asr={asrSettings} vocabulary={vocabularySettings} onSaveAsr={(settings) => void saveSettings(settings)} onSaveVocabulary={(settings) => void saveVocabularyService(settings)} onTestVocabulary={testVocabularyService} />{message.endsWith('设置已保存') && <p className="settings-saved" role="status">设置已保存</p>}</section>}
    </main>
  )
}
