import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

interface PromptSuggestionsProps {
  onSelect: (text: string) => void;
}

export function PromptSuggestions({ onSelect }: PromptSuggestionsProps) {
  const { t } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center gap-3 py-3 px-4"
    >
      {/* Welcome */}
      <div className="text-center space-y-1.5 max-w-xs">
        <div className="mx-auto w-10 h-10 rounded-xl gradient-hero shadow-md flex items-center justify-center">
          <Lightbulb className="w-6 h-6 text-primary-foreground" />
        </div>
        <h2 className="font-display font-bold text-lg text-foreground">
          {t.suggestions.title}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t.suggestions.subtitle}
        </p>
      </div>

      {/* Suggestion chips */}
      <div className="grid grid-cols-2 gap-2 w-full max-w-md">
        {t.suggestions.items.map((s, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07, duration: 0.35 }}
            onClick={() => onSelect(s.value)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary-subtle text-left transition-all group shadow-card active:scale-[0.98]"
          >
            <span className="text-xl leading-none">{s.emoji}</span>
            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              {s.label}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
