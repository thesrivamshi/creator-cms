# 03 — Data Model (authoritative)

Idea is the atomic unit. Scripts hang off ideas; variants hang off ideas (optionally
via a script); schedule hangs off variants. Everything is user-scoped with RLS.

Run as Supabase migration `0001_init.sql` — the authoritative copy lives in
`supabase/migrations/0001_init.sql` in this repo (identical to the SQL below).

See the migration file for the full schema: enums (platform, brand, idea_status,
source_type, variant_status, visual_type, ai_provider), tables (profiles, api_keys,
ideas, scripts, script_parts, variants, schedule), indexes, updated_at triggers,
and own-rows-only RLS policies on every table.

## Storage buckets
- `audio`   — voice recordings, private, path `audio/{user_id}/{idea_id}.m4a`
- `visuals` — pasted images + drawing PNGs, private, path `visuals/{user_id}/{part_id}.png`
Both with owner-only storage policies mirroring RLS (see `supabase/migrations/0002_storage.sql`).

## Notes for Claude Code
- `audio_path` + `transcript` on ideas implements "keep both": the original recording
  is never deleted when transcription succeeds.
- `script_parts.position` is a plain int; renumber on reorder (solo user, no
  concurrency concerns). At scale you'd use fractional indexing — leave a comment.
- `brand_guidelines` jsonb on profiles holds the two persona voice docs so the tone
  adapter prompt is user-editable in Settings, not hardcoded.
