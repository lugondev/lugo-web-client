# Talk Session Continuity + Skip/Stop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Talk screen, "Start talking" resumes the most recent conversation instead of always creating a new one, History gets a "Continue" action to resume any specific past conversation, and the Stop button becomes "Skip" while Lugo is talking/thinking so users can cut in without ending the call.

**Architecture:** Two independent slices, built bottom-up. Skip/Stop is a pure UI change (new `controlFor(state)` helper + wiring in `Talk.tsx`, reusing the existing `Conversation.abort()`/`{type:"abort"}` mechanism — no backend involvement). Session continuity threads an optional `session_id` from `Talk` through `Conversation`/`buildParams` to the already-resume-capable backend WS endpoint, plus a `resumeSessionId`/`onResumed` prop pair that `App.tsx` uses to hand off from History's new "Continue" buttons to Talk.

**Tech Stack:** React 19 + TypeScript, Vitest + @testing-library/react, oxlint. No backend changes.

## Global Constraints

- No backend/API changes — the WS endpoint already resumes a session when given a valid `session_id`, and `GET /v1/sessions` already sorts newest-first.
- Skip sends the **existing** `{type: "abort"}` WS message (via `Conversation.abort()`) — do not introduce a new message type.
- No "create new session" button is added anywhere in History.
- "Continue" (both from a History list row and from the Detail view) auto-connects immediately — the user does not tap "Start talking" again afterward.
- A failed session-history lookup must never block "Start talking" — always fall back to starting a fresh session.
- Follow existing repo conventions: pure logic extracted into small sibling files with dedicated tests (see `talkProfile.ts`/`talkProfile.test.ts`), Vietnamese "why" comments only where non-obvious, oxlint has no `exhaustive-deps` rule so effect dependency arrays don't need suppression comments.

---

### Task 1: Skip vs Stop control on the Talk screen

**Files:**
- Create: `src/screens/talkControl.ts`
- Create: `src/screens/talkControl.test.ts`
- Modify: `src/screens/Talk.tsx`

**Interfaces:**
- Produces: `controlFor(state: TalkState): { label: string; kind: 'start' | 'skip' | 'stop' }` from `src/screens/talkControl.ts` — exhaustive over all six `TalkState` values.
- Produces: `Talk.tsx` gains a `skip()` function (`convRef.current?.abort()`) alongside the existing `stop()`.

- [ ] **Step 1: Write the failing test for `controlFor`**

```ts
// src/screens/talkControl.test.ts
import { describe, expect, it } from 'vitest'
import { controlFor } from './talkControl'

describe('controlFor', () => {
  it('shows Skip while Lugo is thinking or speaking — only ends the current turn', () => {
    expect(controlFor('thinking')).toEqual({ label: 'Skip', kind: 'skip' })
    expect(controlFor('speaking')).toEqual({ label: 'Skip', kind: 'skip' })
  })

  it('shows Stop while listening or connecting — ends the whole call', () => {
    expect(controlFor('listening')).toEqual({ label: 'Stop', kind: 'stop' })
    expect(controlFor('connecting')).toEqual({ label: 'Stop', kind: 'stop' })
  })

  it('shows Start talking when idle or errored', () => {
    expect(controlFor('idle')).toEqual({ label: 'Start talking', kind: 'start' })
    expect(controlFor('error')).toEqual({ label: 'Start talking', kind: 'start' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/talkControl.test.ts`
