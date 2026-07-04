# CLAUDE.md — Master Build Instructions (God Prompt)

You are Claude Code, building a complete Content Management System for a solo creator.
This folder contains the full specification. Read every file before writing code.

## Project
"Creator CMS" — a self-hostable, solo-creator content system. Owner: Sri Vamshi.
Idea capture (link + voice) → AI tagging → script writing (Hook/Story/End) → tone-adapted
platform variants → calendar → manual publish. BYOK: users supply their own OpenAI and
Anthropic API keys in-app. Open-source friendly: anyone can clone, deploy to their own
Supabase + Vercel, drop keys, and use it for free.

## Read order
1. 01-product-spec.md      — vision, personas, features, scope boundaries
2. 02-architecture.md      — stack, deployment, folder structure, scaling notes
3. 03-data-model.md        — full Postgres schema (authoritative; includes schema.sql)
4. 04-capture-flows.md     — link capture and voice capture, end to end
5. 05-script-studio.md     — Hook/Story/End editor, story parts, visual references
6. 06-ai-provider-layer.md — BYOK key management, provider abstraction, model routing
7. 07-build-plan.md        — phased milestones. BUILD IN THIS ORDER. Do not skip ahead.

## Hard rules
- Stack is fixed: Next.js 14+ (App Router, TypeScript), Supabase (Postgres, Auth,
  Storage), Vercel deployment, Tailwind. Do not substitute.
- iPad-first UI. Touch targets ≥ 44px. No hover-only interactions. Test at 1024×768
  and 390×844 viewports.
- API keys are NEVER committed, NEVER placed in env vars for the AI providers, NEVER
  logged. They live encrypted in the user's database, entered via the Settings UI.
  See 06-ai-provider-layer.md. Supabase/Vercel config uses env vars as normal.
- All AI calls go through the provider abstraction (lib/ai/). No direct SDK calls
  from components or routes.
- Every milestone in 07-build-plan.md ends with a working, deployable state. Deploy
  and verify before starting the next milestone.
- Audit honestly: report what actually works, what is stubbed, what failed. Never
  claim a feature is done without having run it.
- Stay in scope. The non-goals list in 01-product-spec.md is binding.

## Tools available to you
Composio is connected with access to Supabase (run migrations, manage the project),
Vercel (deploy), and GitHub (repo, commits, CI). Use them to build, migrate, deploy,
and verify end to end. Create the GitHub repo first, commit at every milestone.

## Definition of done (MVP)
A deployed Vercel URL where the owner can: log in, enter API keys in Settings,
capture an idea by pasted link or voice recording, see it auto-tagged, open Script
Studio to write Hook/Story/End with story parts and visual refs, generate platform
variants (Instagram / Twitter / LinkedIn) in the correct tone, drag them onto a
calendar, and copy final text for manual posting. README documents self-hosting
in under 15 minutes.
