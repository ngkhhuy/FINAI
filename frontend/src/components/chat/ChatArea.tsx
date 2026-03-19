import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types/chat";
import type { TrackingParams } from "@/lib/tracking";
import { ChatMessageItem } from "./ChatMessageItem";
import { PromptSuggestions } from "./PromptSuggestions";

interface ChatAreaProps {
  messages: ChatMessage[];
  onFeedback: (id: string, value: "up" | "down") => void;
  onSuggestionSelect: (text: string) => void;
  trackingParams?: TrackingParams;
  /** Extra bottom padding so messages don't scroll under the floating input bar */
  bottomPadding?: number;
}

export function ChatArea({ messages, onFeedback, onSuggestionSelect, trackingParams = {}, bottomPadding }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const showSuggestions = messages.length === 0;

  return (
    <div
      className="flex-1 overflow-y-auto scrollbar-thin bg-chat-surface"
      style={bottomPadding ? { paddingBottom: bottomPadding } : undefined}
    >
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-4">
        {showSuggestions ? (
          <PromptSuggestions onSelect={onSuggestionSelect} />
        ) : (
          messages.map((msg) => (
            <ChatMessageItem key={msg.id} message={msg} onFeedback={onFeedback} trackingParams={trackingParams} />
          ))
        )}
        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  );
}
