import Dexie, { type EntityTable } from 'dexie'
import type { Material, Segment, VocabularyCacheEntry, WordEntry } from '../domain/types'

export class HearSayDatabase extends Dexie {
  materials!: EntityTable<Material, 'id'>
  segments!: EntityTable<Segment, 'id'>
  wordEntries!: EntityTable<WordEntry, 'id'>
  wordLookups!: EntityTable<VocabularyCacheEntry, 'key'>

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
  }
}

export const db = new HearSayDatabase()

export async function resetDatabaseForTest(): Promise<void> {
  db.close()
  await db.delete()
  await db.open()
}
