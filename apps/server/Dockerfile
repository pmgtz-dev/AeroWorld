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
RUN npx nx build server

# ===== PROD RUNNER =====
FROM node:20 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --only=production
COPY --from=builder /app/apps/server/dist ./dist
CMD ["node", "dist/main.js"]
