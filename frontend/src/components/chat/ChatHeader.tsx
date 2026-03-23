import { Moon, Sun, PlusCircle, Globe } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  onNewSession: () => void;
}

export function ChatHeader({ onNewSession }: ChatHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-md">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <img
          src="/logo.png"
          alt="LendoraAI"
          className={`h-36 w-auto max-w-[360px] object-contain -my-[4.5rem] transition-[filter] duration-200 ${theme === "light" ? "invert" : ""}`}
        />
        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-subtle text-primary border border-primary/20">
          {t.header.tagline}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onNewSession}
          className="gap-1.5 text-xs font-medium"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.header.newChat}</span>
        </Button>

        {/* Language toggle */}
        <button
          onClick={() => setLanguage(language === "en" ? "es" : "en")}
          className="flex items-center gap-1 h-8 px-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-xs font-semibold text-muted-foreground hover:text-foreground"
          aria-label={t.header.toggleLang}
        >
          <Globe className="w-3.5 h-3.5" />
          {language === "en" ? "ES" : "EN"}
        </button>

        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors"
          aria-label={t.header.toggleTheme}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-offer-badge" />
          ) : (
            <Moon className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>
    </header>
  );
}
