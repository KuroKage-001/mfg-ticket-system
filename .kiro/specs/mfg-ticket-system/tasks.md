# Implementation Plan: Manufacturing Ticket System

## Overview

This plan converts the MFG Ticket System design into incremental coding tasks. The server (Next.js 14+ App Router, TypeScript, Prisma + MySQL, iron-session) is built first as the complete API backend, followed by property-based tests for all correctness properties, then the React + Vite client (TypeScript, react-router-dom v7, TailwindCSS). Each task builds directly on the previous ones and ends with all code wired together.

---

## Tasks

- [x] 1. Project setup and configuration
  - [x] 1.1 Configure Prisma schema and database connection
    - Create `server/prisma/schema.prisma` with all models: `User`, `Ticket`, `TicketComment`, `TicketActivity`, plus all enums (`Role`, `Priority`, `Status`)
    - Create `server/.env` (or verify it exists) with `DATABASE_URL=mysql://root:@localhost:3306/db_mfg_ticket_system` and `SESSION_SECRET` (≥32 chars)
    - Run `npx prisma migrate dev --name init` to create the database and apply the initial migration
    - Run `npx prisma generate` to emit the Prisma Client
    - _Requirements: 2.2, 3.1, 14.1, 15.1_

  - [x] 1.2 Install server-side dependencies
    - Install runtime deps: `iron-session`, `bcryptjs`, `@prisma/client`
    - Install dev deps: `prisma`, `@types/bcryptjs`, `vitest`, `@vitest/coverage-v8`, `fast-check`
    - Add `"test": "vitest --run"` and `"test:watch": "vitest"` scripts to `server/package.json`
    - _Requirements: 1.1, 14.1_

  - [x] 1.3 Create shared TypeScript types
    - Create `server/src/types/user.types.ts` — `CreateUserDto`, `UpdateUserDto`, `UserListQuery`, `SafeUser`
    - Create `server/src/types/ticket.types.ts` — `CreateTicketDto`, `UpdateTicketDto`, `TicketListQuery`, `TicketSummary`, `TicketDetail`, `VALID_CATEGORIES`, `TicketCategory`
    - Create `server/src/types/pagination.types.ts` — `PaginatedResult<T>`
    - Create `server/src/types/session.types.ts` — `SessionUser`, `SessionData`
    - _Requirements: 2.2, 3.1, 4.8_

  - [x] 1.4 Configure Next.js CORS and server settings
    - Update `server/next.config.ts` to set `CORS` headers allowing `http://localhost:5173` with `credentials: true`
    - Ensure `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers` are set correctly
    - _Requirements: (architecture — cross-origin session cookie)_

- [x] 2. Server-side infrastructure
  - [x] 2.1 Implement iron-session configuration and Prisma singleton
    - Create `server/src/lib/session.ts` — export `sessionOptions: SessionOptions` with `cookieName: "mfg_session"`, `password: process.env.SESSION_SECRET!`, `httpOnly: true`, `sameSite: "lax"`, `secure` based on `NODE_ENV`, `maxAge: 86400`
    - Create `server/src/lib/prisma.ts` — singleton Prisma Client using global variable pattern to avoid connection exhaustion in Next.js dev mode
    - _Requirements: 1.1, 1.4, 1.10, 13.3_

  - [x] 2.2 Implement `ApiError`, `handleApiError`, and `stripPasswordHash` utilities
    - Create `server/src/utils/api-error.ts` — `class ApiError extends Error { constructor(statusCode, message, field?) }`
    - Create `server/src/utils/handle-api-error.ts` — `handleApiError(err)` maps `ApiError` → JSON response, handles `PrismaClientKnownRequestError` P2002 as 409, falls back to 500
    - Create `server/src/utils/strip-password.ts` — `stripPasswordHash<T extends { passwordHash?: unknown }>(user: T)` returns object with `passwordHash` omitted
    - _Requirements: 1.6, 14.2, 2.3_

  - [x] 2.3 Implement `authGuard` and `roleGuard` helpers
    - Create `server/src/middleware/auth-guard.ts` — `authGuard(req: NextRequest): Promise<SessionUser>` resolves session via `getIronSession`; throws `ApiError(401)` if absent; re-queries DB for `isActive` and throws `ApiError(401)` if false
    - Create `server/src/middleware/role-guard.ts` — `requireRole(user: SessionUser, ...roles: Role[]): void` throws `ApiError(403)` if `user.role` not in `roles`
    - _Requirements: 1.5, 13.1, 13.2, 13.3, 13.4_

  - [x] 2.4 Implement status-transition pure utility
    - Create `server/src/utils/status-transitions.ts` — export `isValidTransition(ctx: TransitionContext): boolean` with `ADMIN_TRANSITIONS` and `EMPLOYEE_TRANSITIONS` record maps exactly matching the design transition table
    - Export `getAllowedTransitions(status: Status, role: Role, isAssigned: boolean): Status[]` for 422 error body generation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 2.5 Implement ticket-number format utilities
    - Create `server/src/utils/ticket-number.ts` — export `formatTicketNumber(year: number, sequence: number): string` and `parseTicketNumber(ticketNumber: string): { year: number; sequence: number } | null`
    - Format: `MFG-{YEAR}-{SEQUENCE}` where SEQUENCE is zero-padded to 6 digits
    - _Requirements: 15.1, 15.2, 3.2_

