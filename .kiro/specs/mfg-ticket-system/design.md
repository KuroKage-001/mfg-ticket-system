# Design Document — Manufacturing Ticket System

## Overview

The Manufacturing Ticket System (MFG Ticket System) is an internal web application that allows employees to report manufacturing issues as tickets and administrators to manage, assign, and resolve them. The system is divided into a React + Vite client (TypeScript) served at `http://localhost:5173` and a Next.js 14+ API server (TypeScript) at `http://localhost:3000/api`, backed by a MySQL/MariaDB database managed through Prisma ORM.

**V1 scope:** Login, user management (admin), full ticket lifecycle (create → assign → in-progress → resolved → closed / cancelled), comments, activity log, and dashboard summary. File attachments, email notifications, charts, and report exports are out of scope for V1.

### Key Design Decisions

- **Separate client/server processes:** The React app communicates with the Next.js backend exclusively over HTTP. CORS is configured to allow `http://localhost:5173` only.
- **App Router for API routes only:** The Next.js server uses the App Router (`src/app/api/`) solely for its route handlers. No Next.js pages are rendered — the server is a pure API backend.
- **iron-session for sessions:** HTTP-only cookies managed by `iron-session` provide stateless, tamper-proof session tokens. No Redis or DB session store is needed.
- **Prisma as the only DB interface:** All SQL is mediated through Prisma. No raw queries are used except for the atomic ticket-number generation sequence (described in §7).
- **Service layer decoupled from route handlers:** Route handlers perform request parsing and response formatting. Business logic lives in service modules (`Auth_Service`, `User_Service`, `Ticket_Service`, `Dashboard_Service`, `Activity_Logger`). This keeps route files thin and makes the service layer unit-testable without HTTP overhead.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Browser (localhost:5173)                │
│                                                         │
│   React + Vite (TypeScript)                             │
│   react-router-dom v7  ·  TailwindCSS  ·  react-icons  │
│                                                         │
│   AuthContext  ──►  API Service Layer  ──► fetch()      │
└──────────────────────────┬──────────────────────────────┘
                           │  HTTP/JSON  (credentials: include)
                           │  Session cookie: mfg_session (HTTP-only)
