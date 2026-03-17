import { createContext, useContext, useState, ReactNode } from "react";
import en from "@/locales/en.json";
import es from "@/locales/es.json";

export type Language = "en" | "es";

const locales = { en, es } as const;

export type Locale = typeof en;

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Locale;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => {},
  t: en,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem("finai-language") as Language | null;
    return stored === "es" ? "es" : "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("finai-language", lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: locales[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
