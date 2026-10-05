import { useEffect, useState } from "react";

/*
 * No router library: the prototype keeps its state in the query string so
 * every screen is linkable and screenshot-able:
 *   ?page=users        current page
 *   ?theme=dark|light  forced theme (otherwise localStorage / OS)
 *   ?lang=en           English UI
 *   ?state=loading|empty|error  render the page in that state
 *   ?open=<id>         open the detail drawer for that row
 *   ?demo=<name>       open a dialog/palette for screenshots
 */
export type PageId =
  | "login"
  | "dashboard"
  | "status"
  | "users"
  | "orders"
  | "nodes"
  | "plans"
  | "settings"
  | "coupons"
  | "finance"
  | "tickets"
  | "content"
  | "alerts"
  | "updates"
  | "audit"
  | "account";

export function getParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

export function setParams(patch: Record<string, string | null>, replace = false) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  }
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
  window.dispatchEvent(new Event("akari:route"));
}

export function useParam(name: string): string | null {
  const [value, setValue] = useState(() => getParam(name));
  useEffect(() => {
    const sync = () => setValue(getParam(name));
    window.addEventListener("popstate", sync);
    window.addEventListener("akari:route", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("akari:route", sync);
    };
  }, [name]);
  return value;
}

export function navigate(page: PageId) {
  setParams({ page, open: null, demo: null, state: null, tab: null });
  window.scrollTo(0, 0);
}

/** Page view state for skeleton/empty/error demos. */
export type ViewState = "ready" | "loading" | "empty" | "error";

export function useViewState(): ViewState {
  const s = useParam("state");
  return s === "loading" || s === "empty" || s === "error" ? s : "ready";
}
