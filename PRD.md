# NC-Dashboard: Time Tracking Application

## Product Requirements Document

**Version**: 1.0
**Date**: 2026-03-20
**Status**: Draft

---

## 1. Executive Summary

### 1.1 Problem Statement

The internal team currently logs time manually into individual Google Sheets, a process that is error-prone (mistyped dates, inconsistent project names, decimal math mistakes) and costs each team member an estimated 15-25 minutes per day in context-switching and data entry overhead.

### 1.2 Proposed Solution

Build a web application (Phase 1 MVP) backed by NestJS, BullMQ, and Redis that provides a start/stop timer UI and automatically syncs tracked time entries to each user's designated Google Sheet via the Sheets API, authenticated through Google OAuth 2.0 with automatic sheet discovery via the Drive API.

### 1.3 Success Criteria

| KPI                        | Target                                                                 | Measurement Method                                               |
| -------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Team Adoption Rate         | 80% of team actively using within 4 weeks of launch                    | Count of unique users who logged at least 1 entry per week       |
| Time Saved on Manual Entry | 70% reduction (from ~20 min/day to ~6 min/day)                         | Pre/post survey + average session duration analytics             |
| Sync Reliability           | 99.5% of time entries successfully written to Sheets within 60 seconds | BullMQ job completion rate monitoring (failed jobs / total jobs) |
| Data Accuracy              | 0 formatting errors in Sheet columns per 1000 entries                  | Periodic audit of Sheet data vs. submitted payloads              |
| System Uptime              | 99% during business hours (Mon-Fri 8am-8pm local)                      | Health check endpoint monitored every 60 seconds                 |

---

## 2. User Experience & Functionality

### 2.1 User Personas

**Persona 1: Team Member (Primary)**

- Internal employee who must log time weekly to their Google Sheet
- Non-technical; does not want to interact with spreadsheets directly
- Wants to start a timer, do their work, stop the timer, and have it "just work"
- Typically tracks 4-8 entries per day across 2-4 projects

**Persona 2: Team Lead (Secondary -- read-only in Phase 1)**

- Reviews team sheets periodically to verify time entries
- Not a direct user of this app in Phase 1; they continue reading Google Sheets directly
- Benefits indirectly from cleaner, more consistent data in sheets

### 2.2 User Stories with Acceptance Criteria

---

**US-1: Google OAuth Login**

> As a team member, I want to log in with my Google account so that the app can access my Google Sheet on my behalf.

Acceptance Criteria:

- AC-1.1: Clicking "Sign in with Google" initiates an OAuth 2.0 authorization code flow.
- AC-1.2: The consent screen requests exactly these scopes: `openid`, `profile`, `email`, `https://www.googleapis.com/auth/drive.readonly`, `https://www.googleapis.com/auth/spreadsheets`.
- AC-1.3: On successful auth, the backend stores an access token and refresh token associated with the user's Google ID.
- AC-1.4: The user is redirected to the dashboard within 3 seconds of granting consent.
- AC-1.5: If the user denies consent, the UI displays an error message: "Google authorization is required to use this app."
- AC-1.6: Subsequent visits with a valid, non-expired session skip the OAuth flow entirely.

---

**US-2: Automatic Sheet Discovery**

> As a team member, I want the app to automatically find my timesheet so I do not have to paste a URL.

Acceptance Criteria:

- AC-2.1: After login, the backend queries Drive API with `name = 'TimeSheet - {firstName} {lastName}'` and `mimeType = 'application/vnd.google-apps.spreadsheet'`.
- AC-2.2: If exactly 1 result is returned, the spreadsheet ID is stored and the user proceeds to the dashboard with no additional steps.
- AC-2.3: If 0 results are returned, the UI displays a text input prompting: "We couldn't find your timesheet. Please paste your Google Sheet URL below."
- AC-2.4: If >1 results are returned, the UI displays a dropdown listing all matching sheets by name and last-modified date, allowing the user to select one.
- AC-2.5: The manually provided or selected spreadsheet ID is validated by attempting a `spreadsheets.get` call; if it fails with 403/404, the UI shows "Unable to access this sheet. Ensure it is shared with your Google account."
- AC-2.6: The stored spreadsheet ID persists across sessions until the user explicitly changes it via settings.

---

**US-3: Start/Stop Timer**

> As a team member, I want to start and stop a timer so that my hours are calculated automatically.

