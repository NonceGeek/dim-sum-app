import { NextRequest, NextResponse } from "next/server";
import { databaseErrorResponse } from "./prisma-errors";

/** Expected server-side failure whose status and message can be returned to the caller. */
export class AppError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "AppError";
  }
}

export async function readJsonBody(req: NextRequest): Promise<unknown> {
  try { return await req.json(); }
  catch { throw new AppError(400, "Invalid JSON"); }
}

/** Map AppError to its status; log anything else and return 503 (transient DB) or 500. */
export function appErrorResponse(error: unknown, logContext: string) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(logContext, error);
  return databaseErrorResponse(error, "Internal server error");
}
