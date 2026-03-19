import { useState, useRef, KeyboardEvent } from "react";
import { Send, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import { useIsMobile } from "@/hooks/use-mobile";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  // Hide footer elements when keyboard is open on mobile to save space
  const hideFooter = isMobile && isFocused;

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  return (
    <div className="border-t border-border bg-card/90 backdrop-blur-md" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pt-3 pb-2">
        {/* Input box */}
        <div className="flex items-end gap-2 bg-background border border-border rounded-xl px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-sm">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Ask me anything... (Enter to send)"
            rows={1}
            className="flex-1 resize-none bg-transparent text-base sm:text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed py-0.5 max-h-[140px] scrollbar-thin"
            disabled={disabled}
          />
          <button
            onPointerDown={(e) => e.preventDefault()} // prevent textarea blur on mobile tap
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            className={cn(
              "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all",
              input.trim() && !disabled
                ? "gradient-hero text-primary-foreground shadow-sm hover:opacity-90 active:scale-95"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            aria-label="Send"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Explore link + disclaimer hint — hidden when keyboard is open on mobile */}
        {!hideFooter && (
          <div className="flex items-center justify-between mt-2">
            <a
              href="#"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {t.input.exploreLink}
              <ArrowRight className="w-3 h-3" />
            </a>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {t.input.shiftEnterHint}
            </span>
          </div>
        )}
      </div>

      {/* Sticky disclaimer footer — hidden when keyboard is open on mobile */}
      {!hideFooter && (
        <div className="border-t border-border bg-muted/60 px-3 py-2">
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed max-w-2xl mx-auto">
            ⚠️ FINAI <strong>{t.input.disclaimerBold}</strong> {t.input.disclaimerRest}
          </p>
        </div>
      )}
    </div>
  );
}
