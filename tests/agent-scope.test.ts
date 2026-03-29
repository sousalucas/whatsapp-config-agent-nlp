import { describe, it, expect, beforeEach } from "vitest";
import { Agent } from "../src/agent/agent.js";
import { MockLLMProvider } from "../e2e/fixtures/mock-llm.js";
import type { WatiClient } from "../src/wati/types.js";

// Minimal stub — out-of-scope tests never call WATI tools
const watiStub = {} as WatiClient;

describe("Agent scope enforcement", () => {
  let llm: MockLLMProvider;
  let agent: Agent;

  beforeEach(() => {
    llm = new MockLLMProvider();
    agent = new Agent(llm, watiStub);
  });

  it("returns refusal text with no plan when LLM refuses an out-of-scope request", async () => {
    llm.enqueueText(
      "I'm sorry, I can only help with WhatsApp Business management tasks. Please ask me something related to your WATI account."
    );

    const result = await agent.handleUserInput("What is the capital of France?");

    expect(result.plan).toBeNull();
    expect(result.text).toMatch(/whatsapp|wati/i);
  });

  it("returns refusal text with no plan for general coding questions", async () => {
    llm.enqueueText(
      "I'm only able to assist with WhatsApp Business tasks via the WATI API. I cannot help with general coding questions."
    );

    const result = await agent.handleUserInput("How do I reverse a string in Python?");

    expect(result.plan).toBeNull();
    expect(result.text).toMatch(/whatsapp|wati/i);
  });

  it("does not trigger any pending plan after an out-of-scope refusal", async () => {
    llm.enqueueText("I can only help with WhatsApp Business tasks.");

    await agent.handleUserInput("Tell me a joke.");

    expect(agent.hasPendingPlan()).toBe(false);
  });
});
