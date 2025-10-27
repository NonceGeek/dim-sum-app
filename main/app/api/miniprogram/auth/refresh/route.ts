import { NextRequest, NextResponse } from "next/server";
import { verifyMiniprogramToken, generateMiniprogramToken, generateRefreshToken } from "@/lib/miniprogram-jwt";

/**
 * Refresh access token endpoint
 * POST /api/miniprogram/auth/refresh
 *
 * Request body:
 * - refreshToken: The refresh token received during login
 *
 * Response:
 * - accessToken: New JWT token for API access (7 days)
 * - refreshToken: New refresh token (30 days)
 */
export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Missing refresh token" },
        { status: 400 }
      );
    }

    // Verify the refresh token
    let payload;
    try {
      payload = await verifyMiniprogramToken(refreshToken);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid or expired refresh token" },
        { status: 401 }
      );
    }

    // Generate new tokens with the same payload
    const newAccessToken = await generateMiniprogramToken(payload);
    const newRefreshToken = await generateRefreshToken(payload);

    return NextResponse.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
