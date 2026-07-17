const OUTPUT_SAMPLE_RATE = 24000

/** Thời điểm phát chunk kế tiếp trên đồng hồ AudioContext.
 *
 * Server gửi cả loạt packet một lúc (conversation_opus_pace=False), nên KHÔNG
 * được phát ngay khi nhận -- chúng sẽ chồng lên nhau. Nối đuôi theo cursor.
 * Nếu cursor đã tụt lại sau hiện tại (tab ngủ, máy lag) thì bắt kịp về now:
 * xếp lịch vào quá khứ khiến Web Audio phát tất cả cùng lúc thành tiếng ồn. */
export function nextStartTime(now: number, cursor: number): number {
  return Math.max(now, cursor)
}

/** Thời lượng thật của một chunk đã giải mã, tính bằng giây.
 *
 * Bắt buộc lấy rate từ chính AudioData: WebCodecs BỎ QUA sampleRate ta đưa vào
 * configure() và luôn xuất 48kHz (Opus giải mã nội bộ ở 48k) -- đã đo trên
 * Chromium 149: 2880 frame/packet 60ms. Tin vào hằng 24000 ở đây làm audio phát
 * chậm một nửa và cursor trôi dần.
 */
export function chunkDuration(frames: number, sampleRate: number): number {
  return frames / sampleRate
}

export class Player {
  private ctx: AudioContext | null = null
  private decoder: AudioDecoder | null = null
  private cursor = 0
  private sources: AudioBufferSourceNode[] = []
  private timestamp = 0

  private ensure(): void {
    if (this.ctx) return
    this.ctx = new AudioContext()
    this.decoder = new AudioDecoder({
      output: (data: AudioData) => this.schedule(data),
      error: (e: Error) => console.error('opus decode', e),
    })
    this.decoder.configure({
      codec: 'opus',
      sampleRate: OUTPUT_SAMPLE_RATE,
      numberOfChannels: 1,
    })
  }

  private schedule(data: AudioData): void {
    const ctx = this.ctx
    if (!ctx) {
      data.close()
      return
    }
    const frames = data.numberOfFrames
    // Rate THẬT của dữ liệu đã giải mã, KHÔNG phải OUTPUT_SAMPLE_RATE đã cấu
    // hình. WebCodecs bỏ qua sampleRate truyền vào configure() và luôn xuất
    // 48kHz cho Opus (đo thật trên Chromium 149: 2880 frame/packet 60ms nghĩa
    // là 48000Hz, không phải 24000Hz). Nếu giả định lại 24000 ở đây, buffer sẽ
    // khai sai rate và cursor trôi dần -> phát chậm nửa tốc, tiếng rè.
    const sampleRate = data.sampleRate
    const pcm = new Float32Array(frames)
    data.copyTo(pcm, { planeIndex: 0, format: 'f32-planar' })
    data.close()

    const buf = ctx.createBuffer(1, frames, sampleRate)
    buf.copyToChannel(pcm, 0)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)

    const at = nextStartTime(ctx.currentTime, this.cursor)
    src.start(at)
    this.cursor = at + chunkDuration(frames, sampleRate)
    this.sources.push(src)
    src.onended = () => {
      this.sources = this.sources.filter((s) => s !== src)
    }
  }

  push(packet: ArrayBuffer): void {
    this.ensure()
    // Frame 60ms @ 24kHz. timestamp tính bằng micro giây.
    const chunk = new EncodedAudioChunk({
      type: 'key', // Opus: mọi frame đều độc lập
      timestamp: this.timestamp,
      data: packet,
    })
    this.timestamp += 60_000
    this.decoder?.decode(chunk)
  }

  get playing(): boolean {
    return this.sources.length > 0
  }

  /** Barge-in: im NGAY. Người dùng đã nói đè lên -- nghe tiếp là sai. */
  stop(): void {
    this.sources.forEach((s) => {
      try {
        s.stop()
      } catch {
        // đã dừng rồi
      }
    })
    this.sources = []
    this.cursor = 0
    this.timestamp = 0
    try {
      this.decoder?.close()
    } catch {
      // chưa configure
    }
    this.decoder = null
    void this.ctx?.close()
    this.ctx = null
  }
}
