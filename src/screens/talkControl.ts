import type { TalkState } from '../audio/conversation'

export type Control = { label: string; kind: 'start' | 'skip' | 'stop' }

/** The single control button changes with state: while speaking/thinking,
 * Skip only drops the current turn (mic stays connected); while
 * listening/connecting, Stop ends the call entirely. */
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
