-- 入库任务即批次：去掉独立的 batch_id。
-- 对外编号用 task_no，库内关联用 task_id，工作区路径只认 workspace_prefix。
-- 新任务的 workspace_prefix 形如 batches/IT-20261026-001-k3f9x2/；已有任务的 batches/... 前缀照常可用。
-- 那边的 packages/corpus-control/sql/ingestion.sql 镜像了本文件，修改时两边同步。

alter table ingestion_tasks drop column batch_id;

alter table ingestion_operations drop column batch_id;
alter table ingestion_operations
  add constraint ingestion_operations_task_id_proposal_id_key unique (task_id, proposal_id);

-- 审批按 run 归属任务，(run_id, proposal_id) 已唯一；先改守卫再删列
create or replace function corpus_agent_approval_guard() returns trigger language plpgsql as $$
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

alter table corpus_agent_approvals drop column batch_id;
