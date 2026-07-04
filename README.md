# Creator CMS

A self-hostable, solo-creator content system: capture ideas (shared link or
voice note) → AI tagging → script writing (Hook/Story/End) → tone-adapted
platform variants → calendar → manual publish.

**BYOK**: you supply your own OpenAI and Anthropic API keys in the Settings UI.
No vendor keys ship with this code. Free to self-host on Supabase + Vercel.

> Full self-hosting quickstart lands in M6. Spec pack lives in [/docs](docs/).

## Stack

- Next.js 14 (App Router, TypeScript) on Vercel
- Supabase — Postgres, magic-link auth, storage
- Tailwind CSS, iPad-first

## Development

```bash
cp .env.example .env.local   # fill in your Supabase project values
npm install
npm run dev
```

Apply `supabase/migrations/*.sql` to your Supabase project (SQL editor or CLI)
before first run.

## License

MIT (license file lands in M6).
