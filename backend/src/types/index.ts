// ── Loan types ─────────────────────────────────────────────
export type LoanType =
  | "PAYDAY"
  | "PERSONAL"
  | "INSTALLMENT"
  | "DEBT_RELIEF"
  | "MORTGAGE"
  | "AUTO";

export type Language = "en" | "es";

export type UrgencyLevel =
  | "within_hours"
  | "today"
  | "one_to_three_days"
  | "not_urgent";

export type AmountBucket =
  | "under_500"
  | "500_to_1k"
  | "1k_to_3k"
  | "3k_to_10k"
  | "over_10k";

// ── Offer (from Google Sheet) ──────────────────────────────
export interface Offer {
  offer_id: string;
  brand_name: string;
  loan_type: LoanType;
  apply_url: string;
  amount_min: number;
  amount_max: number;
  term_min: number;
  term_max: number;
  apr_min: number;
  apr_max: number;
  speed_label: string;
  conditions_short: string;
  pros_1: string;
  pros_2: string;
  pros_3: string;
  is_active: boolean;
  is_featured: boolean;
  featured_weight: number;
}

// ── Chat history ───────────────────────────────────────────
export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Chat session ───────────────────────────────────────────
export type ConversationStep =
  | "greeting"
  | "q1_purpose"
  | "q2_urgency"
  | "q3_amount"
  | "q4_state"
  | "q5_credit"
  | "q6_income"
  | "results"
  | "fallback";

export interface SessionData {
  session_id: string;
  language: Language;
  step: ConversationStep;
  purpose?: LoanType;
  urgency?: UrgencyLevel;
  amount_bucket?: AmountBucket;
  credit_band?: string;
  income_source?: string;
  state?: string;
  history: ChatHistoryMessage[];
  created_at: number;
  updated_at: number;
  // Ad click IDs forwarded to apply URLs
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
}

// ── Chat API ───────────────────────────────────────────────
export interface ChatRequest {
  session_id?: string;
  message: string;
  // Click IDs from landing URL (only on first message)
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
}

export interface OfferResult {
  offer_id: string;
  brand_name: string;
  campaign_label: string;
  tagline: string;
  amount_range: string;
  term_range: string;
  apr_range: string;
  speed_label: string;
  conditions_short: string;
  pros: string[];
  apply_url: string; // includes session UTM params
  is_best: boolean;
  is_featured: boolean;
}

export interface ChatResponse {
  session_id: string;
  message: string;
  step: ConversationStep;
  offers?: OfferResult[];
  suggestions?: string[];
}

// ── Tracking ───────────────────────────────────────────────
export interface ClickEvent {
  session_id: string;
  offer_id: string;
  timestamp: string;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
}

// ── Admin ──────────────────────────────────────────────────
export interface UpdateOfferBody {
  is_active?: boolean;
  is_featured?: boolean;
  featured_weight?: number;
}
