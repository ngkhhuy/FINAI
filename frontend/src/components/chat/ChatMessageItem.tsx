import { ThumbsUp, ThumbsDown, Bot, User } from "lucide-react";
import { motion } from "framer-motion";
import type { ChatMessage } from "@/types/chat";
import type { TrackingParams } from "@/lib/tracking";
import { OfferCard } from "./OfferCard";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";

interface ChatMessageItemProps {
  message: ChatMessage;
  onFeedback: (id: string, value: "up" | "down") => void;
  trackingParams?: TrackingParams;
}

export function ChatMessageItem({ message, onFeedback, trackingParams = {} }: ChatMessageItemProps) {
  const isUser = message.role === "user";
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("flex gap-2.5 w-full", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-1",
          isUser
            ? "gradient-hero"
            : "bg-muted border border-border"
        )}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.5} />
        ) : (
          <Bot className="w-3.5 h-3.5 text-primary" strokeWidth={2.5} />
        )}
      </div>

      {/* Bubble content */}
      <div className={cn("flex flex-col gap-1.5 max-w-[82%] sm:max-w-[72%]", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-tr-sm bg-chat-user-bg text-chat-user-fg"
              : "rounded-tl-sm bg-chat-ai-bg text-chat-ai-fg border border-border shadow-card"
          )}
        >
          {message.isStreaming && !message.content ? (
            <TypingIndicator />
          ) : (
            <div>
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              {message.isStreaming && (
                <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 cursor-blink align-middle" />
              )}
            </div>
          )}
        </div>

        {/* Offer cards */}
        {message.offers && message.offers.length > 0 && (
          <div className="w-full space-y-2">
            {message.offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} trackingParams={trackingParams} />
            ))}
          </div>
        )}

        {/* Feedback buttons (only for AI messages that are done streaming) */}
        {!isUser && !message.isStreaming && (
          <div className="flex items-center gap-1 mt-0.5">
            <button
              onClick={() => onFeedback(message.id, "up")}
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95",
                message.feedback === "up"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-primary hover:bg-primary-subtle"
              )}
              aria-label="Helpful"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onFeedback(message.id, "down")}
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95",
                message.feedback === "down"
                  ? "bg-destructive text-destructive-foreground"
                  : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              )}
              aria-label="Not helpful"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-muted-foreground ml-1">
              {message.timestamp.toLocaleTimeString(t.dateLocale, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        {/* User timestamp */}
        {isUser && (
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString(t.dateLocale, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse-dot"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </div>
  );
}
