# Build from repository root: docker build -f apps/api/Dockerfile .

ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api exec prisma generate
RUN pnpm exec turbo run build --filter=api

FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
# Match EXPOSE and production compose mapping; avoids relying only on Compose env (code default is 3001).
ENV PORT=8000
COPY --from=builder /app /app
WORKDIR /app/apps/api
EXPOSE 8000
CMD ["node", "dist/main.js"]