Acceptance Criteria:

- AC-3.1: The dashboard displays a timer showing `HH:MM:SS` format, starting at `00:00:00`.
- AC-3.2: Before starting, the user must select a Project from a dropdown and enter a Task string (minimum 1 character).
- AC-3.3: Clicking "Start" begins the timer; the UI updates every 1 second.
- AC-3.4: Clicking "Stop" halts the timer and calculates hours as a decimal rounded to 2 decimal places (e.g., 1h 30m = 1.50).
- AC-3.5: After stopping, the user sees a confirmation form pre-filled with: Date (today, DD/MM/YYYY), Project, Task, Hours, and an editable Additional Comments field.
- AC-3.6: Clicking "Submit" sends the payload to the backend; the UI shows a loading spinner for no more than 5 seconds before confirming "Entry saved" or showing an error.
- AC-3.7: Minimum trackable time is 1 minute (0.02 hours). Entries under 1 minute display a warning: "Entry too short. Minimum is 1 minute."
- AC-3.8: The timer state persists if the user refreshes the page (stored in localStorage). If a timer was running, it resumes from the stored start timestamp.

---

**US-4: Manual Time Entry**

> As a team member, I want to manually add a time entry without using the timer for cases where I forgot to track.

Acceptance Criteria:

- AC-4.1: A "Manual Entry" button opens a form with fields: Date (date picker, default today), Project (dropdown), Task (text input), Hours (numeric input, step 0.25), Comments (text area).
- AC-4.2: The Date field only allows dates within the current week (Monday-Sunday).
- AC-4.3: Hours must be between 0.25 and 24.00 inclusive, in 0.25 increments.
- AC-4.4: On submit, the entry follows the same backend pipeline as timer-based entries (API -> BullMQ -> Sheets).

---

**US-5: Project Dropdown Population**

> As a team member, I want the Project dropdown to match my sheet's data validation so I never submit an invalid project name.

Acceptance Criteria:

- AC-5.1: On dashboard load, the backend reads the data validation rules from Column B of the user's sheet.
- AC-5.2: The dropdown renders these values exactly as defined in the sheet (case-sensitive, whitespace-sensitive).
- AC-5.3: The dropdown values are cached for 15 minutes; a manual "Refresh Projects" button forces a re-fetch.
- AC-5.4: If no data validation is found on Column B, the Project field becomes a free-text input with a warning: "No project list found in your sheet."

---

**US-6: View Current Week Entries**

> As a team member, I want to see all my entries for the current week so I can review what I have logged.

Acceptance Criteria:

- AC-6.1: The dashboard displays a table of entries for the current week (Monday 00:00 to Sunday 23:59).
- AC-6.2: Columns displayed: Date, Project, Task, Hours, Comments, Actions (Edit/Delete).
- AC-6.3: Entries are sorted by Date descending, then by row index ascending.
- AC-6.4: A weekly total hours is displayed below the table.
- AC-6.5: Data is fetched by reading the user's sheet and filtering server-side by date range.

---

**US-7: Edit an Entry**

> As a team member, I want to edit a time entry from the current week to correct mistakes.

Acceptance Criteria:

- AC-7.1: Clicking "Edit" on a row opens an inline edit form with the current values pre-filled.
- AC-7.2: Only entries with dates in the current week (Mon-Sun) are editable; rows from previous weeks have the Edit button disabled with tooltip "Only current week entries can be edited."
- AC-7.3: On save, the backend updates the specific row in the Google Sheet by row index.
- AC-7.4: The UI reflects the change within 3 seconds of confirmation.

---

**US-8: Delete an Entry**

> As a team member, I want to delete a time entry from the current week if I logged it by mistake.

Acceptance Criteria:

- AC-8.1: Clicking "Delete" shows a confirmation dialog: "Are you sure you want to delete this entry? This cannot be undone."
- AC-8.2: On confirm, the backend clears columns A-E for that row (does not delete the row itself, to avoid shifting row indices).
- AC-8.3: Same current-week restriction as editing (AC-7.2).
- AC-8.4: The entry disappears from the UI within 3 seconds.

---

**US-9: Session Persistence & Token Refresh**

> As a team member, I want to stay logged in across browser sessions so I do not have to re-authenticate daily.

Acceptance Criteria:

