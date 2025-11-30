import { NextRequest, NextResponse } from "next/server";
import { verifyMiniprogramToken, MiniprogramTokenPayload } from "./miniprogram-jwt";
import { Role } from "@prisma/client";

/**
 * Extract token from Authorization header
 * Supports formats: "Bearer <token>" or just "<token>"
 */
function extractToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  // Handle "Bearer <token>" format
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Handle direct token
  return authHeader;
}

/**
 * Miniprogram authentication middleware
 * Verifies JWT token and passes user info to handler
 */
export async function requireMiniprogramAuth(
  req: NextRequest,
  handler: (req: NextRequest, user: MiniprogramTokenPayload) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const token = extractToken(req);

    if (!token) {
      return NextResponse.json(
        { error: "Missing authentication token" },
        { status: 401 }
      );
    }

    const user = await verifyMiniprogramToken(token);

    return handler(req, user);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }
}

/**
 * Miniprogram authentication with role check
 * Requires specific roles to access
 */
export async function requireMiniprogramRole(
  req: NextRequest,
  allowedRoles: Role[],
  handler: (req: NextRequest, user: MiniprogramTokenPayload) => Promise<NextResponse>
): Promise<NextResponse> {
  return requireMiniprogramAuth(req, async (req, user) => {
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    return handler(req, user);
  });
}

/**
 * Miniprogram marker authentication
 * Only allows TAGGER_PARTNER and TAGGER_OUTSOURCING roles
 */
export async function requireMiniprogramMarker(
  req: NextRequest,
  handler: (req: NextRequest, user: MiniprogramTokenPayload) => Promise<NextResponse>
): Promise<NextResponse> {
  if (process.env.SKIP_MINIPROGRAM_AUTH === "true") {
    const debugUser: MiniprogramTokenPayload = {
      userId: process.env.MINIPROGRAM_DEBUG_USER_ID ?? "local-debug-user",
      openId: process.env.MINIPROGRAM_DEBUG_OPEN_ID ?? "local-debug-openId",
      unionId: process.env.MINIPROGRAM_DEBUG_UNION_ID,
      role: (process.env.MINIPROGRAM_DEBUG_ROLE as Role) ?? Role.TAGGER_PARTNER,
      isSystemAdmin: process.env.MINIPROGRAM_DEBUG_IS_ADMIN === "true",
    };

    return handler(req, debugUser);
  }

  return requireMiniprogramRole(
    req,
    [Role.TAGGER_PARTNER, Role.TAGGER_OUTSOURCING],
    handler
  );
}

/**
 * Miniprogram admin authentication
 * Only allows system admins
 */
export async function requireMiniprogramAdmin(
  req: NextRequest,
  handler: (req: NextRequest, user: MiniprogramTokenPayload) => Promise<NextResponse>
): Promise<NextResponse> {
  return requireMiniprogramAuth(req, async (req, user) => {
    if (!user.isSystemAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    return handler(req, user);
  });
}
