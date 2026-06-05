FROM node:20 AS base
WORKDIR /app

# ===== DEV (hot reload) =====
FROM base AS dev
COPY package*.json ./
RUN npm install
COPY . .


# ===== PROD BUILD =====
FROM base AS builder
COPY package*.json ./
RUN npm install
COPY . .
RUN npx nx build aeroworld

# ===== PROD RUNNER =====
FROM node:20 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/aeroworld/.next ./.next
COPY --from=builder /app/apps/aeroworld/package.json ./package.json
COPY --from=builder /app/apps/aeroworld/next.config.js ./next.config.js
COPY --from=builder /app/apps/aeroworld/public ./public
RUN npm install --only=production
CMD ["sh", "-c", "npx next start -p $PORT -H 0.0.0.0"]

