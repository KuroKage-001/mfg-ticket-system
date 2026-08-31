# Requirements

## Project Overview

A manufacturing ticket management system for tracking and resolving internal issues.
Built with React + Vite (client), Next.js API routes (server), and MySQL/MariaDB via Prisma ORM.

## System Architecture

```
React Client          http://localhost:5173
        |
        | HTTP API requests (fetch with credentials)
        v
Next.js Server        http://localhost:3000/api
        |
        | Prisma ORM
        v
MySQL/MariaDB         localhost:3306
Database:             db_mfg_ticket_system
        |
        | (managed via)
        v
phpMyAdmin            http://localhost/phpmyadmin
```

## User Roles

```typescript
export type UserRole = "ADMIN" | "EMPLOYEE";
```

Only two roles exist. There is no public registration. Only an administrator can create accounts.

## Administrator Capabilities

- Log in
- Create employee accounts
- View employee accounts
- Edit employee accounts
- Activate or deactivate accounts
- Create tickets
- View all tickets
- Assign tickets to employees
- Change ticket priority
- Change ticket status
- View dashboard totals

## Employee Capabilities

- Log in
- View the dashboard
- Create a ticket
- View team tickets
- View ticket details
- View assigned tickets
- Add comments
- Update assigned ticket status
- Log out

## Version Scope (V1)

This first version focuses on a complete login-to-ticket workflow.
Advanced features such as charts, email notifications, attachments, and report exports
are deferred until the core workflow is verified end-to-end.
