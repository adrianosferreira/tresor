# Build stage
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/client ./apps/client

# Empty = browser calls `/api/v1/...` on the same host (Caddy → API)
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @tresor/crypto build
RUN pnpm --filter @tresor/shared build
RUN pnpm --filter @tresor/client build

# Production stage
FROM nginx:1.27-alpine

COPY --from=builder /app/apps/client/dist /usr/share/nginx/html
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
