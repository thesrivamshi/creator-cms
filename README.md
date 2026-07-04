# Creator CMS

A self-hostable content system for solo creators. Capture ideas the moment they
strike (shared link or voice note) → AI tags and organizes them → write
Hook / Story / End scripts in Script Studio → generate platform-native variants
in your two brand voices (Instagram / Twitter / LinkedIn) → drag them onto a
calendar → copy and post manually.

**BYOK (bring your own keys):** you paste your own OpenAI and Anthropic API keys
into the app's Settings. They're encrypted (AES-256-GCM) in *your* database,
used only server-side, never logged. No vendor keys ship with this code. No
subscription. The full spec pack lives in [/docs](docs/).

## Self-host in ~15 minutes

You need: a [GitHub](https://github.com) account, a free [Supabase](https://supabase.com)
account, and a free [Vercel](https://vercel.com) account.

### 1. Fork this repo (1 min)

Click **Fork** on GitHub.

### 2. Create the Supabase project (4 min)

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
   (any name, pick a strong DB password, region near you).
2. When it's ready, open **SQL Editor** → **New query** and run each file in
   [`supabase/migrations/`](supabase/migrations/) **in order**
   (`0001_init.sql`, `0002_storage.sql`, `0003_model_routes.sql`) — paste,
   **Run**, repeat.
3. Go to **Project Settings → API** and copy three values:
   - Project URL (`https://xxxx.supabase.co`)
   - `anon` public key
   - `service_role` secret key

### 3. Deploy to Vercel (5 min)

1. [vercel.com/new](https://vercel.com/new) → import your fork (framework:
   Next.js, no build changes needed).
2. Under **Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your `anon` key |
   | `SUPABASE_SERVICE_ROLE_KEY` | your `service_role` key |
   | `APP_SECRET` | run `openssl rand -hex 32` and paste the output |

   `APP_SECRET` encrypts your AI keys at rest — infrastructure config, not a
   vendor key.
3. **Deploy**. Note your URL, e.g. `https://your-app.vercel.app`.

### 4. Point Supabase auth at your URL (2 min)

Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: add `https://your-app.vercel.app/**`

### 5. Sign up and add keys (3 min)

1. Open your URL → enter your email → tap the magic link (check spam).
2. **Settings** → paste your [Anthropic](https://console.anthropic.com/settings/keys)
   and [OpenAI](https://platform.openai.com/api-keys) API keys → **Test** should
   show ✓ for each.
3. **Settings → Capture token → Generate** — you'll need it for the share-sheet
   Shortcut: build it in 3 minutes with [docs/ios-shortcut.md](docs/ios-shortcut.md).

Done. Share a YouTube link from your phone, record a voice note from the Inbox,
open Script Studio, generate variants, schedule, copy, post.

## How it fits together

- **Next.js 14 (App Router, TypeScript)** on Vercel — UI + API routes
- **Supabase** — Postgres (row-level security on every table), magic-link auth,
  private storage buckets for voice recordings and visual references
- **Tailwind** — iPad-first UI (44px touch targets, touch drag everywhere)
- **AI provider layer** ([lib/ai](lib/ai)) — all model calls go through one
  gateway; routing defaults: writing → Anthropic `claude-sonnet-4-6`, small
  tasks → OpenAI `gpt-4o-mini`, transcription → `whisper-1`. Override per-task
  in Settings → Model routing.

## Error behavior you can rely on

- **Captures are never lost**: link/voice/note captures save *first*, then
  enrich. If scraping or the model call fails, the raw capture is kept and the
  failure reason is written to the idea's agent notes.
- **Voice recordings are kept permanently** — the original audio uploads before
  transcription; "Transcribe again" retries idempotently.
- **Missing/invalid keys** produce distinct, actionable messages in the UI; the
  app works for capture and manual writing without any keys.
- **YouTube captions**: YouTube frequently blocks server-side caption fetches;
  when that happens the idea is tagged from title+description and the note says
  so. The capture always succeeds.

## Development

```bash
cp .env.example .env.local   # fill in your Supabase values + APP_SECRET
npm install
npm run dev
```

## License

[MIT](LICENSE)
