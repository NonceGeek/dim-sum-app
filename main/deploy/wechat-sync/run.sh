#!/bin/sh
set -eu
case "${1:-}" in
  pending|full) ;;
  *) echo 'Usage: run.sh pending|full' >&2; exit 2 ;;
esac
# Both schedules and manual runs use one lock. A busy worker is not an error.
exec 9>/run/lock/dimsum-wechat-sync.lock
/usr/bin/flock -n 9 || exit 0
trap '/usr/bin/docker stop --time 20 dimsum-wechat-sync-job >/dev/null 2>&1 || true' EXIT
trap 'exit 143' TERM INT
/usr/bin/docker run --rm --name dimsum-wechat-sync-job \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 512m --cpus 0.5 --pids-limit 128 \
  --env-file /etc/dimsum-wechat-sync/worker.env \
  dimsum-wechat-sync:local \
  node --import tsx scripts/sync-wechat-service-followers.ts "--$1"
