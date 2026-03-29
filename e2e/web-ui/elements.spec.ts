import { test, expect } from "../fixtures/playwright-fixtures.js";

test.describe("Web UI elements", () => {
  test("page loads with correct title", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);
    await expect(page).toHaveTitle("WhatsApp Config Agent");
  });

  test("header is visible", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);
    await expect(page.locator("h1")).toContainText("WhatsApp Config Agent");
  });

  test("language select has EN and PT options", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);
    const langSelect = page.locator("#lang-select");
    await expect(langSelect).toBeVisible();
    const options = langSelect.locator("option");
    await expect(options).toHaveCount(2);
    await expect(options.nth(0)).toHaveText("EN");
    await expect(options.nth(1)).toHaveText("PT");
  });

  test("input form and send button are present", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);
    await expect(page.locator("#user-input")).toBeVisible();
    await expect(page.locator("#btn-send")).toBeVisible();
  });

  test("welcome message is displayed", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);
    const messages = page.locator("#messages .message.assistant");
    await expect(messages.first()).toBeVisible();
  });

  test("confirm bar is hidden initially", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);
    const confirmBar = page.locator("#confirm-bar");
    await expect(confirmBar).toHaveClass(/hidden/);
  });
});
