---
phase: "03"
plan: "03"
subsystem: "admin-auth"
tags: [admin, controller, nestjs, cookies, passport, jwt]
dependency_graph:
  requires: ["03-02 (AdminAuthService, AdminJwtService, AdminRefreshTokenService, AdminJwtStrategy, AdminJwtAuthGuard)"]
  provides: ["POST /admin/auth/login", "POST /admin/auth/refresh", "POST /admin/auth/logout", "AdminModule", "AdminModule registered in AppModule"]
  affects: ["AppModule (imports AdminModule)"]
tech_stack:
  added: []
  patterns: ["httpOnly admin_refresh_token cookie (separate from user refresh_token)", "PassportModule.register with defaultStrategy admin-jwt", "clearCookie options matching cookie() options exactly"]
key_files:
  created:
    - src/admin/admin-auth.controller.ts
    - src/admin/admin.module.ts
  modified:
    - src/app.module.ts
decisions:
  - "Cookie name is 'admin_refresh_token' — distinct from user 'refresh_token' to prevent cross-contamination"
  - "clearCookie options (httpOnly, secure, sameSite, path) mirror cookie() call exactly — required for correct browser clearing"
  - "POST /admin/auth/refresh has no guard — access token is intentionally expired when refresh is called"
  - "POST /admin/auth/logout is guarded by AdminJwtAuthGuard — requires valid access token"
  - "AdminModule uses PassportModule.register({ defaultStrategy: 'admin-jwt' }) for clean isolation"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-01"
  tasks_completed: 4
  files_created: 2
  files_modified: 1
---

# Phase 3 Plan 03: AdminAuthController, AdminModule Registration, and Verification Summary

AdminAuthController with httpOnly admin_refresh_token cookie, AdminModule wiring all admin services/strategy/guard, and AppModule updated to import AdminModule — all verified with live curl/node tests.

## Tasks Completed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Create src/admin/admin-auth.controller.ts | Done | cf89953d |
| 2 | Create src/admin/admin.module.ts | Done | cf89953d |
| 3 | Update src/app.module.ts to import AdminModule | Done | cf89953d |
| 4 | Verify: build + live endpoint tests | Done | cf89953d |

## What Was Built

### `admin-auth.controller.ts`

Three endpoints under `@Controller('admin/auth')`:

- **POST /admin/auth/login** — Validates credentials via `AdminAuthService.login()`, sets `admin_refresh_token` httpOnly cookie, returns `access_token` + `admin` data (no refresh_token in body).
- **POST /admin/auth/refresh** — No guard. Reads `admin_refresh_token` from cookie, calls `AdminAuthService.refreshToken()`, rotates cookie, returns new `access_token`.
- **POST /admin/auth/logout** — Protected by `@UseGuards(AdminJwtAuthGuard)`. Reads cookie, calls `AdminAuthService.logout()`, clears cookie.

Cookie helper methods:
- `setAdminRefreshTokenCookie()` — sets `admin_refresh_token` with httpOnly, secure (prod), sameSite strict/none, path `/`
- `clearAdminRefreshTokenCookie()` — identical options to cookie() call (required for browser to honor the clear)

### `admin.module.ts`

Registers:
- `PassportModule.register({ defaultStrategy: 'admin-jwt' })`
- Controllers: `AdminAuthController`
- Providers: `AdminAuthService`, `AdminJwtService`, `AdminRefreshTokenService`, `AdminJwtStrategy`, `PrismaService`

### `app.module.ts`

Added `AdminModule` to the imports array alongside `AuthModule` and `EventsModule`.

## Verification Results

| Test | Expected | Result |
|------|----------|--------|
| POST /admin/auth/login (correct creds) | 200 + access_token + admin + admin_refresh_token cookie | PASS |
| POST /admin/auth/login (wrong password) | 401 Unauthorized | PASS |
| POST /admin/auth/refresh (with cookie) | 200 + new access_token + rotated cookie | PASS |
| POST /admin/auth/logout (with Bearer token) | 200 + cookie cleared | PASS |
| Existing /auth/login (user auth) | Still responds (no regression) | PASS |
| npm run build | Zero errors | PASS |

## Decisions Made

- **Cookie name `admin_refresh_token`** — Intentionally distinct from the user cookie `refresh_token`. Prevents cross-contamination if both auth flows are active in the same browser session.
- **No guard on /admin/auth/refresh** — The access token is expired by definition when the client calls this endpoint; attaching `AdminJwtAuthGuard` would always reject the request.
- **`clearCookie` options match `cookie()` options** — Browser cookie clearing requires the same path, domain, and security attributes used when the cookie was set. Mismatched options silently fail to clear.
- **`PassportModule.register({ defaultStrategy: 'admin-jwt' })`** — Isolates admin passport context from user passport context.

## Deviations from Plan

None — plan executed exactly as written. Prettier pre-commit hook reformatted the return type annotation for `login()` to a multi-line format; no logic changes.

## Known Stubs

None.

## Self-Check: PASSED

Files created/modified:
- src/admin/admin-auth.controller.ts — FOUND
- src/admin/admin.module.ts — FOUND
- src/app.module.ts — FOUND (imports AdminModule)

Commits:
- cf89953d — FOUND
