import type {
  ChatRequest,
  ChatResponse,
  Language,
  LoanType,
  UrgencyLevel,
  AmountBucket,
  SessionData,
  ChatHistoryMessage,
  ConversationStep,
} from "../types";
import { analyzeMessage } from "./ai.service";
import { sessionService } from "./session";
import { sheetsService } from "./sheets";
import { routingService } from "./routing";
import { maskPII } from "../utils/piiMask";
import { logger } from "../utils/logger";

// ── Language detection ──────────────────────────────────────
const ES_PATTERN =
  /\b(hola|buenos|gracias|quiero|necesito|pr[eé]stamo|dinero|cu[aá]nto|ayuda|por favor|necesita|tengo|pagar|deuda)\b/i;

function detectLanguage(text: string): Language {
  return ES_PATTERN.test(text) ? "es" : "en";
}

// ── Fallback suggestions ────────────────────────────────────
const SUGGESTIONS: Record<Language, string[]> = {
  en: [
    "I need a quick loan to cover an unexpected bill",
    "I want to consolidate my debts into one monthly payment",
    "I need money for a car repair or home improvement",
  ],
  es: [
    "Necesito un préstamo rápido para cubrir una factura inesperada",
    "Quiero consolidar mis deudas en un solo pago mensual",
    "Necesito dinero para reparar mi auto o mejorar mi hogar",
  ],
};

// ── AmountBucket mapping ────────────────────────────────────
// ai.service uses human-readable labels; types/index.ts uses snake_case keys
function mapAmountBucket(raw: string): AmountBucket {
  const map: Record<string, AmountBucket> = {
    "<$500": "under_500",
    "$500-$1k": "500_to_1k",
    "$1k-$3k": "1k_to_3k",
    "$3k-$10k": "3k_to_10k",
    ">$10k": "over_10k",
  };
  return map[raw] ?? "1k_to_3k";
}

// ── Step resolver ───────────────────────────────────────────
// Determines the current step purely from what data has been collected,
// replacing the old hardcoded state-machine transitions.
function resolveStep(session: Pick<SessionData, "purpose" | "urgency" | "amount_bucket">): ConversationStep {
  if (!session.purpose) return "q1_purpose";
  if (!session.urgency) return "q2_urgency";
  if (!session.amount_bucket) return "q3_amount";
  return "results";
}

// ── PII reply ───────────────────────────────────────────────
function getPIIReply(lang: Language): string {
  return lang === "es"
    ? "Por tu seguridad, no compartas información personal aquí. Cuando estés listo, haz clic en **Solicitar** para ingresar tus datos de forma segura en el sitio oficial del prestamista."
    : "For your security, please don't share personal information here. When you're ready, click **Apply** to enter your details securely on the lender's official website.";
}

// ── Main service ────────────────────────────────────────────
export const chatService = {
  async handleMessage(req: ChatRequest): Promise<ChatResponse> {
    // ── 1. PII guard — must run before any data reaches the AI ─────────────
    const safeMessage = maskPII(req.message);
    if (safeMessage !== req.message) {
      const existingSession = req.session_id ? sessionService.get(req.session_id) : null;
      const lang = existingSession?.language ?? detectLanguage(req.message);
      const session =
        existingSession ??
        sessionService.create(lang, {
          gclid: req.gclid,
          fbclid: req.fbclid,
          ttclid: req.ttclid,
        });
      return {
        session_id: session.session_id,
        message: getPIIReply(lang),
        step: session.step,
      };
    }

    // ── 2. Resolve or create session ─────────────────────────────────────
    let session: SessionData;
    if (req.session_id) {
      session =
        sessionService.get(req.session_id) ??
        sessionService.create(detectLanguage(safeMessage), {
          gclid: req.gclid,
          fbclid: req.fbclid,
          ttclid: req.ttclid,
        });
    } else {
      session = sessionService.create(detectLanguage(safeMessage), {
        gclid: req.gclid,
        fbclid: req.fbclid,
        ttclid: req.ttclid,
      });
    }

    // ── 3. Single AI call with full conversation history ──────────────────
    const aiResult = await analyzeMessage(safeMessage, session.history);

    logger.debug("AI result", {
      session_id: session.session_id,
      step: session.step,
      purpose: aiResult.purpose,
      urgency: aiResult.urgency,
      amount_bucket: aiResult.amount_bucket,
      is_out_of_scope: aiResult.is_out_of_scope,
    });

    // ── 4. Out-of-scope guard — return AI reply without updating state ─────
    if (aiResult.is_out_of_scope) {
      return {
        session_id: session.session_id,
        message: aiResult.reply_message,
        step: session.step,
        suggestions: SUGGESTIONS[session.language ?? "en"],
      };
    }

    // ── 5. Merge AI-extracted data into session ───────────────────────────
    const patch: Partial<SessionData> = {};

    if (aiResult.purpose !== "UNKNOWN") {
      patch.purpose = aiResult.purpose as LoanType;
    }
    if (aiResult.urgency !== "UNKNOWN") {
      patch.urgency = aiResult.urgency as UrgencyLevel;
    }
    if (aiResult.amount_bucket !== "UNKNOWN") {
      patch.amount_bucket = mapAmountBucket(aiResult.amount_bucket);
    }

    // Update language if detected on first message
    if (session.step === "greeting") {
      patch.language = detectLanguage(safeMessage);
    }

    // ── 6. Append turn to conversation history ────────────────────────────
    const updatedHistory: ChatHistoryMessage[] = [
      ...session.history,
      { role: "user", content: safeMessage },
      { role: "assistant", content: aiResult.reply_message },
    ];
    patch.history = updatedHistory;

    // ── 7. Determine next step and return ──────────────────────────────────
    const mergedSession = { ...session, ...patch };
    const nextStep = resolveStep(mergedSession);
    const allCollected = nextStep === "results";

    // ─── Case A: just collected the last piece — show offers ───────────────
    if (allCollected && session.step !== "results") {
      patch.step = "results";
      sessionService.update(session.session_id, patch);

      const activeOffers = await sheetsService.getActiveOffers();
      const finalSession = sessionService.get(session.session_id)!;
      const offers = routingService.selectOffers(
        activeOffers,
        finalSession.purpose!,
        finalSession.urgency!,
        finalSession.amount_bucket!,
        finalSession
      );

      return {
        session_id: session.session_id,
        message: aiResult.reply_message,
        step: "results",
        offers,
      };
    }

    // ─── Case B: follow-up message after results — keep showing offers ─────
    if (session.step === "results" || session.step === "fallback") {
      patch.step = "fallback";
      sessionService.update(session.session_id, patch);

      const activeOffers = await sheetsService.getActiveOffers();
      const finalSession = sessionService.get(session.session_id)!;
      const offers = routingService.selectOffers(
        activeOffers,
        finalSession.purpose ?? "PERSONAL",
        finalSession.urgency ?? "not_urgent",
        finalSession.amount_bucket ?? "1k_to_3k",
        finalSession
      );

      return {
        session_id: session.session_id,
        message: aiResult.reply_message,
        step: "fallback",
        offers,
        suggestions: SUGGESTIONS[session.language ?? "en"],
      };
    }

    // ─── Case C: still collecting data — return conversational reply ───────
    patch.step = nextStep;
    sessionService.update(session.session_id, patch);

    return {
      session_id: session.session_id,
      message: aiResult.reply_message,
      step: nextStep,
      // Show suggestions on the very first reply so user has quick-start options
      suggestions: nextStep === "q1_purpose" ? SUGGESTIONS[session.language ?? "en"] : undefined,
    };
  },
};
