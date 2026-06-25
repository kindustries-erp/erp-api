# --- STAGE 1: Build ---
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- STAGE 2: Production ---
FROM oven/bun:1

WORKDIR /app

COPY --from=builder /app/package.json /app/bun.lock ./
COPY --from=builder /app/dist ./dist

RUN bun install --frozen-lockfile --production

EXPOSE 3000

CMD ["node", "dist/main"]
