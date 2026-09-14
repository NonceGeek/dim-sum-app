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
  primary key(id, name)
);
create table corpus_collection_activities (
  id bigserial primary key, title text not null, slug text unique, description text, rules text,
  reward_config jsonb not null default '{}', media_requirements jsonb not null default '{}',
  banner_url text, status text not null default 'draft', starts_at timestamptz, ends_at timestamptz,
  created_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  category text, submission_types jsonb not null default '[]', tags jsonb not null default '[]',
  display_uuid uuid not null unique default gen_random_uuid(), questionnaire_gate_enabled boolean not null default true
);
create table cantonese_corpus_all (
  id bigserial primary key, category text not null references cantonese_categories(name),
  data text not null, content_attribute text not null default 'unclassified'
);
insert into cantonese_categories(name,nickname) values ('oral-source','Old alias'),('cultural-source','Dictionary'),('mixed-source','Mixed');
insert into cantonese_corpus_all(category,data,content_attribute) values
 ('oral-source','one','oral'),('oral-source','two','oral'),
 ('cultural-source','three','cultural_knowledge'),
 ('mixed-source','four','oral'),('mixed-source','five','cultural_knowledge');
insert into corpus_collection_activities(title) values ('Legacy activity');
