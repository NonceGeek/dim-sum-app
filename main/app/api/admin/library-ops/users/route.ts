import { NextRequest, NextResponse } from "next/server";
import { GLOBAL_ACTIONS, GlobalAction } from "@/lib/collection-permissions";
import { AccessError } from "@/lib/services/submission-access";
import {
  PRIVATE_HEADERS,
  requireCapability,
  usersWithCapability,
  withLibraryOps,
} from "@/lib/library/ops-access";

/** Candidates for handler / assignee pickers. */
export async function GET(req: NextRequest) {
  return withLibraryOps(req, async (access) => {
    requireCapability(access, "contribution_review");
    const capability = new URL(req.url).searchParams.get("capability");
    if (!GLOBAL_ACTIONS.includes(capability as GlobalAction))
      throw new AccessError(400, "无效的权限类型");
    const users = await usersWithCapability(capability as GlobalAction);
    return NextResponse.json(
      { users: users.map((u) => ({ id: u.id, name: u.name || u.email || u.id })) },
      { headers: PRIVATE_HEADERS },
    );
  });
}
