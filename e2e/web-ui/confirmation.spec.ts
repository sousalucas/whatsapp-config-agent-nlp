import { test, expect } from "../fixtures/playwright-fixtures.js";
import { scenarioSendTemplate } from "../fixtures/llm-scenarios.js";

test.describe("Web UI confirmation flow", () => {
  test("destructive action shows confirm bar", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);
    scenarioSendTemplate(testContext.llm);

    await page.locator("#user-input").fill("send welcome template to Carlos");
    await page.locator("#btn-send").click();

    // Wait for confirm bar to become visible
    const confirmBar = page.locator("#confirm-bar");
    await expect(confirmBar).not.toHaveClass(/hidden/, { timeout: 10_000 });

    // Confirm and reject buttons should be visible
    await expect(page.locator("#btn-confirm")).toBeVisible();
    await expect(page.locator("#btn-reject")).toBeVisible();
  });

  test("confirming executes the plan", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);
    scenarioSendTemplate(testContext.llm);

    await page.locator("#user-input").fill("send welcome template to Carlos");
    await page.locator("#btn-send").click();

    // Wait for confirm bar
    await expect(page.locator("#confirm-bar")).not.toHaveClass(/hidden/, {
      timeout: 10_000,
    });

    // Click confirm
    await page.locator("#btn-confirm").click();

    // Confirm bar should be hidden again
    await expect(page.locator("#confirm-bar")).toHaveClass(/hidden/);

    // Wait for execution result
    const messages = page.locator("#messages .message.assistant");
    const lastMsg = messages.last();
    await expect(lastMsg).toContainText("welcome message", { timeout: 10_000 });
  });

  test("rejecting cancels the plan", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);
    scenarioSendTemplate(testContext.llm);

    await page.locator("#user-input").fill("send welcome template to Carlos");
    await page.locator("#btn-send").click();

    // Wait for confirm bar
    await expect(page.locator("#confirm-bar")).not.toHaveClass(/hidden/, {
      timeout: 10_000,
    });

    // Click reject
    await page.locator("#btn-reject").click();

    // Confirm bar should be hidden
    await expect(page.locator("#confirm-bar")).toHaveClass(/hidden/);

    // Input should be re-enabled
    await expect(page.locator("#user-input")).toBeEnabled();
  });

  test("plan steps are displayed in the chat", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);
    scenarioSendTemplate(testContext.llm);

    await page.locator("#user-input").fill("send welcome template to Carlos");
    await page.locator("#btn-send").click();

    // Plan should be displayed with steps
    const plan = page.locator(".plan");
    await expect(plan.first()).toBeVisible({ timeout: 10_000 });
    await expect(plan.first().locator("li")).toHaveCount(1);
  });
});
