# Talk session continuity + Skip/Stop — Design

Date: 2026-07-19

## Problem

Two independent gaps in the Talk experience:

1. **Sessions are throwaway.** Every "Start talking" tap opens a brand-new
   server-side session (`Talk.tsx:61-85` → `Conversation.connect()` never
   sends a `session_id`). History (`History.tsx`) is read-only: you can view
   a past conversation or delete it, but never continue it. There's also no
   way to jump back into "whatever I was just doing" — you always start
   from zero.
2. **Stop is the only control while Lugo is talking/thinking.** Tapping it
   ends the whole call, even if the user only wanted to cut Lugo off and
   keep talking. `Conversation.abort()` (`conversation.ts:151-154`) already
   does exactly that — stops playback, sends `{type: "abort"}`, backend
   cancels the in-flight turn and returns to `listening` — but nothing in
   the UI exposes it.

## Part 1 — Skip vs Stop

**Behavior:** the single control button in `Talk.tsx` (`talk__controls`,
currently lines 138-147) changes label and handler based on `state`:

| state | label | action |
|---|---|---|
| `thinking` / `speaking` | **Skip** | `convRef.current?.abort()` — ends Lugo's current turn only, mic stays connected, returns to `listening` |
| `listening` / `connecting` | **Stop** | `stop()` (unchanged) — full `disconnect()`, ends the call |
| `idle` / `error` | **Start talking** | unchanged |

**WS wire format:** Skip reuses the existing `{type: "abort"}` message —
the same one already sent for barge-in
(`conversation.ts:112-115`). This is confirmed to work correctly
regardless of turn stage: the backend's `_abort_turn`
(`apps/api_gateway/app/services/conversation/session.py:562-571`) cancels
`self.current_turn` — a single task spanning STT → LLM → TTS — via
`Task.cancel()`, which propagates as `CancelledError` from whatever await
point it's at (LLM streaming, tool-call round-trip, etc.), is not
swallowed by the turn's exception handling, and unconditionally emits
`aborted`. No backend change needed.

**Scope:** UI-only change in `Talk.tsx`. No changes to `conversation.ts`
or the backend.

## Part 2 — Always resume the latest session

Backend already supports this: opening the WS with `?session_id=<id>`
that exists causes the server to load prior history and append to that
row instead of creating a new one
(`apps/api_gateway/app/api/routes/conversation.py:190-198`,
`apps/api_gateway/app/services/conversation/session.py:259-275`).
`GET /v1/sessions` (`listSessions()`) already returns rows newest-first
(`ORDER BY created_at DESC`).

### Components

**`conversation.ts`**
- `Conversation` constructor gains an optional `sessionId` param (third
  arg, alongside the existing `cb`/`profile`).
- `buildParams(profile, sessionId?)` sets `session_id` on the
  `URLSearchParams` when provided.
- No other change — resume vs. create-new is entirely a server-side
  decision based on whether the id is present/valid.

**`Talk.tsx`**
- `start()` becomes `start(explicitSessionId?: string)`:
  - If `explicitSessionId` is given (the Continue-from-History path), use
    it directly — skip the lookup.
  - Otherwise call `listSessions(1)` and use `data[0].id` if a row exists.
  - If the lookup throws, or no sessions exist yet, proceed with no
    `session_id` — identical to today's behavior (fresh session). A
    history-fetch failure must never block "Start talking".
- New props: `resumeSessionId?: string | null` and `onResumed?: () => void`.
  On mount, if `resumeSessionId` is set, call `start(resumeSessionId)`
  immediately (auto-connect — the user already chose this session in
  History) and then call `onResumed()`.

**`App.tsx`**
- Lifts `const [resumeSessionId, setResumeSessionId] = useState<string | null>(null)`.
- `goToTalk(id: string)`: sets `screen` to `'talk'` and `resumeSessionId`
  to `id`. Passed down to `History` as `onContinue`.
- Passes `resumeSessionId` and `onResumed={() => setResumeSessionId(null)}`
  to `Talk`. Clearing after consumption means navigating away and back to
  Talk later doesn't re-trigger the same auto-resume.

**`History.tsx`**
- Accepts `onContinue: (id: string) => void`, threaded down to both:
  - **List view**: each row currently is itself a `<button>` that opens
    Detail (`his__row`, lines 129-138) — can't nest a second button
    inside it. Restructure each `<li>` to contain a clickable "view" area
    (div/button, same tap-to-open-Detail behavior) plus a sibling
    **Continue** `Button`.
  - **Detail view**: add a **Continue** button to the existing button bar
    next to Back/Delete (lines 38-45).
- No "create new session" button is added anywhere (none exists today;
  none is introduced).

### Data flow

```
History row/detail "Continue" tap
  → onContinue(id) → App.goToTalk(id) → screen='talk', resumeSessionId=id
  → Talk mounts with resumeSessionId set
  → useEffect: start(resumeSessionId) → Conversation(cb, profile, id).connect()
  → WS opens with ?session_id=id → backend resumes existing session
  → Talk calls onResumed() → App clears resumeSessionId

Talk "Start talking" tap (no prior resumeSessionId)
  → start() → listSessions(1) → data[0]?.id ?? undefined
  → Conversation(cb, profile, id).connect()
  → WS opens with/without session_id → backend resumes latest or creates new
```

### Error handling

- `listSessions(1)` failure during default "Start talking" → swallow,
  proceed without `session_id` (same as a fresh session today).
- `getSession`/`listSessions` failures already surface via the existing
  `his__err` banner in `History.tsx` — unaffected by this change.
- If `explicitSessionId` (from Continue) no longer exists server-side
  (e.g., deleted between viewing History and connecting), the backend's
  existing fallback applies: an unknown `session_id` results in a new
  session being created (`session.py:259-271`) — no special client
  handling needed, this is existing backend behavior.

### Testing

- `buildParams` includes `session_id` when passed, omits it when absent.
- `Talk`: `start()` resolves to explicit id when provided; falls back to
  `listSessions(1)` result when not; falls back to no id when the list is
  empty or the call throws.
- `Talk`: mounting with `resumeSessionId` set triggers auto-connect via
  `start(resumeSessionId)` and calls `onResumed()`.
- `History`: Continue button present on both list rows and Detail view;
  clicking calls `onContinue` with the correct id; row's existing
  tap-to-view-Detail behavior still works after the restructure.
