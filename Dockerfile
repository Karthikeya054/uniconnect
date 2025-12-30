# Base stage for all services
FROM node:18-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

# Build stage
FROM base AS build
RUN pnpm install --frozen-lockfile
RUN pnpm run build

# Production stage (Unified)
FROM base AS production
COPY --from=build /app /app

EXPOSE 3000
ENV PORT=3000

# Use RAILWAY_DOCKER_TARGET (which the user already set) to decide what to run.
# Defaults to app if not set.
CMD ["sh", "-c", "if [ \"$RAILWAY_DOCKER_TARGET\" = \"worker\" ]; then node apps/worker/dist/index.js; else node apps/app/build/index.js; fi"]
