# Backend Setup Guide

## Stack

- Next.js 16 (API routes only — no pages used)
- Prisma ORM
- MySQL / MariaDB (XAMPP)
- bcryptjs (password hashing)
- iron-session (HTTP-only cookie sessions)

## Prerequisites

- Node.js v18 or higher
- XAMPP running with MySQL/MariaDB on port 3306
- Database `db_mfg_ticket_system` created in phpMyAdmin

## Installation

```bash
cd server
npm install
```

## Prisma Setup

Prisma is already initialized. After cloning:

```bash
cd server
npx prisma generate        # Regenerate the Prisma client
npx prisma migrate deploy  # Apply existing migrations (production-safe)
```

During development:

```bash
npx prisma migrate dev --name <migration-name>  # Create and apply a new migration
npx prisma studio                                # Open Prisma data browser
```

## Environment Variables

Create `server/.env`:

```env
DATABASE_URL="mysql://root:@localhost:3306/db_mfg_ticket_system"
CLIENT_URL="http://localhost:5173"
SESSION_SECRET="replace-this-with-a-long-random-secret-at-least-32-chars"
```

If your MySQL root account has a password:
```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/db_mfg_ticket_system"
```

## Seed the First Admin Account

```bash
npx prisma db seed
```

This creates one ADMIN account if it does not already exist:

| Field | Value             |
|-------|-------------------|
| Email | admin@mfg.local   |
| Role  | ADMIN             |

The seed script hashes the initial password. Check `prisma/seed.ts` for the default.
Change the password immediately after first login.

## Development

```bash
npm run dev
```

Runs at `http://localhost:3000`

## API Routes Structure

```
server/src/app/api/
├── health/route.ts
├── auth/
│   ├── login/route.ts
│   ├── logout/route.ts
│   └── me/route.ts
├── users/
│   ├── route.ts
│   └── [id]/route.ts
├── tickets/
│   ├── route.ts
│   └── [id]/
│       ├── route.ts
│       ├── assign/route.ts
│       ├── status/route.ts
│       └── comments/route.ts
└── dashboard/
    └── summary/route.ts
```
