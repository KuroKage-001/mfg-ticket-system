# MFG Ticket System

A manufacturing ticket management system for tracking and resolving internal issues.

## Architecture

```
React Client          http://localhost:5173
        |
        | HTTP API requests
        v
Next.js Server        http://localhost:3000/api
        |
        | Prisma ORM
        v
MySQL/MariaDB         localhost:3306  (XAMPP)
Database:             db_mfg_ticket_system
```

## Project Structure

```
mfg-ticket-system/
├── docs/                   Project-wide documentation
│   ├── requirements.md
│   ├── roles-and-permissions.md
│   ├── ticket-workflow.md
│   ├── database-design.md
│   ├── api-endpoints.md
│   ├── frontend-setup.md
│   └── backend-setup.md
│
├── client/                 React + Vite frontend
├── server/                 Next.js API backend
│
├── package.json            Root workspace scripts
└── README.md
```

## Quick Start

### 1. Start XAMPP

Start Apache and MySQL in the XAMPP control panel.
Verify `db_mfg_ticket_system` exists at http://localhost/phpmyadmin

### 2. Configure the server environment

Create `server/.env`:
```env
DATABASE_URL="mysql://root:@localhost:3306/db_mfg_ticket_system"
CLIENT_URL="http://localhost:5173"
SESSION_SECRET="replace-this-with-a-long-random-secret"
```

### 3. Install dependencies and run migrations

```bash
cd server
npm install
npx prisma migrate dev --name initial_schema
npx prisma db seed
```

### 4. Install client dependencies

```bash
cd client
npm install
```

### 5. Start both servers (two terminals)

```bash
# Terminal 1
cd server
npm run dev

# Terminal 2
cd client
npm run dev
```

### 6. Open the app

http://localhost:5173

Login with the seeded admin account. See `docs/backend-setup.md` for credentials.

## Documentation

| File | Contents |
|------|----------|
| `docs/requirements.md` | Feature scope and user capabilities |
| `docs/roles-and-permissions.md` | Role matrix and security rules |
| `docs/ticket-workflow.md` | Status flow, transitions, ticket numbers |
| `docs/database-design.md` | Table schemas and indexes |
| `docs/api-endpoints.md` | All API routes with request/response shapes |
| `docs/frontend-setup.md` | Client installation and structure |
| `docs/backend-setup.md` | Server installation, Prisma, and seed |
