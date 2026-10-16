import type { NextRequest } from "next/server";
import { regionProbe } from "@/lib/assistant/region-probe";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return regionProbe(req);
}
