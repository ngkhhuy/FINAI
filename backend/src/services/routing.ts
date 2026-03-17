import type {
  Offer,
  OfferResult,
  LoanType,
  AmountBucket,
  UrgencyLevel,
  SessionData,
} from "../types";
import { env } from "../config/env";
import { sessionService } from "./session";

// Map amount bucket → dollar midpoint for scoring
const BUCKET_MIDPOINT: Record<AmountBucket, number> = {
  under_500: 250,
  "500_to_1k": 750,
  "1k_to_3k": 2000,
  "3k_to_10k": 6500,
  over_10k: 15000,
};

function purposeScore(offer: Offer, purpose: LoanType): number {
  if (offer.loan_type === purpose) return 1.0;
  // Adjacent types get partial credit
  const adjacent: Partial<Record<LoanType, LoanType[]>> = {
    PERSONAL: ["INSTALLMENT", "DEBT_RELIEF"],
    INSTALLMENT: ["PERSONAL"],
    PAYDAY: ["PERSONAL"],
  };
  return (adjacent[purpose] ?? []).includes(offer.loan_type) ? 0.4 : 0;
}

function amountScore(offer: Offer, bucket: AmountBucket): number {
  const mid = BUCKET_MIDPOINT[bucket];
  if (mid >= offer.amount_min && mid <= offer.amount_max) return 1.0;
  if (mid < offer.amount_min) return Math.max(0, 1 - (offer.amount_min - mid) / offer.amount_min);
  return Math.max(0, 1 - (mid - offer.amount_max) / offer.amount_max);
}

function urgencyScore(offer: Offer, urgency: UrgencyLevel): number {
  const speed = offer.speed_label.toLowerCase();
  if (urgency === "within_hours") return speed.includes("hour") || speed.includes("same day") ? 1.0 : 0.2;
  if (urgency === "today") return speed.includes("same day") || speed.includes("today") ? 1.0 : 0.6;
  return 0.8; // 1–3 days or not_urgent → most offers OK
}

function scoreOffer(
  offer: Offer,
  purpose: LoanType,
  urgency: UrgencyLevel,
  bucket: AmountBucket
): number {
  return purposeScore(offer, purpose) * 0.5
    + amountScore(offer, bucket) * 0.3
    + urgencyScore(offer, urgency) * 0.2;
}

function formatRange(min: number, max: number, prefix = "$"): string {
  return `${prefix}${min.toLocaleString()} – ${prefix}${max.toLocaleString()}`;
}

function buildOfferResult(offer: Offer, session: SessionData, isBest: boolean): OfferResult {
  return {
    offer_id: offer.offer_id,
    brand_name: offer.brand_name,
    campaign_label: `${offer.brand_name} – ${offer.loan_type}`,
    tagline: offer.pros_1,
    amount_range: formatRange(offer.amount_min, offer.amount_max),
    term_range: `${offer.term_min}–${offer.term_max} months`,
    apr_range: `${offer.apr_min}%–${offer.apr_max}%/yr`,
    speed_label: offer.speed_label,
    conditions_short: offer.conditions_short,
    pros: [offer.pros_1, offer.pros_2, offer.pros_3].filter(Boolean),
    apply_url: sessionService.buildApplyUrl(offer.apply_url, session),
    is_best: isBest,
    is_featured: offer.is_featured,
  };
}

export const routingService = {
  /**
   * Select Best + 2 Alternatives from active offers.
   *
   * Rules (from finai.md §2):
   * 1. Score all active offers.
   * 2. Best = highest scorer matching purpose.
   * 3. Featured offer:
   *    - If matches purpose → boost by featured_weight and include in top 3.
   *    - If cross-group → Best stays correct-purpose, Featured appears as Alt #2.
   * 4. Fill remaining slots with next highest scorers.
   */
  selectOffers(
    activeOffers: Offer[],
    purpose: LoanType,
    urgency: UrgencyLevel,
    bucket: AmountBucket,
    session: SessionData,
    maxOffers = 3
  ): OfferResult[] {
    if (activeOffers.length === 0) return [];

    // Score all
    const scored = activeOffers.map((offer) => ({
      offer,
      score: scoreOffer(offer, purpose, urgency, bucket),
    }));

    const featured = scored.find((s) => s.offer.is_featured);
    const featuredMatchesPurpose = featured && featured.offer.loan_type === purpose;

    if (featured && featuredMatchesPurpose) {
      // Boost featured score
      const weight = featured.offer.featured_weight ?? env.FEATURED_DEFAULT_WEIGHT;
      featured.score = featured.score * (1 - weight) + weight;
    }

    // Sort descending
    scored.sort((a, b) => b.score - a.score);

    const selected: typeof scored = [];

    // Slot 0: Best (must match purpose)
    const best = scored.find((s) => s.offer.loan_type === purpose);
    if (best) selected.push(best);

    // Fill remaining slots
    for (const s of scored) {
      if (selected.length >= maxOffers) break;
      if (selected.includes(s)) continue;

      // Cross-group featured → force into Alt #2 position (index 1)
      if (featured && !featuredMatchesPurpose && s.offer.offer_id === featured.offer.offer_id) {
        if (selected.length === 1) selected.push(s);
        continue;
      }
      selected.push(s);
    }

    // Ensure cross-group featured is in Alt #2 if not already inserted
    if (featured && !featuredMatchesPurpose && !selected.includes(featured)) {
      if (selected.length >= 2) selected.splice(1, 0, featured);
      else selected.push(featured);
    }

    return selected.slice(0, maxOffers).map((s, i) =>
      buildOfferResult(s.offer, session, i === 0)
    );
  },
};
