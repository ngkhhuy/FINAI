import { Router, Request, Response } from "express";
import { z } from "zod";
import { sheetsService } from "../services/sheets";
import { logger } from "../utils/logger";

const router = Router();

const updateOfferSchema = z.object({
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  featured_weight: z.number().min(0).max(1).optional(),
});

// GET /api/admin/offers – all offers (including inactive)
router.get("/offers", async (_req: Request, res: Response) => {
  try {
    const offers = await sheetsService.getAllOffers();
    return res.json({ offers });
  } catch (err) {
    logger.error("Admin: fetch all offers failed", { err });
    return res.status(500).json({ error: "Failed to fetch offers" });
  }
});

// PATCH /api/admin/offers/:offerId – update offer flags
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

export default router;
