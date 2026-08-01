function writeText(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index))
}

export function encodeMonoPcm16Wav(chunks: readonly Int16Array[], sampleRate = 16_000): Uint8Array {
  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const dataBytes = sampleCount * Int16Array.BYTES_PER_ELEMENT
  const wav = new Uint8Array(44 + dataBytes)
  const view = new DataView(wav.buffer)

  writeText(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeText(view, 8, 'WAVE')
  writeText(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  let offset = 44
  for (const chunk of chunks) {
    for (const sample of chunk) {
      view.setInt16(offset, sample, true)
      offset += 2
    }
  }
  return wav
}
