import { NextRequest, NextResponse } from "next/server";
import { PRIVATE_HEADERS, withLibraryOps } from "@/lib/library/ops-access";
import { createTask, getTaskDetail, listTasks } from "@/lib/ingestion/service";

/** GET /api/admin/ingestion-tasks?assignee=me|all&status=&q=&dataset=&page=&pageSize= */
export async function GET(req: NextRequest) {
  return withLibraryOps(req, async (access) =>
    NextResponse.json(await listTasks(access, new URL(req.url).searchParams), {
      headers: PRIVATE_HEADERS,
    }),
  );
}

/**
 * POST /api/admin/ingestion-tasks {targetIngestionType, targetDatasetName, modalities, sourceCollectionMethod,
 * title?, description?, leadId?}：建草稿，创建人即负责人
 */
export async function POST(req: NextRequest) {
  return withLibraryOps(req, async (access) => {
    const task = await createTask(access, await req.json().catch(() => ({})));
    return NextResponse.json(await getTaskDetail(access, task.id), {
      status: 201,
      headers: PRIVATE_HEADERS,
    });
  });
}
