-- Minimal isolated integration fixture. Never execute on an existing database.
create type "CategoryStatus" as enum ('RAW', 'ANNOTATING', 'ANNOTATED');
create table cantonese_categories (
  id bigserial, name text unique not null, nickname text, description text,
  likes bigint default 0, created_at timestamptz not null default now(), updated_at timestamp default now(),
  cover text, link text, tags jsonb, pinned boolean not null default false,
  editable_level bigint not null default 0, if_in_all_data boolean not null default false,
  related jsonb not null default '{}', size real, taggers jsonb not null default '[]',
  sorting bigint not null default 0, status "CategoryStatus" not null default 'RAW',
  is_public boolean not null default true, recommend_words jsonb not null default '[]',
  content_attribute text not null default 'oral',
  primary key(id, name)
);
-- Deterministic test substitutes, NOT production search operators. These test
-- access control and pagination, not PGroonga/pgvector relevance or performance.
create function fixture_text_match(text, text) returns boolean language sql immutable
as $$ select $1 ilike '%' || $2 || '%' $$;
create operator &@~ (leftarg=text, rightarg=text, function=fixture_text_match);
create domain vector as double precision;
create function fixture_distance(double precision, double precision) returns double precision language sql immutable
as $$ select abs($1 - $2) $$;
create operator <=> (leftarg=double precision, rightarg=double precision, function=fixture_distance);

create table cantonese_corpus_all (
 id bigserial primary key, unique_id uuid unique not null default gen_random_uuid(),
 data text not null, note jsonb default '{}', structured_note jsonb,
 category text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 tags jsonb default '[]', editable_level smallint not null default 1, liked_num bigint not null default 0,
 bookmark_num bigint not null default 0, view_num bigint not null default 0,
 lifecycle_stage text not null default 'draft', media_types text[] not null default array['text']
);
create table content_categories (id bigint primary key, slug text, name text, parent_id bigint);
create table corpus_category (corpus_id bigint primary key, category_id bigint);
create table tags (id bigint primary key, slug text, name text, facet text, status text, sort_order integer, corpus_count integer);
create table corpus_tags (corpus_id bigint, tag_id bigint);
create table tag_related (tag_id bigint, related_id bigint, method text, score double precision);
create table corpus_field_embeddings (corpus_id bigint, field_type text, embedding vector);
create table cantonese_corpus_update_history (unique_id uuid, contributor_user_id text);
create table corpus_embedding_neighbor_builds (id bigint primary key, field_type text, status text);
create table corpus_embedding_neighbors (build_id bigint, field_type text, source_corpus_id bigint, target_corpus_id bigint, rank integer, similarity double precision);
create type "Role" as enum ('LEARNER','TAGGER_PARTNER','TAGGER_OUTSOURCING','RESEARCHER');
create type "UserStatus" as enum ('ACTIVE','PENDING_DELETE','DELETED','MERGED');
create type "CorpusPermission" as enum ('READ','WRITE','CREATE','FULL');
create table "User" (id text primary key, role "Role", "isSystemAdmin" boolean, status "UserStatus");
create table user_corpus_permissions (
 id bigserial primary key, user_id text, category_name text, permission "CorpusPermission",
 created_at timestamptz default now(), updated_at timestamptz default now(), created_by text,
 unique(user_id,category_name)
);

insert into cantonese_categories(name,is_public) values ('published',true),('hidden',false);
insert into cantonese_corpus_all(id,unique_id,data,category,view_num) values
 (1,'00000000-0000-4000-8000-000000000001','needle','hidden',99999),
 (2,'00000000-0000-4000-8000-000000000002','needle public','published',1),
 (3,'00000000-0000-4000-8000-000000000003','needle orphan','missing-dataset',99999);
-- More private candidates than either vector LIMIT: post-filtering would starve
-- the public result pages. Both text and vector ordering prefer private rows.
insert into cantonese_corpus_all(id,data,category,view_num)
 select n,'needle private '||n,'hidden',99999 from generate_series(10,89) n;
insert into cantonese_corpus_all(id,data,category,view_num)
 select n,'needle public '||n,'published',1 from generate_series(100,112) n;
insert into corpus_field_embeddings
 select id,'doc',case when category='published' then 0.5 + id * 0.0001 else 0 end from cantonese_corpus_all;
insert into content_categories values (1,'root','Root',null),(2,'child','Child',1);
insert into corpus_category select id,2 from cantonese_corpus_all;
insert into tags values (1,'tag','Tag','topic','active',0,100),(2,'related','Related','topic','active',1,100);
insert into corpus_tags select id,case when id%2=0 then 1 else 2 end from cantonese_corpus_all;
insert into tag_related values (1,2,'manual',1),(2,1,'manual',1);
insert into corpus_embedding_neighbor_builds values (1,'doc','active');
insert into corpus_embedding_neighbors
 select 1,'doc',id,1,1,1 from cantonese_corpus_all where category='published';
insert into "User" values ('learner','LEARNER',false,'ACTIVE'),('editor','TAGGER_PARTNER',false,'ACTIVE'),
 ('outsider','TAGGER_PARTNER',false,'ACTIVE'),('researcher','RESEARCHER',false,'ACTIVE'),
 ('admin','LEARNER',true,'ACTIVE'),('disabled','TAGGER_PARTNER',false,'DELETED'),('reader','RESEARCHER',false,'ACTIVE');
insert into user_corpus_permissions(user_id,category_name,permission) values
 ('editor','hidden','WRITE'),('researcher','hidden','CREATE'),('disabled','hidden','FULL'),('reader','hidden','READ'),
 ('outsider','published','WRITE');

