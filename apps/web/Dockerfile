FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./

# Copy package files
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @nc-dashboard/web...

# Copy shared package and build it (dependency, changes less often)
COPY packages/shared/ packages/shared/
RUN pnpm --filter @nc-dashboard/shared build

# Copy web app source
COPY apps/web/ apps/web/

# --- Development stage ---
FROM base AS development
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "dev"]

# --- Production stage ---
FROM base AS production
RUN pnpm --filter @nc-dashboard/web build
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", ".next/standalone/apps/web/server.js"]
