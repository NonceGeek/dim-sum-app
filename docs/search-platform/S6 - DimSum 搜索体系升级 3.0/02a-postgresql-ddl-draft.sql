-- S6 / Search 3.0 PostgreSQL DDL 精简评审草案 v3
-- 状态：仅供确认，禁止绕过 db pull / diff 审查 / db push 流程直接在 Production 执行。
-- Prisma 无法表达的函数、trigger 和检查约束，在 schema push 后按评审结果作为补充 SQL 执行。
-- 媒体依据：00b-production-media-data-analysis-and-design.md

begin;

alter table public.cantonese_corpus_all
  add column if not exists content_attribute text not null default 'unclassified',
  add column if not exists media_types text[] not null default array['text']::text[];

alter table public.cantonese_corpus_all
  add constraint corpus_content_attribute_ck
    check (content_attribute in ('unclassified', 'oral', 'cultural_knowledge')) not valid,
  add constraint corpus_media_types_ck
    check (
      cardinality(media_types) > 0
      and media_types <@ array['text', 'audio', 'video', 'image', 'model3d']::text[]
      and media_types[1] = 'text'
    ) not valid;

-- 兼容旧 note 中可能是字符串、字符串数组或 {url/link} 对象数组的媒体值。
create or replace function public.corpus_media_value_present(value jsonb)
returns boolean
language sql
immutable
parallel safe
as $function$
  select case jsonb_typeof(value)
    when 'string' then nullif(btrim(value #>> '{}'), '') is not null
    when 'object' then coalesce(
      nullif(btrim(value ->> 'url'), ''),
      nullif(btrim(value ->> 'link'), '')
    ) is not null
    when 'array' then exists (
      select 1
      from jsonb_array_elements(value) item
      where case jsonb_typeof(item)
        when 'string' then nullif(btrim(item #>> '{}'), '') is not null
        when 'object' then coalesce(
          nullif(btrim(item ->> 'url'), ''),
          nullif(btrim(item ->> 'link'), '')
        ) is not null
        else false
      end
    )
    else false
  end
$function$;

create or replace function public.derive_corpus_media_types(
  entry_data text,
  entry_note jsonb,
  entry_structured_note jsonb
)
returns text[]
language plpgsql
immutable
parallel safe
as $function$
declare
  result text[] := array[]::text[];
  has_audio boolean := false;
  has_video boolean := false;
  has_image boolean := false;
  has_model3d boolean := false;
  legacy_audio boolean := false;
  legacy_video boolean := false;
  legacy_image boolean := false;
  legacy_model3d boolean := false;
begin
  if nullif(btrim(coalesce(entry_data, '')), '') is not null then
    result := array_append(result, 'text');
  end if;

  select
    coalesce(bool_or(block_type = 'audio' and has_url), false),
    coalesce(bool_or(block_type = 'video' and has_url), false),
    coalesce(bool_or(block_type = 'image' and has_url), false),
    coalesce(bool_or(block_type in ('model3d', 'voxel') and has_url), false)
  into has_audio, has_video, has_image, has_model3d
  from (
    select
      lower(b.block ->> 'type') as block_type,
      nullif(btrim(coalesce(b.block ->> 'url', '')), '') is not null as has_url
    from jsonb_array_elements(
      case when jsonb_typeof(entry_structured_note -> 'data') = 'array'
        then entry_structured_note -> 'data' else '[]'::jsonb end
    ) d(item)
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(d.item -> 'blocks') = 'array'
        then d.item -> 'blocks' else '[]'::jsonb end
    ) b(block)
  ) structured_media;

  select
    coalesce(bool_or(key ~* '^(audio|audioUrl|音频[0-9]*|音频链接|粤语|普通话)$'
      and public.corpus_media_value_present(value)), false),
    coalesce(bool_or(key ~* '^(video|videoUrl|视频|视频链接|video_clips)$'
      and public.corpus_media_value_present(value)), false),
    coalesce(bool_or(key ~* '^(img|image|imageUrl|cover|coverImage|photo_url|图片|封面|封面图)$'
      and public.corpus_media_value_present(value)), false),
    coalesce(bool_or(key ~* '^(voxel|model3d|model_3d|3d_model|gltf|glb|usdz)$'
      and public.corpus_media_value_present(value)), false)
  into legacy_audio, legacy_video, legacy_image, legacy_model3d
  from jsonb_each(
    case when jsonb_typeof(entry_note -> 'context') = 'object'
      then entry_note -> 'context' else '{}'::jsonb end
  );

  has_audio := has_audio or legacy_audio;
  has_video := has_video or legacy_video
    or public.corpus_media_value_present(entry_note -> 'video_clips');
  has_image := has_image or legacy_image;
  has_model3d := has_model3d or legacy_model3d;

  if has_audio then result := array_append(result, 'audio'); end if;
  if has_video then result := array_append(result, 'video'); end if;
  if has_image then result := array_append(result, 'image'); end if;
  if has_model3d then result := array_append(result, 'model3d'); end if;

  return result;
end
$function$;

create or replace function public.refresh_corpus_media_types()
returns trigger
language plpgsql
as $function$
begin
  new.media_types := public.derive_corpus_media_types(
    new.data,
    new.note,
    new.structured_note
  );
  return new;
end
$function$;

drop trigger if exists corpus_media_types_derive_trg
  on public.cantonese_corpus_all;

create trigger corpus_media_types_derive_trg
before insert or update of data, note, structured_note
on public.cantonese_corpus_all
for each row execute function public.refresh_corpus_media_types();

commit;

-- 独立受控作业：
-- 1. 按 id 分批调用 derive_corpus_media_types 回填存量。
-- 2. 核对组合基线：text=9,983，text+audio=40,995，text+image=10，
--    text+video=5，text+audio+model3d=1。
-- 3. 使用 CREATE INDEX CONCURRENTLY 创建 content_attribute B-tree 和 media_types GIN 索引。
-- 4. ANALYZE 后执行 VALIDATE CONSTRAINT。
-- 5. 开启 Search 媒体过滤前，JSON 与 media_types 一致率必须为 100%。
--
-- 本 migration 不创建来源、Agent run、review task、media asset、share event 或 outbox 表。
-- Agent 分类建议表必须等待 Agent 契约确认后另行评审。
