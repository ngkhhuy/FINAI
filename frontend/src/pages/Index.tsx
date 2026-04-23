import { useState, useCallback, useRef, useEffect } from "react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatArea } from "@/components/chat/ChatArea";
import { ChatInput } from "@/components/chat/ChatInput";
import { useLanguage } from "@/hooks/use-language";
import type { ChatMessage, LoanOffer } from "@/types/chat";
import { getSessionId, clearSession } from "@/lib/session";
import { getTrackingParams, appendTrackingParams } from "@/lib/tracking";
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

  // Container ref — locked to window.innerHeight ONCE at mount.
  // This height never changes, so the page never jumps when the keyboard opens.
  const containerRef = useRef<HTMLDivElement>(null);

  // Input bar ref — tracks visual viewport so it slides up with the keyboard.
  const inputBarRef = useRef<HTMLDivElement>(null);
  const [bottomPadding, setBottomPadding] = useState(80);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.height = `${window.innerHeight}px`;
    }

    const update = () => {
      window.scrollTo(0, 0);
      const vv = window.visualViewport;
      const bar = inputBarRef.current;
      if (!bar) return;
      const barH = bar.offsetHeight || 80;
      const kH = vv
        ? Math.max(0, window.innerHeight - vv.height - (vv.offsetTop ?? 0))
        : 0;
      setKeyboardHeight(kH);
      setBottomPadding(barH + kH);
    };

    // iOS keyboard takes ~300ms to fully appear, fire update at multiple points
    const updateWithDelay = () => {
      update();
      setTimeout(update, 100);
      setTimeout(update, 300);
    };

    requestAnimationFrame(update);
    window.visualViewport?.addEventListener("resize", updateWithDelay);
    window.visualViewport?.addEventListener("scroll", update);
    // Fallback: focusin fires when any input is focused (iOS keyboard about to show)
    document.addEventListener("focusin", updateWithDelay);
    document.addEventListener("focusout", updateWithDelay);
    return () => {
      window.visualViewport?.removeEventListener("resize", updateWithDelay);
      window.visualViewport?.removeEventListener("scroll", update);
      document.removeEventListener("focusin", updateWithDelay);
      document.removeEventListener("focusout", updateWithDelay);
    };
  }, []);

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
      // Append any remaining tracking params (msclkid, utm_campaign, utm_content, utm_term, etc.)
      // that the backend doesn't store. gclid/fbclid/ttclid are already in the URL from the backend.
      const tracking = trackingParams.current;
      const offers: LoanOffer[] = (result.offers ?? []).map((o) => {
        // Build tracking URL: /api/tracking/click?offer_id=&session_id=&url=<destination>
        const destination = appendTrackingParams(o.apply_url, tracking);
        const trackingUrl = `/api/tracking/click?offer_id=${encodeURIComponent(o.offer_id)}&session_id=${encodeURIComponent(sessionIdRef.current)}&url=${encodeURIComponent(destination)}`;
        return mapOffer({ ...o, apply_url: trackingUrl }, t);
      });

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
    <div ref={containerRef} className="fixed top-0 left-0 right-0 flex flex-col overflow-hidden bg-chat-surface" style={{ position: "fixed" }}>
      <ChatHeader onNewSession={handleNewSession} />
      <ChatArea
        messages={messages}
        onFeedback={handleFeedback}
        onSuggestionSelect={handleSend}
        trackingParams={trackingParams.current}
        bottomPadding={bottomPadding}
      />
      <div
        ref={inputBarRef}
        className="absolute left-0 right-0 bottom-0 z-10"
        style={{
          transform: `translateY(-${keyboardHeight}px)`,
          transition: keyboardHeight > 0 ? "transform 0.2s ease-out" : "none",
        }}
      >
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
}
