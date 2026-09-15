#!/usr/bin/env python3
"""Build a source-only worker bundle; never include .env or other credentials."""
import pathlib
import sys
import tarfile

here = pathlib.Path(__file__).resolve().parent
main = here.parent.parent
destination = pathlib.Path(sys.argv[1]).resolve()
files = {
    **{name: here / name for name in (
        'Dockerfile', 'Dockerfile.ecs', 'package.json', 'package-lock.json', 'preflight.mjs',
        'run.sh', 'dimsum-wechat-sync@.service',
        'dimsum-wechat-sync-pending.timer', 'dimsum-wechat-sync-full.timer',
    )},
    **{name: main / name for name in (
        'prisma/schema.prisma', 'lib/prisma.ts',
        'lib/wechat-service/client.ts', 'lib/wechat-service/store.ts',
        'scripts/sync-wechat-service-followers.ts',
    )},
}
with tarfile.open(destination, 'w:gz') as archive:
    for name, path in files.items():
        archive.add(path, arcname=name)
print(f'Worker bundle: {destination} ({len(files)} files, no credentials)')
