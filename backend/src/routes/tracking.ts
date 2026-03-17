import { Router, Request, Response } from "express";
import { z } from "zod";
import { logger } from "../utils/logger";

const router = Router();

const clickEventSchema = z.object({
  session_id: z.string(),
  offer_id: z.string(),
  gclid: z.string().optional(),
  fbclid: z.string().optional(),
  ttclid: z.string().optional(),
});

// POST /api/tracking/click – record Apply button click
router.post("/click", (req: Request, res: Response) => {
  const parsed = clickEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid event payload" });
  }

  const event = {
    ...parsed.data,
    timestamp: new Date().toISOString(),
  };

  // TODO: persist to DB / Sheet / analytics pipeline
  logger.info("Click event", event);

  return res.json({ received: true });
});

export default router;
