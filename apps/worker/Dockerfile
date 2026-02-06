FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/ ./packages/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @dubai/worker...

# Copy source
COPY apps/worker/ ./apps/worker/

# Build
RUN pnpm --filter @dubai/worker build

# Production stage
FROM node:22-alpine AS runner
WORKDIR /app

COPY --from=base /app/apps/worker/dist ./dist
COPY --from=base /app/node_modules ./node_modules

CMD ["node", "dist/index.js"]
