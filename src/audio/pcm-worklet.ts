// Code that runs INSIDE the AudioWorklet thread. Packaged as a string and loaded
// via a blob URL: the worklet needs its own file, but we don't want to add a
// build entry point just for these few lines.
export const PCM_WORKLET_SRC = `
class PcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch && ch.length) {
      // Copy: the worklet reuses the source buffer right after process() returns.
      this.port.postMessage(new Float32Array(ch))
    }
    return true
  }
}
registerProcessor('pcm-capture', PcmCapture)
`
