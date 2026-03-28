import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError, LLMError, WatiApiError } from "../src/utils/errors.js";
import { executeStep } from "../src/agent/executor.js";
import type { PlanStep } from "../src/agent/planner.js";
import type { WatiClient } from "../src/wati/types.js";

// Suppress logger output during tests
vi.mock("../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("error classes", () => {
  it("AppError carries messageKey and params for i18n", () => {
    const err = new AppError("technical detail", "error.unexpected", { foo: "bar" });
    expect(err.messageKey).toBe("error.unexpected");
    expect(err.messageParams).toEqual({ foo: "bar" });
    expect(err.message).toBe("technical detail");
    expect(err.name).toBe("AppError");
  });

  it("LLMError extends AppError", () => {
    const cause = new Error("raw SDK error");
    const err = new LLMError("LLM failed", "error.llm_auth", {}, cause);
    expect(err).toBeInstanceOf(AppError);
    expect(err.name).toBe("LLMError");
    expect(err.messageKey).toBe("error.llm_auth");
    expect(err.cause).toBe(cause);
  });

  it("WatiApiError carries statusCode", () => {
    const err = new WatiApiError("HTTP 429", "error.wati_rate_limit", {}, 429);
    expect(err).toBeInstanceOf(AppError);
    expect(err.name).toBe("WatiApiError");
    expect(err.statusCode).toBe(429);
    expect(err.messageKey).toBe("error.wati_rate_limit");
  });
});

describe("executor error handling", () => {
  function makeStep(toolName: string, toolInput: Record<string, unknown> = {}): PlanStep {
    return {
      toolCallId: "tc-test",
      toolName,
      toolInput,
      description: "Test step",
      destructive: false,
    };
  }

  function makeMockWati(overrides: Partial<WatiClient> = {}): WatiClient {
    return {
      getContacts: vi.fn(),
      getContactInfo: vi.fn(),
      addContact: vi.fn(),
      updateContactAttributes: vi.fn(),
      addTag: vi.fn(),
      removeTag: vi.fn(),
      getMessageTemplates: vi.fn(),
      sendTemplateMessage: vi.fn(),
      sendSessionMessage: vi.fn(),
      sendBroadcast: vi.fn(),
      getOperators: vi.fn(),
      assignOperator: vi.fn(),
      assignTicket: vi.fn(),
      ...overrides,
    };
  }

  it("returns userMessage from WatiApiError on step failure", async () => {
    const watiErr = new WatiApiError("HTTP 401", "error.wati_auth", {}, 401);
    const wati = makeMockWati({
      getContacts: vi.fn().mockRejectedValue(watiErr),
    });

    const result = await executeStep(makeStep("search_contacts"), wati);

    expect(result.success).toBe(false);
    expect(result.error).toBe("HTTP 401");
    expect(result.userMessage).toBeDefined();
    // userMessage should be the translated string, not the technical error
    expect(result.userMessage).not.toBe("HTTP 401");
  });

  it("returns generic userMessage for non-AppError failures", async () => {
    const wati = makeMockWati({
      getContacts: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    });

    const result = await executeStep(makeStep("search_contacts"), wati);

    expect(result.success).toBe(false);
    expect(result.error).toBe("ECONNREFUSED");
    expect(result.userMessage).toBeDefined();
  });

  it("returns userMessage for unknown tool", async () => {
    const wati = makeMockWati();
    const result = await executeStep(makeStep("nonexistent_tool"), wati);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown tool");
    expect(result.userMessage).toBeDefined();
  });

  it("succeeds without userMessage on happy path", async () => {
    const wati = makeMockWati({
      getContacts: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    });

    const result = await executeStep(makeStep("search_contacts"), wati);

    expect(result.success).toBe(true);
    expect(result.userMessage).toBeUndefined();
  });
});
