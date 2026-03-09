-- ============================================================
-- PLI™ Monitor — Supabase Schema
-- ProjetoPack Intelligence
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── TABLES ────────────────────────────────────────────────────────────────────

-- Regulatory events captured from APIs
create table events (
  id            uuid primary key default uuid_generate_v4(),
  external_id   text unique,                    -- ID from source API (e.g. "pl-2024-2022")
  type          text not null,                  -- PL | DECRETO | RDC | CONSULTA | IN | REQUERIMENTO
  urgency       text not null,                  -- CRÍTICO | MONITORAMENTO | VIGILÂNCIA | EM VIGOR
  chain         text not null,                  -- plastic | paper | recycl
  title         text not null,
  body          text,                           -- Câmara | Senado | ANVISA | MMA | DOU
  status        text,
  last_move     text,
  details       text,
  players       text[],                         -- array of player names
  substrates    text[],                         -- PLI Score substrates affected
  score_impact  integer default 0,             -- estimated PLI Score delta
  source        text,
  source_url    text,
  event_date    date,
  captured_at   timestamptz default now(),
  updated_at    timestamptz default now(),
  active        boolean default true
);

-- PLI Score snapshots (one row per substrate per week)
create table pli_scores (
  id            uuid primary key default uuid_generate_v4(),
  substrate     text not null,
  chain         text not null,
  score         integer not null,
  score_base    integer not null,              -- baseline score from inaugural edition
  score_delta   integer default 0,            -- cumulative delta from active events
  band          text not null,                 -- CRÍTICA | MONITORAMENTO | ESTÁVEL
  snapshot_date date not null,
  created_at    timestamptz default now(),
  unique (substrate, snapshot_date)
);

-- Players directory
create table players (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null unique,
  chain         text,                          -- plastic | paper | recycl | cross
  country       text default 'BR',
  type          text,                          -- ASSOCIAÇÃO | EMPRESA | GOVERNO | ONG
  notes         text,
  created_at    timestamptz default now()
);

-- Subscribers / users (linked to Supabase Auth)
create table subscribers (
  id            uuid primary key references auth.users(id),
  email         text not null,
  name          text,
  company       text,
  tier          integer default 1,             -- 1 | 2 | 3
  tier_name     text default 'ESSENCIAL',      -- ESSENCIAL | ESTRATÉGICO | CORPORATIVO
  active        boolean default true,
  trial         boolean default false,
  trial_ends    date,
  subscribed_at timestamptz default now(),
  last_login    timestamptz
);

-- Email notification log
create table notifications (
  id            uuid primary key default uuid_generate_v4(),
  subscriber_id uuid references subscribers(id),
  event_id      uuid references events(id),
  type          text,                          -- FLASH | ALERT | WEEKLY
  sent_at       timestamptz default now(),
  subject       text,
  status        text default 'sent'
);

-- Weekly digest log (for dedup)
create table digest_runs (
  id            uuid primary key default uuid_generate_v4(),
  run_date      date not null unique,
  events_fetched integer default 0,
  events_new    integer default 0,
  status        text default 'ok',
  run_at        timestamptz default now(),
  notes         text
);

-- ── SEED DATA — PLI Score baselines (inaugural edition) ──────────────────────

insert into pli_scores (substrate, chain, score, score_base, score_delta, band, snapshot_date) values
  ('PFAS food contact',   'plastic', 88, 88, 0, 'CRÍTICA',       '2026-03-01'),
  ('Filmes multicamada',  'plastic', 79, 79, 0, 'CRÍTICA',       '2026-03-01'),
  ('EPS',                 'plastic', 76, 76, 0, 'CRÍTICA',       '2026-03-01'),
  ('PVC embalagem',       'plastic', 72, 72, 0, 'CRÍTICA',       '2026-03-01'),
  ('PE filme mono',       'plastic', 54, 54, 0, 'MONITORAMENTO', '2026-03-01'),
  ('Papel/cartão FSC',    'paper',   42, 42, 0, 'MONITORAMENTO', '2026-03-01'),
  ('PET garrafa',         'recycl',  38, 38, 0, 'ESTÁVEL',       '2026-03-01'),
  ('OPP mono',            'plastic', 35, 35, 0, 'ESTÁVEL',       '2026-03-01'),
  ('Papelão ondulado',    'paper',   28, 28, 0, 'ESTÁVEL',       '2026-03-01'),
  ('Bio-based PE',        'plastic', 22, 22, 0, 'ESTÁVEL',       '2026-03-01');

-- ── SEED DATA — Players ──────────────────────────────────────────────────────

insert into players (name, chain, country, type) values
  ('ABIQUIM',    'plastic', 'BR', 'ASSOCIAÇÃO'),
  ('ABIPLAST',   'plastic', 'BR', 'ASSOCIAÇÃO'),
  ('Braskem',    'plastic', 'BR', 'EMPRESA'),
  ('PLASTIVIDA', 'plastic', 'BR', 'ASSOCIAÇÃO'),
  ('CRBr',       'recycl',  'BR', 'ASSOCIAÇÃO'),
  ('CEMPRE',     'recycl',  'BR', 'ASSOCIAÇÃO'),
  ('Ibá',        'paper',   'BR', 'ASSOCIAÇÃO'),
  ('ABTCP',      'paper',   'BR', 'ASSOCIAÇÃO'),
  ('ABRE',       'cross',   'BR', 'ASSOCIAÇÃO'),
  ('Suzano',     'paper',   'BR', 'EMPRESA'),
  ('Klabin',     'paper',   'BR', 'EMPRESA'),
  ('ANVISA',     'cross',   'BR', 'GOVERNO'),
  ('MMA',        'cross',   'BR', 'GOVERNO');

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

alter table events      enable row level security;
alter table pli_scores  enable row level security;
alter table subscribers enable row level security;
alter table players     enable row level security;

-- Events: Tier 1+ can read active events (full feed)
create policy "Tier 1+ read events" on events
  for select using (
    exists (
      select 1 from subscribers s
      where s.id = auth.uid() and s.active = true and s.tier >= 1
    )
    or auth.role() = 'service_role'
  );

-- PLI Scores: Tier 1+ read
create policy "Tier 1+ read scores" on pli_scores
  for select using (
    exists (
      select 1 from subscribers s
      where s.id = auth.uid() and s.active = true and s.tier >= 1
    )
    or auth.role() = 'service_role'
  );

-- Players: public read
create policy "Public read players" on players
  for select using (true);

-- Subscribers: users can read their own record
create policy "Own subscriber record" on subscribers
  for select using (auth.uid() = id);

-- ── FUNCTIONS ────────────────────────────────────────────────────────────────

-- Auto-update updated_at
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger events_updated_at
  before update on events
  for each row execute function handle_updated_at();

-- Recalculate PLI Score for a substrate based on active events
create or replace function recalculate_pli_score(p_substrate text)
returns integer as $$
declare
  base_score integer;
  total_delta integer;
  new_score   integer;
begin
  select score_base into base_score
    from pli_scores
    where substrate = p_substrate
    order by snapshot_date desc limit 1;

  select coalesce(sum(e.score_impact * 0.4), 0)::integer into total_delta
    from events e
    where p_substrate = any(e.substrates)
      and e.active = true
      and e.urgency in ('CRÍTICO', 'MONITORAMENTO');

  new_score := least(100, base_score + total_delta);
  return new_score;
end;
$$ language plpgsql;
