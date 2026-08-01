import { describe, expect, it } from 'vitest'
import { formatWorkspacePlace, parseWorkspaceHash } from '@/app/workspace-routes'

describe('workspace routes', () => {
  it.each([
    ['#/learning', { kind: 'learning' }],
    ['#/library', { kind: 'library' }],
    ['#/words', { kind: 'words' }],
    ['#/settings', { kind: 'settings' }],
    ['#/materials/m1', { kind: 'material', materialId: 'm1' }],
    ['#/materials/m1/practice', { kind: 'practice', materialId: 'm1' }],
    ['#/materials/m1/review', { kind: 'review', materialId: 'm1' }],
    ['#/materials/m1/subtitles', { kind: 'subtitles', materialId: 'm1' }],
    ['#/words/w1', { kind: 'word', wordId: 'w1' }],
  ] as const)('parses %s', (hash, place) => {
    expect(parseWorkspaceHash(hash)).toEqual({ place, canonicalHash: hash, issue: null })
    expect(formatWorkspacePlace(place)).toBe(hash)
  })

  it('migrates the legacy settings hash without treating it as an error', () => {
    expect(parseWorkspaceHash('#settings')).toEqual({ place: { kind: 'settings' }, canonicalHash: '#/settings', issue: null })
  })

  it('normalizes an empty route to learning', () => {
    expect(parseWorkspaceHash('')).toEqual({ place: { kind: 'learning' }, canonicalHash: '#/learning', issue: null })
  })

  it('falls back from an unknown route with an issue', () => {
    expect(parseWorkspaceHash('#/not-real')).toEqual({ place: { kind: 'learning' }, canonicalHash: '#/learning', issue: '无法识别该页面' })
  })
})
