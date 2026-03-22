<div align="center">

# NC Dashboard API

NestJS backend — REST API, Google OAuth, async sync via BullMQ, and Google Sheets integration.

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-TypeORM-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://typeorm.io/)

<p>
  <a href="#features">Features</a> &bull;
  <a href="#getting-started">Getting started</a> &bull;
  <a href="#api-endpoints">API</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#project-structure">Structure</a> &bull;
  <a href="#tech-stack">Tech stack</a>
</p>

</div>

## Features

- **Google OAuth 2.0** — Sign in with Google, with offline access for background syncing
- **Automatic sheet discovery** — Finds each user's timesheet via Google Drive API
- **Async sync with BullMQ** — Time entries are queued and synced to Google Sheets with exponential backoff retries
- **JWT authentication** — Secure, HttpOnly cookie-based sessions
- **Encrypted refresh tokens** — AES-256-GCM encryption at rest
- **TypeORM + SQLite** — Persistent storage with better-sqlite3, automatic migrations in production
- **Resource allocation (OPS)** — Syncs project allocation data from a shared OPS spreadsheet on a configurable schedule
- **Domain restriction** — Restrict sign-in to specific email domains and individual email addresses
- **Rate limiting** — 60 requests/minute per IP via `@nestjs/throttler`
- **Input validation** — Strict DTO validation with `class-validator`
- **Health checks** — `/api/health` endpoint with Redis connectivity status

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/)
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

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `PORT` | Server port (default: `3001`) |
| `NODE_ENV` | `development` or `production` |
| `FRONTEND_URL` | Frontend origin for CORS (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL (e.g. `http://localhost:3001/api/auth/google/callback`) |
| `JWT_SECRET` | Random 64-character string for signing JWTs |
| `JWT_EXPIRY` | Token expiry in seconds (e.g. `3600`) |
| `SESSION_MAX_AGE` | Max session duration in seconds (default: `604800` / 7 days) |
| `TOKEN_ENCRYPTION_KEY` | Random 32-byte hex string for encrypting refresh tokens |
| `REDIS_URL` | Redis connection URL (e.g. `redis://localhost:6379`) |
| `ALLOWED_DOMAINS` | Comma-separated list of allowed email domains (e.g. `company.com`) |
| `ALLOWED_EMAILS` | Comma-separated list of individually allowed emails (optional) |
| `OPS_SHEET_NAME` | Name of the OPS resource allocation spreadsheet (optional) |
| `OPS_SHEET_TAB_NAME` | Tab name within the OPS spreadsheet (optional) |
| `OPS_SYNC_INTERVAL_MS` | OPS sync interval in milliseconds (optional, default: 2 hours) |
| `OPS_SYNC_WEEKS_AHEAD` | Number of weeks ahead to sync allocations (optional) |
| `OPS_SYNC_WEEKS_BEHIND` | Number of weeks behind to sync allocations (optional) |

> [!TIP]
> Generate `TOKEN_ENCRYPTION_KEY` with: `openssl rand -hex 32`

### 3. Start Redis

```bash
redis-server
```

### 4. Run the application

```bash
# Development (watch mode)
pnpm run start:dev

# Production
pnpm run build
pnpm run start:prod
```

The API will be available at `http://localhost:3001/api`.

## API endpoints

All routes are prefixed with `/api`.

### Authentication

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/auth/google` | No | Initiate Google OAuth flow |
| `GET` | `/auth/google/callback` | No | OAuth callback handler |
| `POST` | `/auth/refresh` | Cookie | Refresh an expired JWT session |
| `POST` | `/auth/logout` | Yes | Clear session cookie |
| `GET` | `/auth/me` | Yes | Get current user profile |

### Time entries

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/time-entries` | Yes | Create a time entry (returns `202` + job ID) |
| `GET` | `/time-entries/week` | Yes | Get entries for a given week |
| `PUT` | `/time-entries/:rowIndex` | Yes | Update an entry (returns `202` + job ID) |
| `DELETE` | `/time-entries/:rowIndex` | Yes | Delete an entry (returns `202` + job ID) |
| `GET` | `/time-entries/jobs/:jobId/status` | Yes | Poll sync job status |

### Sheets

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/sheets/status` | Yes | Check sheet connection status |
| `GET` | `/sheets/discover` | Yes | Auto-discover user's timesheet via Drive API |
| `PATCH` | `/sheets/select` | Yes | Select/connect a spreadsheet |
| `GET` | `/sheets/projects` | Yes | Get project list from sheet |

### Resource allocation

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/resource-allocation/access-status` | Yes | Check user's OPS sheet access |
| `POST` | `/resource-allocation/check-access` | Yes | Verify access and trigger initial sync |
| `GET` | `/resource-allocation/projects` | Yes | List OPS projects |
| `GET` | `/resource-allocation/allocations` | Yes | Get allocations (supports filtering) |
| `POST` | `/resource-allocation/aliases` | Yes | Add person name alias |
| `DELETE` | `/resource-allocation/aliases` | Yes | Remove person name alias |
| `GET` | `/resource-allocation/sync-status` | Yes | Get OPS sync status |
| `POST` | `/resource-allocation/sync` | Yes | Manually trigger OPS sync (returns `202`) |

### Health

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Health check with Redis status |

> [!NOTE]
> Write operations (`POST`, `PUT`, `DELETE` on time entries) return `202 Accepted` with a job ID. Use the job status endpoint to track completion.

## Architecture

```
Client → NestJS API → BullMQ Queue → Worker → Google Sheets API
              ↕                          ↕
         JWT Cookie                Encrypted Refresh Token
              ↕                          ↕
        Google OAuth              Google Drive API (discovery)
              ↕
      SQLite (TypeORM)
```

**Data flow for time entry creation:**

1. Client sends `POST /api/time-entries` with entry data
2. Backend validates the DTO and enqueues a sync job to BullMQ
3. Returns `202 Accepted` with the job ID immediately
4. A worker picks up the job, decrypts the user's refresh token, and appends the row to their Google Sheet
5. On failure, the job retries with exponential backoff (3 attempts: 5s, 15s, 45s)

**Resource allocation sync:**

1. A repeatable BullMQ job runs on a configurable interval (default: 2 hours)
2. The worker reads the OPS spreadsheet via Google Sheets API using a user's refresh token
3. Project and allocation data is parsed and stored in SQLite, replacing the previous sync batch
4. Clients query the local database for fast allocation lookups

## Project structure

```
src/
├── auth/                   # Google OAuth 2.0 + JWT authentication
├── user/                   # User entity + TypeORM repository
├── sheets/                 # Google Sheets & Drive API integration
├── time-entry/             # Time entry CRUD + validation
├── resource-allocation/    # OPS resource allocation sync + API
├── queue/                  # BullMQ job queue for async sheet sync
├── health/                 # Health check endpoint
├── config/                 # Environment validation
├── common/                 # Shared filters, interceptors, and utilities
├── migrations/             # TypeORM database migrations
├── data-source.ts          # TypeORM data source configuration
├── app.module.ts           # Root module
└── main.ts                 # Bootstrap
```

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | [NestJS](https://nestjs.com/) v11 |
| Runtime | Node.js + TypeScript |
| Auth | Passport (Google OAuth 2.0 + JWT) |
| Database | SQLite via [TypeORM](https://typeorm.io/) (better-sqlite3) |
| Queue | [BullMQ](https://docs.bullmq.io/) + Redis |
| Google APIs | `googleapis` (Sheets v4 + Drive v3) |
| Validation | `class-validator` + `class-transformer` |
| Security | Helmet, CORS, throttling, AES-256-GCM encryption |
| Date utils | [date-fns](https://date-fns.org/) |
| Testing | Jest + Supertest |

## Running tests

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Coverage
pnpm run test:cov
```

### Database migrations

| Command | Description |
| --- | --- |
| `pnpm run migration:generate` | Generate a new migration from entity changes |
| `pnpm run migration:run` | Run pending migrations |
| `pnpm run migration:revert` | Revert the last migration |
| `pnpm run migration:show` | Show migration status |

> [!NOTE]
> In production, migrations run automatically on application startup.
