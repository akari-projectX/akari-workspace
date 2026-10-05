import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

/*
 * Theme is applied here (no inline script in index.html: the panel CSP is
 * script-src 'self'). Order: ?theme= → localStorage → prefers-color-scheme.
 */
function initialTheme(): "light" | "dark" {
  const q = new URLSearchParams(window.location.search).get("theme");
  if (q === "dark" || q === "light") return q;
  try {
    const s = localStorage.getItem("akari.theme");
    if (s === "dark" || s === "light") return s;
  } catch {
    /* storage blocked */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const theme = initialTheme();
document.documentElement.classList.toggle("dark", theme === "dark");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App initialTheme={theme} />
  </StrictMode>,
);
