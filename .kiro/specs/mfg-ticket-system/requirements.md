# Requirements Document

## Introduction

The Manufacturing Ticket System (MFG Ticket System) is an internal web application for tracking and resolving manufacturing-related issues. It provides a structured workflow where employees report problems as tickets, administrators manage assignments and priorities, and the team collaborates through comments and status updates until tickets are resolved and closed.

The system is built with a React + Vite client (TypeScript) at `http://localhost:5173`, a Next.js API server (TypeScript) at `http://localhost:3000/api`, and a MySQL/MariaDB database (`db_mfg_ticket_system`) managed via Prisma ORM.

V1 scope covers the complete login-to-ticket workflow. Charts, email notifications, file attachments, and report exports are deferred.

---

## Glossary

- **System**: The Manufacturing Ticket System as a whole.
- **Server**: The Next.js API server running at `http://localhost:3000/api`.
- **Client**: The React + Vite frontend running at `http://localhost:5173`.
- **API**: The set of HTTP endpoints exposed by the Server.
- **Auth_Service**: The server-side module responsible for authentication and session management.
- **User_Service**: The server-side module responsible for user account management.
- **Ticket_Service**: The server-side module responsible for ticket lifecycle management.
- **Dashboard_Service**: The server-side module responsible for aggregating summary statistics.
- **Activity_Logger**: The server-side module that records ticket activity entries.
- **Session**: An authenticated user context stored in an HTTP-only cookie.
- **ADMIN**: A user with the ADMIN role; has full access to all features.
- **EMPLOYEE**: A user with the EMPLOYEE role; limited to team-visible tickets and their own assigned tickets.
- **Ticket**: A record describing a manufacturing issue, identified by a unique ticket number.
- **Ticket_Number**: A human-readable identifier in the format `MFG-{YEAR}-{SEQUENCE}` where SEQUENCE is zero-padded to 6 digits (e.g., `MFG-2026-000001`).
- **Priority**: An enumerated severity level: `LOW`, `MEDIUM`, `HIGH`, or `URGENT`.
- **Status**: An enumerated lifecycle state: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, or `CANCELLED`.
- **Category**: A classification label for a ticket: `Hardware`, `Software`, `Network`, `Access Request`, `Account Issue`, or `Other`.
- **Comment**: A text entry attached to a ticket by any authenticated user.
- **Activity**: An immutable audit record describing a change made to a ticket (e.g., status change, assignment change).
- **Password_Hash**: The bcrypt-hashed representation of a user's password; never returned in API responses.
- **Dashboard**: The summary view presenting ticket counts by status, priority, and assignment.

---

## Requirements

---

### Requirement 1: User Authentication

**User Story:** As a user (ADMIN or EMPLOYEE), I want to log in with my email and password, so that I can access the system securely and perform actions appropriate to my role.

#### Acceptance Criteria

1. WHEN a user submits a well-formed email and a non-empty password matching an active account, THE Auth_Service SHALL create a Session, set an HTTP-only session cookie, and return the authenticated user object (excluding Password_Hash) with HTTP 200.
2. WHEN a user submits a login request where either the email does not match any account or the password does not match the stored Password_Hash, THE Auth_Service SHALL return an HTTP 401 response with a generic error message that does not distinguish which credential failed, to prevent credential enumeration.
3. WHEN a user submits valid credentials for an account where `is_active` is false, THE Auth_Service SHALL return an HTTP 403 response indicating the account is inactive.
4. WHEN an authenticated user sends a logout request, THE Auth_Service SHALL invalidate the Session and clear the HTTP-only session cookie, returning HTTP 200.
5. WHEN an unauthenticated request is made to any protected API endpoint, THE Server SHALL return an HTTP 401 response.
6. THE Auth_Service SHALL never include Password_Hash in any API response under any circumstance.
7. WHEN a user submits a login request with a missing or empty `email` field or a missing or empty `password` field, THE Auth_Service SHALL return an HTTP 400 response specifying which field is missing or empty.
8. WHEN an authenticated user requests `GET /api/auth/me` and the Session is valid and unexpired, THE Auth_Service SHALL return the current user object (excluding Password_Hash) with HTTP 200.
9. IF the session cookie is absent, expired, or invalid when `GET /api/auth/me` is requested, THEN THE Auth_Service SHALL return an HTTP 401 response.
10. THE Auth_Service SHALL expire Sessions after a defined inactivity period; WHEN a request is made using an expired Session, THE Server SHALL return an HTTP 401 response and clear the session cookie.

