---
phase: "03"
plan: "02"
subsystem: "admin-auth"
tags: [admin, jwt, passport, bcrypt, refresh-tokens]
dependency_graph:
  requires: ["03-01 (AdminModule scaffold, Prisma Admin models)"]
  provides: ["AdminJwtService", "AdminRefreshTokenService", "AdminAuthService", "AdminJwtStrategy", "AdminJwtAuthGuard"]
  affects: ["03-03 (AdminController endpoints will import these services)"]
tech_stack:
  added: []
  patterns: ["PassportStrategy with named strategy 'admin-jwt'", "bcrypt password verification (no Firebase)", "JWT refresh token rotation", "Prisma adminRefreshToken model"]
key_files:
  created:
    - src/admin/admin-jwt.service.ts
    - src/admin/admin-refresh-token.service.ts
    - src/admin/admin-auth.service.ts
    - src/admin/admin-jwt.strategy.ts
    - src/admin/admin-jwt-auth.guard.ts
    - src/admin/dto/admin-auth.dto.ts
  modified: []
decisions:
  - "PassportStrategy uses 'admin-jwt' as second argument to avoid overwriting user 'jwt' strategy"
  - "AdminJwtPayload includes type:'admin' field — strategy validates this to reject user tokens"
  - "AdminRefreshToken uses tokenType:'refresh' field (not type:'refresh') to avoid conflict with AdminJwtPayload.type field"
  - "AdminAuthService has no Firebase dependency — admins authenticate via bcrypt against password_hash in DB"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-01"
  tasks_completed: 1
  files_created: 6
  files_modified: 0
---

# Phase 3 Plan 02: AdminModule Core Services, Guard, and Strategy Summary

AdminJwtService (JWT_ADMIN_SECRET), AdminRefreshTokenService (prisma.adminRefreshToken), AdminAuthService (bcrypt login + token rotation), AdminJwtStrategy (named 'admin-jwt'), and AdminJwtAuthGuard — fully isolated from user auth.

## What Was Built

Six files in `src/admin/` implementing the complete authentication layer for the AdminModule, fully isolated from `src/auth/` (user auth):

1. **`admin-jwt.service.ts`** — Generates and verifies admin access/refresh tokens using `JWT_ADMIN_SECRET` and `JWT_ADMIN_REFRESH_SECRET`. Payload includes `type:'admin'` to distinguish from user tokens.

2. **`admin-refresh-token.service.ts`** — Mirrors `RefreshTokenService` but operates exclusively on `prisma.adminRefreshToken`. All `userId` references replaced with `adminId`. Supports create, validate, revoke, rotate, and cleanup operations.

3. **`admin-auth.service.ts`** — Login finds admin by email, uses `bcrypt.compare` against `password_hash` (no Firebase). Refresh validates token then rotates (revoke old, issue new). Logout revokes token gracefully.

4. **`admin-jwt.strategy.ts`** — `PassportStrategy(Strategy, 'admin-jwt')` with the named strategy argument, reads `JWT_ADMIN_SECRET`. Validates `payload.type === 'admin'` before DB lookup, preventing user tokens from authenticating admin endpoints.

5. **`admin-jwt-auth.guard.ts`** — `AuthGuard('admin-jwt')` — one line, uses the named strategy.

6. **`dto/admin-auth.dto.ts`** — `AdminLoginDto`, `AdminRefreshTokenRequestDto`, `AdminLogoutDto`, and response interfaces `AdminData`, `AdminAuthResponseDto`, `AdminRefreshTokenResponseDto`, `AdminLogoutResponseDto`.

## Decisions Made

- **Named strategy `'admin-jwt'`** — The second argument to `PassportStrategy(Strategy, 'admin-jwt')` is critical. Without it, Passport would register under the default `'jwt'` name, overwriting the user strategy.
- **`type:'admin'` in JWT payload** — The strategy validates this field explicitly so that a valid user access token cannot be used on admin-protected endpoints.
- **`tokenType:'refresh'` field** — AdminRefreshTokenPayload extends AdminJwtPayload (which already has `type:'admin'`). A separate `tokenType:'refresh'` field avoids field name collision.
- **No Firebase** — Admin password is stored as `bcrypt` hash in `Admin.password_hash`. Login uses `bcrypt.compare` directly. This was an explicit requirement from the plan instructions.

## Deviations from Plan

None — plan executed exactly as written. ESLint and Prettier pre-commit hooks auto-formatted whitespace (multi-line object expressions), no logic changes.

## Self-Check

Files exist:
- `src/admin/admin-jwt.service.ts` — FOUND
- `src/admin/admin-refresh-token.service.ts` — FOUND
- `src/admin/admin-auth.service.ts` — FOUND
- `src/admin/admin-jwt.strategy.ts` — FOUND
- `src/admin/admin-jwt-auth.guard.ts` — FOUND
- `src/admin/dto/admin-auth.dto.ts` — FOUND

TypeScript: `npx tsc --noEmit` — PASSED (zero errors)

Commit: `1feb686b` — FOUND

## Self-Check: PASSED
