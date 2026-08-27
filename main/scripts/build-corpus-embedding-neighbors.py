#!/usr/bin/env python3
"""Build and maintain corpus embedding neighbors from a local machine.

The online application only reads an explicitly activated build. Full builds are
written under a new build ID, so interruption cannot affect production results.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, Sequence
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import numpy as np
import psycopg
from dotenv import load_dotenv
from psycopg import Connection


SCRIPT_VERSION = "1.0.0"
ADVISORY_LOCK_KEY = 4_382_761_905
DEFAULT_FIELD_TYPE = "doc"
DEFAULT_TOP_K = 32
DEFAULT_BATCH_SIZE = 200
DEFAULT_HNSW_M = 32
DEFAULT_EF_CONSTRUCTION = 160
DEFAULT_EF_SEARCH = 96
MIN_ACTIVATION_COVERAGE = 0.95
PRISMA_ONLY_QUERY_PARAMETERS = {
    "connection_limit",
    "pool_timeout",
    "pgbouncer",
    "connect_timeout",
}


@dataclass(frozen=True)
class CorpusVector:
    corpus_id: int
    updated_at: datetime


def log(message: str) -> None:
    print(f"[{datetime.now().astimezone().isoformat(timespec='seconds')}] {message}", flush=True)


def load_environment() -> None:
    project_dir = Path(__file__).resolve().parents[1]
    for filename in (".env.local", ".env"):
        path = project_dir / filename
        if path.exists():
            load_dotenv(path, override=False)


def sanitize_database_url(value: str) -> str:
    parts = urlsplit(value)
    query = [
        (key, item)
        for key, item in parse_qsl(parts.query, keep_blank_values=True)
        if key not in PRISMA_ONLY_QUERY_PARAMETERS
    ]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def database_url() -> str:
    value = (
        os.getenv("DIRECT_DATABASE_URL")
        or os.getenv("DIRECT_URL")
        or os.getenv("DATABASE_URL")
    )
    if not value:
        raise RuntimeError("Missing DIRECT_URL, DIRECT_DATABASE_URL, or DATABASE_URL")
    return sanitize_database_url(value)


def connect() -> Connection:
    connection = psycopg.connect(database_url(), application_name="corpus-neighbor-builder")
    with connection.cursor() as cursor:
        cursor.execute("set statement_timeout = 0")
        cursor.execute("set lock_timeout = '5s'")
    connection.commit()
    return connection


def require_tables(connection: Connection) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select
              to_regclass('public.corpus_embedding_neighbor_builds'),
              to_regclass('public.corpus_embedding_neighbors'),
              to_regclass('public.corpus_embedding_neighbor_sync_state')
            """
        )
        tables = cursor.fetchone()
    if not tables or any(table is None for table in tables):
        raise RuntimeError(
            "Neighbor tables are missing. Apply Prisma migration "
            "20260827090000_add_corpus_embedding_neighbors first."
        )


def acquire_builder_lock(connection: Connection) -> None:
    with connection.cursor() as cursor:
        cursor.execute("select pg_try_advisory_lock(%s)", (ADVISORY_LOCK_KEY,))
        acquired = cursor.fetchone()[0]
    if not acquired:
        raise RuntimeError("Another embedding-neighbor builder is already running")


def release_builder_lock(connection: Connection) -> None:
    try:
        with connection.cursor() as cursor:
            cursor.execute("select pg_advisory_unlock(%s)", (ADVISORY_LOCK_KEY,))
        connection.commit()
    except Exception:
        connection.rollback()


def parse_vector(value: str) -> np.ndarray:
    vector = np.fromstring(value.strip("[]"), dtype=np.float32, sep=",")
    if vector.size == 0 or not np.isfinite(vector).all():
        raise ValueError("Encountered an empty or non-finite embedding")
    return vector


