import type { MaterialRepository, MaterialWithSegments } from '../db/material-repository'
import type { NewWordContext, WordRepository } from '../db/word-repository'
import { advanceReview } from '../domain/learning'
import type { Material, Segment, WordEntry } from '../domain/types'
import { LibraryController, type Transcribe } from '../features/library/library-controller'
import { formatWorkspacePlace, parseWorkspaceHash, type WorkspacePlace } from './workspace-routes'

const firstRoundStages = ['blind_listen', 'intensive_listen', 'shadowing', 'retelling', 'complete'] as const

type NavigationWindow = Pick<Window, 'location' | 'history' | 'addEventListener' | 'removeEventListener'>

export type LearningWorkspaceState = {
  place: WorkspacePlace
  materials: Material[]
  dueMaterials: MaterialWithSegments[]
  words: WordEntry[]
  currentMaterial: MaterialWithSegments | null
  currentWord: WordEntry | null
  loading: boolean
  message: string
  transcriptionTasks: ReadonlySet<string>
  sentenceEditActive: boolean
  isImporting: boolean
}

type Dependencies = {
  materialRepository: MaterialRepository
  wordRepository: WordRepository
  navigation: NavigationWindow
  confirmDiscard?: () => boolean
}

const initialState = (place: WorkspacePlace): LearningWorkspaceState => ({
  place, materials: [], dueMaterials: [], words: [], currentMaterial: null, currentWord: null,
  loading: true, message: '', transcriptionTasks: new Set(), sentenceEditActive: false, isImporting: false,
})

