import { db } from './database'
import { encodeMonoPcm16Wav } from '../domain/wav-encoder'
import { normalizeExcludedIntervals, type ExcludedSampleInterval, type RecordingDraft } from '../domain/recording-draft'

export type RecordingChunk = {
  sessionId: string
  sequence: number
  sampleRate: number
  samples: Int16Array
}

export type { ExcludedSampleInterval } from '../domain/recording-draft'

export class RecordingRepository {
  async saveDraft(draft: RecordingDraft): Promise<void> {
    await db.recordingDrafts.put(draft)
  }

  async getDraft(id: string): Promise<RecordingDraft | undefined> {
    return db.recordingDrafts.get(id)
  }

  async listDrafts(): Promise<RecordingDraft[]> {
    return db.recordingDrafts.orderBy('updatedAt').reverse().toArray()
  }

  async saveExcludedIntervals(id: string, excludedIntervals: ExcludedSampleInterval[]): Promise<void> {
    const draft = await db.recordingDrafts.get(id)
    if (!draft) throw new Error('Recording Draft does not exist')
    await db.recordingDrafts.put({ ...draft, excludedIntervals: normalizeExcludedIntervals(excludedIntervals, Math.round(draft.durationSeconds * 16_000)), updatedAt: new Date().toISOString() })
  }

  async deleteDraft(id: string): Promise<void> {
    const draft = await db.recordingDrafts.get(id)
    if (!draft) return
    await db.transaction('rw', db.recordingDrafts, db.recordingChunks, async () => {
      await db.recordingDrafts.delete(id)
      await db.recordingChunks.where('sessionId').equals(draft.sessionId).delete()
    })
  }

  async appendChunk(chunk: RecordingChunk): Promise<void> {
    await db.recordingChunks.put({
      id: `${chunk.sessionId}:${chunk.sequence}`,
      sessionId: chunk.sessionId,
      sequence: chunk.sequence,
      sampleRate: chunk.sampleRate,
      samples: Array.from(chunk.samples),
    })
  }

  async chunkCount(sessionId: string): Promise<number> {
    return db.recordingChunks.where('sessionId').equals(sessionId).count()
  }

  async persistedBytes(sessionId: string): Promise<number> {
    const chunks = await db.recordingChunks.where('sessionId').equals(sessionId).toArray()
    return chunks.reduce((total, chunk) => total + chunk.samples.length * 2, 0)
  }

  async deleteSession(sessionId: string): Promise<void> {
    await db.recordingChunks.where('sessionId').equals(sessionId).delete()
  }

  async reconstructWav(sessionId: string, excluded: readonly ExcludedSampleInterval[] = []): Promise<Uint8Array> {
    const chunks = await db.recordingChunks.where('sessionId').equals(sessionId).sortBy('sequence')
    if (chunks.length === 0) throw new Error('Recording Session has no persisted audio')
    const retained: number[] = []
    let sourceIndex = 0
    for (const chunk of chunks) {
      for (const sample of chunk.samples) {
        const isExcluded = excluded.some((interval) => sourceIndex >= interval.startSample && sourceIndex < interval.endSample)
        if (!isExcluded) retained.push(sample)
        sourceIndex += 1
      }
    }
    return encodeMonoPcm16Wav([Int16Array.from(retained)], chunks[0].sampleRate)
  }
}
