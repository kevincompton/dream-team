const DEBUG_ENABLED = process.env.NEXT_PUBLIC_DASHBOARD_DEBUG === "true";
const DEFAULT_THROTTLE_MS = Number(process.env.NEXT_PUBLIC_DASHBOARD_LOG_THROTTLE_MS || "15000");
const LOG_LEVEL = (process.env.NEXT_PUBLIC_DASHBOARD_LOG_LEVEL || "info").toLowerCase();
const lastLogAtByKey = new Map<string, number>();

interface DashboardLogOptions {
  key?: string;
  throttleMs?: number;
  force?: boolean;
}

export function isDashboardDebugEnabled() {
  return DEBUG_ENABLED;
}

function shouldEmitByLevel(kind: "log" | "warn") {
  if (LOG_LEVEL === "off") return false;
  if (LOG_LEVEL === "warn" && kind === "log") return false;
  return true;
}

function shouldEmitLog(scope: string, message: string, options?: DashboardLogOptions) {
  if (options?.force) return true;

  const throttleMs = options?.throttleMs ?? DEFAULT_THROTTLE_MS;
  if (throttleMs <= 0) return true;

  const now = Date.now();
  const key = options?.key || `${scope}:${message}`;
  const lastAt = lastLogAtByKey.get(key) ?? 0;

  if (now - lastAt < throttleMs) {
    return false;
  }

  lastLogAtByKey.set(key, now);
  return true;
}

export function dashboardLog(scope: string, message: string, payload?: unknown, options?: DashboardLogOptions) {
  if (!DEBUG_ENABLED) return;
  if (!shouldEmitByLevel("log")) return;
  if (!shouldEmitLog(scope, message, options)) return;

  const prefix = `[DASHBOARD][${scope}]`;
  if (payload !== undefined) {
    console.log(prefix, message, payload);
    return;
  }

  console.log(prefix, message);
}

export function dashboardWarn(scope: string, message: string, payload?: unknown, options?: DashboardLogOptions) {
  if (!DEBUG_ENABLED) return;
  if (!shouldEmitByLevel("warn")) return;
  if (!shouldEmitLog(scope, message, options)) return;

  const prefix = `[DASHBOARD][${scope}]`;
  if (payload !== undefined) {
    console.warn(prefix, message, payload);
    return;
  }

  console.warn(prefix, message);
}