- [x] 3. Service layer — Auth and User
  - [x] 3.1 Implement `Activity_Logger` service
    - Create `server/src/services/activity-logger.service.ts`
    - Implement `log(entry: ActivityEntry): Promise<void>` using `prisma.ticketActivity.create()`
    - Define `ActivityAction` enum/type: `TICKET_CREATED`, `STATUS_CHANGED`, `PRIORITY_CHANGED`, `ASSIGNMENT_CHANGED`, `FIELD_UPDATED`, `COMMENT_ADDED`
    - No update or delete methods — append-only
    - _Requirements: 10.1, 10.3, 3.7, 5.7, 6.2, 7.8, 8.2, 9.5_

  - [x] 3.2 Implement `Auth_Service`
    - Create `server/src/services/auth.service.ts`
    - `login(email, password)`: look up user by email, throw `ApiError(400)` for missing fields, throw `ApiError(401)` for wrong credentials (generic message), throw `ApiError(403)` for inactive account; use `bcrypt.compare`; save `SessionUser` into iron-session; return `SafeUser`
    - `logout(session)`: call `session.destroy()`
    - `getSession(req)`: call `getIronSession`, return `session.user ?? null`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 1.9, 1.10, 13.4_

  - [x] 3.3 Implement `User_Service`
    - Create `server/src/services/user.service.ts`
    - `createUser(dto)`: validate fields (fullName 1–100, email format + ≤191, password ≥8, role, isActive), hash password with `bcrypt.hash(password, 10)`, create user via Prisma, return `SafeUser`; throw `ApiError(409)` on duplicate email
    - `listUsers(query)`: paginated query with optional `search` (case-insensitive on fullName/email), `role`, `isActive` filters; default page=1, limit=20, max limit=100; return `PaginatedResult<SafeUser>`
    - `getUserById(id)`: return `SafeUser` or throw `ApiError(404)`
    - `updateUser(id, dto)`: validate supplied fields, re-hash password if provided, apply partial update, return `SafeUser`; throw `ApiError(409)` on duplicate email
    - All results pass through `stripPasswordHash`
    - _Requirements: 2.1–2.14, 14.1, 14.2, 14.3, 14.4_

