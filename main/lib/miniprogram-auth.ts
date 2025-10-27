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
