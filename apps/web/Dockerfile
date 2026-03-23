FROM node:24-slim AS base
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

# --- Production build stage ---
FROM base AS builder
RUN pnpm --filter @nc-dashboard/web build

# --- Production runner stage ---
FROM node:24-slim AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy public assets
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public

# Set up prerender cache directory
RUN mkdir -p apps/web/.next && chown node:node apps/web/.next

# Copy standalone output and static assets
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static

# Run as non-root user
USER node

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
