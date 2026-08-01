import { describe, expect, it, vi } from 'vitest'
import { WordSpeaker } from '@/services/word-speaker'

describe('WordSpeaker', () => {
  it('toggles the same term and stops an old term before speaking a new one in American English', async () => {
    const engine = { speak: vi.fn(async () => undefined), stop: vi.fn() }
    const speaker = new WordSpeaker(engine)

    expect(await speaker.toggle('record')).toBe('record')
    expect(engine.speak).toHaveBeenLastCalledWith('record', expect.objectContaining({ lang: 'en-US' }))
    expect(await speaker.toggle('message')).toBe('message')
    expect(engine.stop).toHaveBeenCalledTimes(1)
    expect(engine.speak).toHaveBeenLastCalledWith('message', expect.objectContaining({ lang: 'en-US' }))
    expect(await speaker.toggle('message')).toBeNull()
    expect(engine.stop).toHaveBeenCalledTimes(2)
  })

  it('notifies the interface when Chrome finishes speaking', async () => {
    let onEvent: ((event: { type: string }) => void) | undefined
    const onChange = vi.fn()
    const speaker = new WordSpeaker({ speak: vi.fn(async (_term, options) => { onEvent = options.onEvent }), stop: vi.fn() }, onChange)
    await speaker.toggle('record')
    onEvent?.({ type: 'end' })
    expect(speaker.active).toBeNull()
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})
