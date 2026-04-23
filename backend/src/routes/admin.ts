import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { sheetsService } from "../services/sheets";
import { sessionService } from "../services/session";
import { logger } from "../utils/logger";
import { env } from "../config/env";

const router = Router();

// ── Simple API-key guard ────────────────────────────────────
// Requires header:  Authorization: Bearer <ADMIN_API_KEY>
function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"] ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!env.ADMIN_API_KEY || token !== env.ADMIN_API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.use(requireAdminKey);

const updateOfferSchema = z.object({
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  featured_weight: z.number().min(0).max(1).optional(),
});

// GET /api/admin/offers – all offers
router.get("/offers", async (_req: Request, res: Response) => {
  try {
    const offers = await sheetsService.getAllOffers();
    return res.json({ offers });
  } catch (err) {
    logger.error("Admin: fetch all offers failed", { err });
    return res.status(500).json({ error: "Failed to fetch offers" });
  }
});

// PATCH /api/admin/offers/:offerId
router.patch("/offers/:offerId", async (req: Request, res: Response) => {
  const { offerId } = req.params;
  const parsed = updateOfferSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  }

  try {
    await sheetsService.updateOffer(offerId, parsed.data);
    return res.json({ success: true });
  } catch (err) {
    logger.error("Admin: update offer failed", { offerId, err });
    return res.status(500).json({ error: "Failed to update offer" });
  }
});

// GET /api/admin/config – global config from CONFIG sheet tab
router.get("/config", async (_req: Request, res: Response) => {
  try {
    const config = await sheetsService.getConfig();
    return res.json({ config });
  } catch (err) {
    logger.error("Admin: fetch config failed", { err });
    return res.status(500).json({ error: "Failed to fetch config" });
  }
});

// GET /api/admin/sessions – list all active in-memory sessions (metadata only)
router.get("/sessions", (_req: Request, res: Response) => {
  const all = sessionService.listAll();
  const sanitized = all.map((s) => ({
    session_id:    s.session_id,
    language:      s.language,
    purpose:       s.purpose,
    amount_bucket: s.amount_bucket,
    turn_count:    Math.floor(s.history.length / 2),
    created_at:    new Date(s.created_at).toISOString(),
    updated_at:    new Date(s.updated_at).toISOString(),
  }));
  return res.json({ count: sanitized.length, sessions: sanitized });
});

// GET /api/admin/sessions/:sessionId – full conversation history for one session
router.get("/sessions/:sessionId", (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = sessionService.get(sessionId);
  if (!session) return res.status(404).json({ error: "Session not found or expired" });
  return res.json({
    session_id:    session.session_id,
    language:      session.language,
    purpose:       session.purpose,
    amount_bucket: session.amount_bucket,
    created_at:    new Date(session.created_at).toISOString(),
    updated_at:    new Date(session.updated_at).toISOString(),
    history:       session.history,
  });
});

export default router;