export class LearningWorkspace {
  private state: LearningWorkspaceState
  private readonly listeners = new Set<() => void>()
  private resolution = 0
  private started = false
  private stableHash: string
  private readonly onPopState = () => {
    if (!this.allowLeave()) {
      this.dependencies.navigation.history.pushState(null, '', this.stableHash)
      return
    }
    void this.resolveLocation()
  }
  private readonly onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!this.state.sentenceEditActive) return
    event.preventDefault()
    event.returnValue = ''
  }

  constructor(private readonly dependencies: Dependencies) {
    const parsed = parseWorkspaceHash(dependencies.navigation.location.hash)
    this.state = initialState(parsed.place)
    this.stableHash = parsed.canonicalHash
  }

  getState = (): LearningWorkspaceState => this.state
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener) }

  async start(): Promise<void> {
    if (!this.started) {
      this.started = true
      this.dependencies.navigation.addEventListener('popstate', this.onPopState)
      this.dependencies.navigation.addEventListener('beforeunload', this.onBeforeUnload)
    }
    await this.resolveLocation()
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    this.dependencies.navigation.removeEventListener('popstate', this.onPopState)
    this.dependencies.navigation.removeEventListener('beforeunload', this.onBeforeUnload)
  }

  async go(place: WorkspacePlace): Promise<void> {
    const hash = formatWorkspacePlace(place)
    if (hash === this.dependencies.navigation.location.hash) return
    if (!this.allowLeave()) return
    this.dependencies.navigation.history.pushState(null, '', hash)
    await this.resolveLocation()
  }

  async refresh(): Promise<void> { await this.resolveLocation(false, true) }

  async renameMaterial(materialId: string, title: string): Promise<void> { await this.dependencies.materialRepository.renameMaterial(materialId, title); await this.refresh() }
  async deleteMaterial(materialId: string): Promise<void> { await this.dependencies.materialRepository.deleteMaterial(materialId); await this.refresh() }
  async setMaterialFavorite(materialId: string, value: boolean): Promise<void> { await this.dependencies.materialRepository.setFavorite(materialId, value); await this.refresh() }
  async setMaterialTags(materialId: string, tags: string[]): Promise<void> { await this.dependencies.materialRepository.setTags(materialId, tags); await this.refresh() }
  async resetMaterialProgress(materialId: string): Promise<void> { await this.dependencies.materialRepository.resetLearningProgress(materialId); await this.refresh() }
  async savePractice(material: Material): Promise<void> { await this.dependencies.materialRepository.saveMaterial(material); await this.refresh() }
  async saveSegments(materialId: string, segments: Segment[]): Promise<void> {
    await this.dependencies.materialRepository.replaceSegments(materialId, segments)
    const saved = await this.dependencies.materialRepository.getMaterial(materialId)
    if (!saved) throw new Error('material was not found')
    const current = this.state.currentMaterial?.id === materialId
      ? { ...saved, audioBlob: this.state.currentMaterial.audioBlob }
      : this.state.currentMaterial
    this.update({
      currentMaterial: current,
      materials: this.state.materials.map((material) => material.id === materialId ? { ...saved, audioBlob: material.audioBlob } : material),
      dueMaterials: this.state.dueMaterials.map((material) => material.id === materialId ? { ...saved, audioBlob: material.audioBlob } : material),
    })
  }
  async completeReview(material: Material): Promise<void> {
    await this.dependencies.materialRepository.saveMaterial(advanceReview(material, new Date()))
    await this.refresh()
    await this.go({ kind: 'material', materialId: material.id })
  }
  async materialForExport(materialId: string): Promise<MaterialWithSegments | null> { return this.dependencies.materialRepository.getMaterial(materialId) }
  async addVocabularyContext(input: NewWordContext): Promise<void> { await this.dependencies.wordRepository.addContext(input); await this.refresh() }

  async importAudio(file: File, durationSeconds: number | null, transcribe: Transcribe): Promise<Material> {
    this.update({ message: '正在转写', isImporting: true })
    let pendingId: string | null = null
    try {
      let warning = ''
      const controller = new LibraryController(this.dependencies.materialRepository, transcribe, (message) => { warning = message })
      const material = await controller.importAudio(file, durationSeconds, (pending) => {
        pendingId = pending.id
        this.setTranscriptionTask(pending.id, true)
        void this.refresh()
      })
      this.update({ message: material.status === 'ready' ? warning || '转写完成' : material.transcriptionError ?? '转写失败' })
      await this.refresh()
      return material
    } finally {
      if (pendingId) this.setTranscriptionTask(pendingId, false)
      this.update({ isImporting: false })
    }
  }

  async retryTranscription(materialId: string, transcribe: Transcribe): Promise<Material | null> {
    if (this.state.transcriptionTasks.has(materialId)) return null
    this.setTranscriptionTask(materialId, true)
    this.update({ message: '正在转写' })
    try {
      let warning = ''
      const material = await new LibraryController(this.dependencies.materialRepository, transcribe, (message) => { warning = message }).retry(materialId)
      this.update({ message: material.status === 'ready' ? warning || '转写完成' : material.transcriptionError ?? '转写失败' })
      await this.refresh()
      return material
    } finally { this.setTranscriptionTask(materialId, false) }
  }

  async importSubtitle(materialId: string, file: File): Promise<void> {
    try {
      await new LibraryController(this.dependencies.materialRepository, async () => []).importSubtitle(materialId, await file.text(), file.name.toLowerCase().endsWith('.vtt') ? 'vtt' : 'srt')
      this.update({ message: '字幕已导入' })
      await this.refresh()
    } catch (error) { this.update({ message: error instanceof Error ? error.message : '字幕导入失败' }) }
  }

  setMessage(message: string): void { this.update({ message }) }
  setSentenceEditActive = (active: boolean): void => { this.update({ sentenceEditActive: active }) }

  setTranscriptionTask(materialId: string, active: boolean): void {
    const tasks = new Set(this.state.transcriptionTasks)
    if (active) tasks.add(materialId); else tasks.delete(materialId)
    this.update({ transcriptionTasks: tasks })
  }

  private async resolveLocation(canonicalize = true, preserveCurrent = false): Promise<void> {
    const request = ++this.resolution
    const parsed = parseWorkspaceHash(this.dependencies.navigation.location.hash)
    if (canonicalize && parsed.canonicalHash !== this.dependencies.navigation.location.hash) {
      this.dependencies.navigation.history.replaceState(null, '', parsed.canonicalHash)
    }
    this.stableHash = parsed.canonicalHash
    this.update({
      place: parsed.place,
      loading: true,
      message: parsed.issue ?? this.state.message,
      ...(preserveCurrent ? {} : { currentMaterial: null, currentWord: null }),
    })

    const [materials, dueMaterials, words] = await Promise.all([
      this.dependencies.materialRepository.listMaterials(),
      this.dependencies.materialRepository.listDueMaterials(),
      this.dependencies.wordRepository.listEntries(),
    ])
    if (request !== this.resolution) return

    let currentMaterial: MaterialWithSegments | null = null
    let currentWord: WordEntry | null = null
    const place = parsed.place
    if ('materialId' in place) {
      currentMaterial = await this.dependencies.materialRepository.getMaterial(place.materialId)
      if (request !== this.resolution) return
      if (!currentMaterial) return this.recover({ kind: 'library' }, '该材料已不存在')
      if ((place.kind === 'practice' || place.kind === 'review' || place.kind === 'free-listening' || place.kind === 'stage-review') && currentMaterial.status !== 'ready') {
        return this.recover({ kind: 'material', materialId: place.materialId }, '材料转写完成后才能开始学习')
      }
      if (place.kind === 'review' && (!currentMaterial.nextReviewAt || new Date(currentMaterial.nextReviewAt) > new Date())) {
        return this.recover({ kind: 'material', materialId: place.materialId }, '该材料尚未到复习时间')
      }
      if (place.kind === 'stage-review' && firstRoundStages.indexOf(place.stage) >= firstRoundStages.indexOf(currentMaterial.firstRoundStage)) {
        return this.recover({ kind: 'material', materialId: place.materialId }, '该阶段尚未完成')
      }
    } else if (place.kind === 'word') {
      currentWord = await this.dependencies.wordRepository.getEntry(place.wordId)
      if (request !== this.resolution) return
      if (!currentWord) return this.recover({ kind: 'words' }, '该单词已不存在')
    }
    this.state = { ...this.state, place, materials, dueMaterials, words, currentMaterial, currentWord, loading: false }
    this.emit()
  }

  private async recover(place: WorkspacePlace, message: string): Promise<void> {
    this.dependencies.navigation.history.replaceState(null, '', formatWorkspacePlace(place))
    this.stableHash = formatWorkspacePlace(place)
    this.update({ place, message, loading: false, currentMaterial: null, currentWord: null })
  }

  private update(changes: Partial<LearningWorkspaceState>): void { this.state = { ...this.state, ...changes }; this.emit() }
  private emit(): void { this.listeners.forEach((listener) => listener()) }
  private allowLeave(): boolean {
    if (!this.state.sentenceEditActive) return true
    if (!(this.dependencies.confirmDiscard?.() ?? true)) return false
    this.update({ sentenceEditActive: false })
    return true
  }
}
