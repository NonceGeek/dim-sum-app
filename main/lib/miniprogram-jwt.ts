import { SignJWT, jwtVerify } from 'jose';
import { Role } from '@prisma/client';

// JWT token payload interface
export interface MiniprogramTokenPayload {
  userId: string;
  openId: string;
  unionId?: string;
  role: Role;
  isSystemAdmin: boolean;
  [key: string]: unknown; // 添加索引签名以兼容 JWTPayload
}

// Get JWT secret from environment
const getJWTSecret = () => {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not defined');
  }
  return new TextEncoder().encode(secret);
};

/**
 * Generate JWT token for miniprogram
 * @param payload User information to include in token
 * @param expiresIn Token expiration time (default: 7 days)
 * @returns JWT token string
 */
export async function generateMiniprogramToken(
  payload: MiniprogramTokenPayload,
  expiresIn: string = '7d'
): Promise<string> {
  const secret = getJWTSecret();

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setIssuer('dimsum-miniprogram')
    .sign(secret);

  return token;
}

/**
 * Verify and decode miniprogram JWT token
 * @param token JWT token string
 * @returns Decoded token payload
 * @throws Error if token is invalid or expired
 */
export async function verifyMiniprogramToken(
  token: string
): Promise<MiniprogramTokenPayload> {
  const secret = getJWTSecret();

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'dimsum-miniprogram',
    });

    return payload as unknown as MiniprogramTokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Generate refresh token (longer expiration time)
 * @param payload User information to include in token
 * @returns Refresh token string
 */
export async function generateRefreshToken(
  payload: MiniprogramTokenPayload
): Promise<string> {
  return generateMiniprogramToken(payload, '30d');
}
