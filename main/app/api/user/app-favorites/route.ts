import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { favoriteApplications, setFavorite } from "@/lib/app-store/service";
import { storeFailure, PRIVATE } from "@/lib/app-store/http";
export async function GET(req: NextRequest) {
  return requireAuth(req, async (_req, user) => {
    try {
      return NextResponse.json(
        { favorites: await favoriteApplications(user) },
        { headers: PRIVATE },
      );
    } catch (e) {
      return storeFailure(e);
    }
  });
}
const schema = z.object({ appId: z.string(), saved: z.boolean() });
export async function PUT(req: NextRequest) {
  return requireAuth(req, async (_req, user) => {
    try {
      const body = schema.parse(await req.json());
      await setFavorite(user, body.appId, body.saved);
      return NextResponse.json({ saved: body.saved }, { headers: PRIVATE });
    } catch (e) {
      return storeFailure(e);
    }
  });
}
