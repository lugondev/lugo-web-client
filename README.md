# lugo-web-client

React + TypeScript web client for the [LUGO gateway](https://github.com/lugondev/lugo-gateway).

The browser front end of the LUGO companion platform: hold a voice conversation, manage
the profiles that decide which STT/TTS/LLM engines run, pair and administer devices,
read back history, and watch usage.

## Screens

| Screen | What |
| --- | --- |
| **Talk** | The voice conversation — streaming mic uplink, barge-in, live transcript |
| **Profiles** | Create and edit profiles: STT engine and language, TTS voice, LLM model and system prompt, MCP tools, memory |
| **Devices** | Pair, rename, reassign and revoke ESP32 / Raspberry Pi devices |
| **History** | Past sessions and their transcripts |
| **Tools** | The MCP tools a profile can call |
| **Usage** | Per-user spend and quota |
| **Settings** | Account and system configuration |

Auth is bearer/session against the gateway; the screens available depend on the
signed-in user's role.

## Stack

Vite + React 19 + TypeScript. No runtime UI dependencies beyond React and the bundled
fonts (Be Vietnam Pro, IBM Plex Mono) — the design system lives in `src/theme.css`.

```
src/
  screens/   one directory or file per screen
  api/       one typed module per gateway resource, each with its own tests
  audio/     mic capture, Opus, playback
  ui/        shared presentational components
  lib/       helpers
```

## Develop

```bash
pnpm install
pnpm dev        # dev server with HMR
pnpm build      # typecheck + production build -> dist/
pnpm preview    # serve the production build
pnpm lint       # oxlint
```

A gateway must be running for anything beyond the login screen to work.

## Test

```bash
pnpm test       # vitest unit tests
pnpm e2e        # browser end-to-end (also :talk :devices :history :tools :audio :states)
```

---

## Part of LUGO

**LUGO** is a self-hosted AI companion platform — models supply the intelligence, LUGO
supplies the experience: one assistant that talks, remembers and acts across the browser,
ESP32 boards and a Raspberry Pi.

This repository is one piece of it. Every client and service talks to the gateway:

| Repo | Role |
| --- | --- |
| [lugo-gateway](https://github.com/lugondev/lugo-gateway) | The hub — STT/TTS/LLM engines, auth, device pairing, MCP tools, per-user chat memory. Everything below talks to this. |
| **lugo-web-client** &nbsp;&larr; you are here | React + TypeScript web client: talk, devices, history, tools. |
| [esp32-assistant](https://github.com/lugondev/esp32-assistant) | ESP-IDF firmware for ESP32-S3 / ESP32-C3 — a hands-free voice terminal. |
| [rpi-assistant](https://github.com/lugondev/rpi-assistant) | Raspberry Pi voice client (mic capture, Opus duplex, systemd unit). |
| [knowledge-api](https://github.com/lugondev/knowledge-api) | **kbase** — RAG knowledge base: documents in, retrievable chunks out. |
| [router-memory-services](https://github.com/lugondev/router-memory-services) | **memgw** — one API in front of any AI memory provider (Mem0, Zep, pgvector). |
| [mcp-basic-tools](https://github.com/lugondev/mcp-basic-tools) | Remote MCP tool server (timedate, fetch, ipinfo, web search). |
| [livehost-api](https://github.com/lugondev/livehost-api) | TikTok Live AI co-host, an out-of-process gateway plugin. |
| [voiceprint-api](https://github.com/lugondev/voiceprint-api) | Speaker recognition (3D-Speaker), forked from [xinnan-tech/voiceprint-api](https://github.com/xinnan-tech/voiceprint-api). |
| [lugo-landing](https://github.com/lugondev/lugo-landing) | Marketing landing page for the platform, bilingual (Tiếng Việt / English). |
