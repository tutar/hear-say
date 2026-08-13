export type WorkspacePlace =
  | { kind: 'learning' }
  | { kind: 'library' }
  | { kind: 'words' }
  | { kind: 'settings' }
  | { kind: 'learning-settings' }
  | { kind: 'material'; materialId: string }
  | { kind: 'practice'; materialId: string }
  | { kind: 'free-listening'; materialId: string }
  | { kind: 'stage-review'; materialId: string; stage: 'blind_listen' | 'intensive_listen' | 'shadowing' | 'retelling' }
  | { kind: 'review'; materialId: string }
  | { kind: 'subtitles'; materialId: string }
  | { kind: 'recording-draft'; draftId: string }
  | { kind: 'word'; wordId: string }

export type ParsedWorkspaceHash = { place: WorkspacePlace; canonicalHash: string; issue: string | null }

const decodeId = (value: string): string | null => {
  try { return decodeURIComponent(value) || null } catch { return null }
}

export function formatWorkspacePlace(place: WorkspacePlace): string {
  switch (place.kind) {
    case 'learning': return '#/learning'
    case 'library': return '#/library'
    case 'words': return '#/words'
    case 'settings': return '#/settings'
    case 'learning-settings': return '#/learning-settings'
    case 'material': return `#/materials/${encodeURIComponent(place.materialId)}`
    case 'practice': return `#/materials/${encodeURIComponent(place.materialId)}/practice`
    case 'free-listening': return `#/materials/${encodeURIComponent(place.materialId)}/free-listening`
    case 'stage-review': return `#/materials/${encodeURIComponent(place.materialId)}/stages/${place.stage.replaceAll('_', '-')}`
    case 'review': return `#/materials/${encodeURIComponent(place.materialId)}/review`
    case 'subtitles': return `#/materials/${encodeURIComponent(place.materialId)}/subtitles`
    case 'recording-draft': return `#/recording-drafts/${encodeURIComponent(place.draftId)}`
    case 'word': return `#/words/${encodeURIComponent(place.wordId)}`
  }
}

export function parseWorkspaceHash(hash: string): ParsedWorkspaceHash {
  if (!hash || hash === '#' || hash === '#/' || hash === '#/learning/') return valid({ kind: 'learning' })
  if (hash === '#settings') return valid({ kind: 'settings' })
  const normalized = hash.length > 2 ? hash.replace(/\/+$/, '') : hash
  if (normalized === '#/learning') return valid({ kind: 'learning' })
  if (normalized === '#/library') return valid({ kind: 'library' })
  if (normalized === '#/words') return valid({ kind: 'words' })
  if (normalized === '#/settings') return valid({ kind: 'settings' })
  if (normalized === '#/learning-settings') return valid({ kind: 'learning-settings' })

  const parts = normalized.replace(/^#\//, '').split('/')
  if (parts[0] === 'materials' && parts.length >= 2) {
    const materialId = decodeId(parts[1])
    if (!materialId) return invalid()
    if (parts.length === 2) return valid({ kind: 'material', materialId })
    if (parts.length === 3 && parts[2] === 'practice') return valid({ kind: 'practice', materialId })
    if (parts.length === 3 && parts[2] === 'free-listening') return valid({ kind: 'free-listening', materialId })
    if (parts.length === 3 && parts[2] === 'review') return valid({ kind: 'review', materialId })
    if (parts.length === 3 && parts[2] === 'subtitles') return valid({ kind: 'subtitles', materialId })
    if (parts.length === 4 && parts[2] === 'stages') {
      const stage = parts[3].replaceAll('-', '_')
      if (stage === 'blind_listen' || stage === 'intensive_listen' || stage === 'shadowing' || stage === 'retelling') return valid({ kind: 'stage-review', materialId, stage })
    }
  }
  if (parts[0] === 'words' && parts.length === 2) {
    const wordId = decodeId(parts[1])
    if (wordId) return valid({ kind: 'word', wordId })
  }
  if (parts[0] === 'recording-drafts' && parts.length === 2) {
    const draftId = decodeId(parts[1])
    if (draftId) return valid({ kind: 'recording-draft', draftId })
  }
  return invalid()
}

const valid = (place: WorkspacePlace): ParsedWorkspaceHash => ({ place, canonicalHash: formatWorkspacePlace(place), issue: null })
const invalid = (): ParsedWorkspaceHash => ({ place: { kind: 'learning' }, canonicalHash: '#/learning', issue: '无法识别该页面' })