- AC-9.1: The backend stores a refresh token and uses it to obtain new access tokens when the current one expires.
- AC-9.2: A session lasts 7 days without re-authentication, assuming the refresh token remains valid.
- AC-9.3: If the refresh token is revoked or expired, the user is redirected to the login page with the message "Your session has expired. Please sign in again."

---

### 2.3 Non-Goals (Phase 1 MVP)

The following are explicitly **out of scope** for the Phase 1 MVP:

- **Browser extension** (deferred to Phase 1.1)
- **Notion integration** (deferred to Phase 2.0)
- **Reporting/analytics dashboards** (team leads continue using Google Sheets directly)
- **Multi-sheet or multi-tab support** (each user has exactly 1 sheet, 1 tab)
- **Offline mode** (the app requires an internet connection)
- **Mobile-responsive design** (desktop-first; mobile is a nice-to-have, not a requirement)
- **Admin panel** (no user management UI; users self-onboard via OAuth)
- **Notifications or reminders** (no "you haven't logged time today" alerts)
- **Time entry approval workflows**
- **Bulk import/export**

---

## 3. Technical Specifications

### 3.1 Tech Stack

| Layer           | Technology                          |
| --------------- | ----------------------------------- |
| Frontend        | React + Vite (SPA)                  |
| Backend         | NestJS v11 (TypeScript)             |
| Queue/Jobs      | BullMQ + Redis                      |
| Auth            | Google OAuth 2.0 + JWT              |
| APIs            | Google Drive API, Google Sheets API |
| Package Manager | pnpm                                |

### 3.2 Architecture Overview

```
+---------------------------+       HTTPS        +---------------------------+
|   React + Vite (SPA)      | -----------------> |       NestJS API          |
|   - Timer UI              | <----------------- |       (Port 3000)         |
|   - Entry Management      |    JSON responses   |                           |
|   - OAuth redirect handler|                     +---------------------------+
+---------------------------+                     |  Auth   | TimeEntry | Sheets |
                                                  | Module  | Module    | Module |
                                                  +---------------------------+
                                                           |
                                                  BullMQ enqueue
                                                           |
                                                           v
                                                  +---------------------------+
                                                  |    BullMQ + Redis         |
                                                  |    (Queue: sheet-sync)    |
                                                  +---------------------------+
                                                           |
                                                  Worker processes job
                                                           |
                                                           v
                                                  +---------------------------+
                                                  |      Google APIs          |
                                                  |  - Drive API (discovery)  |
                                                  |  - Sheets API (R/W)       |
                                                  +---------------------------+
```

**Data Flow -- New Time Entry:**

1. User stops timer or submits manual entry in React app.
2. React sends `POST /api/time-entries` with JSON payload + JWT cookie.
3. NestJS `TimeEntryController` validates payload via class-validator DTO.
4. `TimeEntryService` enqueues a `sheet-sync` job to BullMQ containing: `{ userId, spreadsheetId, row: [date, project, task, hours, comments] }`.
5. Returns `202 Accepted` with `{ jobId }` to the client immediately.
6. BullMQ worker (`SheetSyncProcessor`) picks up the job, obtains a valid access token (refreshing if needed), and calls `sheets.spreadsheets.values.append()`.
7. On success, job is marked complete. On Google API failure (429, 500, 503), BullMQ retries with exponential backoff (3 attempts, delays: 5s, 15s, 45s).
8. Client can optionally poll `GET /api/time-entries/jobs/:jobId/status` to confirm completion.

### 3.3 NestJS Module Breakdown

#### ConfigModule (`@nestjs/config`)

- Loads `.env` via `ConfigService`
- Validates required env vars at startup

#### AuthModule (`src/auth/`)

- `auth.controller.ts` -- `GET /api/auth/google` (initiate), `GET /api/auth/google/callback` (handle redirect), `POST /api/auth/logout`, `GET /api/auth/me`
- `auth.service.ts` -- Token exchange, refresh logic, user upsert
- `google.strategy.ts` -- Passport strategy for Google OAuth 2.0
- `jwt.strategy.ts` -- Passport strategy for JWT validation
- `jwt-auth.guard.ts` -- Guard applied to protected routes

Key decisions:

- JWT stored in an HttpOnly, Secure, SameSite=Lax cookie (not localStorage)
- JWT payload: `{ sub: googleId, email, firstName, lastName, spreadsheetId }`
- JWT expiry: 1 hour. Refresh token stored server-side
- Google refresh tokens encrypted at rest using AES-256-GCM

