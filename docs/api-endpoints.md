# API Endpoints

Base URL: `http://localhost:3000/api`

All protected routes require an authenticated session cookie.
Role-based access is enforced server-side.

---

## Health

### `GET /api/health`

Verifies that Next.js is running, Prisma can connect, and the database is reachable.

**Auth required:** No  
**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-08-28T00:00:00.000Z"
}
```

---

## Authentication

### `POST /api/auth/login`

**Auth required:** No  
**Body:**
```json
{
  "email": "admin@mfg.local",
  "password": "plaintext-password"
}
```
**Response:** Sets HTTP-only session cookie. Returns user object (no passwordHash).

---

### `POST /api/auth/logout`

**Auth required:** Yes  
**Response:** Clears session cookie.

---

### `GET /api/auth/me`

**Auth required:** Yes  
**Response:** Current authenticated user object.

---

## Users

### `GET /api/users`

**Auth required:** Yes — ADMIN only  
**Query params:** `page`, `limit`, `search`, `role`, `isActive`  
**Response:** Paginated user list.

---

### `POST /api/users`

**Auth required:** Yes — ADMIN only  
**Body:**
```json
{
  "fullName": "Jane Smith",
  "email": "jane@mfg.local",
  "password": "temporary-password",
  "role": "EMPLOYEE",
  "isActive": true
}
```

---

### `GET /api/users/:id`

**Auth required:** Yes — ADMIN only  
**Response:** Single user object.

---

### `PATCH /api/users/:id`

**Auth required:** Yes — ADMIN only  
**Body:** Any subset of `fullName`, `email`, `role`, `isActive`, `password`

---

## Tickets

### `GET /api/tickets`

**Auth required:** Yes  
**Query params:** `page`, `limit`, `status`, `priority`, `search`, `assignedToId`  
**Notes:** ADMINs see all tickets. EMPLOYEEs see all tickets (team view) but can only act on their own.

---

### `POST /api/tickets`

**Auth required:** Yes  
**Body:**
```json
{
  "title": "Printer not working",
  "description": "The printer on floor 2 is offline.",
  "category": "Hardware",
  "priority": "MEDIUM",
  "assignedToId": 3
}
```
`assignedToId` is optional and ADMIN-only.

---

### `GET /api/tickets/:id`

**Auth required:** Yes  
**Response:** Full ticket with creator, assignee, comments, and activities.

---

### `PATCH /api/tickets/:id`

**Auth required:** Yes — ADMIN only for priority/assignee changes  
**Body:** Any subset of `title`, `description`, `category`, `priority`

---

### `POST /api/tickets/:id/assign`

**Auth required:** Yes — ADMIN only  
**Body:**
```json
{ "assignedToId": 3 }
```

---

### `POST /api/tickets/:id/status`

**Auth required:** Yes  
**Body:**
```json
{ "status": "IN_PROGRESS" }
```
Status transition rules are enforced server-side.

---

### `POST /api/tickets/:id/comments`

**Auth required:** Yes  
**Body:**
```json
{ "content": "Checked the device. Ordering a replacement part." }
```

---

## Dashboard

### `GET /api/dashboard/summary`

**Auth required:** Yes  
**Response:**
```json
{
  "open": 12,
  "inProgress": 5,
  "resolved": 8,
  "closed": 34,
  "urgent": 2,
  "unassigned": 4,
  "myAssigned": 3,
  "recentTickets": []
}
```
`myAssigned` returns the count for the currently authenticated user.
