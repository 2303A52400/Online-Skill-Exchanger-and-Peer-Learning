# -------------------------------------------------------------
# Stage 1: Dependencies Cache & Build Stage
# -------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy dependency manifests first for Docker layer caching
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Copy full application source
COPY tsconfig.json ./
COPY src ./src

# Generate Prisma Client & compile TypeScript
RUN npx prisma generate
RUN npm run build

# Prune devDependencies to keep the image minimal
RUN npm prune --production

# -------------------------------------------------------------
# Stage 2: Hardened Production Runtime
# -------------------------------------------------------------
FROM node:20-alpine AS runner

# Install dumb-init to properly handle PID 1 signal forwarding (SIGTERM)
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV PORT=5000

WORKDIR /usr/src/app

# Run as unprivileged non-root user for security compliance
USER node

# Copy production artifacts from builder stage with proper ownership
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist
COPY --chown=node:node --from=builder /usr/src/app/prisma ./prisma
COPY --chown=node:node --from=builder /usr/src/app/package*.json ./

EXPOSE 5000

# Dumb-init guarantees clean handling of process signals in Kubernetes
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.js"]