Expected: FAIL — `Failed to resolve import "./talkControl"` (file doesn't exist yet).

- [ ] **Step 3: Write `talkControl.ts`**

```ts
// src/screens/talkControl.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/talkControl.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire `controlFor` into `Talk.tsx`**

Add the import (alongside the other local imports, `src/screens/Talk.tsx:7-8`):

```ts
import { PROFILE_KEY, resolveInitialProfile } from './talkProfile'
import { controlFor } from './talkControl'
import './Talk.css'
```

Add `skip()` and the `control` value right after the existing `stop()` function (`src/screens/Talk.tsx:87-93`, replace the block through `const live = ...`):

```tsx
  function stop() {
    convRef.current?.disconnect()
    convRef.current = null
    setState('idle')
  }

  function skip() {
    convRef.current?.abort()
  }

  const live = state !== 'idle' && state !== 'error'
  const control = controlFor(state)
```

Replace the controls render block (`src/screens/Talk.tsx:138-147`):

```tsx
      <div className="talk__controls">
        {control.kind === 'start' ? (
          <Button variant="primary" onClick={start}>
            {control.label}
          </Button>
        ) : (
          <Button variant="secondary" onClick={control.kind === 'skip' ? skip : stop}>
            {control.label}
          </Button>
        )}
      </div>
```

(`live` stays in use elsewhere in the file — the profile-select `disabled={live}` and the hint-text branches — leave those untouched.)

- [ ] **Step 6: Run the full test suite and typecheck to confirm no regressions**

Run: `npm run test && npx tsc -b`
Expected: all existing tests still pass (including `src/screens/Talk.test.tsx`'s profile-picker tests, unaffected by this change), typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/screens/talkControl.ts src/screens/talkControl.test.ts src/screens/Talk.tsx
git commit -m "feat(talk): Skip replaces Stop while Lugo is thinking or speaking"
```

---

### Task 2: Thread an optional `session_id` through `Conversation`

**Files:**
- Modify: `src/audio/conversation.ts`
- Modify: `src/audio/conversation.test.ts`

**Interfaces:**
- Produces: `buildParams(profile?: string, sessionId?: string): URLSearchParams` (adds `session_id` only when given).
- Produces: `new Conversation(cb, profile?, sessionId?)` — third constructor arg, forwarded into `buildParams` inside `connect()`.

- [ ] **Step 1: Write the failing test**

Add to `src/audio/conversation.test.ts`, inside the existing `describe('buildParams', ...)` block (after the `'adds profile only when given'` test, `conversation.test.ts:31-35`):

```ts
  it('adds session_id only when given', () => {
    expect(buildParams(undefined, 's1').get('session_id')).toBe('s1')
    expect(buildParams().has('session_id')).toBe(false)
    expect(buildParams('esp32', 's1').get('session_id')).toBe('s1')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/audio/conversation.test.ts`
Expected: FAIL — `buildParams(undefined, 's1').get('session_id')` is `null`, not `'s1'` (second param doesn't exist yet).

- [ ] **Step 3: Implement**

Replace `buildParams` (`src/audio/conversation.ts:12-23`):

```ts
export function buildParams(profile?: string, sessionId?: string): URLSearchParams {
  const p = new URLSearchParams({
    // Opus qua chính socket đã xác thực: audio_out=url sẽ trỏ vào /artifacts,
    // vốn KHÔNG có auth -- ai có URL cũng nghe được hội thoại.
    audio_out: 'opus',
    output: 'audio,text',
    sample_rate: '16000',
    output_sample_rate: '24000',
  })
  if (profile) p.set('profile', profile)
  if (sessionId) p.set('session_id', sessionId)
  return p
}
```

Replace the class fields + constructor (`src/audio/conversation.ts:32-43`):

```ts
export class Conversation {
  private ws: WebSocket | null = null
  private mic = new Mic()
  private player = new Player()
  private state: TalkState = 'idle'
  private cb: ConversationCallbacks
  private profile?: string
  private sessionId?: string

  constructor(cb: ConversationCallbacks = {}, profile?: string, sessionId?: string) {
    this.cb = cb
    this.profile = profile
    this.sessionId = sessionId
  }
```

Update the WS URL construction inside `connect()` (`src/audio/conversation.ts:68`):

```ts
    this.ws = new WebSocket(wsUrl(ApiUrl(''), `/v1/conversation/stream?${buildParams(this.profile, this.sessionId)}`), [
      'bearer',
      token,
    ])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/audio/conversation.test.ts`
Expected: PASS (all `buildParams`/`wsUrl` tests)

- [ ] **Step 5: Commit**

```bash
git add src/audio/conversation.ts src/audio/conversation.test.ts
git commit -m "feat(audio): Conversation accepts an optional session_id to resume"
```

---

### Task 3: `Talk.tsx` resumes the latest session, and accepts an explicit one

**Files:**
- Create: `src/screens/talkSession.ts`
- Create: `src/screens/talkSession.test.ts`
- Modify: `src/screens/Talk.tsx`
- Modify: `src/screens/Talk.test.tsx`

**Interfaces:**
- Consumes: `listSessions(limit?, offset?): Promise<SessionRow[]>` from `src/api/history.ts` (already exists, newest-first).
- Consumes: `new Conversation(cb, profile?, sessionId?)` from Task 2.
- Produces: `latestSessionId(rows: SessionRow[]): string | undefined` from `src/screens/talkSession.ts`.
- Produces: `Talk` accepts new optional props `resumeSessionId?: string | null` and `onResumed?: () => void` — consumed by Task 5 (`App.tsx`).

- [ ] **Step 1: Write the failing test for `latestSessionId`**

```ts
// src/screens/talkSession.test.ts
import { describe, expect, it } from 'vitest'
import { latestSessionId } from './talkSession'

const ROW = (id: string) => ({
  id, profile_id: 'p', user_id: null, created_at: null, ended_at: null,
  meta: {}, message_count: 0, preview: '',
})

describe('latestSessionId', () => {
  it('returns the id of the first (most recent) row', () => {
    expect(latestSessionId([ROW('s1'), ROW('s2')])).toBe('s1')
  })
  it('returns undefined when there are no sessions', () => {
    expect(latestSessionId([])).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/talkSession.test.ts`
Expected: FAIL — `Failed to resolve import "./talkSession"`.

- [ ] **Step 3: Write `talkSession.ts`**

```ts
// src/screens/talkSession.ts
import type { SessionRow } from '../api/history'

/** id của phiên gần nhất, nếu có -- dùng để Start talking nối tiếp thay vì
 * luôn tạo phiên mới. Không có phiên nào (mới tinh, hoặc tra cứu lỗi) ->
 * undefined, Start talking vẫn chạy như trước khi có tính năng này. */
export function latestSessionId(rows: SessionRow[]): string | undefined {
  return rows[0]?.id
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/talkSession.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing tests for `Talk.tsx`'s resume behavior**

Replace the top of `src/screens/Talk.test.tsx` (imports and mocks, lines 1-14) with:

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/profiles', () => ({
  listProfiles: vi.fn(),
}))
vi.mock('../api/history', () => ({
  listSessions: vi.fn(),
}))
vi.mock('../audio/conversation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../audio/conversation')>()
  return { ...actual, Conversation: vi.fn() }
})
import { listSessions } from '../api/history'
import { listProfiles } from '../api/profiles'
import { Conversation } from '../audio/conversation'
import { Talk } from './Talk'
import { PROFILE_KEY } from './talkProfile'

const LIST = [
  { name: 'esp32', owner_id: null, nickname: 'ESP32' },
  { name: 'rpi', owner_id: null, nickname: 'RPI' },
]
```

(The `const LIST = [...]` block already exists at `Talk.test.tsx:11-14` — keep it as-is, just note it now sits after the new imports.)

Append a new describe block at the end of `src/screens/Talk.test.tsx`:

```tsx
describe('Talk session continuity', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(listProfiles).mockResolvedValue([] as never)
    // Cần đủ "khả năng" để start() không tự rẽ vào state 'error' trước khi
    // chạm tới logic session -- xem src/audio/capability.test.ts.
    vi.stubGlobal('AudioDecoder', class {})
    vi.stubGlobal('AudioContext', class {})
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => {} } })
    vi.mocked(Conversation).mockImplementation(
      () =>
        ({
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn(),
          abort: vi.fn(),
          level: 0,
        }) as unknown as Conversation,
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('resumes the most recent session when Start talking is pressed with no explicit session', async () => {
    vi.mocked(listSessions).mockResolvedValue([
      { id: 's-latest', profile_id: 'p', user_id: null, created_at: null, ended_at: null, meta: {}, message_count: 1, preview: '' },
    ] as never)
    render(<Talk />)
    fireEvent.click(await screen.findByText('Start talking'))
    await waitFor(() => expect(Conversation).toHaveBeenCalled())
    expect(vi.mocked(Conversation).mock.calls[0][2]).toBe('s-latest')
  })

  it('starts a fresh session when there is no session history', async () => {
    vi.mocked(listSessions).mockResolvedValue([] as never)
    render(<Talk />)
    fireEvent.click(await screen.findByText('Start talking'))
    await waitFor(() => expect(Conversation).toHaveBeenCalled())
    expect(vi.mocked(Conversation).mock.calls[0][2]).toBeUndefined()
  })

  it('still starts when the session lookup fails', async () => {
    vi.mocked(listSessions).mockRejectedValue(new Error('network down'))
    render(<Talk />)
    fireEvent.click(await screen.findByText('Start talking'))
    await waitFor(() => expect(Conversation).toHaveBeenCalled())
    expect(vi.mocked(Conversation).mock.calls[0][2]).toBeUndefined()
  })

  it('auto-connects to an explicit session on mount and skips the lookup entirely', async () => {
    const onResumed = vi.fn()
    render(<Talk resumeSessionId="s-picked" onResumed={onResumed} />)
    await waitFor(() => expect(Conversation).toHaveBeenCalled())
    expect(vi.mocked(Conversation).mock.calls[0][2]).toBe('s-picked')
    expect(listSessions).not.toHaveBeenCalled()
    await waitFor(() => expect(onResumed).toHaveBeenCalled())
  })
})
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run src/screens/Talk.test.tsx`
Expected: FAIL — `Talk` doesn't accept `resumeSessionId`/`onResumed` props yet, and `start()` never calls `listSessions` or passes a third arg to `Conversation`.

- [ ] **Step 7: Implement resume logic in `Talk.tsx`**

Add imports (alongside the existing ones, `src/screens/Talk.tsx:1-9`):

```ts
import { listSessions } from '../api/history'
import { latestSessionId } from './talkSession'
```

Change the component signature (`src/screens/Talk.tsx:19`):

```tsx
export function Talk({
  resumeSessionId = null,
  onResumed,
}: { resumeSessionId?: string | null; onResumed?: () => void } = {}) {
```

Replace `start()` (`src/screens/Talk.tsx:61-85`) with:

```tsx
  async function start(explicitSessionId?: string) {
    const support = checkAudioSupport()
    if (!support.ok) {
      // Nói thật thiếu gì, và nói cách sửa. Không "trình duyệt không hỗ trợ".
      setError(`This browser is missing ${support.missing.join(', ')}. Open it in a recent Chrome or Edge, over HTTPS.`)
      setState('error')
      return
    }
    setError(null)
    setReply('')
    setYou('')
    // Có id chỉ định (đến từ History/Continue) -> dùng thẳng, không tra cứu.
    // Không thì lấy phiên gần nhất; tra cứu lỗi không được chặn Start talking.
    let sessionId = explicitSessionId
    if (!sessionId) {
      try {
        sessionId = latestSessionId(await listSessions(1))
      } catch {
        // bỏ qua -- cứ bắt đầu phiên mới như trước khi có tính năng này
      }
    }
    const conv = new Conversation({
      onState: (s) => {
        setState(s)
        // Lượt mới bắt đầu -> xoá lượt cũ. Không làm thế thì các lượt dính
        // vào nhau thành một khối chữ dài vô tận.
        if (s === 'thinking') setReply('')
      },
      onUserText: setYou,
      onReplyText: (t) => setReply((prev) => (prev ? `${prev} ${t}` : t)),
      onError: (m) => setError(m),
    }, profile || undefined, sessionId)
    convRef.current = conv
    await conv.connect()
  }
```

Add a mount effect for the explicit-resume path — place it right after the existing profile-loading effect (`src/screens/Talk.tsx:44-54`):

```tsx
  // Đến từ History (Continue) -> tự kết nối luôn, không chờ bấm Start talking
  // lần nữa. resumeSessionId chỉ tiêu thụ một lần: onResumed() báo cho App
  // xoá nó đi, nên quay lại Talk sau đó không tự resume lại phiên cũ.
  useEffect(() => {
    if (!resumeSessionId) return
    void start(resumeSessionId).then(() => onResumed?.())
  }, [resumeSessionId])
```

Fix the "Start talking" button's `onClick` so the click event isn't accidentally passed as `explicitSessionId` (`src/screens/Talk.tsx`, inside the controls block from Task 1):

```tsx
          <Button variant="primary" onClick={() => void start()}>
            {control.label}
          </Button>
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/screens/Talk.test.tsx`
Expected: PASS (profile-picker tests + 4 new session-continuity tests)

- [ ] **Step 9: Run the full suite and typecheck**

Run: `npm run test && npx tsc -b`
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add src/screens/talkSession.ts src/screens/talkSession.test.ts src/screens/Talk.tsx src/screens/Talk.test.tsx
git commit -m "feat(talk): Start talking resumes the most recent session; accept an explicit one to resume"
```

---

### Task 4: "Continue" button in History (list rows + detail view)

**Files:**
- Modify: `src/screens/History.tsx`
- Modify: `src/screens/History.css`
- Create: `src/screens/History.test.tsx`

**Interfaces:**
- Consumes: `listSessions`, `getSession`, `deleteSession` from `src/api/history.ts` (unchanged).
- Produces: `History` requires a new prop `onContinue: (id: string) => void` — consumed by Task 5 (`App.tsx`).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/screens/History.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/history', () => ({
  listSessions: vi.fn(),
  getSession: vi.fn(),
  deleteSession: vi.fn(),
}))
import { getSession, listSessions } from '../api/history'
import { History } from './History'

const ROW = {
  id: 's1', profile_id: 'p', user_id: null, created_at: '2026-07-17T10:00:00Z',
  ended_at: null, meta: {}, message_count: 2, preview: 'Xin chào',
}

describe('History continue', () => {
  beforeEach(() => {
    vi.mocked(listSessions).mockResolvedValue([ROW] as never)
  })

  it('calls onContinue with the row id, without opening the detail view', async () => {
    const onContinue = vi.fn()
    render(<History onContinue={onContinue} />)
    fireEvent.click(await screen.findByText('Continue'))
    expect(onContinue).toHaveBeenCalledWith('s1')
    expect(screen.queryByText('Back')).toBeNull()
  })

  it('still opens the detail view when the row itself is tapped', async () => {
    vi.mocked(getSession).mockResolvedValue({ ...ROW, messages: [] } as never)
    render(<History onContinue={vi.fn()} />)
    fireEvent.click(await screen.findByText('Xin chào'))
    expect(await screen.findByText('Back')).toBeTruthy()
  })

  it('detail view also has a Continue button that calls onContinue', async () => {
    vi.mocked(getSession).mockResolvedValue({ ...ROW, messages: [] } as never)
    const onContinue = vi.fn()
    render(<History onContinue={onContinue} />)
    fireEvent.click(await screen.findByText('Xin chào'))
    fireEvent.click(await screen.findByText('Continue'))
    expect(onContinue).toHaveBeenCalledWith('s1')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/screens/History.test.tsx`
Expected: FAIL — `History` doesn't accept `onContinue`, no "Continue" text anywhere yet (TypeScript error on the missing required prop, and no matching text found at runtime).

- [ ] **Step 3: Implement — `History.tsx`**

Change the `Detail` component's props and button bar (`src/screens/History.tsx:8, 36-45`):

```tsx
function Detail({
  id,
  onBack,
  onDeleted,
  onContinue,
}: { id: string; onBack: () => void; onDeleted: () => void; onContinue: (id: string) => void }) {
```

```tsx
  return (
    <main className="his">
      <div className="his__bar">
        <Button variant="secondary" size="sm" onClick={onBack}>
          Back
        </Button>
        <div className="his__bar-right">
          <Button variant="primary" size="sm" onClick={() => onContinue(id)}>
            Continue
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        </div>
      </div>
```

Change the `History` component's signature and where it renders `Detail` (`src/screens/History.tsx:82, 101-112`):

```tsx
export function History({ onContinue }: { onContinue: (id: string) => void }) {
```

```tsx
  if (open) {
    return (
      <Detail
        id={open}
        onBack={() => setOpen(null)}
        onDeleted={() => {
          setOpen(null)
          void refresh()
        }}
        onContinue={onContinue}
      />
    )
  }
```

Restructure the list row so "view" and "continue" are two separate, sibling controls — not a button nested inside a button (`src/screens/History.tsx:128-139`):

```tsx
        <ul className="his__list">
          {rows.map((r) => (
            <li key={r.id} className="his__item">
              <button className="his__row" onClick={() => setOpen(r.id)}>
                <p className="his__preview">{r.preview || 'No content'}</p>
                <p className="his__meta">
                  {relativeTime(r.created_at)} · {r.message_count} messages
                </p>
              </button>
              <Button variant="secondary" size="sm" className="his__continue" onClick={() => onContinue(r.id)}>
                Continue
              </Button>
            </li>
          ))}
        </ul>
```

- [ ] **Step 4: Add supporting CSS**

Append to `src/screens/History.css`:

```css
.his__item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.his__item .his__row {
  flex: 1;
}

.his__continue {
  flex: none;
}

.his__bar-right {
  display: flex;
  gap: 8px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/screens/History.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm run test && npx tsc -b`
Expected: all green. (`App.tsx` will now fail to typecheck because `<History />` is missing the required `onContinue` prop — that's expected and gets fixed in Task 5, next.)

- [ ] **Step 7: Commit**

```bash
git add src/screens/History.tsx src/screens/History.css src/screens/History.test.tsx
git commit -m "feat(history): add Continue action to resume a specific past session"
```

---

### Task 5: Wire History → Talk through `App.tsx`

**Files:**
- Modify: `src/App.tsx`
- Create: `src/App.test.tsx`

**Interfaces:**
- Consumes: `Talk`'s `resumeSessionId`/`onResumed` props (Task 3) and `History`'s `onContinue` prop (Task 4).

- [ ] **Step 1: Write the failing tests**

```tsx
// src/App.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveTokens } from './api/tokens'

vi.mock('./screens/Talk', () => ({
  Talk: ({ resumeSessionId, onResumed }: { resumeSessionId: string | null; onResumed?: () => void }) => (
    <div>
      <span>resume:{resumeSessionId ?? 'none'}</span>
      <button onClick={onResumed}>consume</button>
    </div>
  ),
}))
vi.mock('./screens/History', () => ({
  History: ({ onContinue }: { onContinue: (id: string) => void }) => (
    <button onClick={() => onContinue('s-picked')}>go-continue</button>
  ),
}))

import App from './App'

describe('App session-continue wiring', () => {
  beforeEach(() => {
    localStorage.clear()
    saveTokens('acc', 'ref')
  })

  it('starts on Talk with no session to resume', () => {
    render(<App />)
    expect(screen.getByText('resume:none')).toBeTruthy()
  })

  it('continuing a session from History returns to Talk with that id, then clears it once consumed', () => {
    render(<App />)
    fireEvent.click(screen.getByText('History'))
    fireEvent.click(screen.getByText('go-continue'))
    expect(screen.getByText('resume:s-picked')).toBeTruthy()
    fireEvent.click(screen.getByText('consume'))
    expect(screen.getByText('resume:none')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — `App` renders `<Talk />`/`<History />` with no props today, so the mocked components never receive `resumeSessionId`/`onContinue`.

- [ ] **Step 3: Implement — `App.tsx`**

Replace the whole file:

```tsx
import { useEffect, useState, type ComponentType } from 'react'
import './theme.css'
import { isAuthed, logout } from './api/auth'
import { onAuthLost } from './api/client'
import { Nav, type Screen } from './components/Nav'
import { Devices } from './screens/Devices'
import { History } from './screens/History'
import { Login } from './screens/Login'
import { Profiles } from './screens/Profiles'
import { Talk } from './screens/Talk'
import { Tools } from './screens/Tools'

// Talk và History cần props (nối tiếp phiên) nên render riêng bên dưới,
// không qua bản đồ Screen -> component chung như 3 màn còn lại.
const SCREENS: Record<Exclude<Screen, 'talk' | 'history'>, ComponentType> = {
  profiles: Profiles,
  devices: Devices,
  tools: Tools,
}

export default function App() {
  const [authed, setAuthed] = useState(isAuthed())
  const [screen, setScreen] = useState<Screen>('talk')
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null)

  // Refresh thất bại ở bất kỳ request nào -> quay về Login. Đây là lý do
  // client.ts có onAuthLost thay vì tự điều hướng: lớp API không biết gì về UI.
  useEffect(() => {
    onAuthLost(() => setAuthed(false))
  }, [])

  if (!authed) return <Login onDone={() => setAuthed(true)} />

  function signOut() {
    logout()
    setAuthed(false)
    setScreen('talk')
  }

  // Từ History bấm Continue -> sang Talk và tự resume đúng phiên đó.
  function goToTalk(id: string) {
    setResumeSessionId(id)
    setScreen('talk')
  }

  let active
  if (screen === 'talk') {
    active = <Talk resumeSessionId={resumeSessionId} onResumed={() => setResumeSessionId(null)} />
  } else if (screen === 'history') {
    active = <History onContinue={goToTalk} />
  } else {
    const Active = SCREENS[screen]
    active = <Active />
  }

  return (
    <>
      {active}
      <Nav current={screen} onGo={setScreen} onLogout={signOut} />
    </>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full suite, typecheck, and lint**

Run: `npm run test && npx tsc -b && npm run lint`
Expected: all green — this also confirms Task 4's `<History />` prop-typing gap is now resolved.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(app): wire History Continue through to Talk's session resume"
```

---

### Task 6: Manual verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify Skip vs Stop**

Log in, tap "Start talking", say something. While Lugo is "Thinking" or "Speaking", confirm the button reads **Skip** — tapping it cuts Lugo off and the state returns to "Listening" without ending the call. While "Listening" or "Connecting", confirm the button reads **Stop** — tapping it ends the call and returns to the idle "Start talking" screen.

- [ ] **Step 3: Verify session resume**

Have a short exchange with Lugo, then tap Stop. Tap "Start talking" again and check (via Network tab or the History screen afterward) that the new WS connection carries `session_id` for the same session, and the conversation's message count keeps growing in History rather than a new row appearing each time.

- [ ] **Step 4: Verify History → Continue**

Go to History. Confirm there is no "create new session" affordance anywhere. Tap "Continue" on a list row — confirm it switches to Talk and connects automatically (no extra "Start talking" tap needed) into that specific session. Repeat by opening a row's Detail view first, then tapping its "Continue" button.

- [ ] **Step 5: Stop the dev server**

---

## Self-Review

**Spec coverage:**
- Skip label/behavior while thinking/speaking, Stop while listening/connecting, reusing the existing `abort()`/`{type:"abort"}` mechanism → Task 1.
- `session_id` threaded through `Conversation`/`buildParams` → Task 2.
- "Start talking" resumes latest session; failed lookup doesn't block starting → Task 3.
- History gets Continue on both list rows and Detail view, no create-new-session button → Task 4.
- Continue auto-connects (no extra tap), wired end-to-end via `App.tsx` → Task 5.
- Manual smoke test across both features → Task 6.

**Type consistency:** `controlFor`'s `kind` union (`'start' | 'skip' | 'stop'`) is used identically in Task 1's render. `Talk`'s `resumeSessionId?: string | null` / `onResumed?: () => void` (Task 3) match exactly what `App.tsx` passes in Task 5. `History`'s `onContinue: (id: string) => void` (Task 4) matches `goToTalk(id: string)` in Task 5. `Conversation`'s constructor `(cb, profile?, sessionId?)` (Task 2) matches every call site (`Talk.tsx`'s `start()`, Task 3).

**No placeholders:** every step has complete, runnable code — no TBDs.
