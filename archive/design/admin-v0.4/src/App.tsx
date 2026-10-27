import { useCallback, useEffect, useState } from "react";
import { LangContext, type Lang } from "./lib/i18n";
import { useParam, type PageId } from "./lib/route";
import { allNav } from "./lib/nav";
import { Shell } from "./shell";
import { Providers } from "./ui/overlays";
import { LoginPage } from "./pages/login";
import { DashboardPage } from "./pages/dashboard";
import { UsersPage } from "./pages/users";
import { NodesPage } from "./pages/nodes";
import { PlansPage } from "./pages/plans";
import { OrdersPage } from "./pages/orders";
import { SettingsPage } from "./pages/settings";
import { StatusPage } from "./pages/status";
import { PlaceholderPage } from "./pages/placeholder";

function initialLang(): Lang {
  const q = new URLSearchParams(window.location.search).get("lang");
  if (q === "en" || q === "zh") return q;
  try {
    return localStorage.getItem("akari.lang") === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

export function App({ initialTheme }: { initialTheme: "light" | "dark" }) {
  const [theme, setTheme] = useState(initialTheme);
  const [lang, setLang] = useState<Lang>(initialLang);
  const pageParam = useParam("page");
  const page: PageId = pageParam === "login" || allNav.some((n) => n.id === pageParam) ? (pageParam as PageId) : "dashboard";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("akari.theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    try {
      localStorage.setItem("akari.lang", lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  const toggleLang = useCallback(() => setLang((l) => (l === "zh" ? "en" : "zh")), []);

  return (
    <LangContext.Provider value={lang}>
      <Providers>
        {page === "login" ? (
          <LoginPage theme={theme} onTheme={toggleTheme} onLang={toggleLang} />
        ) : (
          <Shell page={page} theme={theme} onTheme={toggleTheme} lang={lang} onLang={toggleLang}>
            <Page page={page} />
          </Shell>
        )}
      </Providers>
    </LangContext.Provider>
  );
}

function Page({ page }: { page: PageId }) {
  switch (page) {
    case "dashboard":
      return <DashboardPage />;
    case "users":
      return <UsersPage />;
    case "nodes":
      return <NodesPage />;
    case "plans":
      return <PlansPage />;
    case "orders":
      return <OrdersPage />;
    case "settings":
      return <SettingsPage />;
    case "status":
      return <StatusPage />;
    default:
      return <PlaceholderPage page={page} />;
  }
}
