# Frontend Setup Guide

## Stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS 4
- React Router DOM 7
- react-icons

## Prerequisites

- Node.js v18 or higher
- npm

## Installation

```bash
cd client
npm install
```

## Development

```bash
npm run dev
```

Runs at `http://localhost:5173`

## Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # TypeScript check + Vite build
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # Check TypeScript types only (no build)
```

## Environment Variables

Create `client/.env` (already exists):

```env
VITE_API_URL=http://localhost:3000/api
```

All Vite env vars must be prefixed with `VITE_`.

## TypeScript Patterns Used in This Project

### Component with props

```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function Button({ label, onClick, disabled = false }: ButtonProps): JSX.Element {
  return <button onClick={onClick} disabled={disabled}>{label}</button>;
}
```

### API fetch with credentials (required for session cookies)

```typescript
const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
  credentials: "include",
});
```

### State typing

```typescript
const [user, setUser] = useState<User | null>(null);
```

## Project Source Structure

```
client/src/
├── api/                  API client and per-resource fetch functions
├── components/
│   ├── common/           Reusable UI primitives (Button, Input, Modal…)
│   ├── layout/           AppLayout, Header, Sidebar
│   └── tickets/          Ticket-specific components
├── contexts/             AuthContext
├── pages/
│   ├── auth/             LoginPage
│   ├── dashboard/        DashboardPage
│   ├── tickets/          TicketListPage, CreateTicketPage, TicketDetailsPage
│   ├── admin/            UserListPage, CreateUserPage
│   └── errors/           ForbiddenPage, NotFoundPage
├── routes/               ProtectedRoute, AdminRoute
├── types/                Shared TypeScript types
├── App.tsx
├── main.tsx
└── index.css
```
