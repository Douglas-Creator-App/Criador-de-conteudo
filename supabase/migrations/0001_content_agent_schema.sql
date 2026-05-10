create table if not exists public.content_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  niche text,
  persona text,
  content_structure text,
  image_style text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.content_projects(id) on delete cascade,
  title text not null,
  angle text,
  source_url text,
  status text not null default 'idea',
  platform text,
  created_at timestamptz not null default now()
);

create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.content_projects(id) on delete cascade,
  idea_id uuid references public.content_ideas(id) on delete set null,
  asset_type text not null,
  title text,
  body text,
  external_id text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.content_assets(id) on delete cascade,
  platform text not null,
  scheduled_at timestamptz,
  published_at timestamptz,
  status text not null default 'pending',
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