def load_canonical_vectors(
    connection: Connection,
    field_type: str,
    *,
    cutoff: datetime | None = None,
    limit: int | None = None,
) -> tuple[list[CorpusVector], np.ndarray]:
    cutoff_condition = "and updated_at <= %s" if cutoff else ""
    parameters: list[object] = [field_type]
    if cutoff:
        parameters.append(cutoff)
    limit_clause = "limit %s" if limit else ""
    if limit:
        parameters.append(limit)

    query = f"""
      select corpus_id, updated_at, embedding::text
      from (
        select distinct on (corpus_id)
          corpus_id,
          updated_at,
          embedding
        from public.corpus_field_embeddings
        where field_type = %s
          {cutoff_condition}
        order by corpus_id, updated_at desc, id desc
      ) canonical
      order by corpus_id
      {limit_clause}
    """

    metadata: list[CorpusVector] = []
    vectors: list[np.ndarray] = []
    dimension: int | None = None
    with connection.cursor(name="canonical_embedding_stream") as cursor:
        cursor.itersize = 500
        cursor.execute(query, parameters)
        for corpus_id, updated_at, embedding_text in cursor:
            vector = parse_vector(embedding_text)
            if dimension is None:
                dimension = int(vector.size)
            elif vector.size != dimension:
                raise ValueError(
                    f"Embedding dimension mismatch for corpus {corpus_id}: "
                    f"expected {dimension}, got {vector.size}"
                )
            metadata.append(CorpusVector(int(corpus_id), updated_at))
            vectors.append(vector)

    if len(metadata) < 2:
        raise RuntimeError("At least two canonical embeddings are required")

    matrix = np.ascontiguousarray(np.vstack(vectors), dtype=np.float32)
    log(f"Loaded {len(metadata):,} canonical {field_type} vectors ({matrix.shape[1]} dimensions)")
    return metadata, matrix


def build_faiss_index(matrix: np.ndarray, args: argparse.Namespace):
    try:
        import faiss
    except ImportError as error:
        raise RuntimeError("FAISS is not installed; run pnpm db:neighbors:setup") from error

    normalized = np.ascontiguousarray(matrix.copy(), dtype=np.float32)
    faiss.normalize_L2(normalized)
    index = faiss.IndexHNSWFlat(normalized.shape[1], args.hnsw_m, faiss.METRIC_INNER_PRODUCT)
    index.hnsw.efConstruction = args.ef_construction
    index.hnsw.efSearch = args.ef_search
    if args.threads:
        faiss.omp_set_num_threads(args.threads)

    started = time.monotonic()
    index.add(normalized)
    log(f"Built local FAISS HNSW index in {time.monotonic() - started:.1f}s")
    return index, normalized


def chunks(values: Sequence[int], size: int) -> Iterable[Sequence[int]]:
    for start in range(0, len(values), size):
        yield values[start : start + size]


def create_build(
    connection: Connection,
    args: argparse.Namespace,
    source_count: int,
    dimension: int,
    watermark: datetime,
) -> str:
    metadata = {
        "builder": "local-faiss-hnsw",
        "script_version": SCRIPT_VERSION,
        "sample_limit": args.limit,
        "hnsw_m": args.hnsw_m,
        "ef_construction": args.ef_construction,
        "ef_search": args.ef_search,
    }
    with connection.cursor() as cursor:
        cursor.execute(
            """
            insert into public.corpus_embedding_neighbor_builds (
              field_type, model_name, embedding_dimension, neighbors_per_source,
              source_count, source_watermark, metadata
            ) values (%s, %s, %s, %s, %s, %s, %s::jsonb)
            returning id::text
            """,
            (
                args.field_type,
                args.model_name,
                dimension,
                args.top_k,
                source_count,
                watermark,
                json.dumps(metadata),
            ),
        )
        build_id = cursor.fetchone()[0]
    connection.commit()
    log(f"Created isolated build {build_id}")
    return build_id


