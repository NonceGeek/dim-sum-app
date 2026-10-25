-- 入库报告：入库 Agent 在对话中写草稿版，结束任务时写正式版；dim-sum-app 只读与下载。
-- 之前的环境可能已经用 db push 建过表，这里都用 if not exists。
create table if not exists ingestion_reports (
  id bigserial primary key,
  task_id bigint not null references ingestion_tasks(id) on delete cascade on update no action,
  version integer not null,
  kind text not null default 'final',
  status text not null default 'generating',
  formats text[] not null default '{}',
  base_path text not null,
  facts_hash text,
  summary jsonb not null default '{}',
  narrative_meta jsonb not null default '{}',
  error text,
  generated_by text,
  created_at timestamptz(6) not null default now(),
  updated_at timestamptz(6) not null default now(),
  unique (task_id, version)
);

create index if not exists ingestion_reports_task_created_idx
  on ingestion_reports(task_id, created_at desc);

alter table ingestion_reports enable row level security;

grant select, insert, update on ingestion_reports to corpus_ingest_agent;
grant usage on sequence ingestion_reports_id_seq to corpus_ingest_agent;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'ingestion_reports' and policyname = 'corpus_ingest_agent_access'
  ) then
    create policy corpus_ingest_agent_access on ingestion_reports
      to corpus_ingest_agent using (true) with check (true);
  end if;
end $$;
