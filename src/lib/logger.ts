import { supabase } from "@/integrations/supabase/client";
import { reportLovableError } from "./lovable-error-reporting";

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Lightweight app logger. Mirrors to console, persists warn/error to the
 * `log_events` table (RLS-scoped to the acting user), and forwards errors to
 * Lovable error reporting for production observability.
 *
 * Never pass raw phone numbers, tokens, or wallet balances in meta.
 */
export function log(level: LogLevel, event: string, meta?: Record<string, unknown>) {
  const route = typeof window !== "undefined" ? window.location.pathname : undefined;
  const line = `[palama:${level}] ${event}`;
  if (level === "error") console.error(line, meta ?? "");
  else if (level === "warn") console.warn(line, meta ?? "");
  else console.log(line, meta ?? "");

  if (level === "warn" || level === "error") {
    // Fire-and-forget: never let logging break user flow.
    supabase.rpc("log_event", {
      _level: level, _event: event, _route: route ?? null, _meta: (meta ?? null) as never,
    } as never).then(() => {}, () => {});
    if (level === "error") {
      reportLovableError(new Error(event), { source: "palama_logger", ...(meta ?? {}) });
    }
  }
}

export const logger = {
  debug: (event: string, meta?: Record<string, unknown>) => log("debug", event, meta),
  info:  (event: string, meta?: Record<string, unknown>) => log("info",  event, meta),
  warn:  (event: string, meta?: Record<string, unknown>) => log("warn",  event, meta),
  error: (event: string, meta?: Record<string, unknown>) => log("error", event, meta),
};