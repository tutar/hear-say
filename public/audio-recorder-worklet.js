class HearSayPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Float32Array(4096)
    this.offset = 0
    this.port.onmessage = (event) => {
      if (event.data?.type !== 'flush') return
      this.publish()
      this.port.postMessage({ type: 'flushed' })
    }
  }

  publish() {
    if (this.offset === 0) return
    const samples = this.buffer.slice(0, this.offset)
    this.port.postMessage(samples, [samples.buffer])
    this.offset = 0
  }

  process(inputs) {
    const input = inputs[0]?.[0]
    if (!input) return true
    let sourceOffset = 0
    while (sourceOffset < input.length) {
      const count = Math.min(input.length - sourceOffset, this.buffer.length - this.offset)
      this.buffer.set(input.subarray(sourceOffset, sourceOffset + count), this.offset)
      this.offset += count
      sourceOffset += count
      if (this.offset === this.buffer.length) this.publish()
    }
    return true
  }
}

registerProcessor('hear-say-pcm-capture', HearSayPcmCaptureProcessor)
