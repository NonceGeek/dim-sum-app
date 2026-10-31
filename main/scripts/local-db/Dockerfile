# 本地测试库：与 Supabase 测试库同为 PostgreSQL 15，带 pgvector 与 pgroonga
FROM postgres:15-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl postgresql-15-pgvector \
  && curl -fsSLo /tmp/groonga.deb https://packages.groonga.org/debian/groonga-apt-source-latest-bookworm.deb \
  && apt-get install -y --no-install-recommends /tmp/groonga.deb \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-15-pgdg-pgroonga \
  && rm -rf /tmp/groonga.deb /var/lib/apt/lists/*

COPY init.sql /docker-entrypoint-initdb.d/
