import { parseSubtitle } from '../../domain/subtitles'
import type { Material, Segment } from '../../domain/types'
import { MaterialRepository } from '../../db/material-repository'

export type Transcribe = (input: { audioBlob: Blob; filename: string; materialId: string; durationSeconds: number | null }) => Promise<Segment[]>

export class LibraryController {
  constructor(private readonly repository: MaterialRepository, private readonly transcribe: Transcribe) {}

  async importAudio(file: File, durationSeconds: number | null, onPending?: (material: Material) => void): Promise<Material> {
    const material = await this.repository.createPending({ title: file.name, audioBlob: file, durationSeconds })
    onPending?.(material)
    return this.transcribeExisting(material)
  }

  async retry(materialId: string): Promise<Material> {
    const stored = await this.repository.getMaterial(materialId)
    if (!stored) throw new Error('material was not found')
    return this.transcribeExisting(stored)
  }

  async importSubtitle(materialId: string, text: string, format: 'srt' | 'vtt'): Promise<void> {
    const material = await this.repository.getMaterial(materialId)
    if (!material) throw new Error('material was not found')
    const segments = parseSubtitle(text, format, materialId, material.durationSeconds)
    await this.repository.replaceSegments(materialId, segments)
  }

  private async transcribeExisting(material: Material): Promise<Material> {
    try {
      const segments = await this.transcribe({ audioBlob: material.audioBlob, filename: material.title, materialId: material.id, durationSeconds: material.durationSeconds })
      await this.repository.replaceSegments(material.id, segments)
    } catch (error) {
      await this.repository.markTranscriptionFailed(material.id, error instanceof Error ? error.message : 'ASR transcription failed')
    }
    const updated = await this.repository.getMaterial(material.id)
    if (!updated) throw new Error('material was not found')
    return updated
  }
}
