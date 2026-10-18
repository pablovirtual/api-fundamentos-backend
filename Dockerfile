# ==========================================
# Etapa 1: Compilación y dependencias (Builder)
# ==========================================
FROM node:20-slim AS builder

WORKDIR /app

# Instalar OpenSSL (requerido por Prisma Engine)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar dependencias (al usar Debian/glibc, bcrypt descarga binarios precompilados sin compilar C++ ni agotar la RAM)
RUN npm ci

# Generar cliente de Prisma
COPY prisma ./prisma/
RUN npx prisma generate

# Copiar código fuente y compilar TypeScript
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# Dejar únicamente las dependencias de producción
RUN npm prune --omit=dev

# ==========================================
# Etapa 2: Imagen final de Producción (Runner)
# ==========================================
FROM node:20-slim AS runner

WORKDIR /app

# Instalar OpenSSL para runtime de Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

# Copiar dependencias de producción ya depuradas y código compilado
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

# Usuario no root para seguridad
USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]
