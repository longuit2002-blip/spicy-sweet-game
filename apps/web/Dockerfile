# Build from repository root: docker build -f apps/web/Dockerfile .
# Pass public URLs at build time so Next embeds them in the client bundle.
# Example:
#   docker build -f apps/web/Dockerfile . \
#     --build-arg NEXT_PUBLIC_API_URL=https://your.domain/api \
#     --build-arg NEXT_PUBLIC_SOCKET_URL=https://your.domain

ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-bookworm-slim AS prepare
WORKDIR /app
COPY . .
RUN npx --yes turbo@2.3.3 prune web --docker

FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prepare /app/out/full/ .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
RUN pnpm exec turbo run build --filter=web

FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
