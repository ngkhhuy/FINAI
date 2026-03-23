import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { analyzeMessage } from "../services/ai.service";
import { getOffersData, getConfigData } from "../services/sheet.service";
import { sessionService } from "../services/session";
import { logger } from "../utils/logger";
import type { Offer, LoanType, ChatHistoryMessage } from "../types";
import type { LoanPurpose, ReadinessSignal } from "../services/ai.service";

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

// Upper bound of each bucket — used for hard-filter: if even the top of the bucket < offer.amount_min, exclude
const BUCKET_MAX: Record<string, number> = {
  "<$500": 499, "$500-$1k": 1000, "$1k-$3k": 3000, "$3k-$10k": 10000, ">$10k": 100000,
};

const BUCKET_LABEL: Record<string, Record<string, string>> = {
  en: { "<$500": "under $500", "$500-$1k": "$500–$1,000", "$1k-$3k": "$1,000–$3,000", "$3k-$10k": "$3,000–$10,000", ">$10k": "over $10,000" },
  es: { "<$500": "menos de $500", "$500-$1k": "$500–$1,000", "$1k-$3k": "$1,000–$3,000", "$3k-$10k": "$3,000–$10,000", ">$10k": "más de $10,000" }
};

// ── Helper Functions ──────────────────────────────────────────────────────────

