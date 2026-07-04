# 06 — AI Provider Layer (BYOK)

## Principle
Users bring their own keys. The app ships with ZERO vendor keys. Keys are entered
in Settings, encrypted, stored in the user's own database, and used server-side only.
Self-hosters clone → deploy → paste keys → everything works. No subscription anywhere.

## Provider decision
Support **Anthropic** and **OpenAI** directly in v1 (owner will use both:
Claude for writing, OpenAI for small tasks + Whisper). Do NOT route through
OpenRouter by default: it adds a third account + markup for every self-hoster
with no benefit at two providers. BUT: implement the provider interface so
OpenRouter is a drop-in third provider later (the `ai_provider` enum already
includes it; ship the interface, stub the implementation with a clear TODO).

## Key storage
- Settings screen: one field per provider, masked input, shows `sk-...last4` when set,
  Test button (makes a 1-token call, shows ✓/✗), Remove button.
- Server encrypts with AES-256-GCM before insert. Encryption secret = `APP_SECRET`
  env var (generated per deployment, documented in README; this is infrastructure
  config, not a vendor key — acceptable and necessary).
- Keys are decrypted only inside server routes at call time. Never sent to the
  client, never logged, never in error messages.

## Model routing
```ts
// lib/ai/router.ts
type TaskKind = 'writing' | 'small' | 'transcribe';

const DEFAULT_ROUTES: Record<TaskKind, { provider: 'anthropic'|'openai'; model: string }> = {
  writing:    { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  small:      { provider: 'openai',    model: 'gpt-4o-mini' },
  transcribe: { provider: 'openai',    model: 'whisper-1' },
};
```
- Routes overridable per-user in Settings (advanced section, simple dropdowns).
- If the preferred provider's key is missing, fall back to the other provider for
  'writing'/'small' (transcribe requires OpenAI in v1); surface a settings hint.

## Single AI gateway
All client AI actions call `POST /api/ai` with `{ task, payload }`. The route:
1. auth → load + decrypt the right key for the routed provider
2. build prompt (brand_guidelines injected for writing tasks)
3. call provider SDK server-side, stream where useful (hook suggestions, variants)
4. uniform error shape: missing key / invalid key / rate limit / provider down —
   each with a distinct user-facing message

No component or other API route may import provider SDKs directly.

## Cost transparency
Log per-call token usage to console + return usage in responses so a later
Phase-2 "spend this month" widget is trivial. Do not build the widget now.
