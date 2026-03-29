import { test, expect } from "../fixtures/playwright-fixtures.js";
import { scenarioGreeting, scenarioListVIPContacts, scenarioOutOfScope, scenarioSendTemplate } from "../fixtures/llm-scenarios.js";

test.describe("POST /api/chat", () => {
  test("returns text response for a greeting", async ({ testContext }) => {
    scenarioGreeting(testContext.llm);

    const response = await fetch(`${testContext.baseURL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.text).toBeTruthy();
    expect(data.plan).toBeNull();
  });

  test("returns 400 when message is missing", async ({ testContext }) => {
    const response = await fetch(`${testContext.baseURL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("message is required");
  });

  test("returns 400 when message is not a string", async ({ testContext }) => {
    const response = await fetch(`${testContext.baseURL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: 123 }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("message is required");
  });

  test("executes read-only tools and returns result", async ({ testContext }) => {
    scenarioListVIPContacts(testContext.llm);

    const response = await fetch(`${testContext.baseURL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "list VIP contacts" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.text).toContain("VIP");
    expect(data.plan).toBeNull();
  });

  test("refuses out-of-scope requests without calling any tools", async ({ testContext }) => {
    scenarioOutOfScope(testContext.llm);

    const response = await fetch(`${testContext.baseURL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "What is the capital of France?" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.text).toBeTruthy();
    expect(data.plan).toBeNull();
    expect(data.text).toMatch(/whatsapp|wati|contacts|templates/i);
  });

  test("returns plan with requiresConfirmation for destructive actions", async ({ testContext }) => {
    scenarioSendTemplate(testContext.llm);

    const response = await fetch(`${testContext.baseURL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "send welcome template to Carlos" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.plan).toBeTruthy();
    expect(data.plan.requiresConfirmation).toBe(true);
    expect(data.plan.steps.length).toBeGreaterThan(0);
  });
});