#### UserModule (`src/user/`)

- `user.service.ts` -- CRUD for user records
- `user.repository.ts` -- Storage abstraction behind `IUserRepository` interface

Key decisions:

- **No database for MVP**. User data stored in a JSON file (`data/users.json`). The repository interface allows swapping to a database later.
- User record shape:
  ```typescript
  interface User {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    spreadsheetId: string | null;
    encryptedRefreshToken: string | null;
    createdAt: string; // ISO 8601
    updatedAt: string; // ISO 8601
  }
  ```

#### SheetsModule (`src/sheets/`)

- `sheets.service.ts` -- All Google Sheets API interactions (append, update, clear, read)
- `sheets-discovery.service.ts` -- Google Drive API query for sheet discovery

Methods:

- `discoverSheet(firstName, lastName, accessToken)` -- Queries Drive API
- `getDataValidation(spreadsheetId, accessToken)` -- Reads Column B data validation
- `getWeekEntries(spreadsheetId, accessToken, weekStart, weekEnd)` -- Reads and filters rows
- `appendRow(spreadsheetId, accessToken, row)` -- Appends a single row
- `updateRow(spreadsheetId, accessToken, rowIndex, row)` -- Updates columns A-E of a specific row
- `clearRow(spreadsheetId, accessToken, rowIndex)` -- Clears columns A-E of a specific row

#### QueueModule (`src/queue/`)

- `queue.module.ts` -- Registers BullMQ queue and processor
- `sheet-sync.processor.ts` -- Worker that processes sheet-sync jobs

Configuration:

- Queue name: `sheet-sync`
- Job options: `{ attempts: 3, backoff: { type: 'exponential', delay: 5000 } }`
- Concurrency: 3 (Google Sheets API rate limit is 60 req/min/user)
- Job retention: completed 24 hours, failed 7 days

#### TimeEntryModule (`src/time-entry/`)

- `time-entry.controller.ts` -- REST endpoints
- `time-entry.service.ts` -- Business logic, validation, queue dispatch
- `time-entry.dto.ts` -- Request DTOs with class-validator decorators

### 3.4 API Endpoint Design

All endpoints prefixed with `/api`. Protected endpoints require a valid JWT cookie.

#### Authentication

| Method | Path                        | Auth | Description                                                    |
| ------ | --------------------------- | ---- | -------------------------------------------------------------- |
| `GET`  | `/api/auth/google`          | No   | Redirects to Google OAuth consent screen                       |
| `GET`  | `/api/auth/google/callback` | No   | Handles OAuth callback, sets JWT cookie, redirects to frontend |
| `POST` | `/api/auth/logout`          | Yes  | Clears JWT cookie                                              |
| `GET`  | `/api/auth/me`              | Yes  | Returns current user profile + spreadsheetId                   |

#### Sheet Discovery

| Method  | Path                   | Auth | Description                                                |
| ------- | ---------------------- | ---- | ---------------------------------------------------------- |
| `GET`   | `/api/sheets/discover` | Yes  | Auto-discovers user's sheet, returns matches               |
| `PATCH` | `/api/sheets/select`   | Yes  | Sets the user's spreadsheetId manually                     |
| `GET`   | `/api/sheets/projects` | Yes  | Returns project dropdown values from sheet data validation |

#### Time Entries

| Method   | Path                                   | Auth | Description                                   |
| -------- | -------------------------------------- | ---- | --------------------------------------------- |
| `POST`   | `/api/time-entries`                    | Yes  | Creates a new time entry (enqueues to BullMQ) |
| `GET`    | `/api/time-entries/week`               | Yes  | Returns current week's entries                |
| `PUT`    | `/api/time-entries/:rowIndex`          | Yes  | Updates an entry at the given row index       |
| `DELETE` | `/api/time-entries/:rowIndex`          | Yes  | Clears an entry at the given row index        |
| `GET`    | `/api/time-entries/jobs/:jobId/status` | Yes  | Returns BullMQ job status                     |

#### Health

| Method | Path          | Auth | Description                                                       |
| ------ | ------------- | ---- | ----------------------------------------------------------------- |
| `GET`  | `/api/health` | No   | Returns `{ status: 'ok', redis: 'connected', uptime: <seconds> }` |