---

### Requirement 2: User Account Management (Admin)

**User Story:** As an ADMIN, I want to create and manage employee accounts, so that I can control who has access to the system.

#### Acceptance Criteria

1. THE User_Service SHALL restrict all user management endpoints (`GET /api/users`, `POST /api/users`, `GET /api/users/:id`, `PATCH /api/users/:id`) to requests authenticated as ADMIN.
2. WHEN an ADMIN submits a valid create-user request with `fullName` (1–100 characters), `email` (valid format, ≤191 characters), `password` (≥8 characters), `role` (ADMIN or EMPLOYEE), and `isActive` (boolean), THE User_Service SHALL create the account, store a bcrypt Password_Hash, and return the new user object (excluding Password_Hash) with HTTP 201.
3. WHEN an ADMIN submits a create-user request with an email that already exists in the system, THE User_Service SHALL return an HTTP 409 response with a conflict error identifying the duplicate field.
4. WHEN an ADMIN submits a create-user request with a missing required field or a field that fails validation (fullName empty or >100 chars, email malformed or >191 chars, password <8 chars, role not ADMIN|EMPLOYEE), THE User_Service SHALL return an HTTP 400 response identifying the specific invalid field.
5. WHEN an ADMIN requests a paginated user list via `GET /api/users`, THE User_Service SHALL return a paginated response containing user records (excluding Password_Hash), total count, current page, and page size; default page is 1 and default limit is 20; maximum limit is 100.
6. WHERE the `search` query parameter is provided (1–100 characters), THE User_Service SHALL filter the user list to records whose `full_name` or `email` contains the search string (case-insensitive).
7. WHERE the `role` query parameter is provided, THE User_Service SHALL filter the user list to records matching the specified role; IF an invalid role value is supplied, THEN THE User_Service SHALL return HTTP 400.
8. WHERE the `isActive` query parameter is provided, THE User_Service SHALL filter the user list to records matching the specified active state; IF a non-boolean value is supplied, THEN THE User_Service SHALL return HTTP 400.
9. WHEN an ADMIN requests a specific user by ID via `GET /api/users/:id`, THE User_Service SHALL return the user object (excluding Password_Hash) for that ID, or HTTP 404 if no such user exists.
10. WHEN an ADMIN submits a `PATCH /api/users/:id` request containing one or more of `fullName`, `email`, `role`, `isActive`, or `password`, THE User_Service SHALL update only the supplied fields (applying the same validation bounds as creation) and return the updated user object (excluding Password_Hash); IF the request body is empty or contains no recognised fields, THEN THE User_Service SHALL return HTTP 400.
11. WHEN an ADMIN sets `isActive` to false for a user account via `PATCH /api/users/:id`, THE User_Service SHALL deactivate the account so subsequent login attempts for that account are rejected.
12. WHEN an ADMIN updates a user's password via `PATCH /api/users/:id`, THE User_Service SHALL store only the bcrypt Password_Hash of the new password.
13. WHEN an ADMIN updates a user's email to an address already held by another account, THE User_Service SHALL return HTTP 409 identifying the duplicate email.
14. IF a non-ADMIN authenticated user sends a request to any user management endpoint, THEN THE Server SHALL return an HTTP 403 response.

---

### Requirement 3: Ticket Creation

**User Story:** As any authenticated user (ADMIN or EMPLOYEE), I want to create a ticket, so that I can report a manufacturing issue for tracking and resolution.

#### Acceptance Criteria

