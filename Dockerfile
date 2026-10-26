# Build stage: install everything, generate the Prisma client and compile TypeScript
FROM node:24-slim AS build
WORKDIR /app
# Prisma's query engine needs OpenSSL
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# Runtime stage: only production dependencies and compiled code
FROM node:24-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist

# Configuration (database URL, API keys) comes from environment variables at runtime,
# never from the image
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