#### Request/Response Examples

**`POST /api/time-entries`**

```json
// Request
{
  "date": "20/03/2026",
  "project": "Project Alpha",
  "task": "QU-22",
  "hours": 1.50,
  "comments": "Worked on feature X"
}

// Response (202 Accepted)
{
  "jobId": "sheet-sync:abc123",
  "status": "queued",
  "message": "Entry queued for sync"
}
```

**`GET /api/time-entries/week`**

```json
// Response (200 OK)
{
  "weekStart": "16/03/2026",
  "weekEnd": "22/03/2026",
  "entries": [
    {
      "rowIndex": 45,
      "date": "20/03/2026",
      "project": "Project Alpha",
      "task": "QU-22",
      "hours": 1.5,
      "comments": "Worked on feature X"
    }
  ],
  "totalHours": 32.75
}
```

### 3.5 Browser Extension Architecture (Phase 1.1 -- Design Only)

Not implemented in MVP. Included for future reference.

- **Manifest V3** for Chrome/Brave; Firefox-compatible variant
- **Popup UI**: Minimal timer with Project/Task fields (shared React components with web app)
- **Auth**: Extension opens a tab to the web app's OAuth flow; JWT cookie shared via same backend origin
- **Background Service Worker**: Manages timer state
- **Storage**: `chrome.storage.local` for timer state persistence

### 3.6 Integration Points

#### Google OAuth 2.0

- Library: `passport-google-oauth20`
- Redirect URI: `{BACKEND_URL}/api/auth/google/callback`
- Scopes: `openid profile email drive.readonly spreadsheets`
- Access type: `offline` (to obtain refresh tokens)

#### Google Drive API

- Used for sheet discovery only
- Query: `name='TimeSheet - {first} {last}' and mimeType='application/vnd.google-apps.spreadsheet'`
- Rate limit: 12,000 queries/day

#### Google Sheets API

- Endpoints: `spreadsheets.get`, `spreadsheets.values.get`, `spreadsheets.values.append`, `spreadsheets.values.update`, `spreadsheets.values.clear`
- Rate limit: 60 read requests/min/user, 60 write requests/min/user
- Value input option: `USER_ENTERED`

#### Redis

- Used for BullMQ job queue backend
- Connection: `REDIS_URL` env var

### 3.7 Security & Privacy

| Concern                     | Mitigation                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| Token storage (XSS)         | JWT in HttpOnly + Secure + SameSite=Lax cookie. Never exposed to JavaScript.              |
| Token storage (server-side) | Google refresh tokens encrypted with AES-256-GCM. Encryption key in env var.              |
| CSRF                        | SameSite=Lax cookie. All mutating endpoints require `Content-Type: application/json`.     |
| CORS                        | Whitelist only the frontend origin (`FRONTEND_URL` env var). No wildcards.                |
| Rate limiting               | `@nestjs/throttler` at 60 requests/minute per IP.                                         |
| Input validation            | All DTOs use `class-validator` with `whitelist: true` and `forbidNonWhitelisted: true`.   |
| Row index tampering         | Backend re-reads the row before update/delete; verifies date is within current week.      |
| Helmet headers              | Security headers via `helmet` middleware (X-Frame-Options, X-Content-Type-Options, etc.). |

### 3.8 Environment Configuration

```env
# Server
PORT=3000
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:5173

# Google OAuth
GOOGLE_CLIENT_ID=<from-google-cloud-console>
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# JWT
JWT_SECRET=<random-64-char-string>
JWT_EXPIRY=3600

# Encryption
TOKEN_ENCRYPTION_KEY=<random-32-byte-hex-string>

# Redis
REDIS_URL=redis://localhost:6379
```

---

## 4. Data Model & Schema

### 4.1 Google Sheets Column Mapping

| Column | Header              | Field      | Format       | Validation                                          |
| ------ | ------------------- | ---------- | ------------ | --------------------------------------------------- |
| A      | Date                | `date`     | `DD/MM/YYYY` | Valid date within current week (Mon-Sun)            |
| B      | Project             | `project`  | String       | Must match sheet's data validation values exactly   |
| C      | Task                | `task`     | String       | 1-500 characters. Phase 2: maps to Notion Ticket ID |
| D      | Hours               | `hours`    | Decimal      | 0.02 to 24.00, rounded to 2 decimal places          |
| E      | Additional Comments | `comments` | String       | 0-1000 characters, optional                         |

