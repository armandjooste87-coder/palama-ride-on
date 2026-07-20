// Client-side runtime error + failed-network reporter.
// Wires window error handlers and a fetch wrapper into the existing
// Lovable error reporting channel and log_events table.

import { reportLovableError } from "./lovable-error-reporting";
import { log } from "./logger";

let installed = false;

// Endpoints we should never re-report on to avoid infinite loops.
const IGNORED_URL_SUBSTRINGS = [
  "/rest/v1/rpc/log_event",
  "/realtime/v1",
  "google-analytics",
  "googletagmanager",
  "gpteng.co",
];

function shouldIgnoreUrl(url: string): boolean {
  return IGNORED_URL_SUBSTRINGS.some((s) => url.includes(s));
}

function summarizeUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

export function installRuntimeReporter() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    const err = event.error ?? new Error(event.message || "window.onerror");
    reportLovableError(err, {
      source: "window_onerror",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
    log("error", "window_onerror", { message: String(event.message ?? "") });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const err = reason instanceof Error ? reason : new Error(String(reason));
    reportLovableError(err, { source: "unhandled_rejection" });
    log("error", "unhandled_rejection", { message: err.message });
  });

  // Fetch wrapper — records HTTP failures and network errors.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const started = performance.now();
    try {
      const res = await originalFetch(input as RequestInfo, init);
      if (!res.ok && !shouldIgnoreUrl(url)) {
        const duration = Math.round(performance.now() - started);
        log("warn", "fetch_http_error", {
          url: summarizeUrl(url),
          method,
          status: res.status,
          duration_ms: duration,
        });
        if (res.status >= 500) {
          reportLovableError(new Error(`HTTP ${res.status} ${method} ${summarizeUrl(url)}`), {
            source: "fetch_http_error",
            status: res.status,
            method,
          });
        }
      }
      return res;
    } catch (err) {
      if (!shouldIgnoreUrl(url)) {
        const duration = Math.round(performance.now() - started);
        log("error", "fetch_network_error", {
          url: summarizeUrl(url),
          method,
          duration_ms: duration,
          message: err instanceof Error ? err.message : String(err),
        });
        reportLovableError(err, {
          source: "fetch_network_error",
          url: summarizeUrl(url),
          method,
        });
      }
      throw err;
    }
  };
}