export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
};

function getMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && env in LEVEL_ORDER) return env as LogLevel;
  return "info";
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    const parts = [err.message];
    if (err.stack) parts.push(err.stack);
    if ("response" in err) {
      const resp = (err as Record<string, unknown>).response;
      if (resp && typeof resp === "object") {
        const { status, data } = resp as Record<string, unknown>;
        if (status) parts.push(`HTTP ${status}`);
        if (data) parts.push(`Response: ${JSON.stringify(data)}`);
      }
    }
    return parts.join("\n  ");
  }
  return String(err);
}

class Logger {
  private minLevel: LogLevel;

  constructor() {
    this.minLevel = getMinLevel();
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  private log(level: LogLevel, context: string, message: string, extra?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: Record<string, unknown> = {
      timestamp: formatTimestamp(),
      level: LEVEL_LABELS[level],
      context,
      message,
    };

    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        entry[key] = value instanceof Error ? formatError(value) : value;
      }
    }

    const line = JSON.stringify(entry);
    if (level === "error" || level === "warn") {
      process.stderr.write(line + "\n");
    } else {
      process.stderr.write(line + "\n");
    }
  }

  debug(context: string, message: string, extra?: Record<string, unknown>): void {
    this.log("debug", context, message, extra);
  }

  info(context: string, message: string, extra?: Record<string, unknown>): void {
    this.log("info", context, message, extra);
  }

  warn(context: string, message: string, extra?: Record<string, unknown>): void {
    this.log("warn", context, message, extra);
  }

  error(context: string, message: string, extra?: Record<string, unknown>): void {
    this.log("error", context, message, extra);
  }
}

export const logger = new Logger();
