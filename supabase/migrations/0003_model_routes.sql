-- Per-user model routing overrides (Settings → Advanced), per docs/06:
-- routes are overridable per-user with simple dropdowns.
alter table profiles
  add column if not exists model_routes jsonb not null default '{}';