- [x] 4. Service layer — Ticket and Dashboard
  - [x] 4.1 Implement `Ticket_Service` — creation and listing
    - Create `server/src/services/ticket.service.ts`
    - `createTicket(dto, actor)`: validate fields (title 1–200, description 1–5000, valid category, valid priority); if actor is ADMIN and `assignedToId` provided, validate assignee exists and is active; if actor is EMPLOYEE, ignore `assignedToId`; call `generateTicketNumber()` inside a Prisma transaction using `SELECT MAX ... FOR UPDATE` raw query; set `status=OPEN`; call `Activity_Logger.log(TICKET_CREATED)`; return created ticket
    - `listTickets(query)`: paginated query with optional filters (`status`, `priority`, `search` on title/ticketNumber, `assignedToId`); apply AND logic for multiple filters; default page=1, limit=20, max=100; return `PaginatedResult<TicketSummary>`
    - _Requirements: 3.1–3.9, 4.1, 4.2, 4.4–4.9, 15.1–15.6_

  - [x] 4.2 Implement `Ticket_Service` — detail, update, assign, and status
    - Add `getTicketById(id)`: return full `TicketDetail` including creator, assignee, comments ordered by `createdAt asc`, activities ordered by `createdAt asc`; throw `ApiError(404)` if not found
    - Add `updateTicket(id, dto, actor)`: ADMIN only; validate supplied fields; for each changed field call `Activity_Logger.log(FIELD_UPDATED)` and/or `PRIORITY_CHANGED`; update only differing fields; throw `ApiError(404)` if ticket not found; throw `ApiError(400)` if body empty or unrecognized
    - Add `assignTicket(id, assignedToId, actor)`: ADMIN only; validate target user exists (404), is active (422), has role EMPLOYEE (422); reject if ticket status is CLOSED/CANCELLED (422); call `Activity_Logger.log(ASSIGNMENT_CHANGED)`; return updated ticket
    - Add `transitionStatus(id, newStatus, actor)`: call `isValidTransition()`; throw `ApiError(422)` with current status + allowed transitions on failure; throw `ApiError(403)` for EMPLOYEE ownership/role violations; set `resolvedAt` on RESOLVED, `closedAt` on CLOSED; call `Activity_Logger.log(STATUS_CHANGED)`; return updated ticket
    - _Requirements: 4.3, 5.1–5.8, 6.1–6.6, 7.1–7.10, 8.1–8.6_

  - [x] 4.3 Implement `Ticket_Service` — comments
    - Add `addComment(ticketId, content, actor)`: validate `content` 1–5000 chars; throw `ApiError(404)` if ticket not found; throw `ApiError(422)` if ticket status is CLOSED or CANCELLED; create comment via Prisma; call `Activity_Logger.log(COMMENT_ADDED)` with `newValue = String(comment.id)`; return new `TicketComment`
    - _Requirements: 9.1–9.7_

  - [x] 4.4 Implement `Dashboard_Service`
    - Create `server/src/services/dashboard.service.ts`
    - `getSummary(actorId)`: use `prisma.$transaction` to atomically run: count by each status, count URGENT tickets, count unassigned tickets (`assignedToId IS NULL`), count tickets `assignedToId = actorId`, and fetch 10 most recent tickets ordered by `createdAt desc`
    - Return `DashboardSummary` shape: `{ open, inProgress, resolved, closed, cancelled, urgent, unassigned, myAssigned, recentTickets }`
    - Wrap in try/catch; rethrow DB errors as `ApiError(503)`
    - _Requirements: 11.1–11.7_