def load_resumable_build(connection: Connection, build_id: str, args: argparse.Namespace) -> dict:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select field_type, embedding_dimension, neighbors_per_source, status,
                   source_count, source_watermark
            from public.corpus_embedding_neighbor_builds
            where id = %s::uuid
            """,
            (build_id,),
        )
        row = cursor.fetchone()
    if not row:
        raise RuntimeError(f"Build {build_id} was not found")
    if row[3] not in ("building", "ready"):
        raise RuntimeError(f"Build {build_id} cannot be resumed from status {row[3]}")
    if row[0] != args.field_type or row[2] != args.top_k:
        raise RuntimeError("Resume arguments do not match the existing build")
    return {
        "dimension": row[1],
        "source_count": row[4],
        "watermark": row[5],
        "status": row[3],
    }


def completed_source_ids(connection: Connection, build_id: str, field_type: str) -> set[int]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select source_corpus_id
            from public.corpus_embedding_neighbors
            where build_id = %s::uuid and field_type = %s
            group by source_corpus_id
            """,
            (build_id, field_type),
        )
        return {int(row[0]) for row in cursor.fetchall()}


def neighbor_rows_for_batch(
    index,
    normalized: np.ndarray,
    metadata: Sequence[CorpusVector],
    source_indices: Sequence[int],
    top_k: int,
) -> list[tuple]:
    search_k = min(len(metadata), top_k + 8)
    similarities, neighbor_indices = index.search(normalized[list(source_indices)], search_k)
    rows: list[tuple] = []
    computed_at = datetime.now().astimezone()

    for batch_position, source_index in enumerate(source_indices):
        source = metadata[source_index]
        rank = 0
        seen_targets: set[int] = set()
        for similarity, target_index in zip(
            similarities[batch_position], neighbor_indices[batch_position]
        ):
            if target_index < 0:
                continue
            target = metadata[int(target_index)]
            if target.corpus_id == source.corpus_id or target.corpus_id in seen_targets:
                continue
            seen_targets.add(target.corpus_id)
            rank += 1
            bounded_similarity = max(-1.0, min(1.0, float(similarity)))
            rows.append(
                (
                    source.corpus_id,
                    target.corpus_id,
                    rank,
                    max(0.0, 1.0 - bounded_similarity),
                    bounded_similarity,
                    source.updated_at,
                    target.updated_at,
                    computed_at,
                )
            )
            if rank >= top_k:
                break
        if rank != min(top_k, len(metadata) - 1):
            raise RuntimeError(
                f"Only found {rank} unique neighbors for corpus {source.corpus_id}"
            )
    return rows


def copy_neighbor_rows(
    connection: Connection,
    build_id: str,
    field_type: str,
    rows: Sequence[tuple],
) -> None:
    with connection.cursor() as cursor:
        with cursor.copy(
            """
            copy public.corpus_embedding_neighbors (
              build_id, field_type, source_corpus_id, target_corpus_id, rank,
              distance, similarity, source_embedding_updated_at,
              target_embedding_updated_at, computed_at
            ) from stdin
            """
        ) as copy:
            for row in rows:
                copy.write_row((build_id, field_type, *row))


def mark_build_progress(
    connection: Connection, build_id: str, source_delta: int, neighbor_delta: int
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            update public.corpus_embedding_neighbor_builds
            set processed_source_count = processed_source_count + %s,
                neighbor_count = neighbor_count + %s,
                error_message = null,
                updated_at = now()
            where id = %s::uuid
            """,
            (source_delta, neighbor_delta, build_id),
        )


def validate_and_ready_build(connection: Connection, build_id: str) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select b.source_count, b.neighbors_per_source,
                   count(distinct n.source_corpus_id)::integer,
                   count(n.*)::bigint
            from public.corpus_embedding_neighbor_builds b
            left join public.corpus_embedding_neighbors n
              on n.build_id = b.id and n.field_type = b.field_type
            where b.id = %s::uuid
            group by b.id
            """,
            (build_id,),
        )
        source_count, top_k, actual_sources, actual_neighbors = cursor.fetchone()
        expected_neighbors = source_count * top_k
        if actual_sources != source_count or actual_neighbors != expected_neighbors:
            cursor.execute(
                """
                update public.corpus_embedding_neighbor_builds
                set status = 'failed', error_message = %s, updated_at = now()
                where id = %s::uuid
                """,
                (
                    f"Validation failed: sources={actual_sources}/{source_count}, "
                    f"neighbors={actual_neighbors}/{expected_neighbors}",
                    build_id,
                ),
            )
            connection.commit()
            raise RuntimeError("Build validation failed; see build error_message")
        cursor.execute(
            """
            update public.corpus_embedding_neighbor_builds
            set status = 'ready', processed_source_count = %s,
                neighbor_count = %s, completed_at = now(), updated_at = now(),
                error_message = null
            where id = %s::uuid
            """,
            (actual_sources, actual_neighbors, build_id),
        )
    connection.commit()
    log(f"Build {build_id} is ready with {actual_neighbors:,} neighbor rows")


