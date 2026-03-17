import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import chatRouter from "./routes/chat";
import offersRouter from "./routes/offers";
import adminRouter from "./routes/admin";
import trackingRouter from "./routes/tracking";

const app = express();

// ── Middleware ──────────────────────────────────────────────
// Support comma-separated list of allowed origins (e.g. localhost + LAN IP)
const allowedOrigins = env.CORS_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const normalizeOrigin = (origin: string) => origin.replace(/\/$/, "");

const isDevTunnelOrigin = (origin: string) =>
  /^https:\/\/[a-z0-9-]+-\d+\.[a-z0-9.-]*devtunnels\.ms$/i.test(origin);

const isAllowedOrigin = (origin: string) => {
  const normalized = normalizeOrigin(origin);
  if (allowedOrigins.some((allowed) => normalizeOrigin(allowed) === normalized)) {
    return true;
  }

  // In development, allow Microsoft Dev Tunnels dynamic subdomains.
  return env.NODE_ENV === "development" && isDevTunnelOrigin(normalized);
};

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, same-origin)
    if (!origin || isAllowedOrigin(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);

// ── Routes ─────────────────────────────────────────────────
app.use("/api/chat", chatRouter);
app.use("/api/offers", offersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/tracking", trackingRouter);

// ── Health check ────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Error handler (must be last) ────────────────────────────
app.use(errorHandler);

export default app;
