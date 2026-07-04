# 04 — Capture Flows

Two entry points. Both end with an enriched row in `ideas`.

## A. Link capture (share sheet)

### Trigger
iOS Shortcut on iPad/iPhone: user taps Share on YouTube/IG/Twitter → Shortcut
POSTs `{ "url": "<shared url>" }` to `POST /api/capture/link` with header
`Authorization: Bearer <capture_token>`.

### Pipeline (server)
1. Validate capture token → resolve user_id.
2. Detect source_type from URL host (youtube.com/youtu.be, instagram.com, twitter.com/x.com; else 'article').
3. Extract content:
   - **YouTube**: fetch title/description + captions. Use the `youtubei`-style innertube
     endpoint or `youtube-transcript` npm package; if captions unavailable, fall back
     to title+description only and note it in agent_notes.
   - **Instagram / Twitter**: fetch OpenGraph/oEmbed metadata (title, description,
     author). Do NOT attempt scraping behind login; metadata is enough for v1.
   - **Article**: fetch page, extract main text (readability-style).
4. AI enrichment (small task → OpenAI provider, e.g. gpt-4o-mini):
   input = title + description + transcript (truncate transcript to ~8k tokens);
   output JSON: `{ title, summary, pillar, suggested_brand, agent_notes }`.
   Pillars and brand definitions come from the user's brand_guidelines.
5. Insert idea (status 'captured'). Respond 200 with the idea id fast — the Shortcut
   shows a success banner. If AI enrichment fails, STILL save the raw capture with
   status 'captured' and agent_notes = error; never lose an idea because a model call failed.

### iOS Shortcut
Include `docs/ios-shortcut.md` in the repo: step-by-step to build the Shortcut
(Get URLs from input → Get Contents of URL, POST, JSON body, Bearer header).
The capture token is shown/rotated in Settings.

## B. Voice capture (in-app record)

### UX
Big record button on the Inbox screen (thumb-reachable on iPad). Tap → recording
with visible timer and waveform → tap stop → immediate upload. States: recording,
uploading, transcribing, done. If upload fails, keep the blob in memory/IndexedDB
and offer retry — never silently drop a recording.

### Pipeline
1. Client records via MediaRecorder (audio/mp4 or webm; Safari on iPad = mp4/AAC).
2. Upload original file to Storage `audio/{user_id}/{idea_id}.m4a` FIRST.
   The recording is the source of truth; it is kept permanently.
3. `POST /api/capture/voice` with the storage path → server downloads, sends to
   **OpenAI Whisper** (`whisper-1`) using the user's OpenAI key.
4. Save transcript on the idea. Then run the same AI enrichment as link capture
   (source_type 'voice').
5. Idea detail view shows BOTH: an audio player (signed URL) and the editable
   transcript side by side. Copy button on the transcript.

### Failure rules (binding)
- Audio uploaded but transcription failed → idea exists with audio_path set,
  transcript null, agent_notes explains; UI shows "Transcribe again" button.
- Transcription is retryable and idempotent (overwrites transcript only).

## Shared rules
- Every capture is instant-save-first, enrich-second. Capture must never block
  on AI availability or key validity.
- Max audio length v1: 20 minutes (fits Whisper + Vercel limits). Enforce client-side
  with a soft warning at 15.
