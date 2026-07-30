import type { MaterialWithSegments } from '../../db/material-repository'

type Props = {
  materials: MaterialWithSegments[]
  onOpenMaterial: (materialId: string) => void
}

function difficultSentenceCount(material: MaterialWithSegments) {
  return material.segments.filter((segment) => segment.isDifficult).length
}

export function ReviewQueue({ materials, onOpenMaterial }: Props) {
  const orderedMaterials = [...materials].sort((left, right) => {
    const difficultDifference = difficultSentenceCount(right) - difficultSentenceCount(left)
    if (difficultDifference !== 0) return difficultDifference
    return (left.nextReviewAt ?? '').localeCompare(right.nextReviewAt ?? '')
  })

  if (orderedMaterials.length === 0) return null

  return <section className="review-queue" aria-label="到期复习">
    <div className="section-heading"><div><p className="eyebrow">到期复习</p><h2>先回到容易卡住的句子</h2></div><span>{orderedMaterials.length} 段</span></div>
    <ul className="material-list">{orderedMaterials.map((material) => {
      const difficultCount = difficultSentenceCount(material)
      return <li key={material.id} className="material-row"><div><strong>{material.title}</strong><small>{difficultCount > 0 ? `${difficultCount} 个难句，优先复习` : '按既定间隔复习'}</small></div><button className="primary-action" type="button" onClick={() => onOpenMaterial(material.id)}>复习 {material.title}</button></li>
    })}</ul>
  </section>
}