- [x] 5. API route handlers
  - [x] 5.1 Implement health check and auth routes
    - Create `server/src/app/api/health/route.ts` — `GET`: ping DB with `prisma.$queryRaw\`SELECT 1\``; return 200 `{ status: "ok", database: "connected", timestamp }` on success; 503 `{ status: "error", database: "unreachable", timestamp }` on failure; enforce 5-second timeout
    - Create `server/src/app/api/auth/login/route.ts` — `POST`: parse body, call `Auth_Service.login()`, save session, return 200 with `SafeUser`
    - Create `server/src/app/api/auth/logout/route.ts` — `POST`: call `authGuard`, call `Auth_Service.logout()`, return 200
    - Create `server/src/app/api/auth/me/route.ts` — `GET`: call `authGuard`, return current `SessionUser` mapped to `SafeUser` shape
    - _Requirements: 1.1–1.10, 12.1–12.3_

  - [x] 5.2 Implement user management routes
    - Create `server/src/app/api/users/route.ts` — `GET`: `authGuard` + `requireRole(ADMIN)`, parse query params, call `User_Service.listUsers()`; `POST`: `authGuard` + `requireRole(ADMIN)`, parse body, call `User_Service.createUser()`, return 201
    - Create `server/src/app/api/users/[id]/route.ts` — `GET`: `authGuard` + `requireRole(ADMIN)`, call `User_Service.getUserById()`; `PATCH`: `authGuard` + `requireRole(ADMIN)`, call `User_Service.updateUser()`
    - All handlers wrap in try/catch → `handleApiError`
    - _Requirements: 2.1–2.14_

  - [x] 5.3 Implement ticket routes — list, create, and detail
    - Create `server/src/app/api/tickets/route.ts` — `GET`: `authGuard`, parse query params, call `Ticket_Service.listTickets()`; `POST`: `authGuard`, parse body, call `Ticket_Service.createTicket()`, return 201
    - Create `server/src/app/api/tickets/[id]/route.ts` — `GET`: `authGuard`, call `Ticket_Service.getTicketById()`; `PATCH`: `authGuard`, check role (ADMIN only), call `Ticket_Service.updateTicket()`
    - _Requirements: 3.1–3.9, 4.1–4.10, 6.1–6.6, 8.1–8.6_

  - [x] 5.4 Implement ticket sub-resource routes
    - Create `server/src/app/api/tickets/[id]/assign/route.ts` — `POST`: `authGuard` + `requireRole(ADMIN)`, parse body, call `Ticket_Service.assignTicket()`
    - Create `server/src/app/api/tickets/[id]/status/route.ts` — `POST`: `authGuard`, parse body, call `Ticket_Service.transitionStatus()`
    - Create `server/src/app/api/tickets/[id]/comments/route.ts` — `POST`: `authGuard`, parse body, call `Ticket_Service.addComment()`, return 201
    - Create `server/src/app/api/dashboard/summary/route.ts` — `GET`: `authGuard`, call `Dashboard_Service.getSummary(user.id)`
    - _Requirements: 5.1–5.8, 7.1–7.10, 9.1–9.7, 11.1–11.7_

  - [x] 5.5 Checkpoint — verify all API routes respond correctly
    - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Property-based tests
  - [x] 6.1 Write property test for status transition completeness (Property 1)
    - Create `server/src/utils/__tests__/status-transitions.test.ts`
    - Use `fast-check` with `fc.constantFrom` over all `(currentStatus, requestedStatus, role, isAssigned)` combinations
    - Assert `isValidTransition()` returns `true` iff the combination is in the explicit transition table; assert `false` for all others
    - Tag: `// Feature: mfg-ticket-system, Property 1: Status Transition Completeness`
    - Set `{ numRuns: 100 }`
    - **Property 1: Status Transition Completeness**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**
    - _Requirements: 7.1–7.7_

  - [x] 6.2 Write property test for ticket number format round-trip (Property 2)
    - Create `server/src/utils/__tests__/ticket-number.test.ts`
    - Use `fast-check` `fc.tuple(fc.integer({ min: 2000, max: 2099 }), fc.integer({ min: 1, max: 999999 }))` to generate `(year, sequence)` pairs
    - Assert `parseTicketNumber(formatTicketNumber(year, sequence))` equals `{ year, sequence }` exactly
    - Tag: `// Feature: mfg-ticket-system, Property 2: Ticket Number Format Round-Trip`
    - Set `{ numRuns: 100 }`
    - **Property 2: Ticket Number Format Round-Trip**
    - **Validates: Requirements 15.1, 15.2, 3.2**
    - _Requirements: 15.1, 15.2, 3.2_

  - [x] 6.3 Write property test for ticket number uniqueness (Property 3)
    - Create `server/src/services/__tests__/ticket-number-uniqueness.test.ts`
    - Mock Prisma with an in-memory counter; use `fc.integer({ min: 1, max: 100 })` for N
    - Call the ticket-number generator N times sequentially; assert all resulting ticket numbers are distinct (`new Set(numbers).size === N`)
    - Tag: `// Feature: mfg-ticket-system, Property 3: Ticket Number Uniqueness`
    - Set `{ numRuns: 100 }`
    - **Property 3: Ticket Number Uniqueness**
    - **Validates: Requirements 15.2, 15.3**
    - _Requirements: 15.2, 15.3_

  - [x] 6.4 Write property test for password hash non-reversibility and verification (Property 4)
    - Create `server/src/services/__tests__/password-hash.test.ts`
    - Use `fast-check` `fc.string({ minLength: 1, maxLength: 72 })` for passwords (bcrypt limit)
    - Assert `bcrypt.compareSync(p, bcrypt.hashSync(p, 10)) === true` (verification property)
    - Use `fc.tuple(fc.string({ minLength: 1 }), fc.string({ minLength: 1 })).filter(([p1, p2]) => p1 !== p2)` for distinct pairs
    - Assert `bcrypt.compareSync(p2, bcrypt.hashSync(p1, 10)) === false` (non-reversibility property)
    - Tag: `// Feature: mfg-ticket-system, Property 4: Password Hash Non-Reversibility and Verification`
    - Set `{ numRuns: 20 }` (bcrypt is slow — keep runs low)
    - **Property 4: Password Hash Non-Reversibility and Verification**
    - **Validates: Requirements 14.1, 14.3**
    - _Requirements: 14.1, 14.3_

  - [x] 6.5 Write property test for authorization enforcement completeness (Property 5)
    - Create `server/src/middleware/__tests__/auth-guard.test.ts`
    - Define the permission matrix as a typed data structure covering all `(endpoint, method, role, ownership)` tuples where access is denied
    - Mock `getIronSession` and Prisma user lookup; call `authGuard` / `requireRole` for each denied tuple
    - Assert each returns `ApiError` with `statusCode === 401` or `statusCode === 403` without calling any business logic
    - Tag: `// Feature: mfg-ticket-system, Property 5: Authorization Enforcement Completeness`
    - Set `{ numRuns: 100 }`
    - **Property 5: Authorization Enforcement Completeness**
    - **Validates: Requirements 13.1, 13.2, 13.3, 2.1, 5.8, 6.3, 7.6, 7.7, 8.4**
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 6.6 Write property test for activity log monotonicity (Property 6)
    - Create `server/src/services/__tests__/activity-logger.test.ts`
    - Mock Prisma with an in-memory array store
    - Use `fast-check` `fc.array(fc.constantFrom(...VALID_OPERATIONS), { minLength: 1, maxLength: 20 })` to generate random operation sequences
    - After each operation, assert `activityCount >= previousActivityCount`
    - Tag: `// Feature: mfg-ticket-system, Property 6: Activity Log Monotonicity`
    - Set `{ numRuns: 100 }`
    - **Property 6: Activity Log Monotonicity**
    - **Validates: Requirements 10.1, 10.3**
    - _Requirements: 10.1, 10.3_

  - [x] 6.7 Write property test for pagination completeness and non-duplication (Property 7)
    - Create `server/src/services/__tests__/pagination.test.ts`
    - Mock Prisma with an in-memory ticket store; use `fc.integer({ min: 1, max: 200 })` for N, `fc.integer({ min: 1, max: 50 })` for L
    - Paginate through all pages; collect all ticket IDs; assert `union.length === N` and all IDs are unique
    - Tag: `// Feature: mfg-ticket-system, Property 7: Pagination Completeness and Non-Duplication`
    - Set `{ numRuns: 100 }`
    - **Property 7: Pagination Completeness and Non-Duplication**
    - **Validates: Requirements 4.8, 2.5**
    - _Requirements: 4.8, 2.5_

  - [x] 6.8 Write property test for dashboard count consistency (Property 8)
    - Create `server/src/services/__tests__/dashboard.test.ts`
    - Mock Prisma with an in-memory ticket store; use `fc.array(fc.constantFrom("OPEN","IN_PROGRESS","RESOLVED","CLOSED","CANCELLED"), { minLength: 0, maxLength: 100 })` for ticket status distributions
    - Assert `open + inProgress + resolved + closed === totalNonCancelledTickets` for each generated set
    - Tag: `// Feature: mfg-ticket-system, Property 8: Dashboard Count Consistency`
    - Set `{ numRuns: 100 }`
    - **Property 8: Dashboard Count Consistency**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
    - _Requirements: 11.1, 11.4_

  - [x] 6.9 Checkpoint — run all property-based tests
    - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Client-side setup
  - [x] 7.1 Install client-side dependencies
    - Verify `react-router-dom` v7 is installed (already in package.json)
    - Install `axios` (optional — or confirm fetch wrapper approach) and any additional dev dependencies for testing: `vitest`, `@testing-library/react`, `jsdom`
    - Ensure TailwindCSS is configured (`tailwind.config.js`, `postcss.config.js`, `index.css` with `@tailwind` directives)
    - _Requirements: (client architecture)_

  - [x] 7.2 Configure client routing and root layout
    - Update `client/src/main.tsx` to wrap `<App>` with `<BrowserRouter>` (or use `createBrowserRouter`)
    - Update `client/src/App.tsx` to define routes using `createBrowserRouter`: `/login` → `LoginPage`; `/` → redirect to `/dashboard`; `/dashboard`, `/tickets`, `/tickets/new`, `/tickets/:id` → inside `ProtectedLayout`; `/admin/users`, `/admin/users/new`, `/admin/users/:id` → inside `AdminLayout`
    - Create `client/src/layouts/ProtectedLayout.tsx` — reads `AuthContext`; if `user === null` redirects to `/login`; renders `<SystemNavbar>` + `<Outlet>`
    - Create `client/src/layouts/AdminLayout.tsx` — extends `ProtectedLayout` check; if `user.role !== "ADMIN"` redirects to `/dashboard`; renders `<Outlet>`
    - _Requirements: 1.5, 13.1, 13.2_

  - [x] 7.3 Implement `AuthContext` and `useAuth` hook
    - Create `client/src/context/AuthContext.tsx` — define `AuthContextType { user: SessionUser | null; loading: boolean; login(...); logout() }`; on mount call `GET /api/auth/me`; set `user` on 200, `null` on 401; expose `login()` (calls `POST /api/auth/login`, sets user, navigates to `/dashboard`) and `logout()` (calls `POST /api/auth/logout`, clears user, navigates to `/login`)
    - Create `client/src/hooks/system-hooks/useAuth.ts` — `export function useAuth()` consuming `AuthContext`
    - Wrap `<App>` in `<AuthProvider>` in `main.tsx`
    - _Requirements: 1.1, 1.4, 1.8, 1.9_

  - [x] 7.4 Implement API service layer — auth and system services
    - Create `client/src/config/api.config.ts` — export `BASE_URL = "http://localhost:3000/api"` and a typed `apiFetch` wrapper that calls `fetch` with `credentials: "include"`, parses JSON, and throws `{ message, field }` on non-2xx responses
    - Create `client/src/services/system-api-services/auth.service.ts` — `login(email, password)`, `logout()`, `me()`
    - Create `client/src/services/system-api-services/dashboard.service.ts` — `getSummary(): Promise<DashboardSummary>`
    - Create `client/src/services/system-api-services/ticket.service.ts` — `listTickets(query)`, `getTicketById(id)`
    - _Requirements: 1.1, 1.4, 4.1, 11.1_

  - [x] 7.5 Implement API service layer — admin and employee services
    - Create `client/src/services/admin-api-services/user.service.ts` — `listUsers(query)`, `createUser(dto)`, `getUserById(id)`, `updateUser(id, dto)`
    - Create `client/src/services/admin-api-services/ticket.service.ts` — `updateTicket(id, dto)`, `assignTicket(id, assignedToId)`, `transitionStatus(id, status)` (admin actions)
    - Create `client/src/services/client-api-services/ticket.service.ts` — `createTicket(dto)`, `transitionStatus(id, status)` (employee-scoped)
    - _Requirements: 2.1–2.14, 3.1, 5.1, 6.1, 7.1_

