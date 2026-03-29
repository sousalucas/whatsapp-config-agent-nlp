import { test, expect } from "../fixtures/playwright-fixtures.js";
import { scenarioGreeting, scenarioListVIPContacts } from "../fixtures/llm-scenarios.js";

test.describe("Web UI chat interaction", () => {
  test("user can send a message and receive a response", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);
    scenarioGreeting(testContext.llm);

    // Type and submit message
    await page.locator("#user-input").fill("hello");
    await page.locator("#btn-send").click();

    // User message should appear
    const userMsg = page.locator("#messages .message.user");
    await expect(userMsg.first()).toContainText("hello");

    // Wait for assistant response
    const assistantMsgs = page.locator("#messages .message.assistant");
    // First one is welcome, second should be the response
    await expect(assistantMsgs.nth(1)).toBeVisible({ timeout: 10_000 });
    await expect(assistantMsgs.nth(1)).toContainText("WhatsApp Business assistant");
  });

  test("user can submit message with Enter key", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);
    scenarioGreeting(testContext.llm);

    await page.locator("#user-input").fill("hi");
    await page.locator("#user-input").press("Enter");

    const userMsg = page.locator("#messages .message.user");
    await expect(userMsg.first()).toContainText("hi");
  });

  test("empty message is not submitted", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);

    await page.locator("#btn-send").click();

    // Should still only have the welcome message
    const messages = page.locator("#messages .message");
    await expect(messages).toHaveCount(1);
  });

  test("read-only tool response is displayed", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);
    scenarioListVIPContacts(testContext.llm);

    await page.locator("#user-input").fill("list VIP contacts");
    await page.locator("#btn-send").click();

    // Wait for the response containing VIP
    const assistantMsgs = page.locator("#messages .message.assistant");
    await expect(assistantMsgs.nth(1)).toContainText("VIP", { timeout: 10_000 });
  });
});