1. WHEN an authenticated user submits a valid create-ticket request with `title` (1–200 characters), `description` (1–5000 characters), `category`, and `priority`, THE Ticket_Service SHALL create a ticket with Status `OPEN`, assign the authenticated user as `created_by_id`, generate a unique Ticket_Number in the format `MFG-{YEAR}-{SEQUENCE}`, and return the ticket object with HTTP 201.
2. THE Ticket_Service SHALL generate Ticket_Number values where SEQUENCE is zero-padded to 6 digits, starts at 000001 at the beginning of each calendar year, and increments sequentially per year (e.g., `MFG-2026-000001`, `MFG-2026-000002`).
3. WHEN a create-ticket request is submitted with a missing field, an empty field, or a field that exceeds its length bound (`title` >200 chars, `description` >5000 chars), THE Ticket_Service SHALL return an HTTP 400 response identifying the specific invalid or missing field.
4. WHEN a create-ticket request includes a valid `assignedToId` and the requester is ADMIN, THE Ticket_Service SHALL set the `assigned_to_id` to the specified user ID, provided that user exists and `is_active` is true.
5. IF a create-ticket request includes an `assignedToId` and the requester is ADMIN but the referenced user does not exist or is inactive, THEN THE Ticket_Service SHALL return an HTTP 400 response indicating the assignee is invalid; the ticket SHALL NOT be created.
6. IF a create-ticket request includes an `assignedToId` field and the requester is EMPLOYEE, THEN THE Ticket_Service SHALL ignore the `assignedToId` field and create the ticket without an assignee.
7. WHEN a ticket is created, THE Activity_Logger SHALL record an activity entry with `action = TICKET_CREATED`, `new_value = ticket_number`, and the authenticated actor as `actor_id`.
8. WHEN a ticket is created, THE Ticket_Service SHALL accept only these `category` values: `Hardware`, `Software`, `Network`, `Access Request`, `Account Issue`, or `Other`; IF an invalid category is submitted, THEN THE Ticket_Service SHALL return an HTTP 400 response.
9. WHEN a ticket is created, THE Ticket_Service SHALL accept only these `priority` values: `LOW`, `MEDIUM`, `HIGH`, or `URGENT`; IF an invalid priority value is submitted, THEN THE Ticket_Service SHALL return an HTTP 400 response.

---

### Requirement 4: Ticket Viewing and Listing

**User Story:** As an authenticated user, I want to view a list of tickets and their details, so that I can stay informed about the state of manufacturing issues.

#### Acceptance Criteria

1. WHEN an ADMIN requests `GET /api/tickets`, THE Ticket_Service SHALL return all tickets in the system in a paginated response.
2. WHEN an EMPLOYEE requests `GET /api/tickets`, THE Ticket_Service SHALL return all tickets in the system in a paginated response; write actions (assign, priority change, status transitions outside OPEN→IN_PROGRESS and IN_PROGRESS→RESOLVED) SHALL be rejected for tickets not assigned to that EMPLOYEE.
3. WHEN an authenticated user requests `GET /api/tickets/:id`, THE Ticket_Service SHALL return the full ticket object including creator details, assignee details, all Comments, and all Activities for that ticket, or HTTP 404 if no such ticket exists.
4. WHERE the `status` query parameter is provided on `GET /api/tickets`, THE Ticket_Service SHALL filter results to tickets matching the specified Status value; IF an unrecognised status value is supplied, THEN THE Ticket_Service SHALL return HTTP 400.
5. WHERE the `priority` query parameter is provided on `GET /api/tickets`, THE Ticket_Service SHALL filter results to tickets matching the specified Priority value; IF an unrecognised priority value is supplied, THEN THE Ticket_Service SHALL return HTTP 400.
6. WHERE the `search` query parameter is provided on `GET /api/tickets`, THE Ticket_Service SHALL filter results to tickets whose `title` or `ticket_number` contains the search string (case-insensitive).
7. WHERE the `assignedToId` query parameter is provided on `GET /api/tickets`, THE Ticket_Service SHALL filter results to tickets assigned to the specified user ID.
8. THE Ticket_Service SHALL support `page` and `limit` query parameters on `GET /api/tickets`; default page is 1 and default limit is 20; maximum limit is 100; responses SHALL include `total`, `page`, and `limit` metadata alongside paginated results.
9. WHEN multiple filter parameters are provided simultaneously on `GET /api/tickets`, THE Ticket_Service SHALL apply all filters with AND logic, returning only tickets that satisfy every supplied condition.
10. IF an unauthenticated request is made to `GET /api/tickets` or `GET /api/tickets/:id`, THEN THE Server SHALL return an HTTP 401 response.