def run_full(connection: Connection, args: argparse.Namespace) -> None:
    # Always index the complete canonical target space. --limit restricts only
    # the source rows written by a diagnostic build, not neighbor quality.
    metadata, matrix = load_canonical_vectors(connection, args.field_type)
    source_indices = list(range(len(metadata)))
    if args.limit:
        source_indices = source_indices[: args.limit]
    source_count = len(source_indices)
    watermark = max(item.updated_at for item in metadata)
    if args.resume:
        build = load_resumable_build(connection, args.resume, args)
        if (
            build["dimension"] != matrix.shape[1]
            or build["source_count"] != source_count
            or build["watermark"] != watermark
        ):
            raise RuntimeError("Current canonical vector set no longer matches resumable build")
        build_id = args.resume
        if build["status"] == "ready":
            log(f"Build {build_id} is already ready")
            return
    else:
        build_id = create_build(
            connection, args, source_count, matrix.shape[1], watermark
        )

    index, normalized = build_faiss_index(matrix, args)
    completed = completed_source_ids(connection, build_id, args.field_type)
    pending_indices = [
        index
        for index in source_indices
        if metadata[index].corpus_id not in completed
    ]
    log(f"Computing {len(pending_indices):,} pending sources for build {build_id}")
    started = time.monotonic()

    for batch_number, source_indices in enumerate(
        chunks(pending_indices, args.batch_size), start=1
    ):
        rows = neighbor_rows_for_batch(
            index, normalized, metadata, source_indices, args.top_k
        )
        try:
            copy_neighbor_rows(connection, build_id, args.field_type, rows)
            mark_build_progress(connection, build_id, len(source_indices), len(rows))
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        processed = min(batch_number * args.batch_size, len(pending_indices))
        elapsed = time.monotonic() - started
        rate = processed / elapsed if elapsed else 0
        log(
            f"Build {build_id}: {processed:,}/{len(pending_indices):,} pending "
            f"sources ({rate:.1f} sources/s)"
        )

    validate_and_ready_build(connection, build_id)
    log(f"Next: pnpm db:neighbors:activate --build-id {build_id}")


def active_build(connection: Connection, field_type: str) -> dict:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select id::text, neighbors_per_source, embedding_dimension,
                   source_watermark, model_name
            from public.corpus_embedding_neighbor_builds
            where field_type = %s and status = 'active'
            """,
            (field_type,),
        )
        row = cursor.fetchone()
    if not row:
        raise RuntimeError(f"No active neighbor build exists for {field_type}")
    return {
        "id": row[0],
        "top_k": row[1],
        "dimension": row[2],
        "source_watermark": row[3],
        "model_name": row[4],
    }


def incremental_watermark(connection: Connection, build: dict, field_type: str) -> datetime:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select watermark
            from public.corpus_embedding_neighbor_sync_state
            where field_type = %s and active_build_id = %s::uuid
            """,
            (field_type, build["id"]),
        )
        row = cursor.fetchone()
    return row[0] if row else build["source_watermark"]