function amountScore(offer: Offer, bucket: string): number {
  const mid = BUCKET_MIDPOINT[bucket];
  const max = BUCKET_MAX[bucket];
  if (mid === undefined || max === undefined) return 0.5;
  // Hard filter: if even the top of the user's bucket is below the offer's minimum, exclude
  if (max < offer.amount_min) return 0;
  // Perfect fit: midpoint falls within offer range
  if (mid >= offer.amount_min && mid <= offer.amount_max) return 1.0;
  // Upper-bound fit: top of bucket overlaps offer range (e.g. user says ~$3k, offer starts at $3k)
  if (max >= offer.amount_min && max <= offer.amount_max) return 0.9;
  // Midpoint below offer min but bucket max reaches: partial score
  if (mid < offer.amount_min && max >= offer.amount_min) return 0.7;
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

// ── Helper: Language detection ───────────────────────────────────────────────

function detectLanguage(message: string): "en" | "es" {
  const spanishPattern = /\b(hola|necesito|quiero|dinero|préstamo|prestamo|urgente|cuánto|cuanto|cómo|puedo|pagar|deuda|carro|casa|ayuda|semana|trabajo|tengo)\b/i;
  return spanishPattern.test(message) ? "es" : "en";
}

// ── Helper: Speed score (urgency-aware tiebreaker) ────────────────────────────

function speedScore(offer: Offer, urgency: string): number {
  if (urgency !== "within_hours" && urgency !== "today") return 0;
  const label = offer.speed_label.toLowerCase();
  if (label.includes("same") || label.includes("instant") || label.includes("hour")) return 1.0;
  if (label.includes("24") || label.includes("overnight") || label.includes("next day")) return 0.5;
  return 0;
}

// ── Core Selector Logic ───────────────────────────────────────────────────────

function selectOffers(allOffers: Offer[], purpose: LoanPurpose, bucket: string, urgency: string, weight: number, sid: string): OfferCard[] {
  const purposeType = purpose as LoanType;

  // 1. Filter: same loan_type AND amountScore > 0; sort by score desc, then amount_max desc (higher limit preferred for large buckets), then speed for urgent requests
  const inGroup = allOffers
    .filter(o => o.loan_type === purposeType && amountScore(o, bucket) > 0)
    .sort((a, b) => {
      const scoreDiff = amountScore(b, bucket) - amountScore(a, bucket);
      if (scoreDiff !== 0) return scoreDiff;
      const maxDiff = b.amount_max - a.amount_max; // prefer offer with higher ceiling
      if (maxDiff !== 0) return maxDiff;
      return speedScore(b, urgency) - speedScore(a, urgency);
    });

  if (inGroup.length === 0) return [];

  const slots: Offer[] = [];
  const inGroupFeatured = inGroup.find(o => o.is_featured);
  const nonFeatured = inGroup.filter(o => !o.is_featured);
  // Featured from a DIFFERENT loan_type (spec: "Featured lệch nhóm" → push to Alternative #2)
  // Require amountScore === 1.0 (midpoint must fall fully within the offer's range)
  // to avoid showing e.g. a $100–$1,000 payday loan for a $100k request.
  const crossGroupFeatured = allOffers.find(o => o.is_featured && o.loan_type !== purposeType && amountScore(o, bucket) === 1.0);

  if (inGroupFeatured) {
    // Featured belongs to correct group → apply weighted random
    if (Math.random() < weight) {
      slots.push(inGroupFeatured);
      slots.push(...nonFeatured.slice(0, 2));
    } else {
      if (nonFeatured[0]) slots.push(nonFeatured[0]);
      slots.push(inGroupFeatured);
      if (nonFeatured[1]) slots.push(nonFeatured[1]);
    }
  } else {
    // No in-group featured → Best + Alt #1 from correct group; Alt #2 = cross-group featured
    if (nonFeatured[0]) slots.push(nonFeatured[0]);
    if (nonFeatured[1]) slots.push(nonFeatured[1]);
    if (crossGroupFeatured) slots.push(crossGroupFeatured);
    else if (nonFeatured[2]) slots.push(nonFeatured[2]);
  }

  const finalSlots = slots.slice(0, 3);
  const bestOffer = finalSlots[0];
  finalSlots.sort((a, b) => a.amount_min - b.amount_min);
  return finalSlots.map(o => buildOfferCard(o, sid, o === bestOffer));
}

// ── Controller Handler ────────────────────────────────────────────────────────

export async function handleChat(req: Request, res: Response) {
  const { message, sessionId: reqSessionId } = req.body;
  const sessionId = reqSessionId || uuidv4();

  // Load Config & Session
  const [config, allOffers] = await Promise.all([getConfigData(), getOffersData()]);
  const session = sessionService.get(sessionId) || sessionService.create(detectLanguage(message), { session_id: sessionId });
  const lang = session.language;
  
  // AI Analysis
  const aiResult = await analyzeMessage(message, session.history);
  let finalReply = aiResult.reply_message;
  let offers: OfferCard[] = [];

  // Merge: carry forward known fields from session if AI returned UNKNOWN this turn
  const resolvedPurpose = (aiResult.purpose !== "UNKNOWN" ? aiResult.purpose : session.purpose) as LoanPurpose | undefined;
  const resolvedBucket  = (aiResult.amount_bucket !== "UNKNOWN" ? aiResult.amount_bucket : session.amount_bucket) as string | undefined;
  const resolvedUrgency = (aiResult.urgency !== "UNKNOWN" ? aiResult.urgency : session.urgency) ?? "UNKNOWN";

  // Map readiness → max offers to show (guide v2: hesitant=1, comparing=2, ready=3)
  // UNKNOWN = 0: AI vẫn đang thu thập thông tin, chưa show offers
  const readinessLimit: Record<ReadinessSignal, number> = {
    hesitant: 1, comparing: 2, ready: 3, UNKNOWN: 0,
  };
  const maxOffers = readinessLimit[aiResult.readiness_signal ?? "UNKNOWN"];

  if (!aiResult.is_out_of_scope && resolvedPurpose && resolvedPurpose !== "UNKNOWN" && resolvedBucket && resolvedBucket !== "UNKNOWN" && maxOffers > 0) {
    // 1. Thử lọc chính xác theo yêu cầu
    offers = selectOffers(allOffers, resolvedPurpose, resolvedBucket!, resolvedUrgency, Number(config.featured_default_weight || 0.6), sessionId);
    offers = offers.slice(0, maxOffers);

    // 2. Logic Nới lỏng (Relaxation) nếu không có gói khớp 100%
    if (offers.length === 0) {
      const userRange = BUCKET_LABEL[lang][resolvedBucket!] || resolvedBucket;
      
      // Tìm gói gần nhất (bất kể loại vay) nhưng user vẫn phải đủ tiền vay mức min
      const nearest = allOffers
        .filter(o => o.amount_min > BUCKET_MIDPOINT[resolvedBucket!])
        .sort((a, b) => a.amount_min - b.amount_min)[0];

      if (nearest) {
        const nearestMin = `$${nearest.amount_min.toLocaleString()}`;
        const nearestBucket = getBucketForAmount(nearest.amount_min);
        offers = selectOffers(allOffers, nearest.loan_type as LoanPurpose, nearestBucket, "UNKNOWN", 0, sessionId);
        offers = offers.slice(0, maxOffers);
        
        finalReply = lang === "es" 
          ? `No tenemos opciones para ${userRange}. Aquí están las más cercanas desde ${nearestMin}:`
          : `We don't have options for the ${userRange} range. Here are the closest ones starting at ${nearestMin}:`;
      }
    }
  }

  // Persist resolved fields into session for next turns
  sessionService.update(sessionId, {
    ...(resolvedPurpose && resolvedPurpose !== "UNKNOWN" ? { purpose: resolvedPurpose as import("../types").LoanType } : {}),
    ...(resolvedBucket && resolvedBucket !== "UNKNOWN" ? { amount_bucket: resolvedBucket as import("../types").AmountBucket } : {}),
    history: [...session.history, { role: "user", content: message }, { role: "assistant", content: finalReply }],
  });

  return res.json({ sessionId, bot_reply: finalReply, offers });
}