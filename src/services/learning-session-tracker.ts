import type { LearningRepository } from '../db/learning-repository'
import { createLearningSession, reduceLearningSession, type SessionEvent, type SessionRuntime } from '../domain/learning-session'
import type { LearningSessionPurpose, LearningStage } from '../domain/types'

export type SessionStartResult = { kind: 'started' | 'resumed'; runtime: SessionRuntime } | { kind: 'owned_elsewhere'; ownerTabId: string }

export class LearningSessionTracker {
  private runtime: SessionRuntime | null = null
  private readonly channel: BroadcastChannel | null
  constructor(private readonly repository: LearningRepository, readonly tabId: string, onOwnershipLost?: () => void) {
    this.channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('hear-say-learning-session')
    if (this.channel) this.channel.onmessage = (event: MessageEvent<{ type: string; ownerTabId: string; materialId: string }>) => {
      if (event.data.type !== 'takeover' || event.data.ownerTabId === this.tabId || event.data.materialId !== this.runtime?.session.materialId) return
      this.runtime = null
      onOwnershipLost?.()
    }
  }

  get current(): SessionRuntime | null { return this.runtime }

  async start(materialId: string, purpose: LearningSessionPurpose, initialStage: LearningStage, at: string, takeOver = false): Promise<SessionStartResult> {
    const active = await this.repository.activeSession()
    if (active && active.ownerTabId !== this.tabId && !takeOver) return { kind: 'owned_elsewhere', ownerTabId: active.ownerTabId }
    if (active && active.ownerTabId !== this.tabId) await this.repository.saveActiveSession({ ...active, status: 'ended', endedAt: at, lastCheckpointAt: at })
    if (active && active.ownerTabId === this.tabId && active.materialId === materialId && active.purpose === purpose) {
      this.runtime = { session: active, visibleSince: at, slices: [] }
      return { kind: 'resumed', runtime: this.runtime }
    }
    if (active?.ownerTabId === this.tabId) await this.repository.saveActiveSession({ ...active, status: 'ended', endedAt: at, lastCheckpointAt: at })
    const created = createLearningSession({ id: crypto.randomUUID(), materialId, purpose, reviewScheduleId: null, reviewOccurrence: null, ownerTabId: this.tabId }, at)
    created.session.stage = initialStage
    await this.repository.saveActiveSession(created.session)
    this.runtime = created
    if (takeOver) this.channel?.postMessage({ type: 'takeover', ownerTabId: this.tabId, materialId })
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
}
