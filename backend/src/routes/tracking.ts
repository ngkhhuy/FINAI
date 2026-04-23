import { Router, Request, Response } from "express";
import { z } from "zod";
import { logger } from "../utils/logger";
import { logClick } from "../services/sheet.service";

const router = Router();

const clickEventSchema = z.object({
  session_id: z.string(),
  offer_id: z.string(),
  gclid: z.string().optional(),
  fbclid: z.string().optional(),
  ttclid: z.string().optional(),
});

// POST /api/tracking/click – record Apply button click (legacy JSON endpoint)
router.post("/click", (req: Request, res: Response) => {
  const parsed = clickEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid event payload" });
  }

  const event = { ...parsed.data, timestamp: new Date().toISOString() };
  logger.info("Click event", event);

  return res.json({ received: true });
});

// GET /api/tracking/click?offer_id=&session_id=&url= – log + redirect to lender
router.get("/click", (req: Request, res: Response) => {
  const { offer_id, session_id, url } = req.query as Record<string, string>;

  // Validate destination URL — must be http/https to prevent open-redirect abuse
  let destination: string;
  try {
    const parsed = new URL(url ?? "");
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("bad protocol");
    destination = parsed.toString();
  } catch {
    return res.status(400).json({ error: "Invalid or missing url parameter" });
  }

  // Fire-and-forget sheet log — log whenever session_id is present
  // If offer_id is missing from the URL, try extracting it from the destination's oid/cpid param
  let resolvedOfferId = offer_id ?? "";
  if (!resolvedOfferId) {
    try {
      const dest = new URL(url ?? "");
      resolvedOfferId = dest.searchParams.get("oid") ?? dest.searchParams.get("cpid") ?? "";
    } catch {
      resolvedOfferId = "";
    }
  }
  if (session_id) {
    logClick({ session_id, offer_id: resolvedOfferId });
  }

  return res.redirect(302, destination);
});

export default router;
