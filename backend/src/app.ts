import express from "express";
import cors from "cors";
import path from "path";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import chatRouter from "./routes/chat";
import offersRouter from "./routes/offers";
import adminRouter from "./routes/admin";
import trackingRouter from "./routes/tracking";

const app = express();

// Trust first proxy (Nginx on AWS EB) so req.ip returns real client IP
if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// ── Middleware ──────────────────────────────────────────────
// Allow all origins
const corsOptions: cors.CorsOptions = {
  origin: true,
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);

// ── Rate limiting for chat endpoint ────────────────────────
const chatLimiter = rateLimit({
  windowMs: 2 * 1000, // 2 second window
  max: 1, // 1 request per window per IP
  message: "Too many requests. Please wait before sending another message.",
  standardHeaders: false,
  legacyHeaders: false,
  // Skip rate limit in development (localhost requests via dev server)
  skip: () => env.NODE_ENV !== "production",
});

// ── Routes ─────────────────────────────────────────────────
app.use("/api/chat", chatLimiter, chatRouter);
app.use("/api/offers", offersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/tracking", trackingRouter);

// ── Health check ────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Serve frontend static files (production) ───────────────
// All remaining requests → SPA fallback to index.html
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// ── Error handler (must be last) ────────────────────────────
app.use(errorHandler);

export default app;
