import { useState, useCallback, useRef } from "react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatArea } from "@/components/chat/ChatArea";
import { ChatInput } from "@/components/chat/ChatInput";
import { useLanguage } from "@/hooks/use-language";
import type { ChatMessage, LoanOffer } from "@/types/chat";
import { getSessionId, clearSession } from "@/lib/session";
import { getTrackingParams } from "@/lib/tracking";
import { sendChatMessage } from "@/lib/api";
import type { ApiOffer } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2);
}

/** Map the backend ApiOffer shape → frontend LoanOffer consumed by OfferCard */
function mapOffer(o: ApiOffer, t: ReturnType<typeof useLanguage>["t"]): LoanOffer {
  const badge = o.is_best
    ? t.offerCard?.badgeBest ?? "Best Match"
    : o.is_featured
    ? t.offerCard?.badgeFeatured ?? "Featured"
    : undefined;

  return {
    id: o.offer_id,
    brand: o.brand_name,
    campaign: o.campaign_label,
    tagline: o.tagline || o.pros[0] || o.conditions_short,
    amountRange: o.amount_range,
    termRange: o.term_range,
    aprRange: o.apr_range,
    processingSpeed: o.speed_label,
    commonRequirements: o.conditions_short,
    applyUrl: o.apply_url,
    badgeLabel: badge,
    isBest: o.is_best,
    isFeatured: o.is_featured,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Index() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();

  // Capture tracking params once per page load (URL params don't change)
  const trackingParams = useRef(getTrackingParams());

  // Session ID is resolved immediately on mount from localStorage
  const sessionIdRef = useRef<string>(getSessionId());

  // ── Send handler ──────────────────────────────────────────────────────────

  const handleSend = useCallback(async (text: string) => {
    if (isLoading) return;

    // 1. Add user message immediately
    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    // 2. Add a "bot is typing" placeholder
    const botPlaceholderId = generateId();
    const botPlaceholder: ChatMessage = {
      id: botPlaceholderId,
      role: "ai",
      content: "",
      isStreaming: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, botPlaceholder]);
    setIsLoading(true);

    try {
      // 3. Call the real backend
      const result = await sendChatMessage({
        session_id: sessionIdRef.current,
        message: text,
        gclid: trackingParams.current.gclid,
        fbclid: trackingParams.current.fbclid,
        ttclid: trackingParams.current.ttclid,
      });

      // Update sessionId if backend returns a different one (e.g. after expiry)
      if (result.session_id) {
        sessionIdRef.current = result.session_id;
      }

      // 4. Map API offers → UI offers
      const offers: LoanOffer[] = (result.offers ?? []).map((o) => mapOffer(o, t));

      // 5. Replace placeholder with real reply + offers + suggestions
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botPlaceholderId
            ? {
                ...m,
                content: result.message,
                isStreaming: false,
                offers: offers.length > 0 ? offers : undefined,
                suggestions: result.suggestions,
              }
            : m
        )
      );
    } catch {
      // 6. Network / server error — show friendly error message
      const errorReply =
        t.errors?.networkError ??
        "Sorry, the system is experiencing an interruption. Please try again.";

      setMessages((prev) =>
        prev.map((m) =>
          m.id === botPlaceholderId
            ? { ...m, content: errorReply, isStreaming: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, t]);

  // ── Feedback handler ──────────────────────────────────────────────────────

  const handleFeedback = useCallback((id: string, value: "up" | "down") => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, feedback: m.feedback === value ? null : value } : m
      )
    );
  }, []);

  // ── New session ───────────────────────────────────────────────────────────

  const handleNewSession = useCallback(() => {
    clearSession();
    sessionIdRef.current = getSessionId(); // immediately mint a fresh one
    setMessages([]);
    setIsLoading(false);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden bg-chat-surface">
      <ChatHeader onNewSession={handleNewSession} />
      <ChatArea
        messages={messages}
        onFeedback={handleFeedback}
        onSuggestionSelect={handleSend}
        trackingParams={trackingParams.current}
      />
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