### 4.2 Internal Data Representations

**CreateTimeEntryDto**

```typescript
class CreateTimeEntryDto {
  @IsString()
  @Matches(/^\d{2}\/\d{2}\/\d{4}$/, { message: 'Date must be DD/MM/YYYY' })
  date: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  project: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  task: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.02)
  @Max(24)
  hours: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comments?: string;
}
```

**SheetSyncJobPayload**

```typescript
interface SheetSyncJobPayload {
  type: 'append' | 'update' | 'clear';
  userId: string;
  spreadsheetId: string;
  rowIndex?: number;
  row?: [string, string, string, number, string];
}
```

**Abstract TaskInput (Phase 2 readiness)**

```typescript
interface TaskInput {
  type: 'plain' | 'notion';
  value: string;
  notionTicketId?: string;
  notionTitle?: string;
}
```

The `TimeEntryService` accepts `task` as a `string` in Phase 1 but internally uses `TaskInput` from day one (`{ type: 'plain', value: taskString }`). This prevents a rewrite when Notion is added.

### 4.3 Validation Rules

| Rule                             | Where Enforced                      | Error Response                                        |
| -------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| Date is DD/MM/YYYY               | DTO (regex)                         | 400: "Date must be in DD/MM/YYYY format"              |
| Date is within current week      | `TimeEntryService`                  | 400: "Date must be within the current week (Mon-Sun)" |
| Date is a real calendar date     | `TimeEntryService` (date-fns)       | 400: "Invalid date"                                   |
| Project matches sheet validation | `TimeEntryService`                  | 400: "Invalid project. Must be one of: [list]"        |
| Hours is 0.02-24.00              | DTO (class-validator)               | 400: "Hours must be between 0.02 and 24"              |
| Task is 1-500 chars              | DTO (class-validator)               | 400: "Task must be between 1 and 500 characters"      |
| Comments is 0-1000 chars         | DTO (class-validator)               | 400: "Comments must not exceed 1000 characters"       |
| Row exists and is current week   | `TimeEntryService` (re-reads sheet) | 400: "Row not found or not in current week"           |
| User has a spreadsheetId         | `TimeEntryService`                  | 400: "No spreadsheet configured"                      |

---

## 5. Risks & Roadmap

### 5.1 Phased Rollout

#### Phase 1: MVP

**Goal**: Web app with core timer, sync, auth, and sheet discovery.

| Week | Deliverables                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1    | ConfigModule, env validation, Redis connection, health endpoint. AuthModule: Google OAuth flow, JWT cookie, refresh token storage. |
| 2    | UserModule: user storage (JSON-file backed). SheetsModule: sheet discovery, data validation read, row CRUD.                        |
| 3    | QueueModule: BullMQ setup, sheet-sync processor with retry logic. TimeEntryModule: all CRUD endpoints, validation, queue dispatch. |
| 4    | React frontend: Login page, OAuth redirect handler, Dashboard (timer, entry table, manual entry form, project dropdown).           |
| 5    | Integration testing: End-to-end flow (login -> discover sheet -> start timer -> stop -> verify row in Sheet). Bug fixes.           |
| 6    | Buffer: Polish, edge cases, internal team beta with 3-5 users.                                                                     |

**MVP Definition of Done**: A team member can log in with Google, have their sheet auto-discovered, start/stop a timer, and see the entry appear in their Google Sheet within 60 seconds. They can view, edit, and delete current-week entries.

#### Phase 1.1: Browser Extension

- Manifest V3 Chrome/Brave extension with popup timer
- Firefox-compatible variant
- Shared auth with web app (same backend, same JWT cookie)
- Extension-specific: badge showing running timer, keyboard shortcut to start/stop

#### Phase 2.0: Notion Integration

- Notion OAuth integration (separate from Google OAuth)
- Task picker: search Notion database for tickets
- `TaskInput` object fully utilized: `{ type: 'notion', notionTicketId, notionTitle }`
- Column C maps to `{notionTicketId}`, Column E optionally includes `{notionTitle}: {userComments}`
- Notion API rate limits handled via BullMQ (same pattern as Sheets)

### 5.2 Technical Risks & Mitigations

