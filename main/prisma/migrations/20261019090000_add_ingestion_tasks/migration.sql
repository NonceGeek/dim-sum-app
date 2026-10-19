-- 语料入库任务（#431）：运营可见的入库任务 + Agent 会话 + 入库溯源。
-- 入库 Agent（yue-lint-agent: apps/corpus-ingest-agent）直接读写这些表；
-- 那边的 packages/corpus-control/sql/ingestion.sql 是本文件的镜像，修改时两边同步。

-- 入库任务：status 只记录人为决定的业务状态，处理中的细分状态由会话状态推出
create table ingestion_tasks (
  id bigserial primary key,
  task_no text not null unique,
  title text not null,
  description text not null default '',
  target_dataset_name text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  assignee_id text not null references "User"(id),
  created_by text not null references "User"(id),
  batch_id text not null unique,
  workspace_prefix text not null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ingestion_tasks_assignee_status_idx on ingestion_tasks(assignee_id, status);
create index ingestion_tasks_status_created_idx on ingestion_tasks(status, created_at desc);

-- 新建任务时上传的原始文件；path 相对任务工作区，形如 input/xxx.csv
create table ingestion_task_files (
  id bigserial primary key,
  task_id bigint not null references ingestion_tasks(id) on delete cascade,
  path text not null,
  name text not null,
  size bigint not null,
  etag text,
  status text not null default 'UPLOADING'
    check (status in ('UPLOADING', 'UPLOADED', 'FAILED')),
  uploaded_by text not null references "User"(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, path)
);

-- 任务审计
create table ingestion_task_events (
  id bigserial primary key,
  task_id bigint not null references ingestion_tasks(id) on delete cascade,
  operator_id text,
  operator_role text,
  operation_type text not null,
  from_status text,
  to_status text,
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ingestion_task_events_task_created_idx on ingestion_task_events(task_id, created_at);

-- 入库待办与入库任务一对一；内部入库的任务没有待办
alter table ingestion_leads drop column ingestion_task_id;
alter table ingestion_leads add column ingestion_task_id bigint unique
  references ingestion_tasks(id) on delete set null;

-- Agent 会话：一个任务一个会话，在第一次对话时创建
create table corpus_agent_runs (
  id text primary key,
  task_id bigint not null unique references ingestion_tasks(id) on delete cascade,
  status text not null check (status in ('ready','running','waiting_approval','waiting_input','failed','interrupted','completed','cancelled')),
  sandbox_id text,
  execution_version integer not null default 0,
  lease_until timestamptz,
  revision bigint not null default 0,
  sandbox_idle_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table corpus_agent_events (
  seq bigserial primary key,
  run_id text not null references corpus_agent_runs(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index corpus_agent_events_run_seq_idx
  on corpus_agent_events(run_id, seq desc);

create table corpus_agent_threads (
  id text primary key,
  run_id text not null references corpus_agent_runs(id) on delete cascade,
  task_id text,
  parent_tool_call_id text,
  next_seq integer not null default 1,
  revision integer not null default 0,
  unique(run_id,task_id)
);
create unique index corpus_agent_main_thread on corpus_agent_threads(run_id) where task_id is null;
create table corpus_agent_turns (
  id text primary key,
  run_id text not null references corpus_agent_runs(id) on delete cascade,
  thread_id text not null references corpus_agent_threads(id) on delete cascade,
  request_id text not null,
  input_hash text not null,
  kind text not null,
  parent_turn_id text references corpus_agent_turns(id),
  execution_version integer not null,
  status text not null default 'running',
  config jsonb not null default '{}',
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique(run_id,request_id)
);
create table corpus_agent_messages (
  id text primary key,
  thread_id text not null references corpus_agent_threads(id) on delete cascade,
  turn_id text not null references corpus_agent_turns(id) on delete cascade,
  seq integer not null,
  group_id text not null,
  schema_version integer not null default 1,
  role text not null,
  message jsonb not null,
  status text not null check(status in ('streaming','completed','interrupted')),
  source jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(thread_id,seq)
);
create index corpus_agent_messages_group on corpus_agent_messages(thread_id,group_id,seq);
create table corpus_agent_tool_calls (
  id text primary key,
  thread_id text not null references corpus_agent_threads(id) on delete cascade,
  turn_id text not null references corpus_agent_turns(id) on delete cascade,
  message_id text not null references corpus_agent_messages(id),
  tool_call_id text not null,
  tool_name text not null,
  input jsonb not null,
  status text not null check(status in ('pending','running','completed','failed','unknown')),
  output jsonb,
  reconciled_turn_id text references corpus_agent_turns(id),
  unique(thread_id,tool_call_id)
);
create table corpus_agent_context_summaries (
  id text primary key,
  thread_id text not null references corpus_agent_threads(id) on delete cascade,
  turn_id text not null references corpus_agent_turns(id) on delete cascade,
  source_revision integer not null,
  through_seq integer not null,
  status text not null check(status in ('running','completed','failed')),
  text text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table corpus_agent_approvals (
  id text primary key,
  run_id text not null references corpus_agent_runs(id) on delete cascade,
  batch_id text not null,
  proposal_id text not null,
  turn_id text references corpus_agent_turns(id),
  tool_call_id text,
  proposal jsonb not null,
  content_hash text not null,
  expected jsonb not null,
  status text not null check (status in ('pending', 'applying', 'approved', 'denied', 'failed', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  decided_at timestamptz,
  decided_by text references "User"(id),
  decision_note text,
  result jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, proposal_id)
);

create index corpus_agent_approvals_run_created_idx
  on corpus_agent_approvals(run_id, created_at desc);

create table corpus_agent_questions (
  id text primary key,
  run_id text not null references corpus_agent_runs(id) on delete cascade,
  tool_call_id text not null,
  turn_id text references corpus_agent_turns(id),
  message_id text references corpus_agent_messages(id),
  questions jsonb not null,
  answers jsonb,
  status text not null check (status in ('pending', 'answered', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (run_id, tool_call_id)
);

create unique index corpus_agent_questions_one_pending_idx
  on corpus_agent_questions(run_id) where status = 'pending';

create index corpus_agent_questions_run_created_idx
  on corpus_agent_questions(run_id, created_at desc);

-- RunView 的变更序号：控制台事件流按 seq 判断是否需要重新推送。
-- 连接走 transaction pooler，不能 LISTEN/NOTIFY，所以由触发器落库、服务端轮询。
create table corpus_agent_run_changes (
  run_id text primary key references corpus_agent_runs(id) on delete cascade,
  seq bigint not null default 0
);

create function corpus_agent_bump_run(target text) returns void language sql as $$
  insert into corpus_agent_run_changes(run_id,seq) values(target,1)
  on conflict (run_id) do update set seq=corpus_agent_run_changes.seq+1
$$;

create function corpus_agent_run_changed() returns trigger language plpgsql as $$
begin
  perform corpus_agent_bump_run(new.run_id);
  return null;
end $$;

create function corpus_agent_run_row_changed() returns trigger language plpgsql as $$
begin
  perform corpus_agent_bump_run(new.id);
  return null;
end $$;

create function corpus_agent_tool_call_changed() returns trigger language plpgsql as $$
begin
  perform corpus_agent_bump_run(run_id) from corpus_agent_threads where id=new.thread_id;
  return null;
end $$;

-- heartbeat 只续 lease_until，不影响 RunView
create trigger corpus_agent_runs_changed after update on corpus_agent_runs for each row
  when ((old.status,old.last_error,old.sandbox_id,old.revision,old.execution_version)
    is distinct from (new.status,new.last_error,new.sandbox_id,new.revision,new.execution_version))
  execute function corpus_agent_run_row_changed();
create trigger corpus_agent_events_changed after insert or update on corpus_agent_events
  for each row execute function corpus_agent_run_changed();
create trigger corpus_agent_approvals_changed after insert or update on corpus_agent_approvals
  for each row execute function corpus_agent_run_changed();
create trigger corpus_agent_questions_changed after insert or update on corpus_agent_questions
  for each row execute function corpus_agent_run_changed();
create trigger corpus_agent_turns_changed after insert or update on corpus_agent_turns
  for each row execute function corpus_agent_run_changed();
create trigger corpus_agent_tool_calls_changed after insert or update on corpus_agent_tool_calls
  for each row execute function corpus_agent_tool_call_changed();

create index corpus_agent_runs_sandbox_idle_idx on corpus_agent_runs(sandbox_idle_until) where sandbox_id is not null;

-- 入库操作凭据：一次已审批提案对语料库的实际写入。
-- 保留任务和审批标识作为审计凭据，不依赖会话数据的保留周期。
create table ingestion_operations (
  id text primary key,
  task_id bigint not null references ingestion_tasks(id),
  thread_id text,
  turn_id text,
  tool_call_id text,
  approval_id text not null,
  batch_id text not null,
  proposal_id text not null,
  approved_by text not null references "User"(id),
  approved_at timestamptz not null,
  records_path text not null,
  records_hash text not null,
  committed_at timestamptz not null default now(),
  result jsonb not null,
  unique (batch_id, proposal_id)
);

create index ingestion_operations_task_idx on ingestion_operations(task_id);

-- 语料的首次创建归属；去重跳过的语料不产生关联
create table ingestion_records (
  corpus_id bigint primary key references cantonese_corpus_all(id) on delete cascade,
  operation_id text not null references ingestion_operations(id),
  record_row integer not null
);

create index ingestion_records_operation_idx
  on ingestion_records(operation_id, corpus_id);

-- 与 Library 表一致：启用 RLS 不建 policy，对 Supabase anon/authenticated 关闭；
-- 应用与入库 Agent 的连接角色须能绕过 RLS。
alter table ingestion_tasks enable row level security;
alter table ingestion_task_files enable row level security;
alter table ingestion_task_events enable row level security;
alter table ingestion_operations enable row level security;
alter table ingestion_records enable row level security;
alter table corpus_agent_runs enable row level security;
alter table corpus_agent_events enable row level security;
alter table corpus_agent_threads enable row level security;
alter table corpus_agent_turns enable row level security;
alter table corpus_agent_messages enable row level security;
alter table corpus_agent_tool_calls enable row level security;
alter table corpus_agent_context_summaries enable row level security;
alter table corpus_agent_approvals enable row level security;
alter table corpus_agent_questions enable row level security;
alter table corpus_agent_run_changes enable row level security;