- [x] 8. Shared system components
  - [x] 8.1 Implement `SystemNavbar`
    - Create `client/src/components/system-components/system-navbar/SystemNavbar.tsx`
    - Show navigation links: Dashboard, Tickets; if `user.role === "ADMIN"` also show Users
    - Show current user name and a Logout button that calls `AuthContext.logout()`
    - Use `react-router-dom` `<NavLink>` for active-state styling with TailwindCSS
    - _Requirements: 1.4, 13.2_

  - [x] 8.2 Implement status and priority badge components
    - Create `client/src/components/system-components/TicketStatusBadge.tsx` — color-coded chip for `Status` enum values (OPEN=blue, IN_PROGRESS=yellow, RESOLVED=green, CLOSED=gray, CANCELLED=red)
    - Create `client/src/components/system-components/TicketPriorityBadge.tsx` — color-coded chip for `Priority` enum values (LOW=gray, MEDIUM=blue, HIGH=orange, URGENT=red)
    - _Requirements: 4.3_

  - [x] 8.3 Implement `PaginationControls`, `ActivityFeed`, and `CommentList`/`CommentForm`
    - Create `client/src/components/system-components/PaginationControls.tsx` — prev/next buttons and page indicator; accepts `page`, `limit`, `total`, `onPageChange` props
    - Create `client/src/components/system-components/ActivityFeed.tsx` — renders an ordered list of `TicketActivity` records with action label, actor name, old/new values, and timestamp
    - Create `client/src/components/system-components/CommentList.tsx` — renders ordered `TicketComment` list with author and timestamp
    - Create `client/src/components/system-components/CommentForm.tsx` — textarea + submit button; calls `POST /api/tickets/:id/comments` via service; clears on success; shows inline error on failure
    - _Requirements: 4.3, 9.1, 10.2_

