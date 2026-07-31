import { describe, expect, it } from 'vitest'
import { toExportData } from '@/features/library/material-export'

describe('toExportData', () => {
  it('omits the local audio Blob from exported material data', () => {
    const exported = toExportData({ id: 'm1', title: 'clip.wav', audioBlob: new Blob(['audio']), durationSeconds: 3, status: 'ready', transcriptionError: null, firstRoundStage: 'blind_listen', nextReviewAt: null, reviewStep: 0, isFavorite: false, tags: ['work'], createdAt: '', updatedAt: '', segments: [] })
    expect(exported).toMatchObject({ id: 'm1', tags: ['work'], segments: [] })
    expect(exported).not.toHaveProperty('audioBlob')
  })
})
