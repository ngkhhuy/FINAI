import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { analyzeMessage } from "../services/ai.service";
import { getOffersData, getConfigData } from "../services/sheet.service";
import { sessionService } from "../services/session";
import { logger } from "../utils/logger";
import type { Offer, LoanType, ChatHistoryMessage } from "../types";
import type { LoanPurpose } from "../services/ai.service";

// ── Types & Constants ─────────────────────────────────────────────────────────

export interface OfferCard {
  offer_id: string;
  brand_name: string;
  loan_type: string;
  amount_range: string;
  term_range: string;
  apr_range: string;
  speed_label: string;
  conditions_short: string;
  pros: string[];
  apply_url: string;
  is_best: boolean;
  is_featured: boolean;
}

const BUCKET_MIDPOINT: Record<string, number> = {
  "<$500": 250, "$500-$1k": 750, "$1k-$3k": 2000, "$3k-$10k": 6500, ">$10k": 15000,
};

const BUCKET_LABEL: Record<string, Record<string, string>> = {
  en: { "<$500": "under $500", "$500-$1k": "$500–$1,000", "$1k-$3k": "$1,000–$3,000", "$3k-$10k": "$3,000–$10,000", ">$10k": "over $10,000" },
  es: { "<$500": "menos de $500", "$500-$1k": "$500–$1,000", "$1k-$3k": "$1,000–$3,000", "$3k-$10k": "$3,000–$10,000", ">$10k": "más de $10,000" }
};

// ── Helper Functions ──────────────────────────────────────────────────────────

function amountScore(offer: Offer, bucket: string): number {
  const mid = BUCKET_MIDPOINT[bucket];
  if (mid === undefined) return 0.5;
  // Hard Filter: Nếu túi tiền user nhỏ hơn mức tối thiểu của gói vay -> 0 điểm (loại)
  if (mid < offer.amount_min) return 0; 
  if (mid >= offer.amount_min && mid <= offer.amount_max) return 1.0;
  return Math.max(0, 1 - (mid - offer.amount_max) / offer.amount_max);
}

function buildOfferCard(offer: Offer, sessionId: string, isBest: boolean): OfferCard {
  const formatDollar = (n: number) => `$${n.toLocaleString("en-US")}`;
  const appendSessionId = (url: string) => {
    try {
      const u = new URL(url);
      u.searchParams.set("session_id", sessionId);
      return u.toString();
    } catch { return `${url}${url.includes('?') ? '&' : '?'}session_id=${sessionId}`; }
  };

  return {
    offer_id: offer.offer_id,
    brand_name: offer.brand_name,
    loan_type: offer.loan_type,
    amount_range: `${formatDollar(offer.amount_min)} – ${formatDollar(offer.amount_max)}`,
    term_range: `${offer.term_min}–${offer.term_max} months`,
    apr_range: `${offer.apr_min}%–${offer.apr_max}% APR`,
    speed_label: offer.speed_label,
    conditions_short: offer.conditions_short,
    pros: [offer.pros_1, offer.pros_2, offer.pros_3].filter(Boolean),
    apply_url: appendSessionId(offer.apply_url),
    is_best: isBest,
    is_featured: offer.is_featured,
  };
}

function getBucketForAmount(amount: number): string {
  if (amount < 500)    return "<$500";
  if (amount < 1000)   return "$500-$1k";
  if (amount < 3000)   return "$1k-$3k";
  if (amount <= 10000) return "$3k-$10k";
  return ">$10k";
}

// ── Core Selector Logic ───────────────────────────────────────────────────────

function selectOffers(allOffers: Offer[], purpose: LoanPurpose, bucket: string, weight: number, sid: string): OfferCard[] {
  const purposeType = purpose as LoanType;
  
  // 1. Filter: Đúng loại VÀ Điểm số > 0 (Tức là user đủ tiền vay mức min)
  const inGroup = allOffers
    .filter(o => o.loan_type === purposeType && amountScore(o, bucket) > 0)
    .sort((a, b) => amountScore(b, bucket) - amountScore(a, bucket));

  if (inGroup.length === 0) return [];

  const slots: Offer[] = [];
  const featured = inGroup.find(o => o.is_featured);
  const nonFeatured = inGroup.filter(o => !o.is_featured);

  // Weighted Random cho Featured
  if (featured && Math.random() < weight) {
    slots.push(featured);
    slots.push(...nonFeatured.slice(0, 2));
  } else {
    if (nonFeatured[0]) slots.push(nonFeatured[0]);
    if (featured) slots.push(featured);
    if (nonFeatured[1]) slots.push(nonFeatured[1]);
  }

  return slots.slice(0, 3).map((o, i) => buildOfferCard(o, sid, i === 0));
}

// ── Controller Handler ────────────────────────────────────────────────────────

export async function handleChat(req: Request, res: Response) {
  const { message, sessionId: reqSessionId } = req.body;
  const sessionId = reqSessionId || uuidv4();
  const lang = message.toLowerCase().includes("hola") ? "es" : "en";

  // Load Config & Session
  const [config, allOffers] = await Promise.all([getConfigData(), getOffersData()]);
  const session = sessionService.get(sessionId) || sessionService.create(lang, { session_id: sessionId });
  
  // AI Analysis
  const aiResult = await analyzeMessage(message, session.history);
  let finalReply = aiResult.reply_message;
  let offers: OfferCard[] = [];

  if (!aiResult.is_out_of_scope && aiResult.purpose !== "UNKNOWN" && aiResult.amount_bucket !== "UNKNOWN") {
    // 1. Thử lọc chính xác theo yêu cầu
    offers = selectOffers(allOffers, aiResult.purpose, aiResult.amount_bucket, Number(config.featured_default_weight || 0.6), sessionId);

    // 2. Logic Nới lỏng (Relaxation) nếu không có gói khớp 100%
    if (offers.length === 0) {
      const userRange = BUCKET_LABEL[lang][aiResult.amount_bucket] || aiResult.amount_bucket;
      
      // Tìm gói gần nhất (bất kể loại vay) nhưng user vẫn phải đủ tiền vay mức min
      const nearest = allOffers
        .filter(o => o.amount_min > BUCKET_MIDPOINT[aiResult.amount_bucket])
        .sort((a, b) => a.amount_min - b.amount_min)[0];

      if (nearest) {
        const nearestMin = `$${nearest.amount_min.toLocaleString()}`;
        const nearestBucket = getBucketForAmount(nearest.amount_min);
        offers = selectOffers(allOffers, nearest.loan_type as LoanPurpose, nearestBucket, 0, sessionId);
        
        finalReply = lang === "es" 
          ? `No tenemos opciones para ${userRange}. Aquí están las más cercanas desde ${nearestMin}:`
          : `We don't have options for the ${userRange} range. Here are the closest ones starting at ${nearestMin}:`;
      }
    }
  }

  // Update History & Response
  sessionService.update(sessionId, { 
    history: [...session.history, { role: "user", content: message }, { role: "assistant", content: finalReply }] 
  });

  return res.json({ sessionId, bot_reply: finalReply, offers });
}