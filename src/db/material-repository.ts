import Dexie from 'dexie'
import { db } from './database'
import { validateSegment } from '../domain/segments'
import type { Material, Segment } from '../domain/types'

export type MaterialWithSegments = Material & { segments: Segment[] }
export type PendingMaterialInput = Pick<Material, 'title' | 'audioBlob' | 'durationSeconds'>

const suffixAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function randomSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return Array.from(bytes, (byte) => suffixAlphabet[byte % suffixAlphabet.length]).join('')
}

export class MaterialRepository {
  async createPending(input: PendingMaterialInput): Promise<Material> {
    const now = new Date().toISOString()
    const material: Material = {
      id: crypto.randomUUID(), ...input, title: await this.uniqueTitle(input.title), status: 'pending_transcription', transcriptionError: null,
      firstRoundStage: 'blind_listen', nextReviewAt: null, reviewStep: 0, isFavorite: false, tags: [], createdAt: now, updatedAt: now,
    }
    await db.materials.add(material)
    return material
  }

  async listMaterials(): Promise<Material[]> {
    return db.materials.orderBy('updatedAt').reverse().toArray()
  }

  async listDueMaterials(now = new Date()): Promise<MaterialWithSegments[]> {
    const readyMaterials = await db.materials.where('status').equals('ready').toArray()
    const dueMaterials = readyMaterials.filter((material) => material.nextReviewAt && new Date(material.nextReviewAt) <= now)
    const expanded = await Promise.all(dueMaterials.map((material) => this.getMaterial(material.id)))
    return expanded.filter((material): material is MaterialWithSegments => material !== null)
  }

  async getMaterial(id: string): Promise<MaterialWithSegments | null> {
    const material = await db.materials.get(id)
    if (!material) return null
    const segments = await db.segments.where('[materialId+order]').between([id, Dexie.minKey], [id, Dexie.maxKey]).toArray()
    return { ...material, segments }
  }

  async replaceSegments(materialId: string, segments: Segment[]): Promise<void> {
    const material = await db.materials.get(materialId)
    if (!material) throw new Error('material was not found')
    const validated = segments.map((segment, order) => validateSegment({ ...segment, materialId, order }, material.durationSeconds))
    await db.transaction('rw', db.materials, db.segments, async () => {
      await db.segments.where('materialId').equals(materialId).delete()
      await db.segments.bulkAdd(validated)
      await db.materials.update(materialId, { status: 'ready', transcriptionError: null, updatedAt: new Date().toISOString() })
    })
  }

  async markTranscriptionFailed(materialId: string, message: string): Promise<void> {
    const count = await db.materials.update(materialId, { status: 'transcription_failed', transcriptionError: message, updatedAt: new Date().toISOString() })
    if (count === 0) throw new Error('material was not found')
  }

  async saveMaterial(material: Material): Promise<void> {
    await db.materials.put({ ...material, updatedAt: new Date().toISOString() })
  }

  async renameMaterial(materialId: string, title: string): Promise<Material> {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) throw new Error('title is required')
    const count = await db.materials.update(materialId, { title: trimmedTitle, updatedAt: new Date().toISOString() })
    if (count === 0) throw new Error('material was not found')
    const material = await db.materials.get(materialId)
    if (!material) throw new Error('material was not found')
    return material
  }

  async setFavorite(materialId: string, isFavorite: boolean): Promise<void> {
    await this.updateMaterial(materialId, { isFavorite })
  }

  async setTags(materialId: string, tags: string[]): Promise<void> {
    const normalizedTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))]
    await this.updateMaterial(materialId, { tags: normalizedTags })
  }

  async resetLearningProgress(materialId: string): Promise<void> {
    await this.updateMaterial(materialId, { firstRoundStage: 'blind_listen', nextReviewAt: null, reviewStep: 0, retellKeywords: undefined })
  }

  async deleteMaterial(materialId: string): Promise<void> {
    await db.transaction('rw', db.materials, db.segments, db.reviewSchedules, db.learningSessions, db.learningTimeSlices, async () => {
      await db.segments.where('materialId').equals(materialId).delete()
      await db.reviewSchedules.where('materialId').equals(materialId).delete()
      await db.learningSessions.where('materialId').equals(materialId).delete()
      await db.learningTimeSlices.where('materialId').equals(materialId).delete()
      await db.materials.delete(materialId)
    })
  }

  private async uniqueTitle(title: string): Promise<string> {
    const existingTitles = new Set((await db.materials.toArray()).map((material) => material.title))
    if (!existingTitles.has(title)) return title
    let candidate = `${title}-${randomSuffix()}`
    while (existingTitles.has(candidate)) candidate = `${title}-${randomSuffix()}`
    return candidate
  }

  private async updateMaterial(materialId: string, changes: Partial<Material>): Promise<void> {
    const count = await db.materials.update(materialId, { ...changes, updatedAt: new Date().toISOString() })
    if (count === 0) throw new Error('material was not found')
  }
}
