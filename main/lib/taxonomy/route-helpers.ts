import { NextRequest, NextResponse } from "next/server";
import { AppError } from "../app-error";
import { databaseErrorResponse } from "../prisma-errors";

export async function readJsonBody(req: NextRequest): Promise<unknown> {
  try { return await req.json(); }
  catch { throw new AppError(400, "Invalid JSON"); }
}

// Respond inside the auth callback: it returns the handler's promise without
// awaiting it, so its catch never sees handler errors (they would surface as
// unformatted 500s from Next).
export function categoryTagErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Miniprogram category/tag request failed", error);
  return databaseErrorResponse(error, "Internal server error");
}