---

### Requirement 5: Ticket Assignment (Admin)

**User Story:** As an ADMIN, I want to assign tickets to employees, so that responsibility for resolving issues is clearly allocated.

#### Acceptance Criteria

1. WHEN an ADMIN sends `POST /api/tickets/:id/assign` with an `assignedToId` referencing an existing, active user with role EMPLOYEE, THE Ticket_Service SHALL update `assigned_to_id` to the specified user ID and return the updated ticket object.
2. IF an ADMIN sends an assign request with an `assignedToId` referencing a non-existent user, THEN THE Ticket_Service SHALL return an HTTP 404 response.
3. IF an ADMIN sends an assign request with an `assignedToId` referencing an inactive user, THEN THE Ticket_Service SHALL return an HTTP 422 response with an error message indicating the user is inactive.
4. IF an ADMIN sends an assign request with an `assignedToId` referencing a user with role ADMIN, THEN THE Ticket_Service SHALL return an HTTP 422 response with an error message indicating only EMPLOYEE users may be assigned.
5. IF an ADMIN sends an assign request for a ticket ID that does not exist, THEN THE Ticket_Service SHALL return an HTTP 404 response.
6. IF an ADMIN sends an assign request on a ticket with status CLOSED or CANCELLED, THEN THE Ticket_Service SHALL return an HTTP 422 response indicating the ticket is in a terminal state.
7. WHEN a ticket assignment changes, THE Activity_Logger SHALL record an activity entry with `action = ASSIGNMENT_CHANGED`, `old_value` set to the previous `assigned_to_id` (or null if previously unassigned), `new_value` set to the new `assigned_to_id`, and `actor_id` set to the ADMIN performing the action.
8. IF a non-ADMIN authenticated user sends `POST /api/tickets/:id/assign`, THEN THE Server SHALL return an HTTP 403 response.

---

### Requirement 6: Ticket Priority Management (Admin)

**User Story:** As an ADMIN, I want to change the priority of a ticket, so that the team focuses effort appropriately on the most critical issues.

#### Acceptance Criteria

1. WHEN an ADMIN sends `PATCH /api/tickets/:id` with a `priority` value of `LOW`, `MEDIUM`, `HIGH`, or `URGENT`, THE Ticket_Service SHALL update the ticket's priority and return the updated ticket object.
2. WHEN a priority change is made, THE Activity_Logger SHALL record an activity entry with `action = PRIORITY_CHANGED`, the previous priority as `old_value`, the new priority as `new_value`, and `actor_id` set to the ADMIN performing the action.
3. IF a non-ADMIN authenticated user includes `priority` in a `PATCH /api/tickets/:id` request, THEN THE Server SHALL return an HTTP 403 response.
4. IF an ADMIN submits a `priority` value that is not one of `LOW`, `MEDIUM`, `HIGH`, or `URGENT` in `PATCH /api/tickets/:id`, THEN THE Ticket_Service SHALL return an HTTP 400 response.
5. IF an unauthenticated request includes `priority` in a `PATCH /api/tickets/:id` request, THEN THE Server SHALL return an HTTP 401 response.
6. IF an ADMIN sends a priority change request for a ticket ID that does not exist, THEN THE Ticket_Service SHALL return an HTTP 404 response.

---

### Requirement 7: Ticket Status Transitions

**User Story:** As an authorized user, I want to update the status of a ticket, so that the ticket's lifecycle accurately reflects the current state of the manufacturing issue.

#### Acceptance Criteria

