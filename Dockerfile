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

# tsc only compiles .ts files -- the raw .sql migrations (and drizzle-kit's
# meta/*.json snapshots, which src/db/migrate.ts's migrator also reads to
# know what's already applied) need copying in separately, so dist/db/migrate.js
# has something to read at runtime. Deploy.yml's migration step runs this
# same image with an overridden command (`node dist/db/migrate.js`) as a
# one-off pod before rolling out the new backend Deployment.
COPY --from=builder --chown=hono:nodejs /app/src/db/migrations ./dist/db/migrations

# pnpm's virtual store (node_modules/.pnpm) isn't dependency-type-aware: even
# a from-scratch `pnpm install --prod --frozen-lockfile` (confirmed locally,
# with an isolated store dir to rule out cache contamination) still
# materializes every package the lockfile resolves -- prod AND dev -- onto
# disk. Only the top-level node_modules/<pkg> symlinks and node_modules/.bin
# are actually prod-filtered; nothing here ever imports esbuild (it's not
# symlinked, not in .bin -- confirmed by booting the compiled app, including
# a real sign-up hitting Postgres, against a node_modules with these entries
# already removed), but its Go-compiled native binary ships an old Go
# stdlib that Trivy flags as CRITICAL/HIGH. tsx/vite/vitest/drizzle-kit
# (esbuild's only consumers here, all devDependencies) end up dead weight
# the same way but don't carry known CVEs themselves, so only esbuild is
# worth the removal today.
RUN rm -rf node_modules/.pnpm/esbuild@* node_modules/.pnpm/@esbuild+* node_modules/.pnpm/@esbuild-kit+*

USER hono

EXPOSE 8000

CMD ["dumb-init", "--", "node", "dist/index.js"]