def mark_incremental_started(
    connection: Connection, field_type: str, build_id: str, watermark: datetime
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            insert into public.corpus_embedding_neighbor_sync_state (
              field_type, watermark, active_build_id, last_started_at,
              last_changed_source_count, last_error
            ) values (%s, %s, %s::uuid, now(), 0, null)
            on conflict (field_type) do update
            set active_build_id = excluded.active_build_id,
                last_started_at = now(), last_error = null, updated_at = now()
            """,
            (field_type, watermark, build_id),
        )
    connection.commit()


def changed_canonical_source_ids(
    connection: Connection,
    field_type: str,
    watermark: datetime,
    cutoff: datetime,
) -> list[int]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select corpus_id
            from (
              select distinct on (corpus_id) corpus_id, updated_at
              from public.corpus_field_embeddings
              where field_type = %s and updated_at <= %s
              order by corpus_id, updated_at desc, id desc
            ) canonical
            where updated_at > %s
            order by corpus_id
            """,
            (field_type, cutoff, watermark),
        )
        return [int(row[0]) for row in cursor.fetchall()]


def run_incremental(connection: Connection, args: argparse.Namespace) -> None:
    build = active_build(connection, args.field_type)
    watermark = incremental_watermark(connection, build, args.field_type)
    with connection.cursor() as cursor:
        cursor.execute("select clock_timestamp()")
        cutoff = cursor.fetchone()[0]
    connection.commit()
    mark_incremental_started(connection, args.field_type, build["id"], watermark)

    changed_source_ids = changed_canonical_source_ids(
        connection, args.field_type, watermark, cutoff
    )
    if args.limit:
        changed_source_ids = changed_source_ids[: args.limit]
    if not changed_source_ids:
        finish_incremental(
            connection, args.field_type, build["id"], cutoff, 0
        )
        log("No canonical embeddings changed after the current watermark")
        return

    metadata, matrix = load_canonical_vectors(
        connection, args.field_type, cutoff=cutoff
    )
    if matrix.shape[1] != build["dimension"]:
        raise RuntimeError("Canonical embedding dimension differs from active build")
    changed_source_id_set = set(changed_source_ids)
    changed_indices = [
        index
        for index, item in enumerate(metadata)
        if item.corpus_id in changed_source_id_set
    ]
    if len(changed_indices) != len(changed_source_ids):
        raise RuntimeError("Changed canonical source set shifted during incremental snapshot")

    args.top_k = build["top_k"]
    index, normalized = build_faiss_index(matrix, args)
    processed = 0
    log(
        f"Updating {len(changed_indices):,} changed sources in active build {build['id']}"
    )
    for source_indices in chunks(changed_indices, args.batch_size):
        rows = neighbor_rows_for_batch(
            index, normalized, metadata, source_indices, build["top_k"]
        )
        source_ids = [metadata[index].corpus_id for index in source_indices]
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    delete from public.corpus_embedding_neighbors
                    where build_id = %s::uuid and field_type = %s
                      and source_corpus_id = any(%s::bigint[])
                    """,
                    (build["id"], args.field_type, source_ids),
                )
            copy_neighbor_rows(connection, build["id"], args.field_type, rows)
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        processed += len(source_indices)
        log(f"Incremental build: {processed:,}/{len(changed_indices):,} sources")

    # A limited run must not advance beyond unprocessed changed sources.
    # Limited runs are diagnostics. Do not advance the durable watermark because
    # additional sources can share the same updated_at timestamp.
    completed_watermark = watermark if args.limit else cutoff
    finish_incremental(
        connection, args.field_type, build["id"], completed_watermark, processed
    )
    log(f"Incremental update completed for {processed:,} sources")


def finish_incremental(
    connection: Connection,
    field_type: str,
    build_id: str,
    watermark: datetime,
    changed_count: int,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            update public.corpus_embedding_neighbor_sync_state
            set watermark = %s, last_completed_at = now(),
                last_changed_source_count = %s, last_error = null,
                updated_at = now()
            where field_type = %s and active_build_id = %s::uuid
            """,
            (watermark, changed_count, field_type, build_id),
        )
        cursor.execute(
            """
            update public.corpus_embedding_neighbor_builds b
            set processed_source_count = stats.source_count,
                source_count = stats.source_count,
                neighbor_count = stats.neighbor_count,
                source_watermark = greatest(b.source_watermark, %s),
                updated_at = now()
            from (
              select count(distinct source_corpus_id)::integer as source_count,
                     count(*)::bigint as neighbor_count
              from public.corpus_embedding_neighbors
              where build_id = %s::uuid and field_type = %s
            ) stats
            where b.id = %s::uuid
            """,
            (watermark, build_id, field_type, build_id),
        )
    connection.commit()


