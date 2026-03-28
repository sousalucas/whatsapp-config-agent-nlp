/**
 * Base application error that separates user-facing messages from technical details.
 *
 * - `messageKey`: i18n key for the user-friendly message
 * - `messageParams`: interpolation params for the i18n key
 * - `cause`: original error for logging/troubleshooting
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly messageKey: string,
    public readonly messageParams: Record<string, string> = {},
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class LLMError extends AppError {
  constructor(message: string, messageKey: string, messageParams?: Record<string, string>, cause?: unknown) {
    super(message, messageKey, messageParams, cause);
    this.name = "LLMError";
  }
}

export class WatiApiError extends AppError {
  constructor(
    message: string,
    messageKey: string,
    messageParams?: Record<string, string>,
    public readonly statusCode?: number,
    cause?: unknown
  ) {
    super(message, messageKey, messageParams, cause);
    this.name = "WatiApiError";
  }
}
