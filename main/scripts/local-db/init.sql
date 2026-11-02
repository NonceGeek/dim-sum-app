-- 复刻 Supabase 上 public 依赖的角色与扩展；public 本身由 setup.sh 从测试库导入
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role', 'supabase_admin', 'authenticator', 'corpus_ingest_agent'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;

create schema if not exists extensions;
create extension if not exists pgcrypto schema extensions;
create extension if not exists "uuid-ossp" schema extensions;
create extension if not exists pgroonga schema extensions;
-- 测试库上 vector 装在 public；pg_dump --schema=public 不导出扩展本身，这里先建好
create extension if not exists vector schema public;

alter database postgres set search_path = "$user", public, extensions;
