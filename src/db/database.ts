import Dexie, { type EntityTable } from 'dexie'
import type { FreeListeningPreferences, FreeListeningProgress, LearningSession, LearningTimeSlice, Material, ReviewPlan, ReviewSchedule, Segment, VocabularyCacheEntry, WordEntry } from '../domain/types'

export class HearSayDatabase extends Dexie {
  materials!: EntityTable<Material, 'id'>
  segments!: EntityTable<Segment, 'id'>
  wordEntries!: EntityTable<WordEntry, 'id'>
  wordLookups!: EntityTable<VocabularyCacheEntry, 'key'>
  reviewPlans!: EntityTable<ReviewPlan, 'id'>
  reviewSchedules!: EntityTable<ReviewSchedule, 'id'>
  learningSessions!: EntityTable<LearningSession, 'id'>
  learningTimeSlices!: EntityTable<LearningTimeSlice, 'id'>
  freeListeningPreferences!: EntityTable<FreeListeningPreferences, 'id'>
  freeListeningProgress!: EntityTable<FreeListeningProgress, 'materialId'>

  constructor() {
    super('hear-say')
    this.version(1).stores({
      materials: 'id,status,nextReviewAt,updatedAt',
      segments: 'id,materialId,[materialId+order],isDifficult',
    })
    this.version(2).stores({
      materials: 'id,status,nextReviewAt,updatedAt,isFavorite,*tags',
      segments: 'id,materialId,[materialId+order],isDifficult',
    }).upgrade(async (tx) => {
      await tx.table('materials').toCollection().modify({ isFavorite: false, tags: [] })
    })
    this.version(3).stores({
      materials: 'id,status,nextReviewAt,updatedAt,isFavorite,*tags',
      segments: 'id,materialId,[materialId+order],isDifficult',
      wordEntries: 'id,&normalizedTerm,lastSeenAt',
      wordLookups: 'key,updatedAt',
    })
    this.version(4).stores({
      materials: 'id,status,nextReviewAt,updatedAt,isFavorite,*tags',
      segments: 'id,materialId,[materialId+order],isDifficult',
      wordEntries: 'id,&normalizedTerm,lastSeenAt', wordLookups: 'key,updatedAt',
      reviewPlans: 'id,&version,createdAt', reviewSchedules: 'id,&materialId,nextReviewAt,status',
      learningSessions: 'id,materialId,status,ownerTabId,startedAt', learningTimeSlices: 'id,sessionId,materialId,startedAt',
    })
    this.version(5).stores({
      materials: 'id,status,nextReviewAt,updatedAt,isFavorite,*tags',
      segments: 'id,materialId,[materialId+order],isDifficult',
      wordEntries: 'id,&normalizedTerm,lastSeenAt', wordLookups: 'key,updatedAt',
      reviewPlans: 'id,&version,createdAt', reviewSchedules: 'id,&materialId,nextReviewAt,status',
      learningSessions: 'id,materialId,status,ownerTabId,startedAt', learningTimeSlices: 'id,sessionId,materialId,startedAt',
      freeListeningPreferences: 'id', freeListeningProgress: 'materialId,updatedAt',
    })
  }
}

export const db = new HearSayDatabase()

export async function resetDatabaseForTest(): Promise<void> {
  db.close()
  await db.delete()
  await db.open()
}
