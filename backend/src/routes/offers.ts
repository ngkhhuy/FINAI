import { Router, Request, Response } from "express";
import { sheetsService } from "../services/sheets";
import { logger } from "../utils/logger";

const router = Router();

// GET /api/offers – returns all active offers (used for testing/debug)
router.get("/", async (_req: Request, res: Response) => {
  try {
    const offers = await sheetsService.getActiveOffers();
    return res.json({ offers });
  } catch (err) {
    logger.error("Failed to fetch offers", { err });
    return res.status(500).json({ error: "Failed to fetch offers" });
  }
});

export default router;
