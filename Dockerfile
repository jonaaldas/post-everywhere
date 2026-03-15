# Build Stage
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# Production Stage
FROM node:22-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

# Copy API build output and deps
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/apps/web/package.json ./apps/web/

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy web static build
COPY --from=build /app/apps/web/dist ./apps/web/dist

ENV NODE_ENV=production
ENV PORT=80
EXPOSE 80

CMD ["node", "apps/api/dist/index.js"]
