import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { fetchAgentTasks } from "@/lib/services/agent";
import { handleAgentApiError } from "@/lib/services/agent-error";
import { Role } from "@prisma/client";

function parseNumber(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(req: NextRequest) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const { role, isSystemAdmin } = session.user;
  if (
    !isSystemAdmin &&
    role !== Role.RESEARCHER &&
    role !== Role.TAGGER_PARTNER &&
    role !== Role.TAGGER_OUTSOURCING
  ) {
    return NextResponse.json(
      { error: "Permission denied" },
      { status: 403 }
    );
  }

  const searchParams = new URL(req.url).searchParams;
  const status = searchParams.get("status") || undefined;
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = parseNumber(searchParams.get("pageSize"), 10);
  const assigneeRef = searchParams.get("assigneeRef") || undefined;
  const corpusName = searchParams.get("corpusName") || undefined;
  const violationType = searchParams.get("violationType") || undefined;
  const q = searchParams.get("q") || undefined;

  try {
    const data = await fetchAgentTasks({
      actorRef: session.user.id,
      assigneeRef,
      status,
      page,
      pageSize,
      corpusName,
      violationType,
      q,
    });

    return NextResponse.json(data);
  } catch (error) {
    return handleAgentApiError(error, "Failed to load tasks");
  }
}
