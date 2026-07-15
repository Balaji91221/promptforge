-- PromptForge cloud data model (plan §12). Plain Postgres until volume forces
-- a time-series store (§11). Phase 1: users/devices/events. Phase 2: config
-- versioning. Phase 5: teams/orgs.

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  plan          text not null default 'free',
  settings      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

create table if not exists devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  label         text,
  last_seen     timestamptz not null default now()
);

-- Which AI tools the user has connected, and their (versioned) limit windows.
create table if not exists platforms (
  id            text primary key,               -- 'anthropic' | 'openai' | ...
  display_name  text not null
);

-- PromptEvent (§12) — original input, rewrite, and the ground-truth outcome.
create table if not exists prompt_events (
  id                 text primary key,          -- client-generated id
  user_id            uuid references users(id) on delete cascade,
  ts                 timestamptz not null,
  platform           text not null,
  raw_input          text not null,
  refined_prompt     text not null,
  intent             text,
  applied_techniques jsonb not null default '[]',
  suggestions        jsonb not null default '[]',
  quality_before     int,
  quality_after      int,
  tokens_before      int,
  tokens_after       int,
  outcome            text                        -- accepted | edited_then_sent | dismissed | null
);
create index if not exists prompt_events_user_ts on prompt_events (user_id, ts);

create table if not exists usage_events (
  id            bigserial primary key,
  user_id       uuid references users(id) on delete cascade,
  ts            timestamptz not null,
  platform      text not null,
  model         text,
  input_tokens  int not null,
  est_usage     numeric
);

-- Versioned intelligence + config artifacts (§9.1, §11).
create table if not exists meta_prompt_versions (
  version       text primary key,
  body          text not null,
  eval_score    numeric,
  created_at    timestamptz not null default now(),
  active        boolean not null default false
);

create table if not exists config_versions (
  version       text primary key,
  payload       jsonb not null,                 -- selectors, limits, pricing refs, templates
  created_at    timestamptz not null default now(),
  active        boolean not null default false
);

-- Teams / orgs (Phase 5).
create table if not exists orgs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  created_at    timestamptz not null default now()
);
create table if not exists org_members (
  org_id        uuid references orgs(id) on delete cascade,
  user_id       uuid references users(id) on delete cascade,
  role          text not null default 'member', -- owner | admin | member
  primary key (org_id, user_id)
);