1. WHEN an ADMIN or the assigned EMPLOYEE sends `POST /api/tickets/:id/status` with `{ "status": "IN_PROGRESS" }` on a ticket in `OPEN` status, THE Ticket_Service SHALL transition the ticket to `IN_PROGRESS` and return the updated ticket object.
2. WHEN an ADMIN or the assigned EMPLOYEE sends `POST /api/tickets/:id/status` with `{ "status": "RESOLVED" }` on a ticket in `IN_PROGRESS` status, THE Ticket_Service SHALL transition the ticket to `RESOLVED`, set `resolved_at` to the current UTC timestamp, and return the updated ticket object.
3. WHEN an ADMIN sends `POST /api/tickets/:id/status` with `{ "status": "CLOSED" }` on a ticket in `RESOLVED` status, THE Ticket_Service SHALL transition the ticket to `CLOSED`, set `closed_at` to the current UTC timestamp, and return the updated ticket object.
4. WHEN an ADMIN sends `POST /api/tickets/:id/status` with `{ "status": "CANCELLED" }` on a ticket in `OPEN` or `IN_PROGRESS` status, THE Ticket_Service SHALL transition the ticket to `CANCELLED` and return the updated ticket object.
5. IF a status transition request is made for a combination of current status and requested status that is not listed in criteria 1–4, THEN THE Ticket_Service SHALL return an HTTP 422 response whose body includes the ticket's current status and the list of valid target statuses from that status.
6. IF a non-ADMIN EMPLOYEE sends a status transition request on a ticket not assigned to them, THEN THE Ticket_Service SHALL return an HTTP 403 response.
7. IF a non-ADMIN EMPLOYEE sends a status transition request with `status` of `CLOSED` or `CANCELLED`, THEN THE Ticket_Service SHALL return an HTTP 403 response regardless of whether the ticket is assigned to them.
8. WHEN a status transition is performed, THE Activity_Logger SHALL record an activity entry with `action = STATUS_CHANGED`, the previous Status as `old_value`, the new Status as `new_value`, and `actor_id` set to the user performing the transition.
9. IF a status transition request references a ticket ID that does not exist, THEN THE Ticket_Service SHALL return an HTTP 404 response.
10. IF an unauthenticated request is made to `POST /api/tickets/:id/status`, THEN THE Server SHALL return an HTTP 401 response.

---

### Requirement 8: Ticket Editing (Admin)

**User Story:** As an ADMIN, I want to edit a ticket's title, description, and category, so that ticket information remains accurate as an issue evolves.

#### Acceptance Criteria

1. WHEN an ADMIN sends `PATCH /api/tickets/:id` with one or more of `title` (1–200 characters), `description` (1–5000 characters), or `category` (valid enum value), THE Ticket_Service SHALL update only the supplied fields whose values differ from the current values and return the updated ticket object.
2. WHEN a ticket field is updated, THE Activity_Logger SHALL record an activity entry with `action = FIELD_UPDATED` for each field whose value actually changed, with the previous value as `old_value`, the new value as `new_value`, and `actor_id` set to the ADMIN performing the update; fields submitted with unchanged values SHALL NOT generate activity entries.
3. IF an ADMIN submits a `PATCH /api/tickets/:id` request with an invalid `category` value, a `title` or `description` that violates length bounds, or a request body that is empty or contains no recognised fields, THEN THE Ticket_Service SHALL return an HTTP 400 response identifying the specific invalid field or reason.
4. IF a non-ADMIN authenticated user includes `title`, `description`, or `category` in a `PATCH /api/tickets/:id` request, THEN THE Server SHALL return an HTTP 403 response.
5. IF an unauthenticated request is made to `PATCH /api/tickets/:id`, THEN THE Server SHALL return an HTTP 401 response.
6. IF an ADMIN sends a `PATCH /api/tickets/:id` request for a ticket ID that does not exist, THEN THE Ticket_Service SHALL return an HTTP 404 response.

---

### Requirement 9: Ticket Comments

**User Story:** As an authenticated user, I want to add comments to a ticket, so that I can communicate updates, findings, and context to the team.

#### Acceptance Criteria