| Risk                                              | Probability | Impact | Mitigation                                                                                                                    |
| ------------------------------------------------- | ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Google Sheets API rate limiting (60 req/min/user) | Medium      | High   | BullMQ retries with exponential backoff. Batch reads where possible. Cache project validation for 15 min.                     |
| Row index drift (external edits shift rows)       | Low         | High   | Re-read target row before update/delete. Verify row content matches expected values. Reject on mismatch and force UI refresh. |
| Refresh token revocation                          | Low         | Medium | Catch 401 in BullMQ worker. Mark job as permanently failed. Redirect user to re-auth on next API call.                        |
| JSON file corruption (concurrent writes)          | Medium      | Medium | File-level locking (`proper-lockfile`). Backup copy before each write. Migrate to SQLite for production hardening.            |
| Redis unavailability                              | Low         | High   | Health endpoint checks Redis. Return 503 on write endpoints. Reads remain functional (no BullMQ dependency).                  |
| Solo developer bottleneck                         | High        | Medium | Keep architecture simple. Use NestJS generators for boilerplate. Prioritize happy path first.                                 |
| Google OAuth consent screen                       | Low         | Low    | Set consent screen to "Internal" in Google Cloud Console (Google Workspace). No verification needed.                          |

### 5.3 Dependencies

**NPM packages to add:**

| Package                                                   | Purpose                           |
| --------------------------------------------------------- | --------------------------------- |
| `@nestjs/config`                                          | Environment configuration         |
| `@nestjs/passport`, `passport`, `passport-google-oauth20` | Google OAuth                      |
| `@nestjs/jwt`, `passport-jwt`                             | JWT auth                          |
| `googleapis`                                              | Google Drive & Sheets API client  |
| `@nestjs/bullmq`, `bullmq`, `ioredis`                     | Job queue                         |
| `class-validator`, `class-transformer`                    | DTO validation                    |
| `cookie-parser`                                           | Parse JWT from cookies            |
| `helmet`                                                  | Security headers                  |
| `@nestjs/throttler`                                       | Rate limiting                     |
| `date-fns`                                                | Date parsing, week boundaries     |
| `proper-lockfile`                                         | File locking for JSON persistence |

**External services:**

- Google Cloud Console project with OAuth 2.0 credentials
- Google Workspace account (for "Internal" consent screen)
- Redis instance (local for dev; managed for production)

**Infrastructure (production):**

- Single server or container (NestJS serves API + BullMQ worker in same process)
- Redis (can run on same server for <50 users)
- HTTPS termination (reverse proxy or platform like Railway/Fly.io)

---

## Appendix A: Target File Structure (MVP)

```
src/
  main.ts
  app.module.ts
  app.controller.ts

  auth/
    auth.module.ts
    auth.controller.ts
    auth.service.ts
    google.strategy.ts
    jwt.strategy.ts
    jwt-auth.guard.ts
    auth.types.ts

  user/
    user.module.ts
    user.service.ts
    user.entity.ts
    user.repository.ts
    user.repository.interface.ts

  sheets/
    sheets.module.ts
    sheets.service.ts
    sheets-discovery.service.ts
    sheets.types.ts

  queue/
    queue.module.ts
    sheet-sync.processor.ts
    sheet-sync.types.ts

  time-entry/
    time-entry.module.ts
    time-entry.controller.ts
    time-entry.service.ts
    time-entry.dto.ts
    time-entry.types.ts

  common/
    filters/
      http-exception.filter.ts
    interceptors/
      logging.interceptor.ts
    utils/
      date.utils.ts
      encryption.utils.ts

data/
  users.json

test/
  jest-e2e.json
  app.e2e-spec.ts
  auth.e2e-spec.ts
  time-entry.e2e-spec.ts
```

## Appendix B: "Current Week" Definition

- **Start**: Monday 00:00:00.000 in the server's local timezone
- **End**: Sunday 23:59:59.999 in the server's local timezone
- **Library**: `date-fns` functions `startOfWeek(date, { weekStartsOn: 1 })` and `endOfWeek(date, { weekStartsOn: 1 })`

## Appendix C: Error Response Format

All API errors follow a consistent JSON shape:

```json
{
  "statusCode": 400,
  "message": "Date must be within the current week (Mon-Sun)",
  "error": "Bad Request",
  "timestamp": "2026-03-20T14:30:00.000Z",
  "path": "/api/time-entries"
}
```
