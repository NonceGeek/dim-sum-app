import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { StoreError } from "./service";
export const PRIVATE = { "Cache-Control": "private, no-store" };
export function storeFailure(e: unknown) {
  const status =
    e instanceof StoreError
      ? e.status
      : e instanceof ZodError || e instanceof SyntaxError
        ? 400
        : 503;
  if (status === 503)
    console.error(
      "App Store request failed",
      e instanceof Error ? e.name : "unknown",
    );
  return NextResponse.json(
    {
      error:
        status === 503
          ? "App Store is temporarily unavailable or awaiting rollout"
          : e instanceof Error
            ? e.message
            : "Invalid request",
    },
    { status, headers: PRIVATE },
  );
}
