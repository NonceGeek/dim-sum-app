-- 前置条件：已按 db pull -> diff 审查 -> schema 编辑 -> db push 增加两个字段和索引。
-- 本文件只安装 Prisma schema 无法完整表达的 check、函数和 trigger。

begin;

alter table public.cantonese_corpus_all
  alter column media_types set not null;

alter table public.cantonese_corpus_all
  drop constraint if exists corpus_content_attribute_ck,
  drop constraint if exists corpus_media_types_ck;

alter table public.cantonese_corpus_all
  add constraint corpus_content_attribute_ck
    check (content_attribute in ('unclassified', 'oral', 'cultural_knowledge')) not valid,
  add constraint corpus_media_types_ck
    check (
      media_types is not null
      and cardinality(media_types) > 0
      and media_types <@ array['text', 'audio', 'video', 'image', 'model3d']::text[]
      and media_types[1] = 'text'
    ) not valid;

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
  result text[] := array['text']::text[];
  has_audio boolean := false;
  has_video boolean := false;
  has_image boolean := false;
  has_model3d boolean := false;
  legacy_audio boolean := false;
  legacy_video boolean := false;
  legacy_image boolean := false;
  legacy_model3d boolean := false;
begin
  select
    coalesce(bool_or(block_type = 'audio' and has_url), false),
    coalesce(bool_or(block_type = 'video' and has_url), false),
    coalesce(bool_or(block_type = 'image' and has_url), false),
    coalesce(bool_or(block_type in ('model3d', 'voxel') and has_url), false)
  into has_audio, has_video, has_image, has_model3d
  from (
    select
      lower(b.block ->> 'type') as block_type,
      coalesce(
        nullif(btrim(b.block ->> 'url'), ''),
        nullif(btrim(b.block ->> 'link'), '')
      ) is not null as has_url
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
