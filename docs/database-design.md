# Database Design

## Database

- Name: `db_mfg_ticket_system`
- Charset: `utf8mb4`
- Collation: `utf8mb4_unicode_ci`
- Engine: MySQL / MariaDB (XAMPP)

## Tables

Tables are managed by Prisma migrations. Do not create or alter them manually in phpMyAdmin.

### `users`

| Column        | Type         | Notes                          |
|---------------|--------------|--------------------------------|
| id            | INT PK AI    | Primary key                    |
| full_name     | VARCHAR(100) | Display name                   |
| email         | VARCHAR(191) | Unique login identifier        |
| password_hash | VARCHAR(255) | bcrypt hash — never plain text |
| role          | ENUM         | ADMIN \| EMPLOYEE              |
| is_active     | BOOLEAN      | Default true                   |
| created_at    | DATETIME     | Auto-set on insert             |
| updated_at    | DATETIME     | Auto-updated on change         |

### `tickets`

| Column         | Type         | Notes                             |
|----------------|--------------|-----------------------------------|
| id             | INT PK AI    | Primary key                       |
| ticket_number  | VARCHAR(30)  | Unique, e.g. MFG-2026-000001      |
| title          | VARCHAR(200) |                                   |
| description    | TEXT         |                                   |
| category       | VARCHAR(100) |                                   |
| priority       | ENUM         | LOW \| MEDIUM \| HIGH \| URGENT   |
| status         | ENUM         | OPEN \| IN_PROGRESS \| RESOLVED \| CLOSED \| CANCELLED |
| created_by_id  | INT FK       | → users.id                        |
| assigned_to_id | INT FK NULL  | → users.id (nullable)             |
| resolved_at    | DATETIME NULL|                                   |
| closed_at      | DATETIME NULL|                                   |
| created_at     | DATETIME     |                                   |
| updated_at     | DATETIME     |                                   |

### `ticket_comments`

| Column     | Type      | Notes               |
|------------|-----------|---------------------|
| id         | INT PK AI |                     |
| content    | TEXT      |                     |
| ticket_id  | INT FK    | → tickets.id        |
| author_id  | INT FK    | → users.id          |
| created_at | DATETIME  |                     |

### `ticket_activities`

| Column     | Type          | Notes                          |
|------------|---------------|--------------------------------|
| id         | INT PK AI     |                                |
| action     | VARCHAR(100)  | e.g. STATUS_CHANGED            |
| old_value  | TEXT NULL     | Previous value                 |
| new_value  | TEXT NULL     | New value                      |
| ticket_id  | INT FK        | → tickets.id                   |
| actor_id   | INT FK        | → users.id (who performed it)  |
| created_at | DATETIME      |                                |

### `_prisma_migrations`

Managed automatically by Prisma. Do not modify.

## Indexes

- `tickets`: status, priority, created_by_id, assigned_to_id, created_at
- `ticket_comments`: ticket_id, author_id
- `ticket_activities`: ticket_id, actor_id

## Notes

- Deleting users is avoided. Use `is_active = false` instead.
- Deleting tickets is avoided in V1. Use CANCELLED status instead.
- Comments and activities are cascade-deleted if a ticket is deleted.
