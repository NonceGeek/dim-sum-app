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
- **Authentication**: NextAuth.js with WeChat and Email providers
- **UI**: Radix UI components with Tailwind CSS
- **State Management**: Zustand stores
- **Query Management**: TanStack Query

### Authentication System
- Supports WeChat OAuth and email-based authentication
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
- `/api/auth/` - NextAuth.js authentication endpoints
- `/api/marker/` - Marker-specific operations (role-protected)
- `/api/public/` - Public API endpoints
- `/api/user/` - User management operations

### Important Files
- `lib/auth.ts` - NextAuth configuration with WeChat/email providers
- `middleware.ts` - Route protection and role-based access control
- `prisma/schema.prisma` - Database schema with multilingual corpus data
- `lib/store/` - Zustand state management stores

## Environment Setup

This project requires PostgreSQL database connection and WeChat OAuth credentials for full functionality.