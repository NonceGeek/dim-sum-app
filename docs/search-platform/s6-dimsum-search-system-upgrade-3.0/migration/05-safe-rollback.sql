-- 仅在媒体派生 trigger 被确认有错误时执行。
-- 不删除新增字段、索引、约束、函数或已回填数据。

begin;

drop trigger if exists corpus_media_types_derive_trg
  on public.cantonese_corpus_all;

commit;

-- 应用侧同时停止传入 S6 新参数或回滚到旧 API/应用版本。
-- 修复后重新执行 01-supplemental-schema.sql 会恢复 trigger。
