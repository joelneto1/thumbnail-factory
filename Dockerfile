# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────
# Thumbnail Factory — imagem de produção (Next.js 16 standalone)
# Para deploy no Coolify (Build Pack: Dockerfile).
# ─────────────────────────────────────────────────────────────

FROM node:20-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1

# ---- deps: instala TODAS as deps (inclui devDeps p/ o build) ----
FROM base AS deps
WORKDIR /app
# Toolchain p/ compilar o binário nativo do better-sqlite3 caso não haja prebuild.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: gera o .next/standalone ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: imagem final enxuta ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Output standalone (server.js + deps traçadas) + estáticos + public.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Garante o módulo nativo do SQLite (o trace do standalone às vezes não copia
# o binário .node); copiar a cadeia inteira é à prova de falhas.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

# Diretório de dados (SQLite + imagens geradas) — montar VOLUME persistente aqui.
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