┌──────────────────────────▼──────────────────────────────┐
│            Next.js API Server (localhost:3000)          │
│                                                         │
│  App Router  ──►  Middleware (authGuard + roleGuard)    │
│                       │                                 │
│              ┌────────▼──────────┐                      │
│              │  Route Handlers   │                      │
│              │  /api/auth/*      │                      │
│              │  /api/users/*     │                      │
│              │  /api/tickets/*   │                      │
│              │  /api/dashboard/* │                      │
│              │  /api/health      │                      │
│              └────────┬──────────┘                      │
│                       │                                 │
│         ┌─────────────▼──────────────────┐             │
│         │         Service Layer          │             │
│         │  Auth_Service                  │             │
│         │  User_Service                  │             │
│         │  Ticket_Service                │             │
│         │  Dashboard_Service             │             │
│         │  Activity_Logger               │             │
│         └─────────────┬──────────────────┘             │
│                       │                                 │
│              ┌────────▼──────────┐                      │
│              │   Prisma Client   │                      │
│              └────────┬──────────┘                      │
└───────────────────────┼─────────────────────────────────┘
                        │  MySQL protocol (port 3306)
┌───────────────────────▼─────────────────────────────────┐
│         MySQL / MariaDB  (XAMPP, localhost:3306)         │
│         Database: db_mfg_ticket_system                  │
│                                                         │
│   users  ·  tickets  ·  ticket_comments                 │
│   ticket_activities  ·  _prisma_migrations              │
└─────────────────────────────────────────────────────────┘
```

### Request Lifecycle

1. React component or hook calls an API service function in `src/services/`.
2. The service function calls `fetch()` with `credentials: "include"` so the browser attaches the session cookie automatically.
3. The Next.js route handler receives the request. The `authGuard` helper resolves the session from the HTTP-only cookie. If the session is absent/expired, it returns `401` immediately.
4. The `roleGuard` helper checks the resolved user's role against the required permission. If unauthorized, returns `403`.
5. The route handler delegates to the appropriate service module, passing the parsed, validated request body and the resolved session user.
6. The service module executes business logic and communicates with Prisma.
7. The route handler serializes the service result to JSON and returns it. `passwordHash` is always stripped at the serialization boundary.

---

## Components and Interfaces

### Server-Side Modules

#### `Auth_Service` (`server/src/services/auth.service.ts`)

Responsibilities:
- Validate login credentials (email lookup → bcrypt compare)
- Create and destroy iron-session sessions
- Expose `getSession(req)` helper for route handlers and middleware
- Enforce `isActive` check before granting a session
- Expose `GET /api/auth/me` resolution

Key functions:
```typescript
login(email: string, password: string): Promise<SessionUser>
logout(session: IronSession): Promise<void>
getSession(req: NextRequest): Promise<SessionUser | null>
```

`SessionUser` is the shape stored in the iron-session cookie:
```typescript
interface SessionUser {
  id: number;
  fullName: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
}
```

#### `User_Service` (`server/src/services/user.service.ts`)

Responsibilities:
- Create user accounts (hash password, enforce unique email)
- Return paginated user lists with optional filtering (search, role, isActive)
- Retrieve single users by ID
- Update user fields (partial PATCH, with re-hashing if password is included)
- Never return `passwordHash` in any result

Key functions:
```typescript
createUser(dto: CreateUserDto): Promise<SafeUser>
listUsers(query: UserListQuery): Promise<PaginatedResult<SafeUser>>
getUserById(id: number): Promise<SafeUser>
updateUser(id: number, dto: UpdateUserDto): Promise<SafeUser>
```

`SafeUser` = Prisma `User` with `passwordHash` omitted.

#### `Ticket_Service` (`server/src/services/ticket.service.ts`)

Responsibilities:
- Create tickets (generate ticket number, validate fields, set status=OPEN)
- List tickets with filters and pagination
- Retrieve full ticket detail (with creator, assignee, comments, activities)
- Apply field updates (title, description, category) with per-field activity logging
- Validate and apply status transitions
- Apply assignment changes
- Add comments (with activity log)
- Enforce role/ownership constraints for updates

Key functions:
```typescript
createTicket(dto: CreateTicketDto, actor: SessionUser): Promise<Ticket>
listTickets(query: TicketListQuery): Promise<PaginatedResult<TicketSummary>>
getTicketById(id: number): Promise<TicketDetail>
updateTicket(id: number, dto: UpdateTicketDto, actor: SessionUser): Promise<Ticket>
assignTicket(id: number, assignedToId: number, actor: SessionUser): Promise<Ticket>
transitionStatus(id: number, newStatus: Status, actor: SessionUser): Promise<Ticket>
addComment(ticketId: number, content: string, actor: SessionUser): Promise<Comment>
```

#### `Dashboard_Service` (`server/src/services/dashboard.service.ts`)

Responsibilities:
- Aggregate ticket counts by status, URGENT priority, unassigned, and `myAssigned`
- Return the 10 most recently created tickets

Key functions:
```typescript
getSummary(actorId: number): Promise<DashboardSummary>
```

Uses `prisma.$transaction` to run all count queries atomically.

#### `Activity_Logger` (`server/src/services/activity-logger.service.ts`)

Responsibilities:
- Append immutable activity records for every tracked event
- Called internally by `Ticket_Service` (never by route handlers directly)
- Supported action types: `TICKET_CREATED`, `STATUS_CHANGED`, `PRIORITY_CHANGED`, `ASSIGNMENT_CHANGED`, `FIELD_UPDATED`, `COMMENT_ADDED`

Key functions:
```typescript
log(entry: ActivityEntry): Promise<void>

interface ActivityEntry {
  action: ActivityAction;
  oldValue?: string | null;
  newValue?: string | null;
  ticketId: number;
  actorId: number;
}
```

Activities are only created, never updated or deleted (enforced by the absence of any `update`/`delete` calls on `ticket_activities` in this module).

### Server-Side Middleware and Helpers

#### `authGuard` (`server/src/middleware/auth-guard.ts`)

A helper function (not Next.js middleware) called at the top of every protected route handler:
```typescript
async function authGuard(req: NextRequest): Promise<SessionUser>
// throws ApiError(401) if session absent, expired, or invalid
// throws ApiError(403) if user.isActive === false
```

#### `roleGuard` (`server/src/middleware/role-guard.ts`)

```typescript
function requireRole(user: SessionUser, ...roles: Role[]): void
// throws ApiError(403) if user.role not in roles
```

#### `ApiError` (`server/src/utils/api-error.ts`)

A typed error class that route handlers catch and serialize:
```typescript
class ApiError extends Error {
  constructor(public statusCode: number, message: string, public field?: string) {}
}
```

#### `stripPasswordHash` (`server/src/utils/strip-password.ts`)

A utility that removes `passwordHash` from any user object before serialization. Applied at every User-returning boundary.

### Client-Side Modules

#### `AuthContext` (`client/src/context/AuthContext.tsx`)

A React context that stores the currently authenticated user and exposes `login()`, `logout()`, and `user` (nullable). On app mount it calls `GET /api/auth/me` to restore session state. All protected routes check this context.

#### API Service Layer (`client/src/services/`)

Thin wrappers around `fetch` that handle base URL, credentials, and error parsing:
- `system-api-services/auth.service.ts` — login, logout, me
- `admin-api-services/user.service.ts` — CRUD users
- `admin-api-services/ticket.service.ts` (admin actions) — assign, priority, status for admin
- `client-api-services/ticket.service.ts` — create, view, status for employee
- `system-api-services/ticket.service.ts` — shared ticket list and detail
- `system-api-services/dashboard.service.ts` — summary

Each service function returns a typed result or throws with an error message derived from the API response body.

#### Custom Hooks (`client/src/hooks/`)

- `system-hooks/useAuth.ts` — accesses `AuthContext`
- `system-hooks/useTickets.ts` — list tickets with query params, auto-fetch on filter change
- `admin-hooks/useUsers.ts` — paginated user list
- `client-hooks/useMyTickets.ts` — tickets list scoped to current user's assignments

---

## Data Models

### Prisma Schema (`server/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  EMPLOYEE
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum Status {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
  CANCELLED
}

model User {
  id           Int      @id @default(autoincrement())
  fullName     String   @map("full_name") @db.VarChar(100)
  email        String   @unique @db.VarChar(191)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  role         Role     @default(EMPLOYEE)
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  createdTickets  Ticket[]         @relation("CreatedBy")
  assignedTickets Ticket[]         @relation("AssignedTo")
  comments        TicketComment[]
  activities      TicketActivity[]

  @@map("users")
}

model Ticket {
  id           Int       @id @default(autoincrement())
  ticketNumber String    @unique @map("ticket_number") @db.VarChar(30)
  title        String    @db.VarChar(200)
  description  String    @db.Text
  category     String    @db.VarChar(100)
  priority     Priority  @default(MEDIUM)
  status       Status    @default(OPEN)
  createdById  Int       @map("created_by_id")
  assignedToId Int?      @map("assigned_to_id")
  resolvedAt   DateTime? @map("resolved_at")
  closedAt     DateTime? @map("closed_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  createdBy   User            @relation("CreatedBy", fields: [createdById], references: [id])
  assignedTo  User?           @relation("AssignedTo", fields: [assignedToId], references: [id])
  comments    TicketComment[]
  activities  TicketActivity[]

  @@index([status])
  @@index([priority])
  @@index([createdById])
  @@index([assignedToId])
  @@index([createdAt])
  @@map("tickets")
}

model TicketComment {
  id        Int      @id @default(autoincrement())
  content   String   @db.Text
  ticketId  Int      @map("ticket_id")
  authorId  Int      @map("author_id")
  createdAt DateTime @default(now()) @map("created_at")

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  author User   @relation(fields: [authorId], references: [id])

  @@index([ticketId])
  @@index([authorId])
  @@map("ticket_comments")
}

model TicketActivity {
  id        Int      @id @default(autoincrement())
  action    String   @db.VarChar(100)
  oldValue  String?  @map("old_value") @db.Text
  newValue  String?  @map("new_value") @db.Text
  ticketId  Int      @map("ticket_id")
  actorId   Int      @map("actor_id")
  createdAt DateTime @default(now()) @map("created_at")

  ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  actor  User   @relation(fields: [actorId], references: [id])

  @@index([ticketId])
  @@index([actorId])
  @@map("ticket_activities")
}
```

### TypeScript DTO Types (`server/src/types/`)

```typescript
// ticket.types.ts
export type TicketCategory =
  | "Hardware" | "Software" | "Network"
  | "Access Request" | "Account Issue" | "Other";

export const VALID_CATEGORIES: TicketCategory[] = [
  "Hardware", "Software", "Network",
  "Access Request", "Account Issue", "Other",
];

export interface CreateTicketDto {
  title: string;
  description: string;
  category: TicketCategory;
  priority: Priority;
  assignedToId?: number;
}

export interface UpdateTicketDto {
  title?: string;
  description?: string;
  category?: TicketCategory;
  priority?: Priority;
}

export interface TicketListQuery {
  page?: number;
  limit?: number;
  status?: Status;
  priority?: Priority;
  search?: string;
  assignedToId?: number;
}

// user.types.ts
export interface CreateUserDto {
  fullName: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
}

export interface UpdateUserDto {
  fullName?: string;
  email?: string;
  password?: string;
  role?: Role;
  isActive?: boolean;
}

export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
}

// pagination.types.ts
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
```

---

## API Route Structure

All routes live under `server/src/app/api/`. Each file exports named functions (`GET`, `POST`, `PATCH`) corresponding to HTTP methods per Next.js App Router conventions.

```
server/src/app/api/
├── health/
│   └── route.ts                    GET /api/health
├── auth/
│   ├── login/route.ts              POST /api/auth/login
│   ├── logout/route.ts             POST /api/auth/logout
│   └── me/route.ts                 GET  /api/auth/me
├── users/
│   ├── route.ts                    GET  /api/users
│   │                               POST /api/users
│   └── [id]/route.ts               GET  /api/users/:id
│                                   PATCH /api/users/:id
└── tickets/
    ├── route.ts                    GET  /api/tickets
    │                               POST /api/tickets
    └── [id]/
        ├── route.ts                GET  /api/tickets/:id
        │                           PATCH /api/tickets/:id
        ├── assign/route.ts         POST /api/tickets/:id/assign
        ├── status/route.ts         POST /api/tickets/:id/status
        └── comments/route.ts       POST /api/tickets/:id/comments
dashboard/
    └── summary/route.ts            GET  /api/dashboard/summary
```

### Route Handler Pattern

Every route handler follows this pattern:

```typescript
// Example: POST /api/tickets
export async function POST(req: NextRequest) {
  try {
    const user = await authGuard(req);          // 401 if no valid session
    const body = await req.json();
    const dto = validateCreateTicketDto(body);  // 400 on validation failure
    const ticket = await Ticket_Service.createTicket(dto, user);
    return NextResponse.json(ticket, { status: 201 });
  } catch (err) {
    return handleApiError(err);                  // maps ApiError → JSON response
  }
}
```

### Endpoint Summary

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/health` | No | — | DB health check |
| POST | `/api/auth/login` | No | — | Login, set session cookie |
| POST | `/api/auth/logout` | Yes | Any | Clear session cookie |
| GET | `/api/auth/me` | Yes | Any | Current user object |
| GET | `/api/users` | Yes | ADMIN | Paginated user list |
| POST | `/api/users` | Yes | ADMIN | Create user |
| GET | `/api/users/:id` | Yes | ADMIN | Get user by ID |
| PATCH | `/api/users/:id` | Yes | ADMIN | Update user |
| GET | `/api/tickets` | Yes | Any | Paginated ticket list |
| POST | `/api/tickets` | Yes | Any | Create ticket |
| GET | `/api/tickets/:id` | Yes | Any | Full ticket detail |
| PATCH | `/api/tickets/:id` | Yes | ADMIN | Edit title/description/category/priority |
| POST | `/api/tickets/:id/assign` | Yes | ADMIN | Assign ticket to employee |
| POST | `/api/tickets/:id/status` | Yes | Any* | Status transition |
| POST | `/api/tickets/:id/comments` | Yes | Any | Add comment |
| GET | `/api/dashboard/summary` | Yes | Any | Dashboard counts |

*Status transitions for CLOSED and CANCELLED are ADMIN-only; EMPLOYEE can only transition their own assigned tickets to IN_PROGRESS or RESOLVED.

---

## Session Management

### Library: iron-session

`iron-session` encrypts the session payload into a sealed cookie using AES-256. No server-side session store is required. The cookie is:
- `HttpOnly: true` — not accessible from JavaScript
- `Secure: true` in production, `false` in development
- `SameSite: lax`
- Named `mfg_session`
- Expires after a configurable inactivity period (default: 24 hours)

### Session Configuration (`server/src/lib/session.ts`)

```typescript
import { SessionOptions } from "iron-session";

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,  // ≥32 chars
  cookieName: "mfg_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
  },
};

export interface SessionData {
  user?: SessionUser;
}
```

### Session Lifecycle

- **Login:** `Auth_Service.login()` verifies credentials, then calls `session.save()` with the `SessionUser` payload.
- **Request:** `authGuard()` calls `getIronSession(req, res, sessionOptions)` and reads `session.user`. If absent or if the user's `isActive` has since become `false`, it throws `ApiError(401)`.
- **Logout:** `Auth_Service.logout()` calls `session.destroy()`, which clears the cookie.
- **Deactivation during active session:** `authGuard()` re-queries the user's `isActive` from the DB on every request to catch accounts deactivated after session creation. This adds one lightweight DB read per request, which is acceptable at this scale.

---

## Ticket Number Generation

### Format

`MFG-{YEAR}-{SEQUENCE}` where YEAR is 4-digit UTC year and SEQUENCE is zero-padded to 6 digits. Example: `MFG-2026-000001`.

### Concurrency-Safe Generation Strategy

A naive approach (count existing tickets and add 1) is vulnerable to race conditions when two requests arrive simultaneously. The chosen approach uses a MySQL `SELECT ... FOR UPDATE` within a Prisma interactive transaction to serialize sequence reads:

```typescript
// server/src/services/ticket.service.ts (ticket number generation)
async function generateTicketNumber(year: number): Promise<string> {
  return await prisma.$transaction(async (tx) => {
    // Lock the row for the current year to prevent concurrent reads
    const result = await tx.$queryRaw<[{ max_seq: number | null }]>`
      SELECT MAX(
        CAST(SUBSTRING(ticket_number, 10) AS UNSIGNED)
      ) AS max_seq
      FROM tickets
      WHERE ticket_number LIKE ${`MFG-${year}-%`}
      FOR UPDATE
    `;
    const lastSeq = result[0].max_seq ?? 0;
    const nextSeq = lastSeq + 1;
    if (nextSeq > 999999) {
      throw new ApiError(500, "Ticket sequence exhausted for this year.");
    }
    return `MFG-${year}-${String(nextSeq).padStart(6, "0")}`;
  });
}
```

The ticket INSERT happens within the same transaction, so if the INSERT fails the sequence number is not consumed. The `FOR UPDATE` row-level lock on the `tickets` table's `ticket_number` column (filtered by year prefix) ensures that concurrent creations serialize through this lock, each reading the current maximum and incrementing it by 1.

**Year rollover:** The `WHERE ticket_number LIKE 'MFG-{year}-%'` filter isolates each year's sequence. On January 1 the query returns `max_seq = null`, so `lastSeq = 0` and the first ticket of the year receives sequence `000001`.

---

## Status Transition State Machine

### Transition Table

```
OPEN        → IN_PROGRESS  (ADMIN or assigned EMPLOYEE)
OPEN        → CANCELLED    (ADMIN only)
IN_PROGRESS → RESOLVED     (ADMIN or assigned EMPLOYEE)
IN_PROGRESS → CANCELLED    (ADMIN only)
RESOLVED    → CLOSED       (ADMIN only)
CLOSED      → (terminal — no transitions)
CANCELLED   → (terminal — no transitions)
```

### Implementation (`server/src/utils/status-transitions.ts`)

The transition logic is extracted into a pure function so it can be tested independently of HTTP or Prisma:

```typescript
type Role = "ADMIN" | "EMPLOYEE";

interface TransitionContext {
  currentStatus: Status;
  requestedStatus: Status;
  role: Role;
  isAssigned: boolean; // is the requesting EMPLOYEE the assigned user?
}

export function isValidTransition(ctx: TransitionContext): boolean {
  const { currentStatus, requestedStatus, role, isAssigned } = ctx;

  if (role === "ADMIN") {
    return ADMIN_TRANSITIONS[currentStatus]?.includes(requestedStatus) ?? false;
  }

  // EMPLOYEE: can only act on tickets assigned to them
  if (!isAssigned) return false;

  return EMPLOYEE_TRANSITIONS[currentStatus]?.includes(requestedStatus) ?? false;
}

const ADMIN_TRANSITIONS: Record<Status, Status[]> = {
  OPEN:        ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["RESOLVED",    "CANCELLED"],
  RESOLVED:    ["CLOSED"],
  CLOSED:      [],
  CANCELLED:   [],
};

const EMPLOYEE_TRANSITIONS: Record<Status, Status[]> = {
  OPEN:        ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED:    [],
  CLOSED:      [],
  CANCELLED:   [],
};
```

The `Ticket_Service.transitionStatus()` calls `isValidTransition()` before touching the database. On failure it throws `ApiError(422)` with the current status and the list of valid next statuses derived from the transition table.

---

## Client-Side Architecture

### Routing

`react-router-dom` v7 with `createBrowserRouter`. Three protected layout groups enforce auth and role at the router level by reading `AuthContext`:

```
/                         → redirect to /login or /dashboard
/login                    → LoginPage (system-page)
/dashboard                → ProtectedLayout → DashboardPage (system-page)
/tickets                  → ProtectedLayout → TicketListPage
/tickets/:id              → ProtectedLayout → TicketDetailPage
/tickets/new              → ProtectedLayout → CreateTicketPage
/admin/users              → AdminLayout (role=ADMIN) → UserListPage
/admin/users/new          → AdminLayout → CreateUserPage
/admin/users/:id          → AdminLayout → EditUserPage
```

`ProtectedLayout` redirects to `/login` if `AuthContext.user` is `null`.
`AdminLayout` further redirects to `/dashboard` if `user.role !== "ADMIN"`.

### Page and Component Breakdown by Role

#### System (shared by ADMIN and EMPLOYEE)

| Page | Component folder |
|------|-----------------|
| `LoginPage` | `system-page/` |
| `DashboardPage` | `system-page/` |
| `TicketListPage` | `system-page/` |
| `TicketDetailPage` | `system-page/` |
| `CreateTicketPage` | `system-page/` |

Key shared components (`system-components/`):
- `SystemNavbar` — role-aware navigation (shows admin links only for ADMIN)
- `TicketStatusBadge` — color-coded status chip
- `TicketPriorityBadge` — color-coded priority chip
- `PaginationControls` — reusable paginator
- `ActivityFeed` — renders the ordered activity list
- `CommentList` / `CommentForm`

#### Admin-Only

| Page | Component folder |
|------|-----------------|
| `UserListPage` | `admin-pages/` |
| `CreateUserPage` | `admin-pages/` |
| `EditUserPage` | `admin-pages/` |

Admin components (`admin-components/`):
- `UserTable` — sortable user table
- `AssignTicketModal` — dropdown to pick an active EMPLOYEE
- `StatusTransitionButtons` — shows all valid next-status buttons based on role
- `PrioritySelector` — priority ENUM picker (admin only)

#### Employee-Specific

Components (`client-components/`):
- `MyTicketsBanner` — quick count of assigned tickets
- `EmployeeStatusActions` — restricted status buttons (IN_PROGRESS, RESOLVED)

### Auth Context Flow

```
App mounts
  └── AuthContext.init() → GET /api/auth/me
        ├── 200 → set user, render app
        └── 401 → set user=null, redirect unauthenticated pages to /login
```

`login(email, password)` calls `POST /api/auth/login`, on success sets user in context and navigates to `/dashboard`.

`logout()` calls `POST /api/auth/logout`, clears user in context, navigates to `/login`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Status Transition Completeness

*For any* combination of `(currentStatus, requestedStatus, role, isAssigned)`, `isValidTransition()` returns `true` if and only if the combination appears in the defined transition table, and `false` for every other combination.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**

---

### Property 2: Ticket Number Format Round-Trip

*For any* valid `(year, sequence)` pair where `year` is a 4-digit integer and `sequence` is between 1 and 999999, `parseTicketNumber(formatTicketNumber(year, sequence))` produces the original `{ year, sequence }` pair exactly.

**Validates: Requirements 15.1, 15.2, 3.2**

---

### Property 3: Ticket Number Uniqueness

*For any* batch of N ticket creation requests (1 ≤ N ≤ 100) processed sequentially using the ticket number generator, all resulting ticket numbers are distinct — i.e., the set of ticket numbers has cardinality N.

**Validates: Requirements 15.2, 15.3**

---

### Property 4: Password Hash Non-Reversibility and Verification

*For any* non-empty password string `p`, `bcrypt.compare(p, bcrypt.hash(p, 10))` returns `true`. Additionally, *for any* two distinct non-empty strings `p1 ≠ p2`, `bcrypt.compare(p2, bcrypt.hash(p1, 10))` returns `false`.

**Validates: Requirements 14.1, 14.3**

---

### Property 5: Authorization Enforcement Completeness

*For any* `(endpoint, method, role, ownership)` tuple where the permission matrix declares access denied, calling that endpoint with a session for `(role, ownership)` returns HTTP 403 or HTTP 401 and does not process the request body or apply any business logic.

**Validates: Requirements 13.1, 13.2, 13.3, 2.1, 5.8, 6.3, 7.6, 7.7, 8.4**

---

### Property 6: Activity Log Monotonicity

*For any* ticket T and any sequence of valid operations O₁…Oₙ applied to T, the activity count for T after Oᵢ₊₁ is greater than or equal to the activity count after Oᵢ — the count never decreases.

**Validates: Requirements 10.1, 10.3**

---

### Property 7: Pagination Completeness and Non-Duplication

*For any* set of N tickets matching a given filter and *any* page size L (1 ≤ L ≤ 100), paginating through all pages yields exactly N distinct ticket IDs with no duplicates — i.e., `union(allPages).length === N` and all IDs are unique.

**Validates: Requirements 4.8, 2.5**

---

### Property 8: Dashboard Count Consistency

*For any* set of tickets with arbitrary status distributions, the sum `open + inProgress + resolved + closed` returned by `Dashboard_Service.getSummary()` equals the total number of tickets whose status is not `CANCELLED`.

**Validates: Requirements 11.1, 11.2, 11.3, 11.4**

---

## Error Handling

### Server-Side Error Strategy

All business logic throws `ApiError` instances. Route handlers have a single `catch` block that calls `handleApiError(err)`:

```typescript
// server/src/utils/handle-api-error.ts
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, field: err.field },
      { status: err.statusCode }
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      // Unique constraint violation
      return NextResponse.json(
        { error: "A record with this value already exists." },
        { status: 409 }
      );
    }
  }
  console.error("[Unhandled API error]", err);
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}
```

### HTTP Status Code Conventions

| Code | When used |
|------|-----------|
| 200 | Successful GET, POST /auth/logout |
| 201 | Successful resource creation |
| 400 | Validation error (missing/invalid fields) |
| 401 | Unauthenticated request or invalid/expired session |
| 403 | Authenticated but unauthorized (wrong role or ownership) |
| 404 | Resource not found |
| 409 | Unique constraint conflict (duplicate email, etc.) |
| 422 | Business rule violation (invalid status transition, inactive assignee, terminal ticket) |
| 500 | Unexpected server error, sequence exhaustion |
| 503 | Database unavailable (health check, dashboard) |

### Client-Side Error Handling

API service functions in `client/src/services/` catch non-2xx responses and extract the `error` field from the JSON body. Components receive error strings and display them inline (form field errors) or as toast notifications (global errors).

---

## Testing Strategy

### Overview

The testing strategy combines unit tests for specific behaviors and property-based tests for universal invariants. The server-side service and utility layers are the primary targets because they contain all business logic and are easily tested without HTTP overhead.

**Recommended testing stack (server):**
- **Test runner:** Vitest
- **Property-based testing:** `fast-check` (TypeScript-native, works with Vitest)
- **Mocking:** Vitest's built-in `vi.mock()` for Prisma client

**Recommended testing stack (client):**
- **Test runner:** Vitest + `@testing-library/react`
- **Property-based testing:** `fast-check`

### Property-Based Test Configuration

Each property test must run a minimum of **100 iterations**. With `fast-check`, set the number of runs:

```typescript
import * as fc from "fast-check";
import { test, expect } from "vitest";

test("Property 1: Status transition completeness", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...ALL_STATUS_TRANSITION_COMBINATIONS),
      ({ currentStatus, requestedStatus, role, isAssigned }) => {
        const result = isValidTransition({ currentStatus, requestedStatus, role, isAssigned });
        const expected = EXPECTED_TRANSITION_TABLE[currentStatus][role][isAssigned]
          .includes(requestedStatus);
        return result === expected;
      }
    ),
    { numRuns: 100 } // finite space so all ~100 combinations are covered
  );
});
```

Tag format for each property test:
`// Feature: mfg-ticket-system, Property {N}: {property_text}`

### Property Test Locations

| Property | Test file | What's mocked |
|----------|-----------|---------------|
| P1 — Status transition | `server/src/utils/__tests__/status-transitions.test.ts` | Nothing (pure function) |
| P2 — Ticket number format | `server/src/utils/__tests__/ticket-number.test.ts` | Nothing (pure function) |
| P3 — Ticket number uniqueness | `server/src/services/__tests__/ticket-number-uniqueness.test.ts` | Prisma (in-memory counter) |
| P4 — Password hash | `server/src/services/__tests__/password-hash.test.ts` | Nothing (real bcrypt) |
| P5 — Authorization | `server/src/middleware/__tests__/auth-guard.test.ts` | iron-session, Prisma |
| P6 — Activity log monotonicity | `server/src/services/__tests__/activity-logger.test.ts` | Prisma (in-memory store) |
| P7 — Pagination | `server/src/services/__tests__/pagination.test.ts` | Prisma (in-memory store) |
| P8 — Dashboard counts | `server/src/services/__tests__/dashboard.test.ts` | Prisma (in-memory store) |

### Unit Test Coverage Targets

In addition to property tests, unit tests should cover:
- `Auth_Service`: successful login, wrong password (401), inactive account (403), missing fields (400)
- `User_Service`: duplicate email (409), invalid role filter (400), password never returned
- `Ticket_Service`: creation sets status=OPEN, comment on CLOSED ticket (422), assign inactive user (422)
- `Activity_Logger`: each action type produces the correct `action` string and `old_value`/`new_value` shape
- `Dashboard_Service`: `myAssigned` changes when actor ID changes, `recentTickets` respects the 10-item limit

### Integration Tests

A small set of integration tests (using the real DB on a test schema) should cover:
- Login → create ticket → assign → transition → comment → dashboard round-trip
- Ticket number uniqueness under sequential creation (5–10 tickets)
- Session invalidation after `isActive` set to `false`

Integration tests run against a separate `db_mfg_ticket_system_test` database, seeded and torn down per test run.
