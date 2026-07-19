import type { TalkState } from '../audio/conversation'

export type Control = { label: string; kind: 'start' | 'skip' | 'stop' }

/** Nút điều khiển duy nhất đổi theo state: đang nói/nghĩ thì Skip chỉ bỏ
 * lượt hiện tại (mic vẫn nối), đang nghe/đang kết nối thì Stop mới dừng
 * hẳn cuộc gọi. */
export function controlFor(state: TalkState): Control {
  switch (state) {
    case 'thinking':
    case 'speaking':
      return { label: 'Skip', kind: 'skip' }
    case 'listening':
    case 'connecting':
      return { label: 'Stop', kind: 'stop' }
    case 'idle':
    case 'error':
      return { label: 'Start talking', kind: 'start' }
  }
}
