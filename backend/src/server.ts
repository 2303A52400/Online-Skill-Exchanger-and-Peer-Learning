import http from "http";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import client from "prom-client";
import { PrismaClient } from "@prisma/client";
import {
  config,
  logger,
  httpRequestsTotal,
  httpRequestDurationMs,
} from "./config/index.js";
import { setupSignalingGateway } from "./signaling/signaling.gateway.js";
import { TimeBankingLedgerService } from "./ledger/ledger.service.js";

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();
const ledgerService = new TimeBankingLedgerService(prisma);

// Security & Parsing Middlewares
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(compression());
app.use(express.json());

// Request Timing & Prometheus Metrics Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const route = req.route?.path || req.path;
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
    });
    httpRequestDurationMs.observe(
      {
        method: req.method,
        route,
        status_code: res.statusCode.toString(),
      },
      duration
    );
  });
  next();
});

// Observability: Metrics Endpoint for Prometheus Scraper
app.get("/metrics", async (_req: Request, res: Response) => {
  try {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err: any) {
    res.status(500).end(err.message);
  }
});

// Liveness Probe
app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).json({ status: "UP", timestamp: new Date().toISOString() });
});

// Readiness Probe (verifies database connectivity)
app.get("/readyz", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "READY", database: "CONNECTED" });
  } catch (err: any) {
    logger.error({ err: err.message }, "Readiness probe failed");
    res.status(503).json({ status: "UNHEALTHY", database: "DISCONNECTED" });
  }
});

// API Routes
app.get("/api/v1/info", (_req: Request, res: Response) => {
  res.json({
    app: "SkillSwap Peer Learning API",
    version: "1.0.0",
    environment: config.env,
  });
});

// Ledger API Endpoints
app.post("/api/v1/ledger/escrow/hold", async (req: Request, res: Response) => {
  try {
    const { sessionId, learnerId, creditAmount } = req.body;
    const result = await ledgerService.holdEscrow({ sessionId, learnerId, creditAmount: Number(creditAmount) });
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/v1/ledger/escrow/release", async (req: Request, res: Response) => {
  try {
    const { sessionId, teacherId, learnerId, creditAmount, actualDurationHours } = req.body;
    const result = await ledgerService.releaseEscrow({
      sessionId,
      teacherId,
      learnerId,
      creditAmount: Number(creditAmount),
      actualDurationHours: actualDurationHours ? Number(actualDurationHours) : undefined,
    });
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/v1/ledger/escrow/refund", async (req: Request, res: Response) => {
  try {
    const { sessionId, learnerId, creditAmount, reason } = req.body;
    const result = await ledgerService.refundEscrow({
      sessionId,
      learnerId,
      creditAmount: Number(creditAmount),
      reason,
    });
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Initialize Socket.io WebRTC Gateway
setupSignalingGateway(server);

// Start Server
const serverInstance = server.listen(config.port, () => {
  logger.info(`SkillSwap API Server listening on port ${config.port} in ${config.env} mode`);
});

// Graceful Shutdown Handling (SIGTERM/SIGINT for Kubernetes pod eviction)
const handleGracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Commencing graceful drain of active connections...`);
  serverInstance.close(async () => {
    logger.info("HTTP & WebSocket servers closed.");
    await prisma.$disconnect();
    logger.info("Prisma database connection closed cleanly.");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forcefully terminating after timeout (15s).");
    process.exit(1);
  }, 15000);
};

process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));

