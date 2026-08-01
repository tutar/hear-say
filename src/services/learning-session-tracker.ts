import type { LearningRepository } from '../db/learning-repository'
import { createLearningSession, reduceLearningSession, type SessionEvent, type SessionRuntime } from '../domain/learning-session'
import type { LearningSessionPurpose, LearningStage } from '../domain/types'

export type SessionStartResult = { kind: 'started' | 'resumed'; runtime: SessionRuntime } | { kind: 'owned_elsewhere'; ownerTabId: string }

export class LearningSessionTracker {
  private runtime: SessionRuntime | null = null
  private readonly channel: BroadcastChannel | null
  private readonly ownerProbes = new Map<string, () => void>()
  constructor(private readonly repository: LearningRepository, readonly tabId: string, onOwnershipLost?: () => void) {
    this.channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('hear-say-learning-session')
    if (this.channel) this.channel.onmessage = (event: MessageEvent<{ type: string; ownerTabId: string; requesterTabId?: string; requestId?: string; materialId: string }>) => {
      const message = event.data
      if (message.type === 'owner_probe' && message.ownerTabId === this.tabId && message.materialId === this.runtime?.session.materialId && message.requestId) {
        this.channel?.postMessage({ type: 'owner_alive', ownerTabId: this.tabId, requesterTabId: message.requesterTabId, requestId: message.requestId, materialId: message.materialId })
        return
      }
      if (message.type === 'owner_alive' && message.requesterTabId === this.tabId && message.requestId) {
        this.ownerProbes.get(message.requestId)?.()
        return
      }
      if (message.type !== 'takeover' || message.ownerTabId === this.tabId || message.materialId !== this.runtime?.session.materialId) return
      this.runtime = null
      onOwnershipLost?.()
    }
  }

  get current(): SessionRuntime | null { return this.runtime }

  async start(materialId: string, purpose: LearningSessionPurpose, initialStage: LearningStage, at: string, takeOver = false, stages?: LearningStage[]): Promise<SessionStartResult> {
    const active = await this.repository.activeSession()
    if (active && active.ownerTabId !== this.tabId && !takeOver && await this.ownerIsAlive(active.ownerTabId, active.materialId)) return { kind: 'owned_elsewhere', ownerTabId: active.ownerTabId }
    const reclaiming = Boolean(active && active.ownerTabId !== this.tabId)
    if (reclaiming) await this.repository.saveActiveSession({ ...active!, status: 'ended', endedAt: at, lastCheckpointAt: at })
    if (active && active.ownerTabId === this.tabId && active.materialId === materialId && active.purpose === purpose) {
      this.runtime = { session: active, visibleSince: at, slices: [] }
      return { kind: 'resumed', runtime: this.runtime }
    }
    if (active?.ownerTabId === this.tabId) await this.repository.saveActiveSession({ ...active, status: 'ended', endedAt: at, lastCheckpointAt: at })
    const created = createLearningSession({ id: crypto.randomUUID(), materialId, purpose, reviewScheduleId: null, reviewOccurrence: null, ownerTabId: this.tabId, stages: purpose === 'free_listening' ? ['intensive_listen'] : stages }, at)
    created.session.stage = initialStage
    created.session.stageIndex = Math.max(0, created.session.stages.indexOf(initialStage))
    await this.repository.saveActiveSession(created.session)
    this.runtime = created
    if (takeOver || reclaiming) this.channel?.postMessage({ type: 'takeover', ownerTabId: this.tabId, materialId })
    return { kind: 'started', runtime: created }
  }

  async dispatch(event: SessionEvent): Promise<void> {
    if (!this.runtime) return
    this.runtime = reduceLearningSession(this.runtime, event)
    await this.repository.saveActiveSession(this.runtime.session, this.runtime.slices)
    this.runtime = { ...this.runtime, slices: [] }
  }

  async end(at: string): Promise<void> { if (this.runtime?.session.status === 'active') await this.dispatch({ type: 'session_ended', at }); this.runtime = null }
  close(): void { this.channel?.close() }

  private ownerIsAlive(ownerTabId: string, materialId: string): Promise<boolean> {
    if (!this.channel) return Promise.resolve(true)
    const requestId = crypto.randomUUID()
    return new Promise((resolve) => {
      const timeout = setTimeout(() => { this.ownerProbes.delete(requestId); resolve(false) }, 180)
      this.ownerProbes.set(requestId, () => { clearTimeout(timeout); this.ownerProbes.delete(requestId); resolve(true) })
      this.channel?.postMessage({ type: 'owner_probe', ownerTabId, requesterTabId: this.tabId, requestId, materialId })
    })
  }
}
