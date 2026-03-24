# NC Dashboard

Monorepo: Turborepo + pnpm workspaces. Node 20+, pnpm 10+.

- `apps/api` — NestJS 11, TypeORM (SQLite via better-sqlite3), BullMQ, Google OAuth
- `apps/web` — Next.js 16, React 19, Tailwind v4, shadcn/ui, TanStack Query
- `packages/shared` — Shared TypeScript types

## Commands

### Running tests

```
pnpm --filter @nc-dashboard/api test           # API unit tests (Jest)
pnpm --filter @nc-dashboard/api test:watch      # API watch mode
pnpm --filter @nc-dashboard/api test:cov        # API coverage
pnpm --filter @nc-dashboard/api test:e2e        # API e2e tests
pnpm --filter @nc-dashboard/web test            # Web tests (Vitest)
pnpm test                                       # All tests via turbo
```

DO NOT use `npx jest`, `npx vitest`, `cd apps/api && npm test`, `jest --config`, or any other variant. Always use `pnpm --filter`.

### Test file conventions

- API: `*.spec.ts` — Jest config is embedded in `apps/api/package.json` (no separate jest.config file)
- Web: `*.test.tsx` — Vitest config at `apps/web/vitest.config.ts`
- E2E: `*.e2e-spec.ts` — config at `apps/api/test/jest-e2e.json`
- API tests use `jest.fn()` / `jest.mock()` / `jest.mocked()`. Web tests use `vi.fn()` / `vi.mock()` / `vi.hoisted()`.
- API tests build a `TestingModule` with `@nestjs/testing` and mock dependencies via `useValue`.

### Dev & build

```
pnpm dev                                        # Start all apps (API :3001, Web :3000)
pnpm build                                      # Build all
pnpm --filter @nc-dashboard/api lint
pnpm --filter @nc-dashboard/web lint
docker compose up redis                         # Redis required for BullMQ
```

## Code conventions

### API (NestJS)

- All relative imports use `.js` extensions (NodeNext module resolution): `import { Foo } from './foo.service.js'`
- TypeORM entities use decorators. DB is SQLite at `data/users.db`.
- Migrations: timestamp-prefixed files in `apps/api/src/migrations/`. Generate with `pnpm --filter @nc-dashboard/api migration:generate`.
- Env validation via `apps/api/src/config/env.validation.ts`. Required vars listed in `apps/api/.env.example`.

### Web (Next.js 16)

- IMPORTANT: Read `apps/web/AGENTS.md` before any Next.js work — Next.js 16 has breaking changes from training data.
- Path alias: `@/*` maps to `./src/*`
- API calls proxy through `apps/web/src/proxy.ts` (middleware rewrites `/api/*` to backend)
- UI components: shadcn/ui in `apps/web/src/components/ui/`
- Data fetching: TanStack Query hooks in `apps/web/src/hooks/`
- Web imports do NOT use `.js` extensions (bundler resolution)

### Shared package

- Export types from `packages/shared/src/index.ts`
- Must run `pnpm --filter @nc-dashboard/shared build` before API/Web can resolve shared types

## Bug-checking protocol

Before completing any task, verify:

1. **Type safety** — Run `pnpm --filter @nc-dashboard/api build` and/or `pnpm --filter @nc-dashboard/web build` to catch type errors
2. **Tests pass** — Run the relevant test suite for any modified module
3. **Import paths** — API imports must end in `.js`. Web imports must NOT. Mixing causes silent build failures
4. **Null/undefined** — `strictNullChecks` is enabled. Handle nullable returns from TypeORM `findOne` (returns `null`)
5. **Entity changes** — If you modified an entity, check if a migration is needed and if `apps/api/src/data-source.ts` entity array includes it
6. **Shared types** — If you changed `packages/shared`, rebuild it and verify both consumers compile
7. **Env vars** — If you added a new env var, update both `.env.example` and `env.validation.ts`

## Planning protocol

Enter plan mode (explore and design before coding) when:

- The change spans more than 2 files across different modules
- Adding a new module, entity, or API endpoint
- Database schema changes or migrations are involved
- The task description is ambiguous — ask for clarification rather than guessing

## Subagent guidelines

Use subagents for:

- Running tests while continuing other work
- Independent file exploration across different parts of the monorepo
- Linting one app while building another

Do NOT use subagents for:

- Sequential dependencies (build shared → then test API)
- Tasks requiring context from a previous step's output
- Small changes to a single file — just do it directly
