import { NextResponse } from "next/server";
import { AgentApiError } from "@/lib/services/agent";

export function handleAgentApiError(error: unknown, fallbackMessage = "Agent service request failed") {
  if (error instanceof AgentApiError) {
    if (error.payload && typeof error.payload === "object") {
      return NextResponse.json(error.payload as Record<string, unknown>, {
        status: error.status,
      });
    }

    return NextResponse.json(
      { error: String(error.payload ?? error.message) },
      { status: error.status }
    );
  }

  console.error("[Agent] Unexpected error", error);
  return NextResponse.json(
    { error: fallbackMessage },
    { status: 500 }
  );
}