1. WHEN an authenticated user sends `POST /api/tickets/:id/comments` with a non-empty `content` string (1–5000 characters), THE Ticket_Service SHALL create a Comment associated with the ticket and the authenticated author, and return the new Comment object with HTTP 201.
2. IF a comment creation request is submitted with an empty, missing, or oversized (>5000 characters) `content` field, THEN THE Ticket_Service SHALL return an HTTP 400 response.
3. IF a comment creation request references a ticket ID that does not exist, THEN THE Ticket_Service SHALL return an HTTP 404 response.
4. WHEN an authenticated user requests `GET /api/tickets/:id`, THE Ticket_Service SHALL include all Comments for that ticket ordered by `created_at` ascending.
5. WHEN a Comment is successfully created, THE Activity_Logger SHALL record an activity entry with `action = COMMENT_ADDED`, `new_value` set to the comment ID, and `actor_id` set to the authenticated author.
6. IF an unauthenticated request is made to `POST /api/tickets/:id/comments`, THEN THE Server SHALL return an HTTP 401 response.
7. IF an authenticated user attempts to add a comment to a ticket whose status is `CLOSED` or `CANCELLED`, THEN THE Ticket_Service SHALL return an HTTP 422 response indicating the ticket is in a terminal state and no longer accepts comments.

---

### Requirement 10: Ticket Activity Log

**User Story:** As an authenticated user, I want to view the activity history of a ticket, so that I can understand the sequence of changes that have been made.

#### Acceptance Criteria

1. WHEN any of the following occurs on a ticket — ticket creation, status change, priority change, assignment change, field update (title, description, category), or comment addition — THE Activity_Logger SHALL append an immutable Activity record containing the `action` type, `old_value` (null for creation and comment events), `new_value`, `actor_id`, and `created_at` timestamp.
2. WHEN an authenticated user requests `GET /api/tickets/:id`, THE Ticket_Service SHALL include all Activities for that ticket ordered by `created_at` ascending.
3. THE Activity_Logger SHALL NOT allow modification or deletion of existing Activity records.

---

### Requirement 11: Dashboard Summary

**User Story:** As an authenticated user, I want to view a dashboard summary, so that I can quickly understand the current state of all tickets.

#### Acceptance Criteria

1. WHEN an authenticated user requests `GET /api/dashboard/summary`, THE Dashboard_Service SHALL return ticket counts keyed by status: `open` (OPEN), `inProgress` (IN_PROGRESS), `resolved` (RESOLVED), `closed` (CLOSED), and `cancelled` (CANCELLED).
2. WHEN an authenticated user requests `GET /api/dashboard/summary`, THE Dashboard_Service SHALL return the count of tickets with `URGENT` priority as `urgent`.
3. WHEN an authenticated user requests `GET /api/dashboard/summary`, THE Dashboard_Service SHALL return the count of tickets where `assigned_to_id` is null as `unassigned`.
4. WHEN an authenticated user requests `GET /api/dashboard/summary`, THE Dashboard_Service SHALL return the count of tickets assigned to the currently authenticated user as `myAssigned`.
5. WHEN an authenticated user requests `GET /api/dashboard/summary`, THE Dashboard_Service SHALL return a `recentTickets` array containing up to 10 of the most recently created tickets ordered by `created_at` descending; each item SHALL include at minimum `id`, `ticketNumber`, `title`, `status`, `priority`, and `createdAt`.
6. IF an unauthenticated request is made to `GET /api/dashboard/summary`, THEN THE Server SHALL return an HTTP 401 response.
7. IF the database is unavailable when `GET /api/dashboard/summary` is requested, THEN THE Dashboard_Service SHALL return an HTTP 503 response.

---

### Requirement 12: Health Check

**User Story:** As a developer or operator, I want a health endpoint, so that I can verify the server and database are operational.

#### Acceptance Criteria

