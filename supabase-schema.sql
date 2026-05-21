-- Run this in your Supabase SQL editor

create table if not exists blood_markers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  drawn_at timestamptz not null,
  marker text not null,
  value numeric not null,
  unit text not null,
  reference_min numeric,
  reference_max numeric,
  created_at timestamptz default now()
);

create table if not exists whoop_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  date date not null,
  recovery_score numeric,
  hrv numeric,
  resting_hr numeric,
  sleep_hours numeric,
  strain numeric,
  raw jsonb,
  created_at timestamptz default now()
);

create table if not exists genetic_variants (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  rsid text,
  gene text,
  genotype text,
  significance text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  category text not null,
  recommendation text not null,
  reasoning text,
  sources text[],
  priority text,
  created_at timestamptz default now()
);

create table if not exists data_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source text not null,
  filename text not null,
  raw_url text,
  parsed boolean default false,
  uploaded_at timestamptz default now()
);
