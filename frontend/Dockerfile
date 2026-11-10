# -------------------------------------------------------------
# Stage 1: Build Static Assets via Vite
# -------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./
RUN npm ci

# Copy client source code
COPY tsconfig.json vite.config.ts ./
COPY index.html ./
COPY src ./src

# Build production bundle
RUN npm run build

# -------------------------------------------------------------
# Stage 2: Serve Bundle via Minimal Hardened Nginx
# -------------------------------------------------------------
FROM nginx:1.25-alpine AS runner

# Remove default configuration and HTML
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]

