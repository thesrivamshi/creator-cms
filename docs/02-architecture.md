# 02 — Architecture

## Stack (fixed)
- **Next.js 14+** — App Router, TypeScript, single repo for UI + API routes
- **Supabase** — Postgres, Auth (email magic link), Storage (audio, images)
- **Vercel** — hosting + serverless functions
- **Tailwind CSS** — styling; iPad-first responsive
- **AI**: Anthropic API (writing/long tasks) + OpenAI API (small tasks + Whisper
  transcription), both user-supplied keys via provider layer (see 06)

Why this stack: zero servers to manage, free tiers cover a solo user entirely,
and Supabase gives auth + database + file storage in one service, which keeps the
self-hosting story to two accounts (Supabase, Vercel).

## High-level flow
```
iPad share sheet ──(iOS Shortcut POST)──▶ /api/capture/link ─▶ scrape/transcript ─▶ AI tag ─▶ ideas
in-app record btn ──(audio upload)──────▶ /api/capture/voice ─▶ Whisper ─▶ AI tag ─────────▶ ideas
ideas ─▶ Script Studio (hook/story/end + parts + visuals) ─▶ tone adapter ─▶ variants
variants ─▶ calendar (schedule) ─▶ copy & manually post ─▶ mark posted
```

## Repo structure
```
/app
  /(auth)/login
  /inbox            # idea list
  /idea/[id]        # idea detail + script studio
  /calendar
  /settings         # BYOK keys, brand voice guidelines editor
  /api
    /capture/link/route.ts
    /capture/voice/route.ts
    /ai/route.ts    # single AI proxy endpoint (see 06)
/lib
  /ai               # provider abstraction: anthropic.ts, openai.ts, router.ts
  /scrape           # youtube.ts (transcript), meta.ts (og-tags fallback)
  /crypto.ts        # key encryption helpers
  /supabase         # client/server helpers
/supabase
  /migrations/0001_init.sql   # from 03-data-model.md
/docs               # this spec pack, committed to the repo
```

## Auth model
Supabase email magic-link auth. Solo-user app, but real auth from day one because:
(1) RLS policies need an authenticated identity, (2) self-hosters get login for free,
(3) API keys must be tied to a user row.

## Capture endpoint security
/api/capture/link is called by an iOS Shortcut which cannot do OAuth. Use a
per-user **capture token**: random 32-byte token generated in Settings, sent as
a Bearer header by the Shortcut, checked server-side against the user row.
Rotatable from Settings.

## Scaling notes (design as if 1M users, run for 1)
- **Stateless API routes** — all state in Postgres/Storage, so horizontal scaling
  is automatic on Vercel. Tradeoff: cold starts; fine at this scale.
- **RLS everywhere** — every table keyed by user_id with row-level security. Solo
  today, but this is what makes multi-tenant possible without a rewrite.
- **Provider abstraction for AI** — swapping/adding models is config, not surgery.
- **Long tasks** (transcription of long videos) run in the request in v1 (Vercel
  60s limit is enough for Whisper on <20min audio). At scale you'd move to a queue
  (e.g. Supabase queues / Inngest). Leave a TODO marker, do not build the queue.
- **Storage paths** namespaced by user_id: `audio/{user_id}/{idea_id}.m4a`,
  `visuals/{user_id}/{part_id}.png`.

## iPad-first UI rules
- Touch targets ≥ 44px; drag-and-drop must work with touch events, not just mouse
- No hover-dependent affordances
- Recording UI must survive screen rotation and brief backgrounding
- PWA manifest + installable; test in iPad Safari specifically
