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
  -- 入库任务即批次：对外编号用 task_no，库内关联用 task_id，工作区路径只认 workspace_prefix（形如 batches/IT-20261026-001-k3f9x2/）
  workspace_prefix text not null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 语料集配置：新建还是补充已有语料集、媒体组成、来源说明；备注沿用 description。入库 Agent 把这些字段写进批次说明
  target_ingestion_type text not null default 'new_dataset'
    check (target_ingestion_type in ('new_dataset', 'supplement_existing')),
  modalities text[] not null default '{text}'
    check (modalities <@ array['text', 'audio', 'video', 'image'] and 'text' = any(modalities)),
  source_collection_method text not null default '',
  -- 新建语料集时的类型（对应 cantonese_categories.content_attribute）；补充已有语料集时为空，沿用已有类型
  target_content_attribute text
    check (target_content_attribute in ('oral', 'cultural_knowledge'))
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

-- authorized：dim-sum-app 已批准、待 Agent 执行；applying：Agent 执行中或结果未知。
-- settled_at：Agent 已按决定续跑（拒绝后续跑、执行完成或失败）。
-- applied_txid：执行写入的事务号，每个已批准提案只能占用一次。
create table corpus_agent_approvals (
  id text primary key,
  run_id text not null references corpus_agent_runs(id) on delete cascade,
  proposal_id text not null,
  turn_id text references corpus_agent_turns(id),
  tool_call_id text,
  proposal jsonb not null,
  content_hash text not null,
  expected jsonb not null,
  status text not null check (status in ('pending', 'authorized', 'applying', 'approved', 'denied', 'failed', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  decided_at timestamptz,
  decided_by text references "User"(id),
  decision_note text,
  result jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  applied_txid bigint unique,
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
  proposal_id text not null,
  approved_by text not null references "User"(id),
  approved_at timestamptz not null,
  records_path text not null,
  records_hash text not null,
  committed_at timestamptz not null default now(),
  result jsonb not null,
  unique (task_id, proposal_id)
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

-- 入库报告：入库 Agent 在对话中写草稿版，结束任务时写正式版；dim-sum-app 只读与下载。
create table ingestion_reports (
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

create index ingestion_reports_task_created_idx
  on ingestion_reports(task_id, created_at desc);

-- 与 Library 表一致：启用 RLS 不建 policy，对 Supabase anon/authenticated 关闭；
-- 应用与入库 Agent 的连接角色须能绕过 RLS。
alter table ingestion_tasks enable row level security;
alter table ingestion_task_files enable row level security;
alter table ingestion_task_events enable row level security;
alter table ingestion_operations enable row level security;
alter table ingestion_records enable row level security;
alter table ingestion_reports enable row level security;
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

-- 入库审批：dim-sum-app 决定、入库 Agent 执行，用数据库角色隔离两者。
-- 入库 Agent 以 corpus_ingest_agent 角色（或其成员）连接，受以下约束：
--   1. 不能写审批的决定（批准/拒绝、审批人、时间、备注），也不能改提案内容；
--   2. 只能在「执行一个已批准提案」的那个事务里写语料业务表与入库凭据，
--      每个已批准提案只放行一次事务。
-- 其他连接（dim-sum-app 等）不受影响。

-- 角色本身不能登录；部署时由管理员执行：
--   alter role corpus_ingest_agent login password '...';
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'corpus_ingest_agent') then
    create role corpus_ingest_agent nologin;
  end if;
end $$;

-- Neon 等托管库上，建角色的非超级用户会自动成为该角色的 ADMIN 成员（不继承权限、不能 SET ROLE），
-- 按 pg_auth_members 判断会把这个管理连接当成 Agent。改为只认能直接使用 Agent 权限的角色；
-- pg_has_role 对超级用户恒为真，超级用户另行排除。
create function ingestion_is_agent() returns boolean language sql stable as $$
  select current_user = 'corpus_ingest_agent' or (
    not (select rolsuper from pg_roles where rolname = current_user)
    and pg_has_role(current_user, 'corpus_ingest_agent', 'USAGE'))
$$;

create function corpus_agent_approval_guard() returns trigger language plpgsql as $$
begin
  if not ingestion_is_agent() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' or new.decided_at is not null or new.decided_by is not null
      or new.decision_note is not null or new.settled_at is not null or new.applied_txid is not null then
      raise exception '入库 Agent 只能创建待审批的提案' using errcode = '42501';
    end if;
    return new;
  end if;
  if (new.id, new.run_id, new.proposal_id, new.proposal, new.content_hash,
      new.expected, new.turn_id, new.tool_call_id, new.expires_at, new.created_at,
      new.decided_at, new.decided_by, new.decision_note)
    is distinct from (old.id, old.run_id, old.proposal_id, old.proposal, old.content_hash,
      old.expected, old.turn_id, old.tool_call_id, old.expires_at, old.created_at,
      old.decided_at, old.decided_by, old.decision_note) then
    raise exception '入库 Agent 不能修改审批决定或提案内容' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and (old.status, new.status) not in (
      ('pending', 'cancelled'), ('authorized', 'cancelled'), ('authorized', 'applying'),
      ('applying', 'approved'), ('applying', 'failed')) then
    raise exception '入库 Agent 不能把审批从 % 改为 %', old.status, new.status using errcode = '42501';
  end if;
  if new.applied_txid is distinct from old.applied_txid and not (
      old.applied_txid is null and new.status = 'applying' and new.applied_txid = txid_current()) then
    raise exception '入库 Agent 只能为执行中的审批登记当前事务' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger corpus_agent_approvals_guard before insert or update on corpus_agent_approvals
  for each row execute function corpus_agent_approval_guard();

create function ingestion_agent_write_guard() returns trigger language plpgsql as $$
begin
  if ingestion_is_agent() and not exists (
      select 1 from corpus_agent_approvals
      where applied_txid = txid_current() and status = 'applying') then
    raise exception '入库 Agent 只能在执行已批准提案的事务中写入 %', tg_table_name using errcode = '42501';
  end if;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['cantonese_categories', 'cantonese_corpus_all', 'corpus_category',
    'corpus_tags', 'content_categories', 'tags', 'corpus_field_embeddings',
    'ingestion_operations', 'ingestion_records']
  loop
    execute format(
      'create trigger ingestion_agent_write_guard before insert or update or delete on %I
       for each statement execute function ingestion_agent_write_guard()', t);
  end loop;
end $$;

-- 授权：只给 Agent 必需的表和列
grant usage on schema public to corpus_ingest_agent;
grant usage on all sequences in schema public to corpus_ingest_agent;

grant select, insert, update, delete on corpus_agent_runs, corpus_agent_events, corpus_agent_threads,
  corpus_agent_turns, corpus_agent_messages, corpus_agent_tool_calls, corpus_agent_context_summaries,
  corpus_agent_questions, corpus_agent_run_changes to corpus_ingest_agent;
grant select, insert on corpus_agent_approvals to corpus_ingest_agent;
grant update (status, result, settled_at, applied_txid) on corpus_agent_approvals to corpus_ingest_agent;

grant select on ingestion_tasks to corpus_ingest_agent;
grant update (status, updated_at, completed_at, cancelled_at) on ingestion_tasks to corpus_ingest_agent;
grant insert on ingestion_task_events to corpus_ingest_agent;
grant select, insert on ingestion_operations, ingestion_records to corpus_ingest_agent;
grant select, insert, update on ingestion_reports to corpus_ingest_agent;

grant select (id, name, status, "isSystemAdmin", "isSuperAdmin") on "User" to corpus_ingest_agent;
grant select (user_id, active, global_actions) on corpus_collection_operator_roles to corpus_ingest_agent;

grant select, insert, update on cantonese_categories, cantonese_corpus_all, corpus_category,
  corpus_tags, content_categories, tags, corpus_field_embeddings to corpus_ingest_agent;

-- 新表开了 RLS 且无 policy；给 Agent 角色单独放行
do $$
declare t text;
begin
  foreach t in array array['ingestion_tasks', 'ingestion_task_events', 'ingestion_operations',
    'ingestion_records', 'ingestion_reports', 'corpus_agent_runs', 'corpus_agent_events', 'corpus_agent_threads',
    'corpus_agent_turns', 'corpus_agent_messages', 'corpus_agent_tool_calls',
    'corpus_agent_context_summaries', 'corpus_agent_approvals', 'corpus_agent_questions',
    'corpus_agent_run_changes']
  loop
    execute format(
      'create policy corpus_ingest_agent_access on %I to corpus_ingest_agent using (true) with check (true)', t);
  end loop;
end $$;

-- 语料业务表与平台表在库里也开着 RLS；Agent 角色读权限判断列、读写语料（写入仍受上面的触发器约束）
create policy corpus_ingest_agent_read on "User" for select to corpus_ingest_agent using (true);
create policy corpus_ingest_agent_read on corpus_collection_operator_roles for select to corpus_ingest_agent using (true);
do $$
declare t text;
begin
  foreach t in array array['cantonese_categories', 'cantonese_corpus_all', 'corpus_category',
    'corpus_tags', 'content_categories', 'tags', 'corpus_field_embeddings']
  loop
    execute format(
      'create policy corpus_ingest_agent_access on %I to corpus_ingest_agent using (true) with check (true)', t);
  end loop;
end $$;
