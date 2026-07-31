import type { MaterialWithSegments } from '../../db/material-repository'

export type MaterialExport = Omit<MaterialWithSegments, 'audioBlob'>

export function toExportData({ audioBlob: _audioBlob, ...material }: MaterialWithSegments): MaterialExport {
  return material
}
