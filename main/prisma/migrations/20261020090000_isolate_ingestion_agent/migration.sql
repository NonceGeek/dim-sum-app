-- 入库审批：dim-sum-app 决定、入库 Agent 执行，用数据库角色隔离两者。
-- 入库 Agent 以 corpus_ingest_agent 角色（或其成员）连接，受以下约束：
--   1. 不能写审批的决定（批准/拒绝、审批人、时间、备注），也不能改提案内容；
--   2. 只能在「执行一个已批准提案」的那个事务里写语料业务表与入库凭据，
--      每个已批准提案只放行一次事务。
-- 其他连接（dim-sum-app 等）不受影响。
-- 那边的 packages/corpus-control/sql/ingestion.sql 镜像了本文件，修改时两边同步。

-- 角色本身不能登录；部署时由管理员执行：
--   alter role corpus_ingest_agent login password '...';
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'corpus_ingest_agent') then
    create role corpus_ingest_agent nologin;
  end if;
end $$;

create function ingestion_is_agent() returns boolean language sql stable as $$
  select current_user = 'corpus_ingest_agent' or exists (
    select 1 from pg_auth_members m
    where m.roleid = 'corpus_ingest_agent'::regrole and m.member = current_user::regrole)
$$;

-- authorized：dim-sum-app 已批准、待 Agent 执行；applying：Agent 执行中或结果未知。
-- settled_at：Agent 已按决定续跑（拒绝后续跑、执行完成或失败）。
-- applied_txid：执行写入的事务号，每个已批准提案只能占用一次。
alter table corpus_agent_approvals drop constraint corpus_agent_approvals_status_check;
alter table corpus_agent_approvals add constraint corpus_agent_approvals_status_check
  check (status in ('pending', 'authorized', 'applying', 'approved', 'denied', 'failed', 'expired', 'cancelled'));
alter table corpus_agent_approvals add column settled_at timestamptz;
alter table corpus_agent_approvals add column applied_txid bigint unique;

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
  if (new.id, new.run_id, new.batch_id, new.proposal_id, new.proposal, new.content_hash,
      new.expected, new.turn_id, new.tool_call_id, new.expires_at, new.created_at,
      new.decided_at, new.decided_by, new.decision_note)
    is distinct from (old.id, old.run_id, old.batch_id, old.proposal_id, old.proposal, old.content_hash,
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

grant select (id, status, "isSystemAdmin", "isSuperAdmin") on "User" to corpus_ingest_agent;
grant select (user_id, active, global_actions) on corpus_collection_operator_roles to corpus_ingest_agent;

grant select, insert, update on cantonese_categories, cantonese_corpus_all, corpus_category,
  corpus_tags, content_categories, tags, corpus_field_embeddings to corpus_ingest_agent;

-- 新表开了 RLS 且无 policy；给 Agent 角色单独放行
do $$
declare t text;
begin
  foreach t in array array['ingestion_tasks', 'ingestion_task_events', 'ingestion_operations',
    'ingestion_records', 'corpus_agent_runs', 'corpus_agent_events', 'corpus_agent_threads',
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
