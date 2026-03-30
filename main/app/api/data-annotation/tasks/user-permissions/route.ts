import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getUserCorpusList } from "@/lib/permission";

export async function GET(_req: NextRequest) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const corpora = await getUserCorpusList(session.user.id);
  const writeCorpora = corpora
    .filter((c) => c.permission === "WRITE" || c.permission === "FULL")
    .map((c) => c.category_name);

  return NextResponse.json({
    role: session.user.role ?? null,
    isSystemAdmin: session.user.isSystemAdmin ?? false,
    writeCorpora,
  });
}
