import { describe, expect, it } from 'vitest'
import { encodeMonoPcm16Wav } from '@/domain/wav-encoder'

describe('WAV encoder', () => {
  it('encodes known mono samples as a 16 kHz 16-bit RIFF/WAV', () => {
    const wav = encodeMonoPcm16Wav([new Int16Array([0, 32_767])], 16_000)
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)
    const text = (offset: number, length: number) => String.fromCharCode(...wav.slice(offset, offset + length))

    expect(wav.byteLength).toBe(48)
    expect(text(0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(40)
    expect(text(8, 4)).toBe('WAVE')
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(16_000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(text(36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(4)
    expect(view.getInt16(44, true)).toBe(0)
    expect(view.getInt16(46, true)).toBe(32_767)
  })
})
