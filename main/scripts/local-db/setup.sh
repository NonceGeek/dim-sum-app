#!/usr/bin/env bash
# 本地 Docker 测试库：从 Supabase 测试库复制 public（表结构、函数、触发器、RLS、授权与数据）。
#
#   bash scripts/local-db/setup.sh          # 首次创建
#   bash scripts/local-db/setup.sh --reset  # 删掉本地库重新复制
#
# 来源取 SOURCE_DATABASE_URL，缺省用 .env 的 DIRECT_URL；只允许测试库，与 dev-login 的白名单一致。
# 本地库监听 127.0.0.1:54329，连接串：postgresql://postgres:postgres@127.0.0.1:54329/postgres
set -euo pipefail

cd "$(dirname "$0")"
NAME=dimsum-pg
IMAGE=dimsum-pg:15
PORT=54329
TEST_DATABASE_REFS="lesgvmmlsbckbupcouou"

SRC="${SOURCE_DATABASE_URL:-$(awk '/^DIRECT_URL=/{sub(/^[^=]*=/,""); gsub(/"/,""); print}' ../../.env)}"
ref=$(printf '%s' "$SRC" | sed -nE 's#^postgres(ql)?://[^.:@]+\.([a-z0-9]+)[:@].*#\2#p')
if [[ -z "$ref" || " $TEST_DATABASE_REFS " != *" $ref "* ]]; then
  echo "来源不是 Supabase 测试库，拒绝复制（检查 SOURCE_DATABASE_URL 或 .env 的 DIRECT_URL）" >&2
  exit 1
fi

if docker container inspect "$NAME" >/dev/null 2>&1; then
  if [[ "${1:-}" != "--reset" ]]; then
    echo "容器 $NAME 已存在；要重新复制请加 --reset" >&2
    exit 1
  fi
  docker rm -f "$NAME" >/dev/null
  docker volume rm "$NAME-data" >/dev/null 2>&1 || true
fi

docker build -q -t "$IMAGE" . >/dev/null
docker run -d --restart unless-stopped --name "$NAME" -p "127.0.0.1:$PORT:5432" -v "$NAME-data:/var/lib/postgresql/data" \
  -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
until docker exec "$NAME" pg_isready -U postgres -q && docker exec "$NAME" psql -U postgres -Atqc 'select 1' >/dev/null 2>&1; do
  sleep 1
done
# 初始化脚本跑完后 postgres 会重启一次，再确认一遍
sleep 2
until docker exec "$NAME" pg_isready -U postgres -q; do sleep 1; done

# 用容器里与测试库同版本的 pg_dump；连接串经 stdin 传入，不出现在宿主机进程参数里
log=$(mktemp)
printf '%s\n' "$SRC" | docker exec -i "$NAME" sh -c '
  read -r SRC
  pg_dump --dbname="$SRC" --schema=public --no-owner \
    | psql -U postgres -d postgres -q -v ON_ERROR_STOP=0 >/dev/null
' 2>"$log" || true

errors=$(grep -c 'ERROR' "$log" || true)
if [[ "$errors" != "0" ]]; then
  echo "导入时有 $errors 条错误（多为 Supabase 专有对象），详情：$log"
else
  rm -f "$log"
fi
docker exec "$NAME" psql -U postgres -Atc \
  "select 'public 表 ' || count(*) from pg_tables where schemaname = 'public'"
echo "本地库就绪：postgresql://postgres:postgres@127.0.0.1:$PORT/postgres"