- [x] 9. System pages (shared by all roles)
  - [x] 9.1 Implement `LoginPage`
    - Create `client/src/pages/system-page/LoginPage.tsx`
    - Form with `email` and `password` fields; calls `AuthContext.login()`; shows field-level errors from API 400 responses; shows generic error for 401/403 responses; navigates to `/dashboard` on success
    - If user is already authenticated, redirect to `/dashboard` immediately
    - _Requirements: 1.1, 1.2, 1.3, 1.7_

  - [x] 9.2 Implement `DashboardPage`
    - Create `client/src/pages/system-page/DashboardPage.tsx`
    - Fetch `GET /api/dashboard/summary` via `dashboard.service.ts` on mount
    - Display count cards for each status, urgent count, unassigned count, and myAssigned count
    - Display `recentTickets` list (up to 10) with ticket number, title, status badge, priority badge, and link to ticket detail
    - Show loading skeleton while fetching; show error message on 503
    - _Requirements: 11.1–11.7_

  - [x] 9.3 Implement `TicketListPage`
    - Create `client/src/pages/system-page/TicketListPage.tsx`
    - Fetch tickets via `useTickets` hook (or direct service call) with query params derived from filter controls
    - Render a table/list of tickets with columns: ticket number, title, status badge, priority badge, assignee, created date
    - Implement filter controls: status dropdown, priority dropdown, search input, assignedToId input (admin only)
    - Include `PaginationControls`; clicking a row navigates to `/tickets/:id`
    - Create `client/src/hooks/system-hooks/useTickets.ts` — wraps `listTickets(query)` with `useState`/`useEffect`, re-fetches when filters change
    - _Requirements: 4.1–4.9_

  - [x] 9.4 Implement `TicketDetailPage`
    - Create `client/src/pages/system-page/TicketDetailPage.tsx`
    - Fetch `GET /api/tickets/:id` on mount; display full ticket detail: title, description, category, status badge, priority badge, creator, assignee, createdAt, resolvedAt, closedAt
    - Render `ActivityFeed` and `CommentList`/`CommentForm` sections
    - If `user.role === "ADMIN"` render `StatusTransitionButtons`, `AssignTicketModal`, and `PrioritySelector` inline
    - If `user.role === "EMPLOYEE"` and ticket is assigned to them render `EmployeeStatusActions`
    - _Requirements: 4.3, 5.1, 6.1, 7.1, 9.1, 10.2_

  - [x] 9.5 Implement `CreateTicketPage`
    - Create `client/src/pages/system-page/CreateTicketPage.tsx`
    - Form with `title`, `description`, `category` (select from `VALID_CATEGORIES`), `priority` (select) fields
    - If `user.role === "ADMIN"` include an optional `assignedToId` field (dropdown of active EMPLOYEE users fetched from `GET /api/users`)
    - Submit calls `createTicket(dto)` from the appropriate service; shows field-level validation errors from 400 responses; navigates to `/tickets/:id` on 201
    - _Requirements: 3.1–3.9_