1. WHEN a request is made to `GET /api/health` and the database is reachable, THE Server SHALL return HTTP 200 with a JSON body containing `status: "ok"`, `database: "connected"`, and `timestamp` in ISO 8601 format.
2. IF the database is unreachable when `GET /api/health` is requested, THEN THE Server SHALL return HTTP 503 with a JSON body containing `status: "error"`, `database: "unreachable"`, and `timestamp` in ISO 8601 format.
3. THE Server SHALL complete the database connectivity check for `GET /api/health` within 5 seconds; IF the check does not complete within that timeout, THEN THE Server SHALL return HTTP 503 with `database: "unreachable"`.

---

### Requirement 13: Server-Side Authorization Enforcement

**User Story:** As a system architect, I want all authorization rules enforced on the server, so that role restrictions cannot be bypassed by client-side manipulation.

#### Acceptance Criteria

1. THE Server SHALL validate the authenticated user's role on every API request that requires authentication or role-based access before processing the request body or applying any business logic.
2. IF the authenticated user's role does not permit the requested operation, THEN THE Server SHALL return HTTP 403 and SHALL NOT process the request body or apply any business logic.
3. THE Server SHALL NOT rely on client-side role indicators (e.g., request headers set by the client) to determine authorization; THE Server SHALL derive the user's role exclusively from the Session.
4. WHILE a user's `is_active` flag is false, THE Auth_Service SHALL reject login requests for that user with HTTP 403; IF an active Session exists for a user whose account is subsequently deactivated, THEN THE Server SHALL invalidate that Session and return HTTP 401 for subsequent requests using it.

---

### Requirement 14: Password Security

**User Story:** As a system architect, I want all passwords stored and verified securely, so that user credentials are protected in the event of a database breach.

#### Acceptance Criteria

1. WHEN a user account is created or a password is updated, THE User_Service SHALL hash the password using bcrypt with a minimum cost factor of 10 before storing it and SHALL store only the resulting Password_Hash.
2. THE System SHALL never return Password_Hash in any API response under any circumstance.
3. WHEN a login attempt is made, THE Auth_Service SHALL verify the submitted password against the stored Password_Hash using bcrypt comparison and SHALL return HTTP 401 if the comparison fails; THE Auth_Service SHALL NOT compare plain-text passwords directly.
4. IF the bcrypt hashing operation fails during account creation or password update, THEN THE User_Service SHALL return HTTP 500 and SHALL NOT persist the user record or updated password.

---

### Requirement 15: Ticket Number Generation

**User Story:** As a user, I want each ticket to have a unique, human-readable reference number, so that I can identify and reference tickets in conversation and documentation.

#### Acceptance Criteria

1. WHEN a ticket is created, THE Ticket_Service SHALL assign a Ticket_Number in the format `MFG-{YEAR}-{SEQUENCE}`, where `{YEAR}` is the 4-digit calendar year of creation, `{SEQUENCE}` is a zero-padded 6-digit integer starting at 000001 at the beginning of each calendar year and incrementing by 1 for each subsequent ticket in that year.
2. THE Ticket_Service SHALL ensure no two tickets share the same Ticket_Number.
3. WHEN multiple tickets are created concurrently, THE Ticket_Service SHALL ensure each receives a distinct Ticket_Number with no sequence collisions.
4. THE Ticket_Service SHALL expose the Ticket_Number (as `ticketNumber`) in all single-ticket and ticket-list API responses.
5. WHEN a ticket is created and assigned a Ticket_Number, THE Ticket_Service SHALL never modify that Ticket_Number for the lifetime of the ticket.
6. IF a ticket creation request would require a SEQUENCE value greater than 999999 within the current calendar year, THEN THE Ticket_Service SHALL return an HTTP 500 response indicating sequence exhaustion.

---

## Correctness Properties

The following properties are suitable for property-based testing against the business logic layers of the Server.

### P1 — Status Transition Invariant (State Machine Completeness)

For any ticket in a valid Status, the set of allowed next statuses is deterministic and conforms exactly to the defined transition table:

