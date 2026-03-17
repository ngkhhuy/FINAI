import { Router, Request, Response } from "express";
import { z } from "zod";
import { chatService } from "../services/chat";
import { logger } from "../utils/logger";

const router = Router();

const chatRequestSchema = z.object({
  session_id: z.string().optional(),
  message: z.string().min(1).max(2000),
  gclid: z.string().optional(),
  fbclid: z.string().optional(),
  ttclid: z.string().optional(),
});

// POST /api/chat/message
router.post("/message", async (req: Request, res: Response) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  try {
    const response = await chatService.handleMessage(parsed.data);
    return res.json(response);
  } catch (err) {
    logger.error("Chat handler error", { err });
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
