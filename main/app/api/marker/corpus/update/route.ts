import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { CorpusEditAccessError, EDITOR_CACHE_HEADERS, getCorpusItemForEditing } from "@/lib/services/corpus-edit-access";
import { backendFetch } from "@/lib/api/backend";

export async function POST(req: NextRequest) {
  try {
    // 检查用户是否登录
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => null);
    const { uuid, note } = body ?? {};

    if (typeof uuid !== "string" || !note || typeof note !== "object" || Array.isArray(note)) {
      return NextResponse.json(
        { error: "UUID and note are required" },
        { status: 400 },
      );
    }

    await getCorpusItemForEditing(session.user.id, uuid);

    // Get API key from server environment (not exposed to frontend)
    const apiKey = process.env.BACKEND_API_KEY;
    if (!apiKey) {
      console.error("BACKEND_API_KEY not found in environment variables");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    // Make request to backend with server-side API key
    const response = await backendFetch(
      "/dev/update_corpus_item",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uuid,
          note,
          api_key: apiKey,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      let errorMessage = "API request failed";

      if (errorData && errorData.error) {
        switch (errorData.error) {
          case "Invalid API key":
            errorMessage = "Invalid API Key";
            break;
          case "API key not approved":
            errorMessage = "API Key Not Approved";
            break;
          case "Corpus item not found":
            errorMessage = "Corpus Item Not Found";
            break;
          default:
            errorMessage = errorData.error;
            break;
        }
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status },
      );
    }

    const result = await response.json();
    return NextResponse.json(result, { headers: EDITOR_CACHE_HEADERS });
  } catch (error) {
    if (error instanceof CorpusEditAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: EDITOR_CACHE_HEADERS });
    }
    console.error("Error updating corpus item:", error);
    return NextResponse.json(
      { error: "Failed to update corpus item" },
      { status: 500 },
    );
  }
}