| Current Status | Allowed Next Statuses (ADMIN) | Allowed Next Statuses (EMPLOYEE, assigned) |
|---|---|---|
| OPEN | IN_PROGRESS, CANCELLED | IN_PROGRESS |
| IN_PROGRESS | RESOLVED, CANCELLED | RESOLVED |
| RESOLVED | CLOSED | _(none)_ |
| CLOSED | _(none)_ | _(none)_ |
| CANCELLED | _(none)_ | _(none)_ |

**Property:** For all `(currentStatus, requestedStatus, role, isAssigned)` combinations, `isValidTransition(currentStatus, requestedStatus, role, isAssigned)` returns `true` if and only if the combination appears in the transition table above.

**Testing approach:** Property-based test over the full enumerated space of status × status × role × isAssigned (finite, ~100 combinations). No external calls needed — pure function over enums.

---

### P2 — Ticket Number Format Invariant

For every generated Ticket_Number, the string conforms to the pattern `MFG-{YEAR}-{SEQUENCE}` where YEAR is a 4-digit year and SEQUENCE is exactly 6 digits.

**Property:** For all generated ticket numbers `n`, `parseTicketNumber(n)` produces a valid `{ year: number, sequence: number }` pair, and `formatTicketNumber(year, sequence)` round-trips back to `n`.

**Testing approach:** Property-based test — generate arbitrary `(year, sequence)` pairs, format, then parse; assert equivalence. Pure formatter/parser functions.

---

### P3 — Ticket Number Uniqueness Invariant

Given a list of N created tickets, no two tickets share the same Ticket_Number.

**Property:** For any batch of N ticket creation requests processed sequentially, `allUnique(tickets.map(t => t.ticketNumber))` is true.

**Testing approach:** Property-based test over N (1–100), model-based: compare output of optimized implementation against a naive sequential counter. In-memory test, no DB needed.

---

### P4 — Password Hash Round-Trip (Non-Reversibility + Verification)

Hashing a password and then verifying the original password against the hash must succeed; verifying a different password against the hash must fail.

**Property 1 (verification):** For all valid passwords `p`, `bcrypt.compare(p, bcrypt.hash(p)) === true`.  
**Property 2 (non-reversibility):** For all pairs `(p1, p2)` where `p1 ≠ p2`, `bcrypt.compare(p2, bcrypt.hash(p1)) === false`.

**Testing approach:** Property-based test over arbitrary non-empty strings. Pure function over bcrypt — no DB or HTTP needed.

---

### P5 — Authorization Enforcement Completeness

For every protected endpoint and for every role/ownership combination that is NOT authorized, the Server returns HTTP 403 or HTTP 401.

**Property:** For all `(endpoint, method, role, ownership)` tuples where the permission matrix declares access denied, `callEndpoint(endpoint, method, sessionFor(role, ownership)).status` is 403 or 401.

**Testing approach:** Property-based test over the finite enumerated permission matrix. Uses mock session injection — no real DB needed.

---

### P6 — Activity Log Append-Only Invariant

The count of activity records for a ticket never decreases after any operation.

**Property:** For any ticket T and any sequence of valid operations O₁…Oₙ applied to T, `activityCount(T, after Oᵢ₊₁) >= activityCount(T, after Oᵢ)` for all i.

**Testing approach:** Property-based test — generate random valid operation sequences, apply to in-memory ticket model, assert monotonic growth of activity count.

---

### P7 — Pagination Consistency

For any filtered query on `GET /api/tickets` with total count `N`, paginating through all pages with page size `L` yields exactly `N` distinct tickets with no duplicates.

**Property:** `union(page(1, L), page(2, L), …, page(ceil(N/L), L)).length === N` and all ticket IDs are unique.

**Testing approach:** Property-based test over arbitrary `N` (1–200) and `L` (1–50) with an in-memory ticket store mock. Tests pagination logic, not DB.

---

### P8 — Dashboard Count Consistency

The sum of per-status counts in the dashboard response equals the total number of non-cancelled tickets in the system.

**Property:** `open + inProgress + resolved + closed === totalNonCancelledTickets`.

**Testing approach:** Property-based test — generate arbitrary ticket sets with random statuses, compute expected sums, assert against Dashboard_Service output over in-memory mock.
