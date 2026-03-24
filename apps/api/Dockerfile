FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install build tools for native addons (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./

# Copy package files
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @nc-dashboard/api...

# Copy shared package and build it (dependency, changes less often)
COPY packages/shared/ packages/shared/
RUN pnpm --filter @nc-dashboard/shared build

# Copy api app source
COPY apps/api/ apps/api/

# --- Development stage ---
FROM base AS development
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["pnpm", "dev"]

# --- Production stage ---
FROM base AS production
RUN pnpm --filter @nc-dashboard/api build
RUN mkdir -p apps/api/data
WORKDIR /app/apps/api
EXPOSE 3001
# Migrations run automatically on startup via migrationsRun: true
CMD ["node", "dist/main.js"]
