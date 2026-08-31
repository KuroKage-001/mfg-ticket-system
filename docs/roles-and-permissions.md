# Roles and Permissions

## Roles

| Role     | Description                                      |
|----------|--------------------------------------------------|
| ADMIN    | Full access to all features and all tickets      |
| EMPLOYEE | Limited access; manages only assigned tickets    |

## Authentication Rules

- No public registration endpoint exists.
- Only an ADMIN can create new user accounts via `POST /api/users`.
- Inactive users (`isActive: false`) cannot log in.
- Sessions use secure HTTP-only cookies.

## Ticket Permissions

| Action                          | ADMIN | EMPLOYEE                        |
|---------------------------------|-------|---------------------------------|
| Create ticket                   | ✅    | ✅                              |
| View all tickets                | ✅    | ✅ (team view)                  |
| View ticket details             | ✅    | ✅                              |
| Assign ticket to employee       | ✅    | ❌                              |
| Change ticket priority          | ✅    | ❌                              |
| Update any ticket               | ✅    | ❌                              |
| Update assigned ticket          | ✅    | ✅ (own assigned only)          |
| Change status to IN_PROGRESS    | ✅    | ✅ (own assigned only)          |
| Change status to RESOLVED       | ✅    | ✅ (own assigned only)          |
| Close a resolved ticket         | ✅    | ❌                              |
| Cancel a ticket                 | ✅    | ❌                              |
| Add comments                    | ✅    | ✅                              |

## User Management Permissions

| Action                          | ADMIN | EMPLOYEE |
|---------------------------------|-------|----------|
| Create user accounts            | ✅    | ❌       |
| View user list                  | ✅    | ❌       |
| Edit user accounts              | ✅    | ❌       |
| Activate / deactivate accounts  | ✅    | ❌       |

## Security Notes

- Role checks are enforced server-side on every API request.
- Hiding UI elements in React is not security — the Next.js server validates roles for every protected endpoint.
- Passwords are hashed using bcrypt. Plain-text passwords are never stored or returned.
- The `passwordHash` field is never included in API responses.
