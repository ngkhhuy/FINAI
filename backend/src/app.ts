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
// Allow all origins
const corsOptions: cors.CorsOptions = {
  origin: true,
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
