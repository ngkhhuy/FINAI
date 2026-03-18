/**
 * FINAI – API client
 *
 * Wraps the single backend endpoint:
 *   POST /api/chat/message
 *
 * Shape mirrors the backend ChatResponse type:
 *   { session_id, message, step, offers?, suggestions? }
 */

const rawApiBase = import.meta.env.VITE_API_URL?.trim();
const API_BASE = rawApiBase ? rawApiBase.replace(/\/$/, "") : "/api";
const CHAT_MESSAGE_ENDPOINT = API_BASE.endsWith("/api")
  ? `${API_BASE}/chat/message`
  : `${API_BASE}/api/chat/message`;

// ── Response types (mirrors backend types/index.ts) ───────────────────────────

export type ConversationStep =
  | "greeting"
  | "q1_purpose"
  | "q2_urgency"
  | "q3_amount"
  | "results"
  | "fallback";

export interface ApiOffer {
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
  apply_url: string; // already contains session UTM params from backend
  is_best: boolean;
  is_featured: boolean;
}

export interface ChatApiResponse {
  session_id: string;
  message: string;
  step: ConversationStep;
  offers?: ApiOffer[];
  suggestions?: string[];
}

// ── Request ───────────────────────────────────────────────────────────────────

export interface ChatApiRequest {
  session_id?: string;
  message: string;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
}

// ── Client ────────────────────────────────────────────────────────────────────

/**
 * Send a chat message to the backend and receive the AI reply + offers.
 * Throws a typed Error on network failure or non-2xx HTTP status.
 */
export async function sendChatMessage(payload: ChatApiRequest): Promise<ChatApiResponse> {
  const response = await fetch(CHAT_MESSAGE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Required for Microsoft Dev Tunnels cross-origin requests
      "X-Tunnel-Skip-Anti-Csrf-Check": "1",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body?.error ?? "";
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(detail || `Server error ${response.status}`);
  }

  return response.json() as Promise<ChatApiResponse>;
}
