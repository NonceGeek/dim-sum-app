create table public.corpus_embedding_neighbor_builds (
  id uuid primary key default gen_random_uuid(),
  field_type text not null default 'doc',
  model_name text not null,
  embedding_dimension integer not null,
  neighbors_per_source smallint not null check (neighbors_per_source > 0),
  status text not null default 'building'
    check (status in ('building', 'ready', 'active', 'failed', 'retired')),
  source_count integer not null default 0 check (source_count >= 0),
  processed_source_count integer not null default 0
    check (processed_source_count >= 0),
  neighbor_count bigint not null default 0 check (neighbor_count >= 0),
  source_watermark timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  activated_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index corpus_embedding_neighbor_one_active
  on public.corpus_embedding_neighbor_builds (field_type)
  where status = 'active';

create index corpus_embedding_neighbor_build_status_idx
  on public.corpus_embedding_neighbor_builds (field_type, status, created_at desc);

create table public.corpus_embedding_neighbors (
  build_id uuid not null
    references public.corpus_embedding_neighbor_builds(id) on delete cascade,
  field_type text not null default 'doc',
  source_corpus_id bigint not null
    references public.cantonese_corpus_all(id) on delete cascade,
  target_corpus_id bigint not null
    references public.cantonese_corpus_all(id) on delete cascade,
  rank smallint not null check (rank > 0),
  distance real not null check (distance >= 0),
  similarity real not null check (similarity >= -1 and similarity <= 1),
  source_embedding_updated_at timestamptz not null,
  target_embedding_updated_at timestamptz not null,
  computed_at timestamptz not null default now(),
  primary key (build_id, field_type, source_corpus_id, target_corpus_id),
  unique (build_id, field_type, source_corpus_id, rank),
  check (source_corpus_id <> target_corpus_id)
);

create index corpus_embedding_neighbors_source_rank_idx
  on public.corpus_embedding_neighbors
    (build_id, field_type, source_corpus_id, rank);

create index corpus_embedding_neighbors_target_idx
  on public.corpus_embedding_neighbors
    (build_id, field_type, target_corpus_id);

create table public.corpus_embedding_neighbor_sync_state (
  field_type text primary key,
  watermark timestamptz not null,
  active_build_id uuid
    references public.corpus_embedding_neighbor_builds(id) on delete set null,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_changed_source_count integer not null default 0
    check (last_changed_source_count >= 0),
  last_error text,
  updated_at timestamptz not null default now()
);

comment on table public.corpus_embedding_neighbor_builds is
  'Versioned offline embedding-neighbor builds; only one build per field type may be active.';
comment on table public.corpus_embedding_neighbors is
  'Precomputed nearest corpus neighbors used by online exploration search.';
comment on table public.corpus_embedding_neighbor_sync_state is
  'Manual incremental builder watermark and last-run state.';
