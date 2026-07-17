// Mã chạy TRONG AudioWorklet thread. Gói dưới dạng chuỗi rồi nạp qua blob URL:
// worklet cần một file riêng, mà ta không muốn thêm một entry point vào build
// chỉ vì mấy dòng này.
export const PCM_WORKLET_SRC = `
class PcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch && ch.length) {
      // Copy: buffer gốc được worklet tái sử dụng ngay sau khi process() trả về.
      this.port.postMessage(new Float32Array(ch))
    }
    return true
  }
}
registerProcessor('pcm-capture', PcmCapture)
`
