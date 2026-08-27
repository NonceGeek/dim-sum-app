import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export function isPrismaConnectionPoolTimeout(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2024"
  );
}

export function isPrismaTransientDatabaseError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2024" || error.code === "P2028") return true;

  return (
    error.code === "P2010" &&
    typeof error.meta?.code === "string" &&
    error.meta.code === "57014"
  );
}

export function databaseErrorResponse(error: unknown, fallbackMessage: string) {
  if (isPrismaTransientDatabaseError(error)) {
    return NextResponse.json(
      {
        error: "Database temporarily busy",
        code: "DATABASE_BUSY",
        retryable: true,
      },
      {
        status: 503,
        headers: { "Retry-After": "1" },
      },
    );
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
