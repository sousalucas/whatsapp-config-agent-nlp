import { test, expect } from "../fixtures/playwright-fixtures.js";
import { scenarioSendTemplate } from "../fixtures/llm-scenarios.js";

test.describe("POST /api/confirm", () => {
  test("executes plan when confirmed", async ({ testContext }) => {
    // First, trigger a destructive plan
    scenarioSendTemplate(testContext.llm);

    const chatRes = await fetch(`${testContext.baseURL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "send welcome template to Carlos" }),
    });
    const chatData = await chatRes.json();
    expect(chatData.plan?.requiresConfirmation).toBe(true);

    // Confirm the plan
    const confirmRes = await fetch(`${testContext.baseURL}/api/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true }),
    });

    expect(confirmRes.status).toBe(200);
    const confirmData = await confirmRes.json();
    expect(confirmData.text).toBeTruthy();
    expect(confirmData.text).toContain("welcome message");
  });

  test("cancels plan when rejected", async ({ testContext }) => {
    // Trigger a destructive plan
    scenarioSendTemplate(testContext.llm);

    await fetch(`${testContext.baseURL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "send welcome template to Carlos" }),
    });

    // Reject the plan
    const rejectRes = await fetch(`${testContext.baseURL}/api/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: false }),
    });

    expect(rejectRes.status).toBe(200);
    const rejectData = await rejectRes.json();
    expect(rejectData.plan).toBeNull();
  });
});
