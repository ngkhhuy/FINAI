export interface LoanOffer {
  /** Unique offer identifier from backend */
  id: string;
  brand: string;
  /** Sub-label shown below brand name */
  campaign: string;
  /** Highlight tagline (mapped from pros[0]) */
  tagline: string;
  amountRange: string;
  termRange: string;
  aprRange: string;
  processingSpeed: string;
  commonRequirements: string;
  /** Final apply URL — already has session_id; tracking params appended by OfferCard */
  applyUrl: string;
  /** "Best Match" / "Featured" badge label */
  badgeLabel?: string;
  /** Whether this is the top-scored offer */
  isBest: boolean;
  /** Whether this is the lender's featured/sponsored offer */
  isFeatured: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  isStreaming?: boolean;
  offers?: LoanOffer[];
  suggestions?: string[];
  feedback?: "up" | "down" | null;
  timestamp: Date;
}

export type QuickChip = {
  label: string;
  value: string;
  type: "amount" | "term" | "purpose";
};
