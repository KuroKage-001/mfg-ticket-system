# Ticket Workflow

## Status Flow

```
OPEN
  |
  v
IN_PROGRESS
  |
  v
RESOLVED
  |
  v
CLOSED
```

## Optional Cancellation

```
OPEN        --> CANCELLED
IN_PROGRESS --> CANCELLED
```

Only an ADMIN can cancel tickets.

## Valid Status Transitions

| From        | To          | Who       |
|-------------|-------------|-----------|
| OPEN        | IN_PROGRESS | ADMIN, EMPLOYEE (assigned) |
| IN_PROGRESS | RESOLVED    | ADMIN, EMPLOYEE (assigned) |
| RESOLVED    | CLOSED      | ADMIN only |
| OPEN        | CANCELLED   | ADMIN only |
| IN_PROGRESS | CANCELLED   | ADMIN only |

## Priority Levels

| Priority | Description                                |
|----------|--------------------------------------------|
| LOW      | Can be handled when time permits           |
| MEDIUM   | Should be addressed within normal schedule |
| HIGH     | Needs prompt attention                     |
| URGENT   | Requires immediate action                  |

Only ADMINs can change ticket priority.

## Ticket Number Format

Tickets receive a human-readable reference number:

```
MFG-2026-000001
MFG-2026-000002
MFG-2026-000003
```

Format: `MFG-{YEAR}-{SEQUENCE padded to 6 digits}`

The numeric `id` remains the database primary key.
`ticketNumber` is the human-readable reference only.

## Ticket Categories (V1)

- Hardware
- Software
- Network
- Access Request
- Account Issue
- Other

## Ticket Lifecycle Example

1. Employee creates ticket → status: OPEN
2. Admin assigns ticket to employee
3. Employee sets status to IN_PROGRESS
4. Employee resolves the issue → status: RESOLVED
5. Admin reviews and closes → status: CLOSED
