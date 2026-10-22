-- Neon 等托管库上，建角色的非超级用户会自动成为该角色的 ADMIN 成员（不继承权限、不能 SET ROLE），
-- 按 pg_auth_members 判断会把这个管理连接当成 Agent。改为只认能直接使用 Agent 权限的角色；
-- pg_has_role 对超级用户恒为真，超级用户另行排除。
create or replace function ingestion_is_agent() returns boolean language sql stable as $$
  select current_user = 'corpus_ingest_agent' or (
    not (select rolsuper from pg_roles where rolname = current_user)
    and pg_has_role(current_user, 'corpus_ingest_agent', 'USAGE'))
$$;
