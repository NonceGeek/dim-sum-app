FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY prisma/schema.prisma prisma/schema.prisma
RUN npx prisma generate
COPY lib lib
COPY scripts scripts
COPY preflight.mjs ./
USER node
ENV NODE_ENV=production
CMD ["node", "--import", "tsx", "scripts/sync-wechat-service-followers.ts", "--pending"]
