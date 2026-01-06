# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

The main application is in the `main/` directory. Always `cd` into `main/` before running commands:

```bash
cd main/
```

### Core Commands

- `npm run dev` - Start development server
- `npm run build` - Build production application (includes Prisma generation)
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality

### Database Commands

- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio for database management
- `npm run db:push` - Push schema changes to database
- `npm run db:pull` - Pull schema from database

## Architecture Overview

This is a Next.js 15 application for a Cantonese language learning platform with data annotation capabilities.

### Key Technologies

- **Framework**: Next.js 15 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with WeChat, Email, and SMS providers
- **UI**: Radix UI components with Tailwind CSS
- **State Management**: Zustand stores
- **Query Management**: TanStack Query

### Authentication System

- **Web**: NextAuth.js with WeChat OAuth, email-based, and SMS-based authentication
- **Miniprogram**: JWT-based authentication using WeChat openId/unionId
- Role-based access control with 4 user roles: `LEARNER`, `TAGGER_PARTNER`, `TAGGER_OUTSOURCING`, `RESEARCHER`
- Middleware protects routes based on user roles
- Marker-specific routes require `TAGGER_PARTNER` or `TAGGER_OUTSOURCING` roles

### Database Schema

- **Users**: Core user information with role-based permissions
- **Corpus Data**: Cantonese language corpus with annotations (`cantonese_corpus_all`)
- **Data Annotation**: Update history tracking for corpus modifications
- **Categories & Apps**: Content organization and application management
- **API Keys**: User API access management

### Key Directories

- `app/` - Next.js App Router pages and API routes
- `components/` - Reusable UI components organized by type
- `lib/` - Utilities, API clients, auth configuration, and stores
- `prisma/` - Database schema and migrations
- `providers/` - Authentication and query providers

### API Structure

- `/api/auth/` - NextAuth.js authentication endpoints (Web)
- `/api/miniprogram/` - WeChat miniprogram API endpoints (JWT-protected)
  - `/api/miniprogram/auth/login` - Miniprogram login with WeChat code
  - `/api/miniprogram/auth/refresh` - Refresh access token
  - `/api/miniprogram/user/*` - User-related operations
- `/api/marker/` - Marker-specific operations (role-protected)
- `/api/public/` - Public API endpoints
- `/api/user/` - User management operations

### Important Files

- `lib/auth.ts` - NextAuth configuration with WeChat/Email/SMS providers (Web)
- `lib/services/aliyun-sms.ts` - Aliyun SMS service for phone verification
- `lib/miniprogram-jwt.ts` - JWT token generation and verification for miniprogram
- `lib/miniprogram-auth.ts` - Miniprogram authentication middleware
- `middleware.ts` - Route protection and role-based access control
- `prisma/schema.prisma` - Database schema with multilingual corpus data
- `lib/store/` - Zustand state management stores

## Environment Setup

This project requires PostgreSQL database connection and WeChat OAuth credentials for full functionality.

### Required Environment Variables

```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# NextAuth (Web)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"  # Used for both web and miniprogram JWT

# WeChat Web OAuth
NEXT_PUBLIC_WECHAT_CLIENT_ID="your-wechat-web-appid"
WECHAT_CLIENT_SECRET="your-wechat-web-secret"

# WeChat Miniprogram
WECHAT_MINIPROGRAM_APPID="your-miniprogram-appid"
WECHAT_MINIPROGRAM_SECRET="your-miniprogram-secret"
```

## Miniprogram Authentication Flow

### 1. Miniprogram Login

The miniprogram uses WeChat's `wx.login()` to get a code, then exchanges it for access tokens.

**Endpoint**: `POST /api/miniprogram/auth/login`

**Request**:

```json
{
  "code": "wx_login_code_from_wx.login()"
}
```

**Response**:

```json
{
  "accessToken": "jwt_access_token",
  "refreshToken": "jwt_refresh_token",
  "user": {
    "id": "user_id",
    "name": "User Name",
    "avatar": "avatar_url",
    "role": "LEARNER",
    "isSystemAdmin": false
  }
}
```

**Note**: Users must register via web first. The miniprogram login will fail if the user doesn't exist in the database.

### 2. Token Refresh

Access tokens expire after 7 days. Use the refresh token to get a new access token.

**Endpoint**: `POST /api/miniprogram/auth/refresh`

**Request**:

```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response**:

```json
{
  "accessToken": "new_jwt_access_token",
  "refreshToken": "new_jwt_refresh_token"
}
```

### 3. Making Authenticated Requests

Include the access token in the Authorization header:

```
Authorization: Bearer <accessToken>
```

**Example**: `GET /api/miniprogram/user/profile`

### 4. Creating Protected Miniprogram APIs

Use the authentication middleware from `lib/miniprogram-auth.ts`:

```typescript
import { requireMiniprogramAuth } from "@/lib/miniprogram-auth";

export async function GET(req: NextRequest) {
  return requireMiniprogramAuth(req, async (req, user) => {
    // user contains: userId, openId, unionId, role, isSystemAdmin
    // Your logic here
    return NextResponse.json({ data: "your data" });
  });
}
```

**Available middleware**:

- `requireMiniprogramAuth` - Basic authentication
- `requireMiniprogramRole` - Require specific roles
- `requireMiniprogramMarker` - Require TAGGER_PARTNER or TAGGER_OUTSOURCING
- `requireMiniprogramAdmin` - Require system admin
