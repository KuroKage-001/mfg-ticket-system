---
inclusion: always
---

# MFG Ticket System — Project Context

Read this before doing any work. It replaces the need to explore the codebase from scratch each session.

---

## Monorepo Structure

```
mfg-ticket-system/
├── client/   # React frontend (Vite)
└── server/   # Next.js API backend
```

---

## Frontend (`client/`)

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router v7 · Recharts · React Icons · @react-pdf/renderer · xlsx / xlsx-js-style

**Dev commands (run manually in terminal):**
- `npm run dev` — start Vite dev server
- `npm run build` — `tsc && vite build`
- `npm run lint` — ESLint
- `npm run type-check` — `tsc --noEmit`
- `npm run test` — Vitest (single run)

**Source layout (`client/src/`):**

| Path | Purpose |
|---|---|
| `components/admin-components/` | UI components for admin role |
| `components/client-components/` | UI components for employee/client role |
| `components/system-components/` | Shared UI (navbar, charts, modals, badges, pagination) |
| `pages/admin-pages/` | Admin pages: UserList, CreateUser, EditUser, KnowledgeBase |
| `pages/system-page/` | Shared pages: Login, Home, Dashboard, TicketList, TicketDetail, CreateTicket |
| `hooks/admin-hooks/` | `useUsers.ts` |
| `hooks/client-hooks/` | `useMyTickets.ts` |
| `hooks/system-hooks/` | `useAuth.ts`, `useTickets.ts`, `useTicketTimer.ts` |
| `context/` | `AuthContext.tsx` — global auth state |
| `config/api.config.ts` | `BASE_URL` + `apiFetch<T>()` wrapper (uses `credentials: include`) |
| `config/priority.config.ts` | Priority level definitions |

**HTTP pattern:** All API calls go through `apiFetch<T>(path, init?)` from `api.config.ts`. It prepends `BASE_URL` (from `VITE_API_URL` env var, default `http://localhost:3000/api`), sends cookies, and throws a typed `ApiError` on non-2xx.

---

## Backend (`server/`)

**Stack:** Next.js 16 (App Router, API Routes) · TypeScript · Prisma 6 (ORM) · PostgreSQL · bcryptjs · iron-session · Cloudinary

**Dev commands (run manually in terminal):**
- `npm run dev` — Next.js dev server
- `npm run build` — Next.js build
- `npm run test` — Vitest (single run)
- `npm run seed` — run Prisma seed

**Source layout (`server/src/`):**

| Path | Purpose |
|---|---|
| `app/api/auth/` | Auth routes (login, logout, me) |
| `app/api/tickets/` | Ticket CRUD + status transitions |
| `app/api/users/` | User management |
| `app/api/dashboard/` | Dashboard stats |
| `app/api/kb/` | Knowledge base |
| `app/api/health/` | Health check |
| `app/api/debug/` | Debug endpoints |
| `src/services/` | Business logic layer |
| `src/middleware/` | Auth / session middleware |
| `src/lib/` | Shared utilities (Prisma client, etc.) |
| `src/config/` | Config helpers |
| `src/types/` | Shared TypeScript types |
| `src/utils/` | Utility functions |
| `prisma/schema.prisma` | Database schema |
| `prisma/seed.ts` | Seed script |

**Auth:** Session-based via `iron-session`. Credentials sent as cookies from the client.

---

## Conventions

- Components are `.tsx`; hooks and utilities are `.ts`
- New components go in the correct role subfolder (`admin-components/`, `client-components/`, or `system-components/`)
- New hooks follow `use<Name>.ts` naming and go in the correct role subfolder
- New API routes follow Next.js App Router conventions inside `server/src/app/api/`
- Always read the existing file before editing or extending it
- Match the existing code style — do not introduce new patterns or libraries without asking

## Hard Rules

- **Do NOT add tests** unless explicitly asked
- **Do NOT install new packages** without asking first
- **Do NOT push to main/master** — always use a new branch
- **Do NOT use `git add .`** — stage specific files only
