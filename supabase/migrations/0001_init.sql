-- Creator CMS — initial schema (authoritative source: docs/03-data-model.md)

-- ENUMS ----------------------------------------------------------------
create type platform      as enum ('instagram', 'twitter', 'linkedin');
create type brand         as enum ('real_one', 'operator', 'both', 'unsure');
create type idea_status   as enum ('captured','reviewed','scripted','drafted','scheduled','posted','archived');
create type source_type   as enum ('youtube','instagram','twitter','article','note','voice');
create type variant_status as enum ('draft','approved','scheduled','posted');
create type visual_type   as enum ('note','image','drawing');
create type ai_provider   as enum ('anthropic','openai','openrouter');

-- PROFILES (extends auth.users) -----------------------------------------
create table profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  capture_token text unique,            -- bearer token for iOS Shortcut
  brand_guidelines jsonb not null default '{}', -- editable persona voice docs
  created_at    timestamptz not null default now()
);

-- API KEYS (BYOK, encrypted at rest — see docs/06) ------------------------
create table api_keys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      ai_provider not null,
  key_ciphertext text not null,         -- AES-256-GCM, encrypted server-side
  key_last4     text not null,          -- display only: "sk-...abcd"
  created_at    timestamptz not null default now(),
  unique (user_id, provider)
);

-- IDEAS ------------------------------------------------------------------
create table ideas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  source_type   source_type not null default 'note',
  source_url    text,
  raw_text      text,          -- typed note or scraped page text
  transcript    text,          -- YouTube captions OR voice transcription
  audio_path    text,          -- Supabase Storage path for voice recordings (original kept!)

  title         text,
  summary       text,          -- AI 2–3 sentence summary
  pillar        text,
  suggested_brand brand not null default 'unsure',
  agent_notes   text,

  status        idea_status not null default 'captured'
);
create index ideas_user_status_idx on ideas (user_id, status);
create index ideas_user_created_idx on ideas (user_id, created_at desc);

-- SCRIPTS (Hook / Story / End) --------------------------------------------
create table scripts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  idea_id       uuid not null references ideas(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  hook          text,          -- the opener
  ending        text,          -- close / cliffhanger
  notes         text
);
create index scripts_idea_idx on scripts (idea_id);

-- SCRIPT PARTS (the Story, split into ordered beats) ------------------------
create table script_parts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  script_id     uuid not null references scripts(id) on delete cascade,
  position      int  not null,           -- order within the story
  body          text not null default '',

  -- visual reference for this beat ("in my head this shot plays here")
  visual_kind   visual_type,             -- note | image | drawing (nullable = none)
  visual_text   text,                    -- typed/drawn description
  visual_path   text,                    -- Storage path for pasted image or drawing PNG
  unique (script_id, position)
);
create index script_parts_script_idx on script_parts (script_id, position);

-- VARIANTS ------------------------------------------------------------------
create table variants (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  idea_id       uuid not null references ideas(id) on delete cascade,
  script_id     uuid references scripts(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  platform      platform not null,
  hook          text,
  body          text not null,
  media_notes   text,

  status        variant_status not null default 'draft',
  posted_at     timestamptz,
  posted_url    text
);
create index variants_user_idx on variants (user_id);
create index variants_idea_idx on variants (idea_id);

-- SCHEDULE --------------------------------------------------------------------
create table schedule (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  variant_id    uuid not null references variants(id) on delete cascade,
  slot_at       timestamptz not null,
  done          boolean not null default false,
  created_at    timestamptz not null default now()
);
create index schedule_user_slot_idx on schedule (user_id, slot_at);

-- updated_at trigger -----------------------------------------------------------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger ideas_touch    before update on ideas    for each row execute function touch_updated_at();
create trigger scripts_touch  before update on scripts  for each row execute function touch_updated_at();
create trigger variants_touch before update on variants for each row execute function touch_updated_at();

-- RLS: own-rows-only on every table ---------------------------------------------
alter table profiles     enable row level security;
alter table api_keys     enable row level security;
alter table ideas        enable row level security;
alter table scripts      enable row level security;
alter table script_parts enable row level security;
alter table variants     enable row level security;
alter table schedule     enable row level security;

create policy own_profiles on profiles     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_keys     on api_keys     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_ideas    on ideas        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_scripts  on scripts      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_parts    on script_parts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_variants on variants     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_schedule on schedule     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
