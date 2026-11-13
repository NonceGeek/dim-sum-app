-- 入库 Agent 排错用的只读角色 corpus_agent_debug_reader：只能读 Agent 会话、工具调用、审批和所属任务，
-- 读不到 "User"、ingestion_leads、ingestion_records、语料表及其他任何表，也没有任何写权限。
-- 迁移只建角色和授权，角色不可登录（nologin、无密码）；何时开放、何时关闭见文末「使用方式」。
--
-- 新增 corpus_agent_* / ingestion_* 表后，要在新迁移里补 grant select 和 corpus_agent_debug_read policy，
-- 不要改本文件（已执行的迁移改动后 checksum 不一致，prisma migrate status 会报错）。

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'corpus_agent_debug_reader') then
    create role corpus_agent_debug_reader nologin;
  end if;
end $$;

-- 只读默认值可被会话覆盖，真正的边界是下面的白名单授权；连接数与超时防止排错查询拖累线上
alter role corpus_agent_debug_reader connection limit 3;
alter role corpus_agent_debug_reader set default_transaction_read_only = on;
alter role corpus_agent_debug_reader set statement_timeout = '30s';
alter role corpus_agent_debug_reader set lock_timeout = '1s';
alter role corpus_agent_debug_reader set idle_in_transaction_session_timeout = '60s';

grant usage on schema public to corpus_agent_debug_reader;

-- 这些表都开了 RLS，只 grant 读不到行，每张表还要一条 select policy
do $$
declare t text;
begin
  foreach t in array array['corpus_agent_runs', 'corpus_agent_events', 'corpus_agent_threads',
    'corpus_agent_turns', 'corpus_agent_messages', 'corpus_agent_tool_calls',
    'corpus_agent_context_summaries', 'corpus_agent_approvals', 'corpus_agent_questions',
    'corpus_agent_run_changes', 'ingestion_tasks', 'ingestion_task_files', 'ingestion_task_events',
    'ingestion_operations', 'ingestion_reports']
  loop
    execute format('grant select on %I to corpus_agent_debug_reader', t);
    execute format('drop policy if exists corpus_agent_debug_read on %I', t);
    execute format(
      'create policy corpus_agent_debug_read on %I for select to corpus_agent_debug_reader using (true)', t);
  end loop;
end $$;

-- ============================================================================
-- 使用方式（以下都是注释，迁移不会执行；在 Supabase SQL Editor 以 postgres 身份逐段手动执行）
-- ============================================================================
--
-- 一、首次开放前核对（迁移执行后做一次；之后库里新装扩展或新建 SECURITY DEFINER 函数时再做）
--
--   -- 1. 角色属性：rolsuper、rolbypassrls、rolcreaterole、rolcreatedb 都应为 false，member_of 为 0
--   select rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolconnlimit, rolconfig,
--     (select count(*) from pg_auth_members m where m.member = r.oid) as member_of
--   from pg_roles r where rolname = 'corpus_agent_debug_reader';
--
--   -- 2. 可访问的表和视图：应正好是上面 15 张表，can_write 全为 false；
--   --    多出来的行说明该对象授权给了 PUBLIC，先处理再开放登录
--   select n.nspname as schema_name, c.relname, c.relkind,
--     has_any_column_privilege('corpus_agent_debug_reader', c.oid, 'select') as can_read,
--     has_table_privilege('corpus_agent_debug_reader', c.oid, 'insert, update, delete, truncate')
--       or has_any_column_privilege('corpus_agent_debug_reader', c.oid, 'insert, update') as can_write
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where c.relkind in ('r', 'p', 'v', 'm', 'f')
--     and n.nspname not in ('pg_catalog', 'information_schema')
--     and has_schema_privilege('corpus_agent_debug_reader', n.oid, 'usage')
--     and (has_any_column_privilege('corpus_agent_debug_reader', c.oid, 'select')
--       or has_table_privilege('corpus_agent_debug_reader', c.oid, 'insert, update, delete, truncate')
--       or has_any_column_privilege('corpus_agent_debug_reader', c.oid, 'insert, update'))
--   order by 1, 2;
--
--   -- 3. 能建对象的 schema：应为空
--   select nspname from pg_namespace
--   where nspname not in ('pg_catalog', 'information_schema')
--     and has_schema_privilege('corpus_agent_debug_reader', oid, 'create');
--
--   -- 4. 能调用的 SECURITY DEFINER 函数：它们以属主权限运行，可绕过白名单，有结果要逐个看
--   select n.nspname as schema_name, p.proname, pg_get_userbyid(p.proowner) as owner
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where p.prosecdef
--     and n.nspname not in ('pg_catalog', 'information_schema')
--     and has_schema_privilege('corpus_agent_debug_reader', n.oid, 'usage')
--     and has_function_privilege('corpus_agent_debug_reader', p.oid, 'execute')
--   order by 1, 2;
--
-- 二、开放登录（每次开始排错时）
--
--   每次开放都生成新密码，不复用上一次的。用十六进制密码，连接串里不用 URL 转义；直接进剪贴板，不在终端显示：
--     openssl rand -hex 32 | tr -d '\n' | pbcopy
--   在 SQL Editor 执行（不要存成 Snippet，执行完清空编辑器）：
--     alter role corpus_agent_debug_reader login password '<粘贴密码>';
--   连接串只存在本机的单独文件里（chmod 600），不放进任何项目目录、.env.local、同步盘或备份。
--   host 从 Supabase 的 Connect → Session pooler 复制，端口必须是 5432：
--     CORPUS_AGENT_DEBUG_DB_URL=postgresql://corpus_agent_debug_reader.<project-ref>:<密码>@aws-0-<region>.pooler.supabase.com:5432/postgres
--   写完后 pbcopy < /dev/null 清空剪贴板，有剪贴板历史工具的话把这一条删掉。
--
-- 三、关闭登录（nologin 并清空密码）
--
--     alter role corpus_agent_debug_reader nologin password null;
--
--   以下情况都要关闭：
--   - 一轮排错结束。角色不常开，暴露时间只限于排错期间；下次再开时按第二步换新密码。
--   - 连接串可能泄露：文件被误提交、贴进聊天/工单、拷到别的机器、电脑丢失或交给他人维修。
--     关闭后若还要用，按第二步换新密码，不要沿用旧密码。
--   - 使用这个连接串的人不再参与排错（离职、换项目）。
--   - 准备新增 corpus_agent_* / ingestion_* 表，或库里新装了扩展：先关闭，补完授权并重跑第一步核对后再开。
--   关闭只影响新连接；已建立的连接要另外断开：
--     select pg_terminate_backend(pid) from pg_stat_activity where usename = 'corpus_agent_debug_reader';
--
-- 四、查看当前状态
--
--     select rolcanlogin from pg_roles where rolname = 'corpus_agent_debug_reader';
--     select pid, client_addr, backend_start, state, left(query, 80)
--     from pg_stat_activity where usename = 'corpus_agent_debug_reader';
--
-- 五、注意
--
--   - 列级和行级权限管不到 JSON 内容：message、input、output 里可能有用户上传的语料、转写文本、
--     对话中的个人信息或 OSS 签名链接。用这个角色把查询结果交给 AI 工具排错时，这些内容会发送给模型服务；
--     查询时尽量只取需要的字段（tool_name、status、error 等），不整段拉 message。
--   - 彻底删除角色（不再需要时）：
--       drop policy corpus_agent_debug_read on <上面 15 张表，逐张>;
--       revoke all on all tables in schema public from corpus_agent_debug_reader;
--       revoke usage on schema public from corpus_agent_debug_reader;
--       drop role corpus_agent_debug_reader;
