ARG NODE_IMAGE=node:22-bookworm-slim
ARG BUN_IMAGE=oven/bun:1.3.12-debian
ARG POSTGRES_IMAGE=postgres:17-bookworm
ARG REDIS_IMAGE=redis:7.4-bookworm
FROM ${BUN_IMAGE} AS bun
FROM ${NODE_IMAGE} AS base
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1 CRM_TELEMETRY_DISABLED=1 CRM_TELEMETRY_ENABLED=false CRM_AI_ENABLED=false DO_NOT_TRACK=1

FROM base AS dependencies
COPY . .
RUN bun install --frozen-lockfile --ignore-scripts
RUN DATABASE_URL=postgresql://localhost:5432/build bun run --filter=@crm/db db:generate

FROM dependencies AS api-build
RUN cd apps/api && bun run build

FROM base AS api
ENV NODE_ENV=production PORT=3001
COPY --from=api-build --chown=node:node /workspace /workspace
USER node
WORKDIR /workspace/apps/api
ENTRYPOINT ["node", "/workspace/deploy/scripts/runtime.mjs"]
CMD ["bun", "dist/main.js"]

FROM base AS migrate
ENV NODE_ENV=production
COPY --from=dependencies --chown=node:node /workspace /workspace
USER node
WORKDIR /workspace/packages/db
ENTRYPOINT ["node", "/workspace/deploy/scripts/runtime.mjs"]
CMD ["node", "/workspace/deploy/scripts/migrate.mjs"]

FROM dependencies AS app-build
ARG API_URL
ARG APP_URL
RUN node deploy/scripts/build-app.mjs

FROM base AS app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=app-build --chown=node:node /workspace/apps/app/.next/standalone /workspace
COPY --from=app-build --chown=node:node /workspace/apps/app/.next/static /workspace/apps/app/.next/static
COPY --from=app-build --chown=node:node /workspace/apps/app/public /workspace/apps/app/public
COPY --from=app-build --chown=node:node /workspace/deploy/scripts /workspace/deploy/scripts
COPY --from=app-build /workspace/LICENSE /workspace/LICENSE
USER node
WORKDIR /workspace/apps/app
ENTRYPOINT ["node", "/workspace/deploy/scripts/runtime.mjs"]
CMD ["node", "server.js"]

FROM dependencies AS agent-build
RUN node deploy/scripts/build-agent.mjs

FROM base AS agent
ENV NODE_ENV=production PORT=2000 AGENT_PORT=2000
COPY --from=agent-build --chown=node:node /workspace /workspace
USER node
WORKDIR /workspace/apps/agent
ENTRYPOINT ["node", "/workspace/deploy/scripts/runtime.mjs"]
CMD ["bun", "run", "start"]

FROM base AS cron
ENV NODE_ENV=production
COPY --chown=node:node deploy/scripts /workspace/deploy/scripts
COPY LICENSE /workspace/LICENSE
USER node
CMD ["node", "/workspace/deploy/scripts/cron.mjs"]

FROM ${POSTGRES_IMAGE} AS postgres
COPY deploy/scripts/init-postgres.sh /docker-entrypoint-initdb.d/10-crm-role.sh
COPY LICENSE /opt/crm/LICENSE

FROM ${REDIS_IMAGE} AS redis
COPY --chown=redis:redis deploy/scripts/redis.sh /opt/crm/redis.sh
COPY LICENSE /opt/crm/LICENSE
USER redis
