import { describe, expect, it } from 'vitest'
import { MaterialRepository } from '@/db/material-repository'
import { resetDatabaseForTest } from '@/db/database'
import { LibraryController } from '@/features/library/library-controller'

describe('LibraryController', () => {
  it('keeps a material retryable when transcription fails', async () => {
    await resetDatabaseForTest()
    const repository = new MaterialRepository()
    const controller = new LibraryController(repository, async () => { throw new Error('ASR is unreachable') })
    const audio = new Blob(['audio'], { type: 'audio/wav' }) as File
    const material = await controller.importAudio(audio, 5)

    expect(material.status).toBe('transcription_failed')
    expect(await repository.getMaterial(material.id)).toMatchObject({ id: material.id, status: 'transcription_failed' })
  })
})
