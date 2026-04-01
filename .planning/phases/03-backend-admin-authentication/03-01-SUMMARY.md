---
phase: 03
plan: 01
subsystem: database
tags: [prisma, schema, admin, seed, postgresql]
dependency_graph:
  requires: []
  provides: [Admin model, AdminRefreshToken model, seeded admin user]
  affects: [prisma schema, database]
tech_stack:
  added: [bcryptjs password hashing in seed]
  patterns: [cuid ids, upsert idempotent seeds, token hash indexes]
key_files:
  created: []
  modified:
    - prisma/schema.prisma
    - prisma/seed.ts
    - .env
decisions:
  - Used db push instead of migrate dev to avoid migration history divergence
  - Admin password hashed with bcryptjs salt rounds 10 at seed time
  - Seed reads ADMIN_EMAIL/ADMIN_PASSWORD from env with fallback defaults
metrics:
  duration: ~5 minutes
  completed: 2026-04-01
---

# Phase 3 Plan 01: Schema, Migration & Seed for Admin Authentication Summary

Added Admin and AdminRefreshToken Prisma models, pushed schema to PostgreSQL, and seeded a default admin user with a bcryptjs-hashed password.

## Tasks Completed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Add Admin model to schema.prisma | Done | 995af14c |
| 2 | Add AdminRefreshToken model to schema.prisma | Done | 995af14c |
| 3 | Run npx prisma db push | Done | 995af14c |
| 4 | Extend seed.ts with admin upsert | Done | 995af14c |
| 5 | Run npx prisma db seed | Done | 995af14c |
| 6 | Add admin env vars to .env | Done | (not committed — .env gitignored) |

## Decisions Made

- **db push over migrate dev:** Migration history may be diverged in the development environment; `db push` applies schema changes directly and regenerates Prisma Client without requiring a clean migration history.
- **bcryptjs salt rounds 10:** Consistent with the existing user auth implementation elsewhere in the codebase.
- **Env var fallbacks in seed:** `ADMIN_EMAIL` and `ADMIN_PASSWORD` fall back to defaults so the seed works without explicit env configuration in fresh environments.
- **update: {} in upsert:** Admin seed is stable — re-runs do not overwrite a changed password (idempotent, non-destructive).

## Models Added

### Admin
- `id` — cuid, primary key
- `email` — unique, indexed
- `password_hash` — bcrypt hash stored, never plaintext
- `name` — display name
- `createdAt`, `updatedAt` — timestamps
- Relation: `refreshTokens AdminRefreshToken[]`

### AdminRefreshToken
- `id` — cuid, primary key
- `adminId` — FK to Admin with CASCADE delete
- `tokenHash` — unique, indexed (hashed token, never plaintext)
- `userAgent?`, `ipAddress?` — optional security metadata
- `createdAt`, `updatedAt`, `expiresAt` — timestamps with expiresAt indexed
- `isActive` — soft revocation flag, indexed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- prisma/schema.prisma — FOUND and contains Admin + AdminRefreshToken models
- prisma/seed.ts — FOUND with admin upsert using bcryptjs
- .env — FOUND with ADMIN_EMAIL, ADMIN_PASSWORD, JWT_ADMIN_SECRET, JWT_ADMIN_REFRESH_SECRET
- Commit 995af14c — FOUND
- Database admin record verified: admin@projectalfa.com (Project Alfa Admin)
