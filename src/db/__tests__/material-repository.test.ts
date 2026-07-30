import { beforeEach, describe, expect, it } from 'vitest'
import type { Segment } from '@/domain/types'
import { resetDatabaseForTest } from '@/db/database'
import { MaterialRepository } from '@/db/material-repository'

const segment: Segment = { id: 's1', materialId: 'm1', order: 0, startSeconds: 0, endSeconds: 1, text: 'Hello', isDifficult: false }

describe('MaterialRepository', () => {
  beforeEach(async () => { await resetDatabaseForTest() })

  it('keeps a failed transcription material and its audio Blob', async () => {
    const repository = new MaterialRepository()
    const blob = new Blob(['audio'])
    const material = await repository.createPending({ title: 'clip.wav', audioBlob: blob, durationSeconds: 5 })
    await repository.markTranscriptionFailed(material.id, 'ASR is unreachable')

    expect(await repository.getMaterial(material.id)).toMatchObject({ status: 'transcription_failed', audioBlob: blob })
  })

  it('persists replacement segments and deletes them with their material', async () => {
    const repository = new MaterialRepository()
    const material = await repository.createPending({ title: 'clip.wav', audioBlob: new Blob(['audio']), durationSeconds: 5 })
    await repository.replaceSegments(material.id, [{ ...segment, materialId: material.id }])
    expect((await repository.getMaterial(material.id))?.segments).toHaveLength(1)

    await repository.deleteMaterial(material.id)
    expect(await repository.getMaterial(material.id)).toBeNull()
  })

  it('returns only ready materials whose review time has arrived', async () => {
    const repository = new MaterialRepository()
    const due = await repository.createPending({ title: 'due.wav', audioBlob: new Blob(['audio']), durationSeconds: 5 })
    const future = await repository.createPending({ title: 'future.wav', audioBlob: new Blob(['audio']), durationSeconds: 5 })
    await repository.replaceSegments(due.id, [{ ...segment, id: 'due-segment', materialId: due.id }])
    await repository.replaceSegments(future.id, [{ ...segment, id: 'future-segment', materialId: future.id }])
    await repository.saveMaterial({ ...(await repository.getMaterial(due.id))!, nextReviewAt: '2026-07-29T00:00:00.000Z' })
    await repository.saveMaterial({ ...(await repository.getMaterial(future.id))!, nextReviewAt: '2026-07-31T00:00:00.000Z' })

    await expect(repository.listDueMaterials(new Date('2026-07-30T00:00:00.000Z'))).resolves.toEqual([
      expect.objectContaining({ id: due.id }),
    ])
  })

  it('adds a four-character suffix when an imported title already exists', async () => {
    const repository = new MaterialRepository()
    const first = await repository.createPending({ title: 'lesson.wav', audioBlob: new Blob(), durationSeconds: 5 })
    const second = await repository.createPending({ title: 'lesson.wav', audioBlob: new Blob(), durationSeconds: 5 })

    expect(first.title).toBe('lesson.wav')
    expect(second.title).toMatch(/^lesson\.wav-[A-Z0-9]{4}$/)
    expect(second.title).not.toBe(first.title)
  })

  it('persists a trimmed material name and rejects an empty one', async () => {
    const repository = new MaterialRepository()
    const material = await repository.createPending({ title: 'lesson.wav', audioBlob: new Blob(), durationSeconds: 5 })

    await expect(repository.renameMaterial(material.id, '  podcast clip  ')).resolves.toMatchObject({ title: 'podcast clip' })
    await expect(repository.renameMaterial(material.id, '   ')).rejects.toThrow('title is required')
  })
})
