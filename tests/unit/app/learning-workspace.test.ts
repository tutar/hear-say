import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDatabaseForTest } from '@/db/database'
import { MaterialRepository } from '@/db/material-repository'
import { WordRepository } from '@/db/word-repository'
import { LearningWorkspace } from '@/app/learning-workspace'
import type { Segment } from '@/domain/types'

describe('LearningWorkspace navigation', () => {
  beforeEach(async () => {
    await resetDatabaseForTest()
    history.replaceState(null, '', '/app.html#/learning')
  })

  it('uses browser history and does not push the current place twice', async () => {
    const workspace = new LearningWorkspace({ materialRepository: new MaterialRepository(), wordRepository: new WordRepository(), navigation: window })
    await workspace.start()
    const initialLength = history.length

    await workspace.go({ kind: 'library' })
    expect(location.hash).toBe('#/library')
    expect(workspace.getState().place).toEqual({ kind: 'library' })
    expect(history.length).toBe(initialLength + 1)

    await workspace.go({ kind: 'library' })
    expect(history.length).toBe(initialLength + 1)
    workspace.stop()
  })

  it('replaces a missing material route with the library', async () => {
    history.replaceState(null, '', '/app.html#/materials/missing')
    const workspace = new LearningWorkspace({ materialRepository: new MaterialRepository(), wordRepository: new WordRepository(), navigation: window })
    await workspace.start()

    expect(location.hash).toBe('#/library')
    expect(workspace.getState()).toMatchObject({ place: { kind: 'library' }, message: '该材料已不存在' })
    workspace.stop()
  })

  it('keeps practice and review as distinct places', async () => {
    const repository = new MaterialRepository()
    const pending = await repository.createPending({ title: 'lesson.wav', audioBlob: new Blob(['audio']), durationSeconds: 1 })
    await repository.replaceSegments(pending.id, [{ id: 's1', materialId: pending.id, order: 0, startSeconds: 0, endSeconds: 1, text: 'Hello', isDifficult: false }])
    const ready = await repository.getMaterial(pending.id)
    await repository.saveMaterial({ ...ready!, firstRoundStage: 'complete', nextReviewAt: '2026-01-01T00:00:00.000Z' })
    const workspace = new LearningWorkspace({ materialRepository: repository, wordRepository: new WordRepository(), navigation: window })
    await workspace.start()

    await workspace.go({ kind: 'practice', materialId: pending.id })
    expect(workspace.getState().place.kind).toBe('practice')
    await workspace.go({ kind: 'review', materialId: pending.id })
    expect(workspace.getState().place.kind).toBe('review')
    expect(location.hash).toBe(`#/materials/${pending.id}/review`)
    workspace.stop()
  })

  it('keeps the current route when an active sentence edit is not discarded', async () => {
    const workspace = new LearningWorkspace({
      materialRepository: new MaterialRepository(), wordRepository: new WordRepository(), navigation: window,
      confirmDiscard: () => false,
    })
    await workspace.start()
    workspace.setSentenceEditActive(true)

    await workspace.go({ kind: 'library' })

    expect(location.hash).toBe('#/learning')
    expect(workspace.getState()).toMatchObject({ place: { kind: 'learning' }, sentenceEditActive: true })
    workspace.stop()
  })

  it('keeps a transcription task visible across place changes', async () => {
    let finish!: (segments: Segment[]) => void
    const transcription = new Promise<Segment[]>((resolve) => { finish = resolve })
    const workspace = new LearningWorkspace({ materialRepository: new MaterialRepository(), wordRepository: new WordRepository(), navigation: window })
    await workspace.start()

    const importing = workspace.importAudio(new File(['audio'], 'lesson.wav'), 1, () => transcription)
    await vi.waitFor(() => expect(workspace.getState().transcriptionTasks.size).toBe(1))
    const [materialId] = workspace.getState().transcriptionTasks
    await workspace.go({ kind: 'words' })
    expect(workspace.getState().transcriptionTasks.has(materialId)).toBe(true)

    finish([{ id: 's1', materialId, order: 0, startSeconds: 0, endSeconds: 1, text: 'Hello', isDifficult: false }])
    await importing
    expect(workspace.getState().transcriptionTasks.size).toBe(0)
    expect(workspace.getState().materials).toEqual([expect.objectContaining({ id: materialId, status: 'ready' })])
    workspace.stop()
  })

  it('surfaces a non-blocking transcription warning after a successful import', async () => {
    const workspace = new LearningWorkspace({ materialRepository: new MaterialRepository(), wordRepository: new WordRepository(), navigation: window })
    await workspace.start()
    await workspace.importAudio(new File(['audio'], 'lesson.wav'), 1, async (input) => {
      input.onWarning?.('段落分组不可用，已保留原始句子。')
      return [{ id: 's1', materialId: input.materialId, order: 0, startSeconds: 0, endSeconds: 1, text: 'Hello', isDifficult: false }]
    })
    expect(workspace.getState()).toMatchObject({ message: '段落分组不可用，已保留原始句子。' })
    workspace.stop()
  })

  it('keeps the current material visible while refreshing related data', async () => {
    const repository = new MaterialRepository()
    const pending = await repository.createPending({ title: 'lesson.wav', audioBlob: new Blob(['audio']), durationSeconds: 1 })
    await repository.replaceSegments(pending.id, [{ id: 's1', materialId: pending.id, order: 0, startSeconds: 0, endSeconds: 1, text: 'Hello', isDifficult: false }])
    const workspace = new LearningWorkspace({ materialRepository: repository, wordRepository: new WordRepository(), navigation: window })
    await workspace.start()
    await workspace.go({ kind: 'practice', materialId: pending.id })
    let finish!: (materials: Awaited<ReturnType<MaterialRepository['listMaterials']>>) => void
    vi.spyOn(repository, 'listMaterials').mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))

    const refreshing = workspace.refresh()
    expect(workspace.getState().currentMaterial?.id).toBe(pending.id)
    finish(await new MaterialRepository().listMaterials())
    await refreshing
    workspace.stop()
  })

  it('preserves the active audio blob when saving a difficult-sentence bookmark', async () => {
    const repository = new MaterialRepository()
    const pending = await repository.createPending({ title: 'lesson.wav', audioBlob: new Blob(['audio']), durationSeconds: 1 })
    await repository.replaceSegments(pending.id, [{ id: 's1', materialId: pending.id, order: 0, startSeconds: 0, endSeconds: 1, text: 'Hello', isDifficult: false }])
    const workspace = new LearningWorkspace({ materialRepository: repository, wordRepository: new WordRepository(), navigation: window })
    await workspace.start()
    await workspace.go({ kind: 'practice', materialId: pending.id })
    const playingBlob = workspace.getState().currentMaterial!.audioBlob
    await workspace.saveSegments(pending.id, workspace.getState().currentMaterial!.segments.map((segment) => ({ ...segment, isDifficult: true })))
    expect(workspace.getState().currentMaterial?.audioBlob).toBe(playingBlob)
    expect(workspace.getState().currentMaterial?.segments[0].isDifficult).toBe(true)
    workspace.stop()
  })
})
