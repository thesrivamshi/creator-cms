# 01 — Product Specification

## Vision
A solo creator's operating system for content: capture ideas the moment they strike
(shared link or voice note), let AI organize and enrich them, turn them into scripts
and platform-native posts, and schedule them — while keeping one authentic story
rendered in two distinct brand voices.

## Owner & brands
Single user (Sri Vamshi), AI Engineer / creator. Two personas, one story:

### Persona A — "The Real One" (Instagram)
- Voice: unfiltered friend energy. Funny, direct, attention-grabbing, zero polish.
- Audience: ambitious builders/creators. Depth over reach; 1,000 true fans.
- Pillars: raw journey ("confused to 5 income streams"), building in public,
  values/way of working, AI experiments as life content.

### Persona B — "The Operator" (LinkedIn + Twitter/X)
- Voice: high-signal, ownership-oriented, credible. Show the work.
- Audience: founders, VCs, hiring managers, top engineers.
- Pillars: real AI systems built, paper/tool/model breakdowns, product experiments,
  engineer→product transition story.

Platforms in v1: **Instagram, Twitter/X, LinkedIn** (three, fixed).
Capture sources: mostly **YouTube, Instagram, Twitter links** + voice notes + typed notes.

## Core principle
The atomic unit is the **idea**, not the post. Ideas flow:
captured → reviewed → scripted → variants drafted → scheduled → posted.

## MVP features
1. **Idea Inbox** — list of captured ideas with status, brand suggestion, pillar tag.
2. **Link capture** — POST endpoint for iOS Shortcut share sheet. YouTube links get
   transcript extraction; IG/Twitter links get metadata. AI summarizes + tags.
3. **Voice capture** — in-app record button. Stores original audio AND transcript
   (both kept; transcript can miss things, audio is the backup). See 04.
4. **Script Studio** — Hook / Story / End structure, story split into parts, visual
   reference per part (typed note, pasted image, or simple drawing). See 05.
5. **Tone adapter** — generate platform variants from an idea/script in the correct
   persona voice. Claude for writing tasks.
6. **Calendar** — touch-first week/month view, drag variants onto dates.
7. **Manual publish** — copy button per variant; mark posted, store live URL.
8. **Settings / BYOK** — enter OpenAI + Anthropic keys in-app. See 06.

## Non-goals (binding — do not build)
- Direct auto-posting to platform APIs (manual copy-paste in v1)
- Multi-user teams, roles, permissions
- Analytics dashboards (fields exist in schema; UI is Phase 2)
- Canva / Notion integrations (schema + provider layer leave room; do not implement)
- Native iOS app (PWA + iOS Shortcut only)
- Payments/subscriptions of any kind — the product is free, self-hosted, BYOK

## Self-hosting requirement
Anyone can: fork the GitHub repo → create a free Supabase project → deploy to Vercel
→ run one SQL migration → sign up → enter their own API keys → use everything.
README must document this in a 15-minute quickstart. No vendor keys ship with the code.
