# 07 — Build Plan (execute in order, verify each gate)

Every milestone ends deployed and manually verified. Commit to GitHub at each gate.
Report honestly what works and what is stubbed.

## M0 — Repo & rails
- Create GitHub repo `creator-cms`. Next.js + TS + Tailwind scaffold. PWA manifest.
- Supabase project wired (env vars), migration 0001 from 03-data-model.md applied,
  storage buckets `audio` and `visuals` created with owner-only policies.
- Magic-link auth working. Deploy to Vercel.
- GATE: log in on the deployed URL.

## M1 — Settings & BYOK
- Settings page: API key entry (Anthropic, OpenAI) with encrypt/store/test/remove.
- Capture token generate/rotate + display.
- Brand guidelines editor (two persona text blocks stored in profiles.brand_guidelines).
- lib/ai provider layer + /api/ai gateway with routing per 06.
- GATE: Test button returns ✓ for both providers with real keys.

## M2 — Idea Inbox + link capture
- /api/capture/link per 04 (YouTube transcript, IG/Twitter metadata, article fallback).
- AI enrichment (small task). Inbox list with status, brand chip, pillar tag; idea
  detail view with editable fields.
- docs/ios-shortcut.md written; Shortcut tested from an iPhone/iPad.
- GATE: share a YouTube link from iPad → enriched idea appears in Inbox.

## M3 — Voice capture
- Record UI per 04 (MediaRecorder, Safari-tested), upload-first, Whisper transcription,
  retry paths, audio player + transcript side-by-side with copy button.
- GATE: record 1 min on iPad Safari → play back audio AND read transcript.

## M4 — Script Studio
- Hook/Story/End editor per 05: parts CRUD, reorder, split; visual refs (note,
  image paste/upload, drawing canvas); autosave.
- AI assists: suggest hooks, draft parts, suggest ending.
- GATE: build a full script with 3 parts, one of each visual type, on iPad.

## M5 — Variants + Calendar
- Generate platform variants (persona-voiced) → variants list on idea.
- Calendar week/month view; drag variants to slots (touch drag verified);
  copy-to-clipboard; mark posted (+ posted_url).
- GATE: idea → script → 3 variants → scheduled → copied → marked posted, end to end.

## M6 — Self-host polish
- README quickstart: fork → Supabase setup → Vercel deploy → APP_SECRET → migration
  → sign up → keys. Target: under 15 minutes, verified by following it fresh.
- Error states audit (missing keys, failed capture, offline recording).
- License: MIT.
- GATE: fresh deployment from README alone reaches a working capture.

## Explicitly deferred (do not build)
Auto-posting APIs, analytics UI, Canva/Notion, OpenRouter implementation, queues,
multi-user features, payments.