- [x] 10. Admin pages and components
  - [x] 10.1 Implement admin ticket management components
    - Create `client/src/components/admin-components/AssignTicketModal.tsx` — modal with dropdown of active EMPLOYEE users; submit calls `assignTicket(id, assignedToId)`; shows error on 422/404
    - Create `client/src/components/admin-components/StatusTransitionButtons.tsx` — renders a button for each valid next status from `getAllowedTransitions(currentStatus, "ADMIN", ...)`; calls `transitionStatus(id, status)`; refreshes ticket detail on success
    - Create `client/src/components/admin-components/PrioritySelector.tsx` — dropdown for `LOW`, `MEDIUM`, `HIGH`, `URGENT`; calls `updateTicket(id, { priority })` on change; shows error on failure
    - _Requirements: 5.1–5.8, 6.1–6.6, 7.1–7.9_

  - [x] 10.2 Implement `UserListPage` and `UserTable`
    - Create `client/src/components/admin-components/UserTable.tsx` — table with columns: full name, email, role badge, active status, actions (View/Edit)
    - Create `client/src/pages/admin-pages/UserListPage.tsx` — fetch users via `useUsers` hook; render `UserTable` with `PaginationControls`; include search input and role/isActive filter dropdowns; "Create User" button navigates to `/admin/users/new`
    - Create `client/src/hooks/admin-hooks/useUsers.ts` — wraps `listUsers(query)` with filter/pagination state
    - _Requirements: 2.1, 2.5–2.8_

  - [x] 10.3 Implement `CreateUserPage` and `EditUserPage`
    - Create `client/src/pages/admin-pages/CreateUserPage.tsx` — form with `fullName`, `email`, `password`, `role`, `isActive` fields; submit calls `createUser(dto)`; shows field-level errors from 400/409; navigates to `/admin/users` on 201
    - Create `client/src/pages/admin-pages/EditUserPage.tsx` — fetch existing user via `getUserById(id)` on mount; pre-populate form; submit calls `updateUser(id, dto)` with only changed fields; `password` field is optional (blank = no change); shows 409 on duplicate email; navigates back to `/admin/users` on success
    - _Requirements: 2.2–2.4, 2.9–2.13_

