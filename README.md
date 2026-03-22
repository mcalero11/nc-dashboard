<div align="center">

# NC Dashboard

Time tracking that syncs to Google Sheets — so you never touch a spreadsheet again.

[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2-EF4444?style=flat-square&logo=turborepo&logoColor=white)](https://turbo.build/)

<p>
  <a href="#overview">Overview</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#getting-started">Getting started</a> &bull;
  <a href="#running-with-docker">Docker</a> &bull;
  <a href="#project-structure">Structure</a> &bull;
  <a href="#scripts">Scripts</a> &bull;
  <a href="#tech-stack">Tech stack</a>
</p>

</div>

## Overview

```
Browser → Next.js Frontend → NestJS API → BullMQ Queue → Google Sheets API
                                  ↕                            ↕
                             JWT Cookie                  Google Drive API
                                  ↕
                            Google OAuth 2.0
```

| App | Description | Port |
| --- | --- | --- |
| [`apps/api`](apps/api/) | NestJS backend — REST API, OAuth, job queue, Sheets sync | `3001` |
| [`apps/web`](apps/web/) | Next.js frontend — dashboard UI with shadcn/ui components | `3000` |
| [`packages/shared`](packages/shared/) | Shared TypeScript types and interfaces | — |

## Features

- **Google OAuth 2.0** — Sign in with Google, with offline access for background syncing
- **Automatic sheet discovery** — Finds each user's timesheet via Google Drive API
- **Async sync** — Time entries are queued via BullMQ and synced with exponential backoff retries
- **Secure sessions** — JWT in HttpOnly cookies, refresh tokens encrypted with AES-256-GCM
- **Modern frontend** — Next.js 16, React 19, Tailwind CSS v4, shadcn/ui components
- **Resource allocation tracking** — OPS sheet integration that syncs project allocations for comparison with logged time
- **Domain-restricted access** — Configurable allow-lists for email domains and individual addresses

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v10+
- [Redis](https://redis.io/) (used by BullMQ for job queuing)
- A [Google Cloud](https://console.cloud.google.com/) project with:
  - OAuth 2.0 credentials (Client ID + Secret)
  - Google Sheets API enabled
  - Google Drive API enabled

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Each app has its own `.env.example`. Copy and fill in the values:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

See [`apps/api/README.md`](apps/api/README.md) for a full list of backend environment variables.

### 3. Start Redis

```bash
redis-server
```

> [!NOTE]
> If you prefer Docker, you can skip steps 1-3 and use `docker compose up` instead. See [Running with Docker](#running-with-docker) below.

### 4. Run in development

```bash
pnpm dev
```

This starts both apps concurrently via Turborepo:

- Frontend at `http://localhost:3000`
- API at `http://localhost:3001/api`

> [!TIP]
> The frontend proxies `/api/*` requests to the backend in development, so you can also access the API through `http://localhost:3000/api`.

You can also run each app individually:

```bash
pnpm --filter @nc-dashboard/api dev    # Backend only
pnpm --filter @nc-dashboard/web dev    # Frontend only
```

## Running with Docker

Start everything (Redis, API, and frontend) with a single command:

```bash
docker compose up
```

Make sure `apps/api/.env` exists with your Google OAuth credentials and secrets before running. The `REDIS_URL` is automatically set to the Docker Redis container.

To rebuild after code changes:

```bash
docker compose up --build
```

## Project structure

```
nc-dashboard/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/           # Google OAuth 2.0 + JWT
│   │   │   ├── time-entry/     # CRUD + validation
│   │   │   ├── sheets/         # Google Sheets & Drive integration
│   │   │   ├── resource-allocation/ # OPS allocation sync + API
│   │   │   ├── queue/          # BullMQ async sync
│   │   │   ├── user/           # User entity + TypeORM
│   │   │   ├── health/         # Health check endpoint
│   │   │   ├── config/         # Environment validation
│   │   │   └── common/         # Filters, interceptors, utilities
│   │   └── test/               # E2E tests
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/            # App Router pages & layouts
│           ├── components/     # React components + shadcn/ui
│           ├── hooks/          # Custom React hooks
│           ├── lib/            # Utilities (API client, auth, dates)
│           ├── providers/      # Context providers
│           └── types/          # TypeScript types
├── packages/
│   └── shared/                 # Shared types and interfaces
├── turbo.json                  # Turborepo task config
├── pnpm-workspace.yaml         # Workspace packages
└── tsconfig.json               # Shared base TypeScript config
```

## Scripts

All scripts run across both apps via Turborepo:

| Command | Description |
| --- | --- |
| `pnpm dev` | Start both apps in development mode |
| `pnpm build` | Build both apps (with caching) |
| `pnpm lint` | Lint both apps |
| `pnpm test` | Run tests across all apps |
| `pnpm format` | Format all files with Prettier |

## Tech stack

| Layer | Technology |
| --- | --- |
| Monorepo | [Turborepo](https://turbo.build/) + [pnpm workspaces](https://pnpm.io/workspaces) |
| Backend | [NestJS](https://nestjs.com/) v11, TypeScript |
| Frontend | [Next.js](https://nextjs.org/) 16, React 19, [Tailwind CSS](https://tailwindcss.com/) v4, [shadcn/ui](https://ui.shadcn.com/) |
| Auth | Google OAuth 2.0 + JWT (Passport) |
| Database | SQLite via [TypeORM](https://typeorm.io/) (better-sqlite3) |
| Queue | [BullMQ](https://docs.bullmq.io/) + Redis |
| Google APIs | Sheets v4 + Drive v3 |
| Testing | Jest + Supertest (API), Vitest (Web) |
