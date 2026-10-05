import { createContext, useContext } from "react";

export type Lang = "zh" | "en";

export const LangContext = createContext<Lang>("zh");

/** `tr("中文", "English")` — Chinese first, English when the toggle is on. */
export function useTr() {
  const lang = useContext(LangContext);
  return (zh: string, en: string) => (lang === "en" ? en : zh);
}

export function useLang() {
  return useContext(LangContext);
}