- [x] 11. Employee-specific components
  - [x] 11.1 Implement employee components and `useMyTickets` hook
    - Create `client/src/components/client-components/MyTicketsBanner.tsx` — displays count of tickets assigned to current user fetched from `myAssigned` in dashboard summary
    - Create `client/src/components/client-components/EmployeeStatusActions.tsx` — renders valid employee status transition buttons (`IN_PROGRESS` when OPEN, `RESOLVED` when IN_PROGRESS) for tickets assigned to the current user; calls `transitionStatus` from `client-api-services/ticket.service.ts`; disabled and hidden if ticket is not assigned to current user
    - Create `client/src/hooks/client-hooks/useMyTickets.ts` — wraps `listTickets({ assignedToId: user.id })` for employee-scoped ticket list
    - _Requirements: 7.1, 7.2, 7.6, 7.7_

- [x] 12. Integration wiring and final validation
  - [x] 12.1 Wire `DashboardPage` with `MyTicketsBanner` and complete navigation flow
    - Integrate `MyTicketsBanner` into `DashboardPage` for EMPLOYEE users
    - Ensure `ProtectedLayout` and `AdminLayout` correctly guard all routes using live `AuthContext` state
    - Verify that navigating to a protected route while unauthenticated redirects to `/login` and that the post-login redirect returns the user to the originally requested route
    - _Requirements: 1.5, 13.1, 13.2_

  - [x] 12.2 Wire ticket detail page with all role-aware action components
    - Confirm `TicketDetailPage` conditionally renders `AssignTicketModal`, `StatusTransitionButtons`, `PrioritySelector` (admin), and `EmployeeStatusActions` (employee) based on `user.role` and assignment
    - After any mutating action (assign, status change, priority change, comment), refetch the ticket detail and activity feed to show the updated state without a full page reload
    - _Requirements: 4.3, 5.1, 6.1, 7.1, 9.1, 10.2_

  - [x] 12.3 Final checkpoint — end-to-end smoke test
    - Ensure all server-side unit and property-based tests pass (`npm test` in `server/`)
    - Verify the full user flow compiles without TypeScript errors in both `client/` and `server/` (`tsc --noEmit`)
    - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- The design uses TypeScript throughout — no language selection was required
- Property tests (Tasks 6.1–6.8) use `fast-check` with Vitest; run via `npm test` in `server/`
- bcrypt property tests (6.4) use a low `numRuns` (20) because bcrypt is intentionally slow
- All API service functions on the client use `credentials: "include"` so the session cookie is sent automatically
- `authGuard` re-queries `isActive` from the DB on every protected request — this is intentional per the design (Requirement 13.4)
- Ticket number generation uses a raw `SELECT ... FOR UPDATE` inside a Prisma transaction — do not replace with ORM-level queries
- The `passwordHash` field must be stripped at every User-returning boundary on the server; `stripPasswordHash` utility handles this
- Each task references specific requirements for traceability

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5"] },
    { "id": 2, "tasks": ["3.1", "3.2"] },
    { "id": 3, "tasks": ["3.3"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4"] },
    { "id": 6, "tasks": ["5.1", "5.2"] },
    { "id": 7, "tasks": ["5.3"] },
    { "id": 8, "tasks": ["5.4"] },
    { "id": 9, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8"] },
    { "id": 10, "tasks": ["7.1", "7.2"] },
    { "id": 11, "tasks": ["7.3"] },
    { "id": 12, "tasks": ["7.4"] },
    { "id": 13, "tasks": ["7.5"] },
    { "id": 14, "tasks": ["8.1", "8.2", "8.3"] },
    { "id": 15, "tasks": ["9.1", "9.2", "9.3", "9.5"] },
    { "id": 16, "tasks": ["9.4", "10.1"] },
    { "id": 17, "tasks": ["10.2", "11.1"] },
    { "id": 18, "tasks": ["10.3"] },
    { "id": 19, "tasks": ["12.1", "12.2"] },
    { "id": 20, "tasks": ["12.3"] }
  ]
}
```
