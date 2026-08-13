export type OralWordDifference =
  | { kind: 'match'; text: string }
  | { kind: 'missing'; text: string }
  | { kind: 'extra'; text: string }
  | { kind: 'changed'; expected: string; actual: string }

export type OralAttemptFeedback = { similarity: number; words: OralWordDifference[] }

const normalizeCharacters = (text: string) => text.toLowerCase().replace(/[^a-z0-9' ]+/g, '').replace(/\s+/g, ' ').trim()
const words = (text: string) => text.match(/[a-z0-9]+(?:'[a-z0-9]+)?/gi) ?? []

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(current[rightIndex - 1] + 1, previous[rightIndex] + 1, previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous[right.length]
}

function wordDifferences(expectedText: string, actualText: string): OralWordDifference[] {
  const expected = words(expectedText)
  const actual = words(actualText)
  const costs = Array.from({ length: expected.length + 1 }, () => Array(actual.length + 1).fill(0) as number[])
  for (let index = 0; index <= expected.length; index += 1) costs[index][0] = index
  for (let index = 0; index <= actual.length; index += 1) costs[0][index] = index
  for (let i = 1; i <= expected.length; i += 1) for (let j = 1; j <= actual.length; j += 1) {
    costs[i][j] = Math.min(costs[i - 1][j] + 1, costs[i][j - 1] + 1, costs[i - 1][j - 1] + (expected[i - 1].toLowerCase() === actual[j - 1].toLowerCase() ? 0 : 1))
  }
  const result: OralWordDifference[] = []
  let i = expected.length; let j = actual.length
  while (i || j) {
    if (i && j && expected[i - 1].toLowerCase() === actual[j - 1].toLowerCase()) { result.push({ kind: 'match', text: expected[--i] }); j -= 1 }
    else if (i && j && costs[i][j] === costs[i - 1][j - 1] + 1) { result.push({ kind: 'changed', expected: expected[--i], actual: actual[--j] }) }
    else if (i && costs[i][j] === costs[i - 1][j] + 1) result.push({ kind: 'missing', text: expected[--i] })
    else result.push({ kind: 'extra', text: actual[--j] })
  }
  return result.reverse()
}

export function compareOralAttempt(expected: string, actual: string): OralAttemptFeedback {
  const normalizedExpected = normalizeCharacters(expected)
  const normalizedActual = normalizeCharacters(actual)
  const longest = Math.max(normalizedExpected.length, normalizedActual.length)
  const similarity = longest === 0 ? 100 : Math.round((1 - editDistance(normalizedExpected, normalizedActual) / longest) * 100)
  return { similarity, words: wordDifferences(expected, actual) }
}
