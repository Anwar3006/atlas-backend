# syntax=docker/dockerfile:1

# --- STAGE 1: Builder ---
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

# BuildKit cache mount: reuses the pnpm store across builds instead of
# redownloading every package from scratch on each CI/CD deploy.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY tsconfig.json drizzle.config.ts ./
COPY src ./src

RUN pnpm build

# Strip devDependencies out of the already-installed node_modules (no
# network access needed) instead of a second `pnpm install --prod` in
# the runner stage, which would re-resolve and redownload everything.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm prune --prod


# --- STAGE 2: Runner ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Node isn't a real init process: as PID 1 it won't reap zombies, and a
# SIGTERM sent with no handler registered is silently ignored (a kernel
# quirk that only applies to PID 1) instead of triggering Node's normal
# "terminate" default. Without this, k3s's shutdown/restart SIGTERM would
# get swallowed and connections would be hard-killed at the grace-period
# timeout instead of ending cleanly.
RUN apk add --no-cache dumb-init

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs hono

COPY --from=builder --chown=hono:nodejs /app/dist ./dist
COPY --from=builder --chown=hono:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=hono:nodejs /app/package.json ./package.json

USER hono

EXPOSE 8000

CMD ["dumb-init", "--", "node", "dist/index.js"]
