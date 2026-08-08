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
# timeout instead of ending cleanly. Also: base Node images ship npm (and
# its own bundled dependencies), corepack, and yarn regardless of whether
# the image uses them. This runner never runs npm/corepack/yarn --
# node_modules arrives pre-built via COPY below -- so they're just unused
# attack surface. Trivy image scans flag CVEs in npm's bundled deps (e.g.
# tar, sigstore, ip-address) even though nothing here ever executes them;
# removing the tooling outright resolves those findings at the root
# instead of chasing each one individually.
RUN apk add --no-cache dumb-init \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs hono \
    && rm -rf \
      /usr/local/lib/node_modules/npm \
      /usr/local/lib/node_modules/corepack \
      /opt/yarn-v1.22.22 \
      /usr/local/bin/npm \
      /usr/local/bin/npx \
      /usr/local/bin/corepack \
      /usr/local/bin/yarn \
      /usr/local/bin/yarnpkg

COPY --from=builder --chown=hono:nodejs /app/dist ./dist
COPY --from=builder --chown=hono:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=hono:nodejs /app/package.json ./package.json

USER hono

EXPOSE 8000

CMD ["dumb-init", "--", "node", "dist/index.js"]
