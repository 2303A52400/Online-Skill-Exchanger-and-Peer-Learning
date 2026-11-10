import dotenv from "dotenv";
import pino from "pino";
import client from "prom-client";

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5000", 10),
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/skillswap?schema=public",
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  logLevel: process.env.LOG_LEVEL || "info",
};

export const logger = pino({
  level: config.logLevel,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Prometheus Default Metrics Registration
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register, prefix: "skillswap_api_" });

// Custom Business & HTTP Metrics
export const httpRequestsTotal = new client.Counter({
  name: "skillswap_http_requests_total",
  help: "Total number of incoming HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

export const httpRequestDurationMs = new client.Histogram({
  name: "skillswap_http_request_duration_ms",
  help: "Duration of HTTP requests in milliseconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

export const activeWebsocketConnections = new client.Gauge({
  name: "skillswap_active_websocket_connections",
  help: "Number of active Socket.io clients connected for WebRTC signaling",
});

export const ledgerTransactionsTotal = new client.Counter({
  name: "skillswap_ledger_transactions_total",
  help: "Total ledger operations processed",
  labelNames: ["type", "status"],
});

