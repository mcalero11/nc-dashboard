<div align="center">

# NC Dashboard Web

Next.js frontend — timer UI, charts, time entry management, and Google Sheets integration.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

<p>
  <a href="#features">Features</a> &bull;
  <a href="#getting-started">Getting started</a> &bull;
  <a href="#project-structure">Structure</a> &bull;
  <a href="#pages-and-routing">Routing</a> &bull;
  <a href="#key-components">Components</a> &bull;
  <a href="#tech-stack">Tech stack</a>
</p>

</div>

## Features

- **Start/stop timer** — Client-side timer persisted to localStorage, with project selection and confirmation dialog
- **Time entry management** — Create, edit, and delete entries with inline editing in a responsive table
- **Interactive charts** — Weekly hours bar chart and project distribution pie chart via Recharts
- **Resource allocation comparison** — Side-by-side view of logged hours vs. OPS-planned allocation per project
- **Automatic sheet discovery** — Guided setup flow that auto-discovers and connects the user's Google Sheet
- **Week navigation** — Browse current and past weeks with optimistic updates
- **API proxy** — Rewrites `/api/*` requests to the backend in development and Docker
- **Auth-aware routing** — Server-side session validation with automatic redirects and silent token refresh

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v10+
- The API server running at `http://localhost:3001` (see [`apps/api/README.md`](../api/README.md))

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

| Variable              | Description                                                                     |
| --------------------- | ------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Public API base URL for client-side requests (e.g. `http://localhost:3001/api`) |
| `API_INTERNAL_URL`    | Internal API URL used by the proxy in Docker (e.g. `http://api:3001`)           |

> [!TIP]
> In development, only `NEXT_PUBLIC_API_URL` is needed. `API_INTERNAL_URL` is for Docker Compose where containers use internal DNS.

### 3. Start development server

```bash
pnpm dev
```

The app runs at `http://localhost:3000` with Turbopack for fast refresh.

> [!NOTE]
> The frontend proxies all `/api/*` requests to the backend. You can access the API through `http://localhost:3000/api` in development.

## Project structure

```
src/
├── app/                        # Next.js App Router
│   ├── (dashboard)/            # Authenticated dashboard layout group
│   │   ├── dashboard/          # Main dashboard page
│   │   ├── layout.tsx          # Auth-guarded layout with header
│   │   └── not-found.tsx
│   ├── setup/                  # Sheet connection setup wizard
│   ├── api/auth/session/       # Server-side session refresh route
│   ├── layout.tsx              # Root layout (providers, fonts)
│   └── page.tsx                # Login page
├── components/
│   ├── allocation/             # OPS allocation comparison
│   ├── auth/                   # Google sign-in button
│   ├── charts/                 # Weekly hours + project distribution charts
│   ├── entries/                # Time entry table, rows, forms, dialogs
│   ├── layout/                 # Dashboard header, user menu, status
│   ├── projects/               # Project selector
│   ├── setup/                  # Sheet discovery, selector, manual input
│   ├── shared/                 # Reusable: week selector, loading, etc.
│   ├── timer/                  # Timer display, controls, confirmation
│   └── ui/                     # shadcn/ui primitives
├── hooks/                      # Custom React hooks
├── lib/                        # Utilities (API client, auth, dates, charts)
├── providers/                  # Context providers (query client, pending sync)
└── types/                      # TypeScript type definitions
```

## Pages and routing

| Route        | Auth | Description                                                                |
| ------------ | ---- | -------------------------------------------------------------------------- |
| `/`          | No   | Login page with Google sign-in; redirects to `/dashboard` if authenticated |
| `/setup`     | Yes  | Sheet connection wizard; auto-discovers or accepts manual URL input        |
| `/dashboard` | Yes  | Main dashboard: timer, charts, entries table, allocation comparison        |

> [!NOTE]
> The `(dashboard)` route group wraps authenticated pages with a shared layout that validates the session server-side and redirects to login if expired.

## Key components

- **Timer** (`components/timer/`) — Full-featured start/stop timer with project selection, live elapsed display, and a confirmation dialog before saving. State persists across page reloads via localStorage.

- **Entries table** (`components/entries/`) — Displays the week's time entries in a responsive table with inline edit and delete. Uses optimistic updates and job polling via TanStack Query.

- **Charts** (`components/charts/`) — `WeeklyHoursChart` shows a stacked bar chart of daily hours, `ProjectDistributionChart` shows a pie chart of hours per project. Charts support click-to-filter interactions.

- **Allocation comparison** (`components/allocation/`) — Compares logged hours against OPS-planned allocations, surfacing per-project utilization with status badges (on track, approaching, over budget).

- **Setup wizard** (`components/setup/`) — Multi-step flow: auto-discover sheets via Drive API, present selection if multiple found, or accept a manual Google Sheets URL.

## Tech stack

| Layer         | Technology                                                                |
| ------------- | ------------------------------------------------------------------------- |
| Framework     | [Next.js](https://nextjs.org/) 16 (App Router, Turbopack)                 |
| UI            | [React](https://react.dev/) 19                                            |
| Styling       | [Tailwind CSS](https://tailwindcss.com/) v4                               |
| Components    | [shadcn/ui](https://ui.shadcn.com/) + [Lucide](https://lucide.dev/) icons |
| Data fetching | [TanStack Query](https://tanstack.com/query) v5                           |
| Charts        | [Recharts](https://recharts.org/) 2                                       |
| Notifications | [Sonner](https://sonner.emilkowal.dev/)                                   |
| Date utils    | [date-fns](https://date-fns.org/)                                         |
| Testing       | [Vitest](https://vitest.dev/) 4                                           |
| Linting       | ESLint 9 + eslint-config-next                                             |

## Scripts

| Command      | Description                                  |
| ------------ | -------------------------------------------- |
| `pnpm dev`   | Start dev server with Turbopack on port 3000 |
| `pnpm build` | Production build                             |
| `pnpm start` | Start production server                      |
| `pnpm lint`  | Run ESLint                                   |
| `pnpm test`  | Run Vitest tests                             |