def activate(connection: Connection, args: argparse.Namespace) -> None:
    with connection.cursor() as cursor:
        if args.build_id:
            cursor.execute(
                """
                select id::text, field_type, source_count, source_watermark
                from public.corpus_embedding_neighbor_builds
                where id = %s::uuid and status = 'ready'
                for update
                """,
                (args.build_id,),
            )
        else:
            cursor.execute(
                """
                select id::text, field_type, source_count, source_watermark
                from public.corpus_embedding_neighbor_builds
                where field_type = %s and status = 'ready'
                order by completed_at desc
                limit 1 for update
                """,
                (args.field_type,),
            )
        row = cursor.fetchone()
        if not row:
            raise RuntimeError("No matching ready build was found")
        build_id, field_type, source_count, source_watermark = row
        cursor.execute(
            """
            select count(*)::integer
            from (
              select distinct on (corpus_id) corpus_id
              from public.corpus_field_embeddings
              where field_type = %s
              order by corpus_id, updated_at desc, id desc
            ) canonical
            """,
            (field_type,),
        )
        canonical_count = cursor.fetchone()[0]
        coverage = source_count / canonical_count if canonical_count else 0
        if coverage < MIN_ACTIVATION_COVERAGE and not args.allow_partial:
            raise RuntimeError(
                f"Build coverage {coverage:.1%} is below {MIN_ACTIVATION_COVERAGE:.0%}; "
                "refusing activation (use --allow-partial only for a deliberate test)"
            )
        cursor.execute(
            """
            update public.corpus_embedding_neighbor_builds
            set status = 'retired', updated_at = now()
            where field_type = %s and status = 'active' and id <> %s::uuid
            """,
            (field_type, build_id),
        )
        cursor.execute(
            """
            update public.corpus_embedding_neighbor_builds
            set status = 'active', activated_at = now(), updated_at = now()
            where id = %s::uuid
            """,
            (build_id,),
        )
        cursor.execute(
            """
            insert into public.corpus_embedding_neighbor_sync_state (
              field_type, watermark, active_build_id, last_completed_at
            ) values (%s, %s, %s::uuid, now())
            on conflict (field_type) do update
            set watermark = excluded.watermark,
                active_build_id = excluded.active_build_id,
                last_completed_at = now(), last_error = null, updated_at = now()
            """,
            (field_type, source_watermark, build_id),
        )
    connection.commit()
    log(f"Activated build {build_id} with {coverage:.1%} canonical coverage")


