export type TimedTranscriptText = { start: number; end: number; text: string }

const MIN_SECONDS = 5
const MAX_SECONDS = 12
const MAX_WORDS = 20

const wordCount = (text: string): number => text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0
const durationSeconds = (items: TimedTranscriptText[]): number => items.length === 0 ? 0 : (items.at(-1)!.end - items[0].start) / 1000
const combinedWordCount = (items: TimedTranscriptText[]): number => items.reduce((total, item) => total + wordCount(item.text), 0)
const canCombine = (items: TimedTranscriptText[]): boolean => durationSeconds(items) <= MAX_SECONDS && combinedWordCount(items) <= MAX_WORDS

function combine(items: TimedTranscriptText[]): TimedTranscriptText {
  return { start: items[0].start, end: items.at(-1)!.end, text: items.map((item) => item.text.trim()).join(' ') }
}

function groupParagraph(sentences: TimedTranscriptText[]): TimedTranscriptText[] {
  const groups: TimedTranscriptText[][] = []
  let current: TimedTranscriptText[] = []
  for (const sentence of sentences) {
    if (current.length > 0 && !canCombine([...current, sentence])) {
      groups.push(current)
      current = []
    }
    current.push(sentence)
    if (durationSeconds(current) >= MIN_SECONDS) {
      groups.push(current)
      current = []
    }
  }
  if (current.length > 0) groups.push(current)
  if (groups.length > 1 && durationSeconds(groups.at(-1)!) < MIN_SECONDS) {
    const tail = groups.at(-1)!
    const previous = groups.at(-2)!
    if (canCombine([...previous, ...tail])) groups.splice(groups.length - 2, 2, [...previous, ...tail])
  }
  return groups.map(combine)
}

export function createPracticeSegments(sentences: TimedTranscriptText[], paragraphs: TimedTranscriptText[]): TimedTranscriptText[] {
  const orderedSentences = [...sentences].sort((a, b) => a.start - b.start)
  const orderedParagraphs = [...paragraphs].sort((a, b) => a.start - b.start)
  const grouped: TimedTranscriptText[] = []
  const assigned = new Set<TimedTranscriptText>()
  for (const paragraph of orderedParagraphs) {
    const within = orderedSentences.filter((sentence) => {
      const midpoint = sentence.start + (sentence.end - sentence.start) / 2
      return midpoint >= paragraph.start && midpoint <= paragraph.end
    })
    within.forEach((sentence) => assigned.add(sentence))
    grouped.push(...groupParagraph(within))
  }
  grouped.push(...orderedSentences.filter((sentence) => !assigned.has(sentence)))
  return grouped.sort((a, b) => a.start - b.start)
}