def show_status(connection: Connection, args: argparse.Namespace) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select id::text, status, source_count, processed_source_count,
                   neighbor_count, source_watermark, started_at, completed_at,
                   activated_at, error_message
            from public.corpus_embedding_neighbor_builds
            where field_type = %s
            order by created_at desc
            limit 10
            """,
            (args.field_type,),
        )
        builds = cursor.fetchall()
        cursor.execute(
            """
            select watermark, active_build_id::text, last_started_at,
                   last_completed_at, last_changed_source_count, last_error
            from public.corpus_embedding_neighbor_sync_state
            where field_type = %s
            """,
            (args.field_type,),
        )
        sync = cursor.fetchone()
        cursor.execute(
            """
            with canonical as (
              select distinct on (corpus_id) corpus_id, updated_at
              from public.corpus_field_embeddings
              where field_type = %s
              order by corpus_id, updated_at desc, id desc
            )
            select count(*)::integer,
                   count(*) filter (
                     where updated_at > coalesce(
                       %s::timestamptz, '-infinity'::timestamptz
                     )
                   )::integer
            from canonical
            """,
            (args.field_type, sync[0] if sync else None),
        )
        canonical_count, changed_count = cursor.fetchone()

    print(f"field_type: {args.field_type}")
    print(f"canonical_sources: {canonical_count:,}")
    print(f"changed_after_watermark: {changed_count:,}")
    if sync:
        print(
            f"sync: active={sync[1]} watermark={sync[0]} "
            f"last_completed={sync[3]} last_changed={sync[4]} error={sync[5]}"
        )
    else:
        print("sync: not initialized")
    print("recent_builds:")
    for build in builds:
        print(
            f"  {build[0]} status={build[1]} "
            f"sources={build[3]:,}/{build[2]:,} neighbors={build[4]:,} "
            f"watermark={build[5]} error={build[9]}"
        )


def record_command_failure(
    connection: Connection, args: argparse.Namespace, error: Exception
) -> None:
    if args.command != "incremental":
        return
    try:
        connection.rollback()
        with connection.cursor() as cursor:
            cursor.execute(
                """
                update public.corpus_embedding_neighbor_sync_state
                set last_error = %s, updated_at = now()
                where field_type = %s
                """,
                (str(error)[:2000], args.field_type),
            )
        connection.commit()
    except Exception:
        connection.rollback()


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    subparsers = result.add_subparsers(dest="command", required=True)

    def common(command: argparse.ArgumentParser) -> None:
        command.add_argument("--field-type", default=DEFAULT_FIELD_TYPE)
        command.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
        command.add_argument("--limit", type=int)
        command.add_argument("--hnsw-m", type=int, default=DEFAULT_HNSW_M)
        command.add_argument("--ef-construction", type=int, default=DEFAULT_EF_CONSTRUCTION)
        command.add_argument("--ef-search", type=int, default=DEFAULT_EF_SEARCH)
        command.add_argument("--threads", type=int)

    full = subparsers.add_parser("full", help="Create an isolated full build")
    common(full)
    full.add_argument("--top-k", type=int, default=DEFAULT_TOP_K)
    full.add_argument("--model-name", default=os.getenv("CORPUS_EMBEDDING_MODEL", "qwen3-vl-embedding"))
    full.add_argument("--resume", metavar="BUILD_ID")

    incremental = subparsers.add_parser(
        "incremental", help="Update changed outgoing neighbors in the active build"
    )
    common(incremental)

    status = subparsers.add_parser("status", help="Show build and watermark state")
    status.add_argument("--field-type", default=DEFAULT_FIELD_TYPE)

    activation = subparsers.add_parser("activate", help="Atomically activate a ready build")
    activation.add_argument("--field-type", default=DEFAULT_FIELD_TYPE)
    activation.add_argument("--build-id")
    activation.add_argument("--allow-partial", action="store_true")
    return result


def validate_arguments(args: argparse.Namespace) -> None:
    for name in ("batch_size", "limit", "top_k", "hnsw_m", "ef_construction", "ef_search", "threads"):
        value = getattr(args, name, None)
        if value is not None and value <= 0:
            raise ValueError(f"--{name.replace('_', '-')} must be positive")


def main() -> None:
    load_environment()
    args = parser().parse_args()
    validate_arguments(args)
    connection = connect()
    locked = False
    try:
        require_tables(connection)
        if args.command != "status":
            acquire_builder_lock(connection)
            locked = True
        try:
            if args.command == "full":
                run_full(connection, args)
            elif args.command == "incremental":
                run_incremental(connection, args)
            elif args.command == "activate":
                activate(connection, args)
            else:
                show_status(connection, args)
        except Exception as error:
            record_command_failure(connection, args, error)
            raise
    finally:
        if locked:
            release_builder_lock(connection)
        connection.close()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Interrupted; active build was not changed")
        raise SystemExit(130)
    except Exception as error:
        log(f"ERROR: {error}")
        raise SystemExit(1)
